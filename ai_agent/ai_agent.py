#!/usr/bin/env python3
"""
ShadowMesh AI Agent Swarm
=========================
Three autonomous LLM-powered agents that manage the migration platform:

1. Pipeline Healer (DataOps Agent) - Monitors and heals Debezium connector
2. Traffic Guardian (SRE Agent) - Manages traffic routing based on latency
3. Integrity Verifier (QA Agent) - Compares data between Monolith and Microservice DBs

Powered by Groq (Llama 3) via LangChain
"""

import os
import sys
import time
import json
import threading
import requests
import psycopg2
import random
from datetime import datetime
from flask import Flask, jsonify
from flask_cors import CORS
from colorama import init, Fore, Style, Back

# LangChain imports
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage

# Initialize colorama
init(autoreset=True)
MONOLITH_URL = os.getenv('MONOLITH_URL', 'http://monolith:3000')
MONOLITH_DB_URL = os.getenv('MONOLITH_DB_URL', 'postgres://postgres:postgres@monolith_db:5432/monolith_db')
GATEWAY_URL = os.getenv('GATEWAY_URL', 'http://gateway:8080')
DEBEZIUM_URL = os.getenv('DEBEZIUM_URL', 'http://connect:8083')
MICROSERVICE_DB_URL = os.getenv('MICROSERVICE_DB_URL', 'postgres://postgres:postgres@microservice_db:5432/microservice_db')

GROQ_API_KEY = os.getenv('GROQ_API_KEY', '')

if GROQ_API_KEY:
    llm = ChatGroq(
        api_key=GROQ_API_KEY,
        model_name="llama-3.1-8b-instant",
        temperature=0.7,
        max_tokens=512
    )
else:
    llm = None

PIPELINE_HEALER_INTERVAL = 15
TRAFFIC_GUARDIAN_INTERVAL = 15
INTEGRITY_VERIFIER_INTERVAL = 15

USER_LATENCY_TOLERANCE = 300
DATA_LAG_TOLERANCE_SECONDS = 30

GROQ_RATE_LIMIT = 25
groq_call_times = []
groq_lock = threading.Lock()

agent_state = {
    "pipeline_healer": {
        "status": "initializing",
        "last_check": None,
        "connector_status": None,
        "thinking": None,
        "decision": None,
        "action_taken": None,
        "heals_performed": 0,
        "checks_performed": 0,
        "llm_input": None,  # The prompt sent to LLM
        "llm_output": None,  # Raw LLM response
        "system_prompt": None  # System context
    },
    "traffic_guardian": {
        "status": "initializing",
        "last_check": None,
        "latency_ms": None,
        "monolith_status": None,
        "current_weight": 0,
        "thinking": None,
        "decision": None,
        "action_taken": None,
        "traffic_shifts": 0,
        "checks_performed": 0,
        "llm_input": None,
        "llm_output": None,
        "system_prompt": None
    },
    "integrity_verifier": {
        "status": "initializing",
        "last_check": None,
        "records_compared": 0,
        "mismatches_found": 0,
        "last_comparison": None,
        "thinking": None,
        "decision": None,
        "action_taken": None,
        "force_syncs": 0,
        "checks_performed": 0,
        "llm_input": None,
        "llm_output": None,
        "system_prompt": None
    }
}
state_lock = threading.Lock()

# Debezium Connector Configuration
DEBEZIUM_CONNECTOR_CONFIG = {
    "name": "monolith-full-sync",
    "config": {
        "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
        "database.hostname": "monolith_db",
        "database.port": "5432",
        "database.user": "postgres",
        "database.password": "postgres",
        "database.dbname": "monolith_db",
        "database.server.name": "monolith",
        "topic.prefix": "monolith",
        "table.include.list": "public.products,public.reviews",
        "plugin.name": "pgoutput",
        "slot.name": "debezium_slot",
        "publication.name": "dbz_publication",
        "snapshot.mode": "initial",
        "decimal.handling.mode": "string",
        "key.converter": "org.apache.kafka.connect.json.JsonConverter",
        "value.converter": "org.apache.kafka.connect.json.JsonConverter",
        "key.converter.schemas.enable": "false",
        "value.converter.schemas.enable": "false"
    }
}

app = Flask(__name__, template_folder='templates')
CORS(app)

from flask import render_template

@app.route('/', methods=['GET'])
def index():
    return jsonify({
        "service": "ShadowMesh AI Agent Swarm",
        "status": "running",
        "dashboard": "/dashboard",
        "endpoints": {
            "health": "/health",
            "dashboard": "/dashboard",
            "agents_state": "/api/agents/state",
            "pipeline_healer": "/api/agents/pipeline-healer",
            "traffic_guardian": "/api/agents/traffic-guardian",
            "integrity_verifier": "/api/agents/integrity-verifier"
        }
    })

@app.route('/dashboard', methods=['GET'])
def dashboard():
    """Serve the AI Agent Dashboard - Real-time LLM thinking visualization"""
    return render_template('dashboard.html')

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy", "service": "ai-agent-swarm"})

@app.route('/api/agents/state', methods=['GET'])
def get_agent_state():
    """Return current state of all agents including LLM thinking"""
    with state_lock:
        return jsonify({
            "success": True,
            "timestamp": datetime.now().isoformat(),
            "agents": agent_state
        })

@app.route('/api/agents/pipeline-healer', methods=['GET'])
def get_pipeline_healer():
    with state_lock:
        return jsonify({"success": True, "agent": agent_state["pipeline_healer"]})

@app.route('/api/agents/traffic-guardian', methods=['GET'])
def get_traffic_guardian():
    with state_lock:
        return jsonify({"success": True, "agent": agent_state["traffic_guardian"]})

@app.route('/api/agents/integrity-verifier', methods=['GET'])
def get_integrity_verifier():
    with state_lock:
        return jsonify({"success": True, "agent": agent_state["integrity_verifier"]})


def timestamp():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def call_llm(prompt, system_prompt="You are an AI agent.", fallback_response="Unable to analyze"):
    """
    Call Groq LLM via LangChain with rate limiting awareness.
    Free tier: 30 requests/minute, 14,400 requests/day
    """
    global groq_call_times
    
    if not llm:
        return fallback_response + " (No API key configured)"
    
    # Check rate limit
    with groq_lock:
        current_time = time.time()
        # Remove calls older than 60 seconds
        groq_call_times = [t for t in groq_call_times if current_time - t < 60]
        
        if len(groq_call_times) >= GROQ_RATE_LIMIT:
            wait_time = 60 - (current_time - groq_call_times[0])
            return fallback_response + f" (Rate limited - {len(groq_call_times)}/min, wait {wait_time:.0f}s)"
        
        groq_call_times.append(current_time)
    
    try:
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=prompt)
        ]
        
        response = llm.invoke(messages)
        
        if response and response.content:
            return response.content.strip()
        else:
            return fallback_response + " (Empty response)"
            
    except Exception as e:
        error_msg = str(e).lower()
        if "rate" in error_msg or "limit" in error_msg:
            return fallback_response + " (Rate limited - using fallback)"
        return fallback_response + f" (Error: {str(e)[:100]})"


def get_monolith_db_connection():
    """Get connection to monolith database"""
    try:
        conn = psycopg2.connect(MONOLITH_DB_URL)
        return conn
    except Exception as e:
        print(f"{Fore.RED}[Monolith DB Error] {e}{Style.RESET_ALL}")
        return None


def get_microservice_db_connection():
    """Get connection to microservice database"""
    try:
        conn = psycopg2.connect(MICROSERVICE_DB_URL)
        return conn
    except Exception as e:
        print(f"{Fore.RED}[Microservice DB Error] {e}{Style.RESET_ALL}")
        return None


class PipelineHealerAgent:
    def __init__(self):
        self.name = "Pipeline Healer"
        self.emoji = "❤️‍🩹"
        self.color = Fore.MAGENTA
        self.heals_performed = 0
        self.checks_performed = 0
        self.last_status = None
        self.system_prompt = """You are a DataOps AI agent monitoring a Debezium CDC connector.
Your job is to analyze connector status and decide on healing actions.
Be concise and precise in your analysis."""
        
    def log(self, level, message):
        """Log with agent identity"""
        icons = {
            "INFO": "ℹ️",
            "SUCCESS": "✅",
            "WARNING": "⚠️",
            "ERROR": "❌",
            "HEAL": "❤️‍🩹",
            "THINKING": "🧠"
        }
        icon = icons.get(level, "📝")
        print(f"{Fore.BLUE}[{timestamp()}]{Style.RESET_ALL} {self.color}[{self.name}]{Style.RESET_ALL} {icon} {message}")
    
    def update_state(self, **kwargs):
        """Update shared state for frontend"""
        with state_lock:
            for key, value in kwargs.items():
                agent_state["pipeline_healer"][key] = value
            agent_state["pipeline_healer"]["last_check"] = datetime.now().isoformat()
            agent_state["pipeline_healer"]["heals_performed"] = self.heals_performed
            agent_state["pipeline_healer"]["checks_performed"] = self.checks_performed
    
    def get_connector_status(self):
        """Check Debezium connector status"""
        try:
            response = requests.get(
                f"{DEBEZIUM_URL}/connectors/monolith-full-sync/status",
                timeout=5
            )
            
            if response.status_code == 404:
                return {"status": "MISSING", "error": "Connector not found"}
            elif response.status_code == 200:
                data = response.json()
                connector_state = data.get("connector", {}).get("state", "UNKNOWN")
                tasks = data.get("tasks", [])
                
                # Check if any task failed
                for task in tasks:
                    if task.get("state") == "FAILED":
                        trace = task.get("trace", "No trace available")
                        return {
                            "status": "FAILED",
                            "error": trace[:500]
                        }
                
                return {"status": connector_state, "tasks": len(tasks)}
            else:
                return {"status": "ERROR", "error": f"HTTP {response.status_code}"}
                
        except requests.ConnectionError:
            return {"status": "UNREACHABLE", "error": "Cannot connect to Debezium"}
        except Exception as e:
            return {"status": "ERROR", "error": str(e)}
    
    def register_connector(self):
        """Register the Debezium connector"""
        try:
            response = requests.post(
                f"{DEBEZIUM_URL}/connectors",
                headers={"Content-Type": "application/json"},
                json=DEBEZIUM_CONNECTOR_CONFIG,
                timeout=10
            )
            return response.status_code in [200, 201, 409]
        except Exception as e:
            self.log("ERROR", f"Failed to register connector: {e}")
            return False
    
    def restart_connector(self):
        """Restart the failed connector"""
        try:
            response = requests.post(
                f"{DEBEZIUM_URL}/connectors/monolith-full-sync/restart",
                timeout=10
            )
            return response.status_code in [200, 204]
        except Exception as e:
            self.log("ERROR", f"Failed to restart connector: {e}")
            return False
    
    def analyze_with_llm(self, status, error_msg):
        """Use Groq LLM to analyze the situation"""
        prompt = f"""Analyze this Debezium CDC connector status:

Status: {status}
Error: {error_msg}

Based on this, what action should be taken?
- REGISTER: Connector is missing, needs to be registered
- RESTART: Connector failed, needs restart  
- WAIT: Connector is healthy, no action needed

Respond in this exact format:
THINKING: <your reasoning in 1-2 sentences>
DECISION: <REGISTER, RESTART, or WAIT>
EXPLANATION: <brief 10-word max explanation>"""

        # Store prompt in state for dashboard visibility
        self.update_state(
            llm_input=prompt,
            system_prompt=self.system_prompt
        )
        
        response = call_llm(prompt, self.system_prompt, "THINKING: Using fallback.\nDECISION: WAIT\nEXPLANATION: Fallback decision")
        
        # Store raw response
        self.update_state(llm_output=response)
        
        return response
        return response
    
    def parse_llm_response(self, response):
        """Parse LLM response into components"""
        thinking = ""
        decision = "WAIT"
        explanation = ""
        
        lines = response.strip().split('\n')
        for line in lines:
            if line.startswith("THINKING:"):
                thinking = line.replace("THINKING:", "").strip()
            elif line.startswith("DECISION:"):
                decision = line.replace("DECISION:", "").strip().upper()
            elif line.startswith("EXPLANATION:"):
                explanation = line.replace("EXPLANATION:", "").strip()
        
        return thinking, decision, explanation
    
    def run_cycle(self):
        """Run one monitoring cycle"""
        self.checks_performed += 1
        
        # OBSERVE
        status_result = self.get_connector_status()
        status = status_result.get("status")
        error_msg = status_result.get("error", "None")
        
        self.update_state(
            status="running",
            connector_status=status
        )
        
        # Skip if status unchanged and healthy
        if status == self.last_status and status == "RUNNING":
            self.update_state(
                thinking="Connector is healthy and running normally.",
                decision="No action needed",
                action_taken="Monitoring continues"
            )
            return
        
        self.last_status = status
        
        if status == "RUNNING":
            self.log("SUCCESS", f"Connector healthy (Tasks: {status_result.get('tasks', '?')})")
            self.update_state(
                thinking="Connector is healthy with all tasks running.",
                decision="WAIT",
                action_taken="None - connector healthy"
            )
            return
        
        if status == "UNREACHABLE":
            self.log("WARNING", "Debezium Connect service unreachable - waiting...")
            self.update_state(
                thinking="Cannot connect to Debezium service. May still be starting up.",
                decision="WAIT",
                action_taken="Waiting for service availability"
            )
            return
        
        # DECIDE (LLM Analysis)
        self.log("THINKING", f"Analyzing status: {status}")
        llm_response = self.analyze_with_llm(status, error_msg)
        thinking, decision, explanation = self.parse_llm_response(llm_response)
        
        self.log("THINKING", f"LLM Analysis: {thinking}")
        self.log("INFO", f"Decision: {decision} - {explanation}")
        
        self.update_state(
            thinking=thinking,
            decision=f"{decision}: {explanation}"
        )
        
        # ACT (Self-Healing)
        if "REGISTER" in decision or status == "MISSING":
            self.log("HEAL", "Connector MISSING - Registering connector...")
            if self.register_connector():
                self.heals_performed += 1
                self.update_state(action_taken="Registered new connector")
                print(f"""
{self.color}╔══════════════════════════════════════════════════════════════╗
║  {self.emoji} PIPELINE HEALED: Connector registered automatically!      ║
╚══════════════════════════════════════════════════════════════╝{Style.RESET_ALL}
""")
            else:
                self.log("ERROR", "Failed to register connector")
                self.update_state(action_taken="Failed to register connector")
                
        elif "RESTART" in decision or status == "FAILED":
            self.log("HEAL", f"Connector FAILED - Restarting...")
            self.log("INFO", f"Error trace: {error_msg[:200]}...")
            if self.restart_connector():
                self.heals_performed += 1
                self.update_state(action_taken="Restarted connector")
                print(f"""
{self.color}╔══════════════════════════════════════════════════════════════╗
║  {self.emoji} PIPELINE HEALED: Connector restarted automatically!       ║
╚══════════════════════════════════════════════════════════════╝{Style.RESET_ALL}
""")
            else:
                self.log("ERROR", "Failed to restart connector")
                self.update_state(action_taken="Failed to restart connector")
        else:
            self.update_state(action_taken="No action taken")


class TrafficGuardianAgent:
    def __init__(self):
        self.name = "Traffic Guardian"
        self.emoji = "🛡️"
        self.color = Fore.CYAN
        self.latency_history = []
        self.current_weight = 0
        self.last_decision_time = 0
        self.decision_cooldown = 15  # seconds between traffic changes
        self.checks_performed = 0
        self.traffic_shifts = 0
        self.system_prompt = """You are an SRE AI agent managing traffic between a Monolith and Microservice.
Your job is to protect users by routing traffic optimally based on latency metrics.
Use the Strangler Fig pattern for gradual migration. Be decisive and concise."""
        
    def log(self, level, message):
        """Log with agent identity"""
        icons = {
            "INFO": "ℹ️",
            "SUCCESS": "✅",
            "WARNING": "⚠️",
            "CRITICAL": "🚨",
            "ACTION": "🔄",
            "THINKING": "🧠"
        }
        icon = icons.get(level, "📝")
        print(f"{Fore.BLUE}[{timestamp()}]{Style.RESET_ALL} {self.color}[{self.name}]{Style.RESET_ALL} {icon} {message}")
    
    def update_state(self, **kwargs):
        """Update shared state for frontend"""
        with state_lock:
            for key, value in kwargs.items():
                agent_state["traffic_guardian"][key] = value
            agent_state["traffic_guardian"]["last_check"] = datetime.now().isoformat()
            agent_state["traffic_guardian"]["traffic_shifts"] = self.traffic_shifts
            agent_state["traffic_guardian"]["checks_performed"] = self.checks_performed
    
    def check_monolith_health(self):
        """Ping monolith and measure latency"""
        try:
            start = time.time()
            response = requests.get(f"{MONOLITH_URL}/health", timeout=10)
            latency_ms = (time.time() - start) * 1000
            
            if response.status_code == 200:
                return {"status": "UP", "latency": latency_ms}
            else:
                return {"status": "DEGRADED", "latency": latency_ms}
                
        except requests.Timeout:
            return {"status": "TIMEOUT", "latency": 10000}
        except Exception as e:
            return {"status": "DOWN", "latency": 0, "error": str(e)}
    
    def get_current_weight(self):
        """Get current traffic weight from gateway"""
        try:
            response = requests.get(f"{GATEWAY_URL}/admin/status", timeout=5)
            if response.status_code == 200:
                data = response.json()
                self.current_weight = data.get("trafficWeight", 0)
                return self.current_weight
        except:
            pass
        return self.current_weight
    
    def set_traffic_weight(self, weight):
        """Update traffic weight via gateway"""
        try:
            response = requests.post(
                f"{GATEWAY_URL}/admin/weight",
                json={"weight": weight},
                timeout=5
            )
            if response.status_code == 200:
                self.current_weight = weight
                self.traffic_shifts += 1
                return True
        except Exception as e:
            self.log("ERROR", f"Failed to set weight: {e}")
        return False
    
    def analyze_with_llm(self, latency, error_rate, current_weight):
        """Use Groq LLM to determine optimal traffic split"""
        avg_latency = sum(self.latency_history[-5:]) / len(self.latency_history[-5:]) if self.latency_history else latency
        
        # Rule-based fallback logic
        if error_rate > 0 or latency > USER_LATENCY_TOLERANCE * 1.5:
            fallback_weight = 100
            fallback_reason = "Critical: High latency/errors, immediate failover"
        elif latency > USER_LATENCY_TOLERANCE:
            fallback_weight = min(current_weight + 25, 100)
            fallback_reason = f"Warning: Latency {latency:.0f}ms > {USER_LATENCY_TOLERANCE}ms"
        elif latency < USER_LATENCY_TOLERANCE * 0.3 and current_weight > 0:
            fallback_weight = max(current_weight - 25, 0)
            fallback_reason = f"Healthy: Latency {latency:.0f}ms is low"
        else:
            fallback_weight = current_weight
            fallback_reason = "Stable: No change needed"
        
        prompt = f"""Analyze these metrics and decide traffic routing:

Current Latency: {latency:.0f}ms
Average Latency: {avg_latency:.0f}ms  
Tolerance Threshold: {USER_LATENCY_TOLERANCE}ms
Error Rate: {error_rate}%
Current Microservice Weight: {current_weight}%

Rules:
- High latency = shift more to Microservice
- Healthy latency = can reduce Microservice weight
- Changes in 25% increments unless critical
- Monolith DOWN = 100% Microservice immediately

Respond in this exact format:
THINKING: <your reasoning in 1-2 sentences>
WEIGHT: <number 0-100>
EXPLANATION: <brief 15-word max explanation>"""

        # Store prompt in state for dashboard visibility
        self.update_state(
            llm_input=prompt,
            system_prompt=self.system_prompt
        )

        fallback = f"THINKING: Using rule-based fallback.\nWEIGHT: {fallback_weight}\nEXPLANATION: {fallback_reason}"
        response = call_llm(prompt, self.system_prompt, fallback)
        
        # Store raw response
        self.update_state(llm_output=response)
        
        return response
    
    def parse_llm_response(self, response):
        """Parse LLM response into components"""
        thinking = ""
        weight = self.current_weight
        explanation = ""
        
        lines = response.strip().split('\n')
        for line in lines:
            if line.startswith("THINKING:"):
                thinking = line.replace("THINKING:", "").strip()
            elif line.startswith("WEIGHT:"):
                try:
                    weight = int(line.replace("WEIGHT:", "").strip())
                    weight = max(0, min(100, weight))
                except:
                    pass
            elif line.startswith("EXPLANATION:"):
                explanation = line.replace("EXPLANATION:", "").strip()
        
        return thinking, weight, explanation
    
    def run_cycle(self):
        """Run one monitoring cycle"""
        self.checks_performed += 1
        
        # Get current weight from gateway
        self.get_current_weight()
        
        # OBSERVE
        health = self.check_monolith_health()
        latency = health.get("latency", 0)
        status = health.get("status")
        
        # Track latency history
        if status == "UP":
            self.latency_history.append(latency)
            if len(self.latency_history) > 30:
                self.latency_history = self.latency_history[-30:]
        
        self.update_state(
            status="running",
            latency_ms=round(latency, 2),
            monolith_status=status,
            current_weight=self.current_weight
        )
        
        # Quick status log
        if status == "UP" and latency < USER_LATENCY_TOLERANCE:
            level = "SUCCESS"
        elif status == "UP":
            level = "WARNING"
        else:
            level = "CRITICAL"
        
        self.log(level, f"Latency: {latency:.0f}ms | Status: {status} | Weight: {self.current_weight}%")
        
        # Check if we need to make a decision
        current_time = time.time()
        
        # Critical: Monolith down - immediate action
        if status in ["DOWN", "TIMEOUT"]:
            self.update_state(
                thinking="CRITICAL: Monolith is unreachable! Must failover immediately to protect users.",
                decision="Immediate failover to 100% microservice"
            )
            if self.current_weight < 100:
                self.log("CRITICAL", "Monolith unreachable! Immediate failover!")
                if self.set_traffic_weight(100):
                    self.last_decision_time = current_time
                    self.update_state(action_taken="Emergency failover to 100% microservice")
                    print(f"""
{Fore.RED}╔══════════════════════════════════════════════════════════════╗
║  🚨 EMERGENCY FAILOVER: 100% traffic shifted to Microservice! ║
╚══════════════════════════════════════════════════════════════╝{Style.RESET_ALL}
""")
            return
        
        # Respect cooldown for non-critical decisions
        if current_time - self.last_decision_time < self.decision_cooldown:
            self.update_state(
                thinking=f"Cooldown active. Waiting {self.decision_cooldown - (current_time - self.last_decision_time):.0f}s before next decision.",
                decision="Wait for cooldown",
                action_taken="Monitoring"
            )
            return
        
        # DECIDE (LLM Analysis)
        self.log("THINKING", "Consulting LLM for traffic decision...")
        error_rate = 0 if status == "UP" else 100
        llm_response = self.analyze_with_llm(latency, error_rate, self.current_weight)
        thinking, new_weight, explanation = self.parse_llm_response(llm_response)
        
        self.log("THINKING", f"LLM Analysis: {thinking}")
        self.log("INFO", f"Recommended: {new_weight}% - {explanation}")
        
        self.update_state(
            thinking=thinking,
            decision=f"Set weight to {new_weight}%: {explanation}"
        )
        
        # ACT (Traffic Shifting)
        if new_weight != self.current_weight:
            self.log("ACTION", f"Shifting traffic: {self.current_weight}% → {new_weight}%")
            if self.set_traffic_weight(new_weight):
                self.last_decision_time = current_time
                direction = "↑" if new_weight > self.current_weight else "↓"
                self.update_state(action_taken=f"Shifted traffic from {self.current_weight}% to {new_weight}%")
                print(f"""
{self.color}╔══════════════════════════════════════════════════════════════╗
║  {self.emoji} TRAFFIC ADJUSTED: Microservice now at {new_weight}% {direction}             ║
╚══════════════════════════════════════════════════════════════╝{Style.RESET_ALL}
""")
        else:
            self.update_state(action_taken="No change - current weight is optimal")


class IntegrityVerifierAgent:
    def __init__(self):
        self.name = "Integrity Verifier"
        self.emoji = "🔍"
        self.color = Fore.YELLOW
        self.records_compared = 0
        self.mismatches_found = 0
        self.force_syncs = 0
        self.checks_performed = 0
        self.last_mismatch = None
        self.system_prompt = """You are a Data Integrity AI agent verifying data sync between databases.
Your job is to analyze data differences and decide if they need correction.
Consider CDC lag vs actual sync failures. Be precise and decisive."""
        
    def log(self, level, message):
        """Log with agent identity"""
        icons = {
            "INFO": "ℹ️",
            "SUCCESS": "✅",
            "WARNING": "⚠️",
            "ERROR": "❌",
            "SYNC": "🔄",
            "THINKING": "🧠",
            "COMPARE": "🔍"
        }
        icon = icons.get(level, "📝")
        print(f"{Fore.BLUE}[{timestamp()}]{Style.RESET_ALL} {self.color}[{self.name}]{Style.RESET_ALL} {icon} {message}")
    
    def update_state(self, **kwargs):
        """Update shared state for frontend"""
        with state_lock:
            for key, value in kwargs.items():
                agent_state["integrity_verifier"][key] = value
            agent_state["integrity_verifier"]["last_check"] = datetime.now().isoformat()
            agent_state["integrity_verifier"]["records_compared"] = self.records_compared
            agent_state["integrity_verifier"]["mismatches_found"] = self.mismatches_found
            agent_state["integrity_verifier"]["force_syncs"] = self.force_syncs
            agent_state["integrity_verifier"]["checks_performed"] = self.checks_performed
    
    def get_random_product_from_monolith(self):
        """Fetch a random product from monolith database"""
        conn = get_monolith_db_connection()
        if not conn:
            return None
        
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, name, price, stock, description, updated_at 
                FROM products 
                ORDER BY RANDOM() 
                LIMIT 1
            """)
            row = cursor.fetchone()
            cursor.close()
            conn.close()
            
            if row:
                return {
                    "id": row[0],
                    "name": row[1],
                    "price": float(row[2]) if row[2] else 0,
                    "stock": row[3],
                    "description": row[4],
                    "updated_at": row[5].isoformat() if row[5] else None,
                    "source": "monolith"
                }
            return None
        except Exception as e:
            self.log("ERROR", f"Failed to fetch from monolith: {e}")
            return None
    
    def get_product_from_microservice(self, product_id):
        """Fetch the same product from microservice database"""
        conn = get_microservice_db_connection()
        if not conn:
            return None
        
        try:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT id, name, price, stock, description, updated_at 
                FROM products 
                WHERE id = %s
            """, (product_id,))
            row = cursor.fetchone()
            cursor.close()
            conn.close()
            
            if row:
                return {
                    "id": row[0],
                    "name": row[1],
                    "price": float(row[2]) if row[2] else 0,
                    "stock": row[3],
                    "description": row[4],
                    "updated_at": row[5].isoformat() if row[5] else None,
                    "source": "microservice"
                }
            return None
        except Exception as e:
            self.log("ERROR", f"Failed to fetch from microservice: {e}")
            return None
    
    def force_sync_product(self, monolith_product):
        """Force sync a product from monolith to microservice"""
        conn = get_microservice_db_connection()
        if not conn:
            return False
        
        try:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO products (id, name, price, stock, description, updated_at)
                VALUES (%s, %s, %s, %s, %s, NOW())
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    price = EXCLUDED.price,
                    stock = EXCLUDED.stock,
                    description = EXCLUDED.description,
                    updated_at = NOW()
            """, (
                monolith_product["id"],
                monolith_product["name"],
                monolith_product["price"],
                monolith_product["stock"],
                monolith_product["description"]
            ))
            conn.commit()
            cursor.close()
            conn.close()
            return True
        except Exception as e:
            self.log("ERROR", f"Failed to force sync: {e}")
            return False
    
    def compare_records(self, monolith, microservice):
        """Compare two records and return differences"""
        differences = []
        
        if monolith["name"] != microservice["name"]:
            differences.append(f"name: '{monolith['name']}' vs '{microservice['name']}'")
        
        if abs(monolith["price"] - microservice["price"]) > 0.01:
            differences.append(f"price: ${monolith['price']:.2f} vs ${microservice['price']:.2f}")
        
        if monolith["stock"] != microservice["stock"]:
            differences.append(f"stock: {monolith['stock']} vs {microservice['stock']}")
        
        return differences
    
    def analyze_with_llm(self, monolith_record, microservice_record, differences, time_since_update):
        """Use Groq LLM to decide if differences are acceptable lag or require force sync"""
        
        # Rule-based fallback
        if time_since_update and time_since_update > DATA_LAG_TOLERANCE_SECONDS:
            fallback_decision = "FORCE_SYNC"
            fallback_reason = f"Data out of sync for {time_since_update:.0f}s, exceeds tolerance"
        elif len(differences) > 2:
            fallback_decision = "FORCE_SYNC"
            fallback_reason = "Multiple field mismatches detected"
        elif len(differences) > 0:
            fallback_decision = "WAIT"
            fallback_reason = "Minor differences, likely CDC lag"
        else:
            fallback_decision = "OK"
            fallback_reason = "Data is in sync"
        
        ms_info = f"ID: {microservice_record['id']}, Price: ${microservice_record['price']:.2f}, Stock: {microservice_record['stock']}" if microservice_record else "NOT FOUND"
        
        prompt = f"""Analyze this data sync status:

Monolith (Source): ID={monolith_record['id']}, Price=${monolith_record['price']:.2f}, Stock={monolith_record['stock']}
Microservice (Replica): {ms_info}
Differences: {differences if differences else 'None'}
Time Since Update: {time_since_update:.0f}s (Tolerance: {DATA_LAG_TOLERANCE_SECONDS}s)

Should we:
- OK: Data is in sync
- WAIT: Acceptable CDC lag, wait for sync
- FORCE_SYNC: Data corruption, force correction

Respond in this exact format:
THINKING: <your reasoning in 1-2 sentences>
DECISION: <OK, WAIT, or FORCE_SYNC>
EXPLANATION: <brief 15-word max explanation>"""

        # Store prompt in state for dashboard visibility
        self.update_state(
            llm_input=prompt,
            system_prompt=self.system_prompt
        )

        fallback = f"THINKING: Using rule-based analysis.\nDECISION: {fallback_decision}\nEXPLANATION: {fallback_reason}"
        response = call_llm(prompt, self.system_prompt, fallback)
        
        # Store raw response
        self.update_state(llm_output=response)
        
        return response
    
    def parse_llm_response(self, response):
        """Parse LLM response into components"""
        thinking = ""
        decision = "WAIT"
        explanation = ""
        
        lines = response.strip().split('\n')
        for line in lines:
            if line.startswith("THINKING:"):
                thinking = line.replace("THINKING:", "").strip()
            elif line.startswith("DECISION:"):
                decision = line.replace("DECISION:", "").strip().upper()
            elif line.startswith("EXPLANATION:"):
                explanation = line.replace("EXPLANATION:", "").strip()
        
        return thinking, decision, explanation
    
    def run_cycle(self):
        """Run one data integrity check cycle"""
        self.checks_performed += 1
        
        self.update_state(status="running")
        
        # OBSERVE - Get random product from monolith
        self.log("COMPARE", "Fetching random record from Monolith...")
        monolith_record = self.get_random_product_from_monolith()
        
        if not monolith_record:
            self.log("INFO", "No products found in Monolith or DB unavailable")
            self.update_state(
                thinking="Cannot fetch data from Monolith database. May be empty or unavailable.",
                decision="Skip check",
                action_taken="Waiting for data"
            )
            return
        
        self.log("INFO", f"Checking: {monolith_record['name']} (ID: {monolith_record['id']})")
        
        # Get same product from microservice
        microservice_record = self.get_product_from_microservice(monolith_record["id"])
        self.records_compared += 1
        
        # Calculate time difference
        time_since_update = 0
        if monolith_record.get("updated_at"):
            try:
                update_time = datetime.fromisoformat(monolith_record["updated_at"])
                time_since_update = (datetime.now() - update_time).total_seconds()
            except:
                time_since_update = 999
        
        # Check if record exists in microservice
        if not microservice_record:
            self.log("WARNING", f"Product ID {monolith_record['id']} NOT FOUND in Microservice!")
            self.mismatches_found += 1
            
            self.update_state(
                last_comparison={
                    "monolith": monolith_record,
                    "microservice": None,
                    "differences": ["Record missing in microservice"]
                },
                thinking="Record exists in Monolith but not in Microservice. CDC may not have synced yet.",
                decision="Analyzing if force sync needed..."
            )
            
            # Analyze with LLM
            llm_response = self.analyze_with_llm(monolith_record, None, ["Record missing"], time_since_update or 999)
            thinking, decision, explanation = self.parse_llm_response(llm_response)
            
            self.log("THINKING", f"LLM Analysis: {thinking}")
            self.update_state(
                thinking=thinking,
                decision=f"{decision}: {explanation}"
            )
            
            if "FORCE_SYNC" in decision:
                self.log("SYNC", f"Force syncing product: {monolith_record['name']}")
                if self.force_sync_product(monolith_record):
                    self.force_syncs += 1
                    self.update_state(action_taken=f"Force synced product ID {monolith_record['id']}")
                    print(f"""
{self.color}╔══════════════════════════════════════════════════════════════╗
║  {self.emoji} DATA HEALED: Force synced {monolith_record['name'][:30]:<30} ║
╚══════════════════════════════════════════════════════════════╝{Style.RESET_ALL}
""")
            else:
                self.update_state(action_taken="Waiting for CDC to sync")
            return
        
        # Compare records
        differences = self.compare_records(monolith_record, microservice_record)
        
        self.update_state(
            last_comparison={
                "monolith": monolith_record,
                "microservice": microservice_record,
                "differences": differences
            }
        )
        
        if not differences:
            self.log("SUCCESS", f"✓ Data in sync: {monolith_record['name']}")
            self.update_state(
                thinking="Both databases have identical data for this record. CDC pipeline is working correctly.",
                decision="OK - Data in sync",
                action_taken="No action needed"
            )
            return
        
        # Found differences - analyze
        self.mismatches_found += 1
        self.log("WARNING", f"Mismatch found: {', '.join(differences)}")
        
        # DECIDE (LLM Analysis)
        self.log("THINKING", "Analyzing data mismatch...")
        llm_response = self.analyze_with_llm(monolith_record, microservice_record, differences, time_since_update)
        thinking, decision, explanation = self.parse_llm_response(llm_response)
        
        self.log("THINKING", f"LLM Analysis: {thinking}")
        self.log("INFO", f"Decision: {decision} - {explanation}")
        
        self.update_state(
            thinking=thinking,
            decision=f"{decision}: {explanation}"
        )
        
        # ACT
        if "FORCE_SYNC" in decision:
            self.log("SYNC", f"Force syncing: {monolith_record['name']}")
            if self.force_sync_product(monolith_record):
                self.force_syncs += 1
                self.update_state(action_taken=f"Force synced to correct mismatch")
                print(f"""
{self.color}╔══════════════════════════════════════════════════════════════╗
║  {self.emoji} DATA CORRECTED: {monolith_record['name'][:40]:<40} ║
╚══════════════════════════════════════════════════════════════╝{Style.RESET_ALL}
""")
        else:
            self.update_state(action_taken="Waiting - acceptable lag")


class AgentSwarm:
    def __init__(self):
        self.pipeline_healer = PipelineHealerAgent()
        self.traffic_guardian = TrafficGuardianAgent()
        self.integrity_verifier = IntegrityVerifierAgent()
        self.running = True
        
    def print_banner(self):
        api_status = "✅ Connected" if GROQ_API_KEY else "⚠️ Not configured (using fallbacks)"
        
        print(f"""
{Fore.CYAN}╔══════════════════════════════════════════════════════════════════════╗
║                                                                      ║
║  {Fore.MAGENTA}███████╗██╗  ██╗ █████╗ ██████╗  ██████╗ ██╗    ██╗{Fore.CYAN}                 ║
║  {Fore.MAGENTA}██╔════╝██║  ██║██╔══██╗██╔══██╗██╔═══██╗██║    ██║{Fore.CYAN}                 ║
║  {Fore.MAGENTA}███████╗███████║███████║██║  ██║██║   ██║██║ █╗ ██║{Fore.CYAN}                 ║
║  {Fore.MAGENTA}╚════██║██╔══██║██╔══██║██║  ██║██║   ██║██║███╗██║{Fore.CYAN}                 ║
║  {Fore.MAGENTA}███████║██║  ██║██║  ██║██████╔╝╚██████╔╝╚███╔███╔╝{Fore.CYAN}                 ║
║  {Fore.MAGENTA}╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝  ╚═════╝  ╚══╝╚══╝ {Fore.CYAN}                 ║
║                                                                      ║
║  {Fore.WHITE}🤖 AI AGENT SWARM - Powered by Groq (Llama 3){Fore.CYAN}                      ║
║                                                                      ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║  {Fore.MAGENTA}❤️‍🩹 Agent 1: Pipeline Healer{Fore.WHITE}      (DataOps) - Every {PIPELINE_HEALER_INTERVAL}s{Fore.CYAN}         ║
║     {Fore.WHITE}└── Monitors & auto-heals Debezium CDC connector{Fore.CYAN}              ║
║                                                                      ║
║  {Fore.CYAN}🛡️  Agent 2: Traffic Guardian{Fore.WHITE}      (SRE)     - Every {TRAFFIC_GUARDIAN_INTERVAL}s{Fore.CYAN}         ║
║     {Fore.WHITE}└── Monitors latency & shifts traffic intelligently{Fore.CYAN}           ║
║                                                                      ║
║  {Fore.YELLOW}🔍 Agent 3: Integrity Verifier{Fore.WHITE}    (QA)      - Every {INTEGRITY_VERIFIER_INTERVAL}s{Fore.CYAN}         ║
║     {Fore.WHITE}└── Compares data between Monolith & Microservice{Fore.CYAN}             ║
║                                                                      ║
╠══════════════════════════════════════════════════════════════════════╣
║  {Fore.WHITE}Groq API: {api_status:<52}{Fore.CYAN}  ║
║  {Fore.WHITE}Model: llama-3.1-8b-instant (30 req/min free){Fore.CYAN}                    ║
║  {Fore.WHITE}API Server: http://0.0.0.0:5050{Fore.CYAN}                                   ║
╚══════════════════════════════════════════════════════════════════════╝
{Style.RESET_ALL}
""")
    
    def run_pipeline_healer(self):
        """Thread for Pipeline Healer agent"""
        while self.running:
            try:
                self.pipeline_healer.run_cycle()
            except Exception as e:
                print(f"{Fore.RED}[Pipeline Healer Error] {e}{Style.RESET_ALL}")
            time.sleep(PIPELINE_HEALER_INTERVAL)
    
    def run_traffic_guardian(self):
        """Thread for Traffic Guardian agent"""
        while self.running:
            try:
                self.traffic_guardian.run_cycle()
            except Exception as e:
                print(f"{Fore.RED}[Traffic Guardian Error] {e}{Style.RESET_ALL}")
            time.sleep(TRAFFIC_GUARDIAN_INTERVAL)
    
    def run_integrity_verifier(self):
        """Thread for Integrity Verifier agent"""
        while self.running:
            try:
                self.integrity_verifier.run_cycle()
            except Exception as e:
                print(f"{Fore.RED}[Integrity Verifier Error] {e}{Style.RESET_ALL}")
            time.sleep(INTEGRITY_VERIFIER_INTERVAL)
    
    def run_api_server(self):
        """Thread for Flask API server"""
        app.run(host='0.0.0.0', port=5050, threaded=True, use_reloader=False)
    
    def print_stats(self):
        """Print statistics for all agents"""
        print(f"""
{Fore.CYAN}╔══════════════════════════════════════════════════════════════════════╗
║  📊 {Fore.WHITE}AGENT SWARM STATISTICS{Fore.CYAN}                                            ║
╠══════════════════════════════════════════════════════════════════════╣
║  {Fore.MAGENTA}❤️‍🩹 Pipeline Healer:{Fore.WHITE}     Checks: {self.pipeline_healer.checks_performed:<5} | Heals: {self.pipeline_healer.heals_performed:<5}{Fore.CYAN}        ║
║  {Fore.CYAN}🛡️  Traffic Guardian:{Fore.WHITE}     Checks: {self.traffic_guardian.checks_performed:<5} | Shifts: {self.traffic_guardian.traffic_shifts:<5}{Fore.CYAN}       ║
║  {Fore.YELLOW}🔍 Integrity Verifier:{Fore.WHITE}   Checks: {self.integrity_verifier.checks_performed:<5} | Syncs: {self.integrity_verifier.force_syncs:<5}{Fore.CYAN}        ║
╚══════════════════════════════════════════════════════════════════════╝
{Style.RESET_ALL}
""")
    
    def run(self):
        """Start all agents"""
        self.print_banner()
        
        print(f"{Fore.CYAN}[{timestamp()}]{Style.RESET_ALL} ⏳ Waiting for services to initialize...")
        time.sleep(10)  # Wait for all services to be ready
        
        print(f"{Fore.CYAN}[{timestamp()}]{Style.RESET_ALL} 🚀 Launching AI Agent Swarm...\n")
        
        # Start API server in background
        api_thread = threading.Thread(target=self.run_api_server, name="APIServer", daemon=True)
        api_thread.start()
        print(f"{Fore.GREEN}[{timestamp()}]{Style.RESET_ALL} ✅ Started API Server on port 5050")
        
        # Start agent threads
        threads = [
            threading.Thread(target=self.run_pipeline_healer, name="PipelineHealer", daemon=True),
            threading.Thread(target=self.run_traffic_guardian, name="TrafficGuardian", daemon=True),
            threading.Thread(target=self.run_integrity_verifier, name="IntegrityVerifier", daemon=True)
        ]
        
        for t in threads:
            t.start()
            print(f"{Fore.GREEN}[{timestamp()}]{Style.RESET_ALL} ✅ Started {t.name}")
        
        print()
        
        # Main loop - print stats periodically
        try:
            stats_counter = 0
            while True:
                time.sleep(30)
                stats_counter += 1
                if stats_counter % 2 == 0:  # Every 60 seconds
                    self.print_stats()
                    
        except KeyboardInterrupt:
            print(f"\n{Fore.YELLOW}[{timestamp()}]{Style.RESET_ALL} ⚠️ Shutting down Agent Swarm...")
            self.running = False
            self.print_stats()
            print(f"{Fore.GREEN}[{timestamp()}]{Style.RESET_ALL} ✅ Agent Swarm stopped gracefully")


if __name__ == "__main__":
    swarm = AgentSwarm()
    swarm.run()

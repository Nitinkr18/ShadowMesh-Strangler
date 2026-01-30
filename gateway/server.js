const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 8080;
const MONOLITH_URL = process.env.MONOLITH_URL || 'http://monolith:3000';
const MICROSERVICE_URL = process.env.MICROSERVICE_URL || 'http://microservice:5000';

// Traffic weight (0-100): 0 = all monolith, 100 = all microservice
let trafficWeight = 0;

// Request statistics
const stats = {
  totalRequests: 0,
  monolithRequests: 0,
  microserviceRequests: 0,
  lastUpdate: new Date().toISOString()
};

app.use(cors());

// =============================================
// ROOT ENDPOINT
// =============================================
app.get('/', (req, res) => {
  res.json({
    service: "ShadowMesh API Gateway",
    status: "running",
    endpoints: {
      health: "/health",
      admin_status: "/admin/status",
      admin_weight: "/admin/weight (POST)",
      products: "/api/products",
      reviews: "/api/reviews"
    }
  });
});

// =============================================
// ADMIN DASHBOARD API (parse JSON for these)
// =============================================
app.get('/admin/status', (req, res) => {
  res.json({
    success: true,
    trafficWeight,
    stats,
    monolithUrl: MONOLITH_URL,
    microserviceUrl: MICROSERVICE_URL
  });
});

app.post('/admin/weight', express.json(), (req, res) => {
  const { weight } = req.body;
  
  if (weight === undefined || weight < 0 || weight > 100) {
    return res.status(400).json({ 
      success: false, 
      message: 'Weight must be between 0 and 100' 
    });
  }
  
  const oldWeight = trafficWeight;
  trafficWeight = parseInt(weight);
  
  console.log(`[GATEWAY] Traffic weight updated: ${oldWeight}% → ${trafficWeight}%`);
  
  res.json({ 
    success: true, 
    trafficWeight,
    message: `Traffic weight updated to ${trafficWeight}%`
  });
});

app.post('/admin/reset-stats', (req, res) => {
  stats.totalRequests = 0;
  stats.monolithRequests = 0;
  stats.microserviceRequests = 0;
  stats.lastUpdate = new Date().toISOString();
  
  res.json({ success: true, message: 'Statistics reset', stats });
});

// =============================================
// HEALTH CHECK
// =============================================
app.get('/health', async (req, res) => {
  const health = {
    gateway: 'healthy',
    monolith: 'unknown',
    microservice: 'unknown'
  };
  
  try {
    const monolithRes = await fetch(`${MONOLITH_URL}/health`, { timeout: 5000 });
    health.monolith = monolithRes.ok ? 'healthy' : 'unhealthy';
  } catch (e) {
    health.monolith = 'unreachable';
  }
  
  try {
    const microRes = await fetch(`${MICROSERVICE_URL}/health`, { timeout: 5000 });
    health.microservice = microRes.ok ? 'healthy' : 'unhealthy';
  } catch (e) {
    health.microservice = 'unreachable';
  }
  
  res.json({ success: true, health, trafficWeight });
});

// =============================================
// PRODUCT CREATION/UPDATE - Always to MONOLITH (multipart)
// =============================================
const monolithProductProxy = createProxyMiddleware({
  target: MONOLITH_URL,
  changeOrigin: true,
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[GATEWAY] Proxying ${req.method} ${req.originalUrl} → MONOLITH (write operation)`);
    stats.totalRequests++;
    stats.monolithRequests++;
  },
  onProxyRes: (proxyRes, req, res) => {
    proxyRes.headers['x-source'] = 'MONOLITH';
  },
  onError: (err, req, res) => {
    console.error('[GATEWAY] Proxy error:', err.message);
    res.status(503).json({ success: false, message: 'Service unavailable' });
  }
});

// POST/PUT/DELETE products always go to monolith
app.post('/api/products', monolithProductProxy);
app.put('/api/products/:id', monolithProductProxy);
app.delete('/api/products/:id', monolithProductProxy);

// Reviews always go to monolith (write operations)
app.post('/api/products/:id/reviews', monolithProductProxy);

// =============================================
// PRODUCT READS - Intelligent routing
// =============================================
app.get('/api/products', async (req, res) => {
  stats.totalRequests++;
  
  const random = Math.random() * 100;
  const useMonolith = random >= trafficWeight;
  
  const targetUrl = useMonolith ? MONOLITH_URL : MICROSERVICE_URL;
  const source = useMonolith ? 'MONOLITH' : 'MICROSERVICE';
  
  if (useMonolith) {
    stats.monolithRequests++;
  } else {
    stats.microserviceRequests++;
  }
  
  console.log(`[GATEWAY] Routing GET /api/products → ${source} (Weight: ${trafficWeight}%)`);
  
  try {
    const response = await fetch(`${targetUrl}/api/products`);
    const data = await response.json();
    
    res.set('X-Source', source);
    res.status(response.status).json({
      ...data,
      _gateway: {
        source,
        trafficWeight,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error(`[GATEWAY] Error from ${source}:`, error.message);
    
    // Fallback
    const fallbackUrl = useMonolith ? MICROSERVICE_URL : MONOLITH_URL;
    const fallbackSource = useMonolith ? 'MICROSERVICE' : 'MONOLITH';
    
    try {
      const fallbackResponse = await fetch(`${fallbackUrl}/api/products`);
      const fallbackData = await fallbackResponse.json();
      
      res.set('X-Source', fallbackSource);
      res.set('X-Fallback', 'true');
      res.status(fallbackResponse.status).json({
        ...fallbackData,
        _gateway: {
          source: fallbackSource,
          fallback: true,
          timestamp: new Date().toISOString()
        }
      });
    } catch (fallbackError) {
      res.status(503).json({ success: false, message: 'Both services unavailable' });
    }
  }
});

app.get('/api/products/:id', async (req, res) => {
  stats.totalRequests++;
  
  const random = Math.random() * 100;
  const useMonolith = random >= trafficWeight;
  
  const targetUrl = useMonolith ? MONOLITH_URL : MICROSERVICE_URL;
  const source = useMonolith ? 'MONOLITH' : 'MICROSERVICE';
  
  if (useMonolith) {
    stats.monolithRequests++;
  } else {
    stats.microserviceRequests++;
  }
  
  try {
    const response = await fetch(`${targetUrl}/api/products/${req.params.id}`);
    const data = await response.json();
    
    res.set('X-Source', source);
    res.status(response.status).json(data);
  } catch (error) {
    res.status(503).json({ success: false, message: 'Service unavailable' });
  }
});

// Reviews GET - route based on traffic weight
app.get('/api/products/:id/reviews', async (req, res) => {
  stats.totalRequests++;
  
  const random = Math.random() * 100;
  const useMonolith = random >= trafficWeight;
  
  const targetUrl = useMonolith ? MONOLITH_URL : MICROSERVICE_URL;
  const source = useMonolith ? 'MONOLITH' : 'MICROSERVICE';
  
  if (useMonolith) {
    stats.monolithRequests++;
  } else {
    stats.microserviceRequests++;
  }
  
  try {
    const response = await fetch(`${targetUrl}/api/products/${req.params.id}/reviews`);
    const data = await response.json();
    
    res.set('X-Source', source);
    res.status(response.status).json(data);
  } catch (error) {
    // Fallback to monolith for reviews
    try {
      const fallbackResponse = await fetch(`${MONOLITH_URL}/api/products/${req.params.id}/reviews`);
      const fallbackData = await fallbackResponse.json();
      res.set('X-Source', 'MONOLITH');
      res.status(fallbackResponse.status).json(fallbackData);
    } catch (e) {
      res.status(503).json({ success: false, message: 'Service unavailable' });
    }
  }
});

// =============================================
// AUTH ROUTES - Always MONOLITH
// =============================================
const authProxy = createProxyMiddleware({
  target: MONOLITH_URL,
  changeOrigin: true,
  onProxyReq: (proxyReq, req, res) => {
    // Restream body for JSON requests
    if (req.body && Object.keys(req.body).length > 0) {
      const bodyData = JSON.stringify(req.body);
      proxyReq.setHeader('Content-Type', 'application/json');
      proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
      proxyReq.write(bodyData);
    }
  }
});

app.use(express.json());
app.post('/api/login', authProxy);
app.post('/api/register', authProxy);

// =============================================
// CART ROUTES - Always MONOLITH
// =============================================
app.get('/api/cart', authProxy);
app.post('/api/cart', authProxy);
app.put('/api/cart/:id', authProxy);
app.delete('/api/cart/:id', authProxy);
app.delete('/api/cart', authProxy);

// =============================================
// UPLOADS - Proxy to MONOLITH
// =============================================
app.use('/uploads', createProxyMiddleware({
  target: MONOLITH_URL,
  changeOrigin: true
}));

// =============================================
// START SERVER
// =============================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔═══════════════════════════════════════════════════╗
║     🌐 SHADOWMESH API GATEWAY                     ║
║     Running on port ${PORT}                          ║
║     Monolith: ${MONOLITH_URL}                  
║     Microservice: ${MICROSERVICE_URL}           
║     Initial Traffic Weight: ${trafficWeight}%                  ║
╚═══════════════════════════════════════════════════╝
  `);
});

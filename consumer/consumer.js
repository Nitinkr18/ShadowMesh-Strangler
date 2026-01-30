const { Kafka } = require('kafkajs');
const { Pool } = require('pg');

// Configuration
const KAFKA_BROKER = process.env.KAFKA_BROKER || 'kafka:9092';
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@microservice_db:5432/microservice_db';
const PRODUCTS_TOPIC = 'monolith.public.products';
const REVIEWS_TOPIC = 'monolith.public.reviews';

// Database connection
const pool = new Pool({ connectionString: DATABASE_URL });

// Kafka setup
const kafka = new Kafka({
  clientId: 'shadowmesh-consumer',
  brokers: [KAFKA_BROKER],
  retry: {
    initialRetryTime: 3000,
    retries: 10
  }
});

const consumer = kafka.consumer({ groupId: 'shadowmesh-sync-group-v3' });

// Decode Debezium Decimal (can be base64 encoded BigInteger with scale, or string)
function decodeDecimal(value, scale = 2) {
  if (!value) return 0;
  
  try {
    // If it's already a number, return it
    if (typeof value === 'number') return value;
    
    // If it's a string that looks like a number, parse it directly
    if (typeof value === 'string') {
      // Try parsing as a regular decimal string first
      const parsed = parseFloat(value);
      if (!isNaN(parsed)) return parsed;
      
      // Otherwise, try base64 decoding
      const buffer = Buffer.from(value, 'base64');
      
      // Convert bytes to BigInt (big-endian two's complement)
      let bigIntValue = BigInt(0);
      for (let i = 0; i < buffer.length; i++) {
        bigIntValue = (bigIntValue << BigInt(8)) + BigInt(buffer[i]);
      }
      
      // Handle negative numbers (two's complement)
      if (buffer[0] & 0x80) {
        bigIntValue = bigIntValue - (BigInt(1) << BigInt(buffer.length * 8));
      }
      
      // Apply scale
      const divisor = Math.pow(10, scale);
      return Number(bigIntValue) / divisor;
    }
    
    return 0;
  } catch (error) {
    console.error('[CONSUMER] Error decoding decimal:', error.message);
    return 0;
  }
}

// Calculate dynamic price based on stock (demand simulation)
function calculateDynamicPrice(basePrice, stock) {
  const price = parseFloat(basePrice) || 0;
  const stockNum = parseInt(stock) || 0;
  let demandScore = 1.0;
  
  if (stockNum < 10) {
    demandScore = 1.3;
  } else if (stockNum < 25) {
    demandScore = 1.15;
  } else if (stockNum < 50) {
    demandScore = 1.05;
  } else if (stockNum > 200) {
    demandScore = 0.9;
  }
  
  return {
    dynamicPrice: (price * demandScore).toFixed(2),
    demandScore: demandScore.toFixed(2)
  };
}

// Process Products CDC message
async function processProductMessage(message) {
  try {
    const value = JSON.parse(message.value.toString());
    const { payload } = value;
    
    if (!payload) {
      console.log('[CONSUMER] Empty payload, skipping...');
      return;
    }

    const operation = payload.op;
    const after = payload.after;
    const before = payload.before;

    console.log(`\n[CONSUMER] ═══════════════════════════════════════`);
    console.log(`[CONSUMER] PRODUCT Operation: ${operation}`);

    if ((operation === 'c' || operation === 'u' || operation === 'r') && after) {
      const id = parseInt(after.id);
      const name = after.name || '';
      const description = after.description || '';
      const price = decodeDecimal(after.price, 2);
      const stock = parseInt(after.stock) || 0;
      const image_url = after.image_url || null;
      const category = after.category || null;
      
      const { dynamicPrice, demandScore } = calculateDynamicPrice(price, stock);

      await pool.query(
        `INSERT INTO pricing_inventory (id, name, description, price, stock, image_url, category, dynamic_price, demand_score, synced_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           price = EXCLUDED.price,
           stock = EXCLUDED.stock,
           image_url = EXCLUDED.image_url,
           category = EXCLUDED.category,
           dynamic_price = EXCLUDED.dynamic_price,
           demand_score = EXCLUDED.demand_score,
           synced_at = CURRENT_TIMESTAMP`,
        [id, name, description, price, stock, image_url, category, dynamicPrice, demandScore]
      );

      console.log(`[CONSUMER] ✅ Synced product: ${name} (ID: ${id})`);
      console.log(`[CONSUMER]    Base Price: $${price} → Dynamic Price: $${dynamicPrice}`);

    } else if (operation === 'd' && before) {
      const id = parseInt(before.id);
      await pool.query('DELETE FROM pricing_inventory WHERE id = $1', [id]);
      console.log(`[CONSUMER] 🗑️  Deleted product ID: ${id}`);
    }

    console.log(`[CONSUMER] ═══════════════════════════════════════\n`);

  } catch (error) {
    console.error('[CONSUMER] Error processing product message:', error.message);
  }
}

// Process Reviews CDC message
async function processReviewMessage(message) {
  try {
    const value = JSON.parse(message.value.toString());
    const { payload } = value;
    
    if (!payload) return;

    const operation = payload.op;
    const after = payload.after;
    const before = payload.before;

    console.log(`\n[CONSUMER] ═══════════════════════════════════════`);
    console.log(`[CONSUMER] REVIEW Operation: ${operation}`);

    if ((operation === 'c' || operation === 'u' || operation === 'r') && after) {
      const id = parseInt(after.id);
      const product_id = parseInt(after.product_id);
      const user_id = parseInt(after.user_id);
      const username = after.username || '';
      const rating = parseInt(after.rating);
      const comment = after.comment || '';

      await pool.query(
        `INSERT INTO reviews_replica (id, product_id, user_id, username, rating, comment, synced_at)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET
           product_id = EXCLUDED.product_id,
           user_id = EXCLUDED.user_id,
           username = EXCLUDED.username,
           rating = EXCLUDED.rating,
           comment = EXCLUDED.comment,
           synced_at = CURRENT_TIMESTAMP`,
        [id, product_id, user_id, username, rating, comment]
      );

      console.log(`[CONSUMER] ✅ Synced review ID: ${id} for product ${product_id}`);

    } else if (operation === 'd' && before) {
      const id = parseInt(before.id);
      await pool.query('DELETE FROM reviews_replica WHERE id = $1', [id]);
      console.log(`[CONSUMER] 🗑️  Deleted review ID: ${id}`);
    }

    console.log(`[CONSUMER] ═══════════════════════════════════════\n`);

  } catch (error) {
    console.error('[CONSUMER] Error processing review message:', error.message);
  }
}

// Register Debezium connectors
async function registerConnectors() {
  const maxRetries = 30;
  const retryDelay = 5000;

  // Products connector
  for (let i = 0; i < maxRetries; i++) {
    try {
      console.log(`[CONSUMER] Registering products connector (attempt ${i + 1}/${maxRetries})...`);
      
      const response = await fetch('http://connect:8083/connectors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'monolith-products-connector',
          config: {
            'connector.class': 'io.debezium.connector.postgresql.PostgresConnector',
            'database.hostname': 'monolith_db',
            'database.port': '5432',
            'database.user': 'postgres',
            'database.password': 'postgres',
            'database.dbname': 'monolith_db',
            'topic.prefix': 'monolith',
            'table.include.list': 'public.products,public.reviews',
            'plugin.name': 'pgoutput',
            'publication.autocreate.mode': 'filtered',
            'slot.name': 'debezium_products_slot',
            'snapshot.mode': 'initial',
            'decimal.handling.mode': 'string'
          }
        })
      });

      if (response.ok || response.status === 409) {
        console.log('[CONSUMER] ✅ Debezium connector registered!');
        return true;
      }
      
    } catch (error) {
      console.log(`[CONSUMER] Waiting for Debezium Connect... (${error.message})`);
    }
    
    await new Promise(resolve => setTimeout(resolve, retryDelay));
  }
  
  console.error('[CONSUMER] ❌ Failed to register connector');
  return false;
}

// Main function
async function main() {
  console.log(`
╔═══════════════════════════════════════════════════╗
║     🔄 SHADOWMESH CDC CONSUMER                    ║
║     Kafka Broker: ${KAFKA_BROKER}                   
║     Topics: products, reviews                     
╚═══════════════════════════════════════════════════╝
  `);

  // Test database connection
  try {
    await pool.query('SELECT 1');
    console.log('[CONSUMER] ✅ Connected to microservice_db');
  } catch (error) {
    console.error('[CONSUMER] ❌ Database connection failed:', error);
    process.exit(1);
  }

  // Register Debezium connector
  await registerConnectors();

  // Wait for topics
  console.log('[CONSUMER] Waiting for Kafka topics...');
  await new Promise(resolve => setTimeout(resolve, 15000));

  // Connect consumer
  await consumer.connect();
  console.log('[CONSUMER] ✅ Connected to Kafka');

  // Subscribe to topics
  await consumer.subscribe({ topics: [PRODUCTS_TOPIC, REVIEWS_TOPIC], fromBeginning: true });
  console.log(`[CONSUMER] ✅ Subscribed to topics`);

  // Run consumer
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      console.log(`[CONSUMER] Message from ${topic}`);
      
      if (topic === PRODUCTS_TOPIC) {
        await processProductMessage(message);
      } else if (topic === REVIEWS_TOPIC) {
        await processReviewMessage(message);
      }
    }
  });
}

// Graceful shutdown
const shutdown = async () => {
  console.log('\n[CONSUMER] Shutting down...');
  await consumer.disconnect();
  await pool.end();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start
main().catch(error => {
  console.error('[CONSUMER] Fatal error:', error);
  process.exit(1);
});

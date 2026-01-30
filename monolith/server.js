const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'shadowmesh_secret_key_2026';

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/monolith_db'
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simulated lag variable (for AI Agent testing)
let simulatedLag = 0;

// =============================================
// HEALTH CHECK
// =============================================
app.get('/health', async (req, res) => {
  if (simulatedLag > 0) {
    await new Promise(resolve => setTimeout(resolve, simulatedLag));
  }
  
  try {
    await pool.query('SELECT 1');
    res.json({ 
      status: 'healthy', 
      service: 'monolith',
      timestamp: new Date().toISOString(),
      lag: simulatedLag
    });
  } catch (error) {
    res.status(500).json({ status: 'unhealthy', error: error.message });
  }
});

app.post('/admin/simulate-lag', (req, res) => {
  const { lag } = req.body;
  simulatedLag = parseInt(lag) || 0;
  console.log(`[MONOLITH] Simulated lag set to ${simulatedLag}ms`);
  res.json({ success: true, lag: simulatedLag });
});

// =============================================
// AUTHENTICATION
// =============================================
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password required' });
    }

    const result = await pool.query(
      'SELECT id, username, role FROM users WHERE username = $1 AND password = $2',
      [username, password]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log(`[MONOLITH] User logged in: ${user.username} (${user.role})`);
    
    res.json({
      success: true,
      user: { id: user.id, username: user.username, role: user.role },
      token
    });
  } catch (error) {
    console.error('[MONOLITH] Login error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password required' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Username already exists' });
    }

    const result = await pool.query(
      'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id, username, role',
      [username, password, 'user']
    );

    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      user: { id: user.id, username: user.username, role: user.role },
      token
    });
  } catch (error) {
    console.error('[MONOLITH] Registration error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// JWT Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// =============================================
// PRODUCTS API
// =============================================
app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, description, price, stock, image_url, category, created_at FROM products ORDER BY created_at DESC'
    );
    
    console.log(`[MONOLITH] Fetched ${result.rows.length} products`);
    res.json({
      success: true,
      source: 'MONOLITH',
      data: result.rows
    });
  } catch (error) {
    console.error('[MONOLITH] Products fetch error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT id, name, description, price, stock, image_url, category, created_at FROM products WHERE id = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json({
      success: true,
      source: 'MONOLITH',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('[MONOLITH] Product fetch error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/products', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const { name, description, price, stock, image_url, category } = req.body;

    if (!name || !price) {
      return res.status(400).json({ success: false, message: 'Name and price are required' });
    }

    const result = await pool.query(
      `INSERT INTO products (name, description, price, stock, image_url, category, updated_at) 
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP) 
       RETURNING id, name, description, price, stock, image_url, category, created_at`,
      [name, description, parseFloat(price), parseInt(stock) || 0, image_url || null, category || null]
    );

    console.log(`[MONOLITH] ✅ Product created: ${result.rows[0].name} (ID: ${result.rows[0].id})`);

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('[MONOLITH] Product creation error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.put('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const { id } = req.params;
    const { name, description, price, stock, image_url, category } = req.body;

    const result = await pool.query(
      `UPDATE products SET name = $1, description = $2, price = $3, stock = $4, image_url = $5, category = $6, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $7 RETURNING *`,
      [name, description, parseFloat(price), parseInt(stock), image_url, category, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    console.log(`[MONOLITH] Product updated: ${result.rows[0].name} (ID: ${id})`);

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('[MONOLITH] Product update error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.delete('/api/products/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const { id } = req.params;
    const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    console.log(`[MONOLITH] Product deleted: ID ${id}`);
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    console.error('[MONOLITH] Product deletion error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// =============================================
// REVIEWS API
// =============================================
app.get('/api/products/:id/reviews', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `SELECT r.id, r.product_id, r.user_id, r.username, r.rating, r.comment, r.created_at
       FROM reviews r
       WHERE r.product_id = $1
       ORDER BY r.created_at DESC`,
      [id]
    );
    
    // Calculate average
    const avgResult = await pool.query(
      'SELECT AVG(rating) as avg_rating, COUNT(*) as count FROM reviews WHERE product_id = $1',
      [id]
    );
    
    res.json({
      success: true,
      source: 'MONOLITH',
      reviews: result.rows,
      average_rating: parseFloat(avgResult.rows[0].avg_rating) || 0,
      total_reviews: parseInt(avgResult.rows[0].count) || 0
    });
  } catch (error) {
    console.error('[MONOLITH] Reviews fetch error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/products/:id/reviews', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user.id;
    const username = req.user.username;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
    }

    const result = await pool.query(
      'INSERT INTO reviews (product_id, user_id, username, rating, comment) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [id, userId, username, rating, comment]
    );

    console.log(`[MONOLITH] ✅ Review added for product ${id} by ${username}`);

    res.status(201).json({
      success: true,
      message: 'Review added successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('[MONOLITH] Review creation error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// =============================================
// CART API
// =============================================
app.get('/api/cart', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.quantity, p.id as product_id, p.name, p.price, p.image_url
       FROM cart c
       JOIN products p ON c.product_id = p.id
       WHERE c.user_id = $1`,
      [req.user.id]
    );

    const total = result.rows.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    res.json({
      success: true,
      data: result.rows,
      total: total.toFixed(2)
    });
  } catch (error) {
    console.error('[MONOLITH] Cart fetch error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/api/cart', authenticateToken, async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const userId = req.user.id;

    const result = await pool.query(
      `INSERT INTO cart (user_id, product_id, quantity) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, product_id) DO UPDATE SET quantity = cart.quantity + $3
       RETURNING *`,
      [userId, productId, quantity || 1]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[MONOLITH] Cart add error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.put('/api/cart/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;

    if (quantity < 1) {
      await pool.query('DELETE FROM cart WHERE id = $1 AND user_id = $2', [id, req.user.id]);
      return res.json({ success: true, message: 'Item removed' });
    }

    const result = await pool.query(
      'UPDATE cart SET quantity = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
      [quantity, id, req.user.id]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[MONOLITH] Cart update error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.delete('/api/cart/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM cart WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    res.json({ success: true, message: 'Item removed' });
  } catch (error) {
    console.error('[MONOLITH] Cart delete error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.delete('/api/cart', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM cart WHERE user_id = $1', [req.user.id]);
    res.json({ success: true, message: 'Cart cleared' });
  } catch (error) {
    console.error('[MONOLITH] Cart clear error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// =============================================
// START SERVER
// =============================================
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════╗
║     📦 SHADOWMESH MONOLITH                        ║
║     Running on port ${PORT}                          ║
║     Database: monolith_db                         ║
║     Mode: Full-Stack E-Commerce                   ║
╚═══════════════════════════════════════════════════╝
  `);
});

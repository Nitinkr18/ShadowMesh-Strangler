from flask import Flask, jsonify, request
from flask_cors import CORS
import psycopg2
import psycopg2.extras
import os
import time

app = Flask(__name__)
CORS(app)

DATABASE_URL = os.getenv('DATABASE_URL', 'postgres://postgres:postgres@localhost:5433/microservice_db')
PORT = int(os.getenv('PORT', 5000))

def get_db_connection():
    """Create a database connection"""
    return psycopg2.connect(DATABASE_URL)

# =============================================
# HEALTH CHECK
# =============================================
@app.route('/health', methods=['GET'])
def health():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('SELECT 1')
        cur.close()
        conn.close()
        return jsonify({
            'status': 'healthy',
            'service': 'microservice',
            'timestamp': time.strftime('%Y-%m-%dT%H:%M:%SZ')
        })
    except Exception as e:
        return jsonify({'status': 'unhealthy', 'error': str(e)}), 500

# =============================================
# PRODUCTS API (Read-Only, Price Optimized)
# =============================================
@app.route('/api/products', methods=['GET'])
def get_products():
    """Get all products with dynamic pricing"""
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        cur.execute('''
            SELECT id, name, description, price, stock, image_url, category,
                   dynamic_price, demand_score, synced_at
            FROM pricing_inventory
            ORDER BY synced_at DESC
        ''')
        
        products = cur.fetchall()
        cur.close()
        conn.close()
        
        # Convert to list of dicts with proper serialization
        result = []
        for p in products:
            result.append({
                'id': p['id'],
                'name': p['name'],
                'description': p['description'],
                'price': float(p['price']) if p['price'] else 0,
                'stock': p['stock'],
                'image_url': p['image_url'],
                'category': p['category'],
                'dynamic_price': float(p['dynamic_price']) if p['dynamic_price'] else float(p['price']),
                'demand_score': float(p['demand_score']) if p['demand_score'] else 1.0,
                'synced_at': p['synced_at'].isoformat() if p['synced_at'] else None
            })
        
        print(f'[MICROSERVICE] Fetched {len(result)} products with dynamic pricing')
        
        return jsonify({
            'success': True,
            'source': 'MICROSERVICE',
            'data': result,
            'pricing_engine': 'dynamic_demand_v1'
        })
        
    except Exception as e:
        print(f'[MICROSERVICE] Error fetching products: {e}')
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/products/<int:product_id>', methods=['GET'])
def get_product(product_id):
    """Get single product with pricing analysis"""
    try:
        # Simulate computation delay for detailed view
        time.sleep(0.3)
        
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        cur.execute('''
            SELECT id, name, description, price, stock, image_url, category,
                   dynamic_price, demand_score, synced_at
            FROM pricing_inventory
            WHERE id = %s
        ''', (product_id,))
        
        product = cur.fetchone()
        cur.close()
        conn.close()
        
        if not product:
            return jsonify({'success': False, 'message': 'Product not found'}), 404
        
        result = {
            'id': product['id'],
            'name': product['name'],
            'description': product['description'],
            'price': float(product['price']) if product['price'] else 0,
            'stock': product['stock'],
            'image_url': product['image_url'],
            'category': product['category'],
            'dynamic_price': float(product['dynamic_price']) if product['dynamic_price'] else float(product['price']),
            'demand_score': float(product['demand_score']) if product['demand_score'] else 1.0,
            'synced_at': product['synced_at'].isoformat() if product['synced_at'] else None,
            'pricing_recommendation': get_pricing_recommendation(product)
        }
        
        return jsonify({
            'success': True,
            'source': 'MICROSERVICE',
            'data': result
        })
        
    except Exception as e:
        print(f'[MICROSERVICE] Error fetching product {product_id}: {e}')
        return jsonify({'success': False, 'message': str(e)}), 500

def get_pricing_recommendation(product):
    """Generate AI-like pricing recommendation"""
    stock = product['stock'] or 0
    demand_score = float(product['demand_score']) if product['demand_score'] else 1.0
    
    if stock < 10:
        return {
            'action': 'INCREASE_PRICE',
            'reason': 'Low stock, high demand',
            'confidence': 0.95
        }
    elif stock > 200:
        return {
            'action': 'DECREASE_PRICE',
            'reason': 'Overstock, promote sales',
            'confidence': 0.85
        }
    elif demand_score > 1.1:
        return {
            'action': 'HOLD',
            'reason': 'Optimal pricing for current demand',
            'confidence': 0.90
        }
    else:
        return {
            'action': 'MONITOR',
            'reason': 'Stable market conditions',
            'confidence': 0.75
        }

# =============================================
# REVIEWS API (Read-Only, Synced from Monolith)
# =============================================
@app.route('/api/products/<int:product_id>/reviews', methods=['GET'])
def get_product_reviews(product_id):
    """Get reviews for a product from replica"""
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        cur.execute('''
            SELECT id, product_id, user_id, username, rating, comment, synced_at
            FROM reviews_replica
            WHERE product_id = %s
            ORDER BY synced_at DESC
        ''', (product_id,))
        
        reviews = cur.fetchall()
        
        # Get average rating
        cur.execute('''
            SELECT AVG(rating) as avg_rating, COUNT(*) as count
            FROM reviews_replica
            WHERE product_id = %s
        ''', (product_id,))
        
        stats = cur.fetchone()
        cur.close()
        conn.close()
        
        result = []
        for r in reviews:
            result.append({
                'id': r['id'],
                'product_id': r['product_id'],
                'user_id': r['user_id'],
                'username': r['username'] or 'Anonymous',
                'rating': r['rating'],
                'comment': r['comment'],
                'synced_at': r['synced_at'].isoformat() if r['synced_at'] else None
            })
        
        return jsonify({
            'success': True,
            'source': 'MICROSERVICE',
            'reviews': result,
            'average_rating': round(float(stats['avg_rating'] or 0), 1),
            'total_reviews': stats['count']
        })
        
    except Exception as e:
        print(f'[MICROSERVICE] Error fetching reviews: {e}')
        return jsonify({'success': False, 'message': str(e)}), 500

# =============================================
# PRICING ANALYTICS API
# =============================================
@app.route('/api/analytics/pricing', methods=['GET'])
def pricing_analytics():
    """Get pricing analytics dashboard data"""
    try:
        # Simulate heavy computation
        time.sleep(0.5)
        
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        # Get aggregate stats
        cur.execute('''
            SELECT 
                COUNT(*) as total_products,
                AVG(price) as avg_price,
                AVG(dynamic_price) as avg_dynamic_price,
                AVG(demand_score) as avg_demand_score,
                SUM(stock) as total_stock,
                COUNT(CASE WHEN stock < 10 THEN 1 END) as low_stock_count,
                COUNT(CASE WHEN demand_score > 1.1 THEN 1 END) as high_demand_count
            FROM pricing_inventory
        ''')
        
        stats = cur.fetchone()
        cur.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'source': 'MICROSERVICE',
            'analytics': {
                'total_products': stats['total_products'],
                'average_price': round(float(stats['avg_price'] or 0), 2),
                'average_dynamic_price': round(float(stats['avg_dynamic_price'] or 0), 2),
                'average_demand_score': round(float(stats['avg_demand_score'] or 1), 2),
                'total_inventory': stats['total_stock'],
                'low_stock_alerts': stats['low_stock_count'],
                'high_demand_products': stats['high_demand_count'],
                'pricing_efficiency': round((float(stats['avg_dynamic_price'] or 0) / float(stats['avg_price'] or 1)) * 100, 1)
            }
        })
        
    except Exception as e:
        print(f'[MICROSERVICE] Error in analytics: {e}')
        return jsonify({'success': False, 'message': str(e)}), 500

# =============================================
# MAIN
# =============================================
if __name__ == '__main__':
    print(f'''
╔═══════════════════════════════════════════════════╗
║     ⚡ SHADOWMESH MICROSERVICE                    ║
║     Running on port {PORT}                          ║
║     Database: microservice_db                     ║
║     Mode: Read-Only Pricing Engine                ║
╚═══════════════════════════════════════════════════╝
    ''')
    app.run(host='0.0.0.0', port=PORT, debug=False)

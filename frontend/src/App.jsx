import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import { 
  ShoppingCart, User, LogOut, Package, Settings,
  Server, TrendingUp, AlertTriangle, Check, X, Loader2,
  Star, ChevronLeft, Plus, Trash2, Edit, ArrowRight, CheckCircle,
  Activity, Database, Shield, DollarSign, Zap, RefreshCw, Heart, Bot
} from 'lucide-react';

// =============================================
// CONTEXT
// =============================================
const AuthContext = createContext(null);
const useAuth = () => useContext(AuthContext);

// =============================================
// API CONFIGURATION
// =============================================
const API_BASE = '';

// =============================================
// TOAST NOTIFICATION SYSTEM
// =============================================
const ToastContext = createContext(null);
const useToast = () => useContext(ToastContext);

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] space-y-3">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`
              flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl backdrop-blur-xl
              transform transition-all duration-500 ease-out animate-slide-up
              ${toast.type === 'success' 
                ? 'bg-white/95 text-black border border-gray-200' 
                : toast.type === 'error'
                ? 'bg-red-50/95 text-red-900 border border-red-200'
                : 'bg-white/95 text-black border border-gray-200'
              }
            `}
          >
            {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-green-600" />}
            {toast.type === 'error' && <AlertTriangle className="w-5 h-5 text-red-600" />}
            <span className="font-medium">{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// =============================================
// STAR RATING COMPONENT
// =============================================
function StarRating({ rating, size = 'md', interactive = false, onChange }) {
  const sizes = { sm: 'w-3 h-3', md: 'w-5 h-5', lg: 'w-6 h-6' };
  const sizeClass = sizes[size];
  
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type={interactive ? 'button' : undefined}
          onClick={interactive ? () => onChange?.(star) : undefined}
          disabled={!interactive}
          className={`transition-transform duration-200 ${interactive ? 'cursor-pointer hover:scale-125' : 'cursor-default'}`}
        >
          <Star
            className={`${sizeClass} transition-colors duration-200 ${
              star <= rating 
                ? 'text-yellow-500 fill-yellow-500' 
                : 'text-gray-300'
            }`}
          />
        </button>
      ))}
    </div>
  );
}

// =============================================
// NAVBAR COMPONENT
// =============================================
function Navbar({ source, trafficWeight }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-white/80 backdrop-blur-xl border-b border-gray-200/50 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 bg-black rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
              <span className="text-white font-bold text-lg">S</span>
            </div>
            <span className="text-xl font-semibold text-black tracking-tight">
              ShadowMesh
            </span>
          </Link>

          {/* Center - Source Badge */}
          <div className="flex items-center gap-3">
            {source && (
              <div className={`
                flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium
                transition-all duration-300
                ${source === 'MICROSERVICE' 
                  ? 'bg-green-50 text-green-700 border border-green-200' 
                  : 'bg-blue-50 text-blue-700 border border-blue-200'
                }
              `}>
                <Server className="w-4 h-4" />
                <span>{source}</span>
              </div>
            )}
            {trafficWeight !== null && (
              <div className="flex items-center gap-2 px-4 py-1.5 rounded-full text-sm bg-gray-100 text-gray-700">
                <TrendingUp className="w-4 h-4" />
                <span>Microservice: <strong>{trafficWeight}%</strong></span>
              </div>
            )}
          </div>

          {/* Right - Navigation */}
          <div className="flex items-center gap-1">
            {user ? (
              <>
                <Link to="/" className="text-gray-600 hover:text-black px-4 py-2 text-sm font-medium transition-colors duration-200">
                  Store
                </Link>
                <Link to="/cart" className="text-gray-600 hover:text-black px-4 py-2 text-sm font-medium transition-colors duration-200 flex items-center gap-1.5">
                  <ShoppingCart className="w-4 h-4" />
                  <span>Cart</span>
                </Link>
                {user.role === 'admin' && (
                  <Link to="/admin" className="text-gray-600 hover:text-black px-4 py-2 text-sm font-medium transition-colors duration-200 flex items-center gap-1.5">
                    <Settings className="w-4 h-4" />
                    <span>Admin</span>
                  </Link>
                )}
                <div className="flex items-center gap-3 ml-4 pl-4 border-l border-gray-200">
                  <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm font-medium text-gray-900">{user.username}</span>
                  <button 
                    onClick={handleLogout} 
                    className="text-gray-400 hover:text-red-500 p-2 rounded-full hover:bg-gray-100 transition-all duration-200"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <Link 
                to="/login" 
                className="bg-black hover:bg-gray-800 text-white px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

// =============================================
// LOGIN COMPONENT
// =============================================
function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (data.success) {
        login(data.user, data.token);
        navigate('/');
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (err) {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-black rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl">
            <span className="text-white font-bold text-4xl">S</span>
          </div>
          <h1 className="text-4xl font-bold text-black tracking-tight">ShadowMesh</h1>
          <p className="text-gray-500 mt-3 text-lg">Zero-Downtime Migration Platform</p>
        </div>

        <div className="bg-white rounded-3xl p-8 shadow-xl shadow-gray-200/50 border border-gray-100">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200"
                placeholder="Enter username"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200"
                placeholder="Enter password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black hover:bg-gray-800 text-white font-semibold py-4 rounded-2xl transition-all duration-200 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>Sign In</span>}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-100">
            <p className="text-center text-gray-500 text-sm mb-4">Quick Access</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setUsername('admin'); setPassword('admin123'); }}
                className="px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-2xl text-gray-700 text-sm font-medium transition-all duration-200 hover:scale-[1.02]"
              >
                Admin Account
              </button>
              <button
                onClick={() => { setUsername('john'); setPassword('user123'); }}
                className="px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-2xl text-gray-700 text-sm font-medium transition-all duration-200 hover:scale-[1.02]"
              >
                User Account
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================
// PRODUCT DETAIL MODAL
// =============================================
function ProductDetailModal({ product, onClose, onAddToCart }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [avgRating, setAvgRating] = useState(0);
  const [newReview, setNewReview] = useState({ rating: 5, comment: '' });
  const [submitting, setSubmitting] = useState(false);
  const { user, token } = useAuth();
  const { addToast } = useToast();

  useEffect(() => {
    if (product) fetchReviews();
  }, [product]);

  const fetchReviews = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/products/${product.id}/reviews`);
      const data = await res.json();
      if (data.success !== false) {
        setReviews(data.reviews || []);
        setAvgRating(data.average_rating || 0);
      }
    } catch (err) {
      console.error('Failed to fetch reviews');
    } finally {
      setLoading(false);
    }
  };

  const submitReview = async (e) => {
    e.preventDefault();
    if (!user) {
      addToast('Please login to submit a review', 'error');
      return;
    }
    if (!newReview.comment.trim()) {
      addToast('Please write a review comment', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/products/${product.id}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(newReview)
      });
      const data = await res.json();
      if (data.success) {
        addToast('Review submitted successfully!', 'success');
        setNewReview({ rating: 5, comment: '' });
        fetchReviews();
      } else {
        addToast(data.message || 'Failed to submit review', 'error');
      }
    } catch (err) {
      addToast('Error submitting review', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!product) return null;
  const displayPrice = product.dynamic_price || product.price || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl max-w-3xl w-full max-h-[85vh] overflow-hidden shadow-2xl transform transition-all duration-300 animate-scale-up">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <button 
            onClick={onClose} 
            className="flex items-center gap-1 text-gray-600 hover:text-black transition-colors duration-200"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="font-medium">Back</span>
          </button>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-gray-100 rounded-full transition-colors duration-200"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        <div className="overflow-y-auto max-h-[calc(85vh-60px)] p-6">
          <div className="flex gap-6 mb-8">
            <div className="w-56 h-56 bg-gray-100 rounded-3xl flex-shrink-0 overflow-hidden">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="w-16 h-16 text-gray-300" />
                </div>
              )}
            </div>
            <div className="flex-1">
              {product.category && (
                <span className="text-sm font-medium text-gray-500 uppercase tracking-wide">{product.category}</span>
              )}
              <h2 className="text-3xl font-bold text-black mt-1 tracking-tight">{product.name}</h2>
              <div className="flex items-center gap-3 mt-3">
                <StarRating rating={Math.round(avgRating)} />
                <span className="text-sm text-gray-500">({reviews.length} reviews)</span>
              </div>
              <p className="text-gray-600 mt-4 leading-relaxed">{product.description}</p>
              <div className="mt-6">
                <span className="text-4xl font-bold text-black">${parseFloat(displayPrice).toFixed(2)}</span>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
              </p>
              <button
                onClick={() => { onAddToCart(product); }}
                disabled={!product.stock}
                className="mt-6 w-full bg-black hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-2xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              >
                Add to Cart
              </button>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-8">
            <h3 className="text-xl font-bold text-black mb-6">Customer Reviews</h3>
            
            {user && (
              <form onSubmit={submitReview} className="mb-8 p-6 bg-gray-50 rounded-2xl">
                <div className="flex items-center gap-4 mb-4">
                  <span className="text-sm font-medium text-gray-700">Your Rating:</span>
                  <StarRating rating={newReview.rating} interactive onChange={(r) => setNewReview({...newReview, rating: r})} />
                </div>
                <textarea
                  value={newReview.comment}
                  onChange={(e) => setNewReview({...newReview, comment: e.target.value})}
                  placeholder="Share your thoughts about this product..."
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black resize-none transition-all duration-200"
                  rows="3"
                />
                <button 
                  type="submit" 
                  disabled={submitting} 
                  className="mt-4 px-8 py-3 bg-black hover:bg-gray-800 text-white font-medium rounded-2xl disabled:opacity-50 transition-all duration-200 hover:scale-[1.02]"
                >
                  {submitting ? 'Submitting...' : 'Submit Review'}
                </button>
              </form>
            )}
            
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            ) : reviews.length === 0 ? (
              <p className="text-center text-gray-500 py-12">No reviews yet. Be the first to review!</p>
            ) : (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <div key={review.id} className="p-5 bg-gray-50 rounded-2xl transition-all duration-200 hover:bg-gray-100">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center">
                          <span className="text-white font-medium text-sm">
                            {(review.username || 'A').charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="font-semibold text-gray-900">{review.username || 'Anonymous'}</span>
                      </div>
                      <StarRating rating={review.rating} size="sm" />
                    </div>
                    <p className="text-gray-700 leading-relaxed">{review.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================
// PRODUCT CARD
// =============================================
function ProductCard({ product, onClick, onAddToCart }) {
  const displayPrice = product.dynamic_price || product.price || 0;

  return (
    <div 
      className="bg-white rounded-3xl border border-gray-100 overflow-hidden hover:shadow-xl hover:shadow-gray-200/50 transition-all duration-300 group cursor-pointer hover:scale-[1.02]" 
      onClick={() => onClick(product)}
    >
      <div className="aspect-square bg-gray-50 relative overflow-hidden">
        {product.image_url ? (
          <img 
            src={product.image_url} 
            alt={product.name} 
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-16 h-16 text-gray-300" />
          </div>
        )}
        {product.category && (
          <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-medium text-gray-700 shadow-sm">
            {product.category}
          </div>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onAddToCart(product); }}
          className="absolute bottom-4 right-4 bg-black hover:bg-gray-800 text-white p-3 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 hover:scale-110 shadow-lg"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>
      <div className="p-5">
        <h3 className="font-semibold text-gray-900 group-hover:text-black transition-colors duration-200">{product.name}</h3>
        <p className="text-sm text-gray-500 mt-1 line-clamp-2">{product.description}</p>
        <div className="flex items-center justify-between mt-4">
          <span className="text-xl font-bold text-black">${parseFloat(displayPrice).toFixed(2)}</span>
          {product.stock <= 5 && product.stock > 0 && (
            <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-1 rounded-full">Only {product.stock} left</span>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================
// HOME PAGE
// =============================================
function Home() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState(null);
  const [trafficWeight, setTrafficWeight] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const { user, token } = useAuth();
  const { addToast } = useToast();

  useEffect(() => {
    fetchProducts();
    fetchStatus();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/products`);
      const data = await res.json();
      if (data.success !== false) {
        setProducts(data.data || []);
        setSource(data.source || data._gateway?.source);
      }
    } catch (err) {
      console.error('Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/status`);
      const data = await res.json();
      if (data.success) setTrafficWeight(data.trafficWeight);
    } catch (err) {}
  };

  const addToCart = async (product) => {
    if (!user) {
      addToast('Please login to add items to cart', 'error');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/cart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ productId: product.id, quantity: 1 })
      });
      const data = await res.json();
      if (data.success) {
        addToast(`${product.name} added to cart!`, 'success');
      } else {
        addToast(data.message || 'Failed to add to cart', 'error');
      }
    } catch (err) {
      addToast('Failed to add to cart', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar source={source} trafficWeight={trafficWeight} />
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-black tracking-tight">ShadowMesh Store</h1>
          <p className="text-gray-500 mt-4 text-xl">Experience zero-downtime migration in action</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-gray-400" />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20">
            <Package className="w-20 h-20 text-gray-300 mx-auto mb-6" />
            <h3 className="text-2xl font-semibold text-gray-900">No products yet</h3>
            <p className="text-gray-500 mt-2">Add products from the admin dashboard</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} onClick={setSelectedProduct} onAddToCart={addToCart} />
            ))}
          </div>
        )}
      </div>
      {selectedProduct && (
        <ProductDetailModal product={selectedProduct} onClose={() => setSelectedProduct(null)} onAddToCart={addToCart} />
      )}
    </div>
  );
}

// =============================================
// CART PAGE
// =============================================
function Cart() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const { token } = useAuth();
  const { addToast } = useToast();

  useEffect(() => { fetchCart(); }, []);

  const fetchCart = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/cart`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) {
        setItems(data.data || []);
        setTotal(parseFloat(data.total) || 0);
      }
    } catch (err) {} finally { setLoading(false); }
  };

  const updateQuantity = async (id, quantity) => {
    if (quantity < 1) {
      removeItem(id);
      return;
    }
    await fetch(`${API_BASE}/api/cart/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ quantity })
    });
    fetchCart();
  };

  const removeItem = async (id) => {
    await fetch(`${API_BASE}/api/cart/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    addToast('Item removed from cart', 'success');
    fetchCart();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar source={null} trafficWeight={null} />
      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold text-black tracking-tight mb-10">Your Cart</h1>
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-gray-400" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl shadow-sm">
            <ShoppingCart className="w-20 h-20 text-gray-300 mx-auto mb-6" />
            <h3 className="text-2xl font-semibold text-gray-900">Your cart is empty</h3>
            <Link to="/" className="inline-flex items-center gap-2 text-black mt-6 font-medium hover:gap-3 transition-all duration-200">
              <span>Continue Shopping</span><ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.id} className="bg-white rounded-2xl p-5 flex items-center gap-5 shadow-sm hover:shadow-md transition-shadow duration-200">
                <div className="w-24 h-24 bg-gray-100 rounded-2xl flex-shrink-0 overflow-hidden">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-10 h-10 text-gray-300" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{item.name}</h3>
                  <p className="text-xl font-bold text-black mt-1">${parseFloat(item.price).toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => updateQuantity(item.id, item.quantity - 1)} 
                    className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-colors duration-200"
                  >
                    -
                  </button>
                  <span className="w-10 text-center font-semibold text-gray-900">{item.quantity}</span>
                  <button 
                    onClick={() => updateQuantity(item.id, item.quantity + 1)} 
                    className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-colors duration-200"
                  >
                    +
                  </button>
                </div>
                <button 
                  onClick={() => removeItem(item.id)} 
                  className="text-gray-400 hover:text-red-500 p-2 transition-colors duration-200"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
            <div className="bg-white rounded-2xl p-8 shadow-sm mt-8">
              <div className="flex justify-between items-center text-xl">
                <span className="text-gray-500">Total</span>
                <span className="font-bold text-black text-3xl">${total.toFixed(2)}</span>
              </div>
              <button className="w-full mt-6 bg-black hover:bg-gray-800 text-white font-semibold py-4 rounded-2xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]">
                Proceed to Checkout
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================
// ADMIN PAGE
// =============================================

// AI Agent API URL - dynamically resolve based on current host
const getAiAgentApiUrl = () => {
  const hostname = window.location.hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1' 
    ? 'http://localhost:5050' 
    : `http://${hostname}:5050`;
};
const AI_AGENT_API = getAiAgentApiUrl();

function Admin() {
  const [products, setProducts] = useState([]);
  const [trafficWeight, setTrafficWeight] = useState(0);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', price: '', stock: '', image_url: '', category: '' });
  const [saving, setSaving] = useState(false);
  const { token } = useAuth();
  const { addToast } = useToast();
  
  // AI Agent State
  const [agentState, setAgentState] = useState(null);
  const [selectedAgent, setSelectedAgent] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');

  useEffect(() => { 
    fetchAll(); 
    // Poll agent state every 3 seconds
    const agentInterval = setInterval(fetchAgentState, 3000);
    return () => clearInterval(agentInterval);
  }, []);

  const fetchAll = async () => {
    await Promise.all([fetchProducts(), fetchStatus(), fetchAgentState()]);
    setLoading(false);
  };

  const fetchAgentState = async () => {
    try {
      const res = await fetch(`${AI_AGENT_API}/api/agents/state`);
      const data = await res.json();
      if (data.success) {
        setAgentState(data.agents);
      }
    } catch (err) {
      // Agent API might not be running yet
      console.log('Agent API not available');
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/products`);
      const data = await res.json();
      if (data.success !== false) setProducts(data.data || []);
    } catch (err) {}
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/status`);
      const data = await res.json();
      if (data.success) { setTrafficWeight(data.trafficWeight); setStats(data.stats || {}); }
    } catch (err) {}
  };

  const updateWeight = async (weight) => {
    const res = await fetch(`${API_BASE}/admin/weight`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weight })
    });
    const data = await res.json();
    if (data.success) setTrafficWeight(weight);
  };

  const openForm = (product = null) => {
    if (product) {
      setEditProduct(product);
      setFormData({
        name: product.name || '',
        description: product.description || '',
        price: product.price?.toString() || '',
        stock: product.stock?.toString() || '',
        image_url: product.image_url || '',
        category: product.category || ''
      });
    } else {
      setEditProduct(null);
      setFormData({ name: '', description: '', price: '', stock: '', image_url: '', category: '' });
    }
    setShowForm(true);
  };

  const saveProduct = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.price) || 0,
        stock: parseInt(formData.stock) || 0,
        image_url: formData.image_url || null,
        category: formData.category || null
      };
      
      const url = editProduct ? `${API_BASE}/api/products/${editProduct.id}` : `${API_BASE}/api/products`;
      const res = await fetch(url, {
        method: editProduct ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        addToast(editProduct ? 'Product updated successfully!' : 'Product created successfully!', 'success');
        setShowForm(false);
        fetchProducts();
      } else {
        addToast(data.message || 'Failed to save product', 'error');
      }
    } catch (err) {
      addToast('Error saving product', 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async (id) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      await fetch(`${API_BASE}/api/products/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      addToast('Product deleted successfully', 'success');
      fetchProducts();
    } catch (err) {
      addToast('Failed to delete product', 'error');
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Loader2 className="w-10 h-10 animate-spin text-gray-400" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar source={null} trafficWeight={trafficWeight} />
      <div className="max-w-6xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold text-black tracking-tight mb-10">Admin Dashboard</h1>

        {/* Traffic Control */}
        <div className="bg-white rounded-3xl p-8 shadow-sm mb-8">
          <h2 className="text-xl font-bold text-black mb-6">Traffic Control</h2>
          <div className="relative">
            <input
              type="range" min="0" max="100" value={trafficWeight}
              onChange={(e) => updateWeight(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-black"
            />
            <div 
              className="absolute top-0 h-2 bg-black rounded-full pointer-events-none transition-all duration-200"
              style={{ width: `${trafficWeight}%` }}
            />
          </div>
          <div className="flex justify-between text-sm text-gray-500 mt-3">
            <span>Monolith (0%)</span>
            <span className="text-black font-bold text-lg">{trafficWeight}%</span>
            <span>Microservice (100%)</span>
          </div>
          
          <div className="grid grid-cols-3 gap-4 mt-8">
            <div className="text-center p-6 bg-gray-50 rounded-2xl">
              <div className="text-3xl font-bold text-black">{stats.totalRequests || 0}</div>
              <div className="text-sm text-gray-500 mt-1">Total Requests</div>
            </div>
            <div className="text-center p-6 bg-blue-50 rounded-2xl">
              <div className="text-3xl font-bold text-blue-600">{stats.monolithRequests || 0}</div>
              <div className="text-sm text-gray-500 mt-1">Monolith</div>
            </div>
            <div className="text-center p-6 bg-green-50 rounded-2xl">
              <div className="text-3xl font-bold text-green-600">{stats.microserviceRequests || 0}</div>
              <div className="text-sm text-gray-500 mt-1">Microservice</div>
            </div>
          </div>
        </div>

        {/* AI Agents Swarm - Live Dashboard */}
        <div className="bg-white rounded-3xl p-8 shadow-sm mb-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-black">AI Agent Swarm</h2>
                <p className="text-sm text-gray-500">Autonomous agents powered by Google Gemini</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Filter */}
              <select 
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Agents</option>
                <option value="pipeline_healer">Pipeline Healer</option>
                <option value="traffic_guardian">Traffic Guardian</option>
                <option value="integrity_verifier">Integrity Verifier</option>
              </select>
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${agentState ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                <span className={`w-2 h-2 rounded-full ${agentState ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
                {agentState ? 'Live' : 'Connecting...'}
              </div>
            </div>
          </div>

          {/* Agent Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            {/* Pipeline Healer Agent */}
            {(selectedAgent === 'all' || selectedAgent === 'pipeline_healer') && (
              <div className="group relative overflow-hidden bg-gradient-to-br from-pink-50 to-purple-50 rounded-2xl p-5 border border-pink-100 hover:shadow-lg transition-all duration-300">
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-pink-200/20 to-purple-200/20 rounded-full -translate-y-6 translate-x-6"></div>
                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center">
                        <Heart className="w-5 h-5 text-pink-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 text-sm">Pipeline Healer</h3>
                        <span className="text-xs text-pink-600">DataOps Agent</span>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${agentState?.pipeline_healer?.connector_status === 'RUNNING' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {agentState?.pipeline_healer?.connector_status || 'Initializing'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">Monitors Debezium CDC connector. Auto-heals by re-registering or restarting.</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white/60 rounded-lg p-2">
                      <div className="text-gray-500">Checks</div>
                      <div className="font-semibold text-gray-900">{agentState?.pipeline_healer?.checks_performed || 0}</div>
                    </div>
                    <div className="bg-white/60 rounded-lg p-2">
                      <div className="text-gray-500">Heals</div>
                      <div className="font-semibold text-pink-600">{agentState?.pipeline_healer?.heals_performed || 0}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Traffic Guardian Agent */}
            {(selectedAgent === 'all' || selectedAgent === 'traffic_guardian') && (
              <div className="group relative overflow-hidden bg-gradient-to-br from-cyan-50 to-blue-50 rounded-2xl p-5 border border-cyan-100 hover:shadow-lg transition-all duration-300">
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-cyan-200/20 to-blue-200/20 rounded-full -translate-y-6 translate-x-6"></div>
                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center">
                        <Shield className="w-5 h-5 text-cyan-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 text-sm">Traffic Guardian</h3>
                        <span className="text-xs text-cyan-600">SRE Agent</span>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${agentState?.traffic_guardian?.monolith_status === 'UP' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {agentState?.traffic_guardian?.monolith_status || 'Checking'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">Monitors latency & shifts traffic using Strangler Fig pattern.</p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-white/60 rounded-lg p-2">
                      <div className="text-gray-500">Latency</div>
                      <div className="font-semibold text-gray-900">{agentState?.traffic_guardian?.latency_ms?.toFixed(0) || '—'}ms</div>
                    </div>
                    <div className="bg-white/60 rounded-lg p-2">
                      <div className="text-gray-500">Weight</div>
                      <div className="font-semibold text-cyan-600">{agentState?.traffic_guardian?.current_weight || 0}%</div>
                    </div>
                    <div className="bg-white/60 rounded-lg p-2">
                      <div className="text-gray-500">Shifts</div>
                      <div className="font-semibold text-gray-900">{agentState?.traffic_guardian?.traffic_shifts || 0}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Integrity Verifier Agent */}
            {(selectedAgent === 'all' || selectedAgent === 'integrity_verifier') && (
              <div className="group relative overflow-hidden bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl p-5 border border-amber-100 hover:shadow-lg transition-all duration-300">
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-amber-200/20 to-yellow-200/20 rounded-full -translate-y-6 translate-x-6"></div>
                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center">
                        <Database className="w-5 h-5 text-amber-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 text-sm">Integrity Verifier</h3>
                        <span className="text-xs text-amber-600">QA Agent</span>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${agentState?.integrity_verifier?.mismatches_found === 0 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {agentState?.integrity_verifier?.mismatches_found || 0} mismatches
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">Compares data between Monolith & Microservice DBs for sync integrity.</p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-white/60 rounded-lg p-2">
                      <div className="text-gray-500">Compared</div>
                      <div className="font-semibold text-gray-900">{agentState?.integrity_verifier?.records_compared || 0}</div>
                    </div>
                    <div className="bg-white/60 rounded-lg p-2">
                      <div className="text-gray-500">Mismatches</div>
                      <div className="font-semibold text-amber-600">{agentState?.integrity_verifier?.mismatches_found || 0}</div>
                    </div>
                    <div className="bg-white/60 rounded-lg p-2">
                      <div className="text-gray-500">Syncs</div>
                      <div className="font-semibold text-green-600">{agentState?.integrity_verifier?.force_syncs || 0}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* LLM Thinking Panel */}
          <div className="bg-gray-50 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 bg-purple-100 rounded-lg flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-purple-600" />
              </div>
              <h4 className="font-semibold text-gray-900">LLM Thinking Process</h4>
              <span className="text-xs text-gray-500 ml-auto">Real-time agent reasoning</span>
            </div>
            
            <div className="space-y-3">
              {/* Pipeline Healer Thinking */}
              {(selectedAgent === 'all' || selectedAgent === 'pipeline_healer') && agentState?.pipeline_healer && (
                <div className="bg-white rounded-xl p-4 border border-pink-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Heart className="w-4 h-4 text-pink-500" />
                    <span className="text-sm font-medium text-gray-900">Pipeline Healer</span>
                    <span className="text-xs text-gray-400 ml-auto">
                      {agentState.pipeline_healer.last_check ? new Date(agentState.pipeline_healer.last_check).toLocaleTimeString() : '—'}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                      <span className="text-gray-500 w-20 flex-shrink-0">Thinking:</span>
                      <span className="text-gray-700 bg-pink-50 px-2 py-1 rounded text-xs">{agentState.pipeline_healer.thinking || 'Initializing...'}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-gray-500 w-20 flex-shrink-0">Decision:</span>
                      <span className="text-pink-700 font-medium text-xs">{agentState.pipeline_healer.decision || '—'}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-gray-500 w-20 flex-shrink-0">Action:</span>
                      <span className="text-green-700 text-xs">{agentState.pipeline_healer.action_taken || '—'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Traffic Guardian Thinking */}
              {(selectedAgent === 'all' || selectedAgent === 'traffic_guardian') && agentState?.traffic_guardian && (
                <div className="bg-white rounded-xl p-4 border border-cyan-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-4 h-4 text-cyan-500" />
                    <span className="text-sm font-medium text-gray-900">Traffic Guardian</span>
                    <span className="text-xs text-gray-400 ml-auto">
                      {agentState.traffic_guardian.last_check ? new Date(agentState.traffic_guardian.last_check).toLocaleTimeString() : '—'}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                      <span className="text-gray-500 w-20 flex-shrink-0">Thinking:</span>
                      <span className="text-gray-700 bg-cyan-50 px-2 py-1 rounded text-xs">{agentState.traffic_guardian.thinking || 'Initializing...'}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-gray-500 w-20 flex-shrink-0">Decision:</span>
                      <span className="text-cyan-700 font-medium text-xs">{agentState.traffic_guardian.decision || '—'}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-gray-500 w-20 flex-shrink-0">Action:</span>
                      <span className="text-green-700 text-xs">{agentState.traffic_guardian.action_taken || '—'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Integrity Verifier Thinking */}
              {(selectedAgent === 'all' || selectedAgent === 'integrity_verifier') && agentState?.integrity_verifier && (
                <div className="bg-white rounded-xl p-4 border border-amber-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Database className="w-4 h-4 text-amber-500" />
                    <span className="text-sm font-medium text-gray-900">Integrity Verifier</span>
                    <span className="text-xs text-gray-400 ml-auto">
                      {agentState.integrity_verifier.last_check ? new Date(agentState.integrity_verifier.last_check).toLocaleTimeString() : '—'}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                      <span className="text-gray-500 w-20 flex-shrink-0">Thinking:</span>
                      <span className="text-gray-700 bg-amber-50 px-2 py-1 rounded text-xs">{agentState.integrity_verifier.thinking || 'Initializing...'}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-gray-500 w-20 flex-shrink-0">Decision:</span>
                      <span className="text-amber-700 font-medium text-xs">{agentState.integrity_verifier.decision || '—'}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-gray-500 w-20 flex-shrink-0">Action:</span>
                      <span className="text-green-700 text-xs">{agentState.integrity_verifier.action_taken || '—'}</span>
                    </div>
                  </div>
                </div>
              )}

              {!agentState && (
                <div className="text-center py-8 text-gray-500">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  <p className="text-sm">Connecting to AI Agent Swarm...</p>
                </div>
              )}
            </div>
          </div>

          {/* How It Works - Compact */}
          <div className="mt-5 pt-5 border-t border-gray-100">
            <div className="flex items-center gap-6 text-xs text-gray-500">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-[10px] font-bold text-purple-600">1</span>
                </div>
                <span><strong className="text-gray-700">Observe</strong> — Monitor services</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-[10px] font-bold text-purple-600">2</span>
                </div>
                <span><strong className="text-gray-700">Decide</strong> — LLM analysis</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-[10px] font-bold text-purple-600">3</span>
                </div>
                <span><strong className="text-gray-700">Act</strong> — Auto-execute</span>
              </div>
              <span className="ml-auto text-gray-400">Cycle: every 15 seconds</span>
            </div>
          </div>
        </div>

        {/* Products */}
        <div className="bg-white rounded-3xl p-8 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold text-black">Products</h2>
            <button 
              onClick={() => openForm()} 
              className="flex items-center gap-2 bg-black hover:bg-gray-800 text-white px-5 py-2.5 rounded-full font-medium transition-all duration-200 hover:scale-105"
            >
              <Plus className="w-4 h-4" /><span>Add Product</span>
            </button>
          </div>
          
          {products.length === 0 ? (
            <p className="text-center text-gray-500 py-12">No products yet. Add your first product!</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-4 px-4 text-gray-500 font-medium text-sm">Product</th>
                    <th className="text-left py-4 px-4 text-gray-500 font-medium text-sm">Category</th>
                    <th className="text-right py-4 px-4 text-gray-500 font-medium text-sm">Price</th>
                    <th className="text-right py-4 px-4 text-gray-500 font-medium text-sm">Stock</th>
                    <th className="text-right py-4 px-4 text-gray-500 font-medium text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors duration-150">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0">
                            {p.image_url ? (
                              <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="w-6 h-6 text-gray-300" />
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">{p.name}</div>
                            <div className="text-sm text-gray-500 truncate max-w-xs">{p.description}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-gray-600">{p.category || '-'}</td>
                      <td className="py-4 px-4 text-right font-semibold text-gray-900">${parseFloat(p.price).toFixed(2)}</td>
                      <td className="py-4 px-4 text-right">
                        <span className={`font-medium ${p.stock > 10 ? 'text-green-600' : 'text-orange-600'}`}>{p.stock}</span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-end gap-1">
                          <button 
                            onClick={() => openForm(p)} 
                            className="p-2 hover:bg-gray-100 rounded-full text-gray-500 hover:text-gray-900 transition-colors duration-200"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => deleteProduct(p.id)} 
                            className="p-2 hover:bg-red-50 rounded-full text-gray-500 hover:text-red-600 transition-colors duration-200"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Product Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-3xl max-w-lg w-full p-8 shadow-2xl transform transition-all duration-300 animate-scale-up">
            <h2 className="text-2xl font-bold text-black mb-8">{editProduct ? 'Edit Product' : 'Add New Product'}</h2>
            <form onSubmit={saveProduct} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Product Name</label>
                <input 
                  type="text" 
                  value={formData.name} 
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-black transition-all duration-200" 
                  required 
                  placeholder="Enter product name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea 
                  value={formData.description} 
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-black resize-none transition-all duration-200" 
                  rows="3" 
                  placeholder="Enter product description"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Price ($)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={formData.price} 
                    onChange={(e) => setFormData({...formData, price: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-black transition-all duration-200" 
                    required 
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Stock</label>
                  <input 
                    type="number" 
                    value={formData.stock} 
                    onChange={(e) => setFormData({...formData, stock: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-black transition-all duration-200" 
                    placeholder="0"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <input 
                  type="text" 
                  value={formData.category} 
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-black transition-all duration-200" 
                  placeholder="e.g., Electronics"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Image URL</label>
                <input 
                  type="url" 
                  value={formData.image_url} 
                  onChange={(e) => setFormData({...formData, image_url: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-black transition-all duration-200" 
                  placeholder="https://example.com/image.jpg"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowForm(false)} 
                  className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-2xl transition-all duration-200"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={saving} 
                  className="flex-1 px-4 py-3 bg-black hover:bg-gray-800 text-white font-medium rounded-2xl disabled:opacity-50 transition-all duration-200 hover:scale-[1.02]"
                >
                  {saving ? 'Saving...' : (editProduct ? 'Update Product' : 'Create Product')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================
// PROTECTED ROUTE
// =============================================
function ProtectedRoute({ children, adminOnly = false }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

// =============================================
// APP COMPONENT
// =============================================
function App() {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('shadowmesh_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('shadowmesh_token'));

  const login = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem('shadowmesh_user', JSON.stringify(userData));
    localStorage.setItem('shadowmesh_token', authToken);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('shadowmesh_user');
    localStorage.removeItem('shadowmesh_token');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
            <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="/cart" element={<ProtectedRoute><Cart /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute adminOnly><Admin /></ProtectedRoute>} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthContext.Provider>
  );
}

export default App;

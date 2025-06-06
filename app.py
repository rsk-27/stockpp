from flask import Flask, render_template, request, jsonify, session, redirect, url_for
import os
import json
import logging
import traceback
import yfinance as yf
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
import sys
import os

# Add the current directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from virtual_trading import VirtualTrading

import re

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'your-secret-key-here')  # Use environment variable in production

# Session configuration
app.config['SESSION_TYPE'] = 'filesystem'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=7)
app.config['SESSION_COOKIE_SECURE'] = False  # Set to True in production
app.config['SESSION_COOKIE_HTTPONLY'] = True

# Sample stock data
stock_symbols = {
    'technology': {
        'tcs': 'TCS.NS',
        'infosys': 'INFY.NS',
        'wipro': 'WIPRO.NS'
    },
    'banking': {
        'hdfc-bank': 'HDFCBANK.NS',
        'icici-bank': 'ICICIBANK.NS',
        'sbi': 'SBIN.NS'
    }
}

# Cache for stock predictions
prediction_cache = {}

# Initialize virtual trading
virtual_trading = VirtualTrading()

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'username' not in session:
            logger.debug("Unauthorized access attempt")
            return jsonify({'error': 'Unauthorized', 'message': 'Please login to access this resource'}), 401
        return f(*args, **kwargs)
    return decorated_function

def validate_credentials(username, password):
    if not username or not password:
        return False, "Username and password are required"
    if len(username) < 3 or len(username) > 20:
        return False, "Username must be between 3 and 20 characters"
    if len(password) < 6:
        return False, "Password must be at least 6 characters"
    if not re.match("^[a-zA-Z0-9_]+$", username):
        return False, "Username can only contain letters, numbers, and underscores"
    return True, None

@app.route('/')
def index():
    try:
        logger.debug("Rendering index page")
        return render_template('index.html')
    except Exception as e:
        logger.error(f"Error in index route: {str(e)}")
        logger.error(traceback.format_exc())
        return render_template('error.html', error="Error loading page"), 500

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    try:
        if request.method == 'GET':
            logger.debug("Rendering signup page")
            return render_template('signup.html')
        
        username = request.form.get('username')
        password = request.form.get('password')
        logger.debug(f"Signup attempt for user: {username}")
        
        # Validate credentials
        is_valid, error_message = validate_credentials(username, password)
        if not is_valid:
            return render_template('signup.html', error=error_message), 400
        
        # For testing, accept any username/password
        # In production, you would store the hashed password
        session['username'] = username
        logger.debug(f"Signup successful for user: {username}")
        return redirect(url_for('dashboard'))
    except Exception as e:
        logger.error(f"Error in signup route: {str(e)}")
        logger.error(traceback.format_exc())
        return render_template('error.html', error="Error during signup"), 500

@app.route('/login', methods=['GET', 'POST'])
def login():
    try:
        if request.method == 'GET':
            logger.debug("Rendering login page")
            return render_template('login.html')
        
        username = request.form.get('username')
        password = request.form.get('password')
        logger.debug(f"Login attempt for user: {username}")
        
        # Validate credentials
        is_valid, error_message = validate_credentials(username, password)
        if not is_valid:
            return render_template('login.html', error=error_message), 400
        
        # For testing, accept any username/password
        session['username'] = username
        logger.debug(f"Login successful for user: {username}")
        return redirect(url_for('dashboard'))
    except Exception as e:
        logger.error(f"Error in login route: {str(e)}")
        logger.error(traceback.format_exc())
        return render_template('error.html', error="Error during login"), 500

@app.route('/logout')
def logout():
    try:
        logger.debug(f"Logging out user: {session.get('username', 'Unknown')}")
        session.pop('username', None)
        return redirect(url_for('login'))
    except Exception as e:
        logger.error(f"Error in logout route: {str(e)}")
        logger.error(traceback.format_exc())
        return render_template('error.html', error="Error during logout"), 500

@app.route('/dashboard')
@login_required
def dashboard():
    try:
        logger.debug(f"Rendering dashboard for user: {session['username']}")
        return render_template('dashboard.html', username=session['username'])
    except Exception as e:
        logger.error(f"Error in dashboard route: {str(e)}")
        logger.error(traceback.format_exc())
        return render_template('error.html', error="Error loading dashboard"), 500

@app.route('/api/sectors')
@login_required
def get_sectors():
    try:
        logger.debug("Fetching sectors data")
        print("[DEBUG] /api/sectors called by user:", session.get('username'))
        sectors = {}
        for sector, companies in stock_symbols.items():
            sectors[sector] = []
            for company_id, symbol in companies.items():
                sectors[sector].append({
                    'id': company_id,
                    'name': company_id.replace('-', ' ').title(),
                    'symbol': symbol,
                    'currency': 'INR'
                })
        logger.debug(f"Returning sectors data: {sectors}")
        print("[DEBUG] /api/sectors response:", json.dumps(sectors))
        return jsonify({
            'status': 'success',
            'data': sectors,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        logger.error(f"Error in get_sectors: {str(e)}")
        logger.error(traceback.format_exc())
        print("[DEBUG] /api/sectors error:", str(e))
        return jsonify({
            'status': 'error',
            'error': str(e),
            'message': 'Failed to fetch sectors data'
        }), 500

def to_python_type(val):
    if hasattr(val, "item"):
        return val.item()
    if hasattr(val, "tolist") and not isinstance(val, str):
        return val.tolist()
    return val

@app.route('/api/stock/<sector>/<company>')
@login_required
def get_stock_data(sector, company):
    print("[DEBUG] get_stock_data endpoint called for sector:", sector, "company:", company)
    try:
        period = request.args.get('period', '1y')
        # Map custom values to yfinance periods
        period_map = {
            'max': 'max',
            '10y': '10y',
            '5y': '5y',
            '1y': '1y',
            '30d': '30d',
        }
        yf_period = period_map.get(period, '1y')
        if sector not in stock_symbols or company not in stock_symbols[sector]:
            logger.debug(f"Invalid sector or company: {sector}/{company}")
            return jsonify({
                'status': 'error',
                'error': 'Invalid request',
                'message': 'Invalid sector or company'
            }), 400

        symbol = stock_symbols[sector][company]
        logger.debug(f"Fetching stock data for {symbol} with period {yf_period}")

        # Check cache first (cache key includes period)
        cache_key = f"{symbol}_{yf_period}_{datetime.now().strftime('%Y%m%d')}"
        if cache_key in prediction_cache:
            logger.debug(f"Using cached data for {symbol} period {yf_period}")
            return jsonify(prediction_cache[cache_key])

        # Get historical data
        stock = yf.Ticker(symbol)
        logging.debug(yf_period)
        try:
            hist = stock.history(period=yf_period)
        except yf.exceptions.YFRateLimitError as e:
            logger.error("Rate limit hit: %s", e)
            return jsonify({'error': 'Rate limited. Try again later.'}), 429
        except Exception as e:
            logger.error(traceback.format_exc())
            return jsonify({'error': 'Internal server error'}), 500

        print(f"[DEBUG] yfinance history for {symbol} period {yf_period}: shape={hist.shape}")
        print(hist.head())
        
        if hist.empty or len(hist) < 2:
            logger.error(f"No or insufficient data found for {symbol}")
            print(f"[DEBUG] No or insufficient data found for {symbol}")
            return jsonify({
                'status': 'error',
                'error': 'No data available',
                'message': f'No or insufficient stock data found for {symbol}'
            }), 404

        try:
            # Calculate technical indicators
            hist['SMA_5'] = hist['Close'].rolling(window=5).mean()
            hist['SMA_20'] = hist['Close'].rolling(window=20).mean()
            hist['SMA_50'] = hist['Close'].rolling(window=50).mean()
            # Calculate RSI
            delta = hist['Close'].diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
            rs = gain / loss
            hist['RSI'] = 100 - (100 / (1 + rs))

            # Prepare data for prediction
            X = hist[['Close', 'SMA_5', 'SMA_20', 'SMA_50', 'RSI']].dropna()
            y = hist['Close'].shift(-1).reindex(X.index)
            X = X.iloc[:-1]
            y = y.iloc[:-1]
            print(X)
            if len(X) < 2:
                logger.error(f"Not enough data for prediction for {symbol}")
                return jsonify({
                    'status': 'error',
                    'error': 'Insufficient data',
                    'message': f'Not enough data for prediction for {symbol}'
                }), 400

            # Train Random Forest model
            model = RandomForestRegressor(n_estimators=100, random_state=42)
            model.fit(X, y)

            # Make prediction
            last_data = X.iloc[-1].values.reshape(1, -1)
            predicted_price = model.predict(last_data)[0]

            # Calculate change percentage
            current_price = hist['Close'].iloc[-1]
            prev_price = hist['Close'].iloc[-2]
            change = ((current_price - prev_price) / prev_price) * 100

            # Prepare response
            response = {
                'status': 'success',
                'data': {
                    'name': company.replace('-', ' ').title(),
                    'current_price': to_python_type(current_price),
                    'predicted_price': to_python_type(predicted_price),
                    'change': f"{change:.2f}%",
                    'predicted_price_next': to_python_type(predicted_price),
                    'rsi': to_python_type(hist['RSI'].iloc[-1]),
                    'sma_5': to_python_type(hist['SMA_5'].iloc[-1]),
                    'sma_20': to_python_type(hist['SMA_20'].iloc[-1]),
                    'sma_50': to_python_type(hist['SMA_50'].iloc[-1]),
                    'volume': to_python_type(hist['Volume'].iloc[-1]),
                    'high_52w': to_python_type(hist['High'].max()),
                    'low_52w': to_python_type(hist['Low'].min()),
                    'historical_dates': [str(d) for d in hist.index.strftime('%Y-%m-%d').tolist()],
                    'historical_prices': [to_python_type(x) for x in hist['Close'].tolist()]
                },
                'timestamp': str(datetime.now().isoformat())
            }

            # Cache the response
            prediction_cache[cache_key] = response
            logger.debug(f"Returning stock data for {symbol}")
            return jsonify(response)
        except Exception as e:
            logger.error(f"Error in processing stock data: {str(e)}")
            logger.error(traceback.format_exc())
            print(f"[DEBUG] Exception in processing stock data: {str(e)}")
            return jsonify({
                'status': 'error',
                'error': str(e),
                'message': f'Failed to process stock data: {str(e)}'
            }), 500
    except Exception as e:
        logger.error(f"Error in get_stock_data: {str(e)}")
        logger.error(traceback.format_exc())
        import traceback
        traceback.print_exc()
        print(f"[DEBUG] Exception in get_stock_data: {str(e)}")
        return jsonify({
            'status': 'error',
            'error': str(e),
            'message': f'Failed to fetch stock data: {str(e)}'
        }), 500

@app.route('/news/<news_id>')
def news_detail(news_id):
    # The news data will be loaded on the client side via JS (from localStorage or query params)
    return render_template('news_detail.html', news_id=news_id)

@app.route('/ipo-alert')
def ipo_alert():
    return render_template('ipo_alert.html')

@app.route('/ipo-details')
def ipo_details():
    return render_template('ipo_details.html')

@app.route('/api/virtual-trading/wishlist', methods=['GET', 'POST', 'DELETE'])
@login_required
def wishlist():
    try:
        if request.method == 'GET':
            wishlist = virtual_trading.get_wishlist(session['username'])
            return jsonify({
                'status': 'success',
                'data': wishlist
            })
        
        elif request.method == 'POST':
            data = request.get_json()
            success = virtual_trading.add_to_wishlist(
                session['username'],
                data['symbol'],
                data['sector'],
                data['company']
            )
            return jsonify({
                'status': 'success' if success else 'error',
                'message': 'Stock added to wishlist' if success else 'Stock already in wishlist'
            })
        
        elif request.method == 'DELETE':
            data = request.get_json()
            virtual_trading.remove_from_wishlist(session['username'], data['symbol'])
            return jsonify({
                'status': 'success',
                'message': 'Stock removed from wishlist'
            })
    except Exception as e:
        logger.error(f"Error in wishlist route: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/virtual-trading/portfolio')
@login_required
def get_portfolio():
    try:
        portfolio = virtual_trading.get_portfolio(session['username'])
        return jsonify({
            'status': 'success',
            'data': portfolio
        })
    except Exception as e:
        logger.error(f"Error in get_portfolio route: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/virtual-trading/transactions')
@login_required
def get_transactions():
    try:
        transactions = virtual_trading.get_transaction_history(session['username'])
        return jsonify({
            'status': 'success',
            'data': transactions
        })
    except Exception as e:
        logger.error(f"Error in get_transactions route: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/virtual-trading/performance')
@login_required
def get_performance():
    try:
        performance = virtual_trading.get_portfolio_performance(session['username'])
        return jsonify({
            'status': 'success',
            'data': performance
        })
    except Exception as e:
        logger.error(f"Error in get_performance route: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/virtual-trading/trade', methods=['POST'])
@login_required
def execute_trade():
    try:
        data = request.get_json()
        trade_type = data.get('type')
        symbol = data.get('symbol')
        quantity = int(data.get('quantity'))
        price = float(data.get('price'))

        if trade_type == 'buy':
            success, message = virtual_trading.buy_stock(
                session['username'],
                symbol,
                quantity,
                price
            )
        elif trade_type == 'sell':
            success, message = virtual_trading.sell_stock(
                session['username'],
                symbol,
                quantity,
                price
            )
        else:
            return jsonify({
                'status': 'error',
                'message': 'Invalid trade type'
            }), 400

        return jsonify({
            'status': 'success' if success else 'error',
            'message': message
        })
    except Exception as e:
        logger.error(f"Error in execute_trade route: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/virtual-trading')
@login_required
def virtual_trading():
    try:
        logger.debug(f"Rendering virtual trading dashboard for user: {session['username']}")
        return render_template('virtual_trading.html', username=session['username'])
    except Exception as e:
        logger.error(f"Error in virtual_trading route: {str(e)}")
        logger.error(traceback.format_exc())
        return render_template('error.html', error="Error loading virtual trading dashboard"), 500

if __name__ == '__main__':
    try:
        logger.info("Starting Flask application")
        app.run(debug=True, port=5000)
    except Exception as e:
        logger.error(f"Error starting Flask application: {str(e)}")
        logger.error(traceback.format_exc()) 
from flask import Flask, render_template, request, jsonify, session, redirect, url_for
import os
import json
import logging
import traceback
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
import sys
import os
from collections import defaultdict
import time
from alpha_vantage.timeseries import TimeSeries
import requests

# Add the current directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

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

ALPHA_VANTAGE_API_KEY = 'IE8YEI18T22XHTRG'
# NEWS_API_KEY = 'd1ba48634a144e8db453d3ae0447998d'

# Updated stock_symbols for Alpha Vantage (NSE/BSE symbols)
stock_symbols = {
    'technology': {
        'tcs': 'TCS.BSE',
        'infosys': 'INFY.BSE',
        'wipro': 'WIPRO.BSE',
        'hcl-tech': 'HCLTECH.BSE',
        'tech-mahindra': 'TECHM.BSE',
        'ltimindtree': 'LTIM.BSE',
        'persistent': 'PERSISTENT.BSE',
        'coforge': 'COFORGE.BSE',
        'oracle-fin': 'OFSS.BSE'
    },
    'banking': {
        'hdfc-bank': 'HDFCBANK.BSE',
        'icici-bank': 'ICICIBANK.BSE',
        'sbi': 'SBIN.BSE',
        'kotak-bank': 'KOTAKBANK.BSE',
        'axis-bank': 'AXISBANK.BSE',
        'indusind-bank': 'INDUSINDBK.BSE',
        'bandhan-bank': 'BANDHANBNK.BSE',
        'federal-bank': 'FEDERALBNK.BSE',
        'idfc-first': 'IDFCFIRSTB.BSE',
        'yes-bank': 'YESBANK.BSE'
    }
}

# Cache for stock predictions
prediction_cache = {}

# Rate limiting: max 5 requests per minute per user
user_request_times = defaultdict(list)
REQUEST_LIMIT = 5
REQUEST_WINDOW = 60  # seconds

TWELVE_SYMBOLS = {
    'bse': 'SENSEX',
    'nse': 'NSEI',
    'niftybank': 'NSEBANK',
    'niftyit': 'CNXIT'
}

USERS_XLSX = 'users.xlsx'

# Helper to load users from Excel
def load_users():
    if not os.path.exists(USERS_XLSX):
        return pd.DataFrame(columns=['username', 'password'])
    return pd.read_excel(USERS_XLSX)

# Helper to save users to Excel
def save_users(df):
    df.to_excel(USERS_XLSX, index=False)

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
        is_valid, error_message = validate_credentials(username, password)
        if not is_valid:
            return render_template('signup.html', error=error_message), 400
        users_df = load_users()
        if username in users_df['username'].values:
            return render_template('signup.html', error="Username already exists."), 400
        new_row = pd.DataFrame([{'username': username, 'password': password}])
        users_df = pd.concat([users_df, new_row], ignore_index=True)
        save_users(users_df)
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
        is_valid, error_message = validate_credentials(username, password)
        if not is_valid:
            return render_template('login.html', error=error_message), 400
        users_df = load_users()
        user_row = users_df[users_df['username'] == username]
        if user_row.empty:
            return render_template('login.html', error="User does not exist."), 400
        if user_row.iloc[0]['password'] != password:
            return render_template('login.html', error="Incorrect password."), 400
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

def is_rate_limited(username):
    return False

@app.route('/api/clear-cache', methods=['POST'])
@login_required
def clear_cache():
    prediction_cache.clear()
    return jsonify({'status': 'success', 'message': 'Prediction cache cleared.'})

@app.route('/api/stock/<sector>/<company>')
@login_required
def get_stock_data(sector, company):
    print(f"[DEBUG] get_stock_data endpoint called for sector: {sector}, company: {company}")
    if is_rate_limited(session['username']):
        return jsonify({'status': 'error', 'message': 'Rate limit exceeded. Please wait a minute and try again.'}), 429
    try:
        period = request.args.get('period', '1y')
        if sector not in stock_symbols or company not in stock_symbols[sector]:
            logger.debug(f"Invalid sector or company: {sector}/{company}")
            return jsonify({
                'status': 'error',
                'error': 'Invalid request',
                'message': 'Invalid sector or company'
            }), 400

        symbol = stock_symbols[sector][company]
        logger.debug(f"Fetching stock data for {symbol} with period {period}")

        # Check cache first (cache key includes period)
        cache_key = f"{symbol}_{period}_{datetime.now().strftime('%Y%m%d')}"
        if cache_key in prediction_cache:
            logger.debug(f"Using cached data for {symbol} period {period}")
            return jsonify(prediction_cache[cache_key])

        # Fetch data from Alpha Vantage
        ts = TimeSeries(key=ALPHA_VANTAGE_API_KEY, output_format='pandas')
        try:
            data, meta = ts.get_daily(symbol=symbol, outputsize='full')
        except Exception as e:
            logger.error(f"Alpha Vantage error: {str(e)}")
            return jsonify({'status': 'error', 'message': 'Alpha Vantage API error or limit reached.'}), 500

        if data.empty or len(data) < 2:
            logger.error(f"No or insufficient data found for {symbol}")
            return jsonify({
                'status': 'error',
                'error': 'No data available',
                'message': f'No or insufficient stock data found for {symbol}'
            }), 404

        # Prepare data for prediction (simple moving average as a placeholder)
        data = data.sort_index()
        data['SMA_5'] = data['4. close'].rolling(window=5).mean()
        data['SMA_20'] = data['4. close'].rolling(window=20).mean()
        data['SMA_50'] = data['4. close'].rolling(window=50).mean()
        # Calculate RSI (simple version)
        delta = data['4. close'].diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        data['RSI'] = 100 - (100 / (1 + rs))

        # Use last available data for prediction (simple moving average as a placeholder)
        X = data[['4. close', 'SMA_5', 'SMA_20', 'SMA_50', 'RSI']].dropna()
        if len(X) < 2:
            logger.error(f"Not enough data for prediction for {symbol}")
            return jsonify({
                'status': 'error',
                'error': 'Insufficient data',
                'message': f'Not enough data for prediction for {symbol}'
            }), 400

        # --- Advanced: Random Forest Regressor for Prediction ---
        N = 30  # number of days to use for training
        features = ['4. close', 'SMA_5', 'SMA_20', 'SMA_50', 'RSI']
        X_hist = X[features].values[-N:] if len(X) >= N else X[features].values
        y_hist = X['4. close'].values[-N:] if len(X) >= N else X['4. close'].values
        # Use previous N-1 rows to predict the Nth row
        if len(X_hist) > 5:
            X_train = X_hist[:-1]
            y_train = y_hist[1:]
            model = RandomForestRegressor(n_estimators=100, random_state=42)
            model.fit(X_train, y_train)
            # Predict next day using the last available row
            X_pred = X_hist[-1].reshape(1, -1)
            predicted_price = model.predict(X_pred)[0]
        else:
            predicted_price = X['4. close'].values[-1]
        # --- End Random Forest ---

        # Determine the number of days for the selected period
        period_map = {'1D': 1, '1W': 7, '1M': 30, '1Y': 365, '5Y': 365*5, 'MAX': None}
        period_days = period_map.get(period.upper(), 365)
        if period_days is not None:
            X_period = X.tail(period_days)
        else:
            X_period = X
        closes_period = X_period['4. close'].values
        days_period = np.arange(len(closes_period))
        # Polynomial regression (degree 2)
        if len(closes_period) > 2:
            coeffs = np.polyfit(days_period, closes_period, 2)
            regression_line = (coeffs[0]*days_period**2 + coeffs[1]*days_period + coeffs[2]).tolist()
        elif len(closes_period) > 1:
            a, b = np.polyfit(days_period, closes_period, 1)
            regression_line = (a * days_period + b).tolist()
        else:
            regression_line = closes_period.tolist()

        current_price = X.iloc[-1]['4. close']
        prev_price = X.iloc[-2]['4. close']
        change = ((current_price - prev_price) / prev_price) * 100

        response = {
            'status': 'success',
            'data': {
                'name': company.replace('-', ' ').title(),
                'current_price': float(current_price),
                'predicted_price': float(predicted_price),
                'change': f"{change:.2f}%",
                'predicted_price_next': float(predicted_price),
                'rsi': float(X.iloc[-1]['RSI']),
                'sma_5': float(X.iloc[-1]['SMA_5']),
                'sma_20': float(X.iloc[-1]['SMA_20']),
                'sma_50': float(X.iloc[-1]['SMA_50']),
                'volume': int(data.iloc[-1]['5. volume']),
                'high_52w': float(data['2. high'].max()),
                'low_52w': float(data['3. low'].min()),
                'historical_dates': [str(d) for d in X_period.index.strftime('%Y-%m-%d').tolist()],
                'historical_prices': [float(x) for x in closes_period.tolist()],
                'regression_line': regression_line,
            },
            'timestamp': str(datetime.now().isoformat())
        }
        prediction_cache[cache_key] = response
        logger.debug(f"Returning stock data for {symbol}")
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error in get_stock_data: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({
            'status': 'error',
            'error': str(e),
            'message': f'Failed to fetch stock data: {str(e)}'
        }), 500

@app.route('/news/<news_id>')
def news_detail(news_id):
    # The news data will be loaded on the client side via JS (from localStorage or query params)
    return render_template('news_detail.html', news_id=news_id)

def fetch_news():
    url = f"https://financialmodelingprep.com/api/v4/general_news?page=0&apikey={ALPHA_VANTAGE_API_KEY}"
    try:
        response = requests.get(url)
        data = response.json()
        logger.debug(f"FMP News response: {data}")
        if isinstance(data, list):
            return data
        else:
            logger.error(f"FMP returned unexpected data: {data}")
            return []
    except Exception as e:
        logger.error(f"Error fetching news from FMP: {e}")
        return []

@app.route('/ipo-alert')
def ipo_alert():
    news_articles = fetch_news()
    return render_template('ipo_alert.html', news_articles=news_articles)

@app.route('/ipo-details')
def ipo_details():
    return render_template('ipo_details.html')

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
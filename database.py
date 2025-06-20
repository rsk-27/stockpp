from pymongo import MongoClient
from datetime import datetime
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# MongoDB connection
MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017')
client = MongoClient(MONGO_URI)
db = client['stock_market_predictor']

# Collections
wishlist_collection = db['wishlist']
trades_collection = db['trades']
transactions_collection = db['transactions']
portfolio_collection = db['portfolio']

class Database:
    @staticmethod
    def add_to_wishlist(username, symbol, sector, company):
        """Add a stock to user's wishlist"""
        try:
            result = wishlist_collection.update_one(
                {'username': username, 'symbol': symbol},
                {
                    '$set': {
                        'sector': sector,
                        'company': company,
                        'added_at': datetime.utcnow()
                    }
                },
                upsert=True
            )
            return result.modified_count > 0 or result.upserted_id is not None
        except Exception as e:
            print(f"Error adding to wishlist: {e}")
            return False

    @staticmethod
    def remove_from_wishlist(username, symbol):
        """Remove a stock from user's wishlist"""
        try:
            result = wishlist_collection.delete_one({
                'username': username,
                'symbol': symbol
            })
            return result.deleted_count > 0
        except Exception as e:
            print(f"Error removing from wishlist: {e}")
            return False

    @staticmethod
    def get_wishlist(username):
        """Get user's wishlist"""
        try:
            return list(wishlist_collection.find(
                {'username': username},
                {'_id': 0}
            ))
        except Exception as e:
            print(f"Error getting wishlist: {e}")
            return []

    @staticmethod
    def execute_trade(username, trade_type, symbol, quantity, price):
        """Execute a trade (buy/sell)"""
        try:
            trade = {
                'username': username,
                'type': trade_type,
                'symbol': symbol,
                'quantity': quantity,
                'price': price,
                'timestamp': datetime.utcnow()
            }
            
            # Add to transactions
            transactions_collection.insert_one(trade)
            
            # Update portfolio
            if trade_type == 'buy':
                portfolio_collection.update_one(
                    {'username': username, 'symbol': symbol},
                    {
                        '$inc': {'quantity': quantity},
                        '$set': {'last_updated': datetime.utcnow()}
                    },
                    upsert=True
                )
            else:  # sell
                portfolio_collection.update_one(
                    {'username': username, 'symbol': symbol},
                    {
                        '$inc': {'quantity': -quantity},
                        '$set': {'last_updated': datetime.utcnow()}
                    }
                )
            
            return True, "Trade executed successfully"
        except Exception as e:
            print(f"Error executing trade: {e}")
            return False, str(e)

    @staticmethod
    def get_portfolio(username):
        """Get user's portfolio"""
        try:
            return list(portfolio_collection.find(
                {'username': username},
                {'_id': 0}
            ))
        except Exception as e:
            print(f"Error getting portfolio: {e}")
            return []

    @staticmethod
    def get_transaction_history(username):
        """Get user's transaction history"""
        try:
            return list(transactions_collection.find(
                {'username': username},
                {'_id': 0}
            ).sort('timestamp', -1))
        except Exception as e:
            print(f"Error getting transaction history: {e}")
            return []

    @staticmethod
    def get_portfolio_performance(username):
        """Calculate portfolio performance"""
        try:
            portfolio = list(portfolio_collection.find(
                {'username': username},
                {'_id': 0}
            ))
            
            total_investment = 0
            current_value = 0
            
            for position in portfolio:
                # Get current price from transactions
                latest_trade = transactions_collection.find_one(
                    {'username': username, 'symbol': position['symbol']},
                    sort=[('timestamp', -1)]
                )
                
                if latest_trade:
                    current_price = latest_trade['price']
                    position_value = position['quantity'] * current_price
                    current_value += position_value
                    
                    # Calculate investment based on average buy price
                    buy_trades = list(transactions_collection.find(
                        {
                            'username': username,
                            'symbol': position['symbol'],
                            'type': 'buy'
                        }
                    ))
                    
                    if buy_trades:
                        avg_buy_price = sum(trade['price'] for trade in buy_trades) / len(buy_trades)
                        total_investment += position['quantity'] * avg_buy_price
            
            return {
                'total_investment': total_investment,
                'current_value': current_value,
                'profit_loss': current_value - total_investment,
                'profit_loss_percentage': ((current_value - total_investment) / total_investment * 100) if total_investment > 0 else 0
            }
        except Exception as e:
            print(f"Error calculating portfolio performance: {e}")
            return {
                'total_investment': 0,
                'current_value': 0,
                'profit_loss': 0,
                'profit_loss_percentage': 0
            } 
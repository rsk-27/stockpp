import json
import os
from datetime import datetime
from typing import Dict, List, Optional
from database import Database

class VirtualTrading:
    def __init__(self):
        self.data_dir = "data"
        self.ensure_data_directory()
        self.initial_balance = 100000  # Initial virtual balance of ₹100,000
        self.db = Database()

    def ensure_data_directory(self):
        """Create data directory if it doesn't exist"""
        if not os.path.exists(self.data_dir):
            os.makedirs(self.data_dir)

    def get_user_data_path(self, username: str) -> str:
        """Get the path to user's data file"""
        return os.path.join(self.data_dir, f"{username}_data.json")

    def load_user_data(self, username: str) -> Dict:
        """Load user's virtual trading data"""
        file_path = self.get_user_data_path(username)
        if os.path.exists(file_path):
            with open(file_path, 'r') as f:
                return json.load(f)
        return {
            "portfolio": {},
            "transactions": [],
            "wishlist": [],
            "balance": self.initial_balance
        }

    def save_user_data(self, username: str, data: Dict):
        """Save user's virtual trading data"""
        file_path = self.get_user_data_path(username)
        with open(file_path, 'w') as f:
            json.dump(data, f, indent=4)

    def buy_stock(self, username: str, stock_symbol: str, quantity: int, price: float):
        """Buy stocks"""
        return self.db.execute_trade(username, 'buy', stock_symbol, quantity, price)

    def sell_stock(self, username: str, stock_symbol: str, quantity: int, price: float):
        """Sell stocks"""
        return self.db.execute_trade(username, 'sell', stock_symbol, quantity, price)

    def get_portfolio(self, username: str) -> Dict:
        """Get user's portfolio"""
        return self.db.get_portfolio(username)

    def get_transaction_history(self, username: str) -> List[Dict]:
        """Get user's transaction history"""
        return self.db.get_transaction_history(username)

    def get_portfolio_performance(self, username: str) -> Dict:
        """Get user's portfolio performance"""
        return self.db.get_portfolio_performance(username) 
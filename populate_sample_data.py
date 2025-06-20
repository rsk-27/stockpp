from database import Database
from datetime import datetime, timedelta
import random

def populate_sample_data():
    db = Database()
    
    # Sample users
    users = ['john_doe', 'jane_smith', 'alex_trader']
    
    # Sample stocks
    stocks = {
        'technology': {
            'TCS.NS': 'Tata Consultancy Services',
            'INFY.NS': 'Infosys',
            'WIPRO.NS': 'Wipro'
        },
        'banking': {
            'HDFCBANK.NS': 'HDFC Bank',
            'ICICIBANK.NS': 'ICICI Bank',
            'SBIN.NS': 'State Bank of India'
        }
    }
    
    # Sample prices for stocks
    stock_prices = {
        'TCS.NS': 3500,
        'INFY.NS': 1500,
        'WIPRO.NS': 450,
        'HDFCBANK.NS': 1600,
        'ICICIBANK.NS': 900,
        'SBIN.NS': 600
    }
    
    # Clear existing data
    db.wishlist_collection.delete_many({})
    db.trades_collection.delete_many({})
    db.transactions_collection.delete_many({})
    db.portfolio_collection.delete_many({})
    
    print("Populating sample data...")
    
    # Add wishlist items
    for user in users:
        # Add 2-3 stocks to wishlist for each user
        for sector, companies in stocks.items():
            for symbol, company in companies.items():
                if random.random() < 0.3:  # 30% chance to add to wishlist
                    db.add_to_wishlist(user, symbol, sector, company)
                    print(f"Added {symbol} to {user}'s wishlist")
    
    # Add trades and portfolio data
    for user in users:
        # Generate 5-10 trades per user
        num_trades = random.randint(5, 10)
        for _ in range(num_trades):
            # Randomly select a stock
            sector = random.choice(list(stocks.keys()))
            symbol = random.choice(list(stocks[sector].keys()))
            company = stocks[sector][symbol]
            
            # Generate random quantity and price
            quantity = random.randint(1, 10)
            base_price = stock_prices[symbol]
            price = base_price * (1 + random.uniform(-0.1, 0.1))  # ±10% variation
            
            # Randomly decide buy or sell
            trade_type = random.choice(['buy', 'sell'])
            
            # Execute trade
            success, message = db.execute_trade(user, trade_type, symbol, quantity, price)
            if success:
                print(f"Added {trade_type} trade for {user}: {quantity} shares of {symbol} at ₹{price:.2f}")
    
    print("\nSample data population complete!")
    print("\nSummary of populated data:")
    
    # Print summary
    for user in users:
        wishlist = db.get_wishlist(user)
        portfolio = db.get_portfolio(user)
        transactions = db.get_transaction_history(user)
        performance = db.get_portfolio_performance(user)
        
        print(f"\nUser: {user}")
        print(f"Wishlist items: {len(wishlist)}")
        print(f"Portfolio holdings: {len(portfolio)}")
        print(f"Total transactions: {len(transactions)}")
        print(f"Portfolio performance:")
        print(f"  Total investment: ₹{performance['total_investment']:.2f}")
        print(f"  Current value: ₹{performance['current_value']:.2f}")
        print(f"  Profit/Loss: ₹{performance['profit_loss']:.2f} ({performance['profit_loss_percentage']:.2f}%)")

if __name__ == "__main__":
    populate_sample_data() 
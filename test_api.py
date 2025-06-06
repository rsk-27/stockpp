from flask import Flask

app = Flask(__name__)

@app.route('/')
def home():
    return "Flask is running!"

@app.route('/api/stock/<sector>/<company>')
def get_stock_data(sector, company):
    print("[DEBUG] get_stock_data endpoint called for sector:", sector, "company:", company)
    return {"status": "success", "sector": sector, "company": company}

if __name__ == '__main__':
    app.run(debug=True, port=5000) 
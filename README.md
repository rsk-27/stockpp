# Stock Market Predictor & Virtual Trading Simulator

A modern web application for stock market prediction, educational virtual trading, and IPO alerts. Built with Flask, pandas, and a beautiful interactive frontend.

---

## 🚀 Features

- **User Authentication:** Signup and login with credentials stored securely in Excel.
- **Stock Market Prediction:** View historical and predicted prices for major Indian stocks.
- **Virtual Trading Simulator:**  
  - Simulate buying/selling stocks with a virtual balance.
  - Real-time, interactive candlestick chart for your portfolio value.
  - All trading logic is client-side for instant feedback.
- **IPO Alerts:** Stay updated with the latest IPOs.
- **Responsive UI:** Clean, modern design with Bootstrap and custom CSS.

---

## 🛠️ Tech Stack

- **Backend:** Flask, pandas, openpyxl
- **Frontend:** HTML, Bootstrap, Plotly.js, custom JS/CSS
- **Deployment:** Ready for Render, Railway, or similar platforms

---

## 📦 Setup & Deployment

### 1. **Clone the Repository**
```bash
git clone [https://github.com/rsk-27/stockpp](https://github.com/rsk-27/stockpp).git
cd your-repo
```

### 2. **Install Dependencies**
```bash
pip install -r requirements.txt
```

### 3. **Run Locally**
```bash
# Set environment variables if needed (e.g., SECRET_KEY)
python app.py
```
Visit [http://localhost:5000](http://localhost:5000) in your browser.

### 4. **Deploy to Render/Railway**
- Push your code to GitHub.
- Connect your repo on [Render](https://render.com) or [Railway](https://railway.app).
- The platform will use:
  - `requirements.txt` for dependencies
  - `Procfile` for the start command
  - `runtime.txt` for Python version

---

## ⚙️ Configuration

- **API Keys:**  
  Set your Alpha Vantage or other API keys as environment variables or directly in `app.py`.
- **User Data:**  
  User credentials are stored in `users.xlsx` (Excel file).

---

## 📁 Project Structure

```
.
├── app.py
├── requirements.txt
├── Procfile
├── runtime.txt
├── users.xlsx
├── static/
│   ├── css/
│   └── js/
├── templates/
│   └── *.html
└── ...
```

---

## 📝 License

This project is for educational and demonstration purposes.

---

## 🙏 Acknowledgements

- [Flask](https://flask.palletsprojects.com/)
- [pandas](https://pandas.pydata.org/)
- [Plotly.js](https://plotly.com/javascript/)
- [Bootstrap](https://getbootstrap.com/)

---

**Feel free to fork, modify, and deploy your own version!**

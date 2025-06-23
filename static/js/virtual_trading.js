document.addEventListener('DOMContentLoaded', function() {
    // Initialize variables
    let portfolioChart = null;
    const tradeModal = document.getElementById('tradeModal');
    const closeBtn = document.querySelector('.close');
    const tradeForm = document.getElementById('tradeForm');
    const quantityInput = document.getElementById('quantityInput');
    const priceInput = document.getElementById('priceInput');
    const totalValueSpan = document.getElementById('totalValue');

    // Real-time simulation logic for educational trading
    const stockSelect = document.getElementById('stockSelect');
    const orderTypeSelect = document.getElementById('orderTypeSelect');
    const slippageInput = document.getElementById('slippageInput');
    const simulatedPriceInput = document.getElementById('simulatedPrice');

    // Event Listeners
    if (closeBtn && tradeModal) {
    closeBtn.onclick = () => tradeModal.style.display = 'none';
    window.onclick = (event) => {
        if (event.target == tradeModal) {
            tradeModal.style.display = 'none';
        }
    };
    }

    // Calculate total value when quantity or price changes
    quantityInput.addEventListener('input', updateTotalValue);
    priceInput.addEventListener('input', updateTotalValue);

    // Handle trade form submission
    if (tradeForm) {
    tradeForm.addEventListener('submit', handleTrade);
    }

    // Initial data load
    loadPortfolio();
    loadAvailableStocks();
    loadTransactions();
    loadPerformance();

    // Refresh data every 30 seconds
    setInterval(() => {
        loadPortfolio();
        loadAvailableStocks();
        loadPerformance();
    }, 30000);

    // Example: Simulate price impact (linear model for education)
    function calculateSimulatedPrice(currentPrice, quantity, slippage, orderType) {
        // For educational purposes: price impact = currentPrice * (1 + slippage/100 * (quantity/100))
        // Market order: always incurs slippage, limit order: only if price moves
        let impact = (slippage / 100) * (quantity / 100);
        let simulatedPrice = currentPrice;
        if (orderType === 'market') {
            simulatedPrice = currentPrice * (1 + impact);
        } else {
            simulatedPrice = currentPrice; // Limit order: assume no impact for simplicity
        }
        return simulatedPrice;
    }

    function updateSimulatedPrice() {
        const currentPrice = parseFloat(priceInput.value) || 0;
        const quantity = parseFloat(quantityInput.value) || 1;
        const slippage = parseFloat(slippageInput.value) || 0;
        const orderType = orderTypeSelect.value;
        const simulatedPrice = calculateSimulatedPrice(currentPrice, quantity, slippage, orderType);
        simulatedPriceInput.value = simulatedPrice.toFixed(2);
    }

    if (stockSelect && quantityInput && orderTypeSelect && slippageInput && priceInput && simulatedPriceInput) {
        quantityInput.addEventListener('input', updateSimulatedPrice);
        orderTypeSelect.addEventListener('change', updateSimulatedPrice);
        slippageInput.addEventListener('input', updateSimulatedPrice);
        priceInput.addEventListener('input', updateSimulatedPrice);
        stockSelect.addEventListener('change', updateSimulatedPrice);
        // Initial update
        updateSimulatedPrice();
    }

    function updateTotalValue() {
        const quantity = parseFloat(quantityInput.value) || 0;
        const price = parseFloat(priceInput.value) || 0;
        const total = quantity * price;
        totalValueSpan.textContent = `₹${total.toFixed(2)}`;
    }

    function formatCurrency(amount) {
        return `₹${parseFloat(amount).toFixed(2)}`;
    }

    function formatPercentage(amount) {
        return `${parseFloat(amount).toFixed(2)}%`;
    }

    function loadPortfolio() {
        fetch('/api/virtual-trading/portfolio')
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    updatePortfolioUI(data.data);
                }
            })
            .catch(error => console.error('Error loading portfolio:', error));
    }

    function updatePortfolioUI(data) {
        // Update summary cards
        document.getElementById('totalValue').textContent = formatCurrency(data.total_value);
        document.getElementById('availableBalance').textContent = formatCurrency(data.balance);

        // Update holdings table
        const tbody = document.getElementById('holdingsTableBody');
        tbody.innerHTML = '';

        Object.entries(data.holdings).forEach(([symbol, holding]) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${symbol}</td>
                <td>${holding.quantity}</td>
                <td>${formatCurrency(holding.average_price)}</td>
                <td>${formatCurrency(holding.current_price)}</td>
                <td>${formatCurrency(holding.current_value)}</td>
                <td class="${holding.profit_loss >= 0 ? 'profit' : 'loss'}">
                    ${formatCurrency(holding.profit_loss)} (${formatPercentage(holding.profit_loss_percentage)})
                </td>
                <td>
                    <button class="action-btn sell-btn" onclick="openTradeModal('${symbol}', 'sell', ${holding.current_price})">
                        Sell
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });

        // Update portfolio chart
        updatePortfolioChart(data);
    }

    function updatePortfolioChart(data) {
        const ctx = document.getElementById('portfolioChart').getContext('2d');
        const labels = Object.keys(data.holdings);
        const values = Object.values(data.holdings).map(h => h.current_value);

        if (portfolioChart) {
            portfolioChart.destroy();
        }

        portfolioChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: [
                        '#4CAF50', '#2196F3', '#FFC107', '#9C27B0', '#FF5722',
                        '#00BCD4', '#E91E63', '#3F51B5', '#FF9800', '#009688'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right'
                    }
                }
            }
        });
    }

    function loadAvailableStocks() {
        fetch('/api/sectors')
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    updateAvailableStocksUI(data.data);
                }
            })
            .catch(error => console.error('Error loading available stocks:', error));
    }

    function updateAvailableStocksUI(sectors) {
        const tbody = document.getElementById('availableStocksTableBody');
        tbody.innerHTML = '';

        Object.entries(sectors).forEach(([sector, companies]) => {
            companies.forEach(company => {
            const row = document.createElement('tr');
                row.dataset.sector = sector;
            row.innerHTML = `
                    <td>${company.name}</td>
                    <td>${formatCurrency(company.current_price || 0)}</td>
                    <td class="${company.change >= 0 ? 'profit' : 'loss'}">
                        ${formatPercentage(company.change || 0)}
                </td>
                <td>
                        <button class="action-btn buy-btn" onclick="openTradeModal('${company.symbol}', 'buy', ${company.current_price || 0})">
                        Buy
                    </button>
                </td>
            `;
            tbody.appendChild(row);
            });
        });
    }

    function filterStocks() {
        const sector = document.getElementById('sectorFilter').value;
        const rows = document.querySelectorAll('#availableStocksTableBody tr');
        
        rows.forEach(row => {
            if (!sector || row.dataset.sector === sector) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }

    function loadTransactions() {
        fetch('/api/virtual-trading/transactions')
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    updateTransactionsUI(data.data);
                }
            })
            .catch(error => console.error('Error loading transactions:', error));
    }

    function updateTransactionsUI(transactions) {
        const container = document.getElementById('transactionList');
        container.innerHTML = '';

        transactions.reverse().forEach(transaction => {
            const div = document.createElement('div');
            div.className = 'transaction-item';
            div.innerHTML = `
                <div class="transaction-header">
                    <span class="transaction-type ${transaction.type}">${transaction.type.toUpperCase()}</span>
                    <span class="transaction-date">${new Date(transaction.date).toLocaleString()}</span>
                </div>
                <div class="transaction-details">
                    <p>${transaction.symbol} - ${transaction.quantity} shares @ ${formatCurrency(transaction.price)}</p>
                    <p>Total: ${formatCurrency(transaction.total)}</p>
                    ${transaction.profit_loss ? `<p class="${transaction.profit_loss >= 0 ? 'profit' : 'loss'}">P/L: ${formatCurrency(transaction.profit_loss)}</p>` : ''}
                </div>
            `;
            container.appendChild(div);
        });
    }

    function loadPerformance() {
        fetch('/api/virtual-trading/performance')
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    updatePerformanceUI(data.data);
                }
            })
            .catch(error => console.error('Error loading performance:', error));
    }

    function updatePerformanceUI(data) {
        document.getElementById('totalPL').textContent = formatCurrency(data.total_profit_loss);
        document.getElementById('plPercentage').textContent = formatPercentage(data.profit_loss_percentage);
        document.getElementById('plPercentage').className = data.total_profit_loss >= 0 ? 'profit' : 'loss';
    }

    function openTradeModal(symbol, type, currentPrice) {
        document.getElementById('tradeSymbol').value = symbol;
        document.getElementById('tradeType').value = type;
        document.getElementById('tradeModalTitle').textContent = `${type.toUpperCase()} ${symbol}`;
        priceInput.value = currentPrice;
        quantityInput.value = 1;
        updateTotalValue();
        tradeModal.style.display = 'block';
    }

    function handleTrade(event) {
        event.preventDefault();
        const symbol = document.getElementById('tradeSymbol').value;
        const type = document.getElementById('tradeType').value;
        const quantity = parseInt(quantityInput.value);
        const price = parseFloat(priceInput.value);

        fetch('/api/virtual-trading/trade', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                type: type,
                symbol: symbol,
                quantity: quantity,
                price: price
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                tradeModal.style.display = 'none';
                loadPortfolio();
                loadTransactions();
                loadPerformance();
            } else {
                alert(data.message);
            }
        })
        .catch(error => {
            console.error('Error executing trade:', error);
            alert('Error executing trade. Please try again.');
        });
    }

    // Helper: fetch current price for selected stock (simulate for demo, or use API if available)
    async function fetchCurrentPriceForStock(stockValue) {
        // For demo: random price, but you can replace with real API call
        // Example: /api/stock/<sector>/<company>
        let price = 0;
        try {
            const [sector, company] = stockValue.split('/');
            const response = await fetch(`/api/stock/${sector}/${company}`);
            if (response.ok) {
                const data = await response.json();
                price = data.data.current_price || 0;
            } else {
                // fallback: random price
                price = (Math.random() * 1000 + 100).toFixed(2);
            }
        } catch (e) {
            price = (Math.random() * 1000 + 100).toFixed(2);
        }
        return price;
    }

    if (stockSelect) {
        stockSelect.addEventListener('change', function() {
            // Enable all parameter inputs
            quantityInput.disabled = false;
            orderTypeSelect.disabled = false;
            slippageInput.disabled = false;
            // Do not update priceInput.value here; user will input price manually
            updateSimulatedPrice();
        });
        // On page load, just update simulated price
        updateSimulatedPrice();
    }

    // Add Calculate button logic
    const calculateBtn = document.getElementById('calculateBtn');
    if (calculateBtn) {
        calculateBtn.addEventListener('click', function(event) {
            event.preventDefault();
            // Validate inputs
            const currentPrice = parseFloat(priceInput.value);
            const quantity = parseFloat(quantityInput.value);
            const slippage = parseFloat(slippageInput.value);
            const orderType = orderTypeSelect.value;
            if (
                isNaN(currentPrice) || currentPrice <= 0 ||
                isNaN(quantity) || quantity <= 0 ||
                isNaN(slippage) || slippage < 0
            ) {
                alert('Please enter valid, positive values for Price, Quantity, and non-negative Slippage.');
                return;
            }
            // Logical, mathematical, and statistical calculation:
            // For Market: price * (1 + slippage/100 * sqrt(quantity))
            // For Limit: price (no slippage for limit order in this simple model)
            let simulatedPrice = currentPrice;
            if (orderType === 'market') {
                // Use sqrt(quantity) for a more realistic statistical price impact
                let impact = (slippage / 100) * Math.sqrt(quantity);
                simulatedPrice = currentPrice * (1 + impact);
            } else {
                simulatedPrice = currentPrice;
            }
            simulatedPriceInput.value = simulatedPrice.toFixed(2);
            // Update portfolio simulation
            simulateTrade();
        });
    }

    // Add Reset button below Calculate
    const calculateBtnParent = calculateBtn ? calculateBtn.parentElement : null;
    let resetBtn = document.createElement('button');
    resetBtn.textContent = 'Reset';
    resetBtn.className = 'btn btn-secondary w-100 py-2 mt-2';
    resetBtn.style.fontSize = '1.1rem';
    if (calculateBtnParent) {
        calculateBtnParent.appendChild(resetBtn);
    }
    resetBtn.addEventListener('click', function() {
        portfolio = {
            balance: startingBalance,
            holdings: {},
            totalValue: startingBalance,
            totalPL: 0,
            plPercentage: 0
        };
        simulatedMarketPrices = {};
        portfolioHistory = [];
        candle = null;
        lastCandleTime = null;
        updatePortfolioUI();
        drawPortfolioChart();
    });

    // --- Simulate price changes and update P/L ---
    let simulatedMarketPrices = {};
    function getSimulatedMarketPrice(symbol, basePrice) {
        if (!simulatedMarketPrices[symbol]) {
            simulatedMarketPrices[symbol] = basePrice;
        }
        return simulatedMarketPrices[symbol];
    }
    function fluctuatePrices() {
        Object.keys(portfolio.holdings).forEach(symbol => {
            let h = portfolio.holdings[symbol];
            let price = simulatedMarketPrices[symbol] || h.avgPrice;
            let minPrice = h.avgPrice * 0.8;
            // Mean-reverting random walk: pulls price toward avgPrice
            let meanReversion = 0.1 * (h.avgPrice - price);
            let change = (Math.random() * 0.01 - 0.005) * price + meanReversion;
            price = Math.max(minPrice, price + change);
            simulatedMarketPrices[symbol] = price;
        });
        updatePortfolioUI();
        addCandle(portfolio.totalValue);
        // Schedule next fluctuation at a random interval between 10 and 15 seconds
        let nextInterval = 10000 + Math.random() * 5000;
        setTimeout(fluctuatePrices, nextInterval);
    }
    // Start the first fluctuation
    setTimeout(fluctuatePrices, 10000 + Math.random() * 5000);

    // Update updatePortfolioUI to use simulated market price for P/L
    function updatePortfolioUI() {
        // Update portfolio value, P/L, and holdings
        let totalValue = portfolio.balance;
        let totalPL = 0;
        let plPercentage = 0;
        const holdingsDiv = document.getElementById('holdings');
        if (Object.keys(portfolio.holdings).length === 0) {
            holdingsDiv.textContent = 'None';
        } else {
            holdingsDiv.innerHTML = Object.entries(portfolio.holdings).map(([symbol, h]) => {
                let marketPrice = getSimulatedMarketPrice(symbol, h.avgPrice);
                let holdingValue = h.quantity * marketPrice;
                totalValue += holdingValue;
                let pl = (marketPrice - h.avgPrice) * h.quantity;
                totalPL += pl;
                return `${symbol}: ${h.quantity} @ ₹${h.avgPrice.toFixed(2)} (Now: ₹${marketPrice.toFixed(2)})`;
            }).join('<br>');
        }
        plPercentage = (totalPL / startingBalance) * 100;
        portfolio.totalValue = totalValue;
        portfolio.totalPL = totalPL;
        portfolio.plPercentage = plPercentage;
        document.getElementById('portfolioValue').textContent = `₹${portfolio.totalValue.toFixed(2)}`;
        document.getElementById('plValue').textContent = `₹${portfolio.totalPL.toFixed(2)} (${portfolio.plPercentage.toFixed(2)}%)`;
    }

    // --- Simple Client-Side Virtual Trading State ---
    let startingBalance = 15000;
    let portfolio = {
        balance: startingBalance,
        holdings: {}, // { symbol: { quantity, avgPrice } }
        totalValue: startingBalance,
        totalPL: 0,
        plPercentage: 0
    };

    function simulateTrade() {
        // Called when Calculate is clicked or parameters change
        const symbol = stockSelect.value;
        const quantity = parseFloat(quantityInput.value) || 0;
        const price = parseFloat(simulatedPriceInput.value) || 0;
        if (!symbol || quantity <= 0 || price <= 0) return;
        // Simulate a buy (for demo: always buy, no sell logic)
        let cost = quantity * price;
        let newBalance = startingBalance - cost;
        let holdings = {};
        holdings[symbol] = { quantity, avgPrice: price };
        let totalValue = newBalance + (quantity * price);
        let totalPL = totalValue - startingBalance;
        let plPercentage = (totalPL / startingBalance) * 100;
        portfolio = {
            balance: newBalance,
            holdings,
            totalValue,
            totalPL,
            plPercentage
        };
        updatePortfolioUI();
    }

    // Also update portfolio when parameters change
    [stockSelect, quantityInput, priceInput, simulatedPriceInput].forEach(input => {
        if (input) input.addEventListener('input', simulateTrade);
    });

    // Initialize UI
    updatePortfolioUI();

    // --- Candlestick chart for Simulated Portfolio Value ---
    let portfolioHistory = [];
    let candle = null;
    let lastCandleTime = null;
    function addCandle(value) {
        const now = new Date();
        if (!candle) {
            // Start new candle
            candle = {
                time: now,
                open: value,
                high: value,
                low: value,
                close: value
            };
            lastCandleTime = now;
        } else {
            // If 3-5s passed, close current candle and start new
            if ((now - lastCandleTime) > 3000 + Math.random() * 2000) {
                candle.close = value;
                portfolioHistory.push({...candle});
                candle = {
                    time: now,
                    open: value,
                    high: value,
                    low: value,
                    close: value
                };
                lastCandleTime = now;
            } else {
                // Update high/low/close
                candle.high = Math.max(candle.high, value);
                candle.low = Math.min(candle.low, value);
                candle.close = value;
            }
        }
        drawPortfolioChart();
    }
    function drawPortfolioChart() {
        if (!document.getElementById('priceChart')) return;
        if (portfolioHistory.length === 0 && !candle) return;
        const times = portfolioHistory.map(c => c.time.toLocaleTimeString());
        const open = portfolioHistory.map(c => c.open);
        const high = portfolioHistory.map(c => c.high);
        const low = portfolioHistory.map(c => c.low);
        const close = portfolioHistory.map(c => c.close);
        // Add current candle
        if (candle) {
            times.push(candle.time.toLocaleTimeString());
            open.push(candle.open);
            high.push(candle.high);
            low.push(candle.low);
            close.push(candle.close);
        }
        const trace = {
            x: times,
            open: open,
            high: high,
            low: low,
            close: close,
            increasing: {line: {color: 'green'}},
            decreasing: {line: {color: 'red'}},
            type: 'candlestick',
            xaxis: 'x',
            yaxis: 'y',
            name: 'Portfolio Value'
        };
        const layout = {
            dragmode: 'zoom',
            margin: {l: 40, r: 10, t: 10, b: 40},
            xaxis: {rangeslider: {visible: false}},
            yaxis: {title: 'Value (₹)'},
            showlegend: false,
            plot_bgcolor: '#f8fdfb',
            paper_bgcolor: '#f8fdfb',
        };
        Plotly.newPlot('priceChart', [trace], layout, {responsive: true});
    }
    // Add initial candle on load
    addCandle(portfolio.totalValue);
}); 
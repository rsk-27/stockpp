document.addEventListener('DOMContentLoaded', function() {
    // Initialize variables
    let portfolioChart = null;
    const tradeModal = document.getElementById('tradeModal');
    const closeBtn = document.querySelector('.close');
    const tradeForm = document.getElementById('tradeForm');
    const quantityInput = document.getElementById('quantity');
    const priceInput = document.getElementById('price');
    const totalValueSpan = document.getElementById('totalValue');

    // Event Listeners
    closeBtn.onclick = () => tradeModal.style.display = 'none';
    window.onclick = (event) => {
        if (event.target == tradeModal) {
            tradeModal.style.display = 'none';
        }
    };

    // Calculate total value when quantity or price changes
    quantityInput.addEventListener('input', updateTotalValue);
    priceInput.addEventListener('input', updateTotalValue);

    // Handle trade form submission
    tradeForm.addEventListener('submit', handleTrade);

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
}); 
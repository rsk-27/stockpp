document.addEventListener('DOMContentLoaded', function () {
    const sectorSelect = document.getElementById('sectorSelect');
    const companySelect = document.getElementById('companySelect');
    const companyName = document.getElementById('companyName');
    const currentPrice = document.getElementById('currentPrice');
    const prediction = document.getElementById('prediction');
    const change = document.getElementById('change');
    const predictedPriceNext = document.getElementById('predictedPriceNext');
    const stockChartCanvas = document.getElementById('stockChart');
    const rsi = document.getElementById('rsi');
    const sma5 = document.getElementById('sma5');
    const sma20 = document.getElementById('sma20');
    const sma50 = document.getElementById('sma50');
    const volume = document.getElementById('volume');
    const high52w = document.getElementById('high52w');
    const low52w = document.getElementById('low52w');
    const logoutBtn = document.getElementById('logoutBtn');
    const timeRangeSelect = document.getElementById('timeRangeSelect');
    const addToWishlistBtn = document.getElementById('addToWishlist');

    let stockChart = null;
    let sectorsData = {};
    let selectedPeriod = timeRangeSelect ? timeRangeSelect.value : '1y';
    let currentStockData = null;

    // Fetch sectors and companies from backend
    function fetchSectors() {
        console.log('Starting to fetch sectors...');
        fetch('/api/sectors', {
            credentials: 'include',  // Important for session cookies
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        })
            .then(response => {
                console.log('Response status:', response.status);
                console.log('Response headers:', response.headers);
                if (!response.ok) {
                    if (response.status === 401) {
                        console.error('Unauthorized access. Redirecting to login...');
                        window.location.href = '/login';
                        return;
                    }
                    return response.json().then(data => {
                        console.error('Error response data:', data);
                        throw new Error(data.message || `HTTP error! status: ${response.status}`);
                    });
                }
                return response.json();
            })
            .then(data => {
                console.log('Raw API response:', data);
                if (data.status !== 'success' || !data.data) {
                    console.error('Error in sectors data:', data.error || data.message);
                    alert(data.message || 'Failed to load sectors.');
                    return;
                }
                sectorsData = data.data;
                console.log('Sectors data stored:', sectorsData);
                populateSectorDropdown();
            })
            .catch(error => {
                console.error('Error fetching sectors:', error);
                alert('Failed to load sectors. Please try again.');
            });
    }

    // Populate sector dropdown
    function populateSectorDropdown() {
        console.log('Starting to populate sector dropdown');
        console.log('Current sectorsData:', sectorsData);
        sectorSelect.innerHTML = '<option value="" disabled selected>Select a sector</option>';
        // Add debug message to the page if no sectors
        let debugDiv = document.getElementById('debug-message');
        if (!debugDiv) {
            debugDiv = document.createElement('div');
            debugDiv.id = 'debug-message';
            debugDiv.style.color = 'red';
            debugDiv.style.margin = '1rem 0';
            sectorSelect.parentElement.appendChild(debugDiv);
        }
        if (!sectorsData || Object.keys(sectorsData).length === 0) {
            debugDiv.textContent = 'DEBUG: No sectors data loaded! Check backend response and session.';
            console.error('No sectors data available for dropdown');
            return;
        } else {
            debugDiv.textContent = '';
        }
        
        // Sort sectors alphabetically
        const sortedSectors = Object.keys(sectorsData).sort();
        console.log('Sorted sectors:', sortedSectors);
        
        sortedSectors.forEach(sector => {
            console.log('Adding sector to dropdown:', sector);
            const option = document.createElement('option');
            option.value = sector;
            // Capitalize first letter and replace hyphens with spaces
            option.textContent = sector.split('-').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ');
            sectorSelect.appendChild(option);
        });
        console.log('Sector dropdown populated');
    }

    // Populate company dropdown based on selected sector
    function populateCompanyDropdown(sector) {
        console.log('Populating company dropdown for sector:', sector);
        console.log('Available data for sector:', sectorsData[sector]);
        companySelect.innerHTML = '<option value="" disabled selected>Select a company</option>';
        
        if (sector && sectorsData[sector]) {
            // Sort companies alphabetically by name
            const sortedCompanies = sectorsData[sector].sort((a, b) => 
                a.name.localeCompare(b.name)
            );
            
            sortedCompanies.forEach(company => {
                console.log('Adding company:', company);
                const option = document.createElement('option');
                option.value = company.id;
                option.textContent = company.name;
                option.dataset.symbol = company.symbol;
                companySelect.appendChild(option);
            });
        }
        companySelect.disabled = !sector;
    }

    // Handle sector selection
    sectorSelect.addEventListener('change', () => {
        const sector = sectorSelect.value;
        console.log('Sector selected:', sector);
        populateCompanyDropdown(sector);
    });

    // Handle company selection
    companySelect.addEventListener('change', () => {
        const sector = sectorSelect.value;
        const company = companySelect.value;
        console.log('Company selected:', company, 'from sector:', sector);
        if (sector && company) {
            fetchStockData(sector, company);
        }
    });

    // Fetch stock data from backend
    function fetchStockData(sector, company) {
        companyName.textContent = 'Loading...';
        currentPrice.textContent = '--';
        prediction.textContent = '--';
        change.textContent = '--';
        predictedPriceNext.textContent = '--';
        rsi.textContent = '--';
        sma5.textContent = '--';
        sma20.textContent = '--';
        sma50.textContent = '--';
        volume.textContent = '--';
        high52w.textContent = '--';
        low52w.textContent = '--';

        if (stockChart) {
            stockChart.destroy();
            stockChart = null;
        }

        // Remove any previous no-data message
        let noDataDiv = document.getElementById('no-data-message');
        if (noDataDiv) noDataDiv.remove();

        const periodParam = selectedPeriod ? `?period=${selectedPeriod}` : '';
        fetch(`/api/stock/${sector}/${company}${periodParam}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.status !== 'success' || !data.data || !data.data.historical_dates || data.data.historical_dates.length === 0) {
                    companyName.textContent = 'No data available for this time range.';
                    // Show a user-friendly message below the chart
                    const chartContainer = document.querySelector('.chart-container');
                    if (chartContainer) {
                        const msg = document.createElement('div');
                        msg.id = 'no-data-message';
                        msg.textContent = 'No data available for the selected time range.';
                        msg.style.color = '#ffcc00';
                        msg.style.fontWeight = 'bold';
                        msg.style.textAlign = 'center';
                        msg.style.margin = '1rem 0';
                        chartContainer.appendChild(msg);
                    }
                    return;
                }
                const stock = data.data;
                companyName.textContent = stock.name;
                currentPrice.textContent = stock.current_price.toFixed(2);
                prediction.textContent = stock.predicted_price.toFixed(2);
                change.textContent = stock.change;
                predictedPriceNext.textContent = stock.predicted_price_next.toFixed(2);
                rsi.textContent = stock.rsi.toFixed(2);
                sma5.textContent = stock.sma_5.toFixed(2);
                sma20.textContent = stock.sma_20.toFixed(2);
                sma50.textContent = stock.sma_50.toFixed(2);
                volume.textContent = stock.volume.toLocaleString();
                high52w.textContent = stock.high_52w.toFixed(2);
                low52w.textContent = stock.low_52w.toFixed(2);
                renderChart(stock.historical_dates, stock.historical_prices, stock.predicted_price);
                currentStockData = stock;
                addToWishlistBtn.style.display = 'block';
            })
            .catch(error => {
                console.error('Error fetching stock data:', error);
                companyName.textContent = 'Error loading data';
            });
    }

    // Render stock price chart using Chart.js
    function renderChart(dates, prices, predictedPrice) {
        const ctx = stockChartCanvas.getContext('2d');
        const historicalDates = dates;
        const historicalPrices = prices;
        const predictedDate = 'Predicted';
        if (stockChart) {
            stockChart.destroy();
        }
        stockChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [...historicalDates, predictedDate],
                datasets: [
                    {
                        label: 'Historical Price',
                        data: [...historicalPrices, null],
                        borderColor: '#00ff99',
                        backgroundColor: 'rgba(0, 255, 153, 0.1)',
                        fill: true,
                        tension: 0.1,
                        pointRadius: 3,
                        pointHoverRadius: 6,
                        borderWidth: 2,
                        spanGaps: false,
                    },
                    {
                        label: 'Predicted Price',
                        data: Array(historicalPrices.length).fill(null).concat([predictedPrice]),
                        borderColor: '#ffcc00',
                        backgroundColor: '#ffcc00',
                        borderDash: [8, 4],
                        pointRadius: 7,
                        pointHoverRadius: 10,
                        type: 'line',
                        fill: false,
                        tension: 0,
                        borderWidth: 3,
                        spanGaps: false,
                        showLine: false,
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        left: 30,
                        right: 30,
                        top: 30,
                        bottom: 30
                    }
                },
                plugins: {
                    legend: {
                        labels: {
                            color: '#00ff99',
                            font: { size: 16, family: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif', weight: 'bold' }
                        },
                        padding: 20
                    },
                    title: {
                        display: true,
                        text: 'Stock Price (Historical & Predicted)',
                        color: '#00ff99',
                        font: { size: 22, weight: 'bold', family: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif' },
                        padding: { top: 10, bottom: 20 }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: '#222',
                        titleColor: '#00ff99',
                        bodyColor: '#fff',
                        borderColor: '#00ff99',
                        borderWidth: 1,
                        titleFont: { size: 16, family: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif', weight: 'bold' },
                        bodyFont: { size: 15, family: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif' },
                        padding: 12,
                        callbacks: {
                            label: function(context) {
                                if (context.dataset.label === 'Predicted Price') {
                                    return 'Predicted: ' + context.parsed.y.toFixed(2);
                                } else if (context.dataset.label === 'Historical Price') {
                                    return 'Historical: ' + context.parsed.y.toFixed(2);
                                }
                                return context.parsed.y;
                            }
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Date',
                            color: '#00ff99',
                            font: { size: 16, family: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif', weight: 'bold' }
                        },
                        grid: {
                            color: 'rgba(0, 255, 153, 0.1)'
                        },
                        ticks: {
                            color: '#00ff99',
                            font: { size: 13, family: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif', weight: 'bold' },
                            maxRotation: 30,
                            minRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 12,
                            padding: 8
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Price (INR)',
                            color: '#00ff99',
                            font: { size: 16, family: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif', weight: 'bold' }
                        },
                        grid: {
                            color: 'rgba(0, 255, 153, 0.1)'
                        },
                        ticks: {
                            color: '#00ff99',
                            font: { size: 13, family: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif', weight: 'bold' },
                            padding: 8
                        }
                    }
                }
            }
        });
    }

    // Listen for time range changes
    if (timeRangeSelect) {
        timeRangeSelect.addEventListener('change', function() {
            selectedPeriod = this.value;
            const sector = sectorSelect.value;
            const company = companySelect.value;
            if (sector && company) {
                fetchStockData(sector, company);
            }
        });
    }

    // Logout button handler
    logoutBtn.addEventListener('click', () => {
        window.location.href = '/logout';
    });

    // Handle Add to Wishlist
    addToWishlistBtn.addEventListener('click', function() {
        if (!currentStockData) return;

        const selectedSector = sectorSelect.value;
        const selectedCompany = companySelect.value;
        const selectedOption = companySelect.options[companySelect.selectedIndex];
        const symbol = selectedOption.dataset.symbol;

        fetch('/api/virtual-trading/wishlist', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                symbol: symbol,
                sector: selectedSector,
                company: selectedCompany
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                alert('Stock added to wishlist successfully!');
            } else {
                alert(data.message || 'Failed to add stock to wishlist');
            }
        })
        .catch(error => {
            console.error('Error adding to wishlist:', error);
            alert('Error adding stock to wishlist');
        });
    });

    // Initialize
    console.log('Initializing dashboard...');
    fetchSectors();
});

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

    let stockChart = null;
    let sectorsData = {};
    let selectedPeriod = timeRangeSelect ? timeRangeSelect.value : '1y';
    let currentStockData = null;

    // Add time range selector logic
    const timeRanges = {
        '1D': 1,
        '1W': 7,
        '1M': 30,
        '1Y': 365,
        '5Y': 365 * 5,
        'MAX': null
    };

    function setRange(range) {
        selectedPeriod = range;
        const sector = sectorSelect.value;
        const company = companySelect.value;
        if (sector && company) {
            fetchStockData(sector, company);
        }
    }

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

    // Helper to show/hide chart loading spinner
    function showChartLoading(show) {
        const loadingDiv = document.getElementById('chart-loading');
        if (loadingDiv) loadingDiv.style.display = show ? 'flex' : 'none';
    }

    // Fetch stock data from backend
    function fetchStockData(sector, company) {
        showChartLoading(true);
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
                    showChartLoading(false);
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                showChartLoading(false);
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
                renderChart(stock.historical_dates, stock.historical_prices, stock.predicted_price, stock.regression_line);
                currentStockData = stock;
            })
            .catch(error => {
                showChartLoading(false);
                console.error('Error fetching stock data:', error);
                companyName.textContent = 'Error loading data';
            });
    }

    // Render stock price chart using Chart.js (modern style)
    function renderChart(dates, prices, predictedPrice, regressionLine) {
        const ctx = stockChartCanvas.getContext('2d');
        let filteredDates = dates;
        let filteredPrices = prices;
        let filteredRegression = regressionLine;
        // Filter data based on selectedPeriod
        if (selectedPeriod && selectedPeriod !== 'MAX') {
            const days = timeRanges[selectedPeriod] || 365;
            filteredDates = dates.slice(-days);
            filteredPrices = prices.slice(-days);
            filteredRegression = regressionLine ? regressionLine.slice(-days) : null;
        }
        if (stockChart) {
            stockChart.destroy();
        }
        stockChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: filteredDates,
                datasets: [
                    {
                        label: 'Price',
                        data: filteredPrices,
                        borderColor: '#21ce99',
                        backgroundColor: 'rgba(33,206,153,0.08)',
                        borderWidth: 2,
                        pointRadius: 0,
                        fill: true,
                        tension: 0.2,
                    },
                    filteredRegression ? {
                        label: 'Regression Line',
                        data: filteredRegression,
                        borderColor: '#1976d2',
                        borderWidth: 2,
                        borderDash: [8, 6],
                        pointRadius: 0,
                        fill: false,
                        tension: 0.2,
                        order: 1,
                    } : null,
                    predictedPrice !== undefined ? {
                        label: 'Predicted Price',
                        data: Array(filteredPrices.length - 1).fill(null).concat([predictedPrice]),
                        borderColor: '#ffcc00',
                        backgroundColor: '#ffcc00',
                        borderWidth: 0,
                        pointRadius: 6,
                        pointBackgroundColor: '#ffcc00',
                        type: 'line',
                        fill: false,
                        tension: 0,
                        showLine: false,
                        order: 2,
                    } : null
                ].filter(Boolean)
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
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

    // Add time range selector buttons to the page (if not already present)
    window.addEventListener('DOMContentLoaded', function() {
        if (!document.getElementById('time-range-selector')) {
            const container = document.createElement('div');
            container.id = 'time-range-selector';
            container.style.display = 'flex';
            container.style.gap = '0.5rem';
            container.style.margin = '1rem 0';
            ['1D','1W','1M','1Y','5Y','MAX'].forEach(range => {
                const btn = document.createElement('button');
                btn.textContent = range;
                btn.style.padding = '0.5rem 1rem';
                btn.style.border = '1px solid #21ce99';
                btn.style.background = 'white';
                btn.style.color = '#21ce99';
                btn.style.fontWeight = 'bold';
                btn.style.borderRadius = '6px';
                btn.style.cursor = 'pointer';
                btn.onclick = () => setRange(range);
                container.appendChild(btn);
            });
            const chartSection = document.querySelector('.chart-section');
            if (chartSection) chartSection.prepend(container);
        }
    });

    // Initialize
    console.log('Initializing dashboard...');
    fetchSectors();
});

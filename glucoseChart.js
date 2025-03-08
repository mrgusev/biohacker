// glucoseChart.js
// Glucose Chart Renderer

// Use an immediately invoked function expression (IIFE) instead of waiting for DOMContentLoaded
(async function () {
    // Target element for the chart
    const chartContainer = document.getElementById('glucose-chart');
    if (!chartContainer) return;

    // Create canvas element
    const canvas = document.createElement('canvas');
    chartContainer.appendChild(canvas);

    // Create and load fork and knife icon image
    const forkKnifeImage = new Image();
    forkKnifeImage.src = 'img/meal-12-svgrepo-com.svg';
    forkKnifeImage.width = 20;
    forkKnifeImage.height = 20;

    // Wait for image to load
    await new Promise(resolve => {
        forkKnifeImage.onload = resolve;
    });

    // Generate dummy data for the past 6 hours
    const generateDummyData = async () => {
        const data = [];
        const now = new Date();

        // Generate data points for the past 6 hours (one point every 5 minutes)
        for (let i = 72; i >= 0; i--) {
            const time = new Date(now - i * 5 * 60 * 1000);

            // Generate a somewhat realistic glucose value (mg/dL)
            // Base value between 80-140 with some randomness
            let baseValue = 110 + Math.sin(i / 10) * 30;
            let randomVariation = Math.random() * 20 - 30; // -10 to +10
            let glucoseValue = Math.round(baseValue + randomVariation);

            // Ensure values stay in a realistic range
            glucoseValue = Math.max(65, Math.min(200, glucoseValue));

            data.push({
                time: time,
                value: glucoseValue
            });
        }

        return data;
    };
    // Fetch real glucose data from API
    const fetchGlucoseData = async () => {
        try {
            const response = await fetch('https://staging.chatcgm.com/api/v1/entries.json?token=chatcgm-88ac67dc512af620&count=100', {
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // Transform API data to match expected format
            return data.map(entry => ({
                time: new Date(entry.date),
                value: entry.sgv,
                direction: entry.direction || 'NONE'
            })).reverse();
        } catch (error) {
            console.error('Error fetching glucose data:', error);
            // Fall back to dummy data if API fails
            return generateDummyData();
        }
    };

    // Fetch treatment data (insulin and carbs)
    const fetchTreatmentData = async () => {
        try {
            const response = await fetch('https://staging.chatcgm.com/api/v1/treatments?token=chatcgm-88ac67dc512af620&count=100', {
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // Get oldest glucose timestamp for filtering
            const oldestGlucoseTime = glucoseData.length > 0 ?
                Math.min(...glucoseData.map(entry => entry.time.getTime())) :
                new Date(Date.now() - 24 * 60 * 60 * 1000).getTime(); // Default to 24h ago if no glucose data

            // Filter and transform treatment data
            return data.map(treatment => ({
                time: new Date(treatment.created_at || treatment.timestamp || treatment.date),
                insulin: parseFloat(treatment.insulin) || 0,
                carbs: parseFloat(treatment.carbs) || 0
            }))
                .filter(t => {
                    // Only include treatments with insulin or carbs
                    const hasValidData = t.insulin > 0 || t.carbs > 0;
                    // Only include treatments not older than oldest glucose data
                    const isWithinTimeRange = t.time.getTime() >= oldestGlucoseTime;
                    return hasValidData && isWithinTimeRange;
                });
        } catch (error) {
            console.error('Error fetching treatment data:', error);
            return []; // Return empty array if API fails
        }
    };

    let glucoseData = await fetchGlucoseData();
    let treatmentData = await fetchTreatmentData();

    // Get current glucose value and trend
    const getCurrentGlucose = () => {
        const current = glucoseData[glucoseData.length - 1];
        return {
            value: current.value,
            trend: current.direction
        };
    };

    // Format time for display
    const formatTime = (date) => {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    // Update the display of current glucose value
    const updateCurrentValueDisplay = () => {
        const current = getCurrentGlucose();
        const valueDisplay = document.getElementById('current-glucose-value');
        const trendDisplay = document.getElementById('glucose-trend');

        if (valueDisplay) {
            valueDisplay.textContent = current.value;

            // Add color based on range
            valueDisplay.className = '';
            if (current.value < 70) {
                valueDisplay.classList.add('text-red-500');
            } else if (current.value > 180) {
                valueDisplay.classList.add('text-orange-500');
            } else {
                valueDisplay.classList.add('text-green-500');
            }
        }

        if (trendDisplay) {
            let trendIcon = '→';
            if (current.trend.includes('Up')) {
                trendIcon = '↑';
                trendDisplay.classList.add('text-red-500');
            } else if (current.trend.includes('Down')) {
                trendIcon = '↓';
                trendDisplay.classList.add('text-blue-500');
            } else {
                trendDisplay.classList.add('text-green-500');
            }
            trendDisplay.textContent = trendIcon;
        }
    };

    // Initialize Chart.js
    const initChart = () => {
        const ctx = canvas.getContext('2d');

        // Create gradient for fill
        const gradientFill = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradientFill.addColorStop(0, 'rgba(34, 197, 94, 0.2)');
        gradientFill.addColorStop(1, 'rgba(34, 197, 94, 0)');

        // Check if mobile device by screen width
        const isMobile = window.innerWidth < 768;

        // Create the chart
        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [
                    {
                        label: 'Glucose (mg/dL)',
                        data: glucoseData.map(item => ({
                            x: item.time,
                            y: item.value
                        })),
                        borderColor: 'rgb(34, 197, 94)',
                        borderWidth: 2,
                        pointRadius: 0,
                        pointHoverRadius: 4,
                        pointBackgroundColor: 'rgb(34, 197, 94)',
                        tension: 0.4,
                        fill: true,
                        backgroundColor: gradientFill,
                        // Shadow effect for glow
                        shadowColor: 'rgba(34, 197, 94, 0.5)',
                        shadowBlur: 10,
                        shadowOffsetX: 0,
                        shadowOffsetY: 0,
                        order: 1
                    },
                    {
                        label: 'Insulin (units)',
                        data: treatmentData.filter(item => item.insulin > 0).map(item => ({
                            x: item.time,
                            y: item.insulin
                        })),
                        type: 'bar',
                        backgroundColor: 'rgba(59, 130, 246, 0.7)',
                        borderColor: 'rgb(59, 130, 246)',
                        borderWidth: 1,
                        barPercentage: 0.2,
                        yAxisID: 'y1',
                        order: 2
                    },
                    {
                        label: 'Carbs (grams)',
                        data: treatmentData.filter(item => item.carbs > 0).map(item => ({
                            x: item.time,
                            y: 130, // Fixed y position for visual clarity
                            r: Math.max(5, Math.min(25, item.carbs / 3)), // Circle radius based on carb amount, min 5px, max 25px
                            carbs: item.carbs // Store original carb value for tooltip
                        })),
                        type: 'bubble',
                        backgroundColor: 'rgba(251, 191, 36, 0.7)',
                        borderColor: 'rgb(251, 191, 36)',
                        borderWidth: 1,
                        order: 0,
                        pointStyle: forkKnifeImage
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            title: (tooltipItems) => {
                                return formatTime(new Date(tooltipItems[0].raw.x));
                            },
                            label: (context) => {
                                const datasetLabel = context.dataset.label;

                                if (datasetLabel === 'Glucose (mg/dL)') {
                                    return `Glucose: ${context.raw.y} mg/dL`;
                                } else if (datasetLabel === 'Insulin (units)') {
                                    return `Insulin: ${context.raw.y} units`;
                                } else if (datasetLabel === 'Carbs (grams)') {
                                    return `Carbs: ${context.raw.carbs} grams`;
                                }
                                return datasetLabel;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'hour',
                            displayFormats: {
                                hour: 'HH:mm'
                            }
                        },
                        grid: {
                            display: false
                        },
                        ticks: {
                            // Optimize for mobile view
                            maxRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: isMobile ? 4 : 6,
                            font: {
                                size: isMobile ? 10 : 12
                            },
                            padding: 10
                        },
                        border: {
                            display: false
                        },
                        // Add these lines for full width
                        offset: false,
                        bounds: 'data'
                    },
                    y: {
                        min: 50,
                        max: 210,
                        grid: {
                            color: 'rgba(200, 200, 200, 0.1)'
                        },
                        ticks: {
                            stepSize: isMobile ? 50 : 40,
                            font: {
                                size: isMobile ? 10 : 12
                            },
                            padding: isMobile ? 5 : 10
                        },
                        border: {
                            display: false
                        },
                        position: isMobile ? 'right' : 'left'
                    },
                    y1: {
                        position: 'right',
                        min: 0,
                        max: 10,
                        grid: {
                            display: false
                        },
                        ticks: {
                            display: false
                        },
                        border: {
                            display: false
                        }
                    }
                },
                animation: {
                    duration: 1000
                },
                // Modify the layout padding to reduce horizontal padding
                layout: {
                    padding: {
                        left: 0,
                        right: 0,
                        top: 10,
                        bottom: 20
                    }
                }
            },
            plugins: [{
                id: 'backgroundColors',
                beforeDraw: (chart) => {
                    const { ctx, chartArea, scales } = chart;
                    if (!chartArea) return;

                    const { top, bottom, left, right } = chartArea;
                    const { y } = scales;

                    // Low blood sugar boundary - red gradient (below 70)
                    const lowY = y.getPixelForValue(70);
                    if (lowY > top) {
                        ctx.save();
                        const lowGradient = ctx.createLinearGradient(0, lowY, 0, bottom);
                        lowGradient.addColorStop(0, 'rgba(200, 200, 200, 0.1)');  // light gray with low opacity
                        lowGradient.addColorStop(1, 'rgba(200, 200, 200, 0.05)');

                        ctx.fillStyle = lowGradient;
                        ctx.fillRect(left, lowY, right - left, bottom - lowY);
                        ctx.restore();
                    }

                    // High blood sugar boundary - gray gradient (above 180)
                    const highY = y.getPixelForValue(180);
                    if (highY < bottom) {
                        ctx.save();
                        const highGradient = ctx.createLinearGradient(0, top, 0, highY);
                        highGradient.addColorStop(0, 'rgba(200, 200, 200, 0.05)'); // light gray with low opacity
                        highGradient.addColorStop(1, 'rgba(200, 200, 200, 0.1)');

                        ctx.fillStyle = highGradient;
                        ctx.fillRect(left, top, right - left, highY - top);
                        ctx.restore();
                    }
                }
            }]
        });

        // Add custom plugin for the glow effect
        Chart.register({
            id: 'glowingLine',
            beforeDraw: (chart) => {
                const ctx = chart.ctx;
                ctx.save();
                ctx.shadowColor = 'rgba(34, 197, 94, 0.5)';
                ctx.shadowBlur = 10;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
                ctx.restore();
            }
        });

        // Handle window resize to update chart for different screen sizes
        window.addEventListener('resize', () => {
            const newIsMobile = window.innerWidth < 768;
            if (newIsMobile !== isMobile) {
                // Update chart options for new screen size
                chart.options.scales.x.ticks.maxTicksLimit = newIsMobile ? 4 : 6;
                chart.options.scales.x.ticks.font.size = newIsMobile ? 10 : 12;
                chart.options.scales.y.ticks.stepSize = newIsMobile ? 50 : 40;
                chart.options.scales.y.ticks.font.size = newIsMobile ? 10 : 12;
                chart.options.scales.y.ticks.padding = newIsMobile ? 5 : 10;
                chart.options.scales.y.position = newIsMobile ? 'right' : 'left';
                chart.options.layout.padding = {
                    left: newIsMobile ? 5 : 10,
                    right: newIsMobile ? 5 : 10,
                    top: 10,
                    bottom: 20
                };
                chart.update();
            }
        });

        return chart;
    };

    // Initialize the chart
    const chart = initChart();

    // Function to add new data point and update chart
    const updateChart = async () => {
        // Fetch latest glucose data
        glucoseData = await fetchGlucoseData();
        treatmentData = await fetchTreatmentData();

        // Update chart with new glucose data
        chart.data.datasets[0].data = glucoseData.map(item => ({
            x: item.time,
            y: item.value
        }));

        // Update insulin data
        chart.data.datasets[1].data = treatmentData.filter(item => item.insulin > 0).map(item => ({
            x: item.time,
            y: item.insulin
        }));

        // Update carbs data
        chart.data.datasets[2].data = treatmentData.filter(item => item.carbs > 0).map(item => ({
            x: item.time,
            y: 130, // Fixed y position for visual clarity
            r: Math.max(3, Math.min(15, item.carbs / 5)), // Circle radius based on carb amount
            carbs: item.carbs // Store original carb value for tooltip
        }));

        chart.update();

        // Update current value display
        updateCurrentValueDisplay();
    };

    // Create display for current glucose value and trend
    const createCurrentValueDisplay = () => {
        const valueDisplay = document.createElement('div');
        valueDisplay.className = 'mb-4 flex items-center justify-center';
        valueDisplay.innerHTML = `
            <div class="text-5xl md:text-7xl font-extrabold">
                <span id="current-glucose-value"></span>
            </div>
            <div class="ml-2 text-xl" id="glucose-trend"></div>
            <div class="ml-2 text-gray-500 dark:text-gray-400">mg/dL</div>
        `;
        chartContainer.insertBefore(valueDisplay, canvas);
    };

    // Initialize current value display
    createCurrentValueDisplay();
    updateCurrentValueDisplay();

    // Update chart every minute
    setInterval(updateChart, 60000);

    // Add CSS for glow effect
    const style = document.createElement('style');
    style.textContent = `
        #glucose-chart {
            position: absolute;
            inset: 0;
            margin-top: 0 !important;
            height: 100%;
            width: 100%;
            box-sizing: border-box;
            overflow: hidden;
        }
        
        #glucose-chart canvas {
            filter: drop-shadow(0 0 6px rgba(34, 197, 94, 0.3));
            width: 100% !important; /* Force full width */
            height: 100%;
        }
        
        #current-glucose-value.text-green-500 {
            text-shadow: 0 0 8px rgba(34, 197, 94, 0.4);
        }
        
        #current-glucose-value.text-red-500 {
            text-shadow: 0 0 8px rgba(239, 68, 68, 0.4); 
        }
        
        #current-glucose-value.text-orange-500 {
            text-shadow: 0 0 8px rgba(249, 115, 22, 0.4);
        }
        
        @media (max-width: 768px) {
            .chart-container {
                height: 200px !important;
            }
            
            #glucose-chart canvas {
                width: 100% !important;
            }
        }
    `;
    document.head.appendChild(style);
})(); 
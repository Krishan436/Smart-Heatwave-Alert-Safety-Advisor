/**
 * Aegis Heat - Smart Heatwave Alert & Safety Advisor
 * Core Application Logic (API, Calculator, Checklist, Chart & Simulation Engine)
 */

document.addEventListener('DOMContentLoaded', () => {
    // ==========================================================================
    // State Management
    // ==========================================================================
    const state = {
        temperature: 24,       // Celsius
        humidity: 45,          // %
        apparentTemp: 24,      // Celsius (Heat Index)
        uvIndex: 2,            // 0-12+
        windSpeed: 12,         // km/h
        locationName: 'San Francisco, USA (Default)',
        lastUpdated: new Date(),
        tempUnit: 'C',         // 'C' or 'F'
        activeProfiles: new Set(),
        checklist: [],
        forecastHours: [],     // Hourly timestamps
        forecastTemps: [],     // Hourly temp values
        forecastUV: [],        // Hourly UV values
        isSimulation: true,
        chartInstance: null
    };

    // Standard safety checklists database based on risk categories and profiles
    const checklistDatabase = [
        { id: 'water', text: 'Drink at least 2-3 liters of water throughout the day.', category: 'all', profile: null },
        { id: 'sunscreen', text: 'Apply SPF 30+ sunscreen 15 mins before heading out.', category: 'caution', profile: null },
        { id: 'shade', text: 'Take cooling breaks in the shade every 20-30 minutes.', category: 'caution', profile: 'worker' },
        { id: 'peak-hours', text: 'Avoid strenuous outdoor activities between 11 AM and 4 PM.', category: 'danger', profile: null },
        { id: 'indoor', text: 'Stay inside air-conditioned rooms. Use fans only if temp is below 35°C.', category: 'danger', profile: null },
        { id: 'seniors-check', text: 'Check on elderly relatives or neighbors twice a day.', category: 'danger', profile: 'senior' },
        { id: 'pets-water', text: 'Ensure pets have shade and cold water. Never walk on hot asphalt.', category: 'all', profile: 'pet' },
        { id: 'kids-car', text: 'NEVER leave infants or children in a parked car (even for a minute).', category: 'danger', profile: 'child' },
        { id: 'hydrate-kids', text: 'Give kids small cups of water or diluted juice every 30 minutes.', category: 'all', profile: 'child' },
        { id: 'pregnancy-rest', text: 'Rest frequently in cool rooms and avoid standing for long periods.', category: 'caution', profile: 'pregnant' },
        { id: 'loose-clothing', text: 'Wear lightweight, light-colored, and loose-fitting clothing.', category: 'caution', profile: null },
        { id: 'avoid-alcohol', text: 'Avoid alcohol, caffeine, and heavy, hot meals which dehydrate you.', category: 'danger', profile: null },
        { id: 'check-urine', text: 'Monitor hydration level: urine should be pale yellow/clear.', category: 'all', profile: null },
        { id: 'emergency-signs', text: 'Learn symptoms of Heat Stroke vs Heat Exhaustion (see footer link).', category: 'danger', profile: null },
        { id: 'heavy-gear', text: 'Dampen clothing or use wet towels on your neck to cool down.', category: 'extreme', profile: 'worker' },
        { id: 'infant-shade', text: 'Keep infants under 6 months completely out of direct sunlight.', category: 'caution', profile: 'child' }
    ];

    // ==========================================================================
    // DOM Element Selectors
    // ==========================================================================
    const el = {
        body: document.body,
        cityInput: document.getElementById('city-input'),
        searchForm: document.getElementById('search-form'),
        searchSuggestions: document.getElementById('search-suggestions'),
        locateBtn: document.getElementById('locate-btn'),
        
        currentTemp: document.getElementById('current-temp'),
        unitToggle: document.getElementById('unit-toggle'),
        heatBadge: document.getElementById('heat-badge'),
        dangerTitle: document.getElementById('danger-title'),
        dangerDesc: document.getElementById('danger-desc'),
        
        valHumidity: document.getElementById('val-humidity'),
        valHeatIndex: document.getElementById('val-heat-index'),
        valUv: document.getElementById('val-uv'),
        valWind: document.getElementById('val-wind'),
        locationName: document.getElementById('location-name'),
        lastUpdated: document.getElementById('last-updated'),
        
        profileChips: document.querySelectorAll('.profile-chip'),
        waterRequirement: document.getElementById('water-requirement'),
        hydrationProgress: document.getElementById('hydration-progress'),
        hydrationTip: document.getElementById('hydration-tip'),
        safetyChecklist: document.getElementById('safety-checklist'),
        checklistCounter: document.getElementById('checklist-counter'),
        
        tabBtns: document.querySelectorAll('.tab-btn'),
        tabContents: document.querySelectorAll('.tab-content'),
        
        // Simulator elements
        simBtns: document.querySelectorAll('.sim-btn'),
        simTempInput: document.getElementById('sim-temp-input'),
        simHumidityInput: document.getElementById('sim-humidity-input'),
        simTempVal: document.getElementById('sim-temp-val'),
        simHumidityVal: document.getElementById('sim-humidity-val'),
        applyCustomSim: document.getElementById('apply-custom-sim'),
        
        // Calculator elements
        calcTemp: document.getElementById('calc-temp'),
        calcHumidity: document.getElementById('calc-humidity'),
        calcTempVal: document.getElementById('calc-temp-val'),
        calcHumidityVal: document.getElementById('calc-humidity-val'),
        calcResult: document.getElementById('calc-result'),
        calcRiskBadge: document.getElementById('calc-risk-badge'),
        gaugeFill: document.getElementById('gauge-fill'),

        // Modals
        scienceAboutBtn: document.getElementById('science-about-btn'),
        emergencyContactsBtn: document.getElementById('emergency-contacts-btn'),
        scienceModal: document.getElementById('science-modal'),
        emergencyModal: document.getElementById('emergency-modal'),
        closeScienceBtn: document.getElementById('close-science-btn'),
        closeEmergencyBtn: document.getElementById('close-emergency-btn')
    };

    // Initialize Lucide Icons
    lucide.createIcons();

    // ==========================================================================
    // Calculations & Formulations
    // ==========================================================================

    /**
     * Calculates the Heat Index (Apparent Temperature) based on Temperature and Humidity.
     * Uses the standard NOAA equation (in Fahrenheit, converted from/to Celsius).
     */
    function calculateHeatIndex(celsius, relativeHumidity) {
        const T = (celsius * 9 / 5) + 32; // Convert to Fahrenheit
        const R = relativeHumidity;
        
        // Simple formula for mild conditions (T < 80 F)
        let hiF = 0.5 * (T + 61.0 + ((T - 68.0) * 1.2) + (R * 0.094));
        
        // If simple calculation exceeds 79 F, apply full regression equation
        if (hiF >= 80) {
            hiF = -42.379 +
                  2.04901523 * T +
                  10.14333127 * R -
                  0.22475541 * T * R -
                  0.00683783 * T * T -
                  0.05481717 * R * R +
                  0.00122874 * T * T * R +
                  0.0085282 * T * R * R -
                  0.00000199 * T * T * R * R;

            // Apply adjustments
            if (R < 13 && T >= 80 && T <= 112) {
                const adj = ((13 - R) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17);
                hiF -= adj;
            } else if (R > 85 && T >= 80 && T <= 87) {
                const adj = ((R - 85) / 10) * ((87 - T) / 5);
                hiF += adj;
            }
        }
        
        // If temperature is outside calculation range, fallback to air temperature
        if (T < 70) {
            return celsius;
        }

        const hiC = (hiF - 32) * 5 / 9; // Convert back to Celsius
        return Math.round(hiC * 10) / 10;
    }

    /**
     * Determines the risk category profile based on apparent temperature (heat index)
     */
    function getHeatSeverity(celsius) {
        if (celsius < 27) {
            return {
                level: 'safe',
                name: 'Safe Level',
                title: 'Thermal Comfort is Good',
                desc: 'No special heat advisories are in effect. Enjoy outdoor activities, but remember to stay hydrated during workouts.',
                class: 'heat-safe',
                gaugeOffset: 251.3 // Safe starting point (dashoffset matches gauge circle length)
            };
        } else if (celsius >= 27 && celsius < 32) {
            return {
                level: 'caution',
                name: 'Caution Level',
                title: 'Elevated Heat Alert',
                desc: 'Fatigue is possible with prolonged exposure or physical exertion. Ensure hydration and take shade when needed.',
                class: 'heat-caution',
                gaugeOffset: 180 // Amber sector
            };
        } else if (celsius >= 32 && celsius < 41) {
            return {
                level: 'extreme-caution',
                name: 'Extreme Caution',
                title: 'High Heat Danger Advisory',
                desc: 'Heat cramps, heavy exhaustion, and sunstroke are possible. Limit heavy labor and keep pets/children in cool spots.',
                class: 'heat-danger', // Combines with styling
                gaugeOffset: 110 // Darker Amber / Orange sector
            };
        } else if (celsius >= 41 && celsius < 54) {
            return {
                level: 'danger',
                name: 'Danger Alert',
                title: 'Severe Heatwave Alert',
                desc: 'Heat cramps or exhaustion likely. Heat stroke is highly possible. Remain indoors in cool or air-conditioned environments.',
                class: 'heat-danger',
                gaugeOffset: 50 // Glowing Crimson sector
            };
        } else {
            return {
                level: 'extreme-danger',
                name: 'Extreme Danger',
                title: 'Scorching Heat Crisis!',
                desc: 'HEAT STROKE IS IMMINENT. Outdoor activities are highly life-threatening. Immediately seek emergency cooling center shelters.',
                class: 'heat-extreme',
                gaugeOffset: 0 // Purple alert
            };
        }
    }

    /**
     * Determines UV Index warning name
     */
    function getUVCategory(uv) {
        if (uv <= 2) return `${uv} (Low)`;
        if (uv <= 5) return `${uv} (Moderate)`;
        if (uv <= 7) return `${uv} (High)`;
        if (uv <= 10) return `${uv} (Very High)`;
        return `${uv} (Extreme)`;
    }

    // ==========================================================================
    // UI Update Pipeline
    // ==========================================================================

    /**
     * Master render function that updates all visual elements to match current state
     */
    function updateUI() {
        const hi = calculateHeatIndex(state.temperature, state.humidity);
        state.apparentTemp = hi;
        const severity = getHeatSeverity(hi);

        // 1. Update Body classes & variable theme transitions
        el.body.className = severity.class;

        // 2. Main Temperature Display
        if (state.tempUnit === 'C') {
            el.currentTemp.textContent = `${Math.round(state.temperature)}°C`;
            el.valHeatIndex.textContent = `${Math.round(state.apparentTemp)}°C`;
        } else {
            const tempF = Math.round((state.temperature * 9 / 5) + 32);
            const hiF = Math.round((state.apparentTemp * 9 / 5) + 32);
            el.currentTemp.textContent = `${tempF}°F`;
            el.valHeatIndex.textContent = `${hiF}°F`;
        }

        // 3. Status Badges & Danger Alert Messages
        el.heatBadge.textContent = severity.name;
        el.dangerTitle.textContent = severity.title;
        el.dangerDesc.textContent = severity.desc;

        // 4. Metrics Grid
        el.valHumidity.textContent = `${state.humidity}%`;
        el.valUv.textContent = getUVCategory(state.uvIndex);
        el.valWind.textContent = `${state.windSpeed} km/h`;
        el.locationName.textContent = state.locationName;
        
        // Last Updated calculation
        const timeString = state.lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        el.lastUpdated.textContent = state.isSimulation ? `Simulated at ${timeString}` : `Updated at ${timeString}`;

        // 5. Update Gauge Arc Stroke-dashoffset
        // SVG circle gauge length is 251.3. Shift values from full dashoffset (empty/safe) to 0 (extreme/max)
        const minAppTemp = 20;
        const maxAppTemp = 50;
        let percentage = (state.apparentTemp - minAppTemp) / (maxAppTemp - minAppTemp);
        percentage = Math.max(0, Math.min(1, percentage)); // Clamp between 0 and 1
        const dashoffset = 251.3 - (percentage * 251.3);
        el.gaugeFill.style.strokeDashoffset = dashoffset;

        // 6. Dynamic safety checklists and hydration
        renderPersonalizedSection(severity.level);

        // 7. Update Forecast Chart
        renderChart();
    }

    /**
     * Computes water recommendation and builds safety checklists
     */
    function renderPersonalizedSection(currentLevel) {
        // Hydration Calculation
        let waterReq = 2.0; // Base liters
        
        // Temperature adjustments
        if (state.temperature > 25) {
            waterReq += (state.temperature - 25) * 0.15;
        }

        // Profile additions
        if (state.activeProfiles.has('worker')) waterReq += 1.5;
        if (state.activeProfiles.has('pregnant')) waterReq += 0.8;
        if (state.activeProfiles.has('senior')) waterReq += 0.4;
        
        waterReq = Math.round(waterReq * 10) / 10;
        
        // Children require smaller quantities but more frequent reminders
        if (state.activeProfiles.has('child')) {
            el.waterRequirement.textContent = "1.5L - 2.0L";
            el.hydrationTip.textContent = "Serve child 150ml of fluids every 20 mins. Avoid carbonated soda.";
        } else {
            el.waterRequirement.textContent = `${waterReq}L`;
            el.hydrationTip.textContent = `Aim to consume about ${Math.round((waterReq/8)*1000)}ml of water every hour.`;
        }

        // Hydration progress mock (linked to completed checklist items)
        const totalItemsCount = el.safetyChecklist.querySelectorAll('.checklist-item').length;
        const checkedItemsCount = el.safetyChecklist.querySelectorAll('.checklist-item.checked').length;
        const progressPercent = totalItemsCount > 0 ? (checkedItemsCount / totalItemsCount) * 100 : 0;
        el.hydrationProgress.style.width = `${progressPercent}%`;

        // Safety checklist filters
        const activeList = checklistDatabase.filter(item => {
            // Include if profile matches active chips
            if (item.profile && !state.activeProfiles.has(item.profile)) {
                return false;
            }
            // Include if category level corresponds
            if (item.category === 'all') return true;
            if (item.category === 'caution' && (currentLevel === 'caution' || currentLevel === 'extreme-caution' || currentLevel === 'danger' || currentLevel === 'extreme-danger')) return true;
            if (item.category === 'danger' && (currentLevel === 'extreme-caution' || currentLevel === 'danger' || currentLevel === 'extreme-danger')) return true;
            if (item.category === 'extreme' && currentLevel === 'extreme-danger') return true;
            
            return false;
        });

        // Maintain checked state across list changes if items remain in list
        const prevCheckedIds = Array.from(el.safetyChecklist.querySelectorAll('.checklist-item.checked'))
            .map(item => item.getAttribute('data-id'));

        // Render list HTML
        el.safetyChecklist.innerHTML = '';
        if (activeList.length === 0) {
            el.safetyChecklist.innerHTML = `<div class="checklist-desc">No special cautions needed. Stay safe!</div>`;
            el.checklistCounter.textContent = '0/0 Done';
            return;
        }

        let currentDone = 0;
        activeList.forEach(item => {
            const isChecked = prevCheckedIds.includes(item.id);
            if (isChecked) currentDone++;

            const itemDiv = document.createElement('div');
            itemDiv.className = `checklist-item ${isChecked ? 'checked' : ''}`;
            itemDiv.setAttribute('data-id', item.id);
            
            const tagSpan = item.profile ? `<span class="item-tag">${item.profile} priority</span>` : '';

            itemDiv.innerHTML = `
                <div class="check-box">
                    <i data-lucide="check"></i>
                </div>
                <div class="item-content">
                    <span class="item-text">${item.text}</span>
                    ${tagSpan}
                </div>
            `;
            
            itemDiv.addEventListener('click', () => {
                itemDiv.classList.toggle('checked');
                updateChecklistCounter();
            });

            el.safetyChecklist.appendChild(itemDiv);
        });

        lucide.createIcons({attrs: {"stroke-width": 3}});
        el.checklistCounter.textContent = `${currentDone}/${activeList.length} Done`;
    }

    function updateChecklistCounter() {
        const total = el.safetyChecklist.querySelectorAll('.checklist-item').length;
        const checked = el.safetyChecklist.querySelectorAll('.checklist-item.checked').length;
        el.checklistCounter.textContent = `${checked}/${total} Done`;
        
        // Update progress bar
        const pct = total > 0 ? (checked / total) * 100 : 0;
        el.hydrationProgress.style.width = `${pct}%`;
    }

    // ==========================================================================
    // Chart rendering (Chart.js Integration)
    // ==========================================================================
    function renderChart() {
        const themeColor = getComputedStyle(document.body).getPropertyValue('--theme-color').trim() || '#06b6d4';
        
        // Generate mock or simulated hours if empty
        if (state.forecastHours.length === 0) {
            const baseHour = new Date().getHours();
            for (let i = 0; i < 8; i++) {
                const hourNum = (baseHour + i * 3) % 24;
                const ampm = hourNum >= 12 ? 'PM' : 'AM';
                const formattedHour = `${hourNum % 12 || 12} ${ampm}`;
                state.forecastHours.push(formattedHour);
                
                // Simulated curve around current temperature
                const factor = Math.sin((i / 7) * Math.PI); // sine curve
                state.forecastTemps.push(Math.round(state.temperature + (factor * 6) - 2));
                state.forecastUV.push(Math.max(1, Math.round(state.uvIndex + (factor * 4) - 2)));
            }
        }

        const data = {
            labels: state.forecastHours,
            datasets: [
                {
                    label: 'Apparent Temp (°C)',
                    data: state.forecastTemps,
                    borderColor: themeColor,
                    backgroundColor: 'rgba(0,0,0,0)',
                    borderWidth: 3,
                    tension: 0.4,
                    pointBackgroundColor: themeColor,
                    pointBorderColor: '#ffffff',
                    pointHoverRadius: 6,
                    yAxisID: 'yTemp',
                },
                {
                    label: 'UV Index',
                    data: state.forecastUV,
                    borderColor: '#eab308',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    backgroundColor: 'rgba(234, 179, 8, 0.05)',
                    fill: true,
                    tension: 0.3,
                    pointBackgroundColor: '#eab308',
                    pointHoverRadius: 5,
                    yAxisID: 'yUV',
                }
            ]
        };

        const config = {
            type: 'line',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false // We use our own custom legend inside header
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(15, 23, 42, 0.95)',
                        titleColor: '#ffffff',
                        bodyColor: '#e2e8f0',
                        borderColor: 'rgba(255,255,255,0.08)',
                        borderWidth: 1,
                        padding: 10,
                        bodyFont: { family: 'Inter' },
                        titleFont: { family: 'Outfit', weight: 'bold' }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.04)'
                        },
                        ticks: {
                            color: '#94a3b8',
                            font: { size: 10, family: 'Inter' }
                        }
                    },
                    yTemp: {
                        type: 'linear',
                        position: 'left',
                        grid: {
                            color: 'rgba(255, 255, 255, 0.04)'
                        },
                        ticks: {
                            color: themeColor,
                            font: { size: 11, family: 'Outfit', weight: '600' },
                            callback: function(value) {
                                return value + '°';
                            }
                        }
                    },
                    yUV: {
                        type: 'linear',
                        position: 'right',
                        min: 0,
                        max: 15,
                        grid: {
                            drawOnChartArea: false // prevent double grids
                        },
                        ticks: {
                            color: '#eab308',
                            font: { size: 10, family: 'Inter' }
                        }
                    }
                }
            }
        };

        if (state.chartInstance) {
            state.chartInstance.destroy();
        }
        
        state.chartInstance = new Chart(document.getElementById('forecastChart'), config);
    }

    // ==========================================================================
    // Interactive Handlers (Tabs, Profiles, Sliders)
    // ==========================================================================
    
    // Tab switching logic
    el.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            el.tabBtns.forEach(b => b.classList.remove('active'));
            el.tabContents.forEach(c => c.classList.add('hidden'));
            
            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            document.getElementById(tabId).classList.remove('hidden');
        });
    });

    // Profile chip selections
    el.profileChips.forEach(chip => {
        chip.addEventListener('click', () => {
            const profile = chip.getAttribute('data-profile');
            chip.classList.toggle('active');
            
            if (state.activeProfiles.has(profile)) {
                state.activeProfiles.delete(profile);
            } else {
                state.activeProfiles.add(profile);
            }
            
            const severity = getHeatSeverity(state.apparentTemp);
            renderPersonalizedSection(severity.level);
        });
    });

    // Toggle units C / F
    el.unitToggle.addEventListener('click', () => {
        state.tempUnit = state.tempUnit === 'C' ? 'F' : 'C';
        el.unitToggle.textContent = state.tempUnit === 'C' ? 'Celsius' : 'Fahrenheit';
        updateUI();
    });

    // Calculator updates
    function updateCalculator() {
        const t = parseInt(el.calcTemp.value);
        const h = parseInt(el.calcHumidity.value);

        el.calcTempVal.textContent = `${t}°C`;
        el.calcHumidityVal.textContent = `${h}%`;

        const resultC = calculateHeatIndex(t, h);
        const severity = getHeatSeverity(resultC);

        // Update result display
        el.calcResult.textContent = `${resultC}°C`;
        el.calcRiskBadge.textContent = severity.name;
        
        // Remove old risk classes and apply new
        el.calcRiskBadge.className = 'badge result-badge';
        if (severity.level === 'safe') el.calcRiskBadge.style.borderColor = 'var(--color-safe)';
        if (severity.level === 'caution') el.calcRiskBadge.style.borderColor = 'var(--color-caution)';
        if (severity.level === 'extreme-caution' || severity.level === 'danger') el.calcRiskBadge.style.borderColor = 'var(--color-danger)';
        if (severity.level === 'extreme-danger') el.calcRiskBadge.style.borderColor = 'var(--color-extreme)';
    }

    el.calcTemp.addEventListener('input', updateCalculator);
    el.calcHumidity.addEventListener('input', updateCalculator);

    // Weather Simulation Presets
    el.simBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            el.simBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const temp = parseFloat(btn.getAttribute('data-temp'));
            const humidity = parseInt(btn.getAttribute('data-humidity'));
            const uv = parseInt(btn.getAttribute('data-uv'));
            const name = btn.getAttribute('data-name');

            state.isSimulation = true;
            state.temperature = temp;
            state.humidity = humidity;
            state.uvIndex = uv;
            state.locationName = `${name} (Simulation)`;
            state.lastUpdated = new Date();
            
            // Empty forecast to force regeneration
            state.forecastHours = [];
            state.forecastTemps = [];
            state.forecastUV = [];

            updateUI();
        });
    });

    // Custom Simulation controls
    el.simTempInput.addEventListener('input', () => {
        el.simTempVal.textContent = el.simTempInput.value;
    });
    
    el.simHumidityInput.addEventListener('input', () => {
        el.simHumidityVal.textContent = el.simHumidityInput.value;
    });

    el.applyCustomSim.addEventListener('click', () => {
        const temp = parseFloat(el.simTempInput.value);
        const humidity = parseInt(el.simHumidityInput.value);
        
        // Remove active preset buttons highlight
        el.simBtns.forEach(b => b.classList.remove('active'));
        
        state.isSimulation = true;
        state.temperature = temp;
        state.humidity = humidity;
        state.uvIndex = temp > 40 ? 11 : (temp > 30 ? 7 : 4);
        state.locationName = "Custom Simulation Space";
        state.lastUpdated = new Date();
        
        state.forecastHours = [];
        state.forecastTemps = [];
        state.forecastUV = [];

        updateUI();
    });

    // Modals event listeners
    el.scienceAboutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        el.scienceModal.classList.remove('hidden');
    });

    el.emergencyContactsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        el.emergencyModal.classList.remove('hidden');
    });

    el.closeScienceBtn.addEventListener('click', () => el.scienceModal.classList.add('hidden'));
    el.closeEmergencyBtn.addEventListener('click', () => el.emergencyModal.classList.add('hidden'));

    window.addEventListener('click', (e) => {
        if (e.target === el.scienceModal) el.scienceModal.classList.add('hidden');
        if (e.target === el.emergencyModal) el.emergencyModal.classList.add('hidden');
    });

    // ==========================================================================
    // Real Weather API & Geolocation (Open-Meteo Integration)
    // ==========================================================================

    /**
     * Fetches current weather and hourly forecasts for a given coordinate
     */
    async function fetchWeather(lat, lon, cityName) {
        try {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,uv_index&hourly=temperature_2m,apparent_temperature,uv_index&timezone=auto&forecast_days=1`;
            
            const response = await fetch(url);
            if (!response.ok) throw new Error("Weather request failed");
            
            const data = await response.json();
            
            // Map API response to state
            state.temperature = data.current.temperature_2m;
            state.humidity = data.current.relative_humidity_2m;
            state.apparentTemp = data.current.apparent_temperature;
            state.uvIndex = Math.round(data.current.uv_index);
            state.windSpeed = Math.round(data.current.wind_speed_10m);
            state.locationName = cityName;
            state.lastUpdated = new Date();
            state.isSimulation = false;

            // Map hourly charts
            state.forecastHours = [];
            state.forecastTemps = [];
            state.forecastUV = [];

            const now = new Date();
            const startHour = now.getHours();
            
            for (let i = 0; i < 8; i++) {
                const idx = (startHour + i * 3) % 24;
                const timeStr = data.hourly.time[idx];
                const dateObj = new Date(timeStr);
                const hourNum = dateObj.getHours();
                const ampm = hourNum >= 12 ? 'PM' : 'AM';
                const formattedHour = `${hourNum % 12 || 12} ${ampm}`;

                state.forecastHours.push(formattedHour);
                state.forecastTemps.push(Math.round(data.hourly.apparent_temperature[idx]));
                state.forecastUV.push(Math.round(data.hourly.uv_index[idx]));
            }

            // Remove active states on preset simulation buttons
            el.simBtns.forEach(b => b.classList.remove('active'));

            updateUI();
        } catch (error) {
            console.error("Error retrieving weather data:", error);
            alert(`Unable to fetch real weather data for ${cityName}. Falling back to simulator mode.`);
        }
    }

    /**
     * Search geocoding database for queries
     */
    async function searchCity(query) {
        if (!query || query.length < 2) return;
        try {
            const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
            const response = await fetch(url);
            if (!response.ok) throw new Error("Geocoding failed");
            const data = await response.json();
            
            if (data.results && data.results.length > 0) {
                renderSuggestions(data.results);
            } else {
                el.searchSuggestions.innerHTML = `<div class="suggestion-item">No results found</div>`;
                el.searchSuggestions.classList.remove('hidden');
            }
        } catch (err) {
            console.error(err);
        }
    }

    function renderSuggestions(results) {
        el.searchSuggestions.innerHTML = '';
        results.forEach(res => {
            const name = res.name;
            const region = res.admin1 ? `, ${res.admin1}` : '';
            const country = res.country;
            const fullName = `${name}${region}, ${country}`;

            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.innerHTML = `
                <span>${name}${region}</span>
                <span class="suggestion-country">${country}</span>
            `;
            
            item.addEventListener('click', () => {
                el.cityInput.value = fullName;
                el.searchSuggestions.classList.add('hidden');
                fetchWeather(res.latitude, res.longitude, fullName);
            });

            el.searchSuggestions.appendChild(item);
        });
        el.searchSuggestions.classList.remove('hidden');
    }

    // Geocoding search keyboard typing debounce
    let debounceTimer;
    el.cityInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        const query = el.cityInput.value.trim();
        if (query.length >= 2) {
            debounceTimer = setTimeout(() => searchCity(query), 300);
        } else {
            el.searchSuggestions.classList.add('hidden');
        }
    });

    // Hide search suggestions on click away
    document.addEventListener('click', (e) => {
        if (!el.searchForm.contains(e.target) && !el.searchSuggestions.contains(e.target)) {
            el.searchSuggestions.classList.add('hidden');
        }
    });

    // Form submission triggers weather lookup for the top geocoding suggestion
    el.searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const query = el.cityInput.value.trim();
        if (!query) return;

        try {
            const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.results && data.results.length > 0) {
                const res = data.results[0];
                const fullName = `${res.name}${res.admin1 ? `, ${res.admin1}` : ''}, ${res.country}`;
                el.cityInput.value = fullName;
                el.searchSuggestions.classList.add('hidden');
                fetchWeather(res.latitude, res.longitude, fullName);
            } else {
                alert("Location not found. Try spelling out the city name.");
            }
        } catch (err) {
            console.error("Geocoding failed on submit:", err);
        }
    });

    // Locate user using browser location
    el.locateBtn.addEventListener('click', () => {
        if (!navigator.geolocation) {
            alert("Geolocation is not supported by your browser.");
            return;
        }

        el.locateBtn.innerHTML = `<i data-lucide="loader" class="icon-pulse"></i>`;
        lucide.createIcons();

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                
                // Fetch location name using reverse geocoding or just coordinate label
                const cityName = `Your Location (${lat.toFixed(2)}, ${lon.toFixed(2)})`;
                
                await fetchWeather(lat, lon, cityName);
                
                el.locateBtn.innerHTML = `<i data-lucide="map-pin"></i>`;
                lucide.createIcons();
            },
            (error) => {
                console.error("Geolocation error:", error);
                alert("Unable to retrieve location. Please search manually.");
                el.locateBtn.innerHTML = `<i data-lucide="map-pin"></i>`;
                lucide.createIcons();
            }
        );
    });

    // ==========================================================================
    // Initialization
    // ==========================================================================
    
    // Set simulator default preset on start (Tropical Sultry)
    document.querySelector('.sim-btn[data-class="heat-caution"]').click();
    
    // Initialize calculator
    updateCalculator();
});

let map, marker;
let aqiCircles = [];
let isFirstLoad = true; 
let lastValidData = null; 
let sensorCharts = {}; 

function initMap() {
    if (map) map.remove();
    map = L.map('map', {
        closePopupOnClick: false, 
        autoClose: false 
    }).setView([16.05, 108.2], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    map.on('popupopen', function (e) {
        e.popup.options.autoClose = false;
        e.popup.options.closeOnClick = false;
        adjustPopupSize(e.popup);
    });

    map.on('zoomend', function () {
        aqiCircles.forEach(circle => {
            if (circle.isPopupOpen()) {
                adjustPopupSize(circle.getPopup());
            }
        });
    });
}

function adjustPopupSize(popup) {
    const zoom = map.getZoom();
    let fontSize = 10; 
    let padding = 1; // Padding 

    if (zoom < 12) {
        fontSize = 7;
        padding = 1;
    } else if (zoom < 14) {
        fontSize = 7;
        padding = 1;
    }

    const content = popup.getContent();
    popup.setContent(`<div style="font-size: ${fontSize}px; padding: ${padding}px;">${content}</div>`);
    popup.update(); // update popup 
}

function showDetailModal(circle) {
    const sensorData = circle.sensorData; 

    let modal = document.getElementById('detailModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'detailModal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="modal-content">
            <span class="close-btn">×</span>
            <h2>Chi tiết thông số không khí</h2>
            <div class="sensor-details">
                <div class="sensor-detail"><span>AQI:</span><span>${sensorData.aqi}</span></div>
                <div class="sensor-detail"><span>Nhiệt độ:</span><span>${sensorData.temperature.toFixed(1)} °C</span></div>
                <div class="sensor-detail"><span>Độ ẩm:</span><span>${sensorData.humidity.toFixed(1)} %</span></div>
                <div class="sensor-detail"><span>NO2:</span><span>${sensorData.no2} µg/m³</span></div>
                <div class="sensor-detail"><span>SO2:</span><span>${sensorData.so2} µg/m³</span></div>
                <div class="sensor-detail"><span>PM10:</span><span>${sensorData.pm10} µg/m³</span></div>
                <div class="sensor-detail"><span>PM2.5:</span><span>${sensorData.pm25} µg/m³</span></div>
                <div class="sensor-detail"><span>CO:</span><span>${sensorData.co} µg/m³</span></div>
                <div class="sensor-detail"><span>UV:</span><span>${sensorData.uv} mW/cm²</span></div>
            </div>
        </div>
    `;

    modal.style.display = 'flex'; 

    const closeBtn = modal.querySelector('.close-btn');
    closeBtn.onclick = () => {
        modal.style.display = 'none';
    };

    // close modal 
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    };
}


const VN_AQI_BREAKPOINTS = {
    pm25: [ { Cp_lo: 0, Cp_hi: 30, I_lo: 0, I_hi: 50 }, { Cp_lo: 31, Cp_hi: 60, I_lo: 51, I_hi: 100 }, { Cp_lo: 61, Cp_hi: 90, I_lo: 101, I_hi: 150 }, { Cp_lo: 91, Cp_hi: 120, I_lo: 151, I_hi: 200 }, { Cp_lo: 121, Cp_hi: 250, I_lo: 201, I_hi: 300 }, { Cp_lo: 251, Cp_hi: 500, I_lo: 301, I_hi: 500 } ],
    pm10: [ { Cp_lo: 0, Cp_hi: 50, I_lo: 0, I_hi: 50 }, { Cp_lo: 51, Cp_hi: 100, I_lo: 51, I_hi: 100 }, { Cp_lo: 101, Cp_hi: 250, I_lo: 101, I_hi: 150 }, { Cp_lo: 251, Cp_hi: 350, I_lo: 151, I_hi: 200 }, { Cp_lo: 351, Cp_hi: 430, I_lo: 201, I_hi: 300 }, { Cp_lo: 431, Cp_hi: 600, I_lo: 301, I_hi: 500 } ],
    co: [ { Cp_lo: 0, Cp_hi: 5, I_lo: 0, I_hi: 50 }, { Cp_lo: 6, Cp_hi: 10, I_lo: 51, I_hi: 100 }, { Cp_lo: 11, Cp_hi: 17, I_lo: 101, I_hi: 150 }, { Cp_lo: 18, Cp_hi: 34, I_lo: 151, I_hi: 200 }, { Cp_lo: 35, Cp_hi: 46, I_lo: 201, I_hi: 300 }, { Cp_lo: 47, Cp_hi: 60, I_lo: 301, I_hi: 500 } ],
    so2: [ { Cp_lo: 0, Cp_hi: 50, I_lo: 0, I_hi: 50 }, { Cp_lo: 51, Cp_hi: 100, I_lo: 51, I_hi: 100 }, { Cp_lo: 101, Cp_hi: 199, I_lo: 101, I_hi: 150 }, { Cp_lo: 200, Cp_hi: 349, I_lo: 151, I_hi: 200 }, { Cp_lo: 350, Cp_hi: 439, I_lo: 201, I_hi: 300 }, { Cp_lo: 440, Cp_hi: 600, I_lo: 301, I_hi: 500 } ],
    no2: [ { Cp_lo: 0, Cp_hi: 100, I_lo: 0, I_hi: 50 }, { Cp_lo: 101, Cp_hi: 200, I_lo: 51, I_hi: 100 }, { Cp_lo: 201, Cp_hi: 300, I_lo: 101, I_hi: 150 }, { Cp_lo: 301, Cp_hi: 400, I_lo: 151, I_hi: 200 }, { Cp_lo: 401, Cp_hi: 500, I_lo: 201, I_hi: 300 }, { Cp_lo: 501, Cp_hi: 600, I_lo: 301, I_hi: 500 } ]
};

function calculateIndividualAQI(value, pollutant) {
    const bps = VN_AQI_BREAKPOINTS[pollutant];
    for (const bp of bps) {
        if (value >= bp.Cp_lo && value <= bp.Cp_hi) {
            return Math.round(((bp.I_hi - bp.I_lo) / (bp.Cp_hi - bp.Cp_lo)) * (value - bp.Cp_lo) + bp.I_lo);
        }
    }
    return -1;
}

function calculateAQIFromSensors(obj) {
    const aqiValues = {
        pm25: calculateIndividualAQI(obj.pm25, "pm25"),
        pm10: calculateIndividualAQI(obj.pm10, "pm10"),
        co: calculateIndividualAQI(obj.co, "co"),
        so2: calculateIndividualAQI(obj.so2, "so2"),
        no2: calculateIndividualAQI(obj.no2, "no2"),
    };
    const maxAQI = Math.max(...Object.values(aqiValues).filter(v => v !== -1)); 
    return { aqi: maxAQI !== -Infinity ? maxAQI : 0, level: getAQILevel(maxAQI !== -Infinity ? maxAQI : 0) };
}

function getAQILevel(aqi) {
    if (aqi <= 50) return "good";
    if (aqi <= 100) return "moderate";
    if (aqi <= 150) return "poor";
    if (aqi <= 200) return "unhealthy";
    if (aqi <= 300) return "severe";
    return "hazardous";
}

function getAQIColor(level) {
    switch (level) {
        case 'good': return '#00e400';
        case 'moderate': return '#ffff00';
        case 'poor': return '#ff7e00';
        case 'unhealthy': return '#ff0000';
        case 'severe': return '#99004c';
        case 'hazardous': return '#7e0023';
        default: return '#000000';
    }
}


function aggregateSensorData(data) {
    const now = new Date();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const timeSlots = Array(12).fill().map((_, i) => {
        const slotTime = new Date(now);
        slotTime.setHours(i * 2, 0, 0, 0); // 0h, 3h, 6h, 9h, 12h, 15h, 18h, 21h
        if (slotTime > now) {
            slotTime.setDate(slotTime.getDate() - 1);
        }
        return slotTime;
    });

    const aggregatedData = timeSlots.map(() => ({
        aqi: [],
        temperature: [],
        humidity: [],
        no2: [],
        so2: [],
        pm10: [],
        pm25: [],
        co: [],
        uv: []
    }));

    const filteredData = data.filter(item => {
        if (!item.time || !item.object) return false;
        const itemDate = new Date(item.time);
        return itemDate >= oneDayAgo && itemDate <= now;
    });

    if (filteredData.length === 0) {
        return timeSlots.map(slot => ({
            time: slot.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
            aqi: 0,
            temperature: 0,
            humidity: 0,
            no2: 0,
            so2: 0,
            pm10: 0,
            pm25: 0,
            co: 0,
            uv: 0
        }));
    }

    filteredData.forEach(item => {
        const obj = item.object;
        const itemDate = new Date(item.time);
        const hour = itemDate.getHours();
        const slotIndex = Math.floor(hour / 2);
        if (slotIndex < 12) {
            const slotData = aggregatedData[slotIndex];
            const aqiData = calculateAQIFromSensors(obj);
            slotData.aqi.push(aqiData.aqi);
            slotData.temperature.push(obj.temperature);
            slotData.humidity.push(obj.humidity);
            slotData.no2.push(obj.no2);
            slotData.so2.push(obj.so2);
            slotData.pm10.push(obj.pm10);
            slotData.pm25.push(obj.pm25);
            slotData.co.push(obj.co);
            slotData.uv.push(obj.uv);
        }
    });

    return aggregatedData.map((slot, index) => {
        const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
        return {
            time: timeSlots[index].toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
            aqi: avg(slot.aqi).toFixed(1),
            temperature: avg(slot.temperature).toFixed(1),
            humidity: avg(slot.humidity).toFixed(1),
            no2: avg(slot.no2).toFixed(1),
            so2: avg(slot.so2).toFixed(1),
            pm10: avg(slot.pm10).toFixed(1),
            pm25: avg(slot.pm25).toFixed(1),
            co: avg(slot.co).toFixed(1),
            uv: avg(slot.uv).toFixed(1)
        };
    });
}

function renderSensorChart(data) {
    const ctxAQI = document.getElementById('chartAQI')?.getContext('2d');
    const ctxTemperature = document.getElementById('chartTemperature')?.getContext('2d');
    const ctxHumidity = document.getElementById('chartHumidity')?.getContext('2d');
    const ctxNO2 = document.getElementById('chartNO2')?.getContext('2d');
    const ctxSO2 = document.getElementById('chartSO2')?.getContext('2d');
    const ctxPM10 = document.getElementById('chartPM10')?.getContext('2d');
    const ctxPM25 = document.getElementById('chartPM25')?.getContext('2d');
    const ctxCO = document.getElementById('chartCO')?.getContext('2d');
    const ctxUV = document.getElementById('chartUV')?.getContext('2d');

    const aggregatedData = aggregateSensorData(data);
    console.log("Dữ liệu tổng hợp cho biểu đồ:", aggregatedData);

    const allZero = aggregatedData.every(d => 
        d.aqi === 0 && d.temperature === 0 && d.humidity === 0 && d.no2 === 0 && 
        d.so2 === 0 && d.pm10 === 0 && d.pm25 === 0 && d.co === 0 && d.uv === 0
    );

    Object.values(sensorCharts).forEach(chart => chart?.destroy());

    // Render từng biểu đồ
    if (ctxAQI) {
        sensorCharts['AQI'] = new Chart(ctxAQI, {
            type: 'line',
            data: {
                labels: aggregatedData.map(d => d.time),
                datasets: [{
                    label: 'AQI (µg/m³)',
                    data: aggregatedData.map(d => d.aqi),
                    borderColor: '#36a2eb',
                    fill: false,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'Giá trị' } },
                    x: { title: { display: true, text: 'Thời gian' } }
                },
                plugins: { legend: { position: 'top' }, tooltip: { mode: 'index', intersect: false } },
                hover: { mode: 'nearest', intersect: true }
            }
        });
    }

    if (ctxTemperature) {
        sensorCharts['Temperature'] = new Chart(ctxTemperature, {
            type: 'line',
            data: {
                labels: aggregatedData.map(d => d.time),
                datasets: [{
                    label: 'Nhiệt độ (°C)',
                    data: aggregatedData.map(d => d.temperature),
                    borderColor: '#36a2eb',
                    fill: false,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'Giá trị' } },
                    x: { title: { display: true, text: 'Thời gian' } }
                },
                plugins: { legend: { position: 'top' }, tooltip: { mode: 'index', intersect: false } },
                hover: { mode: 'nearest', intersect: true }
            }
        });
    }

    if (ctxHumidity) {
        sensorCharts['Humidity'] = new Chart(ctxHumidity, {
            type: 'line',
            data: {
                labels: aggregatedData.map(d => d.time),
                datasets: [{
                    label: 'Độ ẩm (%)',
                    data: aggregatedData.map(d => d.humidity),
                    borderColor: '#36a2eb',
                    fill: false,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'Giá trị' } },
                    x: { title: { display: true, text: 'Thời gian' } }
                },
                plugins: { legend: { position: 'top' }, tooltip: { mode: 'index', intersect: false } },
                hover: { mode: 'nearest', intersect: true }
            }
        });
    }

    if (ctxNO2) {
        sensorCharts['NO2'] = new Chart(ctxNO2, {
            type: 'line',
            data: {
                labels: aggregatedData.map(d => d.time),
                datasets: [{
                    label: 'NO2 (µg/m³)',
                    data: aggregatedData.map(d => d.no2),
                    borderColor: '#36a2eb',
                    fill: false,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'Giá trị' } },
                    x: { title: { display: true, text: 'Thời gian' } }
                },
                plugins: { legend: { position: 'top' }, tooltip: { mode: 'index', intersect: false } },
                hover: { mode: 'nearest', intersect: true }
            }
        });
    }

    if (ctxSO2) {
        sensorCharts['SO2'] = new Chart(ctxSO2, {
            type: 'line',
            data: {
                labels: aggregatedData.map(d => d.time),
                datasets: [{
                    label: 'SO2 (µg/m³)',
                    data: aggregatedData.map(d => d.so2),
                    borderColor: '#36a2eb',
                    fill: false,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'Giá trị' } },
                    x: { title: { display: true, text: 'Thời gian' } }
                },
                plugins: { legend: { position: 'top' }, tooltip: { mode: 'index', intersect: false } },
                hover: { mode: 'nearest', intersect: true }
            }
        });
    }

    if (ctxPM10) {
        sensorCharts['PM10'] = new Chart(ctxPM10, {
            type: 'line',
            data: {
                labels: aggregatedData.map(d => d.time),
                datasets: [{
                    label: 'PM10 (µg/m³)',
                    data: aggregatedData.map(d => d.pm10),
                    borderColor: '#36a2eb',
                    fill: false,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'Giá trị' } },
                    x: { title: { display: true, text: 'Thời gian' } }
                },
                plugins: { legend: { position: 'top' }, tooltip: { mode: 'index', intersect: false } },
                hover: { mode: 'nearest', intersect: true }
            }
        });
    }

    if (ctxPM25) {
        sensorCharts['PM25'] = new Chart(ctxPM25, {
            type: 'line',
            data: {
                labels: aggregatedData.map(d => d.time),
                datasets: [{
                    label: 'PM2.5 (µg/m³)',
                    data: aggregatedData.map(d => d.pm25),
                    borderColor: '#36a2eb',
                    fill: false,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'Giá trị' } },
                    x: { title: { display: true, text: 'Thời gian' } }
                },
                plugins: { legend: { position: 'top' }, tooltip: { mode: 'index', intersect: false } },
                hover: { mode: 'nearest', intersect: true }
            }
        });
    }

    if (ctxCO) {
        sensorCharts['CO'] = new Chart(ctxCO, {
            type: 'line',
            data: {
                labels: aggregatedData.map(d => d.time),
                datasets: [{
                    label: 'CO (µg/m³)',
                    data: aggregatedData.map(d => d.co),
                    borderColor: '#36a2eb',
                    fill: false,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'Giá trị' } },
                    x: { title: { display: true, text: 'Thời gian' } }
                },
                plugins: { legend: { position: 'top' }, tooltip: { mode: 'index', intersect: false } },
                hover: { mode: 'nearest', intersect: true }
            }
        });
    }

    if (ctxUV) {
        sensorCharts['UV'] = new Chart(ctxUV, {
            type: 'line',
            data: {
                labels: aggregatedData.map(d => d.time),
                datasets: [{
                    label: 'UV (mW/cm²)',
                    data: aggregatedData.map(d => d.uv),
                    borderColor: '#36a2eb',
                    fill: false,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'Giá trị' } },
                    x: { title: { display: true, text: 'Thời gian' } }
                },
                plugins: { legend: { position: 'top' }, tooltip: { mode: 'index', intersect: false } },
                hover: { mode: 'nearest', intersect: true }
            }
        });
    }

    if (allZero) {
        Object.keys(sensorCharts).forEach(key => {
            const ctx = document.getElementById(`chart${key}`).getContext('2d');
            ctx.canvas.parentNode.innerHTML = '<p style="text-align: center; color: #2c3e50;">Hệ thống tắt, không có dữ liệu. Giá trị mặc định là 0.</p>';
        });
    }
}


function fetchData() {
    fetch('/api/data')
        .then(res => {
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            return res.json();
        })
        .then(data => {
            console.log("Dữ liệu thô từ API:", data);
            if (!data || !Array.isArray(data) || data.length === 0) {
                console.error("Không có dữ liệu hoặc dữ liệu không hợp lệ");
                if (lastValidData) {
                    renderMapFromData(lastValidData);
                }
                return;
            }

            const now = new Date();
            const oneDayAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
            const filteredData = data
                .filter(item => {
                    if (!item.time || !item.object) return false;
                    const itemDate = new Date(item.time);
                    return itemDate >= oneDayAgo && itemDate <= now;
                })
                .sort((a, b) => new Date(b.time) - new Date(a.time));
            console.log("Dữ liệu đã lọc:", filteredData);

            if (filteredData.length === 0) {
                console.warn("Không có dữ liệu trong 30 ngày qua");
                if (lastValidData) {
                    renderMapFromData(lastValidData);
                }
                return;
            }

            const latestItem = filteredData[0];
            const obj = latestItem.object;
            if (!obj) {
                console.warn("Dữ liệu thiếu object");
                if (lastValidData) {
                    renderMapFromData(lastValidData);
                }
                return;
            }

            let gpsError = (obj.latitude === 0.0 && obj.longitude === 0.0);
            if (gpsError) {
                console.warn("Dữ liệu GPS lỗi (0.0, 0.0), b");
                let warningDiv = document.getElementById('gps-warning');
                if (!warningDiv) {
                    warningDiv = document.createElement('div');
                    warningDiv.id = 'gps-warning';
                    warningDiv.style.position = 'absolute';
                    warningDiv.style.top = '60px';
                    warningDiv.style.left = '50%';
                    warningDiv.style.transform = 'translateX(-50%)';
                    warningDiv.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
                    warningDiv.style.color = '#fff';
                    warningDiv.style.padding = '10px';
                    warningDiv.style.borderRadius = '5px';
                    warningDiv.style.zIndex = '1000';
                    warningDiv.textContent = 'Lỗi không thể xác định được vị trí trạm quan trắc';
                    document.getElementById('map').parentElement.appendChild(warningDiv);
                }
            } else {
                const warningDiv = document.getElementById('gps-warning');
                if (warningDiv) {
                    warningDiv.remove();
                }
            }

            if (!gpsError && obj.latitude >= -90 && obj.latitude <= 90 && obj.longitude >= -180 && obj.longitude <= 180) {
                lastValidData = filteredData;
            }

            const openPopups = new Map();
            aqiCircles.forEach(circle => {
                if (circle.isPopupOpen()) {
                    const latlng = circle.getLatLng();
                    openPopups.set(latlng.toString(), true);
                }
            });

            const dataToRender = gpsError && lastValidData ? lastValidData : filteredData;
            renderMapFromData(dataToRender, openPopups);

            const aqiData = calculateAQIFromSensors(obj);
            document.getElementById("temperature").textContent = obj.temperature.toFixed(1) + " °C";
            document.getElementById("humidity").textContent = obj.humidity.toFixed(1) + " %";
            document.getElementById("no2").textContent = obj.no2 + " µg/m³";
            document.getElementById("so2").textContent = obj.so2 + " µg/m³";
            document.getElementById("pm10").textContent = obj.pm10 + " µg/m³";
            document.getElementById("pm25").textContent = obj.pm25 + " µg/m³";
            document.getElementById("co").textContent = obj.co + " µg/m³";
            document.getElementById("uv").textContent = obj.uv + " mW/cm³";
            document.getElementById("aqi").textContent = aqiData.aqi;

            const aqiIndicator = document.getElementById("aqiIndicator");
            const barWidth = document.querySelector(".aqi-bar").offsetWidth;
            const position = (aqiData.aqi / 500) * barWidth;
            aqiIndicator.style.left = `${position}px`;
            aqiIndicator.dataset.level = aqiData.level;

            if (document.getElementById('Chart').style.display === 'block') {
                console.log("Dữ liệu cho biểu đồ:", filteredData);
                renderSensorChart(filteredData);
            }
        })
        .catch(err => {
            console.error("Lỗi lấy dữ liệu:", err);
            if (lastValidData) {
                renderMapFromData(lastValidData);
            }
        });
}

function renderMapFromData(data, openPopups = new Map()) {
    const uniqueLocations = [];
    const distanceThreshold = 100; 

    data.forEach(item => {
        const obj = item.object;
        if (!obj || !obj.latitude || !obj.longitude) {
            return; 
        }

        const lat = obj.latitude;
        const lng = obj.longitude;
        const latlng = L.latLng(lat, lng);

        let isDuplicate = false;
        for (let i = 0; i < uniqueLocations.length; i++) {
            const existingItem = uniqueLocations[i];
            const existingLatLng = L.latLng(existingItem.object.latitude, existingItem.object.longitude);
            const distance = latlng.distanceTo(existingLatLng);

            if (distance < distanceThreshold) {
                isDuplicate = true;
                if (new Date(item.time) > new Date(existingItem.time)) {
                    uniqueLocations[i] = item;
                }
                break;
            }
        }

        if (!isDuplicate) {
            uniqueLocations.push(item);
        }
    });

    const existingCircles = new Map();
    aqiCircles.forEach(circle => {
        const latlng = circle.getLatLng();
        existingCircles.set(latlng.toString(), circle);
    });

    const newCircles = [];
    uniqueLocations.forEach(item => {
        const obj = item.object;
        const lat = obj.latitude;
        const lng = obj.longitude;
        const latlng = L.latLng(lat, lng);
        const aqiData = calculateAQIFromSensors(obj);
        const aqiColor = getAQIColor(aqiData.level);
        const latlngKey = latlng.toString();

        const sensorData = {
            aqi: aqiData.aqi,
            temperature: obj.temperature,
            humidity: obj.humidity,
            no2: obj.no2,
            so2: obj.so2,
            pm10: obj.pm10,
            pm25: obj.pm25,
            co: obj.co,
            uv: obj.uv
        };

        let circle = existingCircles.get(latlngKey);
        if (circle) {
            circle.setStyle({ fillColor: aqiColor });
            const popupContent = `
                <div>
                    AQI: ${aqiData.aqi}<br>
                    <button class="detail-btn">Chi tiết</button>
                </div>
            `;
            circle.getPopup().setContent(popupContent);
            circle.sensorData = sensorData;
            newCircles.push(circle);
        } else {
            // Tạo vòng tròn mới
            circle = L.circle(latlng, {
                stroke: false,
                fillColor: aqiColor,
                fillOpacity: 0.6,
                radius: 60
            }).addTo(map);
            const popupContent = `
                <div>
                    AQI: ${aqiData.aqi}<br>
                    <button class="detail-btn">Chi tiết</button>
                </div>
            `;
            circle.bindPopup(popupContent, { autoClose: false, closeOnClick: false, autoPan: false });
            circle.on('click', function (e) {
                this.openPopup();
            });
            circle.sensorData = sensorData;
            newCircles.push(circle);
        }

        const popup = circle.getPopup();
        popup.on('contentupdate', function () {
            const detailBtn = popup.getElement().querySelector('.detail-btn');
            if (detailBtn) {
                detailBtn.onclick = (e) => {
                    e.stopPropagation();
                    showDetailModal(circle);
                };
            }
        });

        if (openPopups.has(latlngKey)) {
            circle.openPopup();
        }
    });

    aqiCircles.forEach(circle => {
        if (!newCircles.includes(circle)) {
            map.removeLayer(circle);
        }
    });
    aqiCircles = newCircles;

    const latestItem = data[0];
    const obj = latestItem.object;
    if (obj.latitude !== 0.0 || obj.longitude !== 0.0) {
        if (!marker) {
            marker = L.marker([obj.latitude, obj.longitude]).addTo(map).bindPopup("Trạm quan trắc", { autoClose: false, closeOnClick: false });
            marker.openPopup();
        } else {
            marker.setLatLng([obj.latitude, obj.longitude]);
            marker.openPopup();
        }

        if (isFirstLoad) {
            map.setView([obj.latitude, obj.longitude], 15);
            isFirstLoad = false;
        }
    }
}


function zoomToDistrict(coords) {
    if (map) map.setView(coords, 14);
}

function openTab(evt, tabName) {
    const tabcontent = document.getElementsByClassName("tabcontent");
    for (let i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }

    const tablinks = document.getElementsByClassName("tablink");
    for (let i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }

    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.className += " active";

    if (tabName === 'Home') {
        if (!map) {
            initMap();
        } else {
            map.invalidateSize();
        }
        fetchData();
    } else if (tabName === 'Chart') {
        fetchData();
    }
}

document.addEventListener('DOMContentLoaded', function () {
    document.querySelector('.tablink').click();
    setInterval(fetchData, 5000);
});

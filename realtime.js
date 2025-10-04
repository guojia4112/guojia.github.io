// 只获取这两个站点的最新一小时 NO2/O3 数据
const targetSites = ["Sham Shui Po", "Mong Kok"];

// 清理自动点
function clearAutoPoints() {
    if (window.userPoints) {
        window.userPoints = window.userPoints.filter(p => !p.auto);
    }
}

// 添加点到主图
function addRealtimePoint(x, y, site) {
    if (window.userPoints && typeof window.loadAndDrawCurves === 'function') {
        window.userPoints.push({x: x, y: y, site: site, auto: true});
        window.loadAndDrawCurves();
    }
}

// 主函数：读取本地 past_24_pollutant.js 数据
function fetchLatestNO2O3Local() {
    clearAutoPoints();

    // 确认 station_24_data 已加载（由 <script src="data/past_24_pollutant.js"> 加载）
    if (window.station_24_data) {
        for (let stationData of station_24_data) {
            const latest = stationData[0]; // 最新一小时数据
            if (!latest || !latest.StationNameEN) continue;
            if (targetSites.includes(latest.StationNameEN)) {
                const no2 = parseFloat(latest.NO2);
                const o3  = parseFloat(latest.O3);
                if (!isNaN(no2) && !isNaN(o3)) {
                    addRealtimePoint(no2, o3, latest.StationNameEN);
                }
            }
        }
    } else {
        console.log("station_24_data not loaded! 请确保已在 index.html 先加载数据文件。");
    }
}

// 页面加载后自动运行
fetchLatestNO2O3Local();

// 如需定时刷新，则可加：
// setInterval(fetchLatestNO2O3Local, 10 * 60 * 1000);

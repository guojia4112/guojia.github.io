// 定义你要获取的站点英文名
const targetSites = ["Sham Shui Po", "Mong Kok"];

// 加点到主图的函数（假定你已在 index.html 定义了 userPoints 和 loadAndDrawCurves）
function addRealtimePoint(x, y, site) {
    if (window.userPoints && typeof window.loadAndDrawCurves === 'function') {
        window.userPoints.push({x: x, y: y, site: site});
        window.loadAndDrawCurves();
    }
}

// 动态加载数据JS
function fetchLatestNO2O3() {
    // 先清除之前自动添加的点（只保留手动输入的点）
    if (window.userPoints) {
        window.userPoints = window.userPoints.filter(p => !p.auto); // 只保留没有auto属性的点
    }
    // 加载并处理数据
    var script = document.createElement('script');
    script.src = 'https://www.aqhi.gov.hk/js/data/past_24_pollutant.js';
    script.onload = function() {
        // station_24_data 是 global变量，结构如 [[{},{}...], ...]
        if (window.station_24_data) {
            for (let stationData of station_24_data) {
                // 每个 stationData 是一个站点的数组
                const latest = stationData[0]; // 第一个是最新一小时
                if (!latest || !latest.StationNameEN) continue;
                if (targetSites.includes(latest.StationNameEN)) {
                    const no2 = parseFloat(latest.NO2);
                    const o3  = parseFloat(latest.O3);
                    if (!isNaN(no2) && !isNaN(o3)) {
                        // 标记自动点，方便后续清理
                        window.userPoints.push({x: no2, y: o3, site: latest.StationNameEN, auto: true});
                    }
                }
            }
            window.loadAndDrawCurves();
        } else {
            console.log("station_24_data not defined!");
        }
    };
    document.head.appendChild(script);
}

// 页面加载时自动获取一次
fetchLatestNO2O3();

// 如果你要定时刷新实时数据，可取消注释下面一行：
// setInterval(fetchLatestNO2O3, 10 * 60 * 1000); // 每10分钟自动刷新
// 站点序号定义
const targetStations = ["66", "81"]; // 66: Sham Shui Po, 81: Mong Kok

// 获取当前时间最近的整点（与数据文件格式保持一致，精确到小时）
function getCurrentHourString() {
    const now = new Date();
    now.setMinutes(0, 0, 0); // 舍去分钟和秒
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:00:00`;
}

// 在T-EKMA主图上添加点的函数（假设你已有userPoints和loadAndDrawCurves）
function addRealtimePoint(x, y, site, time) {
    // 调试输出：可在Console面板看到实际提取的点
    console.log(`自动点：站点=${site}, 时间=${time}, NO2=${x}, O3=${y}`);
    if (window.userPoints && typeof window.loadAndDrawCurves === 'function') {
        window.userPoints.push({x: x, y: y, site: site, time: time, auto: true});
        window.loadAndDrawCurves();
    }
}

// 主函数：提取66和81号站点最近小时的数据
function fetchLatestNO2O3_TEKMA() {
    if (!window.station_24_data) {
        console.error("station_24_data not loaded!");
        return;
    }
    // 获取当前整点时间字符串
    const targetTime = getCurrentHourString();

    // 遍历所有站点
    for (const siteDataArr of station_24_data) {
        // 只处理目标站点
        if (siteDataArr.length === 0 || !targetStations.includes(siteDataArr[0].StationID)) continue;

        // 在该站点的所有小时数据中找出最接近当前小时的那一条
        let minDelta = Infinity, bestEntry = null;
        for (const entry of siteDataArr) {
            if (entry.NO2 === "-" || entry.O3 === "-") continue; // 排除无效数据
            // 解析时间为Date对象
            const entryTime = new Date(entry.DateTime.replace(" ", "T") + "+08:00"); // 强制香港时区
            const now = new Date();
            const delta = Math.abs(entryTime.getTime() - now.getTime());
            if (delta < minDelta) {
                minDelta = delta;
                bestEntry = entry;
            }
        }
        if (bestEntry) {
            const x = parseFloat(bestEntry.NO2);
            const y = parseFloat(bestEntry.O3);
            const siteName = bestEntry.StationNameEN;
            const timeStr = bestEntry.DateTime;
            addRealtimePoint(x, y, siteName, timeStr);
        }
    }
}

// 自动执行一次
fetchLatestNO2O3_TEKMA();

// 如需定时刷新自动点，可取消注释：
// setInterval(fetchLatestNO2O3_TEKMA, 10 * 60 * 1000);

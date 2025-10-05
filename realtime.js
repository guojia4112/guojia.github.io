// 确保页面加载后执行
document.addEventListener("DOMContentLoaded", function () {
    // 图表容器 ID
    const plotDiv = document.getElementById('plot');

    // 初始化图表（如果已有曲线，可以保留）
    const layout = {
        title: 'NOX vs O3 with Site Labels',
        xaxis: { title: 'NOX' },
        yaxis: { title: 'O3' }
    };

    Plotly.newPlot(plotDiv, [], layout);

    // 使用 PapaParse 读取 CSV 文件
    Papa.parse("NOXO3.csv", {
        download: true,
        header: true,
        complete: function (results) {
            const data = results.data;

            // 提取三列数据
            const xValues = data.map(row => parseFloat(row.NOX));
            const yValues = data.map(row => parseFloat(row.O3));
            const siteNames = data.map(row => row.site);

            // 创建散点图 trace
            const scatterTrace = {
                x: xValues,
                y: yValues,
                mode: 'markers+text',
                type: 'scatter',
                text: siteNames, // 显示站点名称
                textposition: 'top center',
                marker: { color: 'blue', size: 10 }
            };

            // 添加到图表
            Plotly.addTraces(plotDiv, scatterTrace);
        }
    });
});

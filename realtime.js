document.addEventListener("DOMContentLoaded", function () {
    const plotDiv = document.getElementById('plot');
    let userPoints = [];

    function getColor(idx, total) {
        return `hsl(${Math.round(360 * idx / total)}, 65%, 55%)`;
    }

    function loadAndDrawCurves() {
        Papa.parse('data/TEKMADATA.csv', {
            download: true,
            header: true,
            dynamicTyping: true,
            complete: function (results) {
                const data = results.data;
                const columns = results.meta.fields;

                let curveNames = [];
                for (let i = 0; i < columns.length; i += 2) {
                    if (columns[i + 1]) {
                        curveNames.push([columns[i], columns[i + 1]]);
                    }
                }

                let traces = [];
                for (let k = 0; k < curveNames.length; k++) {
                    let colX = curveNames[k][0];
                    let colY = curveNames[k][1];
                    let xArr = [];
                    let yArr = [];
                    for (let i = 0; i < data.length; i++) {
                        let x = data[i][colX];
                        let y = data[i][colY];
                        if (typeof x === "number" && typeof y === "number" && !isNaN(x) && !isNaN(y)) {
                            xArr.push(x);
                            yArr.push(y);
                        }
                    }
                    traces.push({
                        x: xArr,
                        y: yArr,
                        mode: 'lines',
                        name: `${colX.replace('X','')}`,
                        line: { color: getColor(k, curveNames.length), width: 2 }
                    });
                }

                traces.push({
                    x: userPoints.map(p => p.x),
                    y: userPoints.map(p => p.y),
                    mode: 'markers',
                    name: '你输入的数据点',
                    marker: { color: 'red', size: 12, symbol: 'diamond' }
                });

                Papa.parse('data/NOXO3.csv', {
                    download: true,
                    header: true,
                    complete: function (res) {
                        const csvData = res.data;
                        const xValues = csvData.map(row => parseFloat(row.NOX));
                        const yValues = csvData.map(row => parseFloat(row.O3));
                        const siteNames = csvData.map(row => row.site);

                        traces.push({
                            x: xValues,
                            y: yValues,
                            mode: 'markers+text',
                            type: 'scatter',
                            text: siteNames,
                            textposition: 'top center',
                            name: '站点数据',
                            marker: { color: 'blue', size: 10 }
                        });

                        let layout = {
                            title: 'T-EKMA曲线与用户数据点及站点标注',
                            xaxis: { title: 'X', gridcolor: '#eee' },
                            yaxis: { title: 'Y', gridcolor: '#eee' },
                            legend: { orientation: "h", x: 0, y: 1.08 },
                            plot_bgcolor: "#fafafa"
                        };

                        Plotly.newPlot(plotDiv, traces, layout, { responsive: true });
                    }
                });
            }
        });
    }

    window.plotUserPoint = function () {
        let x = parseFloat(document.getElementById('userX').value);
        let y = parseFloat(document.getElementById('userY').value);
        if (!isNaN(x) && !isNaN(y)) {
            userPoints.push({ x: x, y: y });
            loadAndDrawCurves();
        } else {
            alert("请输入有效的X和Y值！");
        }
    };

    loadAndDrawCurves();
});

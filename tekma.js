
// [tekma.js] — 唯一负责初始化 Plotly，并绘制 TEKMA 背景曲线
// 轴标题采用 Plotly v3 要求的写法：xaxis.title.text / yaxis.title.text
// 会在 window 上暴露：
//   - window.PLOTLY_READY: Promise，在图初始化成功后 resolve(plotDiv)
//   - window.getPlotDiv(): 返回绘图容器

(function(){
  'use strict';

  // 全局可等待的 Promise：图初始化完成后 resolve
  window.PLOTLY_READY = new Promise(function(resolve, reject){
    function start(){
      try {
        const plotDiv = document.getElementById('plot');
        if (!plotDiv) throw new Error('未找到 #plot 容器');

        // 小工具：按 VOC 生成色相（蓝->红）
        function colorForVOC(voc, vocMin, vocMax) {
          const t = (voc - vocMin) / Math.max(1e-9, (vocMax - vocMin));
          const hue = 240 - 240 * t; // 240(蓝) -> 0(红)
          return `hsl(${Math.round(hue)}, 70%, 50%)`;
        }
        const grayLine = { color: '#8a8a8a', width: 1.0, dash: 'dot' }; // NOX 灰色虚线

        // 读取 TEKMA 背景数据并绘制
        Papa.parse('data/TEKMA.csv', {
          download: true,
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          complete: function(results){
            const rows = results.data || [];
            // 预处理：仅保留数值行
            const clean = [];
            for (const r of rows){
              const voc = r.VOC, nox = r.NOX, x = r['24NOX'], y = r['M1M1O3'];
              if ([voc, nox, x, y].some(v => typeof v !== 'number' || Number.isNaN(v))) continue;
              clean.push({ VOC: voc, NOX: nox, X: x, Y: y });
            }
            if (clean.length === 0){
              Plotly.newPlot(plotDiv, [], { title: 'TEKMA.csv 无有效数据' });
              return reject(new Error('TEKMA.csv 无有效数据'));
            }

            // A. 按 VOC 分组（彩色实线）
            const byVOC = new Map();
            for (const r of clean){
              if (!byVOC.has(r.VOC)) byVOC.set(r.VOC, []);
              byVOC.get(r.VOC).push({ NOX: r.NOX, X: r.X, Y: r.Y });
            }
            const vocValues = Array.from(byVOC.keys()).sort((a,b)=>a-b);
            const vocMin = vocValues[0], vocMax = vocValues[vocValues.length-1];
            const vocTraces = vocValues.map(voc => {
              const arr = byVOC.get(voc).sort((a,b)=>a.NOX - b.NOX);
              return {
                x: arr.map(p=>p.X),
                y: arr.map(p=>p.Y),
                mode: 'lines',
                name: `VOC=${voc}`,
                line: { color: colorForVOC(voc, vocMin, vocMax), width: 2.2 },
                hovertemplate: `VOC=${voc}<br>24NOX: %{x}<br>M1M1O3: %{y}<extra></extra>`,
                legendgroup: 'VOC',
                showlegend: true
              };
            });

            // B. 按 NOX 分组（灰色虚线）
            const byNOX = new Map();
            for (const r of clean){
              if (!byNOX.has(r.NOX)) byNOX.set(r.NOX, []);
              byNOX.get(r.NOX).push({ VOC: r.VOC, X: r.X, Y: r.Y });
            }
            const noxValues = Array.from(byNOX.keys()).sort((a,b)=>a-b);
            const noxTraces = noxValues.map(nox => {
              const arr = byNOX.get(nox).sort((a,b)=>a.VOC - b.VOC);
              return {
                x: arr.map(p=>p.X),
                y: arr.map(p=>p.Y),
                mode: 'lines',
                name: `NOX=${nox}`,
                line: grayLine,
                hovertemplate: `NOX=${nox}<br>24NOX: %{x}<br>M1M1O3: %{y}<extra></extra>`,
                legendgroup: 'NOX',
                showlegend: false
              };
            });

            const data = [...noxTraces, ...vocTraces]; // 先灰后彩，便于覆盖

            // 统一的基础布局（单一来源）
            const layout = {
              title: 'T‑EKMA 背景图（VOC 等值线：彩色；NOX 等值线：灰色虚线）',
              plot_bgcolor: '#fafafa',
              font: { family: 'Arial, Helvetica, sans-serif', size: 13, color: '#222' },
              margin: { l: 70, r: 140, t: 60, b: 70 },
              xaxis: { title: { text: '24NOX' }, gridcolor: '#eee', automargin: true, title_standoff: 8 },
              yaxis: { title: { text: 'M1M1O3' }, gridcolor: '#eee', automargin: true, title_standoff: 8 },
              legend: { orientation: 'v', x: 1.02, xanchor: 'left', y: 0.5, yanchor: 'middle' },
              uirevision: 'v1'
            };

            const config = { responsive: true, displaylogo: false };

            Plotly.newPlot(plotDiv, data, layout, config)
              .then(() => {
                // 暴露工具函数
                window.getPlotDiv = () => plotDiv;
                resolve(plotDiv);
                console.log('[tekma] 背景曲线初始化完成');
              })
              .catch(err => { reject(err); });
          },
          error: function(err){
            console.error('[tekma] 解析 TEKMA.csv 失败:', err);
            Plotly.newPlot(document.getElementById('plot'), [], { title: 'TEKMA.csv 加载失败' });
            reject(err);
          }
        });
      } catch (e){
        reject(e);
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start);
    } else {
      start();
    }
  });
})();

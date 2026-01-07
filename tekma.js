
// tekma.js — Modular TEKMA background rendering
window.TEKMA = (() => {
  let bgCache = null; // { traces: [...], layoutBase: {...} }

  function parseTEKMA(rows) {
    const clean = [];
    for (const r of rows) {
      const voc = r.VOC, nox = r.NOX, x = r['24NOX'], y = r['M1M1O3'];
      if ([voc, nox, x, y].some(v => typeof v !== 'number' || isNaN(v))) continue;
      clean.push({ VOC: voc, NOX: nox, X: x, Y: y });
    }
    if (!clean.length) return { traces: [] };

    const byVOC = new Map();
    const byNOX = new Map();
    for (const r of clean) {
      if (!byVOC.has(r.VOC)) byVOC.set(r.VOC, []);
      byVOC.get(r.VOC).push({ NOX: r.NOX, X: r.X, Y: r.Y });
      if (!byNOX.has(r.NOX)) byNOX.set(r.NOX, []);
      byNOX.get(r.NOX).push({ VOC: r.VOC, X: r.X, Y: r.Y });
    }

    const vocValues = Array.from(byVOC.keys()).sort((a,b)=>a-b);
    const vocMin = vocValues[0], vocMax = vocValues[vocValues.length - 1];
    const colorForVOC = (voc) => {
      const t = (voc - vocMin) / Math.max(1e-9, (vocMax - vocMin));
      const hue = 240 - 240 * t; // blue->red
      return `hsl(${Math.round(hue)}, 70%, 50%)`;
    };

    const vocTraces = vocValues.map(voc => {
      const arr = byVOC.get(voc).sort((a,b)=>a.NOX - b.NOX);
      return {
        x: arr.map(p=>p.X), y: arr.map(p=>p.Y), mode:'lines', type:'scatter',
        name:`VOC=${voc}`, line:{ color: colorForVOC(voc), width:1.2 },
        hovertemplate:`VOC=${voc}
24NOX: %{x}
M1M1O3: %{y}`,
        legendgroup:'VOC', showlegend:true
      };
    });

    const noxValues = Array.from(byNOX.keys()).sort((a,b)=>a-b);
    const noxTraces = noxValues.map(nox => {
      const arr = byNOX.get(nox).sort((a,b)=>a.VOC - b.VOC);
      return {
        x: arr.map(p=>p.X), y: arr.map(p=>p.Y), mode:'lines', type:'scatter',
        name:`NOX=${nox}`, line:{ color:'#8a8a8a', width:0.8, dash:'dot' },
        hovertemplate:`NOX=${nox}
24NOX: %{x}
M1M1O3: %{y}`,
        legendgroup:'NOX', showlegend:false
      };
    });

    return { traces: [...noxTraces, ...vocTraces] };
  }

  async function ensureBackground(csvPath = 'data/TEKMA.csv') {
    if (bgCache) return bgCache;
    return new Promise((resolve, reject) => {
      Papa.parse(csvPath, {
        download: true, header: true, dynamicTyping: true, skipEmptyLines: true,
        complete: (res) => {
          const parsed = parseTEKMA(res.data ?? []);
          bgCache = {
            traces: parsed.traces,
            layoutBase: {
              xaxis: { title: '24h NOₓ', zeroline: false, rangemode: 'tozero' },
              yaxis: { title: 'M1M1 O₃', zeroline: false, rangemode: 'tozero' },
              plot_bgcolor: '#fafafa',
              legend: { orientation: 'v', x: 1.02, y: 0.5 },
              margin: { l: 60, r: 160, t: 60, b: 60 }
            }
          };
          console.log('[TEKMA] Background traces ready:', bgCache.traces.length);
          resolve(bgCache);
        },
        error: (e) => { console.error('[TEKMA] CSV parse error:', e); reject(e); }
      });
    });
  }

  async function renderBackground(containerId, layoutOverrides = {}) {
    const div = document.getElementById(containerId);
    if (!div) return;
    const bg = await ensureBackground();
    const layout = { ...bg.layoutBase, ...layoutOverrides };
    return Plotly.react(div, bg.traces, layout);
  }

  return { ensureBackground, renderBackground };
})();

// tekma.js — Modular TEKMA background rendering (lines only, hover shows "Emi_VOC: **, Emi_NOx: **")
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

    // group by VOC, by NOX
    const byVOC = new Map();
    const byNOX = new Map();
    for (const r of clean) {
      if (!byVOC.has(r.VOC)) byVOC.set(r.VOC, []);
      byVOC.get(r.VOC).push({ NOX: r.NOX, X: r.X, Y: r.Y });
      if (!byNOX.has(r.NOX)) byNOX.set(r.NOX, []);
      byNOX.get(r.NOX).push({ VOC: r.VOC, X: r.X, Y: r.Y });
    }

    // color map by VOC (blue->red)
    const vocValues = Array.from(byVOC.keys()).sort((a,b)=>a-b);
    const vocMin = vocValues[0], vocMax = vocValues[vocValues.length - 1];
    const colorForVOC = (voc) => {
      const t = (voc - vocMin) / Math.max(1e-9, (vocMax - vocMin));
      const hue = 240 - 240 * t; // blue->red
      return `hsl(${Math.round(hue)}, 70%, 50%)`;
    };

    // VOC isopleths
    const vocTraces = vocValues.map(voc => {
      const arr = byVOC.get(voc).sort((a,b)=>a.NOX - b.NOX);
      return {
        x: arr.map(p => p.X),
        y: arr.map(p => p.Y),
        type: 'scatter',
        mode: 'lines',
        name: `VOC EMI = ${voc}`,        // <-- renamed per request
        line: { color: colorForVOC(voc), width: 1.2 },
        legendgroup: 'VOC',
        showlegend: true,
        customdata: arr.map(p => [voc, p.NOX]),
        hovertemplate: 'Emi_VOC: %{customdata[0]}, Emi_NOx: %{customdata[1]}<extra></extra>',
      };
    });

    // NOX isopleths
    const noxValues = Array.from(byNOX.keys()).sort((a,b)=>a-b);
    const noxTraces = noxValues.map(nox => {
      const arr = byNOX.get(nox).sort((a,b)=>a.VOC - b.VOC);
      return {
        x: arr.map(p => p.X),
        y: arr.map(p => p.Y),
        type: 'scatter',
        mode: 'lines',
        name: `NOX=${nox}`,
        line: { color: '#8a8a8a', width: 0.8, dash: 'dot' },
        legendgroup: 'NOX',
        showlegend: false,
        customdata: arr.map(p => [p.VOC, nox]),
        hovertemplate: 'Emi_VOC: %{customdata[0]}, Emi_NOx: %{customdata[1]}<extra></extra>',
      };
    });

    return { traces: [...noxTraces, ...vocTraces] };
  }

  async function ensureBackground(csvPath = 'data/TEKMA.csv') {
    if (bgCache) return bgCache;
    return new Promise((resolve, reject) => {
      Papa.parse(csvPath, {
        download: true,
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (res) => {
          const parsed = parseTEKMA(res.data ?? []);
          bgCache = {
            traces: parsed.traces,
            layoutBase: {
              xaxis: { title: '24-hour NOx (ppb)', zeroline: false, rangemode: 'tozero' },
              yaxis: { title: 'Daily range of hourly O₃ (max–min, ppb)', zeroline: false, rangemode: 'tozero' },
              plot_bgcolor: '#fafafa',
              legend: { orientation: 'v', x: 1.02, y: 0.5 },
              margin: { l: 60, r: 160, t: 40, b: 60 },
              hovermode: 'closest',
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

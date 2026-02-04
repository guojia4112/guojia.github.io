
// sites.js — Modular sites data & rendering API for Diagram, Evolution & Sandbox
window.SitesAPI = (() => {
  const LABELS = {
    CAUSEWAY_BAY: 'Causeway Bay', CENTRAL: 'Central', CENTRAL_WESTERN: 'Central Western',
    KWAI_CHUNG: 'Kwai Chung', KWUN_TONG: 'Kwun Tong', MONG_KOK: 'Mong Kok', NORTH: 'North',
    SHAM_SHUI_PO: 'Sham Shui Po', SHATIN: 'Shatin', SOUTHERN: 'Southern', TAI_PO: 'Tai Po',
    TAP_MUN: 'Tap Mun', TSEUNG_KWAN_O: 'Tseung Kwan O', TSUEN_WAN: 'Tsuen Wan', TUEN_MUN: 'Tuen Mun',
    TUNG_CHUNG: 'Tung Chung', YUEN_LONG: 'Yuen Long', HK_AVE: 'HK S.A.R.'
  };

  const ALIASES = {
    'Hong Kong (AVE)': 'HK_AVE'
  };

  function normalizeStationName(st) {
    if (!st) return st;
    const s = String(st).trim();
    if (ALIASES[s]) return ALIASES[s];
    // 可选的进一步正则：将空格/括号变换为下划线；此处暂不需要
    return s;
  }

  let cache = null; // Map(station -> Map(year -> {X,Y}))
  let loaded = false;

  async function load(csvPath = 'data/sites.csv') {
    if (loaded && cache) return;
    cache = new Map();
    return new Promise((resolve, reject) => {
      Papa.parse(csvPath, {
        download: true, header: true, dynamicTyping: true, skipEmptyLines: true,
        complete: (res) => {
          (res.data ?? []).forEach(r => {
            const stRaw = r.Station ?? '';
            const st = normalizeStationName(stRaw);
            const yr = typeof r.Year === 'number' ? r.Year : parseInt(r.Year, 10);
            const x = r['24NOX'], y = r['M1M1O3'];
            if (!st || isNaN(yr) || typeof x !== 'number' || typeof y !== 'number') return;
            if (!cache.has(st)) cache.set(st, new Map());
            cache.get(st).set(yr, { X: x, Y: y });
          });
          loaded = true; resolve();
        },
        error: (e) => { console.error('[SitesAPI] CSV parse error:', e); reject(e); }
      });
    });
  }

  function getPoint(site, year) {
    const rec = cache?.get(site)?.get(year);
    if (!rec) return null;
    const label = LABELS[site] ?? site.replace(/_/g, ' ');
    return { x: rec.X, y: rec.Y, label: `${label} (${year})`, site, year };
  }

  function getSeries(site, yearMin, yearMax) {
    const yearsMap = cache?.get(site);
    if (!yearsMap) return [];
    const out = [];
    yearsMap.forEach((val, yr) => { if (yr >= yearMin && yr <= yearMax) out.push({ year: yr, x: val.X, y: val.Y }); });
    out.sort((a,b) => a.year - b.year);
    return out;
  }

  function upsertSelectedLayer(plotDiv, meta = 'SITE_SELECTED_MULTI') {
    const idx = (plotDiv.data ?? []).findIndex(t => t.meta === meta);
    if (idx >= 0) return idx;
    Plotly.addTraces(plotDiv, {
      x: [], y: [], mode: 'markers+text', type: 'scatter', name: 'Selected', meta,
      legendgroup: 'SITES', marker: { color: '#BEBEBE', size: 9, symbol: 'circle', line: { color: '#666', width: 2 } },
      text: [], textposition: 'top center', textfont: { color: '#666', size: 11 },
      hovertemplate: '%{text}24NOX: %{x}M1M1O3: %{y}'
    });
    return (plotDiv.data ?? []).length;
  }

  function updateSelected(plotDiv, { sites, year }) {
    const idx = upsertSelectedLayer(plotDiv);
    const xs = [], ys = [], texts = [];
    sites.forEach(st => { const p = getPoint(st, year); if (p) { xs.push(p.x); ys.push(p.y); texts.push(p.label); } });
    return Plotly.restyle(plotDiv, { x: [xs], y: [ys], text: [texts] }, [idx]);
  }

  return { load, getPoint, getSeries, updateSelected, LABELS };
})();


// alg/locator2.js — (VOC, NOx) -> XY via bilinear interpolation
// ES module; uses the same TEKMA.csv grid. Step sizes: VOC=0.5, NOx=1.0.

var DEFAULT_STEP_VOC = 0.5;
var DEFAULT_STEP_NOX = 1.0;

var _grid = null;

function quantize(v, step) { return Math.round(v / step) * step; }
function mkKey(V, N) { return V.toFixed(6) + "\n" + N.toFixed(6); }

// ---------- Grid build & load ----------
export function buildGridFromRows(rows, stepVoc, stepNox) {
  var sv = (typeof stepVoc === 'number') ? stepVoc : DEFAULT_STEP_VOC;
  var sn = (typeof stepNox === 'number') ? stepNox : DEFAULT_STEP_NOX;
  var map = new Map(); var valid = 0;
  for (var rIdx = 0; rIdx < rows.length; rIdx++) {
    var r = rows[rIdx];
    var voc = r.VOC, nox = r.NOX, x = r['24NOX'], y = r['M1M1O3'];
    if ([voc, nox, x, y].every(function (v) { return typeof v === 'number' && !isNaN(v); })) {
      var Vq = quantize(voc, sv);
      var Nq = quantize(nox, sn);
      map.set(mkKey(Vq, Nq), { x: x, y: y, VOC: Vq, NOX: Nq }); valid++;
    }
  }
  if (valid === 0) throw new Error('locator2.buildGridFromRows: no valid rows');
  return { stepVoc: sv, stepNox: sn, map: map, key: mkKey };
}

export function initGridFromCSV(url) {
  var csvUrl = url || 'data/TEKMA.csv';
  return new Promise(function (resolve, reject) {
    if (_grid && _grid.map instanceof Map && _grid.map.size > 0) return resolve(_grid);
    if (typeof Papa === 'undefined') {
      var err = new Error('locator2.initGridFromCSV: PapaParse not loaded');
      console.error(err); return reject(err);
    }
    Papa.parse(csvUrl, { download: true, header: true, dynamicTyping: true, skipEmptyLines: true,
      complete: function (results) {
        try {
          _grid = buildGridFromRows(results.data || [], DEFAULT_STEP_VOC, DEFAULT_STEP_NOX);
          try { window.TEKMA_GRID_L2 = _grid; } catch (e) {}
          console.log('[locator2] grid size:', _grid.map.size);
          resolve(_grid);
        } catch (err) { console.error('[locator2] build failed:', err); reject(err); }
      },
      error: function (err) { console.error('[locator2] CSV load failed:', err); reject(err); }
    });
  });
}

export function isGridReady() { return !!(_grid && _grid.map instanceof Map && _grid.map.size > 0); }

function gridGet(voc, nox) {
  if (!_grid || !(_grid.map instanceof Map)) return null;
  var Vq = quantize(voc, _grid.stepVoc);
  var Nq = quantize(nox, _grid.stepNox);
  var key = (typeof _grid.key === 'function') ? _grid.key(Vq, Nq) : mkKey(Vq, Nq);
  var g = _grid.map.get(key);
  if (g) return { x: g.x, y: g.y, VOC: g.VOC, NOX: g.NOX };
  // near tolerance fallback
  var tolV = _grid.stepVoc / 2 + 1e-9, tolN = _grid.stepNox / 2 + 1e-9;
  var best = null, bestCost = Infinity;
  _grid.map.forEach(function (val) {
    var dvv = Math.abs(val.VOC - voc), dnn = Math.abs(val.NOX - nox);
    if (dvv <= tolV && dnn <= tolN) {
      var cost = dvv * dvv + dnn * dnn;
      if (cost < bestCost) { bestCost = cost; best = val; }
    }
  });
  return best ? { x: best.x, y: best.y, VOC: best.VOC, NOX: best.NOX } : null;
}

// ---------- Bilinear forward: (VOC, NOX) -> (24NOx, M1M1O3) ----------
export function interpolateXYFromVOCNOX(VOC, NOX) {
  if (!isGridReady()) return null;

  var stepV = _grid.stepVoc, stepN = _grid.stepNox;
  // 根据数据范围设置夹取；如有更低 NOx，请调整 Nmin
  var Vmin = 0, Vmax = 10, Nmin = 1, Nmax = 50;

  var V = Math.min(Vmax, Math.max(Vmin, VOC));
  var N = Math.min(Nmax, Math.max(Nmin, NOX));

  var V0 = Math.floor(V / stepV) * stepV, V1 = Math.ceil(V / stepV) * stepV;
  var N0 = Math.floor(N / stepN) * stepN, N1 = Math.ceil(N / stepN) * stepN;

  var P00 = gridGet(V0, N0), P10 = gridGet(V1, N0), P01 = gridGet(V0, N1), P11 = gridGet(V1, N1);
  if (!P00 || !P10 || !P01 || !P11) {
    // 角点缺失：退回近邻
    var near = gridGet(V, N) || gridGet(quantize(V, stepV), quantize(N, stepN));
    return near ? { x: near.x, y: near.y, usedNearest: true } : null;
  }

  var t = (V1 === V0) ? 0 : (V - V0) / (V1 - V0); // VOC 权重
  var u = (N1 === N0) ? 0 : (N - N0) / (N1 - N0); // NOx 权重

  var X =
    (1 - t) * (1 - u) * P00.x +
    t * (1 - u) * P10.x +
    (1 - t) * u * P01.x +
    t * u * P11.x;

  var Y =
    (1 - t) * (1 - u) * P00.y +
    t * (1 - u) * P10.y +
    (1 - t) * u * P01.y +
    t * u * P11.y;

  return { x: X, y: Y, corners: { V0: V0, N0: N0, V1: V1, N1: N1 }, weights: { t: t, u: u } };
}

export default {
  initGridFromCSV: initGridFromCSV,
  isGridReady: isGridReady,
  interpolateXYFromVOCNOX: interpolateXYFromVOCNOX,
  buildGridFromRows: buildGridFromRows
};

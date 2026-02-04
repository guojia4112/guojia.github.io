// alg/locator2.js — (VOC, NOx) -> (24NOX, M1M1O3)
// ES module (ES5 style); auto-detect steps/bounds; strict out_of_range/outside.

var _grid = null;

function mkKey(V, N) { return V.toFixed(6) + "\n" + N.toFixed(6); }

function uniqueSorted(vals) {
  var s = {}; var out = [];
  for (var i = 0; i < vals.length; i++) { var v = vals[i]; var k = String(v.toFixed(6)); if (!s[k]) { s[k] = 1; out.push(v); } }
  out.sort(function(a,b){ return a-b; });
  return out;
}

function minPositiveDelta(sortedVals) {
  var min = Infinity;
  for (var i = 1; i < sortedVals.length; i++) {
    var d = sortedVals[i] - sortedVals[i-1];
    if (d > 1e-12 && d < min) min = d;
  }
  return (min === Infinity) ? 0 : min;
}

function binaryBracket(sorted, v) {
  var n = sorted.length;
  if (n === 0) return { lo: -1, hi: -1 };
  if (v <= sorted[0]) return { lo: 0, hi: 0 };
  if (v >= sorted[n-1]) return { lo: n-1, hi: n-1 };
  var lo = 0, hi = n - 1;
  while (hi - lo > 1) {
    var midIdx = (lo + hi) >> 1;
    if (sorted[midIdx] <= v) lo = midIdx; else hi = midIdx;
  }
  return { lo: lo, hi: hi };
}

export function buildGridFromRows(rows) {
  var vocs = [], noxs = [];
  var map = new Map(); var valid = 0;
  for (var rIdx = 0; rIdx < rows.length; rIdx++) {
    var r = rows[rIdx];
    var voc = r.VOC, nox = r.NOX, x = r['24NOX'], y = r['M1M1O3'];
    if ([voc, nox, x, y].every(function (v) { return typeof v === 'number' && isFinite(v); })) {
      vocs.push(voc); noxs.push(nox);
      map.set(mkKey(voc, nox), { x: x, y: y, VOC: voc, NOX: nox }); valid++;
    }
  }
  if (valid === 0) throw new Error('locator2.buildGridFromRows: no valid rows');

  var vocVals = uniqueSorted(vocs);
  var noxVals = uniqueSorted(noxs);
  var stepVoc = minPositiveDelta(vocVals) || 1.0;
  var stepNox = minPositiveDelta(noxVals) || 1.0;

  var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  map.forEach(function(p){ if(p.x<minX)minX=p.x; if(p.x>maxX)maxX=p.x; if(p.y<minY)minY=p.y; if(p.y>maxY)maxY=p.y; });

  return {
    map: map,
    vocVals: vocVals, noxVals: noxVals,
    stepVoc: stepVoc, stepNox: stepNox,
    bounds: { Vmin: vocVals[0], Vmax: vocVals[vocVals.length-1], Nmin: noxVals[0], Nmax: noxVals[noxVals.length-1],
              Xmin: minX, Xmax: maxX, Ymin: minY, Ymax: maxY },
    key: mkKey
  };
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
          _grid = buildGridFromRows(results.data || []);
          try { window.TEKMA_GRID_L2 = _grid; } catch (e) {}
          console.log('[locator2] size:', _grid.map.size, 'steps:', _grid.stepVoc, _grid.stepNox, 'bounds:', _grid.bounds);
          resolve(_grid);
        } catch (err) { console.error('[locator2] build failed:', err); reject(err); }
      },
      error: function (err) { console.error('[locator2] CSV load failed:', err); reject(err); }
    });
  });
}

export function isGridReady() { return !!(_grid && _grid.map instanceof Map && _grid.map.size > 0); }

function gridGetExact(voc, nox) {
  if (!_grid || !(_grid.map instanceof Map)) return null;
  var g = _grid.map.get(mkKey(voc, nox));
  return g ? { x: g.x, y: g.y, VOC: g.VOC, NOX: g.NOX } : null;
}

// ---------- Bilinear forward: (VOC, NOX) -> (24NOx, M1M1O3) ----------
export function interpolateXYFromVOCNOX(VOC, NOX) {
  if (!isGridReady()) return { ok: false, reason: 'grid not ready' };

  var b = _grid.bounds;
  // 严格边界：超出范围不予计算
  if (VOC < b.Vmin - 1e-9 || VOC > b.Vmax + 1e-9 || NOX < b.Nmin - 1e-9 || NOX > b.Nmax + 1e-9) {
    return { ok: false, reason: 'out_of_range', bounds: b, target: { VOC: VOC, NOX: NOX } };
  }

  // 寻找相邻值（不依赖固定步距）
  var vb = binaryBracket(_grid.vocVals, VOC);
  var nb = binaryBracket(_grid.noxVals, NOX);
  var V0 = _grid.vocVals[vb.lo], V1 = _grid.vocVals[vb.hi];
  var N0 = _grid.noxVals[nb.lo], N1 = _grid.noxVals[nb.hi];

  var P00 = gridGetExact(V0, N0), P10 = gridGetExact(V1, N0), P01 = gridGetExact(V0, N1), P11 = gridGetExact(V1, N1);
  if (!P00 || !P10 || !P01 || !P11) {
    return {
      ok: false, reason: 'outside',
      cornersFound: { P00: !!P00, P10: !!P10, P01: !!P01, P11: !!P11 },
      bracket: { V0: V0, V1: V1, N0: N0, N1: N1 }, target: { VOC: VOC, NOX: NOX }
    };
  }

  var t = (V1 === V0) ? 0 : (VOC - V0) / (V1 - V0);
  var u = (N1 === N0) ? 0 : (NOX - N0) / (N1 - N0);

  var X = (1 - t) * (1 - u) * P00.x + t * (1 - u) * P10.x + (1 - t) * u * P01.x + t * u * P11.x;
  var Y = (1 - t) * (1 - u) * P00.y + t * (1 - u) * P10.y + (1 - t) * u * P01.y + t * u * P11.y;

  return { ok: true, x: X, y: Y, corners: { V0: V0, V1: V1, N0: N0, N1: N1 }, weights: { t: t, u: u } };
}

export default {
  initGridFromCSV: initGridFromCSV,
  isGridReady: isGridReady,
  interpolateXYFromVOCNOX: interpolateXYFromVOCNOX,
  buildGridFromRows: buildGridFromRows
};

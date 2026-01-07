
// alg/locator1.js — XY -> (VOC, NOx) via 8-level refinement + inverse bilinear
// ES module; avoid modern syntax that breaks legacy, but `export` is required.
// 网格步距：VOC=0.5、NOx=1.0；连续等值稳定，角点版仅用作后备/对比。

var DEFAULT_STEP_VOC = 0.5;
var DEFAULT_STEP_NOX = 1.0;

var _grid = null;

function dist2(ax, ay, bx, by) {
  var dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
}
function mid(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, VOC: (a.VOC + b.VOC) / 2, NOX: (a.NOX + b.NOX) / 2 };
}
function centerOfQuad(A, B, C, D) {
  return {
    x: (A.x + B.x + C.x + D.x) / 4,
    y: (A.y + B.y + C.y + D.y) / 4,
    VOC: (A.VOC + B.VOC + C.VOC + D.VOC) / 4,
    NOX: (A.NOX + B.NOX + C.NOX + D.NOX) / 4
  };
}
function pointInPolygon(polyXY, p) {
  var inside = false;
  for (var i = 0, j = polyXY.length - 1; i < polyXY.length; j = i++) {
    var xi = polyXY[i].x, yi = polyXY[i].y;
    var xj = polyXY[j].x, yj = polyXY[j].y;
    var intersect = ((yi > p.y) !== (yj > p.y)) && (p.x < (xj - xi) * (p.y - yi) / ((yj - yi) || 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}
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
  if (valid === 0) throw new Error('locator1.buildGridFromRows: no valid rows');
  return { stepVoc: sv, stepNox: sn, map: map, key: mkKey };
}

export function initGridFromCSV(url) {
  var csvUrl = url || 'data/TEKMA.csv';
  return new Promise(function (resolve, reject) {
    if (_grid && _grid.map instanceof Map && _grid.map.size > 0) return resolve(_grid);
    if (typeof Papa === 'undefined') {
      var err = new Error('locator1.initGridFromCSV: PapaParse not loaded');
      console.error(err); return reject(err);
    }
    Papa.parse(csvUrl, { download: true, header: true, dynamicTyping: true, skipEmptyLines: true,
      complete: function (results) {
        try {
          _grid = buildGridFromRows(results.data || [], DEFAULT_STEP_VOC, DEFAULT_STEP_NOX);
          try { window.TEKMA_GRID_L1 = _grid; } catch (e) {}
          console.log('[locator1] grid size:', _grid.map.size);
          resolve(_grid);
        } catch (err) { console.error('[locator1] build failed:', err); reject(err); }
      },
      error: function (err) { console.error('[locator1] CSV load failed:', err); reject(err); }
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
  // near tolerance fallback (half step)
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

function findNearestGridPointByXY(x, y) {
  if (!_grid || !(_grid.map instanceof Map)) return null;
  var best = null, bestD2 = Infinity;
  _grid.map.forEach(function (val) {
    var d2 = dist2(x, y, val.x, val.y);
    if (d2 < bestD2) { bestD2 = d2; best = { x: val.x, y: val.y, VOC: val.VOC, NOX: val.NOX }; }
  });
  return best;
}

function buildAdjacentQuads(center) {
  var dv = _grid ? _grid.stepVoc : DEFAULT_STEP_VOC;
  var dn = _grid ? _grid.stepNox : DEFAULT_STEP_NOX;
  var V = center.VOC, N = center.NOX;
  var P = {
    V0N0: gridGet(V, N), VmN0: gridGet(V - dv, N), VpN0: gridGet(V + dv, N),
    V0Nm: gridGet(V, N - dn), V0Np: gridGet(V, N + dn),
    VmNm: gridGet(V - dv, N - dn), VpNm: gridGet(V + dv, N - dn),
    VmNp: gridGet(V - dv, N + dn), VpNp: gridGet(V + dv, N + dn)
  };
  var quads = [];
  if (P.VmNm && P.V0Nm && P.V0N0 && P.VmN0) quads.push([P.VmNm, P.V0Nm, P.V0N0, P.VmN0]);
  if (P.V0Nm && P.VpNm && P.VpN0 && P.V0N0) quads.push([P.V0Nm, P.VpNm, P.VpN0, P.V0N0]);
  if (P.V0N0 && P.VpN0 && P.VpNp && P.V0Np) quads.push([P.V0N0, P.VpN0, P.VpNp, P.V0Np]);
  if (P.VmN0 && P.V0N0 && P.V0Np && P.VmNp) quads.push([P.VmN0, P.V0N0, P.V0Np, P.VmNp]);
  return quads;
}

export function chooseQuadContainingPoint(quads, userXY, options) {
  var allowFallback = options && options.allowFallback;
  if (!quads || !quads.length) return null;
  var best = null, bestD2 = Infinity;
  for (var qi = 0; qi < quads.length; qi++) {
    var q = quads[qi];
    var polyXY = q.map(function (p) { return { x: p.x, y: p.y }; });
    if (pointInPolygon(polyXY, userXY)) return q;
    var C = centerOfQuad(q[0], q[1], q[2], q[3]);
    var d2 = dist2(userXY.x, userXY.y, C.x, C.y);
    if (d2 < bestD2) { bestD2 = d2; best = q; }
  }
  return allowFallback ? best : null;
}

export function subdivideQuad(A, B, C, D) {
  var AB = mid(A, B), BC = mid(B, C), CD = mid(C, D), DA = mid(D, A);
  var M = centerOfQuad(A, B, C, D);
  return [ [A, AB, M, DA], [AB, B, BC, M], [M, BC, C, CD], [DA, M, CD, D] ];
}

export function refineToLevel(initialQuad, userXY, levels) {
  var lv = (typeof levels === 'number') ? levels : 8;
  var q = initialQuad;
  for (var k = 0; k < lv; k++) {
    var subs = subdivideQuad(q[0], q[1], q[2], q[3]);
    var chosen = chooseQuadContainingPoint(subs, userXY, { allowFallback: true });
    q = chosen || subs[0];
  }
  return q;
}

// ---------- inverse bilinear to get continuous (VOC, NOX) ----------
function orderQuadCorners(q) {
  // 排序为标准角：P00(V低,N低), P10(V高,N低), P01(V低,N高), P11(V高,N高)
  var pts = q.slice();
  pts.sort(function (a, b) { if (a.VOC !== b.VOC) return a.VOC - b.VOC; return a.NOX - b.NOX; });
  var NOXmed = (pts[0].NOX + pts[pts.length - 1].NOX) / 2;
  var low = [], high = [];
  for (var i = 0; i < pts.length; i++) { if (pts[i].NOX <= NOXmed) low.push(pts[i]); else high.push(pts[i]); }
  low.sort(function (a, b) { return a.VOC - b.VOC; });
  high.sort(function (a, b) { return a.VOC - b.VOC; });
  var P00 = low[0], P10 = low[low.length - 1], P01 = high[0], P11 = high[high.length - 1];
  if (!P00 || !P10 || !P01 || !P11) { P00 = pts[0]; P10 = pts[1] || pts[0]; P01 = pts[2] || pts[0]; P11 = pts[3] || pts[0]; }
  return { P00: P00, P10: P10, P01: P01, P11: P11 };
}

function bilinearInvertXYToUV(x, y, P00, P10, P01, P11, maxIter) {
  var t = 0.5, u = 0.5;
  var iter = (typeof maxIter === 'number') ? maxIter : 12;
  function XY(tt, uu) {
    var X = (1 - tt) * (1 - uu) * P00.x + tt * (1 - uu) * P10.x + (1 - tt) * uu * P01.x + tt * uu * P11.x;
    var Y = (1 - tt) * (1 - uu) * P00.y + tt * (1 - uu) * P10.y + (1 - tt) * uu * P01.y + tt * uu * P11.y;
    return { X: X, Y: Y };
  }
  for (var k = 0; k < iter; k++) {
    var cur = XY(t, u);
    var Fx = cur.X - x, Fy = cur.Y - y;
    var dXdt = (1 - u) * (P10.x - P00.x) + u * (P11.x - P01.x);
    var dXdu = (1 - t) * (P01.x - P00.x) + t * (P11.x - P10.x);
    var dYdt = (1 - u) * (P10.y - P00.y) + u * (P11.y - P01.y);
    var dYdu = (1 - t) * (P01.y - P00.y) + t * (P11.y - P10.y);
    var det = dXdt * dYdu - dXdu * dYdt;
    if (Math.abs(det) < 1e-12) break;
    // Solve J*[dt du]^T = -F
    var dt = (-Fx * dYdu + dXdu * Fy) / det;
    var du = (dYdt * Fx - dXdt * Fy) / det;
    t += dt; u += du;
    if (t < 0) t = 0; if (t > 1) t = 1;
    if (u < 0) u = 0; if (u > 1) u = 1;
    if (Math.abs(dt) < 1e-9 && Math.abs(du) < 1e-9) break;
  }
  return { t: t, u: u };
}

// 连续等值（推荐用于红字与下游 factor 传导）
export function estimateContinuousIsoFromXY(userX, userY, levels) {
  if (!isGridReady()) return { ok: false, reason: 'grid not ready' };
  var nearest = findNearestGridPointByXY(userX, userY); if (!nearest) return { ok: false, reason: 'no nearest' };
  var quads = buildAdjacentQuads(nearest); if (!quads.length) return { ok: false, reason: 'no quads', nearest: nearest };
  var initialQuad = chooseQuadContainingPoint(quads, { x: userX, y: userY }, { allowFallback: false });
  if (!initialQuad) return { ok: false, reason: 'outside', nearestGrid: nearest, quadsChecked: quads.length };
  var finalQuad = refineToLevel(initialQuad, { x: userX, y: userY }, (typeof levels === 'number') ? levels : 8);
  var ord = orderQuadCorners(finalQuad);
  var inv = bilinearInvertXYToUV(userX, userY, ord.P00, ord.P10, ord.P01, ord.P11, 12);
  var V0 = ord.P00.VOC, V1 = ord.P10.VOC;
  var N0 = ord.P00.NOX, N1 = ord.P01.NOX;
  var VOCc = (1 - inv.t) * V0 + inv.t * V1;
  var NOXc = (1 - inv.u) * N0 + inv.u * N1;
  return { ok: true, estimate: { VOC: VOCc, NOX: NOXc }, uv: inv, finalQuad: finalQuad };
}

// 角点版（仅用于后备或对比）
export function estimateFromXY(userX, userY, levels) {
  if (!isGridReady()) return { ok: false, reason: 'grid not ready' };
  var nearest = findNearestGridPointByXY(userX, userY); if (!nearest) return { ok: false, reason: 'no nearest' };
  var quads = buildAdjacentQuads(nearest); if (!quads.length) return { ok: false, reason: 'no quads', nearest: nearest };
  var initialQuad = chooseQuadContainingPoint(quads, { x: userX, y: userY }, { allowFallback: false });
  if (!initialQuad) return { ok: false, reason: 'outside', nearestGrid: nearest, quadsChecked: quads.length };
  var finalQuad = refineToLevel(initialQuad, { x: userX, y: userY }, (typeof levels === 'number') ? levels : 8);
  var bestCorner = null, bestD2 = Infinity;
  for (var i = 0; i < finalQuad.length; i++) {
    var corner = finalQuad[i];
    var d2 = dist2(userX, userY, corner.x, corner.y);
    if (d2 < bestD2) { bestD2 = d2; bestCorner = corner; }
  }
  return { ok: true, estimate: { VOC: bestCorner.VOC, NOX: bestCorner.NOX }, finalQuad: finalQuad, chosenCorner: bestCorner };
}

export default {
  initGridFromCSV: initGridFromCSV,
  isGridReady: isGridReady,
  estimateContinuousIsoFromXY: estimateContinuousIsoFromXY,
  estimateFromXY: estimateFromXY,
  buildGridFromRows: buildGridFromRows
};

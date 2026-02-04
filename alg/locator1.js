// alg/locator1.js — XY -> (VOC, NOx)
// ES module (ES5 style); auto-detect steps and bounds from CSV; robust on edges; strict outside.

var _grid = null;

function dist2(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
function mid(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, VOC: (a.VOC + b.VOC) / 2, NOX: (a.NOX + b.NOX) / 2 }; }
function centerOfQuad(A, B, C, D) {
  return { x: (A.x + B.x + C.x + D.x) / 4, y: (A.y + B.y + C.y + D.y) / 4,
           VOC: (A.VOC + B.VOC + C.VOC + D.VOC) / 4, NOX: (A.NOX + B.NOX + C.NOX + D.NOX) / 4 };
}
function mkKey(V, N) { return V.toFixed(6) + "\n" + N.toFixed(6); }

function minPositiveDelta(sortedVals) {
  var min = Infinity;
  for (var i = 1; i < sortedVals.length; i++) {
    var d = sortedVals[i] - sortedVals[i-1];
    if (d > 1e-12 && d < min) min = d;
  }
  return (min === Infinity) ? 0 : min;
}

function uniqueSorted(vals) {
  var s = {}; var out = [];
  for (var i = 0; i < vals.length; i++) { var v = vals[i]; var k = String(v.toFixed(6)); if (!s[k]) { s[k] = 1; out.push(v); } }
  out.sort(function(a,b){ return a-b; });
  return out;
}

function binaryBracket(sorted, v) {
  // 返回 [idxLower, idxUpper] 索引（允许相等、越界）
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

function isPointOnSegment(p, a, b, eps) {
  var vx = b.x - a.x, vy = b.y - a.y;
  var wx = p.x - a.x, wy = p.y - a.y;
  var cross = vx * wy - vy * wx;
  if (Math.abs(cross) > (eps || 1e-9)) return false;
  var dot = wx * vx + wy * vy;
  var len2 = vx * vx + vy * vy;
  return dot >= -(eps || 1e-9) && dot <= len2 + (eps || 1e-9);
}

function pointInPolygonInclusive(polyXY, p, eps) {
  // 边/角上的点也算“在内”
  for (var i = 0; i < polyXY.length; i++) {
    var a = polyXY[i], b = polyXY[(i + 1) % polyXY.length];
    if (isPointOnSegment(p, a, b, eps)) return true;
  }
  var inside = false;
  for (var i = 0, j = polyXY.length - 1; i < polyXY.length; j = i++) {
    var xi = polyXY[i].x, yi = polyXY[i].y;
    var xj = polyXY[j].x, yj = polyXY[j].y;
    var intersect = ((yi > p.y) !== (yj > p.y)) && (p.x < (xj - xi) * (p.y - yi) / ((yj - yi) || 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// ---------- Grid build & load ----------
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
  if (valid === 0) throw new Error('locator1.buildGridFromRows: no valid rows');

  var vocVals = uniqueSorted(vocs);
  var noxVals = uniqueSorted(noxs);
  var stepVoc = minPositiveDelta(vocVals) || 1.0; // 兜底
  var stepNox = minPositiveDelta(noxVals) || 1.0;

  // 计算 XY 边界（用于 inBounds 快速判断）
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
      var err = new Error('locator1.initGridFromCSV: PapaParse not loaded');
      console.error(err); return reject(err);
    }
    Papa.parse(csvUrl, { download: true, header: true, dynamicTyping: true, skipEmptyLines: true,
      complete: function (results) {
        try {
          _grid = buildGridFromRows(results.data || []);
          try { window.TEKMA_GRID_L1 = _grid; } catch (e) {}
          console.log('[locator1] size:', _grid.map.size, 'steps:', _grid.stepVoc, _grid.stepNox, 'bounds:', _grid.bounds);
          resolve(_grid);
        } catch (err) { console.error('[locator1] build failed:', err); reject(err); }
      },
      error: function (err) { console.error('[locator1] CSV load failed:', err); reject(err); }
    });
  });
}

export function isGridReady() { return !!(_grid && _grid.map instanceof Map && _grid.map.size > 0); }

function gridGetExact(voc, nox) {
  if (!_grid || !(_grid.map instanceof Map)) return null;
  var g = _grid.map.get(mkKey(voc, nox));
  return g ? { x: g.x, y: g.y, VOC: g.VOC, NOX: g.NOX } : null;
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

function findIndex(list, value, eps) {
  var E = eps || 1e-9;
  for (var i = 0; i < list.length; i++) { if (Math.abs(list[i] - value) <= E) return i; }
  return -1;
}

function collectQuadsAroundCenter(center, rings) {
  // 使用索引扩圈收集完整四边形（无假设固定步距）
  var vocVals = _grid.vocVals, noxVals = _grid.noxVals;
  var ciV = findIndex(vocVals, center.VOC), ciN = findIndex(noxVals, center.NOX);
  if (ciV < 0 || ciN < 0) return [];

  var R = (typeof rings === 'number' && rings > 0) ? rings : 1;
  var quads = [];

  // ring=1..R，收集由 (i,i+1) × (j,j+1) 构成的四边形
  for (var r = 1; r <= R; r++) {
    var iMin = Math.max(0, ciV - r), iMax = Math.min(vocVals.length - 2, ciV + r);
    var jMin = Math.max(0, ciN - r), jMax = Math.min(noxVals.length - 2, ciN + r);
    for (var i = iMin; i <= iMax; i++) {
      for (var j = jMin; j <= jMax; j++) {
        var V0 = vocVals[i],   V1 = vocVals[i+1];
        var N0 = noxVals[j],   N1 = noxVals[j+1];
        var P00 = gridGetExact(V0, N0), P10 = gridGetExact(V1, N0),
            P01 = gridGetExact(V0, N1), P11 = gridGetExact(V1, N1);
        if (P00 && P10 && P01 && P11) quads.push([P00, P10, P11, P01]); // 顺序不重要，后续会排序标准角
      }
    }
  }
  return quads;
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
    // 包容边界判定 + 中心最近作为内部循环 fallback（确保细分持续）
    var chosen = null; var best = null; var bestD2 = Infinity;
    for (var i = 0; i < subs.length; i++) {
      var poly = subs[i].map(function(p){ return {x:p.x, y:p.y}; });
      if (pointInPolygonInclusive(poly, userXY, 1e-9)) { chosen = subs[i]; break; }
      var C = centerOfQuad(subs[i][0], subs[i][1], subs[i][2], subs[i][3]);
      var d2 = dist2(userXY.x, userXY.y, C.x, C.y);
      if (d2 < bestD2) { bestD2 = d2; best = subs[i]; }
    }
    q = chosen || best;
  }
  return q;
}

function orderQuadCorners(q) {
  // 标准角：P00(V低,N低), P10(V高,N低), P01(V低,N高), P11(V高,N高)
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
    var dt = (-Fx * dYdu + dXdu * Fy) / det;
    var du = (dYdt * Fx - dXdt * Fy) / det;
    t += dt; u += du;
    if (t < 0) t = 0; if (t > 1) t = 1;
    if (u < 0) u = 0; if (u > 1) u = 1;
    if (Math.abs(dt) < 1e-9 && Math.abs(du) < 1e-9) break;
  }
  return { t: t, u: u };
}

// ---------- 主函数（严格 outside；多圈邻域 + 包容边界） ----------
export function estimateContinuousIsoFromXY(userX, userY, levels) {
  if (!isGridReady()) return { ok: false, reason: 'grid not ready' };

  // 快速边界判断（XY 映射整体范围）
  var b = _grid.bounds;
  if (!(userX >= b.Xmin && userX <= b.Xmax && userY >= b.Ymin && userY <= b.Ymax)) {
    return { ok: false, reason: 'outside_xy_bounds', bounds: b };
  }

  var nearest = findNearestGridPointByXY(userX, userY);
  if (!nearest) return { ok: false, reason: 'no nearest' };

  // 逐圈扩展：1 -> 2 -> 3（可调），包容边界判定
  var initialQuad = null;
  for (var ring = 1; ring <= 3 && !initialQuad; ring++) {
    var quads = collectQuadsAroundCenter(nearest, ring);
    for (var qi = 0; qi < quads.length; qi++) {
      var poly = quads[qi].map(function(p){ return {x:p.x, y:p.y}; });
      if (pointInPolygonInclusive(poly, {x:userX, y:userY}, 1e-9)) { initialQuad = quads[qi]; break; }
    }
  }
  if (!initialQuad) return { ok: false, reason: 'outside', nearestGrid: nearest };

  var finalQuad = refineToLevel(initialQuad, { x: userX, y: userY }, (typeof levels === 'number') ? levels : 8);
  var ord = orderQuadCorners(finalQuad);
  var inv = bilinearInvertXYToUV(userX, userY, ord.P00, ord.P10, ord.P01, ord.P11, 12);
  var V0 = ord.P00.VOC, V1 = ord.P10.VOC;
  var N0 = ord.P00.NOX, N1 = ord.P01.NOX;
  var VOCc = (1 - inv.t) * V0 + inv.t * V1;
  var NOXc = (1 - inv.u) * N0 + inv.u * N1;

  return { ok: true, estimate: { VOC: VOCc, NOX: NOXc }, uv: inv, finalQuad: finalQuad };
}

// 兼容旧脚本的角点版（严格遵守“在方格内才计算”的前提）
// 如果 estimateContinuousIsoFromXY 成功，则在最终细分四边形中选最近角点返回；
// 如果连续版失败（outside 等），保持失败不计算。
export function estimateFromXY(userX, userY, levels) {
  var est = estimateContinuousIsoFromXY(userX, userY, levels);
  if (!est || !est.ok) return est; // outside 或其他失败，保持严格不可估算

  var finalQuad = est.finalQuad || [];
  var bestCorner = null, bestD2 = Infinity;
  for (var i = 0; i < finalQuad.length; i++) {
    var corner = finalQuad[i];
    var d2 = dist2(userX, userY, corner.x, corner.y);
    if (d2 < bestD2) { bestD2 = d2; bestCorner = corner; }
  }
  if (bestCorner) {
    return { ok: true, estimate: { VOC: bestCorner.VOC, NOX: bestCorner.NOX }, finalQuad: finalQuad, chosenCorner: bestCorner };
  }
  // 理论上不会走到这里；兜底返回连续版结果
  return est;
}

export default {
  initGridFromCSV: initGridFromCSV,
  isGridReady: isGridReady,
  estimateContinuousIsoFromXY: estimateContinuousIsoFromXY,
  estimateFromXY: estimateFromXY,        // ← 新增
  buildGridFromRows: buildGridFromRows
};

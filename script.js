
// script.js — Trans‑EKMA Diagram, Evolution & Policy Sandbox (ES5 compatible)
// Pipeline: XY -> (VOC, NOx) via Locator1; (VOC', NOx') -> XY via Locator2
// - Real-time factor labels "✖1.xx"
// - Predicted point updates only on success; failure keeps previous
// - Blue diamond with black border; black arrow

// ------------------ Utilities ------------------
function getById(id) { return document.getElementById(id); }

function showPage(pageId) {
  var pages = document.querySelectorAll('.page');
  for (var i = 0; i < pages.length; i++) pages[i].classList.remove('active');
  var target = getById(pageId);
  if (target) {
    target.classList.add('active');
    try {
      var ev = (typeof CustomEvent === 'function')
        ? new CustomEvent('PAGE_CHANGE', { detail: { pageId: pageId } })
        : null;
      if (ev) window.dispatchEvent(ev);
    } catch (e) {}
    try { localStorage.setItem('CURRENT_PAGE', pageId); location.hash = '#' + pageId; } catch (e2) {}
  }
}

function findTraceIndexByMeta(div, meta) {
  var data = (div && div.data) ? div.data : [];
  for (var i = 0; i < data.length; i++) { if (data[i].meta === meta) return i; }
  return -1;
}

function hasBackground(div) {
  var data = (div && div.data) ? div.data : [];
  for (var i = 0; i < data.length; i++) {
    var t = data[i];
    if (t.legendgroup === 'VOC' || t.legendgroup === 'NOX') return true;
  }
  return false;
}

function drawBackground(containerId) {
  return new Promise(function (resolve) {
    if (window.TEKMA && typeof TEKMA.renderBackground === 'function') {
      TEKMA.renderBackground(containerId).then(function () { resolve(true); })
        .catch(function (e) { console.warn('renderBackground fail', e); resolve(false); });
    } else { resolve(false); }
  });
}

function drawBackgroundIfMissing(containerId) {
  return new Promise(function (resolve) {
    var div = getById(containerId);
    if (!div) return resolve();
    if (hasBackground(div)) return resolve();
    drawBackground(containerId).then(resolve);
  });
}

function getSelectedValues(selectEl) {
  var values = [];
  if (!selectEl) return values;
  var opts = selectEl.options || [];
  for (var i = 0; i < opts.length; i++) { if (opts[i].selected) values.push(opts[i].value); }
  return values;
}

// ------------------ Factor labels (✖1.xx) ------------------
function ensureFactorLabel(inputEl, spanId) {
  if (!inputEl) return null;
  var span = getById(spanId);
  if (!span) {
    span = document.createElement('span');
    span.id = spanId;
    span.style.marginLeft = '8px';
    span.style.fontWeight = '500';
    span.style.color = '#333';
    if (inputEl.parentNode) inputEl.parentNode.insertBefore(span, inputEl.nextSibling);
  }
  return span;
}

function formatFactorText(v) {
  var s = Number(v).toFixed(2);
  return '✖' + s;
}

function clampFactor(v) {
  if (!isFinite(v)) return 1;
  if (v < 0.05) return 0.05;
  if (v > 10) return 10;
  return v;
}

function getFactors() {
  var vocEl = getById('vocFactorInput');
  var noxEl = getById('noxFactorInput');
  var voc = (vocEl && vocEl.value !== '') ? parseFloat(vocEl.value) : 1;
  var nox = (noxEl && noxEl.value !== '') ? parseFloat(noxEl.value) : 1;
  voc = clampFactor(voc);
  nox = clampFactor(nox);
  return { voc: voc, nox: nox };
}

function syncFactorLabels() {
  var vocEl = getById('vocFactorInput');
  var noxEl = getById('noxFactorInput');
  var vocSpan = ensureFactorLabel(vocEl, 'vocFactorLabel');
  var noxSpan = ensureFactorLabel(noxEl, 'noxFactorLabel');
  var f = getFactors();
  if (vocSpan) vocSpan.textContent = formatFactorText(f.voc);
  if (noxSpan) noxSpan.textContent = formatFactorText(f.nox);
}

// ------------------ Annotations ------------------
function buildIsoAnnotation(x, y, voc, nox) {
  var text =
    '24NOX=' + x.toFixed(2) + '\n' +
    'M1M1O3=' + y.toFixed(2) + '\n' +
    'VOC≈' + voc.toFixed(2) + '\n' +
    'NOx≈' + nox.toFixed(2);
  return {
    x: x, y: y, xref: 'x', yref: 'y', text: text, showarrow: false,
    xshift: 14, yshift: 14, xanchor: 'left', yanchor: 'bottom', align: 'left',
    font: { color: 'red', size: 13 },
    bgcolor: 'rgba(255,255,255,0.85)', bordercolor: 'rgba(0,0,0,0.15)', borderwidth: 1, borderpad: 6
  };
}

function buildArrowAnnotation(fromX, fromY, toX, toY) {
  return {
    x: toX, y: toY, xref: 'x', yref: 'y', ax: fromX, ay: fromY, axref: 'x', ayref: 'y',
    showarrow: true, arrowcolor: '#000000', arrowsize: 1.2, arrowwidth: 2, arrowhead: 2
  };
}

function applySandboxAnnotations(div, annotations) {
  return Plotly.relayout(div, { annotations: annotations || [] });
}

// ------------------ Ensure both Locators ready ------------------
function ensureLocatorsReady() {
  return new Promise(function (resolve) {
    function ready1() {
      return (window.Locator1 && typeof window.Locator1.isGridReady === 'function' && window.Locator1.isGridReady());
    }
    function ready2() {
      return (window.Locator2 && typeof window.Locator2.isGridReady === 'function' && window.Locator2.isGridReady());
    }
    if (ready1() && ready2()) return resolve(true);

    var p1 = (window.Locator1 && typeof window.Locator1.initGridFromCSV === 'function')
      ? window.Locator1.initGridFromCSV() : Promise.resolve();
    var p2 = (window.Locator2 && typeof window.Locator2.initGridFromCSV === 'function')
      ? window.Locator2.initGridFromCSV() : Promise.resolve();

    Promise.all([p1, p2]).then(function () { resolve(ready1() && ready2()); })
      .catch(function (e) { console.error('ensureLocatorsReady failed', e); resolve(false); });
  });
}

// ------------------ Layers ------------------
function ensureLayer(div, meta, opts) {
  var idx = findTraceIndexByMeta(div, meta);
  if (idx >= 0) return idx;
  Plotly.addTraces(div, opts);
  return findTraceIndexByMeta(div, meta);
}

function ensureSandboxSelectedPointLayer(sandboxDiv) {
  return ensureLayer(sandboxDiv, 'SANDBOX_SELECTED_POINT', {
    x: [], y: [], mode: 'markers+text', type: 'scatter', name: 'Selected',
    meta: 'SANDBOX_SELECTED_POINT', legendgroup: 'SANDBOX',
    marker: { color: '#BEBEBE', size: 10, symbol: 'circle', line: { color: '#666666', width: 2 } },
    text: [], textposition: 'middle right', textoffset: [8, 0],
    textfont: { color: '#666666', size: 11 },
    hovertemplate: '%{text}NOₓ: %{x}O₃: %{y}', showlegend: true
  });
}

function ensureSandboxUserPointLayer(sandboxDiv) {
  return ensureLayer(sandboxDiv, 'SANDBOX_USER_POINT', {
    x: [], y: [], mode: 'markers+text', type: 'scatter', name: 'User Point',
    meta: 'SANDBOX_USER_POINT', legendgroup: 'SANDBOX',
    marker: { color: '#D32F2F', size: 8, symbol: 'diamond', line: { color: '#8B0000', width: 2 } },
    text: [], textposition: 'middle right', textoffset: [8, 0],
    textfont: { color: '#8B0000', size: 11 },
    hovertemplate: '%{text}NOₓ: %{x}O₃: %{y}', showlegend: true
  });
}

function ensureSandboxPredictedPointLayer(sandboxDiv) {
  return ensureLayer(sandboxDiv, 'SANDBOX_PREDICTED_POINT', {
    x: [], y: [], mode: 'markers+text', type: 'scatter', name: 'Predicted',
    meta: 'SANDBOX_PREDICTED_POINT', legendgroup: 'SANDBOX',
    marker: { color: '#1976D2', size: 8, symbol: 'diamond', line: { color: '#000000', width: 2 } },
    text: [], textposition: 'middle right', textoffset: [8, 0],
    textfont: { color: '#0D47A1', size: 11 },
    hovertemplate: '%{text}NOₓ: %{x}O₃: %{y}', showlegend: true
  });
}

// ------------------ Diagram ------------------
function initDiagram() {
  var plotDiv = getById('plot');
  if (!plotDiv) return;
  var afterBg = function () {
    if (window.SitesAPI && typeof SitesAPI.load === 'function') {
      SitesAPI.load('data/sites.csv').then(function () {
        var yearEl = getById('yearRange');
        var year = parseInt(yearEl ? yearEl.value : '2020', 10);
        var sites = getSelectedValues(getById('siteSelect'));
        if (window.SitesAPI && typeof SitesAPI.updateSelected === 'function') {
          SitesAPI.updateSelected(plotDiv, { sites: sites, year: year });
        }
      });
    }
  };
  if (!hasBackground(plotDiv)) drawBackground('plot').then(afterBg);
  else afterBg();
}

// ------------------ Evolution ------------------
var SITE_COLORS = {
  HK_AVE: '#1f77b4', CAUSEWAY_BAY: '#ff7f0e', CENTRAL: '#2ca02c', CENTRAL_WESTERN: '#d62728', KWAI_CHUNG: '#9467bd',
  KWUN_TONG: '#8c564b', MONG_KOK: '#e377c2', NORTH: '#7f7f7f', SHAM_SHUI_PO: '#bcbd22', SHATIN: '#17becf',
  SOUTHERN: '#1b9e77', TAI_PO: '#d95f02', TAP_MUN: '#7570b3', TSEUNG_KWAN_O: '#e7298a', TSUEN_WAN: '#66a61e',
  TUEN_MUN: '#e6ab02', TUNG_CHUNG: '#a6761d', YUEN_LONG: '#666666'
};

function initEvolution() {
  var evoPlot = getById('evoPlot');
  var evoTime = getById('evoTime');
  if (!evoPlot || !evoTime) return;

  var afterBg = function () {
    if (window.SitesAPI && typeof SitesAPI.load === 'function') {
      SitesAPI.load('data/sites.csv').then(function () {
        var yearMin = parseInt((getById('evoYearMin') || { value: '1995' }).value, 10);
        var yearMax = parseInt((getById('evoYearMax') || { value: '2024' }).value, 10);
        var sites = getSelectedValues(getById('evoSiteSelect'));

        var tracesXY = [];
        var tracesTS = [];

        for (var s = 0; s < sites.length; s++) {
          var st = sites[s];
          var series = (typeof SitesAPI.getSeries === 'function') ? SitesAPI.getSeries(st, yearMin, yearMax) : [];
          if (!series || !series.length) continue;

          var xs = [], ys = [], labels = [];
          for (var k = 0; k < series.length; k++) {
            xs.push(series[k].x);
            ys.push(series[k].y);
            labels.push(String(series[k].year));
          }
          var color = SITE_COLORS[st] || '#333';
          var siteName = (SitesAPI.LABELS && SitesAPI.LABELS[st]) ? SitesAPI.LABELS[st] : st.replace(/_/g, ' ');

          tracesXY.push({
            x: xs, y: ys, mode: 'lines+markers+text', type: 'scatter', name: siteName,
            line: { color: color, width: 2 }, marker: { color: color, size: 7 },
            text: labels, textposition: 'top center', textfont: { size: 10, color: color },
            hovertemplate: '%{text}24NOX: %{x}M1M1O3: %{y}'
          });

          var yearsNum = labels.map(function (t) { return parseInt(t, 10); });

          tracesTS.push({
            x: yearsNum, y: xs, mode: 'lines+markers', type: 'scatter', name: siteName + ' NOₓ',
            line: { color: color }, yaxis: 'y1', hovertemplate: '%{x}<br>24NOX: %{y}'
          });

          tracesTS.push({
            x: yearsNum, y: ys, mode: 'lines+markers', type: 'scatter', name: siteName + ' O₃',
            line: { color: color, dash: 'dot' }, yaxis: 'y2', hovertemplate: '%{x}<br>M1M1O3: %{y}'
          });
        }

        var layoutXY = {
          xaxis: { title: '24h NOₓ', zeroline: false, rangemode: 'tozero' },
          yaxis: { title: 'M1M1 O₃', zeroline: false, rangemode: 'tozero' },
          legend: { orientation: 'v', x: 1.02, y: 0.5 },
          margin: { l: 60, r: 160, t: 30, b: 60 },
          plot_bgcolor: '#fafafa'
        };
        var layoutTS = {
          xaxis: { title: 'Year' },
          yaxis: { title: '24h NOₓ' },
          yaxis2: { title: 'M1M1 O₃', overlaying: 'y', side: 'right' },
          legend: { orientation: 'h' },
          margin: { l: 60, r: 60, t: 30, b: 60 },
          plot_bgcolor: '#fff'
        };

        var evoData = tracesXY;
        if (hasBackground(evoPlot)) {
          var keep = [];
          for (var i = 0; i < evoPlot.data.length; i++) {
            var t = evoPlot.data[i];
            if (!(t.legendgroup === 'VOC' || t.legendgroup === 'NOX')) keep.push(t);
          }
          evoData = keep.concat(tracesXY);
        } else {
          drawBackground('evoPlot');
        }

        Plotly.react(evoPlot, evoData, layoutXY);
        Plotly.react(evoTime, tracesTS, layoutTS);
      });
    }
  };

  if (!hasBackground(evoPlot)) drawBackground('evoPlot').then(afterBg);
  else afterBg();
}

// ------------------ Sandbox (XY -> iso -> factors -> XY) ------------------
function initSandbox() {
  var sandboxDiv = getById('sandboxPlot');
  if (!sandboxDiv) return;

  // keep factor labels synced
  syncFactorLabels();

  drawBackgroundIfMissing('sandboxPlot').then(function () {
    if (window.SitesAPI && typeof SitesAPI.load === 'function') {
      SitesAPI.load('data/sites.csv').then(function () {
        // Source selection
        var src = 'site';
        var radios = document.querySelectorAll('input[name="sbSource"]');
        for (var i = 0; i < radios.length; i++) { if (radios[i].checked) { src = radios[i].value; break; } }

        var manualBox = getById('sbManual');
        var siteYearBox = getById('sbSiteYear');
        if (manualBox && siteYearBox) {
          var isManual = (src === 'manual');
          manualBox.style.display = isManual ? '' : 'none';
          siteYearBox.style.display = isManual ? 'none' : '';
        }

        // Ensure layers
        var idxSel = ensureSandboxSelectedPointLayer(sandboxDiv);
        var idxUser = ensureSandboxUserPointLayer(sandboxDiv);
        var idxPred = ensureSandboxPredictedPointLayer(sandboxDiv);

        // Base point
        var point = null;
        if (src === 'manual') {
          var x = parseFloat((getById('sbNOxInput') || {}).value);
          var y = parseFloat((getById('sbO3Input') || {}).value);
          if (isFinite(x) && isFinite(y)) {
            var label = 'User (' + x + ', ' + y + ')';
            Plotly.restyle(sandboxDiv, { x: [[x]], y: [[y]], text: [[label]] }, [idxUser]);
            point = { x: x, y: y, label: label };
          } else {
            Plotly.restyle(sandboxDiv, { x: [[]], y: [[]], text: [[]] }, [idxUser]);
          }
          Plotly.restyle(sandboxDiv, { x: [[]], y: [[]], text: [[]] }, [idxSel]);
        } else {
          var sbSiteSel = getById('sbSiteSelect');
          var sbYearInp = getById('sbYearRange');
          var sbYearVal = getById('sbYearVal');
          if (sbSiteSel && !sbSiteSel.value) sbSiteSel.value = 'HK_AVE';
          if (sbYearInp && !sbYearInp.value) sbYearInp.value = '2024';
          if (sbYearVal && sbYearInp) sbYearVal.textContent = sbYearInp.value;

          var site = sbSiteSel ? sbSiteSel.value : 'HK_AVE';
          var year = parseInt(sbYearInp ? sbYearInp.value : '2024', 10);
          var p = (window.SitesAPI && typeof SitesAPI.getPoint === 'function') ? SitesAPI.getPoint(site, year) : null;
          if (p && isFinite(p.x) && isFinite(p.y)) {
            Plotly.restyle(sandboxDiv, { x: [[p.x]], y: [[p.y]], text: [[p.label || '']] }, [idxSel]);
            point = { x: p.x, y: p.y, label: p.label };
          } else {
            Plotly.restyle(sandboxDiv, { x: [[]], y: [[]], text: [[]] }, [idxSel]);
          }
          Plotly.restyle(sandboxDiv, { x: [[]], y: [[]], text: [[]] }, [idxUser]);
        }

        var annotations = [];
        if (!point) { applySandboxAnnotations(sandboxDiv, annotations); return; }

        // STEP 1: XY -> (VOC, NOx) via Locator1 (prefer continuous iso)
        ensureLocatorsReady().then(function (ready) {
          if (!ready || !window.Locator1 || !window.Locator2) { applySandboxAnnotations(sandboxDiv, annotations); return; }

          var est = null;
          try {
            if (typeof window.Locator1.estimateContinuousIsoFromXY === 'function') {
              est = window.Locator1.estimateContinuousIsoFromXY(point.x, point.y, 8);
            } else if (typeof window.Locator1.estimateFromXY === 'function') {
              est = window.Locator1.estimateFromXY(point.x, point.y, 8); // corner fallback
            }
          } catch (e) { console.error('Locator1 estimate failed', e); }

          if (!est || !est.ok || !est.estimate) { applySandboxAnnotations(sandboxDiv, annotations); return; }

          var isoVOC = est.estimate.VOC;
          var isoNOX = est.estimate.NOX;

          // Red multi-line annotation at base point
          annotations.push(buildIsoAnnotation(point.x, point.y, isoVOC, isoNOX));

          // STEP 2: apply factors to iso
          var f = getFactors();
          var targetVOC = isoVOC * f.voc;
          var targetNOX = isoNOX * f.nox;

          // STEP 3: (VOC', NOx') -> XY via Locator2
          try {
            var xy = window.Locator2.interpolateXYFromVOCNOX(targetVOC, targetNOX);
            if (xy && isFinite(xy.x) && isFinite(xy.y)) {
              var px = xy.x, py = xy.y;
              var labelPred = 'Pred (' + px.toFixed(2) + ', ' + py.toFixed(2) + ')';
              Plotly.restyle(sandboxDiv, { x: [[px]], y: [[py]], text: [[labelPred]] }, [idxPred]);
              annotations.push(buildArrowAnnotation(point.x, point.y, px, py));
              // Diagnostics
              console.log('[Sandbox pipeline] baseXY=', point, 'iso=', {VOC:isoVOC, NOX:isoNOX},
                          'factors=', f, 'targetIso=', {VOC:targetVOC, NOX:targetNOX}, 'predXY=', {x:px,y:py});
            } else {
              console.warn('Locator2.interpolateXYFromVOCNOX returned no point; keeping previous predicted layer.');
            }
          } catch (e2) {
            console.error('Locator2.interpolateXYFromVOCNOX failed', e2);
          }

          applySandboxAnnotations(sandboxDiv, annotations);
        });
      });
    }
  });
}

// ------------------ Wiring ------------------
document.addEventListener('DOMContentLoaded', function () {
  // insert & sync factor labels
  syncFactorLabels();

  var hashPage = (location.hash) ? String(location.hash).replace('#', '') : '';
  var savedPage = null; try { savedPage = localStorage.getItem('CURRENT_PAGE'); } catch (e) {}
  var startPage = hashPage || savedPage || 'diagram';
  showPage(startPage);

  // Diagram
  var siteSelectEl = getById('siteSelect'); if (siteSelectEl) siteSelectEl.addEventListener('change', initDiagram);
  var yearRangeEl = getById('yearRange');
  if (yearRangeEl) {
    yearRangeEl.addEventListener('input', function () {
      var yrVal = getById('yearVal');
      var yr = getById('yearRange').value;
      if (yrVal) yrVal.textContent = yr;
      initDiagram();
    });
  }

  // Evolution
  var evoSel = getById('evoSiteSelect'); if (evoSel) evoSel.addEventListener('change', initEvolution);
  var evoMin = getById('evoYearMin'); if (evoMin) evoMin.addEventListener('input', initEvolution);
  var evoMax = getById('evoYearMax'); if (evoMax) evoMax.addEventListener('input', initEvolution);

  // Sandbox source & inputs
  var srcRadios = document.querySelectorAll('input[name="sbSource"]');
  for (var i = 0; i < srcRadios.length; i++) srcRadios[i].addEventListener('change', initSandbox);

  var sbSiteSelect = getById('sbSiteSelect'); if (sbSiteSelect) sbSiteSelect.addEventListener('change', initSandbox);
  var sbYearRange = getById('sbYearRange');
  if (sbYearRange) {
    sbYearRange.addEventListener('input', function () {
      var el = getById('sbYearVal'); var v = getById('sbYearRange').value;
      if (el) el.textContent = v;
      initSandbox();
    });
  }
  var sbNOxInput = getById('sbNOxInput'); if (sbNOxInput) sbNOxInput.addEventListener('input', initSandbox);
  var sbO3Input = getById('sbO3Input'); if (sbO3Input) sbO3Input.addEventListener('input', initSandbox);

  // Factor inputs: update labels + recompute
  var vocFactorInput = getById('vocFactorInput');
  if (vocFactorInput) vocFactorInput.addEventListener('input', function () { syncFactorLabels(); initSandbox(); });
  var noxFactorInput = getById('noxFactorInput');
  if (noxFactorInput) noxFactorInput.addEventListener('input', function () { syncFactorLabels(); initSandbox(); });

  // Initial render
  if (startPage === 'diagram') initDiagram();
  if (startPage === 'evolution') initEvolution();
  if (startPage === 'sandbox') initSandbox();
});

// Re-init page on tab switch
window.addEventListener('PAGE_CHANGE', function (ev) {
  var pageId = ev && ev.detail ? ev.detail.pageId : null;
  if (pageId === 'diagram') initDiagram();
  if (pageId === 'evolution') initEvolution();
  if (pageId === 'sandbox') { syncFactorLabels(); initSandbox(); }
});

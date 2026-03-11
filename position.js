
// [position.js] （ES Module）— 读取用户输入点，标注估算 VOC/NOX
// 依赖：tekma.js 提供的 window.PLOTLY_READY；算法模块 ./alg/locator.js

import { initGridFromCSV, isGridReady, estimateFromXY } from './alg/locator.js';

function findTraceIndexByMeta(metaTag, gd){
  const traces = gd?.data ?? (gd?._fullData ? gd._fullData.map(d=>d) : []);
  for (let i = 0; i < traces.length; i++){
    const tr = traces[i];
    if (tr && tr.meta === metaTag) return i;
  }
  return -1;
}

function upsertUserTraceSquare(x, y, voc, nox, gd){
  const idx = findTraceIndexByMeta('USER_POINT', gd);
  const nameText = `VOC=${voc.toFixed(2)}, NOX=${nox.toFixed(2)}`;
  if (idx >= 0){
    return Plotly.restyle(gd, {
      x: [[x]],
      y: [[y]],
      name: [[nameText]],
      'marker.color': [['red']],
      'marker.size': [[12]],
      'marker.symbol': [['diamond']]
    }, [idx]);
  } else {
    const trace = {
      x: [x], y: [y],
      mode: 'markers', name: nameText,
      marker: { color: 'red', size: 12, symbol: 'diamond' },
      meta: 'USER_POINT'
    };
    return Plotly.addTraces(gd, [trace]);
  }
}

function upsertEstimateCornerTrace(corner, gd){
  if (!corner) return Promise.resolve();
  const idx = findTraceIndexByMeta('EST_CORNER', gd);
  if (idx >= 0){
    return Plotly.restyle(gd, {
      x: [[corner.x]],
      y: [[corner.y]],
      'marker.color': [['blue']],
      'marker.size': [[2]],
      'marker.symbol': [['circle']]
    }, [idx]);
  } else {
    const trace = {
      x: [corner.x], y: [corner.y],
      mode: 'markers', name: '估算位置',
      marker: { color: 'blue', size: 2, symbol: 'circle' },
      meta: 'EST_CORNER'
    };
    return Plotly.addTraces(gd, [trace]);
  }
}

function annotateInputAndEstimate(x, y, voc, nox, gd){
  const text = `24NOX=${x.toFixed(2)}\nM1M1O3=${y.toFixed(2)}\nVOC≈${voc.toFixed(2)}\nNOx≈${nox.toFixed(2)}`;
  const ann = {
    x, y, xref: 'x', yref: 'y', text,
    showarrow: false, xshift: 14, yshift: 14,
    xanchor: 'left', yanchor: 'bottom', align: 'left',
    font: { color: 'red', size: 13 },
    bgcolor: 'rgba(255,255,255,0.85)',
    bordercolor: 'rgba(0,0,0,0.15)', borderwidth: 1, borderpad: 6
  };
  return Plotly.relayout(gd, { annotations: [ann] });
}

// 对外暴露按钮回调
window.plotUserPoint = function(levels = 8){
  const x = parseFloat(document.getElementById('userX')?.value);
  const y = parseFloat(document.getElementById('userY')?.value);
  if (!Number.isFinite(x) || !Number.isFinite(y)){
    alert('请输入有效的数字 X 和 Y');
    return;
  }

  if (!isGridReady()){
    alert('TEKMA 网格尚未准备好，请稍后重试');
    initGridFromCSV().catch(err => console.error('[position] 初始化网格失败：', err));
    return;
  }

  const ready = window.PLOTLY_READY;
  if (!ready || typeof ready.then !== 'function'){
    alert('图未就绪（tekma.js 尚未完成初始化）');
    return;
  }

  ready
    .then(gd => {
      const res = estimateFromXY(x, y, levels);
      if (!res || !res.ok){
        alert('输入点不在有效范围内。请检查 24NOX/M1M1O3 是否落在网格覆盖范围。');
        console.warn('[position] estimate failed:', res);
        return null;
      }
      return upsertUserTraceSquare(x, y, res.estimate.VOC, res.estimate.NOX, gd)
        .then(() => upsertEstimateCornerTrace(res.chosenCorner, gd))
        .then(() => annotateInputAndEstimate(x, y, res.estimate.VOC, res.estimate.NOX, gd))
        .then(() => res);
    })
    .then(res => { if (res) console.log('[estimate] 结果：', res); })
    .catch(err => console.error('[position] 绘制/估算失败：', err));
};

// 页面加载时预热算法网格（不依赖绘图就绪）
if (document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', () => {
    initGridFromCSV().catch(err => console.error('[position] 初始化网格失败：', err));
  });
} else {
  initGridFromCSV().catch(err => console.error('[position] 初始化网格失败：', err));
}

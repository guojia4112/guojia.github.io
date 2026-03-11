
// [sites.js] — 只负责添加站点散点；不做任何初始化/布局
// 依赖 window.PLOTLY_READY（由 tekma.js 提供）

(function(){
  'use strict';

  function addSitesTrace(gd){
    return new Promise(function(resolve, reject){
      Papa.parse('data/NOXO3.csv', {
        download: true,
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: function(res){
          const rows = (res.data || []).filter(r => r && r.NOX != null && r.O3 != null);
          const xValues = rows.map(r => parseFloat(r.NOX));
          const yValues = rows.map(r => parseFloat(r.O3));
          const siteNames = rows.map(r => r.site || '');
          const trace = {
            x: xValues,
            y: yValues,
            mode: 'markers+text',
            type: 'scatter',
            text: siteNames,
            textposition: 'top center',
            name: '站点数据',
            marker: { color: '#1f77b4', size: 8, opacity: 0.9 },
            meta: 'SITES'
          };
          Plotly.addTraces(gd, trace).then(resolve).catch(reject);
        },
        error: reject
      });
    });
  }

  // 等待底图就绪再添加站点
  if (window.PLOTLY_READY && typeof window.PLOTLY_READY.then === 'function'){
    window.PLOTLY_READY
      .then(gd => addSitesTrace(gd))
      .then(() => console.log('[sites] 站点数据已添加'))
      .catch(err => console.error('[sites] 添加站点失败:', err));
  } else {
    console.warn('[sites] PLOTLY_READY 不存在，无法添加站点');
  }
})();

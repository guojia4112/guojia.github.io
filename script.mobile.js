
// script.mobile.js — additive mobile UX enhancements (safe to load after script.js)
(function mobileEnhancements(){
  var MOBILE_MAX = 768;
  function isMobile(){ return (window.innerWidth || document.documentElement.clientWidth) <= MOBILE_MAX; }

  // Apply mobile-friendly relayout without changing data
  function applyMobileLayout(){
    var ids = ['plot','evoPlot','evoTime','sandboxPlot'];
    var charts = ids.map(function(id){ return document.getElementById(id); }).filter(Boolean);
    var mobile = isMobile();
    charts.forEach(function(div){
      try {
        var updates = {};
        // Touch-first interaction on phones
        if (mobile) updates.dragmode = 'pan';

        // Keep margins generous; legend tweaks for mobile
        if (div && div.id === 'evoTime') {
          updates['legend.orientation'] = 'h';
          updates['legend.x'] = 0; 
          updates['legend.y'] = 1.12; // place legend above
        }
        if (div && div.id === 'evoPlot') {
          // evoPlot: vertical legend on desktop; top horizontal on phones
          updates['legend.orientation'] = mobile ? 'h' : 'v';
          updates['legend.x'] = mobile ? 0 : 1.02;
          updates['legend.y'] = mobile ? 1.12 : 0.5;
        }
        Plotly.relayout(div, updates).then(function(){ Plotly.Plots.resize(div); });
      } catch(e){}
    });
  }

  var timer = null;
  function schedule(){ clearTimeout(timer); timer = setTimeout(applyMobileLayout, 120); }

  // Run once and on changes
  document.addEventListener('DOMContentLoaded', applyMobileLayout);
  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('orientationchange', function(){ setTimeout(applyMobileLayout, 200); }, { passive: true });

  // -------- Optional: hook into autoAdjustPlotHeight if provided by script.js --------
  function hookAutoHeight(){
    if (typeof window.autoAdjustPlotHeight === 'function') {
      try { window.autoAdjustPlotHeight(); } catch(e){}
      window.addEventListener('resize', function(){ setTimeout(window.autoAdjustPlotHeight, 120); }, { passive: true });
      window.addEventListener('orientationchange', function(){ setTimeout(window.autoAdjustPlotHeight, 200); }, { passive: true });
      document.addEventListener('DOMContentLoaded', function(){ try { window.autoAdjustPlotHeight(); } catch(e){} });
    }
  }
  hookAutoHeight();
})();

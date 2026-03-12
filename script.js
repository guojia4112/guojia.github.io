
/**
 * script.js — FINAL (readable, commented)
 * Sandbox tweaks per user's request:
 *  - No ISO annotation (buildIsoAnnotation returns null)
 *  - Append VOC/NOx only to Selected/User labels (NOT to Predicted)
 *  - Predicted label placed at TOP-RIGHT of the diamond with small offset
 *  - Selected/User labels placed at BOTTOM-RIGHT
 * Other pages (Diagram/Evolution) unchanged from the medium-font, margin-B setup.
 */

// --------------------------- Utilities ---------------------------
function getById(id){ return document.getElementById(id); }
function reloadTo(pageId){ try{ localStorage.setItem('CURRENT_PAGE', pageId);}catch(e){} location.hash = '#'+pageId; showPage(pageId); }
function showPage(pageId){
  var pages=document.querySelectorAll('.page');
  for(var i=0;i<pages.length;i++) pages[i].classList.remove('active');
  var target=getById(pageId);
  if(target){
    target.classList.add('active');
    try{ var ev=(typeof CustomEvent==='function')? new CustomEvent('PAGE_CHANGE',{detail:{pageId:pageId}}):null; if(ev) window.dispatchEvent(ev);}catch(e){}
    try{ localStorage.setItem('CURRENT_PAGE', pageId);}catch(e2){}
  }
}
function findTraceIndexByMeta(div,meta){ var data=(div&&div.data)?div.data:[]; for(var i=0;i<data.length;i++){ if(data[i].meta===meta) return i;} return -1; }
function hasBackground(div){ var data=(div&&div.data)?div.data:[]; for(var i=0;i<data.length;i++){ var t=data[i]; if(t.legendgroup==='VOC'||t.legendgroup==='NOX') return true;} return false; }
function drawBackground(containerId){ return new Promise(function(resolve){ if(window.TEKMA&&typeof TEKMA.renderBackground==='function'){ TEKMA.renderBackground(containerId).then(function(){resolve(true);}).catch(function(){resolve(false);}); } else { resolve(false);} }); }
function drawBackgroundIfMissing(containerId){ return new Promise(function(resolve){ var div=getById(containerId); if(!div) return resolve(); if(hasBackground(div)) return resolve(); drawBackground(containerId).then(resolve); }); }
function getSelectedValues(sel){ var v=[]; if(!sel) return v; var o=sel.options||[]; for(var i=0;i<o.length;i++){ if(o[i].selected) v.push(o[i].value);} return v; }

// ---------------------- Responsive helpers ----------------------
function ensureResponsive(div){ try{ if(!div) return; Plotly.relayout(div,{autosize:true}).then(function(){ Plotly.Plots.resize(div);}); }catch(e){} }
(function(){ var ids=['plot','evoPlot','evoTime','sandboxPlot']; var charts=ids.map(function(id){return getById(id);}).filter(Boolean); if(!charts.length) return; var t=null; window.addEventListener('resize',function(){ clearTimeout(t); t=setTimeout(function(){ charts.forEach(function(d){ try{ Plotly.Plots.resize(d);}catch(e){} }); },120); },{passive:true}); window.addEventListener('orientationchange',function(){ setTimeout(function(){ charts.forEach(function(d){ try{ Plotly.Plots.resize(d);}catch(e){} }); },200); },{passive:true}); if(typeof ResizeObserver==='function'){ var ro=new ResizeObserver(function(es){ es.forEach(function(e){ try{ Plotly.Plots.resize(e.target);}catch(err){} }); }); charts.forEach(function(d){ try{ ro.observe(d);}catch(e){} }); } var st=null; window.addEventListener('scroll',function(){ clearTimeout(st); st=setTimeout(function(){ charts.forEach(function(d){ try{ Plotly.Plots.resize(d);}catch(e){} }); },120); },{passive:true}); })();

// -------------------- Factor label helpers ----------------------
function ensureFactorLabel(el,id){ if(!el) return null; var s=getById(id); if(!s){ s=document.createElement('span'); s.id=id; s.style.marginLeft='8px'; s.style.fontSize='16px'; s.style.color='#333'; if(el.parentNode) el.parentNode.insertBefore(s, el.nextSibling);} return s; }
function formatFactorText(v){ return '✖'+Number(v).toFixed(2); }
function clampFactor(v){ if(!isFinite(v)) return 1; if(v<0.05) return 0.05; if(v>10) return 10; return v; }
function getFactors(){ var voc=parseFloat((getById('vocFactorInput')||{}).value)||1; var nox=parseFloat((getById('noxFactorInput')||{}).value)||1; return { voc:clampFactor(voc), nox:clampFactor(nox) }; }
function syncFactorLabels(){ var f=getFactors(); var vs=ensureFactorLabel(getById('vocFactorInput'),'vocFactorLabel'); var ns=ensureFactorLabel(getById('noxFactorInput'),'noxFactorLabel'); if(vs) vs.textContent=formatFactorText(f.voc); if(ns) ns.textContent=formatFactorText(f.nox); }

// --------------- ISO annotation — disabled globally --------------
function buildIsoAnnotation(){ return null; }

// ------------------------- Layer helpers ------------------------
function ensureLayer(div,meta,opt){ var i=findTraceIndexByMeta(div,meta); if(i>=0) return i; Plotly.addTraces(div,opt); return findTraceIndexByMeta(div,meta); }
function ensureSandboxSelectedPointLayer(sDiv){ return ensureLayer(sDiv,'SEL',{ x:[],y:[], mode:'markers+text', type:'scatter', name:'Selected', meta:'SEL', legendgroup:'SANDBOX', marker:{ color:'#BEBEBE', size:10, symbol:'circle', line:{ color:'#666', width:2 }}, text:[], textposition:'bottom right', textfont:{ size:12, color:'#333' }, textoffset:[4,12], hovertemplate:'%{text}<br>NOₓ: %{x}<br>O₃: %{y}', showlegend:true, visible:true }); }
function ensureSandboxUserPointLayer(sDiv){ return ensureLayer(sDiv,'USR',{ x:[],y:[], mode:'markers+text', type:'scatter', name:'User', meta:'USR', legendgroup:'SANDBOX', marker:{ color:'#D32F2F', size:10, symbol:'diamond', line:{ color:'#8B0000', width:2 }}, text:[], textposition:'bottom right', textfont:{ size:12, color:'#333' }, textoffset:[4,12], hovertemplate:'%{text}<br>NOₓ: %{x}<br>O₃: %{y}', showlegend:true, visible:true }); }
function ensureSandboxPredictedPointLayer(sDiv){ return ensureLayer(sDiv,'PRED',{ x:[],y:[], mode:'markers+text', type:'scatter', name:'Predicted', meta:'PRED', legendgroup:'SANDBOX', marker:{ color:'#1976D2', size:10, symbol:'diamond', line:{ color:'#000', width:2 }}, text:[], textposition:'top right', textfont:{ size:12, color:'#333' }, textoffset:[4,-12], hovertemplate:'%{text}<br>NOₓ: %{x}<br>O₃: %{y}', showlegend:true, visible:true }); }

// --------------------------- Diagram ----------------------------
function initDiagram(){ var plotDiv=getById('plot'); if(!plotDiv) return; var afterBg=function(){ if(window.SitesAPI&&typeof SitesAPI.load==='function'){ SitesAPI.load('data/sites.csv').then(function(){ var yearEl=getById('yearRange'); var year=parseInt(yearEl?yearEl.value:'2020',10); var sites=getSelectedValues(getById('siteSelect')); if(typeof SitesAPI.updateSelected==='function'){ SitesAPI.updateSelected(plotDiv,{ sites:sites, year:year }); }
  Plotly.relayout(plotDiv,{ 'font.size':16,'legend.font.size':14,'xaxis.title.font.size':18,'yaxis.title.font.size':18,'xaxis.tickfont.size':14,'yaxis.tickfont.size':14,'margin.l':110,'margin.r':140,'margin.t':80,'margin.b':100 }); ensureResponsive(plotDiv); }); } }; if(!hasBackground(plotDiv)) drawBackground('plot').then(afterBg); else afterBg(); }

// -------------------------- Evolution ---------------------------
var SITE_COLORS={ HK_AVE:'#1f77b4',CAUSEWAY_BAY:'#ff7f0e',CENTRAL:'#2ca02c',CENTRAL_WESTERN:'#d62728',KWAI_CHUNG:'#9467bd',KWUN_TONG:'#8c564b',MONG_KOK:'#e377c2',NORTH:'#7f7f7f',SHAM_SHUI_PO:'#bcbd22',SHATIN:'#17becf',SOUTHERN:'#1b9e77',TAI_PO:'#d95f02',TAP_MUN:'#7570b3',TSEUNG_KWAN_O:'#e7298a',TSUEN_WAN:'#66a61e',TUEN_MUN:'#e6ab02',TUNG_CHUNG:'#a6761d',YUEN_LONG:'#666666' };
function initEvolution(){ var evoPlot=getById('evoPlot'); var evoTime=getById('evoTime'); if(!evoPlot||!evoTime) return; drawBackgroundIfMissing('evoPlot').then(function(){ if(window.SitesAPI&&typeof SitesAPI.load==='function'){ SitesAPI.load('data/sites.csv').then(function(){ var yearMin=parseInt((getById('evoYearMin')||{value:'1995'}).value,10); var yearMax=parseInt((getById('evoYearMax')||{value:'2024'}).value,10); var sites=getSelectedValues(getById('evoSiteSelect'));
  var tracesXY=[], tracesTS=[]; for(var s=0;s<sites.length;s++){ var st=sites[s]; var series=(typeof SitesAPI.getSeries==='function')?SitesAPI.getSeries(st,yearMin,yearMax):[]; if(!series||!series.length) continue; var xs=[],ys=[],labels=[]; for(var k=0;k<series.length;k++){ xs.push(series[k].x); ys.push(series[k].y); labels.push(String(series[k].year)); } var color=SITE_COLORS[st]||'#333'; var siteName=(SitesAPI.LABELS&&SitesAPI.LABELS[st])?SitesAPI.LABELS[st]:st.replace(/\_/g,' ');
  tracesXY.push({ x:xs,y:ys, mode:'lines+markers+text', type:'scatter', name:siteName, line:{color:color,width:2}, marker:{color:color,size:7}, text:labels, textposition:'top center', textfont:{size:12,color:color}, hovertemplate:'%{text}<br>24NOX: %{x}<br>M1M1O3: %{y}' }); var yearsNum=labels.map(function(t){return parseInt(t,10);}); tracesTS.push({ x:yearsNum,y:xs,mode:'lines+markers',type:'scatter',name:siteName+' 24NOₓ',line:{color:color},yaxis:'y1',hovertemplate:'%{x}<br>24NOX: %{y}' }); tracesTS.push({ x:yearsNum,y:ys,mode:'lines+markers',type:'scatter',name:siteName+' Daily range of hourly O₃',line:{color:color,dash:'dot'},yaxis:'y2',hovertemplate:'%{x}<br>M1M1O3: %{y}' }); }
  var layoutXY={ uirevision:'evo', xaxis:{ title:{text:'24-hour NOx (ppb)'}, zeroline:false, rangemode:'tozero', automargin:true }, yaxis:{ title:{text:'Daily range of hourly O₃ (max–min, ppb)'}, zeroline:false, rangemode:'tozero', automargin:true }, legend:{ orientation:'v', x:1.02, y:0.5, font:{size:14} }, margin:{ l:110, r:140, t:80, b:100 }, font:{size:16}, plot_bgcolor:'#fafafa' };
  var layoutTS={ uirevision:'evo', xaxis:{ title:{text:'Year'}, automargin:true }, yaxis:{ title:{text:'24-hour NOx (ppb)'}, automargin:true }, yaxis2:{ title:{text:'Daily range of hourly O₃ (max–min, ppb)'}, overlaying:'y', side:'right', automargin:true }, legend:{ orientation:'h', font:{size:14} }, margin:{ l:110, r:140, t:80, b:100 }, font:{size:16}, plot_bgcolor:'#fff' };
  var evoData; if(hasBackground(evoPlot)){ var bg=[]; for(var i=0;i<evoPlot.data.length;i++){ var t=evoPlot.data[i]; if(t.legendgroup==='VOC'||t.legendgroup==='NOX') bg.push(t);} evoData=bg.concat(tracesXY);} else { evoData=tracesXY; }
  Plotly.react(evoPlot, evoData, layoutXY, {responsive:true}).then(function(){ return Plotly.relayout(evoPlot,{ 'xaxis.title.text':'24-hour NOx (ppb)', 'yaxis.title.text':'Daily range of hourly O₃ (max–min, ppb)' }); }).then(function(){ ensureResponsive(evoPlot); });
  Plotly.react(evoTime, tracesTS, layoutTS, {responsive:true}).then(function(){ return Plotly.relayout(evoTime,{ 'xaxis.title.text':'Year', 'yaxis.title.text':'24-hour NOx (ppb)', 'yaxis2.title.text':'Daily range of hourly O₃ (max–min, ppb)' }); }).then(function(){ ensureResponsive(evoTime); });
}); }}); }

// ---------------------------- Sandbox ---------------------------
function initSandbox(){
  var sandboxDiv=getById('sandboxPlot'); if(!sandboxDiv) return;
  var RUN_ID=(window.SANDBOX_RUN_ID||0)+1; window.SANDBOX_RUN_ID=RUN_ID;
  syncFactorLabels();

  drawBackgroundIfMissing('sandboxPlot').then(function(){
    if(window.SANDBOX_RUN_ID!==RUN_ID) return;

    // Ensure initial plot
    try{
      var needInit=!(sandboxDiv && sandboxDiv.data && sandboxDiv._fullLayout);
      if(needInit){
        Plotly.newPlot(sandboxDiv, [], {
          xaxis:{ title:{text:'24-hour NOx (ppb)'}, zeroline:false, rangemode:'tozero', automargin:true },
          yaxis:{ title:{text:'Daily range of hourly O₃ (max–min, ppb)'}, zeroline:false, rangemode:'tozero', automargin:true },
          margin:{ l:110, r:140, t:80, b:100 },
          plot_bgcolor:'#fafafa', legend:{ orientation:'v', x:1.02, y:0.5, font:{size:14} }, font:{size:16}
        }, {responsive:true});
      }
    }catch(e){ console.warn('Plotly.newPlot init failed:', e); }

    if(window.SitesAPI&&typeof SitesAPI.load==='function'){
      SitesAPI.load('data/sites.csv').then(function(){
        if(window.SANDBOX_RUN_ID!==RUN_ID) return;

        // Determine source mode
        var src='site'; var radios=document.querySelectorAll('input[name="sbSource"]');
        for(var i=0;i<radios.length;i++){ if(radios[i].checked){ src=radios[i].value; break; } }

        // Toggle panels
        var manualBox=getById('sbManual'); var siteYearBox=getById('sbSiteYear');
        if(manualBox&&siteYearBox){ var isManual=(src==='manual'); manualBox.style.display=isManual?'':'none'; siteYearBox.style.display=isManual?'none':''; }

        // Layers
        var idxSel=ensureSandboxSelectedPointLayer(sandboxDiv);
        var idxUsr=ensureSandboxUserPointLayer(sandboxDiv);
        var idxPre=ensureSandboxPredictedPointLayer(sandboxDiv);
        if(idxSel<0||idxUsr<0||idxPre<0){ console.error('[Sandbox] ensure layers failed'); return; }

        // Working point
        var point=null; // {x,y,label}
        if(src==='manual'){
          var x=parseFloat((getById('sbNOxInput')||{}).value);
          var y=parseFloat((getById('sbO3Input')||{}).value);
          if(isFinite(x)&&isFinite(y)){
            var userLabel='User ('+x+', '+y+')';
            Plotly.restyle(sandboxDiv,{ x:[[x]], y:[[y]], text:[[userLabel]], visible:true }, [idxUsr]);
            try{ Plotly.relayout(sandboxDiv,{ 'xaxis.autorange':true, 'yaxis.autorange':true }); }catch(e){}
            point={ x:x, y:y, label:userLabel };
          } else {
            Plotly.restyle(sandboxDiv,{ x:[[]], y:[[]], text:[[]] }, [idxUsr]);
          }
          // Selected empty in manual
          Plotly.restyle(sandboxDiv,{ x:[[]], y:[[]], text:[[]] }, [idxSel]);
        } else {
          var sbSiteSel=getById('sbSiteSelect'); var sbYearInp=getById('sbYearRange'); var sbYearVal=getById('sbYearVal');
          if(sbSiteSel && !sbSiteSel.value) sbSiteSel.value='HK_AVE';
          if(sbYearInp && !sbYearInp.value) sbYearInp.value='2024';
          if(sbYearVal && sbYearInp) sbYearVal.textContent=sbYearInp.value;
          var site=sbSiteSel?sbSiteSel.value:'HK_AVE'; var year=parseInt(sbYearInp?sbYearInp.value:'2024',10);
          var p=(typeof SitesAPI.getPoint==='function')? SitesAPI.getPoint(site,year):null;
          if(p && isFinite(p.x) && isFinite(p.y)){
            Plotly.restyle(sandboxDiv,{ x:[[p.x]], y:[[p.y]], text:[[p.label||'']], visible:true }, [idxSel]);
            try{ Plotly.relayout(sandboxDiv,{ 'xaxis.autorange':true, 'yaxis.autorange':true }); }catch(e){}
            point={ x:p.x, y:p.y, label:p.label };
          } else {
            Plotly.restyle(sandboxDiv,{ x:[[]], y:[[]], text:[[]] }, [idxSel]);
          }
          // User empty in site mode
          Plotly.restyle(sandboxDiv,{ x:[[]], y:[[]], text:[[]] }, [idxUsr]);
        }

        // If no point, clear and exit
        var annotations=[]; if(!point){ applySandboxAnnotations(sandboxDiv, annotations); ensureResponsive(sandboxDiv); return; }

        // Estimate ISO values
        ensureLocatorsReady().then(function(ready){
          if(window.SANDBOX_RUN_ID!==RUN_ID) return;
          if(!ready || !window.Locator1 || !window.Locator2){ applySandboxAnnotations(sandboxDiv, annotations); ensureResponsive(sandboxDiv); return; }

          var est=null; try{
            if(typeof Locator1.estimateContinuousIsoFromXY==='function') est=Locator1.estimateContinuousIsoFromXY(point.x, point.y, 8);
            else if(typeof Locator1.estimateFromXY==='function') est=Locator1.estimateFromXY(point.x, point.y, 8);
          }catch(e){ console.error('Locator1 estimate failed', e); }
          if(!est||!est.ok||!est.estimate){ Plotly.restyle(sandboxDiv,{ x:[[]], y:[[]], text:[[]] }, [idxPre]); applySandboxAnnotations(sandboxDiv, annotations); ensureResponsive(sandboxDiv); return; }

          var isoVOC=est.estimate.VOC; var isoNOX=est.estimate.NOX;

          // Append VOC/NOx ONLY to Selected/User labels (NOT Predicted)
          if(src==='manual'){
            var userLabelFull=(point.label||'') + '  VOC≈'+isoVOC.toFixed(2)+', NOx≈'+isoNOX.toFixed(2);
            Plotly.restyle(sandboxDiv,{ text:[[userLabelFull]], textposition:'bottom right', textfont:[{size:12,color:'#333'}], textoffset:[[4,12]] }, [idxUsr]);
          } else {
            var selLabelFull=(point.label||'').replace(/\)\s*$/, '') + ')  VOC≈'+isoVOC.toFixed(2)+', NOx≈'+isoNOX.toFixed(2);
            Plotly.restyle(sandboxDiv,{ text:[[selLabelFull]], textposition:'bottom right', textfont:[{size:12,color:'#333'}], textoffset:[[4,12]] }, [idxSel]);
          }

          // Apply factors & predict target point
          var f=getFactors(); var targetVOC=isoVOC*f.voc; var targetNOX=isoNOX*f.nox;
          try{
            var xy=Locator2.interpolateXYFromVOCNOX(targetVOC, targetNOX);
            if(xy && xy.ok && isFinite(xy.x) && isFinite(xy.y)){
              var px=xy.x, py=xy.y;
              var predLabel='Pred ('+px.toFixed(2)+', '+py.toFixed(2)+')'; // NO VOC/NOx appended here
              Plotly.restyle(sandboxDiv,{
                x:[[px]], y:[[py]], text:[[predLabel]], visible:true,
                textposition:'top right', textfont:[{size:12,color:'#333'}], textoffset:[[4,-12]]
              }, [idxPre]);
              try{ Plotly.relayout(sandboxDiv,{ 'xaxis.autorange':true, 'yaxis.autorange':true }); }catch(e){}
              // ISO annotation disabled
              var isoAnn=buildIsoAnnotation(point.x, point.y, isoVOC, isoNOX); if(isoAnn) annotations.push(isoAnn);
            } else {
              Plotly.restyle(sandboxDiv,{ x:[[]], y:[[]], text:[[]] }, [idxPre]);
            }
          }catch(e2){ console.error('Locator2.interpolateXYFromVOCNOX failed', e2); }

          applySandboxAnnotations(sandboxDiv, annotations);
          ensureResponsive(sandboxDiv);
        });
      });
    }
  });
}

// --------------- Annotation apply helper ---------------
function applySandboxAnnotations(div, annotations){ return Plotly.relayout(div,{ annotations: annotations||[] }); }

// ------------------- Locator readiness -----------------
function ensureLocatorsReady(){ return new Promise(function(resolve){ function r1(){ return (window.Locator1&&typeof Locator1.isGridReady==='function'&&Locator1.isGridReady()); } function r2(){ return (window.Locator2&&typeof Locator2.isGridReady==='function'&&Locator2.isGridReady()); } if(r1()&&r2()) return resolve(true); var p1=(Locator1&&Locator1.initGridFromCSV)?Locator1.initGridFromCSV():Promise.resolve(); var p2=(Locator2&&Locator2.initGridFromCSV)?Locator2.initGridFromCSV():Promise.resolve(); Promise.all([p1,p2]).then(function(){ resolve(r1()&&r2()); }).catch(function(){ resolve(false); }); }); }

// --------------------------- Wiring -----------------------------
document.addEventListener('DOMContentLoaded', function(){
  syncFactorLabels();
  var hashPage=(location.hash)?String(location.hash).replace('#',''):''; var savedPage=null; try{ savedPage=localStorage.getItem('CURRENT_PAGE'); }catch(e){}
  var startPage=hashPage||savedPage||'diagram'; showPage(startPage);
  var siteSelectEl=getById('siteSelect'); if(siteSelectEl) siteSelectEl.addEventListener('change', initDiagram);
  var yearRangeEl=getById('yearRange'); if(yearRangeEl){ yearRangeEl.addEventListener('input', function(){ var yrVal=getById('yearVal'); var yr=getById('yearRange').value; if(yrVal) yrVal.textContent=yr; initDiagram(); }); }
  var evoSel=getById('evoSiteSelect'); if(evoSel) evoSel.addEventListener('change', initEvolution);
  var evoMin=getById('evoYearMin'); if(evoMin) evoMin.addEventListener('input', initEvolution);
  var evoMax=getById('evoYearMax'); if(evoMax) evoMax.addEventListener('input', initEvolution);
  var srcRadios=document.querySelectorAll('input[name="sbSource"]'); for(var i=0;i<srcRadios.length;i++) srcRadios[i].addEventListener('change', initSandbox);
  var sbSiteSelect=getById('sbSiteSelect'); if(sbSiteSelect) sbSiteSelect.addEventListener('change', initSandbox);
  var sbYearRange=getById('sbYearRange'); if(sbYearRange){ sbYearRange.addEventListener('input', function(){ var el=getById('sbYearVal'); var v=getById('sbYearRange').value; if(el) el.textContent=v; initSandbox(); }); }
  var sbNOxInput=getById('sbNOxInput'); if(sbNOxInput) sbNOxInput.addEventListener('input', initSandbox);
  var sbO3Input=getById('sbO3Input'); if(sbO3Input) sbO3Input.addEventListener('input', initSandbox);
  var vocFactorInput=getById('vocFactorInput'); if(vocFactorInput) vocFactorInput.addEventListener('input', function(){ syncFactorLabels(); initSandbox(); });
  var noxFactorInput=getById('noxFactorInput'); if(noxFactorInput) noxFactorInput.addEventListener('input', function(){ syncFactorLabels(); initSandbox(); });
  if(startPage==='diagram') initDiagram(); if(startPage==='evolution') initEvolution(); if(startPage==='sandbox') initSandbox();
});

window.addEventListener('PAGE_CHANGE', function(ev){ var pageId=ev&&ev.detail?ev.detail.pageId:null; if(pageId==='diagram') initDiagram(); if(pageId==='evolution') initEvolution(); if(pageId==='sandbox') initSandbox(); });

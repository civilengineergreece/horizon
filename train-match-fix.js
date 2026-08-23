(()=>{
'use strict';

const TRAIN_DESTINATIONS=new Set(['Θεσσαλονίκη','Μετέωρα']);

function stateNow(){try{return typeof state!=='undefined'&&state?state:{};}catch{return {};}}
function trainSelected(){
  const raw=stateNow().transport;
  const sel=Array.isArray(raw)?raw:[raw||'any'];
  return sel.includes('train');
}
function ensureTrainModes(){
  (window.HORIZON_DESTINATIONS||[]).forEach(d=>{
    if(!TRAIN_DESTINATIONS.has(d.name))return;
    if(!Array.isArray(d.transport))d.transport=[];
    if(!d.transport.includes('train'))d.transport.push('train');
  });
}
function hasVisibleTrainResult(){
  return [...document.querySelectorAll('#resultsCard .destination')].some(card=>{
    const name=card.querySelector('h4')?.textContent?.trim();
    return TRAIN_DESTINATIONS.has(name);
  });
}
function scoreTrainCandidates(){
  const source=(window.HORIZON_DESTINATIONS||[]).filter(d=>TRAIN_DESTINATIONS.has(d.name));
  return source.map(d=>{
    let r;
    try{r=typeof scoreDest==='function'?scoreDest(d):{...d};}catch{r={...d};}
    const interests=Array.isArray(stateNow().interests)?stateNow().interests:[];
    const hits=interests.filter(x=>(d.tags||[]).includes(x)).length;
    return {
      ...r,
      transport:Array.isArray(r.transport)?r.transport:d.transport,
      hardExcluded:false,
      score:(Number(r.score)||0)+hits*3,
      fit:Math.max(Number(r.fit)||0,hits?86:72),
      why:r.why||'Σιδηροδρομική επιλογή που ταιριάζει στις προτιμήσεις σου.'
    };
  }).sort((a,b)=>(Number(b.score)||0)-(Number(a.score)||0));
}
function repairResults(){
  if(!trainSelected())return;
  ensureTrainModes();
  const root=document.getElementById('resultsCard');
  if(!root||root.classList.contains('hidden'))return;
  const empty=!root.querySelector('.destination');
  if(!empty&&hasVisibleTrainResult())return;

  // Το τρένο είναι σκληρό κριτήριο μετακίνησης. Τα ενδιαφέροντα επηρεάζουν
  // τη βαθμολογία, δεν πρέπει όμως να μηδενίζουν όλα τα αποτελέσματα.
  const candidates=scoreTrainCandidates();
  if(!candidates.length)return;
  try{
    if(typeof scored!=='undefined')scored=candidates;
    if(typeof renderResults==='function')renderResults('match','all');
  }catch{}

  // Αν παλιότερο wrapper ξαναφιλτράρει το array, δεύτερη προσπάθεια χωρίς
  // παλιό κρυφό όριο χρόνου.
  if(!root.querySelector('.destination')){
    try{
      const st=stateNow();
      if(Object.prototype.hasOwnProperty.call(st,'maxTravelHours'))delete st.maxTravelHours;
      if(typeof scored!=='undefined')scored=candidates.map(x=>({...x,hardExcluded:false}));
      if(typeof renderResults==='function')renderResults('match','all');
      if(typeof save==='function')save();
    }catch{}
  }
}
function wrapRender(){
  if(window.__HZ_TRAIN_MATCH_RENDER_FIX__||typeof window.renderResults!=='function')return false;
  window.__HZ_TRAIN_MATCH_RENDER_FIX__=true;
  const base=window.renderResults;
  window.renderResults=function(...args){
    ensureTrainModes();
    const out=base.apply(this,args);
    if(trainSelected())setTimeout(repairResults,0);
    return out;
  };
  return true;
}
function wrapShow(){
  if(window.__HZ_TRAIN_MATCH_SHOW_FIX__||typeof window.showResults!=='function')return false;
  window.__HZ_TRAIN_MATCH_SHOW_FIX__=true;
  const base=window.showResults;
  window.showResults=function(...args){
    ensureTrainModes();
    const st=stateNow();
    if(Object.prototype.hasOwnProperty.call(st,'maxTravelHours'))delete st.maxTravelHours;
    const out=base.apply(this,args);
    setTimeout(repairResults,0);setTimeout(repairResults,120);
    return out;
  };
  return true;
}
function boot(){
  ensureTrainModes();
  let tries=0;
  (function tick(){
    const ok=wrapRender()&wrapShow();
    if(ok||++tries>50)return;
    setTimeout(tick,50);
  })();
  document.addEventListener('click',()=>setTimeout(repairResults,80),true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

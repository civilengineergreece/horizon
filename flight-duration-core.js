(()=>{
'use strict';

const ATH_FLIGHT_MINUTES={
  'Θεσσαλονίκη':50,'Ιωάννινα':60,'Νάξος':45,'Σύρος':35,'Ρόδος':60,
  'Κέρκυρα':65,'Σαντορίνη':50,'Μύκονος':45,'Πάρος':40,'Μήλος':40,
  'Χίος':50,'Λέσβος':60,'Σάμος':60,'Κως':60,'Κάρπαθος':75,
  'Σκιάθος':40,'Κρήτη':55
};

function norm(v){return String(v||'').trim().toLocaleLowerCase('el-GR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
function isAthensOrigin(){const s=norm(typeof state!=='undefined'?state?.origin:'');return /αθην|athens|athina|αττικ/.test(s);}
function minutesFor(name){return isAthensOrigin()?ATH_FLIGHT_MINUTES[String(name||'').trim()]||null:null;}
function hoursFor(name){const m=minutesFor(name);return m?m/60:null;}
function isPlaneResult(r){return r?.transportMode==='plane'||r?.transportDetails?.mode==='plane'||(typeof state!=='undefined'&&state?.transport==='plane');}
function otherHardConstraints(d){
  const modeCompatible=state?.transport==='any'||!state?.transport||d.transport?.includes?.(state.transport);
  const seaRequired=Array.isArray(state?.interests)&&state.interests.includes('sea');
  const seaCompatible=!seaRequired||d.tags?.includes?.('sea');
  const hardStyle=state?.style==='city'||state?.style==='nature';
  const styleCompatible=!hardStyle||d.type===state.style;
  return modeCompatible&&seaCompatible&&styleCompatible;
}
function correctedResult(d,r){
  const h=hoursFor(d?.name);
  if(!h||!isPlaneResult(r))return r;
  const details=r.transportDetails?{...r.transportDetails,hours:h}:r.transportDetails;
  const timeLimit=Number(r.timeLimit)||null;
  const timeCompatible=!timeLimit||h<=timeLimit;
  return {...r,travelHours:h,transportDetails:details,hardExcluded:!(otherHardConstraints(d)&&timeCompatible)};
}
function labelFor(name){
  const m=minutesFor(name);if(!m)return null;
  if(m<60)return `~${m} λεπτά πτήση`;
  const h=Math.floor(m/60),rest=m%60;
  return rest?`~${h}ω ${rest}λ πτήση`:`~${h} ώρα πτήση`;
}
function replaceTimeText(el,label){
  if(!el||!label)return;
  const current=el.textContent||'';
  let next=current
    .replace(/\s*·\s*~?[\d,.]+\s*ώρες?\s*διαδρομ(?:ή|η)?/i,'')
    .replace(/\s*·\s*~?[\d,.]+\s*λεπτά?\s*πτήση/i,'')
    .trim();
  next+=` · ${label}`;
  if(current.trim()!==next)el.textContent=next;
}
function patchCards(){
  document.querySelectorAll('#resultsCard .destination').forEach(card=>{
    const name=card.querySelector('h4')?.textContent?.trim();
    const label=labelFor(name);if(!label)return;
    const modeText=(card.querySelector('.break')?.textContent||'').toLowerCase();
    if(!/αερο|πτήσ|plane/.test(modeText)&&state?.transport!=='plane')return;
    replaceTimeText(card.querySelector('.region'),label);
  });
}
function patchOverlay(){
  document.querySelectorAll('.horizon-detail-overlay').forEach(overlay=>{
    const name=overlay.querySelector('.hd-head h3')?.textContent?.trim();
    const label=labelFor(name);if(!label)return;
    const pane=overlay.querySelector('[data-pane="transport"]');
    if(!pane)return;
    const plane=(pane.textContent||'').toLowerCase();
    if(!/αερο|πτήσ|plane/.test(plane)&&state?.transport!=='plane')return;
    replaceTimeText(overlay.querySelector('.hd-sub'),label);
    pane.querySelectorAll('.hd-card').forEach(card=>{
      if(/χρόνος/i.test(card.querySelector('small')?.textContent||'')){
        const value=card.querySelector('b');
        const text=label.replace(/^~/,'');
        if(value&&value.textContent!==text)value.textContent=text;
      }
    });
  });
}
function patch(){patchCards();patchOverlay();}

function install(){
  if(window.__HORIZON_FLIGHT_DURATION_CORE__)return;
  window.__HORIZON_FLIGHT_DURATION_CORE__=true;
  if(typeof window.calcCost==='function'){
    const base=window.calcCost;
    window.calcCost=function(d){return correctedResult(d,base(d));};
  }
  if(typeof window.scoreDest==='function'){
    const base=window.scoreDest;
    window.scoreDest=function(d){return correctedResult(d,base(d));};
  }
  if(typeof window.renderResults==='function'){
    const base=window.renderResults;
    window.renderResults=function(...args){const out=base.apply(this,args);patchCards();return out;};
  }
  document.addEventListener('click',e=>{
    const action=e.target.closest('.destination .actions a,.destination .actions button');
    if(!action)return;
    setTimeout(patchOverlay,30);
  },true);
  patch();
}

window.HorizonFlightDurationCore={patch,minutesFor};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

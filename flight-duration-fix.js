(()=>{
'use strict';

// Scheduled non-stop flight time from Athens (ATH), rounded to a useful UI value.
// This replaces the old broad regional estimate (e.g. every Greek flight ≈3h).
const ATH_FLIGHT_MINUTES={
  'Θεσσαλονίκη':50,
  'Ιωάννινα':60,
  'Νάξος':45,
  'Σύρος':35,
  'Ρόδος':60,
  'Κέρκυρα':65,
  'Σαντορίνη':50,
  'Μύκονος':45,
  'Πάρος':40,
  'Μήλος':40,
  'Χίος':50,
  'Λέσβος':60,
  'Σάμος':60,
  'Κως':60,
  'Κάρπαθος':75,
  'Σκιάθος':40,
  'Κρήτη':55
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
function installWrappers(){
  if(window.__HORIZON_FLIGHT_DURATION_FIX__)return;
  window.__HORIZON_FLIGHT_DURATION_FIX__=true;
  if(typeof window.calcCost==='function'){
    const baseCalc=window.calcCost;
    window.calcCost=function(d){return correctedResult(d,baseCalc(d));};
  }
  if(typeof window.scoreDest==='function'){
    const baseScore=window.scoreDest;
    window.scoreDest=function(d){return correctedResult(d,baseScore(d));};
  }
  try{
    if(typeof scored!=='undefined'&&Array.isArray(scored)){
      scored.forEach((r,i)=>{const d=(window.HORIZON_DESTINATIONS||[]).find(x=>x.name===r.name)||r;scored[i]=correctedResult(d,r);});
    }
  }catch(e){}
}
function flightTimeLabel(name){
  const m=minutesFor(name);if(!m)return null;
  if(m<60)return `~${m} λεπτά πτήση`;
  const h=Math.floor(m/60),rest=m%60;
  return rest?`~${h}ω ${rest}λ πτήση`:`~${h} ώρα πτήση`;
}
function patchCard(card){
  const name=card.querySelector('h4')?.textContent?.trim();
  const label=flightTimeLabel(name);if(!label)return;
  const reg=card.querySelector('.region');if(!reg)return;
  const modeText=(card.querySelector('.break')?.textContent||'').toLowerCase();
  if(!/αερο|πτήσ|plane/.test(modeText)&&state?.transport!=='plane')return;
  reg.innerHTML=reg.innerHTML.replace(/\s*·\s*~?[\d,.]+\s*ώρες?\s*διαδρομ(?:ή|η)?/i,'');
  if(!reg.textContent.includes(label))reg.append(document.createTextNode(` · ${label}`));
}
function patchOverlay(overlay){
  const name=overlay.querySelector('.hd-head h3')?.textContent?.trim();
  const label=flightTimeLabel(name);if(!label)return;
  const pane=overlay.querySelector('[data-pane="transport"]');
  const plane=(pane?.textContent||'').toLowerCase();
  if(!/αερο|πτήσ|plane/.test(plane)&&state?.transport!=='plane')return;
  const sub=overlay.querySelector('.hd-sub');
  if(sub){sub.innerHTML=sub.innerHTML.replace(/\s*·\s*~?[\d,.]+\s*ώρες?\s*διαδρομ(?:ή|η)?/i,'');if(!sub.textContent.includes(label))sub.append(document.createTextNode(` · ${label}`));}
  pane?.querySelectorAll('.hd-card').forEach(card=>{
    const small=card.querySelector('small')?.textContent||'';
    if(/χρόνος/i.test(small)){const b=card.querySelector('b');if(b)b.textContent=label.replace(/^~/,'');}
  });
}
function patch(){document.querySelectorAll('#resultsCard .destination').forEach(patchCard);document.querySelectorAll('.horizon-detail-overlay').forEach(patchOverlay);}
function init(){installWrappers();patch();new MutationObserver(()=>queueMicrotask(patch)).observe(document.body,{childList:true,subtree:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

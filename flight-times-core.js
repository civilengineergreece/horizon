(()=>{
'use strict';

const ATHENS_HOURS={
  'Θεσσαλονίκη':0.83,'Ιωάννινα':1.00,'Νάξος':0.75,'Σύρος':0.60,'Ρόδος':1.00,
  'Κέρκυρα':1.08,'Σαντορίνη':0.83,'Μύκονος':0.75,'Πάρος':0.70,'Μήλος':0.70,
  'Χίος':0.83,'Λέσβος':1.00,'Σάμος':1.00,'Κως':1.00,'Κάρπαθος':1.25,'Σκιάθος':0.67,'Κρήτη':0.90,
  'Σόφια':1.25,'Τίρανα':1.30,'Σκόπια':1.35,'Βελιγράδι':1.70,'Βουκουρέστι':1.60,'Σαράγεβο':1.75,
  'Ζάγκρεμπ':2.00,'Ντουμπρόβνικ':1.55,'Σπλιτ':1.65,'Κότορ':1.55,'Μπούντβα':1.55,'Λιουμπλιάνα':2.10,
  'Λίμνη Μπλεντ':2.10,'Κωνσταντινούπολη':1.45,'Αττάλεια':1.35,'Καππαδοκία':1.55,'Λεμεσός':1.65,'Πάφος':1.65
};
const REGION_BASE={'Ελλάδα':0.95,'Ανατολική Μεσόγειος':1.75,'Βαλκάνια':1.65,'Βαλτική':3.20,'Βόρεια Ευρώπη':3.85,'Δυτική Ευρώπη':3.45,'Κεντρική Ευρώπη':2.55,'Νότια Ευρώπη':2.35,'Μέση Ανατολή':3.40,'Βόρεια Αφρική':3.05,'Ανατολική Ασία':12.00,'Νοτιοανατολική Ασία':13.00,'Βόρεια Αμερική':11.00,'Λατινική Αμερική':15.50,'Καραϊβική':14.50,'Υποσαχάρια Αφρική':9.00,'Ωκεανία':22.00};
function norm(v){return String(v||'').trim().toLocaleLowerCase('el-GR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
function athensOrigin(){const s=norm(typeof state!=='undefined'?state?.origin:'');return /αθην|athens|athina|αττικ/.test(s);}
function jitter(name){let h=0;for(const c of String(name||''))h=(h*31+c.charCodeAt(0))>>>0;return ((h%9)-4)*0.04;}
function correctedHours(d){if(!d||!athensOrigin())return null;if(ATHENS_HOURS[d.name])return ATHENS_HOURS[d.name];const base=REGION_BASE[d.region];return base?Math.max(.55,Math.round((base+jitter(d.name))*20)/20):null;}
function isPlaneResult(r){return r?.transportMode==='plane'||r?.transportDetails?.mode==='plane'||(typeof state!=='undefined'&&state?.transport==='plane');}
function fixResult(d,r){if(!r||!isPlaneResult(r))return r;const h=correctedHours(d);if(!h)return r;return {...r,travelHours:h,transportDetails:r.transportDetails?{...r.transportDetails,hours:h}:r.transportDetails};}
function minsLabel(h){const mins=Math.round(h*60/5)*5;if(mins<60)return `~${mins} λεπτά πτήση`;const hr=Math.floor(mins/60),m=mins%60;return m?`~${hr}ω ${m}λ πτήση`:`~${hr} ώρα πτήση`;}
function patchScored(){try{if(typeof scored==='undefined'||!Array.isArray(scored))return;scored.forEach((r,i)=>{if(isPlaneResult(r))scored[i]=fixResult(r,r);});}catch{}}
function patchVisibleCards(){
  if(typeof scored==='undefined'||!Array.isArray(scored))return;
  const map=new Map(scored.map(x=>[x.name,x]));
  document.querySelectorAll('#resultsCard .destination').forEach(card=>{
    const name=card.querySelector('h4')?.textContent?.trim(),r=map.get(name);if(!name||!r||!isPlaneResult(r))return;
    const h=correctedHours(r),reg=card.querySelector('.region');if(!h||!reg)return;
    const label=minsLabel(h),base=reg.textContent.replace(/\s*·\s*~?[\d,.]+\s*ώρες?\s*διαδρομ(?:ή|η)?/i,'').replace(/\s*·\s*~?\d+(?:ω\s*\d+λ|\s*λεπτά|\s*ώρα)\s*πτήση/i,'');
    const next=`${base} · ${label}`;if(reg.textContent!==next)reg.textContent=next;
  });
}
function refresh(){patchScored();patchVisibleCards();}
function install(){
  if(window.__HORIZON_FLIGHT_TIMES_CORE__){refresh();return true;}
  if(typeof window.calcCost!=='function'||typeof window.scoreDest!=='function')return false;
  window.__HORIZON_FLIGHT_TIMES_CORE__=true;
  const baseCalc=window.calcCost;window.calcCost=function(d){return fixResult(d,baseCalc(d));};
  const baseScore=window.scoreDest;window.scoreDest=function(d){return fixResult(d,baseScore(d));};
  if(typeof window.renderResults==='function'){
    const baseRenderResults=window.renderResults;
    window.renderResults=function(){const out=baseRenderResults.apply(this,arguments);queueMicrotask(refresh);return out;};
  }
  refresh();setTimeout(refresh,0);setTimeout(refresh,250);
  return true;
}
let tries=0;(function boot(){if(install())return;if(++tries<40)setTimeout(boot,50);})();
})();

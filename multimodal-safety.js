(()=>{
'use strict';
const PLANE_FLOOR={'Ελλάδα':170,'Ανατολική Μεσόγειος':230,'Βαλκάνια':190,'Βαλτική':310,'Βόρεια Ευρώπη':340,'Δυτική Ευρώπη':290,'Κεντρική Ευρώπη':260,'Νότια Ευρώπη':250,'Μέση Ανατολή':420,'Βόρεια Αφρική':360,'Ανατολική Ασία':920,'Νοτιοανατολική Ασία':850,'Βόρεια Αμερική':980,'Λατινική Αμερική':1150,'Καραϊβική':1080,'Υποσαχάρια Αφρική':980,'Ωκεανία':1550};
function tune(){
  (window.HORIZON_DESTINATIONS||[]).forEach(d=>{
    if((d.transport||[]).includes('plane')&&!(d.transport||[]).includes('ferry')){
      const floor=PLANE_FLOOR[d.region];if(floor)d.travel=Math.max(Number(d.travel)||0,floor);
    }
  });
}
function patchScore(){
  if(window.__HZ_MM_SAFETY__||typeof window.scoreDest!=='function')return false;window.__HZ_MM_SAFETY__=true;
  const base=window.scoreDest;window.scoreDest=function(d){
    const r=base(d),raw=state?.transport,sel=Array.isArray(raw)?raw:[raw||'any'];
    const modeCompatible=sel.includes('any')||(d.transport||[]).some(m=>sel.includes(m));
    const seaRequired=Array.isArray(state?.interests)&&state.interests.includes('sea'),seaCompatible=!seaRequired||(d.tags||[]).includes('sea');
    const hardStyle=state?.style==='city'||state?.style==='nature',styleCompatible=!hardStyle||d.type===state.style;
    const lim=state?.maxTravelHours?.unlimited?null:Number(state?.maxTravelHours?.value)||null,cands=Array.isArray(r.multimodalCandidates)?r.multimodalCandidates:[];
    const timeCompatible=!lim||cands.some(c=>!Number.isFinite(Number(c.hours))||Number(c.hours)<=lim);
    return {...r,hardExcluded:!modeCompatible||!timeCompatible||!seaCompatible||!styleCompatible};
  };return true;
}
function init(){tune();let tries=0;(function boot(){if(patchScore())return;if(++tries<20)setTimeout(boot,50);})();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
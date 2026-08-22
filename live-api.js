(()=>{
'use strict';

const cfg=window.HORIZON_LIVE_CONFIG||{};
const base=String(cfg.apiBase||'').replace(/\/$/,'');
const enabled=!!(cfg.enabled&&base);

async function call(path,payload){
  if(!enabled)throw new Error('Το live API δεν έχει ενεργοποιηθεί ακόμη.');
  const res=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
  const data=await res.json().catch(()=>({}));
  if(!res.ok||data.ok===false)throw new Error(data.error||`HTTP ${res.status}`);
  return data;
}

function destinationByName(name){return (window.HORIZON_DESTINATIONS||[]).find(d=>d.name===name)||{};}
function travelState(){return typeof state!=='undefined'&&state?state:{};}

async function hotels(name){
  const s=travelState(),d=destinationByName(name);
  return call('/hotels',{
    destination:`${name} ${d.country||''}`,
    checkInDate:s.dates?.from,
    duration:Number(s.duration)||1,
    adults:Number(s.travelers?.adults)||1,
    children:Number(s.travelers?.children)||0,
    infants:Number(s.travelers?.infants)||0,
    rooms:Math.max(1,Math.ceil(((Number(s.travelers?.adults)||1)+(Number(s.travelers?.children)||0))/2))
  });
}

// Keep the Worker client available for future providers, but do not render
// the obsolete Amadeus hotel UI. Hotels are handled by hotels-panel.js.
window.HorizonLive={enabled,apiBase:base,call,hotels};
})();

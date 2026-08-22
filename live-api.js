(()=>{
'use strict';

const cfg=window.HORIZON_LIVE_CONFIG||{};
const base=String(cfg.apiBase||'').replace(/\/$/,'');
const enabled=!!(cfg.enabled&&base);

function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
async function call(path,payload){
  if(!enabled)throw new Error('Το live API δεν έχει ενεργοποιηθεί ακόμη.');
  const res=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
  const data=await res.json().catch(()=>({}));
  if(!res.ok||data.ok===false)throw new Error(data.error||`HTTP ${res.status}`);
  return data;
}
function destinationByName(name){return (window.HORIZON_DESTINATIONS||[]).find(d=>d.name===name)||{};}
function scoredByName(name){return (typeof scored!=='undefined'&&Array.isArray(scored)?scored:[]).find(d=>d.name===name)||{};}
function travelState(){return typeof state!=='undefined'&&state?state:{};}
function fmtMoney(v,c='EUR'){return new Intl.NumberFormat('el-GR',{style:'currency',currency:c||'EUR',maximumFractionDigits:0}).format(Number(v)||0);}
function fmtHours(v){const n=Number(v)||0,h=Math.floor(n),m=Math.round((n-h)*60);return `${h}ω ${m}λ`;}
function panelBox(){return '<div class="hz-live-result" style="margin-top:14px;padding:14px;border:1px solid rgba(101,211,154,.24);background:rgba(101,211,154,.055);border-radius:14px"></div>';}
function button(label){return `<button type="button" class="hd-cta primary hz-live-btn">${label}</button>`;}
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}

async function road(name){
  const s=travelState(),d=destinationByName(name),cons=Number(s.carConsumption?.value)||7.5;
  const destination=`${name}, ${d.country||''}`;
  const outbound=await call('/road',{origin:s.origin,destination,consumptionL100:cons,fuelPriceEur:2,departureDateTime:s.dates?.from||undefined});
  let inbound=null,returnError='';
  try{
    await sleep(1200);
    inbound=await call('/road',{origin:destination,destination:s.origin,consumptionL100:cons,fuelPriceEur:2});
  }catch(e){returnError=e.message||'Δεν ολοκληρώθηκε η live επιστροφή.';}
  return {...outbound,returnRoutes:inbound?.routes||[],returnProvider:inbound?.provider||outbound.provider,returnError};
}
async function flights(name){
  const s=travelState(),d=destinationByName(name);
  return call('/flights',{origin:s.origin,destination:`${name} ${d.country||''}`,departureDate:s.dates?.from,flexDays:Number(s.dates?.flex)||0,duration:Number(s.duration)||1,adults:Number(s.travelers?.adults)||1,children:Number(s.travelers?.children)||0});
}
async function hotels(name){
  const s=travelState(),d=destinationByName(name);
  return call('/hotels',{destination:`${name} ${d.country||''}`,checkInDate:s.dates?.from,duration:Number(s.duration)||1,adults:Number(s.travelers?.adults)||1,rooms:Math.max(1,Math.ceil(((Number(s.travelers?.adults)||1)+(Number(s.travelers?.children)||0))/2))});
}
function roadHtml(data){
  const r=data.routes?.[0],back=data.returnRoutes?.[0];
  if(!r)return '<div class="hd-note">Δεν βρέθηκε live οδική διαδρομή.</div>';
  const totalKm=r.distanceKm+(back?.distanceKm||0);
  const totalHours=r.hours+(back?.hours||0);
  const totalFuel=r.fuelCost+(back?.fuelCost||0);
  const totalTolls=r.tollCost+(back?.tollCost||0);
  const totalCost=r.totalRoadCost+(back?.totalRoadCost||0);
  const outbound=`<div class="hd-card"><small>Μετάβαση</small><b>${Math.round(r.distanceKm)} km · ${fmtHours(r.hours)}</b><div class="hd-note">Καύσιμα ${fmtMoney(r.fuelCost)} · διόδια/τέλη ${fmtMoney(r.tollCost)} · <b>σύνολο ${fmtMoney(r.totalRoadCost)}</b></div></div>`;
  const inbound=back?`<div class="hd-card"><small>Επιστροφή</small><b>${Math.round(back.distanceKm)} km · ${fmtHours(back.hours)}</b><div class="hd-note">Καύσιμα ${fmtMoney(back.fuelCost)} · διόδια/τέλη ${fmtMoney(back.tollCost)} · <b>σύνολο ${fmtMoney(back.totalRoadCost)}</b></div></div>`:`<div class="hd-card"><small>Επιστροφή</small><b>Δεν βρέθηκε live αποτέλεσμα</b><div class="hd-note">${esc(data.returnError||'Θα χρησιμοποιηθεί προσωρινά μόνο η live μετάβαση.')}</div></div>`;
  const topLabel=back?'LIVE · TollGuru · μετ’ επιστροφής':'LIVE · TollGuru · μετάβαση';
  const totalNote=back?`Σύνολο καυσίμων ${fmtMoney(totalFuel)} · <b>σύνολο διοδίων/οδικών τελών ${fmtMoney(totalTolls)}</b> · τελικό οδικό κόστος ${fmtMoney(totalCost)}.`:`Καύσιμα ${fmtMoney(r.fuelCost)} · <b>σύνολο διοδίων/οδικών τελών ${fmtMoney(r.tollCost)}</b> · σύνολο ${fmtMoney(r.totalRoadCost)}.`;
  return `<div class="hd-hero"><small>${topLabel}</small><strong>${Math.round(totalKm)} km · ${fmtHours(totalHours)} · ${fmtMoney(totalCost)}</strong><div class="hd-note">${totalNote}</div></div><div class="hd-grid">${outbound}${inbound}<div class="hd-card"><small>Κατανάλωση</small><b>${data.consumptionL100} L/100 km</b></div><div class="hd-card"><small>Τιμή καυσίμου</small><b>${data.fuelPriceEur} €/L</b></div></div>`;
}
function flightsHtml(data){
  const offers=data.offers||[];if(!offers.length)return `<div class="hd-note">Δεν βρέθηκαν διαθέσιμες πτήσεις για αυτές τις ημερομηνίες${data.environment==='test'?' στο Amadeus test environment':''}.</div>`;
  const rows=offers.slice(0,6).map((o,i)=>{const out=o.legs?.[0],back=o.legs?.[1];return `<div class="hd-item"><span class="hd-num">${i+1}</span><div style="min-width:0"><b>${fmtMoney(o.total,o.currency)} · ${esc(o.date)}</b><div class="hd-note">${esc((out?.departure?.iataCode||data.origin?.iataCode||''))} → ${esc(out?.arrival?.iataCode||data.destination?.iataCode||'')} · ${out?.stops||0} στάσεις${back?` · επιστροφή ${back.stops||0} στάσεις`:''}</div></div></div>`;}).join('');
  const badge=data.live?'LIVE παραγωγής':'TEST δεδομένα';
  return `<div class="hd-hero"><small>${badge} · Amadeus Flight Offers Search</small><strong>Από ${fmtMoney(offers[0].total,offers[0].currency)}</strong><div class="hd-note">${esc(data.origin?.name||'')} (${esc(data.origin?.iataCode||'')}) → ${esc(data.destination?.name||'')} (${esc(data.destination?.iataCode||'')})</div></div><div class="hd-section"><h4>Καλύτερες διαθέσιμες προσφορές</h4><div class="hd-list">${rows}</div></div>`;
}
function hotelsHtml(data){
  if(data.dayTrip)return '<div class="hd-hero"><small>Μονοήμερη εκδρομή</small><strong>Δεν απαιτείται διαμονή</strong></div>';
  const offers=data.offers||[];if(!offers.length)return `<div class="hd-note">Δεν βρέθηκαν διαθέσιμα ξενοδοχεία για αυτές τις ημερομηνίες${data.environment==='test'?' στο Amadeus test environment':''}.</div>`;
  const rows=offers.slice(0,8).map((o,i)=>`<div class="hd-item"><span class="hd-num">${i+1}</span><div><b>${esc(o.name)} · ${fmtMoney(o.total,o.currency)}</b><div class="hd-note">${esc(o.checkInDate||'')} → ${esc(o.checkOutDate||'')}${o.roomQuantity?` · ${esc(o.roomQuantity)} δωμάτιο/α`:''}</div></div></div>`).join('');
  return `<div class="hd-hero"><small>${data.live?'LIVE παραγωγής':'TEST δεδομένα'} · Amadeus Hotel Search</small><strong>Από ${fmtMoney(offers[0].total,offers[0].currency)}</strong><div class="hd-note">Real-time availability/price response για τις επιλεγμένες ημερομηνίες.</div></div><div class="hd-section"><h4>Διαθέσιμες επιλογές</h4><div class="hd-list">${rows}</div></div>`;
}
function wirePane(overlay,name,paneName,label,loader,renderer){
  const pane=overlay.querySelector(`[data-pane="${paneName}"]`);if(!pane||pane.querySelector('.hz-live-wrap'))return;
  const wrap=document.createElement('div');wrap.className='hz-live-wrap hd-section';
  wrap.innerHTML=`<h4>Live έλεγχος</h4><div class="hd-note">Οι αρχικές κάρτες του Horizon παραμένουν άμεσες εκτιμήσεις. Πάτησε εδώ για πραγματικό provider lookup μόνο όταν το χρειάζεσαι.</div><div class="hd-cta-row">${button(label)}</div>${panelBox()}`;
  pane.appendChild(wrap);
  const btn=wrap.querySelector('.hz-live-btn'),out=wrap.querySelector('.hz-live-result');out.style.display='none';
  btn.addEventListener('click',async()=>{
    btn.disabled=true;btn.textContent='Έλεγχος…';out.style.display='block';out.innerHTML='<div class="hd-note">Γίνεται live αναζήτηση…</div>';
    try{const data=await loader(name);out.innerHTML=renderer(data);}
    catch(e){out.innerHTML=`<div class="hd-note" style="color:#ffb1a3"><b>Δεν ολοκληρώθηκε ο live έλεγχος.</b><br>${esc(e.message)}</div>`;}
    finally{btn.disabled=false;btn.textContent=label;}
  });
}
function enhanceOverlay(overlay){
  if(!enabled||!overlay||overlay.dataset.liveWired)return;overlay.dataset.liveWired='1';
  const name=overlay.querySelector('.hd-head h3')?.textContent?.trim();if(!name)return;
  const d=scoredByName(name),mode=d.transportMode||travelState().transport;
  wirePane(overlay,name,'stay','Έλεγχος live ξενοδοχείων',hotels,hotelsHtml);
  if(mode==='plane')wirePane(overlay,name,'transport','Έλεγχος live πτήσεων',flights,flightsHtml);
  else if(mode==='car')wirePane(overlay,name,'transport','Live διαδρομή + διόδια',road,roadHtml);
  else {
    const pane=overlay.querySelector('[data-pane="transport"]');
    if(pane&&!pane.querySelector('.hz-live-wrap')){const w=document.createElement('div');w.className='hz-live-wrap hd-section';w.innerHTML='<h4>Live έλεγχος</h4><div class="hd-note">Η συγκεκριμένη μετακίνηση δεν έχει ακόμη live provider σε αυτή την έκδοση.</div>';pane.appendChild(w);}
  }
}
function observe(){
  if(!enabled)return;
  const obs=new MutationObserver(()=>document.querySelectorAll('.horizon-detail-overlay').forEach(enhanceOverlay));
  obs.observe(document.body,{childList:true,subtree:true});
  document.querySelectorAll('.horizon-detail-overlay').forEach(enhanceOverlay);
}
window.HorizonLive={enabled,apiBase:base,call,road,flights,hotels};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe);else observe();
})();

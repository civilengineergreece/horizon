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
function travelState(){return typeof state!=='undefined'&&state?state:{};}
function fmtMoney(v,c='EUR'){return new Intl.NumberFormat('el-GR',{style:'currency',currency:c||'EUR',maximumFractionDigits:0}).format(Number(v)||0);}
function panelBox(){return '<div class="hz-live-result" style="margin-top:14px;padding:14px;border:1px solid rgba(101,211,154,.24);background:rgba(101,211,154,.055);border-radius:14px"></div>';}
function button(label){return `<button type="button" class="hd-cta primary hz-live-btn">${label}</button>`;}

async function hotels(name){
  const s=travelState(),d=destinationByName(name);
  return call('/hotels',{destination:`${name} ${d.country||''}`,checkInDate:s.dates?.from,duration:Number(s.duration)||1,adults:Number(s.travelers?.adults)||1,rooms:Math.max(1,Math.ceil(((Number(s.travelers?.adults)||1)+(Number(s.travelers?.children)||0))/2))});
}
function hotelsHtml(data){
  if(data.dayTrip)return '<div class="hd-hero"><small>Μονοήμερη εκδρομή</small><strong>Δεν απαιτείται διαμονή</strong></div>';
  const offers=data.offers||[];if(!offers.length)return `<div class="hd-note">Δεν βρέθηκαν διαθέσιμα ξενοδοχεία για αυτές τις ημερομηνίες${data.environment==='test'?' στο Amadeus test environment':''}.</div>`;
  const rows=offers.slice(0,8).map((o,i)=>`<div class="hd-item"><span class="hd-num">${i+1}</span><div><b>${esc(o.name)} · ${fmtMoney(o.total,o.currency)}</b><div class="hd-note">${esc(o.checkInDate||'')} → ${esc(o.checkOutDate||'')}${o.roomQuantity?` · ${esc(o.roomQuantity)} δωμάτιο/α`:''}</div></div></div>`).join('');
  return `<div class="hd-hero"><small>${data.live?'LIVE παραγωγής':'TEST δεδομένα'} · Hotel Search</small><strong>Από ${fmtMoney(offers[0].total,offers[0].currency)}</strong><div class="hd-note">Διαθεσιμότητα/τιμή για τις επιλεγμένες ημερομηνίες.</div></div><div class="hd-section"><h4>Διαθέσιμες επιλογές</h4><div class="hd-list">${rows}</div></div>`;
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
  // Flights are handled exclusively by the free Travelpayouts metasearch widget.
  // Keep the Worker live layer only for hotel functionality for now.
  wirePane(overlay,name,'stay','Έλεγχος live ξενοδοχείων',hotels,hotelsHtml);
}
function observe(){
  if(!enabled)return;
  const obs=new MutationObserver(()=>document.querySelectorAll('.horizon-detail-overlay').forEach(enhanceOverlay));
  obs.observe(document.body,{childList:true,subtree:true});
  document.querySelectorAll('.horizon-detail-overlay').forEach(enhanceOverlay);
}
window.HorizonLive={enabled,apiBase:base,call,hotels};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',observe);else observe();
})();

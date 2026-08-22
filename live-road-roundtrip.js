(()=>{
'use strict';

function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function fmtMoney(v,c='EUR'){return new Intl.NumberFormat('el-GR',{style:'currency',currency:c||'EUR',maximumFractionDigits:2}).format(Number(v)||0);}
function fmtHours(v){const n=Number(v)||0,h=Math.floor(n),m=Math.round((n-h)*60);return `${h}ω ${m}λ`;}
function destinationByName(name){return (window.HORIZON_DESTINATIONS||[]).find(d=>d.name===name)||{};}
function travelState(){return typeof state!=='undefined'&&state?state:{};}
function stationCost(t){return [t?.cashCost,t?.creditCardCost,t?.prepaidCardCost,t?.tagCost,t?.licensePlateCost].find(v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v)));}
function tollRows(route,title){
  const rows=(route?.tolls||[]).slice(0,16).map(t=>{
    const c=stationCost(t);
    const meta=[t.road?`Οδός ${t.road}`:'',t.country,t.type].filter(Boolean).join(' · ');
    return `<div class="hd-item"><span class="hd-num">${c!==undefined?'€':'↗'}</span><div><b>${esc(t.name||t.road||'Σημείο χρέωσης')}${c!==undefined?` · ${fmtMoney(c,t.currency||'EUR')}`:''}</b><div class="hd-note">${esc(meta)}</div></div></div>`;
  }).join('');
  return rows?`<div class="hd-section"><h4>${esc(title)}</h4><div class="hd-list">${rows}</div></div>`:'';
}
function render(outbound,inbound){
  const r=outbound?.routes?.[0],back=inbound?.routes?.[0];
  if(!r)return '<div class="hd-note">Δεν βρέθηκε live οδική διαδρομή.</div>';
  const totalKm=(r.distanceKm||0)+(back?.distanceKm||0);
  const totalHours=(r.hours||0)+(back?.hours||0);
  const totalFuel=(r.fuelCost||0)+(back?.fuelCost||0);
  const totalTolls=(r.tollCost||0)+(back?.tollCost||0);
  const totalCost=(r.totalRoadCost||0)+(back?.totalRoadCost||0);
  return `<div class="hd-hero"><small>LIVE · TollGuru · μετ’ επιστροφής</small><strong>${Math.round(totalKm)} km · ${fmtHours(totalHours)}</strong><div class="hd-note">Καύσιμα ${fmtMoney(totalFuel)} · διόδια/οδικά τέλη ${fmtMoney(totalTolls)} · συνολικό οδικό κόστος ${fmtMoney(totalCost)}.</div></div><div class="hd-grid"><div class="hd-card"><small>Προς προορισμό</small><b>${Math.round(r.distanceKm||0)} km · ${fmtHours(r.hours)} · ${fmtMoney(r.totalRoadCost)}</b></div><div class="hd-card"><small>Επιστροφή</small><b>${back?`${Math.round(back.distanceKm||0)} km · ${fmtHours(back.hours)} · ${fmtMoney(back.totalRoadCost)}`:'Δεν βρέθηκε live επιστροφή'}</b></div><div class="hd-card"><small>Κατανάλωση</small><b>${outbound.consumptionL100} L/100 km</b></div><div class="hd-card"><small>Τιμή καυσίμου</small><b>${outbound.fuelPriceEur} €/L</b></div></div>${tollRows(r,'Διόδια / σημεία χρέωσης προς προορισμό')}${tollRows(back,'Διόδια / σημεία χρέωσης επιστροφής')}`;
}

async function handle(btn){
  const live=window.HorizonLive;
  if(!live?.enabled)return;
  const overlay=btn.closest('.horizon-detail-overlay');
  const name=overlay?.querySelector('.hd-head h3')?.textContent?.trim();
  const wrap=btn.closest('.hz-live-wrap'),out=wrap?.querySelector('.hz-live-result');
  if(!name||!out)return;
  const s=travelState(),d=destinationByName(name),cons=Number(s.carConsumption?.value)||7.5;
  const destination=`${name}, ${d.country||''}`;
  btn.disabled=true;btn.textContent='Έλεγχος μετ’ επιστροφής…';out.style.display='block';out.innerHTML='<div class="hd-note">Γίνεται live αναζήτηση και στις δύο κατευθύνσεις…</div>';
  try{
    const [outbound,inbound]=await Promise.all([
      live.call('/road',{origin:s.origin,destination,consumptionL100:cons,fuelPriceEur:2,departureDateTime:s.dates?.from||undefined}),
      live.call('/road',{origin:destination,destination:s.origin,consumptionL100:cons,fuelPriceEur:2})
    ]);
    out.innerHTML=render(outbound,inbound);
  }catch(err){out.innerHTML=`<div class="hd-note" style="color:#ffb1a3"><b>Δεν ολοκληρώθηκε ο live έλεγχος μετ’ επιστροφής.</b><br>${esc(err.message)}</div>`;}
  finally{btn.disabled=false;btn.textContent='Live διαδρομή + διόδια';}
}

document.addEventListener('click',e=>{
  const btn=e.target.closest?.('.hz-live-btn');
  if(!btn||!String(btn.textContent).includes('Live διαδρομή'))return;
  e.preventDefault();e.stopImmediatePropagation();
  handle(btn);
},true);
})();

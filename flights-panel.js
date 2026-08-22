(()=>{
'use strict';
const STYLE_ID='horizon-live-flights-style',CACHE_PREFIX='hz-flights-v1:',CACHE_TTL=30*60*1000;
function installStyles(){if(document.getElementById(STYLE_ID))return;const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
.hz-flights-panel{margin-top:20px;padding:16px;border:1px solid rgba(255,122,22,.28);border-radius:16px;background:rgba(5,16,26,.42)}
.hz-flights-title{font-weight:900;margin-bottom:4px}.hz-flights-copy{font-size:.8rem;color:#9fb0bd;line-height:1.45;margin-bottom:12px}
.hz-flight-form{display:grid;grid-template-columns:1fr 1fr;gap:9px}.hz-flight-field label{display:block;color:#8fa3b2;font-size:.7rem;margin-bottom:5px}.hz-flight-field input{width:100%;border:1px solid rgba(255,255,255,.12);background:#0b1d2b;color:#fff;border-radius:9px;padding:9px}
.hz-flight-summary{grid-column:1/-1;color:#b8c6cf;font-size:.76rem}.hz-flight-search{grid-column:1/-1;border:0;border-radius:10px;padding:11px 13px;background:linear-gradient(180deg,#ff8b29,#df5e08);color:#fff;font-weight:900;cursor:pointer}.hz-flight-search:disabled{opacity:.6;cursor:wait}
.hz-flight-status{margin:10px 0 0;color:#aab8c2;font-size:.78rem}.hz-flight-results{display:grid;gap:9px;margin-top:12px}.hz-flight-card{border:1px solid rgba(255,255,255,.09);background:#102638;border-radius:13px;padding:12px}.hz-flight-card-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.hz-flight-airline{font-weight:900}.hz-flight-price{font-size:1.05rem;font-weight:950;color:#fff;white-space:nowrap}.hz-flight-route{margin-top:7px;font-size:.83rem}.hz-flight-meta{margin-top:5px;color:#9fb0bd;font-size:.74rem}.hz-flight-source{margin-top:10px;color:#76d8a6;font-size:.7rem}
@media(max-width:620px){.hz-flight-form{grid-template-columns:1fr}.hz-flight-summary,.hz-flight-search{grid-column:1}}
`;document.head.appendChild(s);}
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function stateNow(){return typeof state!=='undefined'&&state?state:{};}
function destinationByName(name){return (window.HORIZON_DESTINATIONS||[]).find(x=>x.name===name)||{};}
function scoreByName(name){return (typeof scored!=='undefined'&&Array.isArray(scored)?scored:[]).find(x=>x.name===name)||{};}
function supportsPlane(name){const d=destinationByName(name),r=scoreByName(name);return d.transport?.includes?.('plane')||r.transportMode==='plane'||stateNow().transport==='plane';}
function addDays(iso,n){const d=new Date(`${iso}T12:00:00`);d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);}
function defaultDates(){const s=stateNow(),from=s.dates?.from||'';const days=Math.max(1,Number(s.duration)||1);return {from,to:from?addDays(from,Math.max(0,days-1)):''};}
function travelers(){const t=stateNow().travelers||{};return {adults:Math.max(1,Number(t.adults)||1),children:Math.max(0,Number(t.children)||0),infants:Math.max(0,Number(t.infants)||0)};}
function fmtDuration(mins){const n=Number(mins)||0;if(!n)return '—';const h=Math.floor(n/60),m=n%60;return h?(m?`${h}ω ${m}λ`:`${h}ω`):`${m}λ`;}
function timeOnly(v){const s=String(v||'');const m=s.match(/(\d{2}:\d{2})$/);return m?m[1]:s;}
function cacheKey(origin,dest,from,to,t){return `${CACHE_PREFIX}${[origin,dest,from,to,t.adults,t.children,t.infants].join('|')}`;}
function readCache(key){try{const v=JSON.parse(localStorage.getItem(key)||'null');if(v&&Date.now()-v.at<CACHE_TTL)return v.data;}catch{}return null;}
function writeCache(key,data){try{localStorage.setItem(key,JSON.stringify({at:Date.now(),data}));}catch{}}
function cheapest(data){const prices=(Array.isArray(data?.results)?data.results:[]).map(x=>Number(x?.price)).filter(x=>Number.isFinite(x)&&x>0);return prices.length?Math.min(...prices):null;}
function publish(name,data){const price=cheapest(data);if(!price)return;document.dispatchEvent(new CustomEvent('horizon:live-flight-price',{detail:{destination:name,price,currency:data?.currency||'EUR'}}));}
function renderResults(panel,data,cached=false){
  const out=panel.querySelector('.hz-flight-results'),status=panel.querySelector('.hz-flight-status'),items=Array.isArray(data?.results)?data.results:[];
  status.textContent=items.length?`${items.length} live επιλογές${cached?' · από προσωρινή cache':''}.`:'Δεν βρέθηκαν πτήσεις για αυτά τα στοιχεία.';
  out.innerHTML=items.map(item=>{
    const airline=(item.airlines||[]).join(' + ')||'Αεροπορική',price=item.price?`€${Number(item.price).toLocaleString('el-GR')}`:'Τιμή μη διαθέσιμη';
    const stops=Number(item.stops)||0,stopText=stops===0?'Απευθείας':stops===1?'1 στάση':`${stops} στάσεις`;
    return `<article class="hz-flight-card"><div class="hz-flight-card-top"><div><div class="hz-flight-airline">${esc(airline)}</div><div class="hz-flight-route">${esc(item.departure?.airport||'')} ${esc(timeOnly(item.departure?.time))} → ${esc(item.arrival?.airport||'')} ${esc(timeOnly(item.arrival?.time))}</div></div><div class="hz-flight-price">${price}</div></div><div class="hz-flight-meta">${esc(fmtDuration(item.durationMinutes))} · ${esc(stopText)}</div><div class="hz-flight-source">Live δεδομένα Google Flights μέσω SerpApi</div></article>`;
  }).join('');
}
async function search(panel,name){
  const from=panel.querySelector('.hz-flight-from')?.value||'',to=panel.querySelector('.hz-flight-to')?.value||'',origin=stateNow().origin||'Αθήνα',t=travelers(),btn=panel.querySelector('.hz-flight-search'),status=panel.querySelector('.hz-flight-status');
  if(!from){status.textContent='Διάλεξε ημερομηνία αναχώρησης.';return;}if(to&&to<from){status.textContent='Η επιστροφή πρέπει να είναι μετά την αναχώρηση.';return;}
  const key=cacheKey(origin,name,from,to,t),cached=readCache(key);if(cached){renderResults(panel,cached,true);publish(name,cached);return;}
  const base=window.HORIZON_LIVE_CONFIG?.apiBase;if(!base){status.textContent='Το live API δεν είναι διαθέσιμο.';return;}
  btn.disabled=true;btn.textContent='Αναζήτηση live πτήσεων…';status.textContent='Αναζητώ πραγματικές πτήσεις και τιμές…';panel.querySelector('.hz-flight-results').innerHTML='';
  try{
    const u=new URL(`${base}/flights`);u.searchParams.set('origin',origin);u.searchParams.set('destination',name);u.searchParams.set('outboundDate',from);if(to)u.searchParams.set('returnDate',to);u.searchParams.set('adults',t.adults);u.searchParams.set('children',t.children);u.searchParams.set('infants',t.infants);
    const res=await fetch(u.toString());const data=await res.json().catch(()=>({}));if(!res.ok||!data.ok)throw new Error(data.error||`HTTP ${res.status}`);writeCache(key,data);renderResults(panel,data,false);publish(name,data);
  }catch(e){status.textContent=`Δεν ολοκληρώθηκε η live αναζήτηση: ${e.message||e}`;}
  finally{btn.disabled=false;btn.textContent='Αναζήτηση live πτήσεων';}
}
function enhanceOverlay(overlay){
  if(!overlay||overlay.querySelector('.hz-flights-panel'))return;const name=overlay.querySelector('.hd-head h3')?.textContent?.trim();if(!name||!supportsPlane(name))return;const pane=overlay.querySelector('[data-pane="transport"]');if(!pane)return;
  const dates=defaultDates(),t=travelers(),box=document.createElement('section');box.className='hz-flights-panel';
  box.innerHTML=`<div class="hz-flights-title">Live πτήσεις μέσα στο Horizon</div><div class="hz-flights-copy">Οι τιμές που θα εμφανιστούν εδώ προέρχονται από Google Flights για τις συγκεκριμένες ημερομηνίες και ταξιδιώτες. Μόλις γίνει η αναζήτηση, η χαμηλότερη live τιμή ενημερώνει αυτόματα και την εξωτερική κάρτα του προορισμού.</div><div class="hz-flight-form"><div class="hz-flight-field"><label>Αναχώρηση</label><input class="hz-flight-from" type="date" value="${esc(dates.from)}"></div><div class="hz-flight-field"><label>Επιστροφή</label><input class="hz-flight-to" type="date" value="${esc(dates.to)}"></div><div class="hz-flight-summary">${esc(stateNow().origin||'Αθήνα')} → ${esc(name)} · ${t.adults} ενήλικες${t.children?` · ${t.children} παιδιά`:''}${t.infants?` · ${t.infants} βρέφη`:''}</div><button type="button" class="hz-flight-search">Αναζήτηση live πτήσεων</button></div><div class="hz-flight-status"></div><div class="hz-flight-results"></div>`;
  pane.appendChild(box);box.querySelector('.hz-flight-search').addEventListener('click',()=>search(box,name));
}
function enhanceAll(){document.querySelectorAll('.horizon-detail-overlay').forEach(enhanceOverlay);}
function scheduleEnhance(){setTimeout(enhanceAll,0);setTimeout(enhanceAll,80);}
function init(){installStyles();document.addEventListener('click',e=>{const a=e.target.closest('.destination .actions a');const tab=e.target.closest('.hd-tab');if((a&&/μεταφορ/i.test(a.textContent||''))||(tab&&/μεταφορ/i.test(tab.textContent||'')))scheduleEnhance();},true);enhanceAll();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

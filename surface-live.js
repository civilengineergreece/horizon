(()=>{
'use strict';
const STYLE_ID='horizon-surface-live-style',FERRY_TTL=30*60*1000;
function styles(){if(document.getElementById(STYLE_ID))return;const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
.hz-surface-live{margin:14px 0 18px;padding:15px;border:1px solid rgba(101,211,154,.22);border-radius:15px;background:rgba(101,211,154,.035)}
.hz-surface-head{font-weight:900;margin-bottom:4px}.hz-surface-copy{color:#91a4b2;font-size:.76rem;line-height:1.45;margin-bottom:10px}.hz-surface-actions{display:flex;gap:7px;flex-wrap:wrap}.hz-surface-btn{border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:9px 11px;background:#0b1d2b;color:white;font-weight:850;cursor:pointer}.hz-surface-btn.live{border-color:rgba(101,211,154,.4)}.hz-surface-btn:disabled{opacity:.55;cursor:wait}.hz-surface-results{margin-top:12px;display:grid;gap:8px}.hz-surface-card{padding:11px 12px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.025)}.hz-surface-row{display:flex;justify-content:space-between;gap:12px;align-items:start}.hz-surface-card b{display:block}.hz-surface-price{font-weight:950;color:#8ae5b5}.hz-surface-meta{margin-top:4px;color:#9fb0bd;font-size:.72rem;line-height:1.45}.hz-surface-note{padding:11px;border:1px dashed rgba(255,255,255,.14);border-radius:11px;color:#a9b7c1;font-size:.75rem;line-height:1.45}.hz-surface-badge{display:inline-block;margin-left:5px;padding:2px 5px;border-radius:999px;background:rgba(101,211,154,.1);color:#8ae5b5;font-size:.62rem;font-weight:900}
`;document.head.appendChild(s);}
function stateNow(){try{return typeof state!=='undefined'&&state?state:{};}catch{return {};}}
function addDays(iso,n){const d=new Date(`${iso}T12:00:00`);d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);}
function tripDates(){const s=stateNow(),from=s.dates?.from||'',days=Math.max(1,Number(s.duration)||1);return {from,to:from?addDays(from,Math.max(0,days-1)):''};}
function destinationName(){return document.querySelector('.horizon-detail-overlay .hd-head h3')?.textContent?.trim()||'';}
function selectedModes(){const raw=stateNow().transport;if(Array.isArray(raw))return raw;return raw?[raw]:['any'];}
function destData(name){return (window.HORIZON_DESTINATIONS||[]).find(d=>d.name===name)||{};}
function hasMode(name,mode){const d=destData(name);return Array.isArray(d.transport)&&d.transport.includes(mode);}
function euro(v,c='EUR'){const n=Number(v);return Number.isFinite(n)?new Intl.NumberFormat('el-GR',{style:'currency',currency:c||'EUR',maximumFractionDigits:0}).format(n):'—';}
function time(v){if(!v)return '—';const s=String(v);const m=s.match(/(\d{1,2}):(\d{2})/);return m?`${m[1].padStart(2,'0')}:${m[2]}`:s.slice(0,16);}
function cacheKey(name,from,to){const s=stateNow();return `hz-ferries-v1:${[s.origin||'Αθήνα',name,from,to].join('|')}`;}
function cacheGet(k){try{const v=JSON.parse(localStorage.getItem(k)||'null');return v&&Date.now()-v.at<FERRY_TTL?v.data:null;}catch{return null;}}
function cacheSet(k,data){try{localStorage.setItem(k,JSON.stringify({at:Date.now(),data}));}catch{}}
function renderTrips(target,data){
  const trips=Array.isArray(data?.outbound)?data.outbound:[];
  if(!trips.length){target.innerHTML='<div class="hz-surface-note">Δεν επέστρεψε διαθέσιμα δρομολόγια για αυτή την ημερομηνία. Δοκίμασε άλλη ημερομηνία ή έλεγξε αν ο προορισμός εξυπηρετείται από άλλο λιμάνι.</div>';return;}
  target.innerHTML=trips.slice(0,10).map(x=>`<div class="hz-surface-card"><div class="hz-surface-row"><div><b>${x.operator||x.vessel||'Ακτοπλοϊκό δρομολόγιο'} <span class="hz-surface-badge">LIVE</span></b><div class="hz-surface-meta">${time(x.departure)} → ${time(x.arrival)}${x.vessel?` · ${x.vessel}`:''}</div></div><div class="hz-surface-price">${euro(x.price,x.currency)}</div></div>${x.bookingUrl?`<div class="hz-surface-meta"><a href="${x.bookingUrl}" target="_blank" rel="noopener">Συνέχεια κράτησης ↗</a></div>`:''}</div>`).join('');
}
async function loadFerries(btn,target){
  const name=destinationName(),s=stateNow(),dt=tripDates();if(!name||!dt.from)return;
  const key=cacheKey(name,dt.from,dt.to),cached=cacheGet(key);if(cached){renderTrips(target,cached);return;}
  btn.disabled=true;btn.textContent='Αναζήτηση…';target.innerHTML='<div class="hz-surface-note">Γίνεται live αναζήτηση Ferryhopper για τις ημερομηνίες του ταξιδιού σου…</div>';
  try{
    const u=new URL(`${window.HORIZON_LIVE_CONFIG.apiBase}/ferries`);u.searchParams.set('origin',s.origin||'Αθήνα');u.searchParams.set('destination',name);u.searchParams.set('date',dt.from);if(dt.to)u.searchParams.set('returnDate',dt.to);
    const r=await fetch(u.toString());const data=await r.json().catch(()=>({}));if(!r.ok||!data.ok)throw new Error(data.error||data.details||'Αποτυχία live αναζήτησης πλοίων.');cacheSet(key,data);renderTrips(target,data);
  }catch(e){target.innerHTML=`<div class="hz-surface-note">${String(e.message||e)}<br><span style="color:#8399a8">Η εκτίμηση του Horizon παραμένει διαθέσιμη μέχρι να απαντήσει ο live provider.</span></div>`;}
  finally{btn.disabled=false;btn.textContent='⛴ Πραγματικά πλοία';}
}
async function groundStatus(mode,target){
  target.innerHTML='<div class="hz-surface-note">Έλεγχος provider…</div>';
  try{const r=await fetch(`${window.HORIZON_LIVE_CONFIG.apiBase}/ground?mode=${encodeURIComponent(mode)}`);const data=await r.json().catch(()=>({}));if(r.ok&&data.ok){target.textContent='Ο live provider είναι ενεργός.';return;}target.innerHTML=`<div class="hz-surface-note"><b>${mode==='train'?'🚆 Τρένα':'🚌 Λεωφορεία / ΚΤΕΛ'}:</b> ${data.error||'Αναμένεται ενεργοποίηση Omio Meta Search API.'}<br>Μέχρι τότε το Horizon εμφανίζει καθαρά μόνο εκτιμήσεις και δεν τις βαφτίζει live.</div>`;}catch{target.innerHTML='<div class="hz-surface-note">Δεν ήταν δυνατός ο έλεγχος του Omio provider.</div>';}
}
function patch(){
  const ov=document.querySelector('.horizon-detail-overlay');if(!ov)return;const pane=ov.querySelector('[data-pane="transport"]');if(!pane||pane.querySelector('.hz-surface-live'))return;const name=destinationName();if(!name)return;
  const d=destData(name),modes=d.transport||[],wrap=document.createElement('section');wrap.className='hz-surface-live';
  const buttons=[];if(modes.includes('ferry'))buttons.push('<button type="button" class="hz-surface-btn live" data-surface="ferry">⛴ Πραγματικά πλοία</button>');if(modes.includes('train'))buttons.push('<button type="button" class="hz-surface-btn" data-surface="train">🚆 Live τρένα</button>');if(modes.includes('bus'))buttons.push('<button type="button" class="hz-surface-btn" data-surface="bus">🚌 Live λεωφορεία</button>');if(!buttons.length)return;
  wrap.innerHTML=`<div class="hz-surface-head">Πραγματικά δρομολόγια</div><div class="hz-surface-copy">Χρησιμοποιούνται αυτόματα η αφετηρία, ο προορισμός και οι ημερομηνίες που έδωσες στο Planner. Τα πλοία συνδέονται με το επίσημο Ferryhopper MCP. Για τρένα/λεωφορεία έχει προετοιμαστεί η σύνδεση Omio και ενεργοποιείται μόλις δοθεί partner API access.</div><div class="hz-surface-actions">${buttons.join('')}</div><div class="hz-surface-results"></div>`;
  const compare=pane.querySelector('.hz-tr-compare');(compare||pane.firstElementChild)?.after(wrap);const target=wrap.querySelector('.hz-surface-results');wrap.querySelectorAll('[data-surface]').forEach(b=>b.onclick=()=>{const m=b.dataset.surface;if(m==='ferry')loadFerries(b,target);else groundStatus(m,target);});
}
styles();document.addEventListener('click',()=>setTimeout(patch,0),true);setTimeout(patch,200);
})();

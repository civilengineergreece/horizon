(()=>{
'use strict';

const TTL=10*60*1000;
const STYLE_ID='horizon-train-live-style';

function styles(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
.hz-train-badge{display:inline-block;margin-left:5px;padding:2px 6px;border-radius:999px;background:rgba(83,176,255,.1);color:#9fd3ff;font-size:.61rem;font-weight:900}.hz-train-delay{color:#ffd09f}.hz-train-ok{color:#8ae5b5}.hz-train-attrib{margin-top:8px;color:#758a99;font-size:.64rem}.hz-train-attrib a{color:#95b6cf}
`;document.head.appendChild(s);
}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function stateNow(){try{return typeof state!=='undefined'&&state?state:{};}catch{return {};}}
function destinationName(){return document.querySelector('.horizon-detail-overlay .hd-head h3')?.textContent?.trim()||'';}
function addDays(iso,n){const d=new Date(`${iso}T12:00:00`);d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);}
function tripDates(){const s=stateNow(),from=s.dates?.from||'',days=Math.max(1,Number(s.duration)||1);return {from,to:from?addDays(from,Math.max(0,days-1)):''};}
function cacheKey(name,from,to){const s=stateNow();return `hz-trains-v1:${[s.origin||'Αθήνα',name,from,to].join('|')}`;}
function cacheGet(k){try{const v=JSON.parse(localStorage.getItem(k)||'null');return v&&Date.now()-Number(v.at||0)<TTL?v.data:null;}catch{return null;}}
function cacheSet(k,data){try{localStorage.setItem(k,JSON.stringify({at:Date.now(),data}));}catch{}}
function fmtTime(v){
  if(!v)return '—';
  try{return new Intl.DateTimeFormat('el-GR',{timeZone:'Europe/Athens',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(v));}catch{}
  const m=String(v).match(/(\d{1,2}):(\d{2})/);return m?`${m[1].padStart(2,'0')}:${m[2]}`:String(v).slice(0,16);
}
function duration(v){const n=Number(v);if(!Number.isFinite(n)||n<=0)return '—';const h=Math.floor(n/60),m=Math.round(n%60);return h?(m?`${h}ω ${m}λ`:`${h}ω`):`${m}λ`;}
function euro(v,c='EUR'){const n=Number(v);return Number.isFinite(n)?new Intl.NumberFormat('el-GR',{style:'currency',currency:c||'EUR',maximumFractionDigits:2}).format(n):'—';}
function firstUsable(list){return (Array.isArray(list)?list:[]).find(x=>!x?.cancelled)||null;}
function trainRow(){
  const table=document.querySelector('.horizon-detail-overlay [data-pane="transport"] .hz-tr-table');if(!table)return null;
  return [...table.querySelectorAll('tbody tr')].find(r=>/Τρένο/i.test(r.cells?.[0]?.textContent||''))||null;
}
function delayText(x){
  const n=Number(x?.delayMinutes);if(!Number.isFinite(n)||n===0)return x?.realtime?' · realtime ενημέρωση':'';
  if(n>0)return ` · <span class="hz-train-delay">+${n}λ καθυστέρηση</span>`;
  return ` · <span class="hz-train-ok">${Math.abs(n)}λ νωρίτερα</span>`;
}
function updateComparison(data){
  const row=trainRow();if(!row||row.cells.length<4)return;
  const out=firstUsable(data?.outbound);if(!out)return;
  const cells=row.cells;
  cells[1].innerHTML=`<b>${duration(out.durationMinutes)}</b><span class="hz-tr-note">${fmtTime(out.departure)} → ${fmtTime(out.arrival)}</span>`;
  const fare=data?.fares?.roundTrip;
  if(fare&&Number.isFinite(Number(fare.amount))){
    cells[2].innerHTML=`<b>${euro(fare.amount,fare.currency)} / ενήλικα</b><span class="hz-tr-note">μετ’ επιστροφής · fare από το feed, όχι εγγύηση τελικής κράτησης</span>`;
  }else{
    const note=cells[2].querySelector('.hz-tr-note');
    if(!note){const n=document.createElement('span');n.className='hz-tr-note';n.textContent='Στενή εκτίμηση τιμής · το feed δεν έδωσε fare.';cells[2].appendChild(n);}
  }
  cells[3].innerHTML=`<span class="hz-tr-status-live">Live Transitous</span><span class="hz-tr-note">${out.realtime?'Realtime':'Προγραμματισμένο'} δρομολόγιο${delayText(out)} · ${esc(out.route||'Hellenic Train')}</span>`;
  row.classList.add('hz-tr-selected');
  document.dispatchEvent(new CustomEvent('horizon:live-train-price',{detail:{destination:destinationName(),data}}));
}
function render(target,data){
  const list=Array.isArray(data?.outbound)?data.outbound:[];
  if(!list.length){target.innerHTML='<div class="hz-surface-note">Το Transitous δεν επέστρεψε διαθέσιμο σιδηροδρομικό δρομολόγιο για αυτή την ημερομηνία. Η στενή εκτίμηση του Horizon παραμένει στον πίνακα.</div>';return;}
  updateComparison(data);
  target.innerHTML=list.slice(0,6).map(x=>{
    const fare=x?.fare&&Number.isFinite(Number(x.fare.amount))?`<span class="hz-surface-price">${euro(x.fare.amount,x.fare.currency)} / ενήλικα</span>`:'<span class="hz-surface-meta">τιμή: εκτίμηση στον πίνακα</span>';
    const status=x.cancelled?'<span class="hz-train-badge">ΑΚΥΡΩΣΗ</span>':x.realtime?'<span class="hz-train-badge">REALTIME</span>':'<span class="hz-train-badge">LIVE ΠΡΟΓΡΑΜΜΑ</span>';
    return `<div class="hz-surface-card"><div class="hz-surface-row"><div><b>🚆 ${esc(x.route||x.agency||'Hellenic Train')} ${status}</b><div class="hz-surface-meta">${fmtTime(x.departure)} → ${fmtTime(x.arrival)} · ${duration(x.durationMinutes)}${x.transfers?` · ${Number(x.transfers)} αλλαγή${Number(x.transfers)>1?'ές':''}`:' · απευθείας'}${delayText(x)}</div><div class="hz-surface-meta">${esc(x.from||data.originStation||'')} → ${esc(x.to||data.destinationStation||'')}</div></div><div>${fare}</div></div></div>`;
  }).join('')+`<div class="hz-train-attrib">Δεδομένα δρομολογίων: <a href="${esc(data.attribution||'https://transitous.org/sources/')}" target="_blank" rel="noopener">Transitous / MOTIS – πηγές</a>. Η τιμή εμφανίζεται ως fare μόνο όταν επιστρέφεται από το υποκείμενο feed.</div>`;
}
async function load(btn,target){
  const s=stateNow(),name=destinationName(),dt=tripDates();
  if(!name||!dt.from){target.innerHTML='<div class="hz-surface-note">Δώσε πρώτα ημερομηνίες ταξιδιού στο Planner.</div>';return;}
  const key=cacheKey(name,dt.from,dt.to),cached=cacheGet(key);if(cached){render(target,cached);return;}
  btn.disabled=true;const old=btn.textContent;btn.textContent='Αναζήτηση τρένων…';target.innerHTML='<div class="hz-surface-note">Γίνεται live/realtime αναζήτηση σιδηροδρομικών δρομολογίων μέσω Transitous…</div>';
  try{
    const u=new URL(`${window.HORIZON_LIVE_CONFIG.apiBase}/trains`);u.searchParams.set('origin',s.origin||'Αθήνα');u.searchParams.set('destination',name);u.searchParams.set('date',dt.from);if(dt.to)u.searchParams.set('returnDate',dt.to);
    const r=await fetch(u.toString());const data=await r.json().catch(()=>({}));if(!r.ok||!data.ok)throw new Error(data.error||data.details||'Αποτυχία live αναζήτησης τρένων.');
    cacheSet(key,data);render(target,data);
  }catch(e){target.innerHTML=`<div class="hz-surface-note">${esc(e.message||e)}<br><span style="color:#8399a8">Το Horizon κρατά τη στενή εκτίμηση τιμής μέχρι να απαντήσει ο provider.</span></div>`;}
  finally{btn.disabled=false;btn.textContent=old||'🚆 Πραγματικά τρένα';}
}
function patch(){
  styles();
  const pane=document.querySelector('.horizon-detail-overlay [data-pane="transport"]');if(!pane)return;
  const box=pane.querySelector('.hz-surface-live');if(!box)return;
  const btn=box.querySelector('[data-surface="train"]');if(!btn)return;
  btn.textContent='🚆 Πραγματικά τρένα';btn.classList.add('live');box.style.display='';
  const copy=box.querySelector('.hz-surface-copy');if(copy)copy.textContent='Live/realtime τρένα μέσω Transitous/MOTIS και πραγματικά πλοία μέσω Ferryhopper. Η αναζήτηση χρησιμοποιεί αυτόματα αφετηρία, προορισμό και ημερομηνίες. Για το τρένο, αν το feed δεν επιστρέψει fare, κρατάμε στενή και ξεκάθαρη εκτίμηση τιμής.';
  if(btn.dataset.transitousBound==='1')return;
  btn.dataset.transitousBound='1';
  btn.onclick=()=>load(btn,box.querySelector('.hz-surface-results'));
}
function burst(){[0,80,220,600,1100].forEach(ms=>setTimeout(patch,ms));}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',burst,{once:true});else burst();
document.addEventListener('click',e=>{if(e.target.closest('.destination .actions a,.destination .actions button,.hd-tab'))burst();},true);
})();

(()=>{
'use strict';
const STYLE_ID='horizon-surface-live-style',FERRY_TTL=30*60*1000;
function styles(){if(document.getElementById(STYLE_ID))return;const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
.hz-surface-live{margin:14px 0 18px;padding:15px;border:1px solid rgba(101,211,154,.22);border-radius:15px;background:rgba(101,211,154,.035)}
.hz-surface-head{font-weight:900;margin-bottom:4px}.hz-surface-copy{color:#91a4b2;font-size:.76rem;line-height:1.45;margin-bottom:10px}.hz-surface-actions{display:flex;gap:7px;flex-wrap:wrap}.hz-surface-btn{border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:9px 11px;background:#0b1d2b;color:white;font-weight:850;cursor:pointer}.hz-surface-btn.live{border-color:rgba(101,211,154,.4)}.hz-surface-btn:disabled{opacity:.55;cursor:wait}.hz-surface-results{margin-top:12px;display:grid;gap:8px}.hz-surface-card{padding:11px 12px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.025)}.hz-surface-row{display:flex;justify-content:space-between;gap:12px;align-items:start}.hz-surface-card b{display:block}.hz-surface-price{font-weight:950;color:#8ae5b5}.hz-surface-meta{margin-top:4px;color:#9fb0bd;font-size:.72rem;line-height:1.45}.hz-surface-note{padding:11px;border:1px dashed rgba(255,255,255,.14);border-radius:11px;color:#a9b7c1;font-size:.75rem;line-height:1.45}.hz-surface-badge{display:inline-block;margin-left:5px;padding:2px 5px;border-radius:999px;background:rgba(101,211,154,.1);color:#8ae5b5;font-size:.62rem;font-weight:900}
`;document.head.appendChild(s);}
function stateNow(){try{return typeof state!=='undefined'&&state?state:{};}catch{return {};}}
function esc(v){return String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));}
function link(v){try{const u=new URL(String(v||''));return u.protocol==='https:'?u.href:null;}catch{return null;}}
function validPrice(v){if(v===null||v===undefined||String(v).trim()==='')return null;const p=Number(v);return Number.isFinite(p)&&p>=0?p:null;}
function party(){const t=stateNow().travelers||{};return {adults:Math.max(1,Number(t.adults)||1),children:Math.max(0,Number(t.children)||0),infants:Math.max(0,Number(t.infants)||0)};}
function addDays(iso,n){const d=new Date(`${iso}T12:00:00`);d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);}
function tripDates(){const s=stateNow(),from=s.dates?.from||'',days=Math.max(1,Number(s.duration)||1);return {from,to:from?addDays(from,Math.max(0,days-1)):''};}
function destinationName(){return document.querySelector('.horizon-detail-overlay .hd-head h3')?.textContent?.trim()||'';}
function destData(name){return (window.HORIZON_DESTINATIONS||[]).find(d=>d.name===name)||{};}
function euro(v,c='EUR'){const n=Number(v);return Number.isFinite(n)?new Intl.NumberFormat('el-GR',{style:'currency',currency:c||'EUR',maximumFractionDigits:0}).format(n):'—';}
function time(v){if(!v)return '—';const s=String(v);const m=s.match(/(\d{1,2}):(\d{2})/);return m?`${m[1].padStart(2,'0')}:${m[2]}`:s.slice(0,16);}
function duration(v){const n=Number(v);if(!Number.isFinite(n)||n<=0)return '—';const h=Math.floor(n/60),m=Math.round(n%60);return h?(m?`${h}ω ${m}λ`:`${h}ω`):`${m}λ`;}
function cacheKey(name,from,to){const s=stateNow(),t=party();return `hz-ferries-v2:${[s.origin||'Αθήνα',name,from,to,t.adults,t.children,t.infants].join('|')}`;}
function cacheGet(k){try{const v=JSON.parse(localStorage.getItem(k)||'null');return v&&Date.now()-v.at<FERRY_TTL?v.data:null;}catch{return null;}}
function cacheSet(k,data){try{localStorage.setItem(k,JSON.stringify({at:Date.now(),data}));}catch{}}
function updateComparisonTable(data){
  const ov=document.querySelector('.horizon-detail-overlay');if(!ov)return;
  const table=ov.querySelector('[data-pane="transport"] .hz-tr-table');if(!table)return;
  const row=[...table.querySelectorAll('tbody tr')].find(r=>/Πλοίο/.test(r.cells?.[0]?.textContent||''));
  if(!row||row.cells.length<4||!Array.isArray(data?.outbound)||!data.outbound.length)return;
  const trip=data.outbound.find(x=>x?.departure&&x?.arrival)||data.outbound[0];
  if(validPrice(trip.durationMinutes)!==null&&trip.durationMinutes>0)
    row.cells[1].textContent=duration(trip.durationMinutes);
  // NEVER replace the family's trip estimate with the sum of two per-option
  // starting fares. Neither party composition nor vehicle/cabin is quoted.
  const source=document.createElement('span');source.className='hz-tr-note';
  source.textContent='Αναζήτηση δρομολογίων Ferryhopper: '+(data.ferryPort||data.requestedOrigin||'λιμάνι προς έλεγχο')+
    '. Οι εμφανιζόμενες τιμές έναρξης ΔΕΝ αποτελούν οικογενειακό ναύλο ή τιμή μετ’ επιστροφής.';
  row.cells[3].replaceChildren();
  const status=document.createElement('span');status.className='hz-tr-status-live';
  status.textContent='Στοιχεία δρομολογίων από Ferryhopper (όχι κράτηση)';
  row.cells[3].append(status,source);
  // No horizon:live-ferry-price event: without traveler/vehicle checkout
  // there is no trustworthy all-in budget amount to publish.
}
function ferryCard(x,heading){
  const p=validPrice(x?.price),url=link(x?.bookingUrl);
  const carrier=esc(x?.operator||x?.vessel||'Ακτοπλοϊκή επιλογή');
  const vessel=x?.vessel?' · '+esc(x.vessel):'';
  const from=esc(time(x?.departure)),to=esc(time(x?.arrival));
  const price=p===null?'Δεν δόθηκε τιμή':esc(euro(p,x?.currency||'EUR'))+' από / επιλογή';
  return '<div class="hz-surface-card"><div class="hz-surface-row"><div><b>'+
    esc(heading)+' · '+carrier+'</b><div class="hz-surface-meta">'+from+' → '+to+vessel+
    (validPrice(x?.durationMinutes)!==null&&x.durationMinutes>0?' · '+esc(duration(x.durationMinutes)):'')+
    '</div></div><div class="hz-surface-price">'+price+'</div></div>'+
    (url?'<div class="hz-surface-meta"><a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">Έλεγχος τιμής και όρων στον πάροχο</a></div>':'')+
    '</div>';
}
function renderTrips(target,data,fromCache=false){
  const outbound=Array.isArray(data?.outbound)?data.outbound:[];
  const inbound=Array.isArray(data?.inbound)?data.inbound:[];
  if(!outbound.length){target.innerHTML='<div class="hz-surface-note">Δεν επέστρεψαν δρομολόγια για την αναχώρηση. Δεν τεκμαίρεται ότι δεν υπάρχει σύνδεση — έλεγξε άλλο λιμάνι ή ημερομηνία.</div>';return;}
  updateComparisonTable(data);
  const t=party(),note='Δρομολόγια από Ferryhopper'+(fromCache?' · αποθηκευμένη αναζήτηση':'')+
    (data?.retrievedAt?' · ανάκτηση '+new Date(data.retrievedAt).toLocaleString('el-GR'):'')+
    '. Τιμές έναρξης ανά επιλογή, χωρίς επιβεβαίωση για '+t.adults+' ενήλικες, '+t.children+' παιδιά, '+t.infants+
    ' βρέφη, όχημα ή καμπίνα. Δεν προστίθενται στο οικογενειακό budget. Επιβεβαίωσε δρομολόγιο, χωρητικότητα, φόρους και τελική χρέωση στον πωλητή.';
  const info='<div class="hz-surface-note" data-ferry-disclaimer>'+esc(note)+'</div>';
  const returnNote=data?.returnDate&&!inbound.length?'<div class="hz-surface-note">Δεν βρέθηκε επαληθευμένη επιστροφή. Δεν υπάρχει πλήρης προσφορά μετ’ επιστροφής.</div>':'';
  target.innerHTML=info+outbound.slice(0,10).map(x=>ferryCard(x,'Αναχώρηση')).join('')+
    (inbound.length?'<div class="hz-surface-note">Επιλογές επιστροφής (ξεχωριστές τιμές έναρξης, όχι συνδυαστικό εισιτήριο)</div>'+
    inbound.slice(0,6).map(x=>ferryCard(x,'Επιστροφή')).join(''):returnNote);
}
async function loadFerries(btn,target){
  const name=destinationName(),s=stateNow(),dt=tripDates();if(!name||!dt.from)return;
  const key=cacheKey(name,dt.from,dt.to),cached=cacheGet(key);if(cached){renderTrips(target,cached,true);return;}
  btn.disabled=true;btn.textContent='Αναζήτηση…';target.innerHTML='<div class="hz-surface-note">Γίνεται live αναζήτηση Ferryhopper για τις ημερομηνίες του ταξιδιού σου…</div>';
  try{
    const u=new URL(`${window.HORIZON_LIVE_CONFIG.apiBase}/ferries`);u.searchParams.set('origin',s.origin||'Αθήνα');u.searchParams.set('destination',name);u.searchParams.set('date',dt.from);if(dt.to)u.searchParams.set('returnDate',dt.to);
    const r=await fetch(u.toString());const data=await r.json().catch(()=>({}));if(!r.ok||!data.ok)throw new Error(data.error||data.details||'Αποτυχία αναζήτησης πλοίων.');
    if(data.destination!==name||data.date!==dt.from||(data.returnDate||'')!==dt.to)
      throw new Error('Η απάντηση του παρόχου δεν ταιριάζει με τις ημερομηνίες/διαδρομή.');
    cacheSet(key,data);renderTrips(target,data);
  }catch(e){target.innerHTML='<div class="hz-surface-note">'+esc(e.message||e)+
      '<br>Η ενδεικτική εκτίμηση του Horizon παραμένει διαθέσιμη, χωρίς επιβεβαιωμένο δρομολόγιο ή τιμή.</div>';}
  finally{btn.disabled=false;btn.textContent='⛴ Πραγματικά πλοία';}
}
function groundStatus(mode,target){
  const train=mode==='train';
  target.innerHTML='<div class="hz-surface-note"><b>'+
    (train?'🚆 Τρένα':'🚌 ΚΤΕΛ / λεωφορεία')+
    ':</b> '+(train?'Η αναζήτηση δρομολογίων λειτουργεί μέσω Transitous/MOTIS όταν είναι διαθέσιμη.':
    'Δεν έχει συνδεθεί πάροχος αξιόπιστων live δρομολογίων ή τιμών ΚΤΕΛ.')+
    ' Οι τιμές του βασικού πίνακα είναι εκτιμήσεις και δεν αποτελούν προσφορά κράτησης.</div>';
}
function patch(){
  const ov=document.querySelector('.horizon-detail-overlay');if(!ov)return;const pane=ov.querySelector('[data-pane="transport"]');if(!pane||pane.querySelector('.hz-surface-live'))return;const name=destinationName();if(!name)return;
  const d=destData(name),modes=new Set(d.transport||[]),wrap=document.createElement('section');wrap.className='hz-surface-live';
  // The KTEL availability notice is useful even if an earlier module has not
  // yet augmented this mainland destination's list of possible travel modes.
  if(d.region==='Ελλάδα'&&d.type!=='island')modes.add('bus');
  const buttons=[];if(modes.has('ferry'))buttons.push('<button type="button" class="hz-surface-btn live" data-surface="ferry">⛴ Πραγματικά πλοία</button>');if(modes.has('train'))buttons.push('<button type="button" class="hz-surface-btn" data-surface="train">🚆 Live τρένα</button>');if(modes.has('bus'))buttons.push('<button type="button" class="hz-surface-btn" data-surface="bus">🚌 ΚΤΕΛ · χωρίς live σύνδεση</button>');if(!buttons.length)return;
  wrap.innerHTML=`<div class="hz-surface-head">Πραγματικά δρομολόγια</div><div class="hz-surface-copy">Χρησιμοποιούνται αυτόματα η αφετηρία, ο προορισμός και οι ημερομηνίες που έδωσες στο Planner. Οι ώρες προέρχονται από διαθέσιμες πηγές, ενώ οι τιμές εισιτηρίων εκτός ολοκληρωμένου checkout παραμένουν ενδείξεις. Πλοία Ferryhopper (τιμές έναρξης ανά επιλογή), τρένα Transitous (feed), ΚΤΕΛ χωρίς συνδεδεμένο live provider.</div><div class="hz-surface-actions">${buttons.join('')}</div><div class="hz-surface-results"></div>`;
  const compare=pane.querySelector('.hz-tr-compare');(compare||pane.firstElementChild)?.after(wrap);const target=wrap.querySelector('.hz-surface-results');wrap.querySelectorAll('[data-surface]').forEach(b=>b.onclick=()=>{const m=b.dataset.surface;if(m==='ferry')loadFerries(b,target);else groundStatus(m,target);});
}
styles();document.addEventListener('click',()=>setTimeout(patch,0),true);setTimeout(patch,200);
})();

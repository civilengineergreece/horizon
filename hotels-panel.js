(()=>{
'use strict';

const STYLE_ID='horizon-hotels-panel-style';
const API_BASE=String(window.HORIZON_LIVE_CONFIG?.apiBase||'https://horizon-live-api.gnchristou.workers.dev').replace(/\/$/,'');

function installStyles(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement('style');
  s.id=STYLE_ID;
  s.textContent=`
    .hz-hotels-panel{margin-top:22px;padding:16px;border:1px solid rgba(255,122,22,.24);border-radius:16px;background:rgba(255,255,255,.025)}
    .hz-hotels-panel h4{margin:0 0 6px;font-size:1rem}.hz-hotels-copy{color:#a7b6c1;font-size:.84rem;line-height:1.5;margin-bottom:14px}
    .hz-hotels-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-bottom:14px}
    .hz-hotel-chip{padding:11px 12px;border-radius:12px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.08)}
    .hz-hotel-chip small{display:block;color:#8fa3b2;margin-bottom:3px}.hz-hotel-chip b{font-size:.9rem}
    .hz-stay-load{border:0;border-radius:11px;padding:11px 14px;background:linear-gradient(180deg,#ff8b29,#df5e08);color:#fff;font-weight:800;cursor:pointer}.hz-stay-load:disabled{opacity:.62;cursor:wait}
    .hz-stay-status{margin-top:9px;color:#8fa3b2;font-size:.78rem;line-height:1.45}.hz-stay-status.error{color:#ffb1a3}
    .hz-stay-toolbar{display:none;gap:7px;flex-wrap:wrap;margin:14px 0 10px}.hz-stay-toolbar.active{display:flex}.hz-stay-filter{border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:7px 10px;background:#0b1d2b;color:#cbd5dc;font-weight:800;font-size:.75rem;cursor:pointer}.hz-stay-filter.active{border-color:#ff7a16;color:#fff;background:rgba(255,122,22,.12)}
    .hz-stay-results{display:grid;gap:10px;margin-top:12px}.hz-stay-card{display:grid;grid-template-columns:108px 1fr;gap:12px;padding:11px;border:1px solid rgba(255,255,255,.09);border-radius:15px;background:rgba(255,255,255,.035)}
    .hz-stay-img{width:108px;height:102px;object-fit:cover;border-radius:11px;background:#102538}.hz-stay-img.placeholder{display:grid;place-items:center;color:#7f95a4;font-size:.72rem;text-align:center;padding:8px}
    .hz-stay-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.hz-stay-name{font-weight:900;line-height:1.25}.hz-stay-type{color:#ff9d4d;font-size:.72rem;font-weight:800;margin-top:3px}.hz-stay-meta{color:#94a8b7;font-size:.76rem;margin-top:6px;line-height:1.4}
    .hz-stay-price{font-weight:900;white-space:nowrap}.hz-stay-night{color:#8fa3b2;font-size:.72rem;text-align:right;margin-top:2px}
    .hz-provider-row{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}.hz-provider-link{display:inline-flex;align-items:center;border:1px solid rgba(255,255,255,.12);border-radius:9px;padding:7px 9px;color:#fff;text-decoration:none;font-size:.72rem;font-weight:800;background:#0b1d2b}.hz-provider-link.best{border-color:#ff7a16;background:rgba(255,122,22,.10)}
    .hz-stay-empty{padding:16px;border:1px dashed rgba(255,255,255,.13);border-radius:14px;color:#9fb0bd;text-align:center}.hz-stay-summary{margin-top:10px;color:#9fb0bd;font-size:.76rem}
    .hz-stay-fallback{margin-top:14px;padding:14px;border:1px solid rgba(255,122,22,.24);border-radius:14px;background:rgba(255,122,22,.06)}
    .hz-stay-fallback b{display:block;margin-bottom:5px}.hz-stay-fallback p{margin:0 0 10px;color:#aebdc7;font-size:.79rem;line-height:1.5}
    .hz-stay-fallback-actions{display:flex;gap:8px;flex-wrap:wrap}.hz-stay-fallback-actions a{display:inline-flex;align-items:center;padding:9px 11px;border-radius:10px;text-decoration:none;font-weight:800;font-size:.76rem;color:#fff;background:#0b1d2b;border:1px solid rgba(255,255,255,.12)}.hz-stay-fallback-actions a.primary{border-color:#ff7a16;background:rgba(255,122,22,.15)}
    @media(max-width:620px){.hz-hotels-grid{grid-template-columns:1fr}.hz-stay-load{width:100%}.hz-stay-card{grid-template-columns:82px 1fr}.hz-stay-img{width:82px;height:92px}.hz-stay-head{display:block}.hz-stay-price,.hz-stay-night{text-align:left;margin-top:5px}.hz-stay-fallback-actions a{width:100%;justify-content:center}}
  `;
  document.head.appendChild(s);
}

function travelState(){return typeof state!=='undefined'&&state?state:{};}
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function parseISO(iso){const m=String(iso||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?new Date(Number(m[1]),Number(m[2])-1,Number(m[3]),12,0,0,0):null;}
function isoLocal(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function addDaysISO(iso,n){const d=parseISO(iso);if(!d)return '';d.setDate(d.getDate()+n);return isoLocal(d);}
function pretty(iso){const d=parseISO(iso);return d?d.toLocaleDateString('el-GR',{day:'numeric',month:'short',year:'numeric'}):'—';}
function money(v,c='EUR'){return new Intl.NumberFormat('el-GR',{style:'currency',currency:c||'EUR',maximumFractionDigits:0}).format(Number(v)||0);}
function safeUrl(v){try{const u=new URL(String(v||''));return u.protocol==='https:'?u.toString():'';}catch{return '';}}
function providerLabel(p){return ({booking:'Booking.com',vrbo:'Vrbo',expedia:'Expedia',hotelscom:'Hotels.com'})[p]||p;}

function hotelInfo(name){
  const s=travelState();
  const days=Math.max(1,Math.floor(Number(s.duration)||1));
  const nights=Math.max(0,days-1);
  const checkIn=s.dates?.from||'';
  const checkOut=nights?addDaysISO(checkIn,nights):'';
  const adults=Math.max(1,Math.floor(Number(s.travelers?.adults)||1));
  const children=Math.max(0,Math.floor(Number(s.travelers?.children)||0));
  const infants=Math.max(0,Math.floor(Number(s.travelers?.infants)||0));
  return {name,days,nights,checkIn,checkOut,adults,children,infants};
}

function bookingSearchUrl(info){
  const u=new URL('https://www.booking.com/searchresults.html');
  u.searchParams.set('ss',info.name);
  u.searchParams.set('checkin',info.checkIn);
  u.searchParams.set('checkout',info.checkOut);
  u.searchParams.set('group_adults',String(info.adults));
  u.searchParams.set('group_children',String(info.children));
  u.searchParams.set('no_rooms','1');
  return u.toString();
}

function googleHotelsUrl(info){
  const q=`ξενοδοχεία ${info.name} ${info.checkIn} ${info.checkOut}`;
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

function renderFallback(panel,info,message=''){
  const resultsEl=panel.querySelector('.hz-stay-results');
  const toolbar=panel.querySelector('.hz-stay-toolbar');
  const summary=panel.querySelector('.hz-stay-summary');
  toolbar?.classList.remove('active');
  if(summary)summary.textContent='';
  if(!resultsEl)return;
  resultsEl.innerHTML=`
    <div class="hz-stay-fallback">
      <b>Η αναζήτηση παραμένει διαθέσιμη.</b>
      <p>Οι live κάρτες του Horizon χρειάζονται ενεργό Stay22 API key. Μέχρι να συνδεθεί, άνοιξε την ίδια αναζήτηση με τις επιλεγμένες ημερομηνίες σε Booking.com ή Google Hotels.${message?` ${esc(message)}`:''}</p>
      <div class="hz-stay-fallback-actions">
        <a class="primary" href="${esc(bookingSearchUrl(info))}" target="_blank" rel="noopener">Booking.com με ημερομηνίες ↗</a>
        <a href="${esc(googleHotelsUrl(info))}" target="_blank" rel="noopener">Google Hotels ↗</a>
      </div>
    </div>`;
}

function category(item){
  const t=String(item?.type||'').toLowerCase();
  const hasVrbo=(item?.suppliers||[]).some(x=>x.provider==='vrbo');
  if(hasVrbo||/apartment|house|home|villa|condo|rental|studio|chalet|cottage/.test(t))return 'rental';
  return 'hotel';
}

function resultCard(item,nights){
  const image=safeUrl(item.image);
  const suppliers=Array.isArray(item.suppliers)?item.suppliers:[];
  const providerLinks=suppliers.map((s,i)=>{
    const link=safeUrl(s.link);if(!link)return '';
    const txt=s.total?`${providerLabel(s.provider)} ${money(s.total,item.currency)}`:providerLabel(s.provider);
    return `<a class="hz-provider-link${i===0?' best':''}" href="${esc(link)}" target="_blank" rel="noopener">${esc(txt)} ↗</a>`;
  }).join('');
  const rating=item.rating?`★ ${Number(item.rating).toFixed(1)}`:'';
  const address=item.address||'';
  const dist=item.distanceInMeters?`${(item.distanceInMeters/1000).toFixed(1)} km από το κέντρο`:'';
  return `<article class="hz-stay-card" data-kind="${category(item)}">
    ${image?`<img class="hz-stay-img" src="${esc(image)}" loading="lazy" alt="">`:`<div class="hz-stay-img placeholder">Χωρίς φωτογραφία</div>`}
    <div>
      <div class="hz-stay-head"><div><div class="hz-stay-name">${esc(item.name)}</div><div class="hz-stay-type">${esc(item.type||'Κατάλυμα')}</div></div><div>${item.bestTotal?`<div class="hz-stay-price">${money(item.bestTotal,item.currency)}</div>${item.nightly?`<div class="hz-stay-night">${money(item.nightly,item.currency)}/βράδυ</div>`:''}`:''}</div></div>
      <div class="hz-stay-meta">${[rating,address,dist].filter(Boolean).map(esc).join(' · ')}</div>
      <div class="hz-provider-row">${providerLinks||'<span class="hz-stay-meta">Δεν υπάρχει διαθέσιμο link παρόχου.</span>'}</div>
    </div>
  </article>`;
}

function renderResults(panel,data){
  panel._stayData=data;
  const toolbar=panel.querySelector('.hz-stay-toolbar');
  const resultsEl=panel.querySelector('.hz-stay-results');
  const summary=panel.querySelector('.hz-stay-summary');
  toolbar.classList.add('active');

  const apply=(kind='all')=>{
    toolbar.querySelectorAll('.hz-stay-filter').forEach(b=>b.classList.toggle('active',b.dataset.kind===kind));
    const all=Array.isArray(data.results)?data.results:[];
    const filtered=kind==='all'?all:all.filter(x=>category(x)===kind);
    resultsEl.innerHTML=filtered.length?filtered.map(x=>resultCard(x,data.nights)).join(''):'<div class="hz-stay-empty">Δεν βρέθηκαν επιλογές σε αυτή την κατηγορία.</div>';
    const label=kind==='rental'?'σπίτια/διαμερίσματα':kind==='hotel'?'ξενοδοχεία':'καταλύματα';
    summary.textContent=`Εμφανίζονται ${filtered.length} ${label}. Πηγές: Booking.com, Vrbo, Expedia, Hotels.com όπου υπάρχουν διαθέσιμες τιμές.`;
  };
  toolbar.querySelectorAll('.hz-stay-filter').forEach(btn=>btn.onclick=()=>apply(btn.dataset.kind));
  apply('all');
}

async function searchStays(panel,info){
  const btn=panel.querySelector('.hz-stay-load');
  const status=panel.querySelector('.hz-stay-status');
  btn.disabled=true;btn.textContent='Αναζήτηση καταλυμάτων…';
  status.classList.remove('error');status.textContent='Ψάχνω live τιμές και διαθεσιμότητα…';
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),15000);
  try{
    const res=await fetch(`${API_BASE}/stays`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({destination:info.name,checkInDate:info.checkIn,checkOutDate:info.checkOut,pageSize:12}),signal:controller.signal});
    const data=await res.json().catch(()=>({}));
    if(!res.ok||data.ok===false){
      if(data?.code==='STAY22_API_KEY_REQUIRED'||/api key/i.test(String(data?.error||''))){
        renderFallback(panel,info);
        btn.textContent='Έλεγχος live καρτών';
        status.classList.remove('error');
        status.textContent='Οι live κάρτες θα ενεργοποιηθούν αυτόματα μόλις προστεθεί Stay22 API key.';
        return;
      }
      throw new Error(data.error||`HTTP ${res.status}`);
    }
    renderResults(panel,data);
    btn.textContent='Ανανέωση αναζήτησης';
    status.textContent='Live αναζήτηση καταλυμάτων.';
  }catch(e){
    btn.textContent='Εναλλακτική αναζήτηση';
    status.classList.remove('error');
    status.textContent=e.name==='AbortError'?'Η live υπηρεσία άργησε. Σου δίνω άμεσα εναλλακτική αναζήτηση με τις ίδιες ημερομηνίες.':'Η live υπηρεσία δεν είναι διαθέσιμη αυτή τη στιγμή. Χρησιμοποίησε την εναλλακτική αναζήτηση παρακάτω.';
    renderFallback(panel,info);
  }finally{clearTimeout(timer);btn.disabled=false;}
}

function renderPanel(pane,name){
  pane.querySelectorAll('.hz-live-wrap').forEach(el=>el.remove());
  let panel=pane.querySelector('.hz-hotels-panel');
  const info=hotelInfo(name);
  const people=info.adults+info.children+info.infants;
  if(!panel){panel=document.createElement('section');panel.className='hz-hotels-panel';pane.appendChild(panel);}

  if(info.nights===0){panel.innerHTML='<h4>Ξενοδοχεία & καταλύματα</h4><div class="hz-hotels-copy">Έχεις επιλέξει μονοήμερη εκδρομή, οπότε δεν απαιτείται διανυκτέρευση.</div>';return;}

  const signature=[info.name,info.checkIn,info.checkOut,info.adults,info.children,info.infants].join('|');
  if(panel.dataset.signature===signature)return;
  panel.dataset.signature=signature;
  panel.innerHTML=`
    <h4>Ξενοδοχεία & σπίτια διακοπών</h4>
    <div class="hz-hotels-copy">Live αναζήτηση μέσα στο Horizon. Με ενεργό Stay22 API key, τα αποτελέσματα εμφανίζονται ως δικές μας κάρτες. Χωρίς key, το Horizon περνάει αυτόματα σε ασφαλή εναλλακτική αναζήτηση χωρίς να εμφανίζει σφάλμα.</div>
    <div class="hz-hotels-grid">
      <div class="hz-hotel-chip"><small>Προορισμός</small><b>${esc(info.name)}</b></div>
      <div class="hz-hotel-chip"><small>Διανυκτερεύσεις</small><b>${info.nights}</b></div>
      <div class="hz-hotel-chip"><small>Check-in</small><b>${pretty(info.checkIn)}</b></div>
      <div class="hz-hotel-chip"><small>Check-out</small><b>${pretty(info.checkOut)}</b></div>
      <div class="hz-hotel-chip"><small>Ταξιδιώτες</small><b>${people} συνολικά</b></div>
      <div class="hz-hotel-chip"><small>Κατηγορίες</small><b>${info.adults} × 12+ · ${info.children} παιδιά · ${info.infants} βρέφη</b></div>
    </div>
    <button type="button" class="hz-stay-load">Αναζήτηση πραγματικών καταλυμάτων</button>
    <div class="hz-stay-status">Το Horizon δοκιμάζει πρώτα τις live κάρτες και, αν ο πάροχος απαιτεί API key, περνάει αυτόματα σε λειτουργική εναλλακτική.</div>
    <div class="hz-stay-toolbar"><button class="hz-stay-filter active" data-kind="all">Όλα</button><button class="hz-stay-filter" data-kind="hotel">Ξενοδοχεία</button><button class="hz-stay-filter" data-kind="rental">Σπίτια / διαμερίσματα</button></div>
    <div class="hz-stay-results"></div><div class="hz-stay-summary"></div>`;
  panel.querySelector('.hz-stay-load').addEventListener('click',()=>searchStays(panel,info));
}

function addPanel(overlay){const name=overlay.querySelector('.hd-head h3')?.textContent?.trim();if(!name)return;const pane=overlay.querySelector('[data-pane="stay"]');if(!pane)return;renderPanel(pane,name);}
function refresh(){document.querySelectorAll('.horizon-detail-overlay').forEach(addPanel);}
function init(){installStyles();new MutationObserver(refresh).observe(document.body,{childList:true,subtree:true});refresh();}
window.HorizonHotels={refresh};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

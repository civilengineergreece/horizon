(()=>{
'use strict';

const STYLE_ID='horizon-hotels-panel-style';
const API_BASE=String(window.HORIZON_LIVE_CONFIG?.apiBase||'https://horizon-live-api.gnchristou.workers.dev').replace(/\/$/,'');
const LOCAL_CACHE_TTL=30*60*1000;
const INITIAL_VISIBLE=10;

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
    .hz-cache-badge{display:none;margin:10px 0 0;padding:7px 9px;border-radius:9px;background:rgba(101,211,154,.08);border:1px solid rgba(101,211,154,.22);color:#9de8be;font-size:.72rem;font-weight:800}.hz-cache-badge.active{display:inline-flex}
    .hz-filters{display:none;margin-top:15px;padding:12px;border:1px solid rgba(255,255,255,.08);border-radius:14px;background:rgba(5,16,26,.38)}.hz-filters.active{display:block}
    .hz-filter-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.hz-filter-field label{display:block;color:#8fa3b2;font-size:.7rem;margin-bottom:4px}
    .hz-filter-field select,.hz-filter-field input[type=range]{width:100%}.hz-filter-field select{border:1px solid rgba(255,255,255,.12);background:#0b1d2b;color:#fff;border-radius:9px;padding:8px}
    .hz-price-line{display:flex;justify-content:space-between;gap:8px;align-items:center;color:#cbd6dd;font-size:.76rem;margin-bottom:4px}.hz-price-line b{color:#fff}
    .hz-amenity-title{margin-top:11px;color:#8fa3b2;font-size:.7rem}.hz-amenity-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
    .hz-amenity-chip{display:inline-flex;align-items:center;gap:5px;border:1px solid rgba(255,255,255,.1);border-radius:999px;padding:6px 8px;background:#0b1d2b;color:#cbd5dc;font-size:.7rem;cursor:pointer}.hz-amenity-chip input{accent-color:#ff7a16}
    .hz-filter-actions{display:flex;justify-content:flex-end;margin-top:10px}.hz-reset{border:1px solid rgba(255,255,255,.11);background:transparent;color:#cbd5dc;border-radius:9px;padding:7px 9px;font-size:.72rem;font-weight:800;cursor:pointer}
    .hz-stay-results{display:grid;gap:10px;margin-top:14px}.hz-stay-card{display:grid;grid-template-columns:118px 1fr;gap:12px;padding:11px;border:1px solid rgba(255,255,255,.09);border-radius:15px;background:rgba(255,255,255,.035)}
    .hz-stay-img{width:118px;height:112px;object-fit:cover;border-radius:11px;background:#102538}.hz-stay-img.placeholder{display:grid;place-items:center;color:#7f95a4;font-size:.72rem;text-align:center;padding:8px}
    .hz-stay-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.hz-stay-name{font-weight:900;line-height:1.25}.hz-stay-type{color:#ff9d4d;font-size:.72rem;font-weight:800;margin-top:3px}
    .hz-stay-meta{color:#94a8b7;font-size:.76rem;margin-top:6px;line-height:1.45}.hz-stay-pricebox{text-align:right;min-width:92px}.hz-total-label{color:#8fa3b2;font-size:.64rem}
    .hz-stay-price{font-weight:900;font-size:1.02rem;white-space:nowrap}.hz-stay-night{color:#b9c6ce;font-size:.72rem;margin-top:1px}.hz-stay-amenities{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}
    .hz-stay-amenities span{border:1px solid rgba(255,255,255,.08);border-radius:999px;padding:3px 6px;color:#b6c4cd;font-size:.66rem}.hz-stay-source{display:inline-flex;margin-top:8px;padding:5px 8px;border-radius:999px;background:rgba(255,122,22,.09);border:1px solid rgba(255,122,22,.22);color:#ffb273;font-size:.68rem;font-weight:800}
    .hz-stay-empty{padding:16px;border:1px dashed rgba(255,255,255,.13);border-radius:14px;color:#9fb0bd;text-align:center}.hz-stay-summary{margin-top:10px;color:#9fb0bd;font-size:.76rem;line-height:1.45}
    .hz-more-wrap{display:flex;justify-content:center;margin-top:12px}.hz-more{border:1px solid rgba(255,122,22,.35);background:rgba(255,122,22,.08);color:#fff;border-radius:10px;padding:9px 12px;font-weight:800;font-size:.76rem;cursor:pointer}
    @media(max-width:620px){.hz-hotels-grid,.hz-filter-grid{grid-template-columns:1fr}.hz-stay-load{width:100%}.hz-stay-card{grid-template-columns:88px 1fr}.hz-stay-img{width:88px;height:100px}.hz-stay-head{display:block}.hz-stay-pricebox{text-align:left;margin-top:6px}.hz-stay-price{display:inline;margin-right:6px}.hz-total-label{display:inline;margin-right:4px}}
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
function removeLegacyStayLinks(pane){
  pane.querySelectorAll('.hd-cta-row a').forEach(a=>{
    const t=a.textContent.toLowerCase();
    if(t.includes('booking')||t.includes('google hotels'))a.remove();
  });
}
function localKey(info){
  return `hz-hotel-cache-v2:${[info.name,info.checkIn,info.checkOut,info.adults,info.children,info.infants].join('|')}`;
}
function localRead(info){
  try{
    const raw=localStorage.getItem(localKey(info));
    if(!raw)return null;
    const box=JSON.parse(raw);
    if(!box?.savedAt||Date.now()-box.savedAt>LOCAL_CACHE_TTL){localStorage.removeItem(localKey(info));return null;}
    return box.data||null;
  }catch{return null;}
}
function localWrite(info,data){
  try{localStorage.setItem(localKey(info),JSON.stringify({savedAt:Date.now(),data}));}catch{}
}
function resultCard(item,nights){
  const image=safeUrl(item.image);
  const rating=item.rating?`★ ${Number(item.rating).toFixed(1)}${item.reviews?` (${Number(item.reviews).toLocaleString('el-GR')})`:''}`:'Χωρίς βαθμολογία';
  const stars=item.hotelClass?`${item.hotelClass}★ ξενοδοχείο`:'Ξενοδοχείο';
  const amenities=Array.isArray(item.amenities)?item.amenities.slice(0,5):[];
  const total=item.total||(item.nightly&&nights?item.nightly*nights:null);
  return `<article class="hz-stay-card">
    ${image?`<img class="hz-stay-img" src="${esc(image)}" loading="lazy" alt="">`:`<div class="hz-stay-img placeholder">Χωρίς φωτογραφία</div>`}
    <div>
      <div class="hz-stay-head">
        <div><div class="hz-stay-name">${esc(item.name)}</div><div class="hz-stay-type">${esc(stars)}</div></div>
        <div class="hz-stay-pricebox">
          ${total?`<div class="hz-total-label">Σύνολο ${nights} ${nights===1?'βράδυ':'βράδια'}</div><div class="hz-stay-price">${money(total,item.currency)}</div>`:''}
          ${item.nightly?`<div class="hz-stay-night">${money(item.nightly,item.currency)}/βράδυ</div>`:''}
        </div>
      </div>
      <div class="hz-stay-meta">${esc(rating)}${item.priceSource?` · ${esc(item.priceSource)}`:''}</div>
      ${amenities.length?`<div class="hz-stay-amenities">${amenities.map(a=>`<span>${esc(a)}</span>`).join('')}</div>`:''}
      <span class="hz-stay-source">Live τιμή μέσα στο Horizon</span>
    </div>
  </article>`;
}
function amenityOptions(items){
  const counts=new Map();
  items.forEach(item=>(item.amenities||[]).forEach(a=>counts.set(a,(counts.get(a)||0)+1)));
  return [...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'el')).slice(0,7).map(x=>x[0]);
}
function setupFilters(panel,data){
  const all=Array.isArray(data.results)?data.results:[];
  panel._hotelData=data;
  panel._hotelLimit=INITIAL_VISIBLE;
  panel._amenities=amenityOptions(all);
  const filters=panel.querySelector('.hz-filters');
  filters.classList.add('active');
  const prices=all.map(x=>Number(x.nightly)||0).filter(Boolean);
  const maxPrice=prices.length?Math.max(...prices):500;
  const cap=Math.max(50,Math.ceil(maxPrice/25)*25);
  const range=panel.querySelector('.hz-max-price');
  range.max=String(cap);range.value=String(cap);
  panel.querySelector('.hz-max-price-label').textContent=money(cap,data.currency);
  const chips=panel.querySelector('.hz-amenity-chips');
  chips.innerHTML=panel._amenities.map((a,i)=>`<label class="hz-amenity-chip"><input type="checkbox" data-amenity-index="${i}"> ${esc(a)}</label>`).join('');
  panel.querySelectorAll('.hz-sort,.hz-stars,.hz-rating').forEach(el=>el.onchange=()=>{panel._hotelLimit=INITIAL_VISIBLE;applyFilters(panel);});
  range.oninput=()=>{panel.querySelector('.hz-max-price-label').textContent=money(range.value,data.currency);panel._hotelLimit=INITIAL_VISIBLE;applyFilters(panel);};
  chips.querySelectorAll('input').forEach(el=>el.onchange=()=>{panel._hotelLimit=INITIAL_VISIBLE;applyFilters(panel);});
  panel.querySelector('.hz-reset').onclick=()=>{
    panel.querySelector('.hz-sort').value='priceAsc';
    panel.querySelector('.hz-stars').value='0';
    panel.querySelector('.hz-rating').value='0';
    range.value=String(cap);panel.querySelector('.hz-max-price-label').textContent=money(cap,data.currency);
    chips.querySelectorAll('input').forEach(x=>x.checked=false);
    panel._hotelLimit=INITIAL_VISIBLE;
    applyFilters(panel);
  };
}
function filteredItems(panel){
  const data=panel._hotelData||{};
  const all=Array.isArray(data.results)?[...data.results]:[];
  const maxPrice=Number(panel.querySelector('.hz-max-price')?.value||Infinity);
  const minStars=Number(panel.querySelector('.hz-stars')?.value||0);
  const minRating=Number(panel.querySelector('.hz-rating')?.value||0);
  const selected=[...panel.querySelectorAll('.hz-amenity-chips input:checked')].map(x=>panel._amenities?.[Number(x.dataset.amenityIndex)]).filter(Boolean);
  const sort=panel.querySelector('.hz-sort')?.value||'priceAsc';
  let out=all.filter(item=>{
    const nightly=Number(item.nightly)||Infinity;
    if(nightly>maxPrice)return false;
    if(minStars&&(Number(item.hotelClass)||0)<minStars)return false;
    if(minRating&&(Number(item.rating)||0)<minRating)return false;
    if(selected.length&&!selected.every(a=>(item.amenities||[]).includes(a)))return false;
    return true;
  });
  const price=x=>Number(x.nightly)||1e15;
  if(sort==='priceDesc')out.sort((a,b)=>price(b)-price(a));
  else if(sort==='rating')out.sort((a,b)=>(Number(b.rating)||0)-(Number(a.rating)||0)||price(a)-price(b));
  else if(sort==='stars')out.sort((a,b)=>(Number(b.hotelClass)||0)-(Number(a.hotelClass)||0)||price(a)-price(b));
  else if(sort==='reviews')out.sort((a,b)=>(Number(b.reviews)||0)-(Number(a.reviews)||0)||price(a)-price(b));
  else out.sort((a,b)=>price(a)-price(b));
  return out;
}
function applyFilters(panel){
  const data=panel._hotelData||{};
  const all=Array.isArray(data.results)?data.results:[];
  const out=filteredItems(panel);
  const resultsEl=panel.querySelector('.hz-stay-results');
  const summary=panel.querySelector('.hz-stay-summary');
  const limit=Math.min(panel._hotelLimit||INITIAL_VISIBLE,out.length);
  resultsEl.innerHTML=out.length?out.slice(0,limit).map(x=>resultCard(x,data.nights)).join(''):'<div class="hz-stay-empty">Δεν βρέθηκαν επιλογές με αυτά τα φίλτρα.</div>';
  let more=panel.querySelector('.hz-more-wrap');
  if(!more){more=document.createElement('div');more.className='hz-more-wrap';summary.before(more);}
  if(out.length>limit){
    more.innerHTML=`<button type="button" class="hz-more">Εμφάνιση περισσότερων (${out.length-limit})</button>`;
    more.querySelector('button').onclick=()=>{panel._hotelLimit=Math.min(out.length,(panel._hotelLimit||INITIAL_VISIBLE)+10);applyFilters(panel);};
  }else more.innerHTML='';
  summary.textContent=out.length?`Εμφανίζονται ${limit} από ${out.length} επιλογές μετά τα φίλτρα (${all.length} live αποτελέσματα συνολικά).`:'Δοκίμασε χαμηλότερη βαθμολογία, περισσότερα χρήματα ανά βράδυ ή καθάρισε τα φίλτρα.';
}
function renderResults(panel,data,cacheLabel=''){
  setupFilters(panel,data);
  applyFilters(panel);
  const badge=panel.querySelector('.hz-cache-badge');
  badge.classList.add('active');
  badge.textContent=cacheLabel||(data?.cache?.hit?'Horizon cache: επαναχρησιμοποιήθηκαν αποθηκευμένες live τιμές — χωρίς νέα αναζήτηση SerpApi.':'Νέα live αναζήτηση: αποθηκεύτηκε στην Horizon cache για επαναλαμβανόμενα ίδια αιτήματα.');
}
async function searchStays(panel,info){
  const btn=panel.querySelector('.hz-stay-load');
  const status=panel.querySelector('.hz-stay-status');
  const local=localRead(info);
  if(local){
    renderResults(panel,local,'Browser cache: άμεση επαναχρησιμοποίηση των ίδιων αποτελεσμάτων — χωρίς κλήση στον Worker.');
    btn.textContent='Επαναχρησιμοποίηση live τιμών';
    status.classList.remove('error');
    status.textContent='Τα ίδια στοιχεία αναζήτησης βρέθηκαν στην τοπική cache του Horizon.';
    return;
  }
  btn.disabled=true;btn.textContent='Αναζήτηση live τιμών…';
  status.classList.remove('error');status.textContent='Ψάχνω πραγματικές τιμές ξενοδοχείων μέσα στο Horizon…';
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),22000);
  try{
    const res=await fetch(`${API_BASE}/stays`,{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({destination:info.name,checkInDate:info.checkIn,checkOutDate:info.checkOut,adults:info.adults,children:info.children,infants:info.infants,pageSize:20}),
      signal:controller.signal
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok||data.ok===false){
      if(data?.code==='SERPAPI_KEY_REQUIRED'){
        status.classList.add('error');status.textContent='Δεν είναι ενεργό το SerpApi key στον Cloudflare Worker.';btn.textContent='Live τιμές — API μη ενεργό';return;
      }
      if(data?.code==='FREE_QUOTA_REACHED')throw new Error('Εξαντλήθηκε το δωρεάν μηνιαίο όριο αναζητήσεων.');
      throw new Error(data.error||`HTTP ${res.status}`);
    }
    localWrite(info,data);
    renderResults(panel,data);
    btn.textContent='Οι live τιμές είναι έτοιμες';
    status.textContent=data?.cache?.hit?'Η αναζήτηση εξυπηρετήθηκε από την Horizon edge cache χωρίς νέα κλήση SerpApi.':'Η αναζήτηση ολοκληρώθηκε και αποθηκεύτηκε στην Horizon edge cache.';
  }catch(e){
    btn.textContent='Δοκίμασε ξανά';
    status.classList.add('error');
    status.textContent=e.name==='AbortError'?'Η αναζήτηση άργησε πολύ. Δοκίμασε ξανά.':`Δεν ολοκληρώθηκε η αναζήτηση: ${e.message}`;
  }finally{clearTimeout(timer);btn.disabled=false;}
}
function renderPanel(pane,name){
  removeLegacyStayLinks(pane);
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
    <h4>Live τιμές ξενοδοχείων</h4>
    <div class="hz-hotels-copy">Πραγματικές τιμές μέσα στο Horizon, με φίλτρα και ταξινόμηση. Οι ίδιες αναζητήσεις επαναχρησιμοποιούνται από cache ώστε να περιορίζονται οι κλήσεις στο δωρεάν API.</div>
    <div class="hz-hotels-grid">
      <div class="hz-hotel-chip"><small>Προορισμός</small><b>${esc(info.name)}</b></div>
      <div class="hz-hotel-chip"><small>Διανυκτερεύσεις</small><b>${info.nights}</b></div>
      <div class="hz-hotel-chip"><small>Check-in</small><b>${pretty(info.checkIn)}</b></div>
      <div class="hz-hotel-chip"><small>Check-out</small><b>${pretty(info.checkOut)}</b></div>
      <div class="hz-hotel-chip"><small>Ταξιδιώτες</small><b>${people} συνολικά</b></div>
      <div class="hz-hotel-chip"><small>Αποτελέσματα</small><b>έως 20 ανά live αναζήτηση</b></div>
    </div>
    <button type="button" class="hz-stay-load">Αναζήτηση live τιμών μέσα στο Horizon</button>
    <div class="hz-stay-status">Horizon browser cache 30′ + Cloudflare edge cache 6 ώρες για ίδια στοιχεία αναζήτησης.</div>
    <div class="hz-cache-badge"></div>
    <div class="hz-filters">
      <div class="hz-filter-grid">
        <div class="hz-filter-field"><label>Ταξινόμηση</label><select class="hz-sort"><option value="priceAsc">Χαμηλότερη τιμή</option><option value="priceDesc">Υψηλότερη τιμή</option><option value="rating">Καλύτερη βαθμολογία</option><option value="stars">Περισσότερα αστέρια</option><option value="reviews">Περισσότερες κριτικές</option></select></div>
        <div class="hz-filter-field"><label>Ελάχιστα αστέρια</label><select class="hz-stars"><option value="0">Όλα</option><option value="3">3★+</option><option value="4">4★+</option><option value="5">5★</option></select></div>
        <div class="hz-filter-field"><label>Ελάχιστη βαθμολογία</label><select class="hz-rating"><option value="0">Όλες</option><option value="4">4.0+</option><option value="4.3">4.3+</option><option value="4.5">4.5+</option><option value="4.7">4.7+</option></select></div>
        <div class="hz-filter-field"><div class="hz-price-line"><span>Μέγιστη τιμή / βράδυ</span><b class="hz-max-price-label">—</b></div><input class="hz-max-price" type="range" min="0" max="500" value="500" step="5"></div>
      </div>
      <div class="hz-amenity-title">Παροχές</div><div class="hz-amenity-chips"></div>
      <div class="hz-filter-actions"><button type="button" class="hz-reset">Καθαρισμός φίλτρων</button></div>
    </div>
    <div class="hz-stay-results"></div><div class="hz-stay-summary"></div>`;
  panel.querySelector('.hz-stay-load').addEventListener('click',()=>searchStays(panel,info));
}
function addPanel(overlay){
  const name=overlay.querySelector('.hd-head h3')?.textContent?.trim();if(!name)return;
  const pane=overlay.querySelector('[data-pane="stay"]');if(!pane)return;
  renderPanel(pane,name);
}
function refresh(){document.querySelectorAll('.horizon-detail-overlay').forEach(addPanel);}
function init(){installStyles();new MutationObserver(refresh).observe(document.body,{childList:true,subtree:true});refresh();}
window.HorizonHotels={refresh};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

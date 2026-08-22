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
    .hz-stay-results{display:grid;gap:10px;margin-top:14px}.hz-stay-card{display:grid;grid-template-columns:112px 1fr;gap:12px;padding:11px;border:1px solid rgba(255,255,255,.09);border-radius:15px;background:rgba(255,255,255,.035)}
    .hz-stay-img{width:112px;height:106px;object-fit:cover;border-radius:11px;background:#102538}.hz-stay-img.placeholder{display:grid;place-items:center;color:#7f95a4;font-size:.72rem;text-align:center;padding:8px}
    .hz-stay-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.hz-stay-name{font-weight:900;line-height:1.25}.hz-stay-type{color:#ff9d4d;font-size:.72rem;font-weight:800;margin-top:3px}.hz-stay-meta{color:#94a8b7;font-size:.76rem;margin-top:6px;line-height:1.45}
    .hz-stay-price{font-weight:900;white-space:nowrap}.hz-stay-night{color:#8fa3b2;font-size:.72rem;text-align:right;margin-top:2px}.hz-stay-amenities{margin-top:7px;color:#b6c4cd;font-size:.72rem;line-height:1.4}
    .hz-stay-source{display:inline-flex;margin-top:8px;padding:5px 8px;border-radius:999px;background:rgba(255,122,22,.09);border:1px solid rgba(255,122,22,.22);color:#ffb273;font-size:.68rem;font-weight:800}
    .hz-stay-empty{padding:16px;border:1px dashed rgba(255,255,255,.13);border-radius:14px;color:#9fb0bd;text-align:center}.hz-stay-summary{margin-top:10px;color:#9fb0bd;font-size:.76rem;line-height:1.45}
    @media(max-width:620px){.hz-hotels-grid{grid-template-columns:1fr}.hz-stay-load{width:100%}.hz-stay-card{grid-template-columns:82px 1fr}.hz-stay-img{width:82px;height:94px}.hz-stay-head{display:block}.hz-stay-price,.hz-stay-night{text-align:left;margin-top:5px}}
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
function resultCard(item){
  const image=safeUrl(item.image);
  const rating=item.rating?`★ ${Number(item.rating).toFixed(1)}${item.reviews?` (${Number(item.reviews).toLocaleString('el-GR')})`:''}`:'';
  const stars=item.hotelClass?`${item.hotelClass}★`:'';
  const amenities=Array.isArray(item.amenities)?item.amenities.slice(0,4).join(' · '):'';
  return `<article class="hz-stay-card">
    ${image?`<img class="hz-stay-img" src="${esc(image)}" loading="lazy" alt="">`:`<div class="hz-stay-img placeholder">Χωρίς φωτογραφία</div>`}
    <div>
      <div class="hz-stay-head">
        <div><div class="hz-stay-name">${esc(item.name)}</div><div class="hz-stay-type">${esc(stars||'Ξενοδοχείο')}</div></div>
        <div>${item.total?`<div class="hz-stay-price">${money(item.total,item.currency)}</div>`:''}${item.nightly?`<div class="hz-stay-night">${money(item.nightly,item.currency)}/βράδυ</div>`:''}</div>
      </div>
      <div class="hz-stay-meta">${[rating,item.priceSource].filter(Boolean).map(esc).join(' · ')}</div>
      ${amenities?`<div class="hz-stay-amenities">${esc(amenities)}</div>`:''}
      <span class="hz-stay-source">Live τιμή μέσα στο Horizon</span>
    </div>
  </article>`;
}
function renderResults(panel,data){
  const resultsEl=panel.querySelector('.hz-stay-results');
  const summary=panel.querySelector('.hz-stay-summary');
  const all=Array.isArray(data.results)?data.results:[];
  resultsEl.innerHTML=all.length?all.map(resultCard).join(''):'<div class="hz-stay-empty">Δεν βρέθηκαν διαθέσιμες τιμές για αυτές τις ημερομηνίες.</div>';
  summary.textContent=all.length?`Εμφανίζονται ${all.length} επιλογές ταξινομημένες από τη χαμηλότερη τιμή. Οι τιμές προέρχονται από Google Hotels μέσω SerpApi και εμφανίζονται απευθείας στο Horizon.`:'Δοκίμασε άλλες ημερομηνίες ή προορισμό.';
}
async function searchStays(panel,info){
  const btn=panel.querySelector('.hz-stay-load');
  const status=panel.querySelector('.hz-stay-status');
  btn.disabled=true;btn.textContent='Αναζήτηση live τιμών…';
  status.classList.remove('error');status.textContent='Ψάχνω πραγματικές τιμές ξενοδοχείων μέσα στο Horizon…';
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),22000);
  try{
    const res=await fetch(`${API_BASE}/stays`,{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({destination:info.name,checkInDate:info.checkIn,checkOutDate:info.checkOut,adults:info.adults,children:info.children,infants:info.infants,pageSize:12}),
      signal:controller.signal
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok||data.ok===false){
      if(data?.code==='SERPAPI_KEY_REQUIRED'){
        status.classList.add('error');
        status.textContent='Η λειτουργία είναι έτοιμη. Απομένει μόνο να προστεθεί το δωρεάν SerpApi API key στο Cloudflare Worker.';
        btn.textContent='Live τιμές — αναμονή API key';
        return;
      }
      if(data?.code==='FREE_QUOTA_REACHED')throw new Error('Εξαντλήθηκε το δωρεάν μηνιαίο όριο αναζητήσεων.');
      throw new Error(data.error||`HTTP ${res.status}`);
    }
    renderResults(panel,data);
    btn.textContent='Ανανέωση live τιμών';
    status.textContent='Η αναζήτηση ολοκληρώθηκε μέσα στο Horizon.';
  }catch(e){
    btn.textContent='Δοκίμασε ξανά';
    status.classList.add('error');
    status.textContent=e.name==='AbortError'?'Η αναζήτηση άργησε πολύ. Δοκίμασε ξανά.':`Δεν ολοκληρώθηκε η αναζήτηση: ${e.message}`;
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
    <h4>Live τιμές ξενοδοχείων</h4>
    <div class="hz-hotels-copy">Η αναζήτηση και οι τιμές εμφανίζονται απευθείας εδώ, μέσα στο Horizon — χωρίς να ανοίγει άλλη σελίδα.</div>
    <div class="hz-hotels-grid">
      <div class="hz-hotel-chip"><small>Προορισμός</small><b>${esc(info.name)}</b></div>
      <div class="hz-hotel-chip"><small>Διανυκτερεύσεις</small><b>${info.nights}</b></div>
      <div class="hz-hotel-chip"><small>Check-in</small><b>${pretty(info.checkIn)}</b></div>
      <div class="hz-hotel-chip"><small>Check-out</small><b>${pretty(info.checkOut)}</b></div>
      <div class="hz-hotel-chip"><small>Ταξιδιώτες</small><b>${people} συνολικά</b></div>
      <div class="hz-hotel-chip"><small>Δωρεάν όριο prototype</small><b>250 νέες αναζητήσεις / μήνα</b></div>
    </div>
    <button type="button" class="hz-stay-load">Αναζήτηση live τιμών μέσα στο Horizon</button>
    <div class="hz-stay-status">Google Hotels μέσω δωρεάν SerpApi tier. Ίδιες αναζητήσεις που σερβίρονται από την cache του παρόχου δεν χρεώνονται ξανά.</div>
    <div class="hz-stay-results"></div><div class="hz-stay-summary"></div>`;
  panel.querySelector('.hz-stay-load').addEventListener('click',()=>searchStays(panel,info));
}
function addPanel(overlay){const name=overlay.querySelector('.hd-head h3')?.textContent?.trim();if(!name)return;const pane=overlay.querySelector('[data-pane="stay"]');if(!pane)return;renderPanel(pane,name);}
function refresh(){document.querySelectorAll('.horizon-detail-overlay').forEach(addPanel);}
function init(){installStyles();new MutationObserver(refresh).observe(document.body,{childList:true,subtree:true});refresh();}
window.HorizonHotels={refresh};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

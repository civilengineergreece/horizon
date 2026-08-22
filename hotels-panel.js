(()=>{
'use strict';

const STYLE_ID='horizon-hotels-panel-style';

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
    .hz-hotels-actions{display:flex;gap:9px;flex-wrap:wrap}.hz-hotel-btn{display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.13);border-radius:11px;padding:11px 13px;background:#0b1d2b;color:#fff;font-weight:800;text-decoration:none}
    .hz-hotel-btn.primary{border-color:transparent;background:linear-gradient(180deg,#ff8b29,#df5e08)}
    .hz-hotels-status{margin-top:10px;color:#8fa3b2;font-size:.78rem;line-height:1.45}
    @media(max-width:620px){.hz-hotels-grid{grid-template-columns:1fr}.hz-hotels-actions{display:grid}.hz-hotel-btn{width:100%}}
  `;
  document.head.appendChild(s);
}

function travelState(){return typeof state!=='undefined'&&state?state:{};}
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function parseISO(iso){const m=String(iso||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?new Date(Number(m[1]),Number(m[2])-1,Number(m[3]),12,0,0,0):null;}
function isoLocal(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function addDaysISO(iso,n){const d=parseISO(iso);if(!d)return '';d.setDate(d.getDate()+n);return isoLocal(d);}
function pretty(iso){const d=parseISO(iso);return d?d.toLocaleDateString('el-GR',{day:'numeric',month:'short',year:'numeric'}):'—';}

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

function bookingUrl(info){
  const u=new URL('https://www.booking.com/searchresults.html');
  u.searchParams.set('ss',info.name);
  if(info.checkIn)u.searchParams.set('checkin',info.checkIn);
  if(info.checkOut)u.searchParams.set('checkout',info.checkOut);
  u.searchParams.set('group_adults',String(info.adults));
  u.searchParams.set('group_children',String(info.children+info.infants));
  u.searchParams.set('no_rooms','1');
  return u.toString();
}

function renderPanel(pane,name){
  pane.querySelectorAll('.hz-live-wrap').forEach(el=>el.remove());
  let panel=pane.querySelector('.hz-hotels-panel');
  const info=hotelInfo(name);
  const people=info.adults+info.children+info.infants;
  if(!panel){panel=document.createElement('section');panel.className='hz-hotels-panel';pane.appendChild(panel);}

  if(info.nights===0){
    panel.innerHTML=`<h4>Ξενοδοχεία & καταλύματα</h4><div class="hz-hotels-copy">Έχεις επιλέξει μονοήμερη εκδρομή, οπότε δεν απαιτείται διανυκτέρευση.</div>`;
    return;
  }

  panel.innerHTML=`
    <h4>Ξενοδοχεία & καταλύματα</h4>
    <div class="hz-hotels-copy">Ο Horizon έχει ήδη τα βασικά στοιχεία της αναζήτησης. Αυτή είναι η βάση για το live hotel search, χωρίς να τα ξαναγράφεις.</div>
    <div class="hz-hotels-grid">
      <div class="hz-hotel-chip"><small>Προορισμός</small><b>${esc(info.name)}</b></div>
      <div class="hz-hotel-chip"><small>Διανυκτερεύσεις</small><b>${info.nights}</b></div>
      <div class="hz-hotel-chip"><small>Check-in</small><b>${pretty(info.checkIn)}</b></div>
      <div class="hz-hotel-chip"><small>Check-out</small><b>${pretty(info.checkOut)}</b></div>
      <div class="hz-hotel-chip"><small>Ταξιδιώτες</small><b>${people} συνολικά</b></div>
      <div class="hz-hotel-chip"><small>Κατηγορίες</small><b>${info.adults} × 12+ · ${info.children} παιδιά · ${info.infants} βρέφη</b></div>
    </div>
    <div class="hz-hotels-actions">
      <a class="hz-hotel-btn primary" href="${bookingUrl(info)}" target="_blank" rel="noopener">Αναζήτηση τώρα στο Booking.com ↗</a>
    </div>
    <div class="hz-hotels-status">Προσωρινή ασφαλής λύση: ανοίγει πραγματικά αποτελέσματα Booking.com σε νέα καρτέλα. Το panel είναι ήδη έτοιμο για σύνδεση live αποτελεσμάτων μέσα στο Horizon όταν ενεργοποιήσουμε provider με κατάλληλη πρόσβαση.</div>`;
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

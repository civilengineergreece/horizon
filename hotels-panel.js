(()=>{
'use strict';

const STYLE_ID='horizon-hotels-panel-style';
const DEMO_AID='demo_affiliate_id';

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
    .hz-stay-load{border:0;border-radius:11px;padding:11px 14px;background:linear-gradient(180deg,#ff8b29,#df5e08);color:#fff;font-weight:800;cursor:pointer}
    .hz-stay-load:disabled{opacity:.62;cursor:wait}
    .hz-stay-status{margin-top:9px;color:#8fa3b2;font-size:.78rem;line-height:1.45}
    .hz-stay-frame-wrap{display:none;margin-top:14px;border:1px solid rgba(255,255,255,.10);border-radius:16px;overflow:hidden;background:#0b1d2b}
    .hz-stay-frame-wrap.active{display:block}
    .hz-stay-frame{display:block;width:100%;height:610px;border:0;background:#0b1d2b}
    .hz-stay-legend{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 0;color:#9fb0bd;font-size:.76rem}
    .hz-stay-pill{border:1px solid rgba(255,255,255,.10);border-radius:999px;padding:5px 8px;background:rgba(255,255,255,.03)}
    @media(max-width:620px){.hz-hotels-grid{grid-template-columns:1fr}.hz-stay-load{width:100%}.hz-stay-frame{height:690px}}
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

function stay22Url(info){
  const u=new URL('https://www.stay22.com/embed/gm');
  u.searchParams.set('aid',DEMO_AID);
  u.searchParams.set('address',info.name);
  if(info.checkIn)u.searchParams.set('checkin',info.checkIn);
  if(info.checkOut)u.searchParams.set('checkout',info.checkOut);
  u.searchParams.set('adults',String(info.adults));
  u.searchParams.set('children',String(info.children));
  u.searchParams.set('infants',String(info.infants));
  u.searchParams.set('rooms','1');
  u.searchParams.set('currency','EUR');
  u.searchParams.set('supportedcurrencies','EUR,USD');
  u.searchParams.set('unitsystem','metric');
  u.searchParams.set('priceper','total');
  u.searchParams.set('limit','30');
  u.searchParams.set('viewmode','all');
  u.searchParams.set('listviewexpand','true');
  u.searchParams.set('mapstyle','dark');
  u.searchParams.set('maincolor','ff7a16');
  u.searchParams.set('hotelscolor','ff7a16');
  u.searchParams.set('rentalscolor','65d39a');
  u.searchParams.set('hotelsapi','booking');
  u.searchParams.set('rentalsapi','vrbo');
  u.searchParams.set('showhotels','true');
  u.searchParams.set('campaign','horizon_stay_panel');
  return u.toString();
}

function renderPanel(pane,name){
  // Remove the old Amadeus hotel lookup if it appears.
  pane.querySelectorAll('.hz-live-wrap').forEach(el=>el.remove());
  let panel=pane.querySelector('.hz-hotels-panel');
  const info=hotelInfo(name);
  const people=info.adults+info.children+info.infants;
  if(!panel){panel=document.createElement('section');panel.className='hz-hotels-panel';pane.appendChild(panel);}

  if(info.nights===0){
    panel.innerHTML=`<h4>Ξενοδοχεία & καταλύματα</h4><div class="hz-hotels-copy">Έχεις επιλέξει μονοήμερη εκδρομή, οπότε δεν απαιτείται διανυκτέρευση.</div>`;
    return;
  }

  const signature=[info.name,info.checkIn,info.checkOut,info.adults,info.children,info.infants].join('|');
  if(panel.dataset.signature===signature)return;
  panel.dataset.signature=signature;

  panel.innerHTML=`
    <h4>Ξενοδοχεία & σπίτια διακοπών</h4>
    <div class="hz-hotels-copy">Πραγματική αναζήτηση μέσα στο Horizon για ξενοδοχεία και ενοικιαζόμενα σπίτια/διαμερίσματα. Η τελική κράτηση γίνεται στον πάροχο.</div>
    <div class="hz-hotels-grid">
      <div class="hz-hotel-chip"><small>Προορισμός</small><b>${esc(info.name)}</b></div>
      <div class="hz-hotel-chip"><small>Διανυκτερεύσεις</small><b>${info.nights}</b></div>
      <div class="hz-hotel-chip"><small>Check-in</small><b>${pretty(info.checkIn)}</b></div>
      <div class="hz-hotel-chip"><small>Check-out</small><b>${pretty(info.checkOut)}</b></div>
      <div class="hz-hotel-chip"><small>Ταξιδιώτες</small><b>${people} συνολικά</b></div>
      <div class="hz-hotel-chip"><small>Κατηγορίες</small><b>${info.adults} × 12+ · ${info.children} παιδιά · ${info.infants} βρέφη</b></div>
    </div>
    <button type="button" class="hz-stay-load">Φόρτωση πραγματικών καταλυμάτων</button>
    <div class="hz-stay-status">Prototype χωρίς χρέωση/API key. Πηγές δοκιμής: Booking.com για ξενοδοχεία και Vrbo για σπίτια/διαμερίσματα.</div>
    <div class="hz-stay-legend"><span class="hz-stay-pill">Ξενοδοχεία</span><span class="hz-stay-pill">Διαμερίσματα / σπίτια</span><span class="hz-stay-pill">Χάρτης + λίστα</span></div>
    <div class="hz-stay-frame-wrap"><iframe class="hz-stay-frame" title="Αναζήτηση ξενοδοχείων και καταλυμάτων" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;

  const btn=panel.querySelector('.hz-stay-load');
  const wrap=panel.querySelector('.hz-stay-frame-wrap');
  const frame=panel.querySelector('.hz-stay-frame');
  const status=panel.querySelector('.hz-stay-status');
  btn.addEventListener('click',()=>{
    if(!frame.src){
      btn.disabled=true;btn.textContent='Φόρτωση καταλυμάτων…';
      status.textContent='Φορτώνω live ξενοδοχεία και rentals μέσα στο Horizon…';
      frame.src=stay22Url(info);
      frame.addEventListener('load',()=>{
        btn.disabled=false;btn.textContent='Καταλύματα φορτώθηκαν';
        status.textContent='Μπορείς να ψάξεις, να φιλτράρεις και να συγκρίνεις μέσα στη σελίδα. Η τελική κράτηση ανοίγει τον πάροχο.';
      },{once:true});
    }
    wrap.classList.add('active');
  });
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

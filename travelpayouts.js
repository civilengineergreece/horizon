(()=>{
'use strict';

const WL_ID='21163';
const STYLE_ID='horizon-travelpayouts-style';
const SOFT_BG='#EAF0F3';
const SOFT_BG_2='#F2F5F6';
const SOFT_BORDER='#C8D4DA';
let root=null;
let loaded=false;
let refreshTimer=null;
let contextKey='';

function travelState(){return typeof state!=='undefined'&&state?state:{};}
function scoredByName(name){return (typeof scored!=='undefined'&&Array.isArray(scored)?scored:[]).find(d=>d.name===name)||{};}
function parseISO(iso){const m=String(iso||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?new Date(Number(m[1]),Number(m[2])-1,Number(m[3]),12):null;}
function addDaysISO(iso,n){const d=parseISO(iso);if(!d)return '';d.setDate(d.getDate()+n);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function prettyDate(iso){const d=parseISO(iso);return d?d.toLocaleDateString('el-GR',{day:'numeric',month:'short',year:'numeric'}):'';}
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}

function cleanLegacyFlightSearch(){
  try{
    const url=new URL(location.href);
    if(!url.searchParams.has('flightSearch'))return;
    url.searchParams.delete('flightSearch');
    history.replaceState(history.state,'',url.pathname+(url.search||'')+(url.hash||''));
  }catch(e){}
}

function ensureStyles(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
    #horizon-travelpayouts{overflow:visible}
    #horizon-travelpayouts .hz-flight-context{margin:0 0 12px;padding:11px 13px;border:1px solid rgba(255,255,255,.10);border-radius:12px;background:rgba(255,255,255,.035);color:#cbd6de;font-size:.79rem;line-height:1.5}
    #horizon-travelpayouts .hz-flight-context b{color:#fff}
    #horizon-travelpayouts .hz-flight-class-help{margin:0 0 14px;padding:10px 12px;border:1px solid rgba(255,122,22,.24);border-radius:12px;background:rgba(255,122,22,.07);color:#cbd6de;font-size:.78rem;line-height:1.5}
    #horizon-travelpayouts .hz-flight-class-help b{color:#fff}
    #horizon-travelpayouts #tpwl-search input,
    #horizon-travelpayouts #tpwl-search textarea,
    #horizon-travelpayouts #tpwl-search select{background:${SOFT_BG}!important;color:#102538!important;-webkit-text-fill-color:#102538!important;border-color:${SOFT_BORDER}!important}
    #horizon-travelpayouts #tpwl-search input::placeholder,
    #horizon-travelpayouts #tpwl-search textarea::placeholder{color:#617481!important;-webkit-text-fill-color:#617481!important;opacity:1!important}
    #horizon-travelpayouts #tpwl-search [role="combobox"],
    #horizon-travelpayouts #tpwl-search [aria-haspopup="listbox"]{background:${SOFT_BG}!important;color:#102538!important;border-color:${SOFT_BORDER}!important}
    #horizon-travelpayouts #tpwl-search [role="listbox"],
    #horizon-travelpayouts #tpwl-search [role="dialog"]{color:#102538!important;background:${SOFT_BG_2}!important}
    #horizon-travelpayouts #tpwl-search [role="option"]{color:#102538!important;background:${SOFT_BG_2}!important}
    #horizon-travelpayouts #tpwl-search [role="option"] *{color:#102538!important;-webkit-text-fill-color:#102538!important}
  `;
  document.head.appendChild(style);
}

function isPlaneOverlay(overlay,name){
  const d=scoredByName(name);
  const mode=d.transportMode||travelState().transport;
  if(mode==='plane')return true;
  const txt=(overlay?.textContent||'').toLowerCase();
  return txt.includes('αεροπλάνο')||txt.includes('αεροπορικά');
}

function plannerContext(name){
  const s=travelState();
  const departure=s.dates?.from||'';
  const days=Math.max(1,Math.floor(Number(s.duration)||1));
  const returnDate=addDaysISO(departure,days-1);
  const adults=Math.max(1,Math.floor(Number(s.travelers?.adults)||1));
  const children=Math.max(0,Math.floor(Number(s.travelers?.children)||0));
  const infants=Math.max(0,Math.floor(Number(s.travelers?.infants)||0));
  return {origin:String(s.origin||'').trim(),destination:name,departure,returnDate,adults,children,infants};
}

function contextHTML(info){
  const route=info.origin?`${esc(info.origin)} → ${esc(info.destination)}`:esc(info.destination);
  const dates=info.departure?`${prettyDate(info.departure)} → ${prettyDate(info.returnDate)}`:'ημερομηνίες από τον planner';
  const pax=[];
  pax.push(`${info.adults} ταξιδιώτ${info.adults===1?'ης':'ες'} 12+`);
  if(info.children)pax.push(`${info.children} παιδ${info.children===1?'ί':'ιά'}`);
  if(info.infants)pax.push(`${info.infants} βρέφ${info.infants===1?'ος':'η'}`);
  return `<b>Στοιχεία Horizon:</b> ${route} · ${dates} · ${pax.join(', ')}.<br><span style="color:#93a6b5">Τα στοιχεία εμφανίζονται εδώ για έλεγχο. Η φόρμα πτήσεων παραμένει ανεξάρτητη ώστε να μην κολλάει η σελίδα.</span>`;
}

function createRoot(pane){
  if(root)return root;
  ensureStyles();
  root=document.createElement('section');
  root.id='horizon-travelpayouts';
  root.className='hd-section';
  root.style.marginTop='22px';
  root.innerHTML=`
    <h4 style="margin:0 0 6px">Πτήσεις</h4>
    <div class="hd-note" style="margin-bottom:10px">Αναζήτησε πραγματικές διαθέσιμες πτήσεις και low-cost επιλογές μέσα στο Horizon. Η τελική αγορά ολοκληρώνεται στον πάροχο του εισιτηρίου.</div>
    <div class="hz-flight-context"></div>
    <div class="hz-flight-class-help"><b>Θέση ταξιδιού:</b> «Οικονομία» = Οικονομική θέση (Economy). Ανάλογα με τη διαδρομή μπορείς επίσης να επιλέξεις Business, Comfort/Premium Economy ή First Class.</div>
    <div id="tpwl-search"></div>
    <div id="tpwl-tickets"></div>`;
  pane.appendChild(root);
  return root;
}

function renderContext(name){
  if(!root)return;
  const info=plannerContext(name);
  const key=JSON.stringify(info);
  if(key===contextKey)return;
  contextKey=key;
  const box=root.querySelector('.hz-flight-context');
  if(box)box.innerHTML=contextHTML(info);
}

function loadWhiteLabel(){
  if(loaded||document.querySelector('script[data-horizon-tpwl]')){loaded=true;return;}
  loaded=true;
  const s=document.createElement('script');
  s.async=true;
  s.type='module';
  s.src=`https://tpscr.com/wl_web/main.js?wl_id=${WL_ID}`;
  s.dataset.horizonTpwl='1';
  s.onerror=()=>{
    const note=root?.querySelector('.hd-note');
    if(note&&!root.querySelector('.hz-flight-load-error'))note.insertAdjacentHTML('afterend','<div class="hd-note hz-flight-load-error" style="color:#ffb1a3">Η υπηρεσία πτήσεων δεν φόρτωσε. Δοκίμασε ανανέωση της σελίδας.</div>');
  };
  document.head.appendChild(s);
}

function mount(overlay){
  if(!overlay)return false;
  const name=overlay.querySelector('.hd-head h3')?.textContent?.trim();
  if(!name||!isPlaneOverlay(overlay,name))return false;
  const pane=overlay.querySelector('[data-pane="transport"]');
  if(!pane)return false;

  pane.querySelectorAll('.hz-live-wrap').forEach(el=>el.remove());
  const r=createRoot(pane);
  if(r.parentElement!==pane)pane.appendChild(r);
  if(r.style.display!=='block')r.style.display='block';
  renderContext(name);
  loadWhiteLabel();
  return true;
}

function refresh(){
  const overlays=[...document.querySelectorAll('.horizon-detail-overlay')];
  const mounted=overlays.some(mount);
  if(!mounted&&root&&root.style.display!=='none')root.style.display='none';
}

function scheduleRefresh(){
  clearTimeout(refreshTimer);
  refreshTimer=setTimeout(refresh,120);
}

function init(){
  cleanLegacyFlightSearch();
  ensureStyles();
  const obs=new MutationObserver(scheduleRefresh);
  obs.observe(document.body,{childList:true,subtree:true});
  refresh();
  let tries=0;
  const timer=setInterval(()=>{refresh();if(++tries>=12)clearInterval(timer);},500);
}

window.HorizonTravelpayouts={wlId:WL_ID,refresh};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

(()=>{
'use strict';

const WL_ID='21163';
let root=null;
let loaded=false;

function travelState(){return typeof state!=='undefined'&&state?state:{};}
function scoredByName(name){return (typeof scored!=='undefined'&&Array.isArray(scored)?scored:[]).find(d=>d.name===name)||{};}

function isPlaneOverlay(overlay,name){
  const d=scoredByName(name);
  const mode=d.transportMode||travelState().transport;
  if(mode==='plane')return true;
  const txt=(overlay?.textContent||'').toLowerCase();
  return txt.includes('αεροπλάνο')||txt.includes('αεροπορικά');
}

function createRoot(pane){
  if(root)return root;
  root=document.createElement('section');
  root.id='horizon-travelpayouts';
  root.className='hd-section';
  root.style.marginTop='22px';
  root.innerHTML=`
    <h4 style="margin:0 0 6px">Πτήσεις</h4>
    <div class="hd-note" style="margin-bottom:14px">Αναζήτησε πραγματικές διαθέσιμες πτήσεις και low-cost επιλογές μέσα στο Horizon. Η τελική αγορά ολοκληρώνεται στον πάροχο του εισιτηρίου.</div>
    <div id="tpwl-search"></div>
    <div id="tpwl-tickets"></div>`;
  pane.appendChild(root);
  return root;
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
    if(note)note.insertAdjacentHTML('afterend','<div class="hd-note" style="color:#ffb1a3">Η υπηρεσία πτήσεων δεν φόρτωσε. Δοκίμασε ανανέωση της σελίδας.</div>');
  };
  document.head.appendChild(s);
}

function mount(overlay){
  if(!overlay)return false;
  const name=overlay.querySelector('.hd-head h3')?.textContent?.trim();
  if(!name||!isPlaneOverlay(overlay,name))return false;
  const pane=overlay.querySelector('[data-pane="transport"]');
  if(!pane)return false;

  // Remove any obsolete flight-live box left by an older cached script.
  pane.querySelectorAll('.hz-live-wrap').forEach(el=>el.remove());

  const r=createRoot(pane);
  if(r.parentElement!==pane)pane.appendChild(r);
  r.style.display='block';
  loadWhiteLabel();
  return true;
}

function refresh(){
  const overlays=[...document.querySelectorAll('.horizon-detail-overlay')];
  const mounted=overlays.some(mount);
  if(!mounted&&root)root.style.display='none';
}

function init(){
  const obs=new MutationObserver(refresh);
  obs.observe(document.body,{childList:true,subtree:true});
  refresh();
  // Covers timing differences between the modal renderer and third-party script loading.
  let tries=0;
  const timer=setInterval(()=>{refresh();if(++tries>=20)clearInterval(timer);},500);
}

window.HorizonTravelpayouts={wlId:WL_ID,refresh};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

(()=>{
'use strict';

const WL_ID='21163';
let root=null;

function travelState(){return typeof state!=='undefined'&&state?state:{};}
function scoredByName(name){return (typeof scored!=='undefined'&&Array.isArray(scored)?scored:[]).find(d=>d.name===name)||{};}

function park(){
  if(!root)return;
  if(!document.body.contains(root))document.body.appendChild(root);
  root.style.position='absolute';
  root.style.left='-10000px';
  root.style.top='0';
  root.style.width='1100px';
  root.style.visibility='hidden';
  root.style.pointerEvents='none';
}

function ensureRoot(){
  if(root)return root;
  root=document.createElement('section');
  root.id='horizon-travelpayouts';
  root.className='hd-section';
  root.innerHTML=`
    <h4 style="margin-bottom:6px">Πραγματικές πτήσεις</h4>
    <div class="hd-note" style="margin-bottom:14px">Σύγκρινε διαθέσιμες πτήσεις και low-cost επιλογές χωρίς να φύγεις από το Horizon. Η τελική κράτηση ολοκληρώνεται στον πάροχο του εισιτηρίου.</div>
    <div id="tpwl-search"></div>
    <div id="tpwl-tickets"></div>`;
  document.body.appendChild(root);
  park();
  return root;
}

function loadWhiteLabel(){
  if(document.querySelector('script[data-horizon-tpwl]'))return;
  const s=document.createElement('script');
  s.async=true;
  s.type='module';
  s.src=`https://tpscr.com/wl_web/main.js?wl_id=${WL_ID}`;
  s.dataset.horizonTpwl='1';
  document.head.appendChild(s);
}

function mount(overlay){
  if(!overlay)return false;
  const name=overlay.querySelector('.hd-head h3')?.textContent?.trim();
  if(!name)return false;
  const d=scoredByName(name),mode=d.transportMode||travelState().transport;
  if(mode!=='plane')return false;
  const pane=overlay.querySelector('[data-pane="transport"]');
  if(!pane)return false;

  // Remove the old Amadeus live-flight control while the free metasearch widget is used.
  pane.querySelectorAll('.hz-live-wrap').forEach(el=>el.remove());

  const r=ensureRoot();
  if(r.parentElement!==pane)pane.appendChild(r);
  r.style.position='static';
  r.style.left='auto';
  r.style.top='auto';
  r.style.width='100%';
  r.style.visibility='visible';
  r.style.pointerEvents='auto';
  return true;
}

function refresh(){
  const overlays=[...document.querySelectorAll('.horizon-detail-overlay')];
  const mounted=overlays.some(mount);
  if(!mounted&&root)park();
}

function init(){
  ensureRoot();
  loadWhiteLabel();
  const obs=new MutationObserver(refresh);
  obs.observe(document.body,{childList:true,subtree:true});
  refresh();
}

window.HorizonTravelpayouts={wlId:WL_ID,refresh};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

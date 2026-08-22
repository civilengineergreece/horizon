(()=>{
'use strict';

const WL_ID='21163';
const STYLE_ID='horizon-tpwl-lazy-style';
let widgetRoot=null;
let providerState='idle';

function installStyles(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement('style');
  s.id=STYLE_ID;
  s.textContent=`
    .hz-flight-gate{margin-top:22px;padding:16px;border:1px solid rgba(255,122,22,.24);border-radius:16px;background:rgba(255,255,255,.025)}
    .hz-flight-gate h4{margin:0 0 6px;font-size:1rem}.hz-flight-gate .hz-flight-copy{color:#a7b6c1;font-size:.84rem;line-height:1.5;margin-bottom:12px}
    .hz-flight-load{border:0;border-radius:11px;padding:11px 14px;background:linear-gradient(180deg,#ff8b29,#df5e08);color:#fff;font-weight:800;cursor:pointer}
    .hz-flight-load:disabled{opacity:.62;cursor:wait}.hz-flight-status{margin-top:10px;color:#9fb0bd;font-size:.8rem}
    #horizon-travelpayouts-safe{position:relative;z-index:4;margin-top:14px;padding:12px;border-radius:16px;background:#DDE7EC;border:1px solid #BFCED6;color:#102538;overflow:visible!important;isolation:isolate}
    #horizon-travelpayouts-safe .hz-tpwl-head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin:0 0 10px;padding:0 2px;color:#102538}
    #horizon-travelpayouts-safe .hz-tpwl-head b{font-size:.9rem}.hz-tpwl-note{font-size:.72rem;color:#516779}
    #horizon-travelpayouts-safe #tpwl-search{position:relative;z-index:5;overflow:visible!important}
    #horizon-travelpayouts-safe #tpwl-search input,#horizon-travelpayouts-safe #tpwl-search textarea,#horizon-travelpayouts-safe #tpwl-search select{color:#102538!important;-webkit-text-fill-color:#102538!important;background:#EEF3F5!important;pointer-events:auto!important}
    #horizon-travelpayouts-safe #tpwl-search button,#horizon-travelpayouts-safe #tpwl-search [role="button"]{pointer-events:auto!important;touch-action:manipulation}
    #horizon-travelpayouts-safe #tpwl-search input::placeholder,#horizon-travelpayouts-safe #tpwl-search textarea::placeholder{color:#647887!important;-webkit-text-fill-color:#647887!important;opacity:1!important}
    #horizon-travelpayouts-safe #tpwl-search [role="listbox"],#horizon-travelpayouts-safe #tpwl-search [role="option"],#horizon-travelpayouts-safe #tpwl-search [role="dialog"]{color:#102538!important;background:#EEF3F5!important;pointer-events:auto!important;z-index:99999!important}
    #horizon-travelpayouts-safe #tpwl-search [role="dialog"] *{pointer-events:auto!important}
    #horizon-travelpayouts-safe #tpwl-search [role="option"] *{color:#102538!important;-webkit-text-fill-color:#102538!important}
    .horizon-detail-panel:has(#horizon-travelpayouts-safe [role="dialog"]){overflow:visible!important}
    @media(max-width:620px){#horizon-travelpayouts-safe{padding:8px}}
  `;
  document.head.appendChild(s);
}

function currentState(){return typeof state!=='undefined'&&state?state:{};}
function scoredDestination(name){return (typeof scored!=='undefined'&&Array.isArray(scored)?scored:[]).find(d=>d.name===name)||{};}
function isPlane(overlay,name){
  const d=scoredDestination(name),mode=d.transportMode||currentState().transport;
  if(mode==='plane')return true;
  const txt=(overlay?.textContent||'').toLowerCase();
  return txt.includes('αεροπλάνο')||txt.includes('αεροπορικά');
}
function getPane(overlay){return overlay?.querySelector('[data-pane="transport"]')||null;}
function buildWidgetRoot(){
  if(widgetRoot)return widgetRoot;
  widgetRoot=document.createElement('div');
  widgetRoot.id='horizon-travelpayouts-safe';
  widgetRoot.innerHTML=`<div class="hz-tpwl-head"><b>Αναζήτηση πτήσεων</b><span class="hz-tpwl-note">Τα αποτελέσματα εμφανίζονται μέσα στο Horizon</span></div><div id="tpwl-search"></div><div id="tpwl-tickets"></div>`;
  return widgetRoot;
}
function releasePanelOverflow(root){
  const panel=root?.closest('.horizon-detail-panel');
  if(!panel)return;
  const search=root.querySelector('#tpwl-search');
  search?.addEventListener('pointerdown',()=>{panel.dataset.prevOverflow=panel.style.overflow||'';panel.style.overflow='visible';},{capture:true});
  document.addEventListener('pointerdown',e=>{
    if(!root.isConnected)return;
    const dialog=root.querySelector('[role="dialog"]');
    if(dialog&&dialog.contains(e.target))return;
    if(!root.contains(e.target)){panel.style.overflow=panel.dataset.prevOverflow||'';}
  },{capture:true});
}
function loadProvider(gate,pane){
  if(providerState==='ready'){
    const root=buildWidgetRoot();
    if(root.parentElement!==pane)pane.appendChild(root);
    gate.querySelector('.hz-flight-status').textContent='Η αναζήτηση πτήσεων είναι έτοιμη.';
    return;
  }
  if(providerState==='loading')return;
  providerState='loading';
  const btn=gate.querySelector('.hz-flight-load');
  const status=gate.querySelector('.hz-flight-status');
  btn.disabled=true;btn.textContent='Φόρτωση πτήσεων…';
  status.textContent='Συνδέομαι με την υπηρεσία πτήσεων…';

  const root=buildWidgetRoot();
  if(root.parentElement!==pane)pane.appendChild(root);
  releasePanelOverflow(root);

  // Official Travelpayouts White Label widget host (current WL Web implementation).
  const old=document.querySelector('script[data-horizon-tpwl-provider]');
  old?.remove();
  const script=document.createElement('script');
  script.async=true;
  script.type='module';
  script.src=`https://tpwgts.com/wl_web/main.js?wl_id=${WL_ID}`;
  script.dataset.horizonTpwlProvider='1';
  script.onload=()=>{
    providerState='ready';
    btn.disabled=false;btn.textContent='Πτήσεις φορτώθηκαν';
    status.textContent='Το ημερολόγιο πτήσεων είναι ενεργό. Επίλεξε αναχώρηση και επιστροφή και πάτησε αναζήτηση.';
  };
  script.onerror=()=>{
    providerState='error';
    btn.disabled=false;btn.textContent='Δοκίμασε ξανά';
    status.textContent='Η υπηρεσία πτήσεων δεν φόρτωσε. Το Horizon παραμένει κανονικά διαθέσιμο.';
    script.remove();
  };
  document.head.appendChild(script);

  setTimeout(()=>{
    if(providerState==='loading'){
      providerState='error';
      btn.disabled=false;btn.textContent='Δοκίμασε ξανά';
      status.textContent='Η υπηρεσία πτήσεων αργεί να απαντήσει. Μπορείς να συνεχίσεις κανονικά στο Horizon.';
    }
  },15000);
}
function addGate(overlay){
  const name=overlay.querySelector('.hd-head h3')?.textContent?.trim();
  if(!name||!isPlane(overlay,name))return false;
  const pane=getPane(overlay);if(!pane)return false;

  let gate=pane.querySelector('.hz-flight-gate');
  if(!gate){
    gate=document.createElement('section');
    gate.className='hz-flight-gate';
    gate.innerHTML=`<h4>Πραγματικές πτήσεις</h4><div class="hz-flight-copy">Η υπηρεσία πτήσεων φορτώνει μόνο όταν τη ζητήσεις, ώστε το Horizon να παραμένει γρήγορο και σταθερό.</div><button type="button" class="hz-flight-load">Φόρτωση πραγματικών πτήσεων</button><div class="hz-flight-status"></div>`;
    pane.appendChild(gate);
    gate.querySelector('.hz-flight-load').addEventListener('click',()=>loadProvider(gate,pane));
  }
  if(providerState==='ready'&&widgetRoot&&widgetRoot.parentElement!==pane)pane.appendChild(widgetRoot);
  return true;
}
function refresh(){document.querySelectorAll('.horizon-detail-overlay').forEach(addGate);}
function init(){
  installStyles();
  // Keep legacy deep-link parameters out of Horizon itself; the embedded widget owns its search state.
  try{const u=new URL(location.href);if(u.searchParams.has('flightSearch')){u.searchParams.delete('flightSearch');history.replaceState(history.state,'',u.pathname+(u.search||'')+(u.hash||''));}}catch(e){}
  new MutationObserver(refresh).observe(document.body,{childList:true,subtree:true});
  refresh();
}
window.HorizonFlightsLazy={refresh,get state(){return providerState;}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

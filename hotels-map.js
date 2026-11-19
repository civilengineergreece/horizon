(()=>{
'use strict';
const CDN='https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/';
const contexts=new WeakMap();let leafletPromise=null;
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function euro(n){return new Intl.NumberFormat('el-GR',{style:'currency',currency:'EUR',minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(n));}
function pinLabel(h){
  if(Number(h.total)>0)return '€'+Math.round(Number(h.total)).toLocaleString('el-GR');
  if(Number(h.totalEstimate)>0)return '~€'+Math.round(Number(h.totalEstimate)).toLocaleString('el-GR');
  return '—';
}
function geo(h){
  return typeof h?.latitude==='number'&&typeof h?.longitude==='number'&&
    Number.isFinite(h.latitude)&&Number.isFinite(h.longitude)&&
    Math.abs(h.latitude)<=90&&Math.abs(h.longitude)<=180?[h.latitude,h.longitude]:null;
}
function ensureLeaflet(){
  if(window.L?.map)return Promise.resolve(window.L);
  if(leafletPromise)return leafletPromise;
  leafletPromise=new Promise((resolve,reject)=>{
    if(!document.querySelector('link[data-hz-leaflet]')){
      const css=document.createElement('link');css.rel='stylesheet';css.href=CDN+'leaflet.css';
      css.integrity='sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
      css.crossOrigin='anonymous';css.dataset.hzLeaflet='1';document.head.appendChild(css);
    }
    const script=document.createElement('script');script.src=CDN+'leaflet.js';
    script.async=true;script.integrity='sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
    script.crossOrigin='anonymous';
    script.onload=()=>window.L?.map?resolve(window.L):reject(new Error('Δεν φορτώθηκε η βιβλιοθήκη χάρτη'));
    script.onerror=()=>reject(new Error('Δεν ήταν διαθέσιμος ο εξωτερικός χάρτης'));
    document.head.appendChild(script);
  }).catch(e=>{leafletPromise=null;throw e;});
  return leafletPromise;
}
function installStyle(){
  if(document.getElementById('horizon-hotel-map-style'))return;
  const s=document.createElement('style');s.id='horizon-hotel-map-style';
  s.textContent=[
    '.hz-hotel-map-shell{margin:16px 0;padding:12px;border:1px solid rgba(255,122,22,.27);border-radius:15px;background:#0e2130;isolation:isolate;color:#d7e2eb}',
    '.hz-hotel-map-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:space-between}',
    '.hz-hotel-map-head h5{font-size:.98rem;margin:0}',
    '.hz-hotel-map-toggle{background:#24435b;color:white;border:1px solid #6889a2;border-radius:9px;padding:8px 12px;font-weight:800;cursor:pointer}',
    '.hz-hotel-map-copy{margin:8px 0 12px;font-size:.75rem;line-height:1.5;color:#b1c7d8}',
    '.hz-hotel-map{width:100%;height:425px;border-radius:12px;background:#1f3543;position:relative;z-index:0}',
    '.hz-hotel-map[hidden]{display:none}.hz-hotel-map-error{font-size:.77rem;color:#ffd5ad;margin:8px 0}',
    '.hz-hotel-map-legend{font-size:.72rem;line-height:1.6;margin-top:8px;color:#bcd0dc}',
    '.hz-price-marker{background:transparent!important;border:0!important;white-space:nowrap}',
    '.hz-price-marker span{display:inline-flex;align-items:center;justify-content:center;min-width:48px;background:white;border:2px solid #db640f;border-radius:100px;padding:4px 7px;box-shadow:0 2px 7px rgba(0,0,0,.34);color:#142536;font-size:12px;font-weight:900;line-height:1.1}',
    '.hz-price-marker.estimated span{border-style:dashed;border-color:#718aa1;color:#34485a}',
    '.hz-hotel-map-shell .leaflet-popup-content{font-size:.82rem;line-height:1.5}',
    '.hz-hotel-map-shell .leaflet-popup-content b{font-size:.88rem}',
    '.hz-map-focus{margin-top:7px;padding:7px 11px;border:0;border-radius:7px;cursor:pointer;background:#dc691c;color:white;font-weight:800}',
    '.hz-hotel-map-shell .leaflet-control-attribution{font-size:10px}',
    '.hz-stay-card.hz-map-focused{outline:2px solid #ff8b29;outline-offset:1px}',
    '@media(max-width:620px){.hz-hotel-map{height:340px}.hz-hotel-map-shell{padding:9px}}'
  ].join('');
  document.head.appendChild(s);
}
function boundsFit(ctx){
  if(!ctx.map||!ctx.bounds?.length)return;
  if(ctx.bounds.length===1)ctx.map.setView(ctx.bounds[0],14);
  else ctx.map.fitBounds(window.L.latLngBounds(ctx.bounds),{padding:[30,30],maxZoom:15});
}
function getContext(panel){
  const old=contexts.get(panel);
  if(old?.shell?.isConnected)return old;
  if(old?.map){try{old.map.remove();}catch{}}
  const list=panel.querySelector('.hz-stay-results');if(!list)return null;
  const shell=document.createElement('section');shell.className='hz-hotel-map-shell';
  shell.innerHTML='<div class="hz-hotel-map-head"><h5>Χάρτης καταλυμάτων · συνολικές τιμές</h5>'+
    '<button type="button" class="hz-hotel-map-toggle" aria-expanded="true">Απόκρυψη χάρτη</button></div>'+
    '<div class="hz-hotel-map-copy" aria-live="polite"></div>'+
    '<div class="hz-hotel-map" aria-label="Διαδραστικός χάρτης καταλυμάτων"></div>'+
    '<div class="hz-hotel-map-error" role="status" aria-live="polite"></div>'+
    '<div class="hz-hotel-map-legend">Πορτοκαλί περίγραμμα: συνολική τιμή πηγής. Διακεκομμένο περίγραμμα (~): εκτίμηση από διανυκτέρευση. Οι τιμές αφορούν όλη τη διαμονή και όχι ένα άτομο. Φόροι μπορεί να διαφέρουν.</div>';
  list.before(shell);
  const ctx={shell,map:null,layer:null,bounds:[],version:0};contexts.set(panel,ctx);
  const toggle=shell.querySelector('.hz-hotel-map-toggle'),mapEl=shell.querySelector('.hz-hotel-map');
  toggle.addEventListener('click',()=>{
    mapEl.hidden=!mapEl.hidden;
    toggle.textContent=mapEl.hidden?'Εμφάνιση χάρτη':'Απόκρυψη χάρτη';
    toggle.setAttribute('aria-expanded',String(!mapEl.hidden));
    if(!mapEl.hidden){if(ctx.map)requestAnimationFrame(()=>{ctx.map.invalidateSize();boundsFit(ctx);});else update(panel);}
  });
  shell.addEventListener('click',event=>{
    const btn=event.target.closest?.('[data-hotel-map-focus]');if(!btn)return;
    const index=Number(btn.dataset.hotelMapFocus);
    const item=panel._hotelData?.results?.[index],filtered=panel._hotelFiltered||[];
    const offset=filtered.indexOf(item);if(offset<0)return;
    panel._hotelLimit=Math.max(panel._hotelLimit||10,offset+1);
    window.HorizonHotels?.applyFilters?.(panel);
    requestAnimationFrame(()=>{
      const node=panel.querySelector('.hz-stay-card[data-hotel-card-index="'+index+'"]');if(!node)return;
      panel.querySelectorAll('.hz-map-focused').forEach(x=>x.classList.remove('hz-map-focused'));
      node.classList.add('hz-map-focused');node.scrollIntoView({behavior:'smooth',block:'center'});
    });
  });
  return ctx;
}
function popup(h,i,nights){
  const rating=Number(h.rating)>0?Number(h.rating).toFixed(1)+'/5':'—';
  const stars=Number(h.hotelClass)>0?Math.round(Number(h.hotelClass))+'★':'Άγνωστα';
  const value=Number(h.total)>0?euro(h.total):Number(h.totalEstimate)>0?'~'+euro(h.totalEstimate):'Δεν υπάρχει τιμή';
  const tax=h.taxStatus==='provider_reports_after_taxes_fees'?'Η πηγή αναφέρει φόρους/τέλη.':'Η συμπερίληψη φόρων/τελών δεν έχει επιβεβαιωθεί.';
  return '<b>'+esc(h.name)+'</b><div>Βαθμολογία: '+esc(rating)+' · Αστέρια: '+esc(stars)+'</div>'+
    '<div>Σύνολο '+nights+' βραδιών: <strong>'+esc(value)+'</strong></div>'+
    '<div>'+esc(tax)+'</div>'+
    '<button type="button" class="hz-map-focus" data-hotel-map-focus="'+i+'">Δες στη λίστα</button>';
}
function renderMarkers(panel,ctx){
  const L=window.L;
  if(ctx.layer)ctx.map.removeLayer(ctx.layer);
  const layer=L.layerGroup(),bounds=[],all=panel._hotelData.results;
  const filtered=panel._hotelFiltered||all;
  for(const h of filtered){
    const loc=geo(h);if(!loc)continue;
    const i=all.indexOf(h);if(i<0)continue;
    const icon=L.divIcon({className:'hz-price-marker'+(!(Number(h.total)>0)?' estimated':''),
      html:'<span>'+esc(pinLabel(h))+'</span>',iconSize:[62,28],iconAnchor:[31,14]});
    const marker=L.marker(loc,{icon,title:h.name,keyboard:true});
    marker.bindPopup(popup(h,i,panel._hotelData.nights),{maxWidth:250});
    layer.addLayer(marker);bounds.push(loc);
  }
  layer.addTo(ctx.map);ctx.layer=layer;ctx.bounds=bounds;
  boundsFit(ctx);
}
function update(panel){
  if(!panel?._hotelData?.results)return;
  installStyle();const ctx=getContext(panel);if(!ctx)return;
  const all=panel._hotelData.results,filtered=panel._hotelFiltered||all;
  const located=filtered.filter(h=>!!geo(h)).length,missing=filtered.length-located;
  ctx.shell.querySelector('.hz-hotel-map-copy').textContent=
    'Πινέζες: '+located+' από '+filtered.length+' καταλύματα με αυτά τα φίλτρα'+
    (missing?' · '+missing+' χωρίς συντεταγμένες (παραμένουν στη λίστα)':'')+
    '. Έχουν φορτωθεί '+all.length+' αποτελέσματα.'+
    (panel._hotelData.pagination?.hasMore?' Υπάρχουν κι άλλες σελίδες· μπορείς να φορτώσεις περισσότερα.':'')+
    ' Δεν εγγυόμαστε κάλυψη όλων των καταλυμάτων της πόλης.';
  const version=++ctx.version;
  if(ctx.shell.querySelector('.hz-hotel-map').hidden)return;
  if(!located){
    ctx.shell.querySelector('.hz-hotel-map-error').textContent=
      'Δεν υπάρχουν συντεταγμένες για τα καταλύματα που περνούν τα φίλτρα. Η λίστα παραμένει διαθέσιμη.';
    if(ctx.layer&&ctx.map){ctx.map.removeLayer(ctx.layer);ctx.layer=null;}return;
  }
  ctx.shell.querySelector('.hz-hotel-map-error').textContent='';
  ensureLeaflet().then(L=>{
    if(!ctx.shell.isConnected||ctx.version!==version)return;
    if(!ctx.map){
      ctx.map=L.map(ctx.shell.querySelector('.hz-hotel-map'),{scrollWheelZoom:false});
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
        maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(ctx.map);
    }
    renderMarkers(panel,ctx);
    requestAnimationFrame(()=>ctx.map?.invalidateSize());
  }).catch(err=>{
    if(ctx.version===version)ctx.shell.querySelector('.hz-hotel-map-error').textContent=
      'Ο χάρτης δεν φορτώθηκε ('+String(err.message||err)+'). Η λίστα λειτουργεί κανονικά.';
  });
}
document.addEventListener('horizon:hotel-results-updated',e=>update(e.detail?.panel));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>
  document.querySelectorAll('.hz-hotels-panel').forEach(update),{once:true});
else document.querySelectorAll('.hz-hotels-panel').forEach(update);
window.HorizonHotelMap={update};
})();
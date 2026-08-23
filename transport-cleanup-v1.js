(()=>{
'use strict';

const STYLE_ID='horizon-transport-cleanup-v1-style';
function styles(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
  [data-pane="transport"].hz-transport-clean > .hd-hero,
  [data-pane="transport"].hz-transport-clean > .hd-grid{display:none!important}
  .hz-live-hidden{display:none!important}
  `;document.head.appendChild(s);
}
function stateNow(){try{return typeof state!=='undefined'&&state?state:{};}catch{return {};}}
function selection(){const raw=stateNow().transport;if(Array.isArray(raw))return raw.length?raw:['any'];return raw?[raw]:['any'];}
function allows(mode){const s=selection();return s.includes('any')||s.includes(mode);}
function normalizeText(v){return String(v||'').replace(/\s+/g,' ').trim();}
function dedupeTrainCards(box){
  if(!box||!box.querySelector('[data-surface="train"]'))return;
  const cards=[...box.querySelectorAll('.hz-surface-results .hz-surface-card')],seen=new Set();
  cards.forEach(card=>{
    const key=normalizeText(card.textContent);
    if(!key)return;
    if(seen.has(key))card.remove();else seen.add(key);
  });
  const count=box.querySelectorAll('.hz-surface-results .hz-surface-card').length;
  const found=box.querySelector('.hz-live-found.train');
  if(found){if(count)found.textContent=`✓ Βρέθηκαν ${count} μοναδικά live δρομολόγια τρένων.`;else found.remove();}
}
function cleanComparison(pane){
  if(!pane)return;
  const compares=[...pane.querySelectorAll('.hz-tr-compare')];
  compares.slice(1).forEach(x=>x.remove());
  if(compares.length)pane.classList.add('hz-transport-clean');
}
function cleanFlightPanels(){
  document.querySelectorAll('.horizon-detail-overlay .hz-flights-panel').forEach(panel=>{
    panel.classList.toggle('hz-live-hidden',!allows('plane'));
  });
}
function tuneSurfaceCopy(box,trainOn,ferryOn){
  const copy=box.querySelector('.hz-surface-copy'),head=box.querySelector('.hz-surface-head');
  const trainDecor=[box.querySelector('.hz-live-cta-kicker.train'),box.querySelector('.hz-live-cta-sub.train'),box.querySelector('.hz-live-found.train')].filter(Boolean);
  trainDecor.forEach(x=>x.classList.toggle('hz-live-hidden',!trainOn));
  box.classList.toggle('hz-live-train-box',trainOn);
  if(trainOn&&ferryOn){
    if(head)head.textContent='Ζωντανός έλεγχος μεταφοράς';
    if(copy)copy.textContent='Live/realtime τρένα μέσω Transitous/MOTIS και πραγματικά πλοία μέσω Ferryhopper για τις ημερομηνίες του Planner.';
  }else if(trainOn){
    if(head)head.textContent='Ζωντανός έλεγχος τρένων';
    if(copy)copy.textContent='Πραγματικές ώρες, διάρκεια και realtime ενημέρωση τρένων μέσω Transitous/MOTIS. Αν το feed δεν δώσει fare, η τιμή παραμένει καθαρή εκτίμηση.';
  }else if(ferryOn){
    if(head)head.textContent='Ζωντανός έλεγχος πλοίων';
    if(copy)copy.textContent='Πραγματικά ακτοπλοϊκά δρομολόγια και διαθέσιμες τιμές μέσω Ferryhopper για τις ημερομηνίες του Planner.';
  }
}
function cleanSurfaceBoxes(){
  document.querySelectorAll('.horizon-detail-overlay .hz-surface-live').forEach(box=>{
    const buttons=[...box.querySelectorAll('[data-surface]')];
    buttons.forEach(btn=>{
      const mode=btn.dataset.surface||'';
      btn.classList.toggle('hz-live-hidden',!allows(mode));
    });
    const trainOn=allows('train')&&!!box.querySelector('[data-surface="train"]');
    const ferryOn=allows('ferry')&&!!box.querySelector('[data-surface="ferry"]');
    tuneSurfaceCopy(box,trainOn,ferryOn);
    const visible=buttons.some(btn=>!btn.classList.contains('hz-live-hidden'));
    box.classList.toggle('hz-live-hidden',!visible);
    if(box.dataset.liveMode&&!allows(box.dataset.liveMode)){
      const out=box.querySelector('.hz-surface-results');if(out)out.innerHTML='';
      delete box.dataset.liveMode;
    }
    dedupeTrainCards(box);
  });
}
function cleanOverlay(){
  styles();
  const pane=document.querySelector('.horizon-detail-overlay [data-pane="transport"]');
  cleanComparison(pane);cleanFlightPanels();cleanSurfaceBoxes();
}
function syncModeClick(e){
  const b=e.target.closest?.('[data-surface]');
  if(!b)return;
  const box=b.closest('.hz-surface-live');if(box)box.dataset.liveMode=b.dataset.surface||'';
}
function burst(){[0,80,220,550,1000].forEach(ms=>setTimeout(cleanOverlay,ms));}
function install(){
  styles();
  document.addEventListener('click',e=>{syncModeClick(e);burst();},true);
  document.addEventListener('horizon:live-train-price',burst);
  document.addEventListener('horizon:live-flight-price',burst);
  document.addEventListener('horizon:live-ferry-price',burst);
  burst();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

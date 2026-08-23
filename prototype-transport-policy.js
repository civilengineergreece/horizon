(()=>{
'use strict';

const RANGE_PCT=0.08;

function numberFromEuro(text){
  const m=String(text||'').replace(/\s/g,'').match(/€([\d.,]+)/);
  if(!m)return null;
  const raw=m[1].replace(/\./g,'').replace(',','.');
  const n=Number(raw);
  return Number.isFinite(n)&&n>0?n:null;
}
function round5(n){return Math.max(5,Math.round(n/5)*5);}
function rangeText(n){
  const center=round5(n);
  const low=round5(n*(1-RANGE_PCT));
  const high=Math.max(low+5,round5(n*(1+RANGE_PCT)));
  return `~€${center.toLocaleString('el-GR')} (περ. €${low.toLocaleString('el-GR')}–${high.toLocaleString('el-GR')})`;
}
function rowMode(row){
  const t=row?.cells?.[0]?.textContent||'';
  if(/Λεωφορείο|ΚΤΕΛ/i.test(t))return 'bus';
  if(/Τρένο/i.test(t))return 'train';
  if(/Πλοίο/i.test(t))return 'ferry';
  if(/Αεροπλάνο/i.test(t))return 'plane';
  if(/ΙΧ/i.test(t))return 'car';
  return '';
}
function hasRealLive(row){
  const t=row?.cells?.[3]?.textContent||'';
  return /Live Ferryhopper|Live Google|Google Flights|Live Omio|Live Transitous/i.test(t);
}
function markEstimate(row,mode){
  if(!row||row.cells.length<4||hasRealLive(row))return;
  const costCell=row.cells[2],statusCell=row.cells[3],timeCell=row.cells[1];
  const n=numberFromEuro(costCell.textContent);
  if(n&&!/–/.test(costCell.textContent||''))costCell.innerHTML=`<b>${rangeText(n)}</b>`;
  if(timeCell&&timeCell.textContent&&!/^~|—/.test(timeCell.textContent.trim()))timeCell.textContent=`~${timeCell.textContent.trim()}`;
  const label=mode==='bus'?'ΚΤΕΛ/λεωφορείου':mode==='train'?'τρένου':'πλοίου';
  const extra=mode==='train'?' Το δρομολόγιο ενημερώνεται live από Transitous όταν γίνει αναζήτηση.':'';
  statusCell.innerHTML=`<span class="hz-tr-status-est">Εκτίμηση τιμής</span><span class="hz-tr-note">Στενό ενδεικτικό εύρος ${label} για γρήγορη σύγκριση — όχι live τιμή.${extra}</span>`;
}
function patchCompare(){
  const pane=document.querySelector('.horizon-detail-overlay [data-pane="transport"]');
  if(!pane)return;
  const copy=pane.querySelector('.hz-tr-compare .hz-tr-copy');
  if(copy)copy.textContent='Σύγκριση διαθέσιμων τρόπων για τις επιλογές σου. Οι πτήσεις ενημερώνονται με πραγματικές τιμές, τα τρένα με live/realtime δρομολόγια Transitous και, όπου λειτουργεί, τα πλοία με Ferryhopper. Αν το train feed δεν δώσει fare, εμφανίζεται στενή εκτίμηση τιμής. Τα ΚΤΕΛ παραμένουν εκτίμηση και το ΙΧ είναι υπολογισμός καυσίμων και διοδίων.';
  pane.querySelectorAll('.hz-tr-table tbody tr').forEach(row=>{
    const mode=rowMode(row);
    if(mode==='bus'||mode==='train'||mode==='ferry')markEstimate(row,mode);
  });
}
function patchSurface(){
  document.querySelectorAll('.horizon-detail-overlay .hz-surface-live').forEach(box=>{
    box.querySelectorAll('[data-surface="bus"]').forEach(b=>b.remove());
    const copy=box.querySelector('.hz-surface-copy');
    if(copy)copy.textContent='Χρησιμοποιούνται αυτόματα η αφετηρία, ο προορισμός και οι ημερομηνίες του Planner. Τα τρένα αναζητούνται live μέσω Transitous/MOTIS και τα πλοία μέσω Ferryhopper. Για ΚΤΕΛ κρατάμε καθαρή εκτίμηση στη δοκιμαστική έκδοση· στην επαγγελματική έκδοση θα χρησιμοποιηθεί Omio.';
    const actions=box.querySelector('.hz-surface-actions');
    if(actions&&!actions.querySelector('button'))box.style.display='none';
    else box.style.display='';
  });
}
function patchCards(){
  document.querySelectorAll('#resultsCard .destination').forEach(card=>{
    const breaks=[...card.querySelectorAll('.break')];
    for(const b of breaks){
      const txt=b.textContent||'';
      if(!/Μεταφορά/i.test(txt)||!/Εκτίμηση|~€/i.test(txt))continue;
      const notes=[...b.querySelectorAll('.hz-card-est-note')];
      if(notes.length){notes.slice(1).forEach(n=>n.remove());continue;}
      const small=document.createElement('small');
      small.className='hz-card-est-note';
      small.style.cssText='display:block;color:#8fa0ac;margin-top:3px;font-size:.66rem';
      small.textContent='Ενδεικτικό κόστος — η πραγματική τιμή ελέγχεται όπου υπάρχει live provider.';
      b.appendChild(small);
    }
  });
}
function patch(){patchCompare();patchSurface();patchCards();}
function burst(){[0,80,220,600].forEach(ms=>setTimeout(patch,ms));}
function install(){
  document.addEventListener('click',burst,true);
  document.addEventListener('horizon:live-ferry-price',burst);
  document.addEventListener('horizon:live-flight-price',burst);
  document.addEventListener('horizon:live-train-price',burst);
  burst();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

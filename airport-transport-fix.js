(()=>{
'use strict';
const AIRPORTS={
  'Σύρος':{iata:'JSY',minutes:35}
};
function destinations(){return window.HORIZON_DESTINATIONS||[];}
function ensureData(){
  destinations().forEach(d=>{
    if(!AIRPORTS[d.name])return;
    if(!Array.isArray(d.transport))d.transport=[];
    if(!d.transport.includes('plane'))d.transport.unshift('plane');
  });
}
function patchCards(){
  document.querySelectorAll('#resultsCard .destination').forEach(card=>{
    const name=card.querySelector('h4')?.textContent?.trim();if(!AIRPORTS[name])return;
    const pills=card.querySelector('.hz-tr-pills');
    if(pills&&![...pills.children].some(x=>/Αεροπλάνο/.test(x.textContent||''))){
      const p=document.createElement('span');p.className='hz-tr-pill';p.textContent='✈ Αεροπλάνο';pills.prepend(p);
    }
  });
}
function patchOverlay(){
  const ov=document.querySelector('.horizon-detail-overlay');if(!ov)return;
  const name=ov.querySelector('.hd-head h3')?.textContent?.trim();const a=AIRPORTS[name];if(!a)return;
  ensureData();
  const tbody=ov.querySelector('[data-pane="transport"] .hz-tr-table tbody');
  if(tbody&&![...tbody.rows].some(r=>/Αεροπλάνο/.test(r.textContent||''))){
    const tr=document.createElement('tr');tr.className='hz-tr-selected';
    tr.innerHTML=`<td><b>✈ Αεροπλάνο</b><span class="hz-tr-note">✓ διαθέσιμο · ${a.iata}</span></td><td>~${a.minutes}λ</td><td>Έλεγχος live τιμής</td><td><span class="hz-tr-status-live">Live διαθέσιμο</span><span class="hz-tr-note">Google Flights μέσω SerpApi</span></td>`;
    tbody.prepend(tr);
  }
}
function patch(){ensureData();patchCards();patchOverlay();}
ensureData();
window.addEventListener('click',ensureData,true);
document.addEventListener('click',()=>setTimeout(patch,0),true);
document.addEventListener('horizon:live-flight-price',()=>setTimeout(patch,0));
setTimeout(patch,0);setTimeout(patch,250);
})();

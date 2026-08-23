(()=>{
'use strict';
const STYLE_ID='horizon-transport-results-compare-style';
const ORDER=['plane','train','bus','ferry','car'];
const META={
  plane:{icon:'✈',label:'Αεροπλάνο'},train:{icon:'🚆',label:'Τρένο'},bus:{icon:'🚌',label:'Λεωφορείο'},ferry:{icon:'⛴',label:'Πλοίο'},car:{icon:'🚗',label:'ΙΧ'}
};
const TRAIN={
  'Θεσσαλονίκη':{hours:5.0,adultRT:80},'Μετέωρα':{hours:4.8,adultRT:55}
};
const BUS={
  'Ναύπλιο':{hours:2.3,adultRT:34},'Θεσσαλονίκη':{hours:5.7,adultRT:90},'Μονεμβασιά':{hours:4.7,adultRT:58},'Ιωάννινα':{hours:5.4,adultRT:82},'Δελφοί':{hours:3.0,adultRT:36},
  'Λευκάδα':{hours:5.2,adultRT:76},'Μάνη':{hours:4.2,adultRT:52},'Καλαμάτα':{hours:3.2,adultRT:50},'Πάργα':{hours:5.8,adultRT:82},'Χαλκιδική':{hours:7.0,adultRT:96},'Πήλιο':{hours:4.5,adultRT:62},
  'Ζαγόρι':{hours:6.2,adultRT:88},'Μετέωρα':{hours:4.5,adultRT:54},'Αράχωβα':{hours:2.5,adultRT:34},'Σόφια':{hours:11.0,adultRT:76},'Σκόπια':{hours:10.0,adultRT:70},'Μπάνσκο':{hours:10.5,adultRT:82},
  'Τίρανα':{hours:10.5,adultRT:84},'Σαράντα':{hours:10.0,adultRT:86},'Βελιγράδι':{hours:14.0,adultRT:112},'Βουκουρέστι':{hours:15.0,adultRT:120}
};
const FERRY={
  'Άνδρος':{hours:2.0,adultRT:50},'Σύρος':{hours:2.3,adultRT:80},'Τήνος':{hours:2.4,adultRT:80},'Μύκονος':{hours:2.8,adultRT:100},'Σέριφος':{hours:2.4,adultRT:78},'Σίφνος':{hours:2.9,adultRT:92},
  'Πάρος':{hours:3.4,adultRT:90},'Νάξος':{hours:4.0,adultRT:90},'Μήλος':{hours:3.6,adultRT:100},'Σαντορίνη':{hours:5.0,adultRT:110},'Σκιάθος':{hours:2.5,adultRT:85},'Σκόπελος':{hours:3.3,adultRT:90},
  'Αλόννησος':{hours:4.2,adultRT:95},'Χίος':{hours:7.5,adultRT:100},'Λέσβος':{hours:10.5,adultRT:105},'Σάμος':{hours:8.5,adultRT:110},'Κως':{hours:9.5,adultRT:115},'Ρόδος':{hours:13.0,adultRT:125},
  'Κάρπαθος':{hours:14.0,adultRT:130},'Κρήτη':{hours:8.5,adultRT:100}
};
const PLANE_MIN={
  'Θεσσαλονίκη':50,'Ιωάννινα':60,'Σόφια':75,'Τίρανα':80,'Σκόπια':75,'Κωνσταντινούπολη':90,'Ρώμη':125,'Βιέννη':135,'Παρίσι':210,'Λονδίνο':240
};
const NO_AIRPORT=new Set(['Σύρος','Τήνος','Άνδρος','Σίφνος','Σέριφος','Σκόπελος','Αλόννησος','Λευκάδα']);
function styles(){if(document.getElementById(STYLE_ID))return;const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
.hz-tr-available{margin:9px 0 2px;padding:9px 10px;border:1px solid rgba(255,255,255,.08);border-radius:11px;background:rgba(255,255,255,.025)}
.hz-tr-label{color:#91a4b2;font-size:.68rem;margin-bottom:6px}.hz-tr-pills{display:flex;gap:5px;flex-wrap:wrap}.hz-tr-pill{display:inline-flex;gap:4px;align-items:center;border:1px solid rgba(101,211,154,.28);border-radius:999px;padding:3px 7px;background:rgba(101,211,154,.06);color:#cfeade;font-size:.66rem;font-weight:800}
.hz-tr-compare{margin:0 0 18px;padding:15px;border:1px solid rgba(255,122,22,.3);border-radius:15px;background:rgba(5,16,26,.5)}.hz-tr-compare h4{margin:0 0 4px}.hz-tr-copy{color:#9fb0bd;font-size:.76rem;line-height:1.45;margin-bottom:10px}.hz-tr-table-wrap{overflow-x:auto}.hz-tr-table{width:100%;border-collapse:collapse;font-size:.75rem;min-width:510px}.hz-tr-table th,.hz-tr-table td{padding:9px 7px;text-align:left;border-bottom:1px solid rgba(255,255,255,.08);vertical-align:top}.hz-tr-table th{color:#8fa3b2;font-size:.66rem}.hz-tr-selected td:first-child{color:#8ae5b5}.hz-tr-status-live{color:#76d8a6}.hz-tr-status-est{color:#ffd09f}.hz-tr-status-calc{color:#a9d7ff}.hz-tr-note{display:block;color:#7f96a5;font-size:.62rem;line-height:1.35;margin-top:2px}
`;document.head.appendChild(s);}
function stateNow(){try{return typeof state!=='undefined'&&state?state:{};}catch{return {};}}
function dest(name){return (window.HORIZON_DESTINATIONS||[]).find(d=>d.name===name)||{};}
function selected(){const v=stateNow().transport;if(Array.isArray(v))return v.length?v:['any'];return v?[v]:['any'];}
function addMode(d,m){if(!Array.isArray(d.transport))d.transport=[];if(!d.transport.includes(m))d.transport.push(m);}
function rmMode(d,m){if(Array.isArray(d.transport))d.transport=d.transport.filter(x=>x!==m);}
function normalizeModes(d){
  if(d.region==='Ελλάδα'){
    if(d.type==='island'||FERRY[d.name])addMode(d,'ferry');
    if(d.type!=='island'&&!FERRY[d.name]){addMode(d,'car');addMode(d,'bus');}
    if(TRAIN[d.name])addMode(d,'train');
    if(NO_AIRPORT.has(d.name))rmMode(d,'plane');
  }
  if(d.region==='Βαλκάνια'){addMode(d,'bus');addMode(d,'car');}
  d.transport=[...new Set(d.transport||[])].filter(m=>ORDER.includes(m));return d.transport;
}
function matchingModes(d){const all=normalizeModes(d),sel=selected();return sel.includes('any')?all:all.filter(m=>sel.includes(m));}
function peopleWeight(kind){const t=stateNow().travelers||{},a=Math.max(1,Number(t.adults)||1),c=Math.max(0,Number(t.children)||0),i=Math.max(0,Number(t.infants)||0);return kind==='ferry'||kind==='bus'||kind==='train'?a+c*.55+i*.05:a+c*.7+i*.1;}
function formatH(hours){if(!Number.isFinite(hours))return '—';const h=Math.floor(hours),m=Math.round((hours-h)*60);return h?(m?`${h}ω ${m}λ`:`${h}ω`):`${m}λ`;}
function dates(){const s=stateNow(),from=s.dates?.from||'',days=Math.max(1,Number(s.duration)||1);if(!from)return {from:'',to:''};const d=new Date(`${from}T12:00:00`);d.setDate(d.getDate()+Math.max(0,days-1));return {from,to:d.toISOString().slice(0,10)};}
function flightCache(name){try{const s=stateNow(),t=s.travelers||{},dt=dates(),key=`hz-flights-v1:${[s.origin||'Αθήνα',name,dt.from,dt.to,Math.max(1,Number(t.adults)||1),Math.max(0,Number(t.children)||0),Math.max(0,Number(t.infants)||0)].join('|')}`,v=JSON.parse(localStorage.getItem(key)||'null');if(!v||Date.now()-Number(v.at||0)>30*60*1000)return null;const prices=(v.data?.results||[]).map(x=>Number(x?.price)).filter(x=>Number.isFinite(x)&&x>0);return prices.length?Math.min(...prices):null;}catch{return null;}}
function carData(d){const p=window.HORIZON_CAR_ASSUMPTIONS?.roadProfiles?.[d.name];if(!p)return null;const t=stateNow().travelers||{},persons=Math.max(1,(Number(t.adults)||1)+(Number(t.children)||0)+(Number(t.infants)||0)),cars=Math.max(1,Math.ceil(persons/5)),cons=Number(stateNow().carConsumption?.value)||Number(window.HORIZON_CAR_ASSUMPTIONS?.consumptionL100)||7.5,fuelP=Number(window.HORIZON_CAR_ASSUMPTIONS?.fuelPricePerL)||2,km=p.km*2,fuel=Math.round(km*cons/100*fuelP*cars),tolls=Math.round((Number(p.toll)||0)*2*cars);return {hours:p.hours,cost:fuel+tolls,note:`${Math.round(km)} km μετ’ επιστροφής · καύσιμα €${fuel} + διόδια €${tolls}`};}
function modeData(d,m){
  if(m==='plane'){const live=flightCache(d.name);return {time:PLANE_MIN[d.name]?formatH(PLANE_MIN[d.name]/60):'Δες live πτήσεις',cost:live?`€${live.toLocaleString('el-GR')}`:'Έλεγχος τιμής',status:live?'Live':'Live διαθέσιμο',cls:'hz-tr-status-live',note:live?'Google Flights μέσω SerpApi':'Πάτησε «Πραγματικές πτήσεις» για τιμή στις ημερομηνίες σου.'};}
  if(m==='car'){const x=carData(d);return x?{time:formatH(x.hours),cost:`~€${x.cost.toLocaleString('el-GR')}`,status:'Υπολογισμός',cls:'hz-tr-status-calc',note:x.note}:{time:'—',cost:'—',status:'Χωρίς στοιχεία',cls:'hz-tr-status-est',note:'Δεν έχουμε ακόμη πλήρες οδικό προφίλ.'};}
  const src=m==='train'?TRAIN[d.name]:m==='bus'?BUS[d.name]:FERRY[d.name];if(!src)return {time:'—',cost:'—',status:'Μη διαθέσιμη εκτίμηση',cls:'hz-tr-status-est',note:'Χρειάζεται επιβεβαίωση δρομολογίου.'};
  const w=peopleWeight(m),cost=Math.round(src.adultRT*w);return {time:formatH(src.hours),cost:`~€${cost.toLocaleString('el-GR')}`,status:'Εκτίμηση',cls:'hz-tr-status-est',note:'Ενδεικτικό μετ’ επιστροφής για τους ταξιδιώτες σου — όχι live τιμή.'};
}
function patchCards(){
  const cards=[...document.querySelectorAll('#resultsCard .destination')];cards.forEach(card=>{
    const name=card.querySelector('h4')?.textContent?.trim();if(!name)return;const d=dest(name),modes=matchingModes(d);let box=card.querySelector('.hz-tr-available');if(!box){box=document.createElement('div');box.className='hz-tr-available';const tag=card.querySelector('.tagrow');(tag||card.querySelector('.why'))?.after(box);}
    box.innerHTML=`<div class="hz-tr-label">Διαθέσιμα από τις επιλογές σου</div><div class="hz-tr-pills">${modes.length?modes.map(m=>`<span class="hz-tr-pill">${META[m].icon} ${META[m].label}</span>`).join(''):'<span class="hz-tr-pill">Δεν υπάρχει συμβατό μέσο</span>'}</div>`;
    card.querySelectorAll('.actions a,.actions button').forEach(a=>{if(/μεταφορ|πτήσ|σύγκρι/i.test(a.textContent||''))a.textContent='Σύγκριση μεταφορών';});
  });
}
function patchOverlay(){
  const ov=document.querySelector('.horizon-detail-overlay');if(!ov)return;const name=ov.querySelector('.hd-head h3')?.textContent?.trim();if(!name)return;const pane=ov.querySelector('[data-pane="transport"]');if(!pane||pane.querySelector('.hz-tr-compare'))return;const d=dest(name),all=normalizeModes(d),sel=selected();
  const box=document.createElement('section');box.className='hz-tr-compare';box.innerHTML=`<h4>Σύγκριση διαθέσιμων τρόπων</h4><div class="hz-tr-copy">Οι επιλογές που έκανες στο Planner επισημαίνονται. Εμφανίζονται όλοι οι πραγματικά διαθέσιμοι τρόποι για τον προορισμό. Οι τιμές πτήσεων γίνονται live όταν υπάρχει αναζήτηση· οι υπόλοιπες αναγράφονται καθαρά ως εκτίμηση ή υπολογισμός.</div><div class="hz-tr-table-wrap"><table class="hz-tr-table"><thead><tr><th>Μέσο</th><th>Χρόνος μονής διαδρομής</th><th>Κόστος μετ’ επιστροφής</th><th>Ποιότητα τιμής</th></tr></thead><tbody>${all.map(m=>{const x=modeData(d,m),chosen=sel.includes('any')||sel.includes(m);return `<tr class="${chosen?'hz-tr-selected':''}"><td><b>${META[m].icon} ${META[m].label}</b>${chosen?'<span class="hz-tr-note">✓ επιλογή σου</span>':''}</td><td>${x.time}</td><td><b>${x.cost}</b></td><td><span class="${x.cls}">${x.status}</span><span class="hz-tr-note">${x.note}</span></td></tr>`;}).join('')}</tbody></table></div>`;
  pane.prepend(box);
}
function patch(){styles();patchCards();patchOverlay();}
function burst(){[0,60,180,500,1000].forEach(ms=>setTimeout(patch,ms));}
function install(){
  if(!window.__HZ_TR_RESULTS_WRAP__&&typeof window.renderResults==='function'){window.__HZ_TR_RESULTS_WRAP__=true;const base=window.renderResults;window.renderResults=function(){const r=base.apply(this,arguments);queueMicrotask(patchCards);return r;};}
  document.addEventListener('click',e=>{if(e.target.closest('.destination .actions a,.destination .actions button,.hd-tab'))burst();},true);
  document.addEventListener('horizon:live-flight-price',burst);
  burst();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
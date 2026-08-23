(()=>{
'use strict';

const STYLE_ID='horizon-multimodal-transport-style';
const MODE_ORDER=['plane','train','bus','ferry','car'];
const MODE_META={
  plane:{icon:'✈',label:'Αεροπλάνο',source:'Πραγματικές τιμές διαθέσιμες μέσω Google Flights'},
  train:{icon:'🚆',label:'Τρένο',source:'Εκτίμηση — απαιτείται έλεγχος δρομολογίου/τιμής'},
  bus:{icon:'🚌',label:'Λεωφορείο',source:'Εκτίμηση — απαιτείται έλεγχος δρομολογίου/τιμής'},
  ferry:{icon:'⛴',label:'Πλοίο',source:'Εκτίμηση — απαιτείται έλεγχος δρομολογίου/τιμής'},
  car:{icon:'🚗',label:'ΙΧ',source:'Υπολογισμός καυσίμων + διοδίων όπου υπάρχουν στοιχεία'}
};
const TRAIN_PROFILES={
  'Θεσσαλονίκη':{hours:5.0,adultRT:80,note:'Η διαθεσιμότητα και η ακριβής διάρκεια πρέπει να επιβεβαιώνονται πριν την κράτηση.'},
  'Μετέωρα':{hours:4.8,adultRT:55,note:'Η διαδρομή μπορεί να περιλαμβάνει αλλαγή ή/και οδικό τμήμα ανάλογα με το πρόγραμμα.'}
};
const BUS_HOURS={
  'Ναύπλιο':2.3,'Θεσσαλονίκη':5.7,'Μονεμβασιά':4.7,'Ιωάννινα':5.4,'Δελφοί':3.0,
  'Λευκάδα':5.2,'Μάνη':4.2,'Καλαμάτα':3.2,'Πάργα':5.8,'Χαλκιδική':7.0,'Πήλιο':4.5,
  'Ζαγόρι':6.2,'Μετέωρα':4.5,'Αράχωβα':2.5,'Σόφια':11.0,'Σκόπια':10.0,'Μπάνσκο':10.5,
  'Τίρανα':10.5,'Σαράντα':10.0,'Βελιγράδι':14.0,'Βουκουρέστι':15.0
};
const FERRY_HOURS={
  'Άνδρος':2.0,'Σύρος':2.3,'Τήνος':2.4,'Μύκονος':2.8,'Σέριφος':2.4,'Σίφνος':2.9,
  'Πάρος':3.4,'Νάξος':4.0,'Μήλος':3.6,'Σαντορίνη':5.0,'Σκιάθος':2.5,'Σκόπελος':3.3,
  'Αλόννησος':4.2,'Χίος':7.5,'Λέσβος':10.5,'Σάμος':8.5,'Κως':9.5,'Ρόδος':13.0,
  'Κάρπαθος':14.0,'Κρήτη':8.5
};
const NO_AIRPORT_ISLANDS=new Set(['Σύρος','Τήνος','Άνδρος','Σίφνος','Σέριφος','Σκόπελος','Αλόννησος','Λευκάδα']);
const GREEK_TRAIN=new Set(['Θεσσαλονίκη','Μετέωρα']);
const GREEK_MAINLAND_NO_PLANE=new Set(['Ναύπλιο','Μονεμβασιά','Δελφοί','Λευκάδα','Μάνη','Καλαμάτα','Πάργα','Χαλκιδική','Πήλιο','Ζαγόρι','Μετέωρα','Αράχωβα']);

function installStyles(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
  .hz-mm-note{margin-top:10px;color:#91a4b2;font-size:.8rem;line-height:1.5}
  .hz-mm-cardmodes{display:flex;gap:5px;flex-wrap:wrap;margin:7px 0 2px}.hz-mm-mini{border:1px solid rgba(255,255,255,.1);border-radius:999px;padding:3px 7px;color:#b8c7d0;font-size:.66rem;background:rgba(255,255,255,.025)}
  .hz-mm-panel{margin:0 0 18px;padding:16px;border:1px solid rgba(255,122,22,.26);border-radius:16px;background:rgba(5,16,26,.42)}
  .hz-mm-title{font-weight:900;font-size:1rem}.hz-mm-copy{margin:4px 0 12px;color:#9fb0bd;font-size:.8rem;line-height:1.48}
  .hz-mm-modes{display:flex;gap:7px;flex-wrap:wrap}.hz-mm-mode{display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:8px 10px;background:#0b1d2b;color:#d7e0e6;font-size:.76rem;font-weight:800;cursor:pointer}.hz-mm-mode input{accent-color:#ff7a16}.hz-mm-mode.selected{border-color:#ff7a16;background:rgba(255,122,22,.10);color:#fff}
  .hz-mm-compare{margin-top:12px;border:0;border-radius:10px;padding:10px 12px;background:linear-gradient(180deg,#ff8b29,#df5e08);color:#fff;font-weight:900;cursor:pointer}.hz-mm-compare:disabled{opacity:.45;cursor:not-allowed}
  .hz-mm-table-wrap{margin-top:13px;overflow-x:auto}.hz-mm-table{width:100%;border-collapse:separate;border-spacing:0;font-size:.76rem}.hz-mm-table th,.hz-mm-table td{padding:9px 8px;text-align:left;border-bottom:1px solid rgba(255,255,255,.08);vertical-align:top}.hz-mm-table th{color:#8fa3b2;font-size:.68rem}.hz-mm-table td b{color:#fff}.hz-mm-source{display:block;margin-top:3px;color:#8399a8;font-size:.64rem;line-height:1.35}.hz-mm-live{color:#79dfa9!important}.hz-mm-est{color:#ffd19f!important}
  .hz-mm-foot{margin-top:10px;color:#8fa3b2;font-size:.69rem;line-height:1.45}.hz-mm-empty{padding:12px;border:1px dashed rgba(255,255,255,.13);border-radius:11px;color:#9fb0bd}
  @media(max-width:620px){.hz-mm-mode{flex:1 1 calc(50% - 7px);justify-content:center}.hz-mm-table{min-width:520px}}
  `;document.head.appendChild(s);
}
function stateNow(){try{return typeof state!=='undefined'&&state?state:{};}catch{return {};}}
function saveState(){try{if(typeof save==='function')save();else localStorage.setItem('horizon-planner-v1',JSON.stringify(stateNow()));}catch{}}
function selection(){
  const raw=window.__HZ_MM_SELECTED||stateNow().transport;
  if(Array.isArray(raw))return raw.length?raw:['any'];
  if(!raw)return ['any'];
  return [String(raw)];
}
function selectedFor(d){const sel=selection();return sel.includes('any')?[...(d.transport||[])]:sel.filter(m=>(d.transport||[]).includes(m));}
function people(){const t=stateNow().travelers||{};return {adults:Math.max(1,Number(t.adults)||1),children:Math.max(0,Number(t.children)||0),infants:Math.max(0,Number(t.infants)||0)};}
function travelersWeighted(){const t=people();return {ticket:t.adults+t.children*.7+t.infants*.15,bus:t.adults+t.children*.55+t.infants*.05,ferry:t.adults+t.children*.55+t.infants*.05,total:t.adults+t.children+t.infants};}
function maxHours(){const m=stateNow().maxTravelHours;if(m?.unlimited)return null;const n=Number(m?.value);return Number.isFinite(n)&&n>0?n:null;}
function roadProfile(name){return window.HORIZON_CAR_ASSUMPTIONS?.roadProfiles?.[name]||null;}
function carConsumption(){const n=Number(stateNow().carConsumption?.value);return Number.isFinite(n)&&n>=2&&n<=25?n:Number(window.HORIZON_CAR_ASSUMPTIONS?.consumptionL100)||7.5;}
function addMode(d,m){if(!Array.isArray(d.transport))d.transport=[];if(!d.transport.includes(m))d.transport.push(m);}
function removeMode(d,m){if(Array.isArray(d.transport))d.transport=d.transport.filter(x=>x!==m);}
function augmentDestinations(){
  (window.HORIZON_DESTINATIONS||[]).forEach(d=>{
    if(d.region==='Ελλάδα'){
      if(d.type==='island'||FERRY_HOURS[d.name])addMode(d,'ferry');
      if(NO_AIRPORT_ISLANDS.has(d.name))removeMode(d,'plane');
      if(d.type!=='island'&&!FERRY_HOURS[d.name]){addMode(d,'car');addMode(d,'bus');}
      if(GREEK_TRAIN.has(d.name))addMode(d,'train');
      if(GREEK_MAINLAND_NO_PLANE.has(d.name))removeMode(d,'plane');
    }
    if(d.region==='Βαλκάνια'){addMode(d,'bus');addMode(d,'car');}
    d.transport=[...new Set(d.transport||[])].filter(x=>MODE_ORDER.includes(x));
  });
}
function patchPlannerStep(){
  if(typeof steps==='undefined'||!Array.isArray(steps))return false;
  const s=steps.find(x=>x.key==='transport');if(!s)return false;
  s.multi=true;s.hint='Με ποιους τρόπους θα ήθελες να ταξιδέψεις;';
  s.options=[
    ['plane','✈ Αεροπλάνο','Γρήγορα & μακριά'],['train','🚆 Τρένο','Άνεση χωρίς οδήγηση'],['bus','🚌 Λεωφορείο','Οικονομικές οδικές διαδρομές'],
    ['ferry','⛴ Πλοίο','Νησιά & ακτοπλοΐα'],['car','🚗 ΙΧ','Ελευθερία & road trip'],['any','Όλοι οι τρόποι','Δείξε κάθε διαθέσιμη επιλογή']
  ];
  const st=stateNow();
  if(!Array.isArray(st.transport))st.transport=st.transport?[st.transport]:['any'];
  st.transport=[...new Set(st.transport)].filter(x=>MODE_ORDER.includes(x)||x==='any');if(!st.transport.length)st.transport=['any'];
  if(st.transport.includes('any')&&st.transport.length>1)st.transport=['any'];saveState();
  if(!window.__HZ_MM_BIND_PATCH__&&typeof window.bindCurrent==='function'){
    window.__HZ_MM_BIND_PATCH__=true;const base=window.bindCurrent;
    window.bindCurrent=function(){
      base();const step=steps?.[current];if(step?.key!=='transport')return;
      document.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>{
        const val=b.dataset.choice;let arr=Array.isArray(state.transport)?[...state.transport]:[];
        if(val==='any')arr=['any'];
        else{arr=arr.filter(x=>x!=='any');arr.includes(val)?arr=arr.filter(x=>x!==val):arr.push(val);}
        state.transport=arr;saveState();render();
      });
      const choices=document.querySelector('.choices');
      if(choices&&!document.querySelector('.hz-mm-note')){const n=document.createElement('div');n.className='hz-mm-note';n.textContent='Μπορείς να επιλέξεις περισσότερους από έναν τρόπους. Το Horizon θα κρατήσει προορισμούς που υποστηρίζουν τουλάχιστον έναν από αυτούς.';choices.after(n);}
    };
  }
  try{if(typeof current==='number'&&steps[current]?.key==='transport'&&typeof render==='function')render();}catch{}
  return true;
}
function estimateMode(d,mode){
  const t=travelersWeighted(),budgetNo=stateNow().budget?.transport==='no',p=roadProfile(d.name);
  if(mode==='car'){
    if(!(d.transport||[]).includes('car'))return null;
    const cars=Math.max(1,Math.ceil(t.total/5)),cons=carConsumption(),fuelPrice=Number(window.HORIZON_CAR_ASSUMPTIONS?.fuelPricePerL)||2;
    if(p){const km=p.km*2,fuel=Math.round(km*cons/100*fuelPrice*cars),tolls=Math.round((p.toll||0)*2*cars);return {mode,cost:budgetNo?0:fuel+tolls,rawCost:fuel+tolls,hours:p.hours,label:'Υπολογισμός',note:`${Math.round(km)} km μετ’ επιστροφής · καύσιμα €${fuel} + διόδια/τέλη €${tolls}`};}
    return {mode,cost:budgetNo?0:Math.round(d.travel*t.ticket),rawCost:Math.round(d.travel*t.ticket),hours:null,label:'Εκτίμηση',note:'Δεν υπάρχουν ακόμη αναλυτικά οδικά στοιχεία για αυτή τη διαδρομή.'};
  }
  if(mode==='train'){
    const x=TRAIN_PROFILES[d.name];if(!x)return null;const c=Math.round(x.adultRT*t.bus);return {mode,cost:budgetNo?0:c,rawCost:c,hours:x.hours,label:'Εκτίμηση',note:x.note};
  }
  if(mode==='bus'){
    if(!(d.transport||[]).includes('bus'))return null;const h=BUS_HOURS[d.name]||(p?p.hours*1.16:null);let adult=p?Math.max(24,Math.round(p.km*.16)):Math.max(35,Math.round(d.travel*.55));if(d.region==='Βαλκάνια')adult=Math.max(adult,55);const c=Math.round(adult*t.bus);return {mode,cost:budgetNo?0:c,rawCost:c,hours:h,label:'Εκτίμηση',note:'Ενδεικτικό εισιτήριο μετ’ επιστροφής για τους ταξιδιώτες.'};
  }
  if(mode==='ferry'){
    if(!(d.transport||[]).includes('ferry'))return null;const adult=Math.max(50,Number(d.travel)||70),c=Math.round(adult*t.ferry);return {mode,cost:budgetNo?0:c,rawCost:c,hours:FERRY_HOURS[d.name]||null,label:'Εκτίμηση',note:'Ενδεικτικό ακτοπλοϊκό κόστος χωρίς όχημα/καμπίνα.'};
  }
  if(mode==='plane'){
    if(!(d.transport||[]).includes('plane'))return null;const c=Math.round((Number(d.travel)||170)*t.ticket);return {mode,cost:budgetNo?0:c,rawCost:c,hours:null,label:'Μόνο για ranking',note:'Η πραγματική τιμή εμφανίζεται μόνο μετά τον έλεγχο Google Flights.'};
  }
  return null;
}
function calcMultimodal(d){
  const t=people(),days=Math.max(1,Number(stateNow().duration)||1),nights=Math.max(0,days-1),weighted=t.adults+t.children*.55+t.infants*.15;
  let stayFactor=.94;if(stateNow().stay==='hotel')stayFactor=1.12;else if(stateNow().stay==='airbnb')stayFactor=.98;else if(stateNow().stay==='camping')stayFactor=.66;
  const accommodation=Math.round(d.daily*nights*weighted*.52*stayFactor),foodLocal=Math.round(d.daily*days*(t.adults+t.children*.55+t.infants*.08)*.34),activities=Math.round(d.activity*days*(t.adults+t.children*.55+t.infants*.05));
  const modes=selectedFor(d),limit=maxHours();let candidates=modes.map(m=>estimateMode(d,m)).filter(Boolean);if(limit)candidates=candidates.filter(x=>!x.hours||x.hours<=limit);
  if(!candidates.length)return {accommodation,foodLocal,activities,transport:99999,total:accommodation+foodLocal+activities+99999,transportMode:null,transportDetails:null,travelHours:Infinity};
  const chosen=[...candidates].sort((a,b)=>a.cost-b.cost)[0];return {accommodation,foodLocal,activities,transport:chosen.cost,total:accommodation+foodLocal+activities+chosen.cost,transportMode:chosen.mode,transportDetails:chosen,travelHours:chosen.hours??Infinity,multimodalCandidates:candidates};
}
function patchScoring(){
  if(window.__HZ_MM_SCORE_PATCH__||typeof window.scoreDest!=='function')return false;window.__HZ_MM_SCORE_PATCH__=true;
  window.calcCost=calcMultimodal;
  const baseScore=window.scoreDest;
  window.scoreDest=function(d){
    const original=state.transport,sel=Array.isArray(original)?[...original]:[original||'any'];window.__HZ_MM_SELECTED=sel;state.transport='any';
    let r;try{r=baseScore(d);}finally{state.transport=original;delete window.__HZ_MM_SELECTED;}
    const compatible=sel.includes('any')||(d.transport||[]).some(m=>sel.includes(m));const costs=calcMultimodal(d),timeOK=Number.isFinite(costs.travelHours)||costs.multimodalCandidates?.some(x=>!x.hours||x.hours<=maxHours());
    return {...r,...costs,hardExcluded:!compatible||!timeOK||r.hardExcluded,availableSelectedModes:selectedFor(d)};
  };
  if(typeof window.renderResults==='function'){
    const baseRender=window.renderResults;window.renderResults=function(){const out=baseRender.apply(this,arguments);queueMicrotask(patchResultCards);setTimeout(patchResultCards,80);return out;};
  }
  return true;
}
function fmtHours(h){if(!Number.isFinite(Number(h))||Number(h)<=0)return '—';const mins=Math.round(Number(h)*60/5)*5,hr=Math.floor(mins/60),m=mins%60;return hr?(m?`${hr}ω ${m}λ`:`${hr}ω`):`${m}λ`;}
function modeLabel(m){const x=MODE_META[m];return x?`${x.icon} ${x.label}`:m;}
function patchResultCards(){
  if(typeof scored==='undefined'||!Array.isArray(scored))return;const byName=new Map(scored.map(x=>[x.name,x]));
  document.querySelectorAll('#resultsCard .destination').forEach(card=>{
    const name=card.querySelector('h4')?.textContent?.trim(),d=byName.get(name)||(window.HORIZON_DESTINATIONS||[]).find(x=>x.name===name);if(!d)return;
    const modes=selectedFor(d);const reg=card.querySelector('.region');if(reg){reg.textContent=modes.length>1?`${d.region} · ${modes.length} διαθέσιμοι τρόποι`:modes.length===1?`${d.region} · ${modeLabel(modes[0])}`:d.region;}
    let row=card.querySelector('.hz-mm-cardmodes');if(!row){row=document.createElement('div');row.className='hz-mm-cardmodes';card.querySelector('.why')?.before(row);}row.innerHTML=modes.map(m=>`<span class="hz-mm-mini">${modeLabel(m)}</span>`).join('');
    card.querySelectorAll('.actions a,.actions button').forEach(a=>{const txt=(a.textContent||'').toLowerCase();if(txt.includes('μεταφορ')||txt.includes('πτήσ'))a.textContent='Σύγκριση μεταφορών';});
  });
}
function flightCache(name){
  try{const s=stateNow(),t=people(),from=s.dates?.from||'',days=Math.max(1,Number(s.duration)||1,to=from?(()=>{const d=new Date(`${from}T12:00:00`);d.setDate(d.getDate()+Math.max(0,days-1));return d.toISOString().slice(0,10);})():'';const key=`hz-flights-v1:${[s.origin||'Αθήνα',name,from,to,t.adults,t.children,t.infants].join('|')}`;const v=JSON.parse(localStorage.getItem(key)||'null');if(!v?.data?.results?.length)return null;const prices=v.data.results.map(x=>Number(x.price)||0).filter(Boolean);if(!prices.length)return null;return {price:Math.min(...prices),results:v.data.results};}catch{return null;}
}
function comparisonRows(d,modes){
  const cached=flightCache(d.name);return modes.map(m=>{
    const meta=MODE_META[m],x=estimateMode(d,m);if(!meta||!x)return '';
    let price=x.rawCost?`~€${Number(x.rawCost).toLocaleString('el-GR')}`:'—',sourceClass='hz-mm-est',source=meta.source;
    if(m==='plane'){if(cached){price=`από €${cached.price.toLocaleString('el-GR')}`;source='Live αποτέλεσμα αποθηκευμένο από Google Flights';sourceClass='hz-mm-live';}else{price='Έλεγχος παρακάτω';source='Πραγματική τιμή μόνο μετά τον έλεγχο Google Flights';sourceClass='hz-mm-live';}}
    return `<tr><td><b>${modeLabel(m)}</b><span class="hz-mm-source ${sourceClass}">${source}</span></td><td>${x.hours?fmtHours(x.hours):m==='plane'?'Live διάρκεια':'—'}<span class="hz-mm-source">μονή διαδρομή</span></td><td><b>${price}</b><span class="hz-mm-source">${m==='car'?'σύνολο οχήματος':'για τους ταξιδιώτες · μετ’ επιστροφής'}</span></td><td>${x.note||'—'}</td></tr>`;
  }).join('');
}
function enhanceOverlay(overlay){
  if(!overlay)return;const pane=overlay.querySelector('[data-pane="transport"]'),name=overlay.querySelector('.hd-head h3')?.textContent?.trim();if(!pane||!name)return;const d=(window.HORIZON_DESTINATIONS||[]).find(x=>x.name===name);if(!d)return;
  if(pane.dataset.mmReady==='1')return;pane.dataset.mmReady='1';
  pane.querySelector(':scope > .hd-hero')?.remove();pane.querySelector(':scope > .hd-grid')?.remove();
  const available=MODE_ORDER.filter(m=>(d.transport||[]).includes(m)),preferred=selection(),initial=preferred.includes('any')?available:available.filter(m=>preferred.includes(m));const selected=new Set(initial.length?initial:available);
  const box=document.createElement('section');box.className='hz-mm-panel';box.innerHTML=`<div class="hz-mm-title">Σύγκριση τρόπων μετακίνησης</div><div class="hz-mm-copy">Επίλεξε έναν ή περισσότερους διαθέσιμους τρόπους. Οι πτήσεις μπορούν να ελεγχθούν με πραγματικές τιμές· για τρένο, λεωφορείο και πλοίο εμφανίζουμε καθαρά μόνο εκτίμηση μέχρι να συνδεθεί αξιόπιστη live πηγή.</div><div class="hz-mm-modes">${available.map(m=>`<label class="hz-mm-mode ${selected.has(m)?'selected':''}"><input type="checkbox" value="${m}" ${selected.has(m)?'checked':''}> ${modeLabel(m)}</label>`).join('')}</div><button type="button" class="hz-mm-compare">Σύγκρινε επιλεγμένα μέσα</button><div class="hz-mm-table-wrap"></div><div class="hz-mm-foot">Χρόνοι και μη αεροπορικές τιμές είναι ενδεικτικές. Δεν παρουσιάζονται ως live δεδομένα χωρίς επιβεβαιωμένο provider.</div>`;
  pane.prepend(box);
  const flightPanel=()=>pane.querySelector('.hz-flights-panel');
  const render=()=>{
    const modes=available.filter(m=>selected.has(m)),wrap=box.querySelector('.hz-mm-table-wrap'),btn=box.querySelector('.hz-mm-compare');btn.disabled=!modes.length;
    wrap.innerHTML=modes.length?`<table class="hz-mm-table"><thead><tr><th>Μέσο</th><th>Χρόνος</th><th>Τιμή</th><th>Σημείωση</th></tr></thead><tbody>${comparisonRows(d,modes)}</tbody></table>`:'<div class="hz-mm-empty">Επίλεξε τουλάχιστον έναν τρόπο μετακίνησης.</div>';
    const fp=flightPanel();if(fp)fp.style.display=selected.has('plane')?'':'none';
  };
  box.querySelectorAll('input').forEach(i=>i.addEventListener('change',()=>{i.checked?selected.add(i.value):selected.delete(i.value);i.closest('.hz-mm-mode')?.classList.toggle('selected',i.checked);render();}));
  box.querySelector('.hz-mm-compare').onclick=render;render();
  setTimeout(()=>{const fp=flightPanel();if(fp)fp.style.display=selected.has('plane')?'':'none';},120);
}
function enhanceAll(){patchResultCards();document.querySelectorAll('.horizon-detail-overlay').forEach(enhanceOverlay);}
function burst(){[0,50,140,320,700].forEach(ms=>setTimeout(enhanceAll,ms));}
function init(){installStyles();augmentDestinations();patchPlannerStep();patchScoring();patchResultCards();document.addEventListener('click',e=>{if(e.target.closest('.destination .actions a,.destination .actions button,.hd-tab,.hz-flight-search'))burst();},true);burst();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
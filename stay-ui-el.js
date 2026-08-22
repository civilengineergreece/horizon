(()=>{
'use strict';

const STYLE_ID='horizon-stay-ui-el-style';
const TYPE_KEY='horizon-stay-kind';
const MAX_FILTER_AMENITIES=12;
const MAX_CARD_AMENITIES=10;

const phraseRules=[
  [/free wi-?fi|free wifi|complimentary wi-?fi/i,'Δωρεάν Wi‑Fi'],
  [/wi-?fi|wireless internet|internet access/i,'Wi‑Fi'],
  [/free parking/i,'Δωρεάν πάρκινγκ'],
  [/parking/i,'Πάρκινγκ'],
  [/indoor pool/i,'Εσωτερική πισίνα'],
  [/outdoor pool/i,'Εξωτερική πισίνα'],
  [/swimming pool|pool/i,'Πισίνα'],
  [/breakfast included|free breakfast|complimentary breakfast/i,'Πρωινό included'.replace('included','περιλαμβάνεται')],
  [/breakfast/i,'Πρωινό'],
  [/air conditioning|air-conditioned|a\/c/i,'Κλιματισμός'],
  [/restaurant/i,'Εστιατόριο'],
  [/bar\/lounge|lounge bar/i,'Μπαρ / lounge'],
  [/bar/i,'Μπαρ'],
  [/spa/i,'Spa'],
  [/fitness center|fitness centre|gym/i,'Γυμναστήριο'],
  [/hot tub|jacuzzi/i,'Υδρομασάζ'],
  [/beach access|private beach/i,'Πρόσβαση σε παραλία'],
  [/beachfront|beach front/i,'Μπροστά στην παραλία'],
  [/pet[- ]friendly|pets allowed|allows pets/i,'Κατοικίδια επιτρέπονται'],
  [/family[- ]friendly|family friendly/i,'Κατάλληλο για οικογένειες'],
  [/kid[- ]friendly|children welcome/i,'Κατάλληλο για παιδιά'],
  [/wheelchair accessible|accessible/i,'Προσβάσιμο για ΑμεΑ'],
  [/airport shuttle|airport transfer/i,'Μεταφορά από/προς αεροδρόμιο'],
  [/shuttle service/i,'Υπηρεσία μεταφοράς'],
  [/room service/i,'Υπηρεσία δωματίου'],
  [/laundry service/i,'Υπηρεσία πλυντηρίου'],
  [/washing machine|washer/i,'Πλυντήριο ρούχων'],
  [/dryer/i,'Στεγνωτήριο'],
  [/kitchenette/i,'Μικρή κουζίνα'],
  [/kitchen/i,'Κουζίνα'],
  [/refrigerator|fridge/i,'Ψυγείο'],
  [/microwave/i,'Φούρνος μικροκυμάτων'],
  [/coffee maker|coffee machine/i,'Καφετιέρα'],
  [/tea\/coffee|tea and coffee/i,'Παροχές καφέ / τσαγιού'],
  [/balcony/i,'Μπαλκόνι'],
  [/terrace/i,'Βεράντα'],
  [/garden/i,'Κήπος'],
  [/sea view|ocean view/i,'Θέα θάλασσα'],
  [/city view/i,'Θέα πόλη'],
  [/mountain view/i,'Θέα βουνό'],
  [/non-smoking|smoke[- ]free/i,'Χώρος μη καπνιστών'],
  [/heating/i,'Θέρμανση'],
  [/elevator|lift/i,'Ανελκυστήρας'],
  [/24[- ]hour front desk|24[- ]hour reception/i,'24ωρη ρεσεψιόν'],
  [/front desk|reception/i,'Ρεσεψιόν'],
  [/concierge/i,'Concierge'],
  [/business center|business centre/i,'Business center'],
  [/meeting room|conference room/i,'Αίθουσα συναντήσεων'],
  [/ev charger|electric vehicle charging|ev charging/i,'Φόρτιση ηλεκτρικού οχήματος'],
  [/bike rental|bicycle rental/i,'Ενοικίαση ποδηλάτου'],
  [/car rental/i,'Ενοικίαση αυτοκινήτου'],
  [/crib|cot/i,'Βρεφική κούνια'],
  [/high chair/i,'Παιδικό καρεκλάκι'],
  [/fireplace/i,'Τζάκι'],
  [/bbq|barbecue/i,'Μπάρμπεκιου'],
  [/security|24[- ]hour security/i,'Ασφάλεια'],
  [/safe|safety deposit box/i,'Χρηματοκιβώτιο'],
  [/desk|workspace/i,'Χώρος εργασίας'],
  [/tv|television/i,'Τηλεόραση'],
  [/soundproof/i,'Ηχομόνωση'],
  [/all inclusive/i,'All inclusive'],
  [/water park/i,'Υδάτινο πάρκο'],
  [/kids club/i,'Παιδικό club'],
  [/playground/i,'Παιδική χαρά'],
  [/sauna/i,'Σάουνα'],
  [/massage/i,'Μασάζ'],
  [/tennis/i,'Γήπεδο τένις'],
  [/golf/i,'Γκολφ'],
  [/ski storage/i,'Χώρος φύλαξης σκι'],
  [/ski[- ]in\/ski[- ]out/i,'Άμεση πρόσβαση σε πίστα σκι']
];

function installStyles(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement('style');
  s.id=STYLE_ID;
  s.textContent=`
    .hz-kind-box{margin:0 0 14px;padding:12px;border:1px solid rgba(255,255,255,.09);border-radius:13px;background:rgba(5,16,26,.38)}
    .hz-kind-box label{display:block;color:#8fa3b2;font-size:.7rem;margin-bottom:5px}.hz-kind-select{width:100%;border:1px solid rgba(255,255,255,.12);background:#0b1d2b;color:#fff;border-radius:9px;padding:9px}
    .hz-kind-note{margin-top:7px;color:#8fa3b2;font-size:.7rem;line-height:1.4}.hz-kind-note strong{color:#ffb273}
    .hz-amenity-title{font-size:.76rem!important;color:#c6d1d8!important;font-weight:800}.hz-stay-amenities{max-width:100%}
  `;
  document.head.appendChild(s);
}

function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function hasGreek(v){return /[Α-Ωα-ωΆ-Ώά-ώ]/.test(String(v||''));}
function amenityEl(raw){
  const text=String(raw||'').trim();
  if(!text)return '';
  if(hasGreek(text))return text;
  for(const [re,label] of phraseRules){if(re.test(text))return label;}
  const lower=text.toLowerCase();
  const simple={
    'free cancellation':'Δωρεάν ακύρωση','housekeeping':'Καθαριότητα δωματίου','daily housekeeping':'Καθημερινή καθαριότητα',
    'minibar':'Μίνι μπαρ','private bathroom':'Ιδιωτικό μπάνιο','shared bathroom':'Κοινόχρηστο μπάνιο',
    'hair dryer':'Σεσουάρ','hairdryer':'Σεσουάρ','iron':'Σίδερο','ironing facilities':'Παροχές σιδερώματος',
    'wardrobe':'Ντουλάπα','air purifier':'Καθαριστής αέρα','coffee shop':'Καφέ','snack bar':'Snack bar',
    'rooftop terrace':'Ταράτσα / roof garden','roof terrace':'Ταράτσα / roof garden','private entrance':'Ιδιωτική είσοδος',
    'private pool':'Ιδιωτική πισίνα','infinity pool':'Πισίνα infinity','heated pool':'Θερμαινόμενη πισίνα',
    'wifi in public areas':'Wi‑Fi στους κοινόχρηστους χώρους','express check-in':'Γρήγορο check‑in','express check-out':'Γρήγορο check‑out'
  };
  if(simple[lower])return simple[lower];
  return `Παροχή: ${text}`;
}
function rentalItem(item){return /vacation|rental|apartment|house|home|villa|condo|cottage|studio|chalet/i.test(String(item?.type||''));}
function propertyLabel(item){
  if(rentalItem(item)){
    const t=String(item?.type||'').toLowerCase();
    if(t.includes('apartment'))return 'Διαμέρισμα / κατοικία διακοπών';
    if(t.includes('villa'))return 'Βίλα / κατοικία διακοπών';
    if(t.includes('house')||t.includes('home'))return 'Κατοικία διακοπών';
    return 'Ενοικιαζόμενη κατοικία διακοπών';
  }
  return item?.hotelClass?`${item.hotelClass}★ ξενοδοχείο`:'Ξενοδοχείο';
}
function clearBrowserStayCache(){
  try{
    const doomed=[];
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i);if(k&&k.startsWith('hz-hotel-cache-v2:'))doomed.push(k);
    }
    doomed.forEach(k=>localStorage.removeItem(k));
  }catch{}
}
function currentKind(){
  try{return localStorage.getItem(TYPE_KEY)==='rentals'?'rentals':'hotels';}catch{return 'hotels';}
}
function setKind(kind){
  const k=kind==='rentals'?'rentals':'hotels';
  window.__HORIZON_STAY_KIND__=k;
  try{localStorage.setItem(TYPE_KEY,k);}catch{}
}
function amenityCounts(items){
  const counts=new Map();
  (items||[]).forEach(item=>(item.amenities||[]).forEach(a=>{if(a)counts.set(a,(counts.get(a)||0)+1);}));
  return [...counts.entries()].sort((a,b)=>b[1]-a[1]||amenityEl(a[0]).localeCompare(amenityEl(b[0]),'el'));
}
function rebuildAmenityFilters(panel){
  const data=panel._hotelData;
  if(!data||!Array.isArray(data.results))return;
  const raw=amenityCounts(data.results).slice(0,MAX_FILTER_AMENITIES).map(x=>x[0]);
  const sig=raw.join('|');
  const chips=panel.querySelector('.hz-amenity-chips');
  if(!chips||chips.dataset.elSig===sig)return;
  chips.dataset.elSig=sig;
  panel._amenities=raw;
  chips.innerHTML=raw.map((a,i)=>`<label class="hz-amenity-chip" title="${esc(a)}"><input type="checkbox" data-amenity-index="${i}"> ${esc(amenityEl(a))}</label>`).join('');
  chips.querySelectorAll('input').forEach(input=>input.addEventListener('change',()=>{
    panel._hotelLimit=10;
    panel.querySelector('.hz-sort')?.dispatchEvent(new Event('change',{bubbles:true}));
  }));
}
function enhanceCards(panel){
  const items=Array.isArray(panel._hotelData?.results)?panel._hotelData.results:[];
  const byName=new Map(items.map(x=>[String(x.name||'').trim(),x]));
  panel.querySelectorAll('.hz-stay-card').forEach(card=>{
    const name=card.querySelector('.hz-stay-name')?.textContent?.trim();
    const item=byName.get(name);if(!item)return;
    const type=card.querySelector('.hz-stay-type');if(type)type.textContent=propertyLabel(item);
    let box=card.querySelector('.hz-stay-amenities');
    const list=(item.amenities||[]).slice(0,MAX_CARD_AMENITIES);
    if(list.length){
      if(!box){box=document.createElement('div');box.className='hz-stay-amenities';card.querySelector('.hz-stay-meta')?.after(box);}
      const sig=list.join('|');
      if(box.dataset.elSig!==sig){box.dataset.elSig=sig;box.innerHTML=list.map(a=>`<span title="${esc(a)}">${esc(amenityEl(a))}</span>`).join('');}
    }
  });
}
function ensureKindBox(panel){
  if(panel.querySelector('.hz-kind-box'))return;
  const btn=panel.querySelector('.hz-stay-load');if(!btn)return;
  const box=document.createElement('div');
  box.className='hz-kind-box';
  box.innerHTML=`<label>Τύπος διαμονής</label><select class="hz-kind-select"><option value="hotels">Ξενοδοχεία</option><option value="rentals">Διαμερίσματα & κατοικίες διακοπών</option></select><div class="hz-kind-note"></div>`;
  btn.before(box);
  const select=box.querySelector('.hz-kind-select');
  select.value=currentKind();setKind(select.value);
  const updateNote=()=>{
    const rentals=select.value==='rentals';
    box.querySelector('.hz-kind-note').innerHTML=rentals?'<strong>Vacation rentals:</strong> live κατοικίες/διαμερίσματα από Google Hotels. Δεν πρόκειται για απευθείας Airbnb API.':'Live ξενοδοχεία από Google Hotels.';
    const stars=panel.querySelector('.hz-stars')?.closest('.hz-filter-field');if(stars)stars.style.display=rentals?'none':'';
  };
  updateNote();
  select.addEventListener('change',()=>{
    clearBrowserStayCache();setKind(select.value);updateNote();
    panel._hotelData=null;panel._hotelLimit=10;
    panel.querySelector('.hz-stay-results')?.replaceChildren();
    const summary=panel.querySelector('.hz-stay-summary');if(summary)summary.textContent='';
    const badge=panel.querySelector('.hz-cache-badge');if(badge){badge.classList.remove('active');badge.textContent='';}
    const filters=panel.querySelector('.hz-filters');if(filters)filters.classList.remove('active');
    btn.textContent=select.value==='rentals'?'Αναζήτηση live τιμών κατοικιών':'Αναζήτηση live τιμών ξενοδοχείων';
    const status=panel.querySelector('.hz-stay-status');if(status)status.textContent='Πάτησε αναζήτηση για τον επιλεγμένο τύπο διαμονής.';
  });
  btn.addEventListener('click',()=>setKind(select.value),true);
}
function enhancePanel(panel){
  ensureKindBox(panel);
  rebuildAmenityFilters(panel);
  enhanceCards(panel);
  const title=panel.querySelector('.hz-amenity-title');if(title)title.textContent='Παροχές (στα ελληνικά)';
  const select=panel.querySelector('.hz-kind-select');
  const stars=panel.querySelector('.hz-stars')?.closest('.hz-filter-field');if(stars&&select)stars.style.display=select.value==='rentals'?'none':'';
}
function refresh(){document.querySelectorAll('.hz-hotels-panel').forEach(enhancePanel);}
function init(){installStyles();setKind(currentKind());new MutationObserver(refresh).observe(document.body,{childList:true,subtree:true});refresh();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

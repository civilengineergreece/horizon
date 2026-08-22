(()=>{
'use strict';

const TYPE_KEY='horizon-stay-kind';
const watched=new WeakMap();
const translations=[
  [/free wi-?fi|complimentary wi-?fi/i,'Δωρεάν Wi‑Fi'],[/wi-?fi|wireless internet|internet access/i,'Wi‑Fi'],
  [/free parking/i,'Δωρεάν πάρκινγκ'],[/parking/i,'Πάρκινγκ'],[/indoor pool/i,'Εσωτερική πισίνα'],
  [/outdoor pool/i,'Εξωτερική πισίνα'],[/swimming pool|pool/i,'Πισίνα'],[/breakfast included|free breakfast|complimentary breakfast/i,'Πρωινό περιλαμβάνεται'],
  [/breakfast/i,'Πρωινό'],[/air conditioning|air-conditioned|a\/c/i,'Κλιματισμός'],[/restaurant/i,'Εστιατόριο'],
  [/bar\/lounge|lounge bar/i,'Μπαρ / lounge'],[/bar/i,'Μπαρ'],[/spa/i,'Spa'],[/fitness center|fitness centre|gym/i,'Γυμναστήριο'],
  [/hot tub|jacuzzi/i,'Υδρομασάζ'],[/beach access|private beach/i,'Πρόσβαση σε παραλία'],[/beachfront|beach front/i,'Μπροστά στην παραλία'],
  [/pet[- ]friendly|pets allowed|allows pets/i,'Κατοικίδια επιτρέπονται'],[/family[- ]friendly|family friendly/i,'Κατάλληλο για οικογένειες'],
  [/kid[- ]friendly|children welcome/i,'Κατάλληλο για παιδιά'],[/wheelchair accessible|accessible/i,'Προσβάσιμο για ΑμεΑ'],
  [/airport shuttle|airport transfer/i,'Μεταφορά από/προς αεροδρόμιο'],[/shuttle service/i,'Υπηρεσία μεταφοράς'],
  [/room service/i,'Υπηρεσία δωματίου'],[/laundry service/i,'Υπηρεσία πλυντηρίου'],[/washing machine|washer/i,'Πλυντήριο ρούχων'],
  [/dryer/i,'Στεγνωτήριο'],[/kitchenette/i,'Μικρή κουζίνα'],[/kitchen/i,'Κουζίνα'],[/refrigerator|fridge/i,'Ψυγείο'],
  [/microwave/i,'Φούρνος μικροκυμάτων'],[/coffee maker|coffee machine/i,'Καφετιέρα'],[/tea\/coffee|tea and coffee/i,'Παροχές καφέ / τσαγιού'],
  [/balcony/i,'Μπαλκόνι'],[/terrace/i,'Βεράντα'],[/garden/i,'Κήπος'],[/sea view|ocean view/i,'Θέα θάλασσα'],[/city view/i,'Θέα πόλη'],
  [/mountain view/i,'Θέα βουνό'],[/non-smoking|smoke[- ]free/i,'Χώρος μη καπνιστών'],[/heating/i,'Θέρμανση'],[/elevator|lift/i,'Ανελκυστήρας'],
  [/24[- ]hour front desk|24[- ]hour reception/i,'24ωρη ρεσεψιόν'],[/front desk|reception/i,'Ρεσεψιόν'],[/concierge/i,'Concierge'],
  [/meeting room|conference room/i,'Αίθουσα συναντήσεων'],[/ev charger|electric vehicle charging|ev charging/i,'Φόρτιση ηλεκτρικού οχήματος'],
  [/bike rental|bicycle rental/i,'Ενοικίαση ποδηλάτου'],[/car rental/i,'Ενοικίαση αυτοκινήτου'],[/crib|cot/i,'Βρεφική κούνια'],
  [/high chair/i,'Παιδικό καρεκλάκι'],[/fireplace/i,'Τζάκι'],[/bbq|barbecue/i,'Μπάρμπεκιου'],[/safe|safety deposit box/i,'Χρηματοκιβώτιο'],
  [/desk|workspace/i,'Χώρος εργασίας'],[/tv|television/i,'Τηλεόραση'],[/soundproof/i,'Ηχομόνωση'],[/water park/i,'Υδάτινο πάρκο'],
  [/kids club/i,'Παιδικό club'],[/playground/i,'Παιδική χαρά'],[/sauna/i,'Σάουνα'],[/massage/i,'Μασάζ'],[/tennis/i,'Γήπεδο τένις'],[/golf/i,'Γκολφ']
];

function hasGreek(v){return /[Α-Ωα-ωΆ-Ώά-ώ]/.test(String(v||''));}
function translate(raw){
  const text=String(raw||'').trim();if(!text||hasGreek(text))return text;
  for(const [re,label] of translations){if(re.test(text))return label;}
  return text;
}
function currentKind(){try{return localStorage.getItem(TYPE_KEY)==='rentals'?'rentals':'hotels';}catch{return 'hotels';}}
function setKind(kind){const k=kind==='rentals'?'rentals':'hotels';window.__HORIZON_STAY_KIND__=k;try{localStorage.setItem(TYPE_KEY,k);}catch{}}
function clearStayCache(){try{const keys=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith('hz-hotel-cache-v2:'))keys.push(k);}keys.forEach(k=>localStorage.removeItem(k));}catch{}}
function ensureStyle(){
  if(document.getElementById('horizon-stay-ui-safe-style'))return;
  const s=document.createElement('style');s.id='horizon-stay-ui-safe-style';s.textContent=`
  .hz-kind-box{margin:0 0 14px;padding:12px;border:1px solid rgba(255,255,255,.09);border-radius:13px;background:rgba(5,16,26,.38)}
  .hz-kind-box label{display:block;color:#8fa3b2;font-size:.7rem;margin-bottom:5px}.hz-kind-select{width:100%;border:1px solid rgba(255,255,255,.12);background:#0b1d2b;color:#fff;border-radius:9px;padding:9px}
  .hz-kind-note{margin-top:7px;color:#8fa3b2;font-size:.7rem;line-height:1.4}.hz-kind-note strong{color:#ffb273}`;document.head.appendChild(s);
}
function propertyLabel(item){
  const t=String(item?.type||'').toLowerCase();
  if(/vacation|rental|apartment|house|home|villa|condo|cottage|studio|chalet/.test(t)){
    if(t.includes('apartment')||t.includes('studio'))return 'Διαμέρισμα / κατοικία διακοπών';
    if(t.includes('villa'))return 'Βίλα / κατοικία διακοπών';
    return 'Κατοικία διακοπών';
  }
  return item?.hotelClass?`${item.hotelClass}★ ξενοδοχείο`:'Ξενοδοχείο';
}
function enhance(panel){
  if(!panel?.isConnected)return;
  let box=panel.querySelector('.hz-kind-box');
  if(!box){
    const btn=panel.querySelector('.hz-stay-load');
    if(btn){
      box=document.createElement('div');box.className='hz-kind-box';
      box.innerHTML='<label>Τύπος διαμονής</label><select class="hz-kind-select"><option value="hotels">Ξενοδοχεία</option><option value="rentals">Διαμερίσματα & κατοικίες διακοπών</option></select><div class="hz-kind-note"></div>';
      btn.before(box);
      const select=box.querySelector('select');select.value=currentKind();setKind(select.value);
      const note=()=>{box.querySelector('.hz-kind-note').innerHTML=select.value==='rentals'?'<strong>Κατοικίες διακοπών:</strong> live διαμερίσματα/σπίτια από Google Hotels. Δεν εμφανίζονται ως Airbnb αν δεν προέρχονται από Airbnb.':'Live ξενοδοχεία μέσα στο Horizon.';};note();
      select.addEventListener('change',()=>{setKind(select.value);clearStayCache();note();panel.querySelector('.hz-stay-results')?.replaceChildren();const filters=panel.querySelector('.hz-filters');if(filters)filters.classList.remove('active');const status=panel.querySelector('.hz-stay-status');if(status)status.textContent='Ο τύπος διαμονής άλλαξε. Πάτησε αναζήτηση για νέες live τιμές.';const load=panel.querySelector('.hz-stay-load');if(load)load.textContent='Αναζήτηση live τιμών μέσα στο Horizon';});
    }
  }
  const title=panel.querySelector('.hz-amenity-title');if(title&&title.textContent!=='Παροχές (στα ελληνικά)')title.textContent='Παροχές (στα ελληνικά)';
  const items=Array.isArray(panel._hotelData?.results)?panel._hotelData.results:[];
  const byName=new Map(items.map(x=>[String(x.name||'').trim(),x]));
  panel.querySelectorAll('.hz-stay-card').forEach(card=>{
    const name=card.querySelector('.hz-stay-name')?.textContent?.trim();const item=byName.get(name);
    if(item){const type=card.querySelector('.hz-stay-type');const label=propertyLabel(item);if(type&&type.textContent!==label)type.textContent=label;}
    card.querySelectorAll('.hz-stay-amenities span').forEach(span=>{
      if(span.dataset.hzEl==='1')return;const raw=span.textContent||'';const el=translate(raw);if(el!==raw)span.textContent=el;span.dataset.hzEl='1';
    });
  });
  panel.querySelectorAll('.hz-amenity-chip').forEach(label=>{
    if(label.dataset.hzEl==='1')return;
    const input=label.querySelector('input');
    const raw=[...label.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join(' ').trim();
    const text=translate(raw);
    [...label.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).forEach(n=>n.remove());
    label.append(document.createTextNode(` ${text}`));label.dataset.hzEl='1';
    if(input)input.title=raw;
  });
}
function watch(panel){
  if(!panel||watched.has(panel))return;
  let scheduled=false;
  const obs=new MutationObserver(()=>{
    if(scheduled)return;scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;obs.disconnect();enhance(panel);obs.observe(panel,{childList:true,subtree:true});});
  });
  watched.set(panel,obs);enhance(panel);obs.observe(panel,{childList:true,subtree:true});
}
function attach(){ensureStyle();setKind(currentKind());document.querySelectorAll('.hz-hotels-panel').forEach(watch);}
window.HorizonStayUiSafe={attach};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',attach,{once:true});else attach();
})();

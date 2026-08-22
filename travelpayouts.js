(()=>{
'use strict';

const WL_ID='21163';
const STYLE_ID='horizon-travelpayouts-style';
const SOFT_BG='#EAF0F3';
const SOFT_BG_2='#F2F5F6';
const SOFT_BORDER='#C8D4DA';
let root=null;
let loaded=false;
let activeSearch='';

function travelState(){return typeof state!=='undefined'&&state?state:{};}
function scoredByName(name){return (typeof scored!=='undefined'&&Array.isArray(scored)?scored:[]).find(d=>d.name===name)||{};}
function normalizePlace(v){return String(v||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ');}

const IATA={
  'αθηνα':'ATH','athens':'ATH','athina':'ATH','ath':'ATH',
  'θεσσαλονικη':'SKG','thessaloniki':'SKG','skg':'SKG',
  'τιρανα':'TIA','tirana':'TIA','tia':'TIA',
  'σοφια':'SOF','sofia':'SOF','sof':'SOF',
  'σκοπια':'SKP','skopje':'SKP','skp':'SKP',
  'σαραγεβο':'SJJ','sarajevo':'SJJ','sjj':'SJJ',
  'ζαγκρεμπ':'ZAG','zagreb':'ZAG','zag':'ZAG',
  'ντουμπροβνικ':'DBV','dubrovnik':'DBV','dbv':'DBV',
  'σπλιτ':'SPU','split':'SPU','spu':'SPU',
  'κοτορ':'TIV','kotor':'TIV',
  'μπουντβα':'TIV','budva':'TIV',
  'βουκουρεστι':'BUH','bucharest':'BUH','buh':'BUH',
  'βελιγραδι':'BEG','belgrade':'BEG','beg':'BEG',
  'λιουμπλιανα':'LJU','ljubljana':'LJU','lju':'LJU',
  'λιμνη μπλεντ':'LJU','bled':'LJU',
  'ιωαννινα':'IOA','ioannina':'IOA','ioa':'IOA',
  'καλαματα':'KLX','kalamata':'KLX','klx':'KLX',
  'ροδος':'RHO','rhodes':'RHO','rho':'RHO',
  'κερκυρα':'CFU','corfu':'CFU','cfu':'CFU',
  'σαντορινη':'JTR','santorini':'JTR','jtr':'JTR',
  'μυκονος':'JMK','mykonos':'JMK','jmk':'JMK',
  'ναξος':'JNX','naxos':'JNX','jnx':'JNX',
  'παρος':'PAS','paros':'PAS','pas':'PAS',
  'μηλος':'MLO','milos':'MLO','mlo':'MLO',
  'χιος':'JKH','chios':'JKH','jkh':'JKH',
  'λεσβος':'MJT','mytilene':'MJT','mjt':'MJT',
  'σαμος':'SMI','samos':'SMI','smi':'SMI',
  'κως':'KGS','kos':'KGS','kgs':'KGS',
  'καρπαθος':'AOK','karpathos':'AOK','aok':'AOK',
  'σκιαθος':'JSI','skiathos':'JSI','jsi':'JSI',
  'κωνσταντινουπολη':'IST','istanbul':'IST','ist':'IST',
  'ατταλεια':'AYT','antalya':'AYT','ayt':'AYT',
  'παφος':'PFO','paphos':'PFO','pfo':'PFO',
  'παρισι':'PAR','paris':'PAR','par':'PAR',
  'λονδινο':'LON','london':'LON','lon':'LON',
  'βαρκελωνη':'BCN','barcelona':'BCN','bcn':'BCN',
  'μαδριτη':'MAD','madrid':'MAD','mad':'MAD',
  'ρωμη':'ROM','rome':'ROM','rom':'ROM',
  'μιλανο':'MIL','milan':'MIL','mil':'MIL',
  'βενετια':'VCE','venice':'VCE','vce':'VCE',
  'φλωρεντια':'FLR','florence':'FLR','flr':'FLR',
  'ναπολη':'NAP','naples':'NAP','nap':'NAP',
  'παλερμο':'PMO','palermo':'PMO','pmo':'PMO',
  'μπολονια':'BLQ','bologna':'BLQ','blq':'BLQ',
  'βιεννη':'VIE','vienna':'VIE','vie':'VIE',
  'πραγα':'PRG','prague':'PRG','prg':'PRG',
  'βουδαπεστη':'BUD','budapest':'BUD','bud':'BUD',
  'βερολινο':'BER','berlin':'BER','ber':'BER',
  'μοναχο':'MUC','munich':'MUC','muc':'MUC',
  'φρανκφουρτη':'FRA','frankfurt':'FRA','fra':'FRA',
  'αμστερνταμ':'AMS','amsterdam':'AMS','ams':'AMS',
  'βρυξελλες':'BRU','brussels':'BRU','bru':'BRU',
  'λισαβονα':'LIS','lisbon':'LIS','lis':'LIS',
  'πορτο':'OPO','porto':'OPO','opo':'OPO',
  'νικαια':'NCE','nice':'NCE','nce':'NCE',
  'μασσαλια':'MRS','marseille':'MRS','mrs':'MRS',
  'βαλενθια':'VLC','valencia':'VLC','vlc':'VLC',
  'μαλαγα':'AGP','malaga':'AGP','agp':'AGP',
  'μαγιορκα':'PMI','mallorca':'PMI','pmi':'PMI',
  'μαλτα':'MLA','malta':'MLA','mla':'MLA',
  'αλγκαρβε':'FAO','algarve':'FAO','faro':'FAO','fao':'FAO',
  'μαδερα':'FNC','madeira':'FNC','fnc':'FNC',
  'κοπεγχαγη':'CPH','copenhagen':'CPH','cph':'CPH',
  'στοκχολμη':'STO','stockholm':'STO','sto':'STO',
  'οσλο':'OSL','oslo':'OSL','osl':'OSL',
  'ελσινκι':'HEL','helsinki':'HEL','hel':'HEL',
  'ρεικιαβικ':'KEF','reykjavik':'KEF','kef':'KEF',
  'δουβλινο':'DUB','dublin':'DUB','dub':'DUB',
  'εδιμβουργο':'EDI','edinburgh':'EDI','edi':'EDI',
  'γκντανσκ':'GDN','gdansk':'GDN','gdn':'GDN',
  'βαρσοβια':'WAW','warsaw':'WAW','waw':'WAW',
  'κρακοβια':'KRK','krakow':'KRK','krk':'KRK',
  'ταλιν':'TLL','tallinn':'TLL','tll':'TLL',
  'ριγα':'RIX','riga':'RIX','rix':'RIX',
  'βιλνιους':'VNO','vilnius':'VNO','vno':'VNO',
  'ντουμπαι':'DXB','dubai':'DXB','dxb':'DXB',
  'αμπου νταμπι':'AUH','abu dhabi':'AUH','auh':'AUH',
  'μουσκατ':'MCT','muscat':'MCT','mct':'MCT',
  'ντοχα':'DOH','doha':'DOH','doh':'DOH',
  'καιρο':'CAI','cairo':'CAI','cai':'CAI',
  'μαρακες':'RAK','marrakesh':'RAK','marrakech':'RAK','rak':'RAK',
  'καζαμπλανκα':'CMN','casablanca':'CMN','cmn':'CMN',
  'τύνιδα':'TUN','τυνιδα':'TUN','tunis':'TUN','tun':'TUN',
  'κειπ ταουν':'CPT','cape town':'CPT','cpt':'CPT',
  'ζανζιβαρη':'ZNZ','zanzibar':'ZNZ','znz':'ZNZ',
  'ναιρομπι':'NBO','nairobi':'NBO','nbo':'NBO',
  'γιοχανεσμπουργκ':'JNB','johannesburg':'JNB','jnb':'JNB',
  'τοκιο':'TYO','tokyo':'TYO','tyo':'TYO',
  'σεουλ':'SEL','seoul':'SEL','sel':'SEL',
  'μπαλι':'DPS','bali':'DPS','dps':'DPS',
  'μπανγκοκ':'BKK','bangkok':'BKK','bkk':'BKK',
  'σιγκαπουρη':'SIN','singapore':'SIN','sin':'SIN',
  'κουαλα λουμπουρ':'KUL','kuala lumpur':'KUL','kul':'KUL',
  'ανοι':'HAN','hanoi':'HAN','han':'HAN',
  'χο τσι μινχ':'SGN','ho chi minh':'SGN','sgn':'SGN',
  'χονγκ κονγκ':'HKG','hong kong':'HKG','hkg':'HKG',
  'πεκινο':'BJS','beijing':'BJS','bjs':'BJS',
  'σαγκαη':'SHA','shanghai':'SHA','sha':'SHA',
  'νεα υορκη':'NYC','new york':'NYC','nyc':'NYC',
  'μαιαμι':'MIA','miami':'MIA','mia':'MIA',
  'λος αντζελες':'LAX','los angeles':'LAX','lax':'LAX',
  'σαν φρανσισκο':'SFO','san francisco':'SFO','sfo':'SFO',
  'τοροντο':'YTO','toronto':'YTO','yto':'YTO',
  'μοντρεαλ':'YMQ','montreal':'YMQ','ymq':'YMQ',
  'πολη του μεξικου':'MEX','mexico city':'MEX','mex':'MEX',
  'κανκουν':'CUN','cancun':'CUN','cun':'CUN',
  'αβανα':'HAV','havana':'HAV','hav':'HAV',
  'ριο ντε τζανειρο':'RIO','rio de janeiro':'RIO','rio':'RIO',
  'σαο παολο':'SAO','sao paulo':'SAO','sao':'SAO',
  'μπουενος αιρες':'BUE','buenos aires':'BUE','bue':'BUE',
  'λιμα':'LIM','lima':'LIM','lim':'LIM',
  'σιδνεϊ':'SYD','sydney':'SYD','syd':'SYD',
  'μελβουρνη':'MEL','melbourne':'MEL','mel':'MEL',
  'οκλαντ':'AKL','auckland':'AKL','akl':'AKL'
};

function iataFor(v){
  const raw=String(v||'').trim();
  if(/^[A-Za-z]{3}$/.test(raw))return raw.toUpperCase();
  return IATA[normalizePlace(raw)]||'';
}
function parseISO(iso){
  const m=String(iso||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return null;
  return new Date(Number(m[1]),Number(m[2])-1,Number(m[3]),12,0,0,0);
}
function isoLocal(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function addDaysISO(iso,n){const d=parseISO(iso);if(!d)return '';d.setDate(d.getDate()+n);return isoLocal(d);}
function ddmm(iso){const d=parseISO(iso);return d?`${String(d.getDate()).padStart(2,'0')}${String(d.getMonth()+1).padStart(2,'0')}`:'';}
function prettyDate(iso){const d=parseISO(iso);return d?d.toLocaleDateString('el-GR',{day:'numeric',month:'short'}):'';}
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}

function buildPrefill(name){
  const s=travelState();
  const origin=String(s.origin||'').trim();
  const originCode=iataFor(origin),destinationCode=iataFor(name);
  const departure=s.dates?.from||'';
  const days=Math.max(1,Math.floor(Number(s.duration)||1));
  const returnDate=addDaysISO(departure,days-1);
  const adults=Math.max(1,Math.floor(Number(s.travelers?.adults)||1));
  const children=Math.max(0,Math.floor(Number(s.travelers?.children)||0));
  const canPassengers=adults<=9&&children<=9;
  const code=originCode&&destinationCode&&departure&&returnDate&&canPassengers
    ?`${originCode}${ddmm(departure)}${destinationCode}${ddmm(returnDate)}${adults}${children?children:''}`:'';
  return {code,origin,originCode,destination:name,destinationCode,departure,returnDate,adults,children,flex:Number(s.dates?.flex)||0};
}

function setFlightSearch(info){
  try{
    const url=new URL(window.location.href);
    if(info?.code)url.searchParams.set('flightSearch',info.code);else url.searchParams.delete('flightSearch');
    history.replaceState(history.state,'',url.pathname+url.search+url.hash);
  }catch(e){}
}

function ensureStyles(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
    #horizon-travelpayouts{overflow:visible}
    #horizon-travelpayouts .hz-flight-class-help,#horizon-travelpayouts .hz-flight-prefill{margin:0 0 12px;padding:10px 12px;border-radius:12px;font-size:.78rem;line-height:1.5}
    #horizon-travelpayouts .hz-flight-class-help{border:1px solid rgba(255,122,22,.24);background:rgba(255,122,22,.07);color:#cbd6de}
    #horizon-travelpayouts .hz-flight-prefill{border:1px solid rgba(101,211,154,.22);background:rgba(101,211,154,.06);color:#c9d7df}
    #horizon-travelpayouts .hz-flight-class-help b,#horizon-travelpayouts .hz-flight-prefill b{color:#fff}
    #horizon-travelpayouts #tpwl-search input,
    #horizon-travelpayouts #tpwl-search textarea,
    #horizon-travelpayouts #tpwl-search select,
    #horizon-travelpayouts #tpwl-search [role="combobox"]{background:${SOFT_BG}!important;border-color:${SOFT_BORDER}!important;color:#102538!important;-webkit-text-fill-color:#102538!important}
    #horizon-travelpayouts #tpwl-search input::placeholder,
    #horizon-travelpayouts #tpwl-search textarea::placeholder{color:#70818d!important;-webkit-text-fill-color:#70818d!important;opacity:1!important}
    #horizon-travelpayouts #tpwl-search [role="listbox"],
    #horizon-travelpayouts #tpwl-search [role="option"],
    #horizon-travelpayouts #tpwl-search [role="dialog"]{color:#102538!important;background:${SOFT_BG_2}!important;border-color:${SOFT_BORDER}!important}
    #horizon-travelpayouts #tpwl-search [role="option"] *{color:#102538!important;-webkit-text-fill-color:#102538!important}
  `;
  document.head.appendChild(style);
}

function nearWhite(bg){
  const m=String(bg||'').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);if(!m)return false;
  return Number(m[1])>=245&&Number(m[2])>=245&&Number(m[3])>=245;
}
function softenBrightSurfaces(){
  if(!root||root.style.display==='none')return;
  [root.querySelector('#tpwl-search'),root.querySelector('#tpwl-tickets')].filter(Boolean).forEach(box=>{
    box.querySelectorAll('*').forEach(el=>{
      try{if(nearWhite(getComputedStyle(el).backgroundColor))el.style.setProperty('background-color',SOFT_BG,'important');}catch(e){}
    });
  });
  document.querySelectorAll('[role="listbox"],[role="dialog"]').forEach(el=>{
    try{if(nearWhite(getComputedStyle(el).backgroundColor))el.style.setProperty('background-color',SOFT_BG_2,'important');}catch(e){}
  });
}

function isPlaneOverlay(overlay,name){
  const d=scoredByName(name);
  const mode=d.transportMode||travelState().transport;
  if(mode==='plane')return true;
  const txt=(overlay?.textContent||'').toLowerCase();
  return txt.includes('αεροπλάνο')||txt.includes('αεροπορικά');
}

function createRoot(pane){
  if(root)return root;
  ensureStyles();
  root=document.createElement('section');
  root.id='horizon-travelpayouts';
  root.className='hd-section';
  root.style.marginTop='22px';
  root.innerHTML=`
    <h4 style="margin:0 0 6px">Πραγματικές πτήσεις</h4>
    <div class="hd-note" style="margin-bottom:10px">Σύγκρινε διαθέσιμες πτήσεις και low-cost επιλογές χωρίς να φύγεις από το Horizon. Η τελική αγορά ολοκληρώνεται στον πάροχο του εισιτηρίου.</div>
    <div class="hz-flight-prefill"></div>
    <div class="hz-flight-class-help"><b>Κατηγορία θέσης:</b> «Οικονομία» = Οικονομική θέση (Economy). Από το ίδιο πεδίο μπορείς να επιλέξεις Business, Comfort/Premium Economy ή First Class, όπου διατίθενται.</div>
    <div id="tpwl-search"></div>
    <div id="tpwl-tickets"></div>`;
  pane.appendChild(root);
  return root;
}

function updatePrefillNote(info){
  const note=root?.querySelector('.hz-flight-prefill');if(!note)return;
  if(info.code){
    const people=info.adults+info.children;
    note.innerHTML=`<b>Συμπληρώθηκε από το Horizon:</b> ${esc(info.origin)} (${info.originCode}) → ${esc(info.destination)} (${info.destinationCode}) · ${esc(prettyDate(info.departure))} → ${esc(prettyDate(info.returnDate))} · ${people} ${people===1?'ταξιδιώτης':'ταξιδιώτες'}${info.flex?` · ιδανική αναχώρηση με ευελιξία ±${info.flex} ημ.`:''}.`+(info.children?`<br><span style="color:#9fb0bb">Τα παιδιά περνούν αρχικά ως 2–11 ετών. Αν υπάρχει βρέφος κάτω των 2, άλλαξέ το στο πεδίο επιβατών.</span>`:'');
  }else{
    const missing=[];if(!info.originCode)missing.push('αεροδρόμιο αφετηρίας');if(!info.destinationCode)missing.push('αεροδρόμιο προορισμού');if(!info.departure)missing.push('ημερομηνία');if(info.adults>9||info.children>9)missing.push('αριθμός επιβατών');
    note.innerHTML=`<b>Έλεγχος στοιχείων:</b> δεν έγινε αυτόματη προ-συμπλήρωση επειδή δεν έχουμε ασφαλή αντιστοίχιση για ${esc(missing.join(', ')||'τη διαδρομή')}. Συμπλήρωσέ το μία φορά στη φόρμα.`;
  }
}

function loadWhiteLabel(){
  if(loaded||document.querySelector('script[data-horizon-tpwl]')){loaded=true;return;}
  loaded=true;
  const s=document.createElement('script');
  s.async=true;
  s.type='module';
  s.src=`https://tpscr.com/wl_web/main.js?wl_id=${WL_ID}`;
  s.dataset.horizonTpwl='1';
  s.onload=()=>{let n=0;const t=setInterval(()=>{softenBrightSurfaces();if(++n>=25)clearInterval(t);},250);};
  s.onerror=()=>{
    const note=root?.querySelector('.hd-note');
    if(note)note.insertAdjacentHTML('afterend','<div class="hd-note" style="color:#ffb1a3">Η υπηρεσία πτήσεων δεν φόρτωσε. Δοκίμασε ανανέωση της σελίδας.</div>');
  };
  document.head.appendChild(s);
}

function mount(overlay){
  if(!overlay)return false;
  const name=overlay.querySelector('.hd-head h3')?.textContent?.trim();
  if(!name||!isPlaneOverlay(overlay,name))return false;
  const pane=overlay.querySelector('[data-pane="transport"]');
  if(!pane)return false;
  pane.querySelectorAll('.hz-live-wrap').forEach(el=>el.remove());

  const info=buildPrefill(name);
  const r=createRoot(pane);
  if(r.parentElement!==pane)pane.appendChild(r);
  r.style.display='block';
  updatePrefillNote(info);

  if(!loaded){
    activeSearch=info.code||'';
    setFlightSearch(info);
    loadWhiteLabel();
  }else if(info.code&&activeSearch&&info.code!==activeSearch){
    const note=r.querySelector('.hz-flight-prefill');
    if(note)note.insertAdjacentHTML('beforeend','<br><span style="color:#ffd27a">Άλλαξες προορισμό μετά τη φόρτωση της αναζήτησης. Κάνε μία ανανέωση της σελίδας για νέα αυτόματη προ-συμπλήρωση.</span>');
    setFlightSearch(info);
  }
  setTimeout(softenBrightSurfaces,100);
  return true;
}

function refresh(){
  const overlays=[...document.querySelectorAll('.horizon-detail-overlay')];
  const mounted=overlays.some(mount);
  if(!mounted&&root)root.style.display='none';
}

function init(){
  ensureStyles();
  const obs=new MutationObserver(()=>{refresh();softenBrightSurfaces();});
  obs.observe(document.body,{childList:true,subtree:true});
  refresh();
  let tries=0;
  const timer=setInterval(()=>{refresh();softenBrightSurfaces();if(++tries>=20)clearInterval(timer);},500);
}

window.HorizonTravelpayouts={wlId:WL_ID,refresh,buildPrefill};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

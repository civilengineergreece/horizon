(()=>{
'use strict';
const STYLE_ID='horizon-estimate-truth-style',FLIGHT_CACHE_PREFIX='hz-flights-v2:',FLIGHT_CACHE_TTL=30*60*1000;
function installStyles(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
  .hz-estimate-warning{margin:14px 0 18px;padding:12px 14px;border:1px solid rgba(255,122,22,.34);border-radius:13px;background:rgba(255,122,22,.09);color:#ffd2ad;font-size:.84rem;line-height:1.5}.hz-estimate-warning b{color:#fff}.hz-live-action{border-color:rgba(101,211,154,.35)!important}.hz-live-value{color:#8ae5b5!important}.hz-await-live{color:#ffd27a!important;font-size:.8rem!important}`;
  document.head.appendChild(s);
}
function stateNow(){return typeof state!=='undefined'&&state?state:{};}
function addDays(iso,n){const d=new Date(`${iso}T12:00:00`);d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);}
function travelers(){const t=stateNow().travelers||{};return {adults:Math.max(1,Number(t.adults)||1),children:Math.max(0,Number(t.children)||0),infants:Math.max(0,Number(t.infants)||0)};}
function flightDates(){const s=stateNow(),from=s.dates?.from||'',days=Math.max(1,Number(s.duration)||1);return {from,to:s.dates?.oneWay?'':from?addDays(from,Math.max(0,days-1)):''};}
function flightCacheKey(name){const s=stateNow(),t=travelers(),d=flightDates(),origin=s.origin||'Αθήνα';return `${FLIGHT_CACHE_PREFIX}${[origin,name,d.from,d.to,t.adults,t.children,t.infants].join('|')}`;}
function cachedLiveFare(name){
  try{
    const key='hz-flight-selection-v2:'+flightCacheKey(name),v=JSON.parse(localStorage.getItem(key)||'null');
    if(!v||!Number.isFinite(Number(v.editedAt))||Number(v.editedAt)<=0||Date.now()-Number(v.at||0)>FLIGHT_CACHE_TTL)return null;
    const expectedReturn=flightDates().to;
    if((expectedReturn&&v.scope!=='roundtrip')||(!expectedReturn&&v.scope!=='oneway'))return null;
    return Number(v.fare)>0?{fare:Number(v.fare),extras:Math.max(0,Number(v.extras)||0),scope:v.scope}:null;
  }catch{return null;}
}
function cachedSelectedStay(name){
  const t=travelers(),d=flightDates(),key='hz-hotel-selection-v1:'+
    [name,d.from,d.to,t.adults,t.children,t.infants].join('|');
  try{
    const v=JSON.parse(localStorage.getItem(key)||'null');
    if(!v||!Number.isFinite(Number(v.editedAt))||Number(v.editedAt)<=0||
      Date.now()-Number(v.at||0)>FLIGHT_CACHE_TTL||Number(v.at||0)>Date.now()+30000||!(Number(v.total)>0))return null;
    if(v.currency!=='EUR')return null;
    if(v.bookingStatus==='checkout_user_reported_not_booked'){
      const checked=Number(v.checkoutAt);
      if(!Number.isFinite(checked)||checked> Date.now()+30000||
         Date.now()-checked>FLIGHT_CACHE_TTL||v.reviewEvidence!=='manual_seller_checkout'||
         v.checkoutReviewValid!==true||Number(v.total)!==Number(v.userCheckoutTotal))return null;
      return {...v,isUserReported:true};
    }
    if(v.bookingStatus!=='quote_only_not_checked_out')return null;
    return {...v,isUserReported:false};
  }catch{return null;}
}
function applyStayBreak(card,r,stay){
  const stayBox=[...card.querySelectorAll('.break')].find(x=>/διαμον/i.test(x.querySelector('span')?.textContent||''));
  if(!stayBox)return;
  const label=stayBox.querySelector('span'),value=stayBox.querySelector('b');
  if(stay){
    label.textContent=stay.isUserReported?'Διαμονή (δηλωμένο checkout · όχι ανεξάρτητη επαλήθευση)':'Επιλεγμένη διαμονή (τιμή πηγής)';
    value.textContent=euro(stay.total);
    value.classList.add('hz-live-value');
    value.title=stay.isUserReported?
      'Το ποσό καταχωρίστηκε χειροκίνητα μετά από έλεγχο του πωλητή. Δεν επαληθεύτηκε ανεξάρτητα από το Horizon και δεν έγινε κράτηση.':
      stay.taxStatus==='provider_reports_after_taxes_fees'?
      'Η πηγή δηλώνει συμπερίληψη φόρων. Το τέλος ανθεκτικότητας μπορεί να χρεώνεται χωριστά: '+
      (stay.possibleClimateFeeEUR===null?'άγνωστο':euro(stay.possibleClimateFeeEUR))+'.':
      'Φόροι και επιβαρύνσεις ενδέχεται να προστίθενται στην τελική τιμή. Πιθανό τέλος ανθεκτικότητας: '+
      (stay.possibleClimateFeeEUR===null?'άγνωστο':euro(stay.possibleClimateFeeEUR))+'.';
  }else{
    label.textContent='Εκτίμηση διαμονής';
    value.textContent=euro(r.accommodation);
    value.classList.remove('hz-live-value');
    value.title='';
  }
}
function patchGroundCardStay(card,name){
  const stay=cachedSelectedStay(name),r=scoredByName(name);
  if(!stay||!r)return false;
  applyStayBreak(card,r,stay);
  const total=Math.max(0,Number(r.total)-Number(r.accommodation)+Number(stay.total));
  const cost=card.querySelector('.cost'),remaining=card.querySelector('.cost-head .tiny');
  if(cost)cost.innerHTML=`~${euro(total)} <span>${stay.isUserReported?'με χειροκίνητα δηλωμένο checkout':'με επιλεγμένη διαμονή'} + ενδεικτικά λοιπά</span>`;
  if(remaining){
    const delta=Number(stateNow().budget?.amount||0)-total;
    remaining.dataset.truth='1';
    remaining.textContent=delta>=0?`Με επιλεγμένη διαμονή: μένουν ${euro(delta)}`:
      `Με επιλεγμένη διαμονή: +${euro(-delta)} πάνω από budget`;
  }
  return true;
}
function scoredByName(name){return (typeof scored!=='undefined'&&Array.isArray(scored)?scored:[]).find(x=>x.name===name)||null;}
function destinationByName(name){return (window.HORIZON_DESTINATIONS||[]).find(x=>x.name===name)||{};}
function isPlaneCard(name){
  const s=stateNow(),r=scoredByName(name),d=destinationByName(name);
  if(s.transport==='plane'||r?.transportMode==='plane'||r?.transportDetails?.mode==='plane')return true;
  return Array.isArray(d.transport)&&d.transport.length===1&&d.transport[0]==='plane';
}
function euro(n){return `€${(Number(n)||0).toLocaleString('el-GR',{minimumFractionDigits:2,maximumFractionDigits:2})}`;}
function patchPlaneAmounts(card,name){
  if(!isPlaneCard(name))return false;
  const r=scoredByName(name);if(!r)return true;
  const breaks=[...card.querySelectorAll('.break')],transportBox=breaks.find(x=>/μεταφορ/i.test(x.querySelector('span')?.textContent||''));
  const selection=cachedLiveFare(name),fare=selection?.fare||null,extras=selection?.extras||0,
    stay=cachedSelectedStay(name),cost=card.querySelector('.cost'),remaining=card.querySelector('.cost-head .tiny');
  applyStayBreak(card,r,stay);
  const estimatedTransport=Number(r.transport)||0,originalStay=Number(r.accommodation)||0,
    baseWithoutTransport=Math.max(0,(Number(r.total)||0)-estimatedTransport),
    otherCostsWithStay=Math.max(0,baseWithoutTransport-originalStay+(stay?Number(stay.total):originalStay)),
    budget=Number(stateNow().budget?.amount)||0,
    includeTransport=stateNow().budget?.transport!=='no';
  if(transportBox){
    const label=transportBox.querySelector('span'),value=transportBox.querySelector('b');
    if(fare){if(label)label.textContent='Επιλεγμένη αεροπορική μεταφορά';if(value){value.textContent=euro(fare+extras);value.classList.add('hz-live-value');}}
    else{if(label)label.textContent='Μεταφορά';if(value){value.textContent='Live τιμή →';value.classList.add('hz-await-live');}}
  }
  if(fare){
    const liveTotal=Math.round((otherCostsWithStay+(includeTransport?fare+extras:0))*100)/100;
    if(cost)cost.innerHTML=`~${euro(liveTotal)} <span>${includeTransport?'με επιλεγμένη πτήση + ': 'πτήσεις εκτός budget · '}${stay?(stay.isUserReported?'δηλωμένο checkout (όχι επαληθευμένο) + ':'επιλεγμένη διαμονή + '):''}ενδεικτικά λοιπά</span>`;
    if(remaining){const diff=budget-liveTotal;remaining.dataset.truth='1';remaining.textContent=diff>=0?`Με επιλεγμένη πτήση: μένουν ${euro(diff)}`:`Με επιλεγμένη πτήση: +${euro(Math.abs(diff))} πάνω από budget`;}
  }else{
    if(cost)cost.innerHTML=`~${euro(otherCostsWithStay)} <span>${stay?'επιλεγμένη διαμονή + ':''}ενδεικτικά λοιπά · δεν έχει επιλεγεί πτήση</span>`;
    if(remaining){remaining.dataset.truth='1';remaining.textContent='Το συνολικό κόστος ενημερώνεται με τη live πτήση';}
  }
  return true;
}
function patch(){
  const root=document.getElementById('resultsCard');if(!root||root.classList.contains('hidden'))return;
  const intro=[...root.querySelectorAll('p.muted')][0];
  if(intro&&!root.querySelector('.hz-estimate-warning')){
    const w=document.createElement('div');w.className='hz-estimate-warning';w.innerHTML='<b>Σημαντικό:</b> για αεροπορικούς προορισμούς δεν εμφανίζουμε πλέον ψεύτικη εκτίμηση εισιτηρίου. Η κάρτα δείχνει το ενδεικτικό κόστος των λοιπών εξόδων. Το αεροπορικό ποσό ενημερώνεται μόνο όταν επιλέξεις πλήρη συνδυασμό αναχώρησης και επιστροφής (ή απλή μετάβαση). Ενδέχεται να υπάρχουν πρόσθετες επιβαρύνσεις. Οι τιμές διαμονής γίνονται live από το αντίστοιχο κουμπί.';intro.after(w);
  }
  const sort=document.getElementById('sortResults');if(sort){const o=[...sort.options].find(x=>x.value==='cheap');if(o)o.textContent='Χαμηλότερη εκτίμηση';}
  root.querySelectorAll('.destination').forEach(card=>{
    const name=card.querySelector('h4')?.textContent?.trim()||'';
    const plane=patchPlaneAmounts(card,name);
    if(!plane){
      const staySelected=patchGroundCardStay(card,name);
      const cost=card.querySelector('.cost span');if(cost&&!staySelected)cost.textContent='ενδεικτικό budget model · όχι live';
      const remaining=card.querySelector('.cost-head .tiny');if(remaining&&!remaining.dataset.truth){remaining.dataset.truth='1';remaining.textContent=`Ενδεικτικά: ${remaining.textContent}`;}
      [...card.querySelectorAll('.break span')].forEach(el=>{const t=el.textContent.trim();if(/επιλεγμένη διαμονή/i.test(t))return;if(!/^Εκτίμηση /.test(t))el.textContent=`Εκτίμηση ${t.toLowerCase()}`;});
    }
    card.querySelectorAll('.actions a').forEach(a=>{
      const t=a.textContent.trim().toLowerCase();
      if(t.includes('διαμον')){a.textContent='Live διαμονή';a.classList.add('hz-live-action');}
      else if(t.includes('μεταφορ')){a.textContent='Live μεταφορά';a.classList.add('hz-live-action');}
    });
  });
}
function install(){
  installStyles();
  document.addEventListener('horizon:live-flight-price',()=>setTimeout(patch,0));
  document.addEventListener('horizon:live-stay-selected',()=>setTimeout(patch,0));
  if(window.__HORIZON_RESULTS_TRUTH__){patch();return true;}
  if(typeof window.renderResults!=='function')return false;
  window.__HORIZON_RESULTS_TRUTH__=true;
  const base=window.renderResults;window.renderResults=function(){const out=base.apply(this,arguments);queueMicrotask(patch);return out;};
  patch();setTimeout(patch,0);return true;
}
let tries=0;(function boot(){if(install())return;if(++tries<40)setTimeout(boot,50);})();
})();

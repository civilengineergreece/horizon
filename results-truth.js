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
function flightDates(){const s=stateNow(),from=s.dates?.from||'',days=Math.max(1,Number(s.duration)||1);return {from,to:from?addDays(from,Math.max(0,days-1)):''};}
function flightCacheKey(name){const s=stateNow(),t=travelers(),d=flightDates(),origin=s.origin||'Αθήνα';return `${FLIGHT_CACHE_PREFIX}${[origin,name,d.from,d.to,t.adults,t.children,t.infants].join('|')}`;}
function cachedLiveFare(name){
  try{
    const key='hz-flight-selection-v2:'+flightCacheKey(name),v=JSON.parse(localStorage.getItem(key)||'null');
    if(!v||Date.now()-Number(v.at||0)>FLIGHT_CACHE_TTL)return null;
    const expectedReturn=flightDates().to;
    if((expectedReturn&&v.scope!=='roundtrip')||(!expectedReturn&&v.scope!=='oneway'))return null;
    return Number(v.fare)>0?{fare:Number(v.fare),extras:Math.max(0,Number(v.extras)||0),scope:v.scope}:null;
  }catch{return null;}
}
function scoredByName(name){return (typeof scored!=='undefined'&&Array.isArray(scored)?scored:[]).find(x=>x.name===name)||null;}
function destinationByName(name){return (window.HORIZON_DESTINATIONS||[]).find(x=>x.name===name)||{};}
function isPlaneCard(name){
  const s=stateNow(),r=scoredByName(name),d=destinationByName(name);
  if(s.transport==='plane'||r?.transportMode==='plane'||r?.transportDetails?.mode==='plane')return true;
  return Array.isArray(d.transport)&&d.transport.length===1&&d.transport[0]==='plane';
}
function euro(n){return `€${Math.round(Number(n)||0).toLocaleString('el-GR')}`;}
function patchPlaneAmounts(card,name){
  if(!isPlaneCard(name))return false;
  const r=scoredByName(name);if(!r)return true;
  const breaks=[...card.querySelectorAll('.break')],transportBox=breaks.find(x=>/μεταφορ/i.test(x.querySelector('span')?.textContent||''));
  const selection=cachedLiveFare(name),fare=selection?.fare||null,extras=selection?.extras||0,cost=card.querySelector('.cost'),remaining=card.querySelector('.cost-head .tiny');
  const estimatedTransport=Number(r.transport)||0,baseWithoutTransport=Math.max(0,(Number(r.total)||0)-estimatedTransport),budget=Number(stateNow().budget?.amount)||0;
  if(transportBox){
    const label=transportBox.querySelector('span'),value=transportBox.querySelector('b');
    if(fare){if(label)label.textContent='Επιλεγμένη αεροπορική μεταφορά';if(value){value.textContent=euro(fare+extras);value.classList.add('hz-live-value');}}
    else{if(label)label.textContent='Μεταφορά';if(value){value.textContent='Live τιμή →';value.classList.add('hz-await-live');}}
  }
  if(fare){
    const liveTotal=Math.round(baseWithoutTransport+fare+extras);
    if(cost)cost.innerHTML=`~${euro(liveTotal)} <span>με επιλεγμένη πτήση + χειροκίνητα πρόσθετα + ενδεικτικά λοιπά</span>`;
    if(remaining){const diff=budget-liveTotal;remaining.dataset.truth='1';remaining.textContent=diff>=0?`Με επιλεγμένη πτήση: μένουν ${euro(diff)}`:`Με επιλεγμένη πτήση: +${euro(Math.abs(diff))} πάνω από budget`;}
  }else{
    if(cost)cost.innerHTML=`~${euro(baseWithoutTransport)} <span>εκτίμηση λοιπών · + live μεταφορά</span>`;
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
      const cost=card.querySelector('.cost span');if(cost)cost.textContent='ενδεικτικό budget model · όχι live';
      const remaining=card.querySelector('.cost-head .tiny');if(remaining&&!remaining.dataset.truth){remaining.dataset.truth='1';remaining.textContent=`Ενδεικτικά: ${remaining.textContent}`;}
      [...card.querySelectorAll('.break span')].forEach(el=>{const t=el.textContent.trim();if(!/^Εκτίμηση /.test(t))el.textContent=`Εκτίμηση ${t.toLowerCase()}`;});
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
  if(window.__HORIZON_RESULTS_TRUTH__){patch();return true;}
  if(typeof window.renderResults!=='function')return false;
  window.__HORIZON_RESULTS_TRUTH__=true;
  const base=window.renderResults;window.renderResults=function(){const out=base.apply(this,arguments);queueMicrotask(patch);return out;};
  patch();setTimeout(patch,0);return true;
}
let tries=0;(function boot(){if(install())return;if(++tries<40)setTimeout(boot,50);})();
})();

(()=>{
'use strict';
const STYLE_ID='horizon-live-flights-style',CACHE_PREFIX='hz-flights-v2:',SELECTION_PREFIX='hz-flight-selection-v2:',CACHE_TTL=30*60*1000;
const sessions=new WeakMap();
function installStyles(){if(document.getElementById(STYLE_ID))return;const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
.hz-flights-panel{margin-top:20px;padding:16px;border:1px solid rgba(255,122,22,.28);border-radius:16px;background:rgba(5,16,26,.42)}
.hz-flights-title{font-weight:900;margin-bottom:4px}.hz-flights-copy{font-size:.8rem;color:#9fb0bd;line-height:1.45;margin-bottom:12px}
.hz-flight-form{display:grid;grid-template-columns:1fr 1fr;gap:9px}.hz-flight-field label{display:block;color:#8fa3b2;font-size:.7rem;margin-bottom:5px}.hz-flight-field input{width:100%;border:1px solid rgba(255,255,255,.12);background:#0b1d2b;color:#fff;border-radius:9px;padding:9px}
.hz-flight-summary{grid-column:1/-1;color:#b8c6cf;font-size:.76rem}.hz-flight-search{grid-column:1/-1;border:0;border-radius:10px;padding:11px 13px;background:linear-gradient(180deg,#ff8b29,#df5e08);color:#fff;font-weight:900;cursor:pointer}.hz-flight-search:disabled{opacity:.6;cursor:wait}
.hz-flight-status{margin:10px 0 0;color:#aab8c2;font-size:.78rem}.hz-flight-results{display:grid;gap:9px;margin-top:12px}.hz-flight-card{border:1px solid rgba(255,255,255,.09);background:#102638;border-radius:13px;padding:12px}.hz-flight-card-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.hz-flight-airline{font-weight:900}.hz-flight-price{font-size:1.05rem;font-weight:950;color:#fff;white-space:nowrap}.hz-flight-route{margin-top:7px;font-size:.83rem}.hz-flight-meta{margin-top:5px;color:#9fb0bd;font-size:.74rem}.hz-flight-source{margin-top:10px;color:#76d8a6;font-size:.7rem}
 .hz-flight-option{margin-top:11px;border:1px solid rgba(255,122,22,.6);background:#19364a;border-radius:9px;padding:10px;color:#fff;font-weight:800;cursor:pointer}.hz-flight-cost{margin:15px 0;padding:12px;border:1px solid rgba(101,211,154,.4);border-radius:10px}.hz-flight-note{margin-top:9px;color:#ffdfac;font-size:.74rem;line-height:1.5}.hz-flight-extras{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin:14px 0}
@media(max-width:620px){.hz-flight-form,.hz-flight-extras{grid-template-columns:1fr}.hz-flight-summary,.hz-flight-search{grid-column:1}}
`;document.head.appendChild(s);}
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function stateNow(){return typeof state!=='undefined'&&state?state:{};}
function destinationByName(name){return (window.HORIZON_DESTINATIONS||[]).find(x=>x.name===name)||{};}
function scoreByName(name){return (typeof scored!=='undefined'&&Array.isArray(scored)?scored:[]).find(x=>x.name===name)||{};}
function supportsPlane(name){const d=destinationByName(name),r=scoreByName(name);return d.transport?.includes?.('plane')||r.transportMode==='plane'||stateNow().transport==='plane';}
function addDays(iso,n){const d=new Date(`${iso}T12:00:00`);d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);}
function defaultDates(){const s=stateNow(),from=s.dates?.from||'';const days=Math.max(1,Number(s.duration)||1);return {from,to:from?addDays(from,Math.max(0,days-1)):''};}
function travelers(){const t=stateNow().travelers||{};return {adults:Math.max(1,Number(t.adults)||1),children:Math.max(0,Number(t.children)||0),infants:Math.max(0,Number(t.infants)||0)};}
function fmtDuration(mins){const n=Number(mins)||0;if(!n)return '—';const h=Math.floor(n/60),m=n%60;return h?(m?`${h}ω ${m}λ`:`${h}ω`):`${m}λ`;}
function timeOnly(v){const s=String(v||'');const m=s.match(/(\d{2}:\d{2})$/);return m?m[1]:s;}
function cacheKey(origin,dest,from,to,t){return `${CACHE_PREFIX}${[origin,dest,from,to,t.adults,t.children,t.infants].join('|')}`;}
function readCache(key){try{const v=JSON.parse(localStorage.getItem(key)||'null');if(v&&Date.now()-v.at<CACHE_TTL)return v.data;}catch{}return null;}
function writeCache(key,data){try{localStorage.setItem(key,JSON.stringify({at:Date.now(),data}));}catch{}}
function euro(n){return '€'+Number(n).toLocaleString('el-GR',{maximumFractionDigits:2});}
function amount(el){const n=Number(el?.value);return Number.isFinite(n)?Math.max(0,n):0;}
function selectionKey(key){return SELECTION_PREFIX+key;}
function clearSelection(key){try{localStorage.removeItem(selectionKey(key));}catch{}}
function route(item){return esc(item.departure?.airport||'')+' '+esc(timeOnly(item.departure?.time))+' → '+esc(item.arrival?.airport||'')+' '+esc(timeOnly(item.arrival?.time));}
function choiceCard(item,index,step,isRoundTrip){
  const price=Number(item?.price),valid=Number.isFinite(price)&&price>0;
  const airline=(item.airlines||[]).join(' + ')||'Αεροπορική',stops=Math.max(0,Number(item.stops)||0);
  const legs=Array.isArray(item.segments)?item.segments:[];
  const segments=legs.length>1?'<div class="hz-flight-meta">Σκέλη: '+legs.map(route).join(' · ')+'</div>':'';
  const label=step==='return'?'Συνδυασμός μετ’ επιστροφής':isRoundTrip?'Μόνο αναχώρηση — ΟΧΙ τελικό κόστος':'Απλή μετάβαση';
  const buttonLabel=step==='return'?'Επιλογή επιστροφής':isRoundTrip?'Επιλογή αναχώρησης και έλεγχος επιστροφών':'Επιλογή πτήσης';
  const allowed=valid&&(!isRoundTrip||step!=='outbound'||!!item.departureToken);
  return '<article class="hz-flight-card"><div class="hz-flight-card-top"><div><div class="hz-flight-airline">'+esc(airline)+'</div><div class="hz-flight-route">'+route(item)+'</div></div><div class="hz-flight-price">'+(valid?euro(price):'Χωρίς τιμή')+'</div></div><div class="hz-flight-meta">'+esc(fmtDuration(item.durationMinutes))+' · '+(stops?stops+' ανταποκρίσεις':'Απευθείας')+'</div>'+segments+'<div class="hz-flight-source">'+label+'</div>'+(allowed?'<button class="hz-flight-option" type="button" data-flight-step="'+step+'" data-flight-index="'+index+'">'+buttonLabel+'</button>':'<div class="hz-flight-note">Μη διαθέσιμη επιβεβαίωση τιμής/επιστροφής.</div>')+'</article>';
}
function renderResults(panel,data,step='outbound',cached=false){
  const items=Array.isArray(data?.results)?data.results:[];
  panel.querySelector('.hz-flight-results').innerHTML=items.map((x,i)=>choiceCard(x,i,step,!!panel.querySelector('.hz-flight-to')?.value)).join('');
  panel.querySelector('.hz-flight-status').textContent=items.length?items.length+' επιλογές'+(cached?' · προσωρινά αποθηκευμένες':'')+'. '+(step==='return'?'Επίλεξε πτήση επιστροφής.':'Επίλεξε πρώτα πτήση αναχώρησης.'):'Δεν βρέθηκαν πτήσεις για αυτά τα στοιχεία.';
}
function publish(panel,selected){
  const sess=sessions.get(panel);if(!sess||!selected)return;
  const fare=Number(selected.fare);if(!Number.isFinite(fare)||fare<=0)return;
  const baggage=amount(panel.querySelector('[data-flight-baggage]'));
  const ground=amount(panel.querySelector('[data-flight-ground]'));
  const mins=amount(panel.querySelector('[data-flight-ground-mins]'));
  const record={at:Date.now(),fare,extras:baggage+ground,estimatedTotal:fare+baggage+ground,scope:selected.scope,origin:sess.origin,destination:sess.name,from:sess.from,to:sess.to,travelers:sess.travelers,baggage,ground,groundMinutesEachWay:mins,source:'Google Flights via SerpApi',outbound:selected.outbound,returnFlight:selected.returnFlight||null};
  try{localStorage.setItem(selectionKey(sess.key),JSON.stringify(record));}catch{}
  panel.querySelector('.hz-flight-cost').innerHTML='<b>Επιλεγμένο εισιτήριο '+(selected.scope==='roundtrip'?'μετ’ επιστροφής':'απλής μετάβασης')+': '+euro(fare)+'</b><div class="hz-flight-meta">Χειροκίνητες πρόσθετες δαπάνες: '+euro(baggage+ground)+' · Σύνολο με δηλωμένες δαπάνες: '+euro(fare+baggage+ground)+'</div><div class="hz-flight-note">Δεν έχει επιβεβαιωθεί η χρέωση αποσκευών, βρέφους ή η τελική διαθεσιμότητα κράτησης. Ο χρόνος μετακίνησης αεροδρομίου καταχωρίζεται χειροκίνητα και δεν περιλαμβάνεται στη διάρκεια πτήσης.</div>';
  document.dispatchEvent(new CustomEvent('horizon:live-flight-price',{detail:{destination:sess.name,price:fare,extras:baggage+ground,scope:selected.scope,currency:'EUR',selected:true}}));
}
async function getData(url,options={}){
  const res=await fetch(url,options),data=await res.json().catch(()=>({}));
  if(!res.ok||!data.ok)throw new Error(data.error||'HTTP '+res.status);
  return data;
}
async function search(panel,name){
  const from=panel.querySelector('.hz-flight-from')?.value||'',to=panel.querySelector('.hz-flight-to')?.value||'',origin=stateNow().origin||'Αθήνα',t=travelers(),btn=panel.querySelector('.hz-flight-search'),status=panel.querySelector('.hz-flight-status');
  if(!from){status.textContent='Διάλεξε ημερομηνία αναχώρησης.';return;}
  if(to&&to<from){status.textContent='Η επιστροφή πρέπει να είναι ίδια ή μεταγενέστερη της αναχώρησης.';return;}
  const base=String(window.HORIZON_LIVE_CONFIG?.apiBase||'').replace(/\/$/,'');
  if(!base){status.textContent='Το live API δεν είναι διαθέσιμο.';return;}
  const key=cacheKey(origin,name,from,to,t);
  clearSelection(key);
  const sess={key,name,origin,from,to,travelers:t,outboundData:null,returnData:null,outbound:null,selected:null,base};
  sessions.set(panel,sess);panel.querySelector('.hz-flight-cost').textContent='';
  const cached=readCache(key);
  if(cached){sess.outboundData=cached;renderResults(panel,cached,'outbound',true);return;}
  btn.disabled=true;btn.textContent='Αναζήτηση live πτήσεων…';status.textContent='Αναζητώ πτήσεις…';panel.querySelector('.hz-flight-results').innerHTML='';
  try{
    const u=new URL(base+'/flights');u.searchParams.set('origin',origin);u.searchParams.set('destination',name);u.searchParams.set('outboundDate',from);
    if(to)u.searchParams.set('returnDate',to);
    u.searchParams.set('adults',t.adults);u.searchParams.set('children',t.children);u.searchParams.set('infants',t.infants);
    const data=await getData(u.toString());sess.outboundData=data;writeCache(key,data);renderResults(panel,data);
  }catch(e){status.textContent='Αποτυχία αναζήτησης: '+(e.message||e);}
  finally{btn.disabled=false;btn.textContent='Αναζήτηση live πτήσεων';}
}
async function selectFlight(panel,step,index){
  const sess=sessions.get(panel);if(!sess)return;
  const status=panel.querySelector('.hz-flight-status'),button=panel.querySelector('[data-flight-step="'+step+'"][data-flight-index="'+index+'"]');
  if(step==='outbound'){
    const item=sess.outboundData?.results?.[index];if(!item||!(Number(item.price)>0))return;
    sess.outbound=item;
    if(!sess.to){sess.selected={fare:item.price,scope:'oneway',outbound:item};publish(panel,sess.selected);status.textContent='Επιλέχθηκε πτήση απλής μετάβασης.';return;}
    if(!item.departureToken){status.textContent='Η υπηρεσία δεν επέστρεψε επιλογή επιστροφής. Το ποσό αναχώρησης δεν είναι τελικό.';return;}
    if(button)button.disabled=true;
    status.textContent='Αναζήτηση επιστροφών για τη συγκεκριμένη αναχώρηση…';
    try{
      const input={origin:sess.origin,destination:sess.name,outboundDate:sess.from,returnDate:sess.to,adults:sess.travelers.adults,children:sess.travelers.children,infants:sess.travelers.infants,departureToken:item.departureToken};
      const data=await getData(sess.base+'/flight-returns',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)});
      sess.returnData=data;renderResults(panel,data,'return');
    }catch(e){status.textContent='Αποτυχία αναζήτησης επιστροφής: '+(e.message||e);}
    finally{if(button)button.disabled=false;}
  }else if(step==='return'){
    const item=sess.returnData?.results?.[index];
    if(!item||!(Number(item.price)>0)||!sess.outbound)return;
    sess.selected={fare:item.price,scope:'roundtrip',outbound:sess.outbound,returnFlight:item};
    publish(panel,sess.selected);
    status.textContent='Επιλέχθηκε συνδυασμός μετ’ επιστροφής. Έλεγξε αποσκευές και τελικό κόστος πριν την κράτηση.';
  }
}
function enhanceOverlay(overlay){
  if(!overlay||overlay.querySelector('.hz-flights-panel'))return;const name=overlay.querySelector('.hd-head h3')?.textContent?.trim();if(!name||!supportsPlane(name))return;const pane=overlay.querySelector('[data-pane="transport"]');if(!pane)return;
  const dates=defaultDates(),t=travelers(),box=document.createElement('section');box.className='hz-flights-panel';
  box.innerHTML=`<div class="hz-flights-title">Live πτήσεις μέσα στο Horizon</div><div class="hz-flights-copy">Οι τιμές αρχικής αναζήτησης αφορούν την αναχώρηση. Για συνολική τιμή μετ’ επιστροφής επιλέγεις πρώτα αναχώρηση, μετά επιστροφή. Οι επιβαρύνσεις αποσκευών και η τελική διαθεσιμότητα ελέγχονται πριν την κράτηση.</div><div class="hz-flight-form"><div class="hz-flight-field"><label>Αναχώρηση</label><input class="hz-flight-from" type="date" value="${esc(dates.from)}"></div><div class="hz-flight-field"><label>Επιστροφή</label><input class="hz-flight-to" type="date" value="${esc(dates.to)}"></div><div class="hz-flight-summary">${esc(stateNow().origin||'Αθήνα')} → ${esc(name)} · ${t.adults} ενήλικες${t.children?` · ${t.children} παιδιά`:''}${t.infants?` · ${t.infants} βρέφη`:''}</div><button type="button" class="hz-flight-search">Αναζήτηση live πτήσεων</button></div><div class="hz-flight-status" role="status" aria-live="polite"></div><div class="hz-flight-results"></div><div class="hz-flight-extras"><div class="hz-flight-field"><label>Αποσκευές / λοιπές χρεώσεις (€)<input type="number" min="0" step="1" value="0" data-flight-baggage></label></div><div class="hz-flight-field"><label>Μετακινήσεις αεροδρομίων (€)<input type="number" min="0" step="1" value="0" data-flight-ground></label></div><div class="hz-flight-field"><label>Χρόνος επίγειων μεταφορών ανά σκέλος (λεπτά)<input type="number" min="0" step="5" value="0" data-flight-ground-mins></label></div></div><div class="hz-flight-cost" aria-live="polite"></div>`;
  pane.appendChild(box);box.querySelector('.hz-flight-search').addEventListener('click',()=>search(box,name));box.querySelector('.hz-flight-results').addEventListener('click',e=>{const b=e.target.closest?.('[data-flight-step]');if(b)selectFlight(box,b.dataset.flightStep,Number(b.dataset.flightIndex));});box.querySelector('.hz-flight-extras').addEventListener('input',()=>{const x=sessions.get(box);if(x?.selected)publish(box,x.selected);});
}
function enhanceAll(){document.querySelectorAll('.horizon-detail-overlay').forEach(enhanceOverlay);}
function scheduleEnhance(){setTimeout(enhanceAll,0);setTimeout(enhanceAll,80);}
function init(){installStyles();document.addEventListener('click',e=>{const a=e.target.closest('.destination .actions a');const tab=e.target.closest('.hd-tab');if((a&&/μεταφορ/i.test(a.textContent||''))||(tab&&/μεταφορ/i.test(tab.textContent||'')))scheduleEnhance();},true);enhanceAll();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

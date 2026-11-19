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
 .hz-flight-option{margin-top:11px;border:1px solid rgba(255,122,22,.6);background:#19364a;border-radius:9px;padding:10px;color:#fff;font-weight:800;cursor:pointer}.hz-flight-cost{margin:15px 0;padding:12px;border:1px solid rgba(101,211,154,.4);border-radius:10px}.hz-flight-note{margin-top:9px;color:#ffdfac;font-size:.74rem;line-height:1.5}.hz-flight-selected-leg{margin-top:9px;padding:10px 12px;border:1px solid rgba(150,205,255,.18);border-radius:9px;background:#0e2537}.hz-flight-selected-leg b{display:block;margin-bottom:5px;color:#fff}.hz-flight-seller-results{margin-top:12px;display:grid;gap:8px}.hz-flight-seller{padding:11px;border:1px solid rgba(101,211,154,.24);border-radius:10px;background:#102a30}.hz-flight-seller button{border:1px solid rgba(101,211,154,.7);background:#173b38;color:white;border-radius:8px;padding:8px 10px;margin-top:7px;cursor:pointer}.hz-flight-booking{margin:12px 0;border:1px solid rgba(101,211,154,.6);background:#113629;color:white;border-radius:10px;padding:10px 12px;font-weight:800;cursor:pointer}.hz-flight-change{margin:10px 0;border:1px solid rgba(255,255,255,.28);border-radius:9px;background:#183045;color:#fff;padding:9px 13px;cursor:pointer;font-weight:800}.hz-flight-extras{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin:14px 0}
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
  const label=step==='return'?'Προσφορά επιλεγμένου συνδυασμού μετ’ επιστροφής':isRoundTrip?'Προσωρινή ένδειξη αναχώρησης — δεν έχει επιλεγεί επιστροφή':'Προσφορά απλής μετάβασης';
  const buttonLabel=step==='return'?'Επιλογή επιστροφής':isRoundTrip?'Επιλογή αναχώρησης και έλεγχος επιστροφών':'Επιλογή πτήσης';
  const allowed=valid&&(!isRoundTrip||step!=='outbound'||!!item.departureToken);
  return '<article class="hz-flight-card"><div class="hz-flight-card-top"><div><div class="hz-flight-airline">'+esc(airline)+'</div><div class="hz-flight-route">'+route(item)+'</div></div><div class="hz-flight-price">'+(valid?euro(price):'Χωρίς τιμή')+'</div></div><div class="hz-flight-meta">'+esc(fmtDuration(item.durationMinutes))+' · '+(stops?stops+' ανταποκρίσεις':'Απευθείας')+'</div>'+segments+'<div class="hz-flight-source">'+label+'</div>'+(allowed?'<button class="hz-flight-option" type="button" data-flight-step="'+step+'" data-flight-index="'+index+'">'+buttonLabel+'</button>':'<div class="hz-flight-note">Μη διαθέσιμη επιβεβαίωση τιμής/επιστροφής.</div>')+'</article>';
}
function selectedLegHTML(label,item){
  if(!item)return '';
  const airlines=esc((item.airlines||[]).join(' + ')||'Αεροπορική');
  const legs=Array.isArray(item.segments)?item.segments:[];
  const stops=Math.max(0,Number(item.stops)||0);
  const segments=legs.length>1?'<div class="hz-flight-meta">Αναλυτικά: '+legs.map(route).join(' · ')+'</div>':'';
  return '<div class="hz-flight-selected-leg"><b>'+esc(label)+'</b><div>'+airlines+' · '+route(item)+'</div><div class="hz-flight-meta">'+
    esc(fmtDuration(item.durationMinutes))+' · '+(stops===0?'Απευθείας':stops+' ανταποκρίσεις')+'</div>'+segments+'</div>';
}
function selectedTimeHTML(selected,minutesEachWay){
  const flightOut=Number(selected.outbound?.durationMinutes)||0;
  const flightReturn=selected.scope==='roundtrip'?(Number(selected.returnFlight?.durationMinutes)||0):0;
  const flightSum=flightOut+flightReturn;
  const legs=selected.scope==='roundtrip'?2:1;
  const groundSum=Math.max(0,minutesEachWay)*legs;
  const airportBuffer=120*legs;
  const benchmark=groundSum>0?' · Ενδεικτικό άθροισμα πτήσεων + λεωφορείων + περιθωρίου αεροδρομίου: '+esc(fmtDuration(flightSum+groundSum+airportBuffer)):'';
  return '<div class="hz-flight-meta">Χρόνος πτήσεων'+(selected.scope==='roundtrip'?' (αναχώρηση + επιστροφή)':'')+': '+
    esc(fmtDuration(flightSum))+
    (groundSum?'; επίγεια μετακίνηση (ενδεικτική/χειροκίνητη): '+esc(fmtDuration(groundSum)):'')+
    '; συνιστώμενη προσέλευση στα αεροδρόμια: '+esc(fmtDuration(airportBuffer))+benchmark+'. Δεν περιλαμβάνονται αναμονή λεωφορείου, περπάτημα, πραγματικές διευθύνσεις ή καθυστερήσεις.</div>';
}
function renderResults(panel,data,step='outbound',cached=false){
  const items=Array.isArray(data?.results)?data.results:[];
  panel.querySelector('.hz-flight-results').innerHTML=items.map((x,i)=>choiceCard(x,i,step,!!panel.querySelector('.hz-flight-to')?.value)).join('');
  const stamp=data?.retrievedAt?new Date(data.retrievedAt).toLocaleString('el-GR'):'μη διαθέσιμη';
  const status=panel.querySelector('.hz-flight-status');status.textContent=items.length?items.length+' επιλογές'+(cached?' · προσωρινά αποθηκευμένες':'')+'. '+(step==='return'?'Επίλεξε πτήση επιστροφής.':'Επίλεξε πρώτα πτήση αναχώρησης.')+' Πηγή: Google Flights μέσω SerpApi · Αναζήτηση: '+stamp:'Δεν βρέθηκαν πτήσεις για αυτά τα στοιχεία.';
  const back=panel.querySelector('.hz-flight-change');if(back)back.hidden=step!=='return';
}

function applyAirportGround(panel,selected){
  const sess=sessions.get(panel);if(!sess)return;
  const estimate=window.HORIZON_FLIGHT_GROUND_ESTIMATE?.estimate?.(sess.travelers,selected)||null;
  sess.groundEstimate=estimate;
  const info=panel.querySelector('.hz-flight-ground-info');
  if(!estimate){
    if(info)info.textContent='Αυτόματο κόστος αεροδρομίων δεν υπάρχει για αυτόν τον συνδυασμό/ταξιδιώτες. Συμπλήρωσε πραγματικά έξοδα και λεπτά χειροκίνητα. Το 0 δεν σημαίνει δωρεάν μεταφορά.';
    return;
  }
  if(panel.dataset.groundManuallyEdited==='1'){
    if(info)info.textContent='Χειροκίνητη επιλογή κόστους μετακινήσεων. Η επίσημη ενδεικτική τιμή λεωφορείων δεν αντικαθιστά τα στοιχεία σου.';
    return;
  }
  panel.querySelector('[data-flight-ground]').value=String(estimate.amountEUR);
  panel.querySelector('[data-flight-ground-mins]').value=String(estimate.minutesEachWay);
  if(info)info.innerHTML='<b>Αυτόματο ενδεικτικό κόστος αεροδρομίων:</b> '+euro(estimate.amountEUR)+
    ' · '+esc(fmtDuration(estimate.minutesEachWay))+' ανά αεροπορική μετάβαση (και στα δύο άκρα). '+esc(estimate.adultsIncluded)+' ενήλικες, '+
    esc(estimate.journeyCount)+' αεροπορικές μεταβάσεις. Δημόσια κόμιστρα ΟΑΣΑ X95 (€5,50) / ΟΣΕΘ 01Χ (€2,00), έλεγχος 19/11/2026. '+
    '<a href="https://www.oasa.gr/en/tickets/prices-of-products/" target="_blank" rel="noopener">ΟΑΣΑ</a> · '+
    '<a href="https://oseth.com.gr/el/times-proionton-leoforeion" target="_blank" rel="noopener">ΟΣΕΘ</a>. '+
    'Βρέφη κάτω των 6 ετών ταξιδεύουν δωρεάν στις αστικές συγκοινωνίες (όχι απαραίτητα στο αεροπλάνο). '+
    '<span class="hz-flight-note">Οι χρόνοι και η σύνδεση κέντρου με αεροδρόμιο είναι εκτίμηση. Δεν είναι ζωντανή ή ακριβής διαδρομή από την κατοικία/κατάλυμα.</span>';
}
function infantRulesHTML(selected,infants){
  if(!(Number(infants)>0))return '';
  const rules=window.HORIZON_INFANT_FARE_RULES?.policies?.(selected,infants)||[];
  const lines=rules.map(p=>{
    const link=p.url?' <a href="'+esc(p.url)+'" target="_blank" rel="noopener">Επίσημοι όροι</a>':'';
    return '<div>'+esc(p.airline)+': '+esc(p.rateDescription)+link+'</div>';
  }).join('');
  return '<div class="hz-flight-note" data-infant-policy><b>Βρεφικός ναύλος — επίσημοι κανόνες:</b> '+lines+
    '<div><b>Δεν υπολογίζουμε επιπλέον ποσό:</b> το 10% αφορά τον ναύλο ενηλίκου, όχι το συνολικό κόστος οικογένειας. Ο πάροχος δεν δίνει χωριστή επιβεβαιωμένη χρέωση βρέφους στο API. Ελέγξτε την τιμή και τους φόρους πριν την πληρωμή.</div></div>';
}
function publish(panel,selected){
  const sess=sessions.get(panel);if(!sess||!selected)return;
  const fare=Number(selected.fare);if(!Number.isFinite(fare)||fare<=0)return;
  const baggage=amount(panel.querySelector('[data-flight-baggage]'));
  const ground=amount(panel.querySelector('[data-flight-ground]'));
  const mins=amount(panel.querySelector('[data-flight-ground-mins]'));
  const groundAuto=panel.dataset.groundManuallyEdited!=='1'&&!!sess.groundEstimate;
  const quoteAt=Number(selected.quoteRetrievedAtMs)||Date.now();
  const record={at:quoteAt,editedAt:Date.now(),fare,extras:baggage+ground,estimatedTotal:Math.round((fare+baggage+ground)*100)/100,scope:selected.scope,groundCostOrigin:groundAuto?'public_bus_fare_benchmark':panel.dataset.groundManuallyEdited==='1'?'user_input':'not_verified',groundEstimate:groundAuto?sess.groundEstimate:null,airportBufferMinutes:120*(selected.scope==='roundtrip'?2:1),bookingSeller:selected.bookingSeller||null,bookingCheckedAt:selected.bookingCheckedAt||null,bookingFareStage:selected.bookingFareStage||'search_offer',baggagePolicies:selected.baggagePolicies||null,infantFareVerified:false,infantFareRules:window.HORIZON_INFANT_FARE_RULES?.policies?.(selected,sess.travelers.infants)||[],origin:sess.origin,destination:sess.name,from:sess.from,to:sess.to,travelers:sess.travelers,baggage,ground,groundMinutesEachWay:mins,source:'Google Flights via SerpApi',outbound:selected.outbound,returnFlight:selected.returnFlight||null};
  try{localStorage.setItem(selectionKey(sess.key),JSON.stringify(record));}catch{}
  panel.querySelector('.hz-flight-cost').innerHTML='<b>Επιλεγμένη τιμή '+(selected.scope==='roundtrip'?'μετ’ επιστροφής':'απλής μετάβασης')+': '+euro(fare)+'</b>'+
    selectedLegHTML('Αναχώρηση',selected.outbound)+selectedLegHTML('Επιστροφή',selected.returnFlight)+
    selectedTimeHTML(selected,mins)+
    '<div class="hz-flight-meta">Αποσκευές / χειροκίνητες επιβαρύνσεις: '+euro(baggage)+' · Επίγειες μεταφορές (ενδεικτικές ή χειροκίνητες): '+euro(ground)+' · Σύνολο καταγεγραμμένων ποσών: '+euro(fare+baggage+ground)+'</div>'+
    '<div class="hz-flight-meta">'+(selected.bookingSeller?'Προσφορά πωλητή: '+esc(selected.bookingSeller)+' · ':'Τιμή αναζήτησης Google Flights · ')+(selected.bookingCheckedAt?'Έλεγχος '+esc(new Date(selected.bookingCheckedAt).toLocaleString('el-GR')):'δεν έχει πραγματοποιηθεί έλεγχος προσφοράς πωλητή')+'</div>'+
    infantRulesHTML(selected,sess.travelers.infants)+
    '<div class="hz-flight-note">Η εμφανιζόμενη προσφορά δεν εγγυάται διαθεσιμότητα ή τελική τιμή checkout. Χρεώσεις βρεφών και αποσκευών πρέπει να επιβεβαιώνονται πριν την πληρωμή. Οι μη γνωστές χρεώσεις δεν θεωρούνται δωρεάν.</div>';
  document.dispatchEvent(new CustomEvent('horizon:live-flight-price',{detail:{destination:sess.name,price:fare,extras:baggage+ground,scope:selected.scope,currency:'EUR',selected:true}}));
}

function bookingNotice(panel,msg){const n=panel.querySelector('.hz-flight-seller-results');if(n)n.textContent=msg;}
async function checkBookingOptions(panel){
  const sess=sessions.get(panel);if(!sess?.selected)return;
  const requestedSelection=sess.selected;
  const token=sess.selected.returnFlight?.bookingToken||sess.selected.outbound?.bookingToken;
  const hasPin=Array.isArray(sess.selected.outbound?.segments)&&sess.selected.outbound.segments.length&&
    (!sess.to||Array.isArray(sess.selected.returnFlight?.segments)&&sess.selected.returnFlight.segments.length);
  if(!token&&!hasPin){bookingNotice(panel,'Δεν υπάρχουν ούτε booking_token ούτε αναλυτικά στοιχεία πτήσης. Οι χρεώσεις παραμένουν άγνωστες.');return;}
  const btn=panel.querySelector('.hz-flight-booking');if(btn)btn.disabled=true;
  bookingNotice(panel,'Αναζητώ τιμές πωλητών και πολιτικές αποσκευών…');
  try{
    const input={origin:sess.origin,destination:sess.name,outboundDate:sess.from,
      returnDate:sess.to||null,adults:sess.travelers.adults,children:sess.travelers.children,
      infants:sess.travelers.infants,bookingToken:token||'',
      outboundSegments:sess.selected.outbound?.segments||[],returnSegments:sess.selected.returnFlight?.segments||[]};
    const data=await getData(sess.base+'/flight-booking-options',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)});
    if(sessions.get(panel)!==sess||sess.selected!==requestedSelection)return;
    const choices=Array.isArray(data.results)?data.results:[];
    sess.bookingOptions=data;
    if(!choices.length){bookingNotice(panel,'Ο πάροχος δεν έδωσε επιλογές πωλητών για τον συνδυασμό. Αποσκευές και μεταφορά βρέφους ΔΕΝ θεωρούνται δωρεάν.');return;}
    panel.querySelector('.hz-flight-seller-results').innerHTML=
      '<div class="hz-flight-note">'+choices.length+' προσφορές πωλητών. Δεν αποτελούν εγγυημένη τιμή checkout. Χρεώσεις βρεφών: μη επιβεβαιωμένες.</div>'+
      choices.slice(0,10).map((x,i)=>{
        const policies=[...(x.baggage?.together||[]),...(x.baggage?.departing||[]),...(x.baggage?.returning||[])];
        const description=policies.length?policies.map(esc).join(' · '):'Δεν δόθηκε πολιτική αποσκευών';
        return '<div class="hz-flight-seller"><b>'+esc(x.seller)+'</b> · '+euro(x.price)+
          (x.separateTickets?'<div class="hz-flight-note">Πιθανώς ξεχωριστά εισιτήρια</div>':'')+
          '<div class="hz-flight-meta">Αποσκευές: '+description+'</div>'+
          '<button type="button" data-seller-index="'+i+'">Χρήση προσφοράς στο budget</button></div>';
      }).join('');
  }catch(e){if(sessions.get(panel)===sess&&sess.selected===requestedSelection)bookingNotice(panel,'Δεν ολοκληρώθηκε ο έλεγχος πωλητών: '+String(e.message||e));}
  finally{if(btn&&sessions.get(panel)===sess&&sess.selected===requestedSelection)btn.disabled=false;}
}
function selectSeller(panel,index){
  const sess=sessions.get(panel),option=sess?.bookingOptions?.results?.[index];
  if(!sess?.selected||!option||!(Number(option.price)>0))return;
  sess.selected.fare=Number(option.price);
  sess.selected.bookingSeller=option.seller;
  sess.selected.bookingCheckedAt=sess.bookingOptions.retrievedAt||new Date().toISOString();
  sess.selected.quoteRetrievedAtMs=Date.parse(sess.selected.bookingCheckedAt)||Date.now();
  sess.selected.bookingFareStage='seller_quote';
  sess.selected.baggagePolicies=option.baggage;
  publish(panel,sess.selected);
  bookingNotice(panel,'Επιλέχθηκε η προσφορά '+option.seller+'. Έλεγξε τελική χρέωση και βρεφικά τέλη στον πωλητή πριν την πληρωμή.');
}
async function getData(url,options={}){
  const res=await fetch(url,options),data=await res.json().catch(()=>({}));
  if(!res.ok||!data.ok)throw new Error(data.error||'HTTP '+res.status);
  return data;
}
function clearRouteSelections(origin,name){
  const prefix=SELECTION_PREFIX+CACHE_PREFIX+origin+'|'+name+'|';
  try{
    for(let i=localStorage.length-1;i>=0;i--){
      const key=localStorage.key(i);
      if(key?.startsWith(prefix))localStorage.removeItem(key);
    }
  }catch{}
}
function syncPlannerDates(from,to){
  const s=stateNow();
  if(!from||!(/^\d{4}-\d{2}-\d{2}$/.test(from)))return false;
  if(to&&(!(/^\d{4}-\d{2}-\d{2}$/.test(to))||to<from))return false;
  const oldFrom=s.dates?.from||'';
  const oldDays=Math.max(1,Number(s.duration)||1);
  const updatedDays=to?Math.round((Date.parse(to)-Date.parse(from))/86400000)+1:oldDays;
  if(!Number.isFinite(updatedDays)||updatedDays<1||updatedDays>365)return false;
  if(from===oldFrom&&updatedDays===oldDays)return true;
  s.dates={...(s.dates||{}),from,flex:0};
  s.duration=updatedDays;
  try{if(typeof save==='function')save();}catch{}
  try{
    if(typeof destinations!=='undefined'&&Array.isArray(destinations)&&
       typeof scoreDest==='function'&&typeof scored!=='undefined'&&typeof window.renderResults==='function'){
      scored=destinations.map(scoreDest);
      window.renderResults('match','all');
    }
  }catch{}
  document.dispatchEvent(new CustomEvent('horizon:planner-trip-updated',
    {detail:{from,to:to||null,duration:updatedDays}}));
  return true;
}
async function search(panel,name){
  const from=panel.querySelector('.hz-flight-from')?.value||'',to=panel.querySelector('.hz-flight-to')?.value||'',origin=stateNow().origin||'Αθήνα',t=travelers(),btn=panel.querySelector('.hz-flight-search'),status=panel.querySelector('.hz-flight-status');
  if(!from){status.textContent='Διάλεξε ημερομηνία αναχώρησης.';return;}
  if(to&&to<from){status.textContent='Η επιστροφή πρέπει να είναι ίδια ή μεταγενέστερη της αναχώρησης.';return;}
  if(!syncPlannerDates(from,to)){status.textContent='Μη έγκυρο διάστημα ημερομηνιών.';return;}
  const base=String(window.HORIZON_LIVE_CONFIG?.apiBase||'').replace(/\/$/,'');
  if(!base){status.textContent='Το live API δεν είναι διαθέσιμο.';return;}
  const key=cacheKey(origin,name,from,to,t);
  clearSelection(key);
  document.dispatchEvent(new CustomEvent('horizon:live-flight-price',{detail:{destination:name,price:0,selected:false}}));
  const sess={key,name,origin,from,to,travelers:t,outboundData:null,returnData:null,outbound:null,selected:null,base};
  sessions.set(panel,sess);panel.querySelector('.hz-flight-cost').textContent='';panel.querySelector('.hz-flight-seller-results').textContent='';
  const cached=readCache(key);
  if(cached){sess.outboundData=cached;renderResults(panel,cached,'outbound',true);return;}
  btn.disabled=true;btn.textContent='Αναζήτηση live πτήσεων…';status.textContent='Αναζητώ πτήσεις…';panel.querySelector('.hz-flight-results').innerHTML='';
  try{
    const u=new URL(base+'/flights');u.searchParams.set('origin',origin);u.searchParams.set('destination',name);u.searchParams.set('outboundDate',from);
    if(to)u.searchParams.set('returnDate',to);
    u.searchParams.set('adults',t.adults);u.searchParams.set('children',t.children);u.searchParams.set('infants',t.infants);
    const data=await getData(u.toString());if(sessions.get(panel)!==sess)return;
    sess.outboundData=data;writeCache(key,data);renderResults(panel,data);
  }catch(e){if(sessions.get(panel)===sess)status.textContent='Αποτυχία αναζήτησης: '+(e.message||e);}
  finally{if(sessions.get(panel)===sess){btn.disabled=false;btn.textContent='Αναζήτηση live πτήσεων';}}
}
async function selectFlight(panel,step,index){
  const sess=sessions.get(panel);if(!sess)return;
  const status=panel.querySelector('.hz-flight-status'),button=panel.querySelector('[data-flight-step="'+step+'"][data-flight-index="'+index+'"]');
  if(step==='outbound'){
    const item=sess.outboundData?.results?.[index];if(!item||!(Number(item.price)>0))return;
    sess.outbound=item;sess.returnData=null;
    sess.selected=null;sess.bookingOptions=null;clearSelection(sess.key);panel.querySelector('.hz-flight-cost').textContent='';panel.querySelector('.hz-flight-seller-results').textContent='';
    document.dispatchEvent(new CustomEvent('horizon:live-flight-price',{detail:{destination:sess.name,price:0,selected:false}}));
    if(!sess.to){sess.selected={fare:item.price,scope:'oneway',outbound:item,quoteRetrievedAtMs:Date.parse(sess.outboundData?.retrievedAt)||Date.now()};applyAirportGround(panel,sess.selected);publish(panel,sess.selected);status.textContent='Επιλέχθηκε πτήση απλής μετάβασης.';return;}
    if(!item.departureToken){status.textContent='Η υπηρεσία δεν επέστρεψε επιλογή επιστροφής. Το ποσό αναχώρησης δεν είναι τελικό.';return;}
    if(button)button.disabled=true;
    status.textContent='Αναζήτηση επιστροφών για τη συγκεκριμένη αναχώρηση…';
    try{
      const input={origin:sess.origin,destination:sess.name,outboundDate:sess.from,returnDate:sess.to,adults:sess.travelers.adults,children:sess.travelers.children,infants:sess.travelers.infants,departureToken:item.departureToken};
      const data=await getData(sess.base+'/flight-returns',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)});
      if(sessions.get(panel)!==sess||sess.outbound!==item)return;
      sess.returnData=data;renderResults(panel,data,'return');
    }catch(e){if(sessions.get(panel)===sess&&sess.outbound===item)status.textContent='Αποτυχία αναζήτησης επιστροφής: '+(e.message||e);}
    finally{if(button&&sessions.get(panel)===sess&&sess.outbound===item)button.disabled=false;}
  }else if(step==='return'){
    const item=sess.returnData?.results?.[index];
    if(!item||!(Number(item.price)>0)||!sess.outbound)return;
    sess.bookingOptions=null;
    panel.querySelector('.hz-flight-seller-results').textContent='';
    sess.selected={fare:item.price,scope:'roundtrip',outbound:sess.outbound,returnFlight:item,
      quoteRetrievedAtMs:Date.parse(sess.returnData?.retrievedAt)||Date.now()};
    applyAirportGround(panel,sess.selected);publish(panel,sess.selected);
    status.textContent='Επιλέχθηκε συνδυασμός μετ’ επιστροφής. Πάτησε «Έλεγχος τιμών πωλητών & αποσκευών» για πρόσθετη επιβεβαίωση.';
  }
}
function enhanceOverlay(overlay){
  if(!overlay||overlay.querySelector('.hz-flights-panel'))return;const name=overlay.querySelector('.hd-head h3')?.textContent?.trim();if(!name||!supportsPlane(name))return;const pane=overlay.querySelector('[data-pane="transport"]');if(!pane)return;
  const dates=defaultDates(),t=travelers(),box=document.createElement('section');box.className='hz-flights-panel';
  box.innerHTML=`<div class="hz-flights-title">Live πτήσεις μέσα στο Horizon</div><div class="hz-flights-copy">Οι τιμές αρχικής αναζήτησης αφορούν την αναχώρηση. Για συνολική τιμή μετ’ επιστροφής επιλέγεις πρώτα αναχώρηση, μετά επιστροφή. Οι επιβαρύνσεις αποσκευών και η τελική διαθεσιμότητα ελέγχονται πριν την κράτηση.</div><div class="hz-flight-form"><div class="hz-flight-field"><label>Αναχώρηση</label><input class="hz-flight-from" type="date" value="${esc(dates.from)}"></div><div class="hz-flight-field"><label>Επιστροφή</label><input class="hz-flight-to" type="date" value="${esc(dates.to)}"></div><div class="hz-flight-summary">${esc(stateNow().origin||'Αθήνα')} → ${esc(name)} · ${t.adults} ενήλικες${t.children?` · ${t.children} παιδιά`:''}${t.infants?` · ${t.infants} βρέφη`:''}</div><button type="button" class="hz-flight-search">Αναζήτηση live πτήσεων</button></div><div class="hz-flight-status" role="status" aria-live="polite"></div><div class="hz-flight-results"></div><button type="button" class="hz-flight-change" hidden>Αλλαγή αναχώρησης</button><div class="hz-flight-extras"><div class="hz-flight-field"><label>Αποσκευές / λοιπές χρεώσεις (€)<input type="number" min="0" step="1" value="0" data-flight-baggage></label></div><div class="hz-flight-field"><label>Μετακινήσεις αεροδρομίων (€)<input type="number" min="0" step="1" value="0" data-flight-ground></label></div><div class="hz-flight-field"><label>Χρόνος επίγειων μεταφορών ανά σκέλος (λεπτά)<input type="number" min="0" step="5" value="0" data-flight-ground-mins></label></div></div><div class="hz-flight-ground-info hz-flight-note" aria-live="polite">Οι μετακινήσεις αεροδρομίων θα εκτιμηθούν μόλις επιλέξεις πτήσεις, όπου διαθέτουμε τεκμηριωμένα κόμιστρα.</div><div class="hz-flight-cost" aria-live="polite"></div><button class="hz-flight-booking" type="button">Έλεγχος τιμών πωλητών & αποσκευών</button><div class="hz-flight-seller-results" aria-live="polite"></div>`;
  pane.appendChild(box);box.querySelectorAll('[data-flight-ground],[data-flight-ground-mins]').forEach(input=>input.addEventListener('input',()=>{box.dataset.groundManuallyEdited='1';const x=sessions.get(box);if(x){x.groundEstimate=null;if(x.selected)applyAirportGround(box,x.selected);}}));box.querySelector('.hz-flight-booking').addEventListener('click',()=>checkBookingOptions(box));box.querySelector('.hz-flight-seller-results').addEventListener('click',e=>{const b=e.target.closest?.('[data-seller-index]');if(b)selectSeller(box,Number(b.dataset.sellerIndex));});box.querySelector('.hz-flight-search').addEventListener('click',()=>search(box,name));box.querySelector('.hz-flight-results').addEventListener('click',e=>{const b=e.target.closest?.('[data-flight-step]');if(b)selectFlight(box,b.dataset.flightStep,Number(b.dataset.flightIndex));});box.querySelector('.hz-flight-extras').addEventListener('input',()=>{const x=sessions.get(box);if(x?.selected)publish(box,x.selected);});box.querySelector('.hz-flight-change').addEventListener('click',()=>{const x=sessions.get(box);if(!x?.outboundData)return;x.selected=null;x.outbound=null;x.returnData=null;x.bookingOptions=null;clearSelection(x.key);box.querySelector('.hz-flight-seller-results').textContent='';box.querySelector('.hz-flight-cost').textContent='';renderResults(box,x.outboundData,'outbound',true);document.dispatchEvent(new CustomEvent('horizon:live-flight-price',{detail:{destination:x.name,price:0,selected:false}}));});
  box.querySelector('.hz-flight-form').addEventListener('change',e=>{if(!e.target.matches?.('.hz-flight-from,.hz-flight-to'))return;const x=sessions.get(box),from=box.querySelector('.hz-flight-from').value,to=box.querySelector('.hz-flight-to').value;clearRouteSelections(stateNow().origin||'Αθήνα',name);if(x){document.dispatchEvent(new CustomEvent('horizon:live-flight-price',{detail:{destination:x.name,price:0,selected:false}}));}sessions.delete(box);box.querySelector('.hz-flight-results').textContent='';box.querySelector('.hz-flight-cost').textContent='';box.querySelector('.hz-flight-seller-results').textContent='';box.querySelector('.hz-flight-change').hidden=true;const valid=to>=from&&!!from;if(valid)syncPlannerDates(from,to);box.querySelector('.hz-flight-status').textContent=!valid?'Η επιστροφή πρέπει να είναι ίδια ή μεταγενέστερη της αναχώρησης.':'Οι ημερομηνίες και η διάρκεια ενημερώθηκαν στο Planner και στο συνολικό budget. Απαιτείται νέα αναζήτηση πτήσεων.';});
}
function enhanceAll(){document.querySelectorAll('.horizon-detail-overlay').forEach(enhanceOverlay);}
function scheduleEnhance(){setTimeout(enhanceAll,0);setTimeout(enhanceAll,80);}
function init(){installStyles();document.addEventListener('click',e=>{const a=e.target.closest('.destination .actions a');const tab=e.target.closest('.hd-tab');if((a&&/μεταφορ/i.test(a.textContent||''))||(tab&&/μεταφορ/i.test(tab.textContent||'')))scheduleEnhance();},true);enhanceAll();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

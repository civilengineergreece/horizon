(()=>{
'use strict';
/* Planning windows, not a carrier schedule or a verified attraction timetable. */
const ID='hz-itinerary-feasibility-style',SELECTOR='.hz-itinerary-feasibility',DAY=86400000;
function stateNow(){try{return typeof state!=='undefined'&&state?state:{};}catch{return {};}}
function iso(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(s||'')))return '';const d=new Date(s+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s?s:'';}
function datePlus(s,n){return iso(s)?new Date(Date.parse(s+'T00:00:00Z')+n*DAY).toISOString().slice(0,10):'';}
function clock(s){const m=/^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(s||''));return m?Number(m[1])*60+Number(m[2]):null;}
function wall(s){const m=/^(\d{4}-\d{2}-\d{2})[T ]([0-2]\d:[0-5]\d)(?::\d\d)?$/.exec(String(s||'').trim());if(!m||!iso(m[1])||clock(m[2])===null)return null;return {date:m[1],time:m[2],minute:Date.parse(m[1]+'T00:00:00Z')/60000+clock(m[2])};}
function n(v,f=0,max=720){if(v===undefined||v===null||String(v).trim()==='')return f;const x=Number(v);return Number.isFinite(x)?Math.max(0,Math.min(max,Math.round(x))):f;}
function context(ed){const s=stateNow(),t=s.travelers||{},duration=Math.max(1,Math.min(14,Number(s.duration?.value??s.duration)||1)),from=iso(s.dates?.from||'');return {from,to:datePlus(from,duration-1),duration,origin:String(s.origin||''),destination:ed?.dataset?.destination||'',adults:Number(t.adults)||0,children:Number(t.children)||0,infants:Number(t.infants)||0,mode:String(s.transport||'')};}
function flightFor(c){
 if(!c.from||!c.destination)return null;
 const key='hz-flight-selection-v2:hz-flights-v2:'+[c.origin,c.destination,c.from,c.to,c.adults,c.children,c.infants].join('|');
 let r;try{r=JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}
 if(!r||r.origin!==c.origin||r.destination!==c.destination||r.from!==c.from||
 (r.to||'')!==c.to||Number(r.travelers?.adults)!==c.adults||
 Number(r.travelers?.children)!==c.children||Number(r.travelers?.infants)!==c.infants||
 r.scope!=='roundtrip'||!r.outbound||!r.returnFlight)return null;
 const a=wall(r.outbound.arrival?.time),d=wall(r.returnFlight.departure?.time);
 if(!a||!d||a.date<c.from||a.date>c.to||d.date<c.from||d.date>c.to||d.minute<=a.minute)return null;
 return {arrivalAt:a.date+'T'+a.time,departureAt:d.date+'T'+d.time,at:Number(r.at)||0,source:'Επιλεγμένη προσφορά Google Flights (δεν αποτελεί κράτηση)'};
}
function key(ed){return 'horizon-feasibility-v1:'+(ed?.dataset?.tripKey||'unknown');}
function load(ed){try{const x=JSON.parse(localStorage.getItem(key(ed))||'{}');return x&&typeof x==='object'?x:{};}catch{return {};}}
function save(ed){const o={};for(const field of ed.querySelectorAll(SELECTOR+' [data-hz-feasibility-field]'))o[field.name]=field.value;try{localStorage.setItem(key(ed),JSON.stringify(o));}catch{}}
function evaluate(c,o,days,f=null){
 const conflicts=[],notes=[],unknowns=[],family=c.infants>0?30:c.children>0?20:0;
 const accessibility=n(o.accessibilityExtra,0,180);
 const arrival=wall(o.arrivalAt||f?.arrivalAt||''),departure=wall(o.departureAt||f?.departureAt||'');
 const arrivalGround=n(o.arrivalGround,60,600),departureGround=n(o.departureGround,60,600);
 const preboard=c.mode==='plane'||!!f?120:c.mode==='ferry'?60:['train','bus'].includes(c.mode)?30:0;
 const begin=arrival?arrival.minute+arrivalGround+family+accessibility:null,end=departure?departure.minute-departureGround-preboard-family-accessibility:null;
 const minGap=(family?90:60)+accessibility,checkIn=clock(o.checkIn),checkOut=clock(o.checkOut);
 if(!arrival)unknowns.push('Άγνωστη ώρα άφιξης για το συγκεκριμένο ταξίδι.');
 if(!departure)unknowns.push('Άγνωστη ώρα αναχώρησης/επιστροφής για το συγκεκριμένο ταξίδι.');
 if(!c.from)unknowns.push('Δεν υπάρχει έγκυρη ημερομηνία έναρξης.');
 if(arrival&&c.from&&(arrival.date<c.from||arrival.date>c.to))conflicts.push('Η άφιξη είναι εκτός ημερομηνιών ταξιδιού.');
 if(departure&&c.from&&(departure.date<c.from||departure.date>c.to))conflicts.push('Η αναχώρηση είναι εκτός ημερομηνιών ταξιδιού.');
 if(arrival&&departure&&departure.minute<=arrival.minute)conflicts.push('Η αναχώρηση προηγείται της άφιξης.');
 if(begin!==null&&end!==null&&end<begin)conflicts.push('Τα περιθώρια άφιξης και επιστροφής αλληλοεπικαλύπτονται.');
 if(checkIn===null)unknowns.push('Άγνωστη/μη επιβεβαιωμένη ώρα check-in καταλύματος.');
 if(checkOut===null)unknowns.push('Άγνωστη/μη επιβεβαιωμένη ώρα check-out καταλύματος.');
 if(arrival&&checkIn!==null&&arrival.date===c.from&&clock(arrival.time)<checkIn)notes.push('Η άφιξη προηγείται του δηλωμένου check-in — μη θεωρείς δεδομένο δωμάτιο ή φύλαξη αποσκευών.');
 if(departure&&checkOut!==null&&departure.date===c.to&&clock(departure.time)>checkOut)notes.push('Η επιστροφή είναι μετά το δηλωμένο check-out — χρειάζεται σχέδιο αποσκευών.');
 for(let di=0;di<days.length;di++){
  const date=datePlus(c.from,di),timed=[];
  for(let ri=0;ri<(days[di].slots||[]).length;ri++){
   const row=days[di].slots[ri],label='Ημέρα '+(di+1)+' · στάση '+(ri+1);
   if(!row.time){unknowns.push(label+': δεν έχει οριστεί ώρα.');continue;}
   const mins=clock(row.time);if(mins===null){conflicts.push(label+': μη έγκυρη ώρα.');continue;}
   if(!date)continue;
   const at=Date.parse(date+'T00:00:00Z')/60000+mins;
   timed.push({minute:mins,label});
   if(begin!==null&&di===0&&at<begin)conflicts.push(label+': πριν από την άφιξη και το περιθώριο μεταφοράς/οικογένειας.');
   if(end!==null&&di===days.length-1&&at>=end)conflicts.push(label+': πολύ κοντά στην αναχώρηση και στα περιθώρια μεταφοράς/επιβίβασης.');
  }
  for(let i=1;i<timed.length;i++){
   if(timed[i].minute<timed[i-1].minute)conflicts.push(timed[i].label+': οι στάσεις δεν είναι χρονολογικά ταξινομημένες.');
   else if(timed[i].minute-timed[i-1].minute<minGap)notes.push(timed[i].label+': λιγότερα από '+minGap+' λεπτά μεταξύ στάσεων (ενδεικτικό περιθώριο).');
  }
 }
 unknowns.push('Δεν έχουν επαληθευθεί ωράρια αξιοθέατων, αποστάσεις/διάρκειες ανά στάση, προσβασιμότητα και διαθεσιμότητα.');
 if(f&&Date.now()-f.at>30*60000)notes.push('Η επιλεγμένη αεροπορική προσφορά έχει ηλικία άνω των 30 λεπτών. Έλεγξε ξανά ωράρια και διαθεσιμότητα.');
 return {conflicts,notes,unknowns,family,accessibility,preboard,begin,end,arrivalAt:arrival?arrival.date+'T'+arrival.time:'',departureAt:departure?departure.date+'T'+departure.time:'',status:conflicts.length?'conflict':'unverified'};
}
function readOptions(ed){const result={};for(const x of ed.querySelectorAll(SELECTOR+' [data-hz-feasibility-field]'))result[x.name]=x.value;return result;}
function readDays(ed){return [...ed.querySelectorAll('.hz-edit-day')].map(d=>({slots:[...d.querySelectorAll('.hz-edit-row')].map(r=>({time:r.querySelector('.hz-slot-time')?.value?.trim()||'',text:r.querySelector('.hz-slot-text')?.value?.trim()||''}))}));}
function recalc(ed){
 if(!ed?.isConnected)return null;const p=ed.querySelector(SELECTOR);if(!p)return null;
 const c=context(ed),f=flightFor(c),o=readOptions(ed),r=evaluate(c,o,readDays(ed),f);
 p.querySelector('[data-hz-feas-source]').textContent=f?f.source+(f.at?' · καταγραφή '+new Date(f.at).toLocaleString('el-GR'):'')+(o.arrivalAt||o.departureAt?' · υπερισχύουν οι χειροκίνητες ώρες':''):'Δεν βρέθηκε επιλεγμένη πτήση ακριβώς για το τρέχον ταξίδι. Δήλωσε χειροκίνητες ώρες αν τις γνωρίζεις.';
 p.querySelector('[data-hz-feas-summary]').textContent=r.conflicts.length?'Χρονικές συγκρούσεις: '+r.conflicts.length+' — διόρθωσε τις ώρες.':'Δεν εντοπίστηκαν συγκρούσεις· η πραγματική εφικτότητα παραμένει μη επιβεβαιωμένη.';
 const el=p.querySelector('[data-hz-feas-items]');el.replaceChildren();const messages=[...r.conflicts.map(x=>'⛔ '+x),...r.notes.map(x=>'⚠ '+x),...r.unknowns.map(x=>'• '+x)];
 for(const x of messages.slice(0,18)){const li=document.createElement('li');li.textContent=x;el.appendChild(li);}
 if(messages.length>18){const li=document.createElement('li');li.textContent='Ακόμη '+(messages.length-18)+' σημειώσεις.';el.appendChild(li);}
 const pretty=x=>x?x.replace('T',' ')+' τοπική ώρα':'άγνωστη';
 p.querySelector('[data-hz-feas-windows]').textContent='Άφιξη: '+pretty(r.arrivalAt)+' · Αναχώρηση: '+pretty(r.departureAt)+'. Ενδεικτικά περιθώρια: μετακινήσεις '+n(o.arrivalGround,60)+'′/'+n(o.departureGround,60)+'′, οικογένεια '+r.family+'′, πρόσθετο περιθώριο προσβασιμότητας '+r.accessibility+'′, πριν την αναχώρηση '+r.preboard+'′. ΔΕΝ είναι πραγματικοί χρόνοι δρομολογίων.';
 for(const x of ed.querySelectorAll('.hz-edit-row'))x.removeAttribute('data-hz-feas-conflict');
 for(const msg of r.conflicts){const m=/Ημέρα (\d+) · στάση (\d+)/.exec(msg);if(!m)continue;ed.querySelectorAll('.hz-edit-day')[Number(m[1])-1]?.querySelectorAll('.hz-edit-row')[Number(m[2])-1]?.setAttribute('data-hz-feas-conflict','1');}
 p.dataset.status=r.status;return r;
}
function ensureStyles(){
 if(document.getElementById(ID))return;const el=document.createElement('style');el.id=ID;
 el.textContent='.hz-itinerary-feasibility{margin:12px 0;padding:14px;border:1px solid rgba(86,190,255,.32);background:rgba(15,45,63,.7);border-radius:14px}.hz-feas-title{font-size:.9rem;font-weight:950;color:#eff8ff}.hz-feas-explainer,.hz-feas-source{margin:7px 0;color:#b9cad5;font-size:.73rem;line-height:1.55}.hz-feas-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px}.hz-feas-grid label{display:grid;gap:5px;font-size:.68rem;color:#c5d5df}.hz-feas-grid input{max-width:100%;width:100%;min-width:0;box-sizing:border-box;padding:8px 9px;border-radius:8px;background:#0b2433;color:#f4faff;border:1px solid rgba(175,213,236,.32);font:inherit}.hz-feas-summary{margin:11px 0 7px;font-size:.78rem;font-weight:900;color:#ffd69e}.hz-feas-items{margin:5px 0 0;padding-left:19px;color:#d5e0e8;font-size:.74rem;line-height:1.5}.hz-feas-items li{margin:5px 0}.hz-feas-note{margin-top:9px;color:#abbfc9;font-size:.7rem;line-height:1.5}.hz-edit-row[data-hz-feas-conflict="1"]{outline:2px solid rgba(255,132,90,.68);outline-offset:3px;border-radius:6px}@media(max-width:620px){.hz-feas-grid{grid-template-columns:1fr}}';
 document.head.appendChild(el);
}
function augment(){
 ensureStyles();const ed=document.querySelector('.hz-itinerary-editor');if(!ed)return;
 if(ed.querySelector(SELECTOR)){recalc(ed);return;}
 const p=document.createElement('section');p.className='hz-itinerary-feasibility';
 p.innerHTML=[
 '<div class="hz-feas-title">Έλεγχος χρονικής εφικτότητας · οικογένεια & μετακινήσεις</div>',
 '<div class="hz-feas-explainer">Ώρες από την επιλεγμένη προσφορά πτήσης (όχι κράτηση) ή χειροκίνητη καταχώριση. Δεν εγγυόμαστε πραγματικό χρόνο μετακίνησης, ωράριο αξιοθέατου ή πρόσβαση σε κατάλυμα.</div>',
 '<div class="hz-feas-source" data-hz-feas-source></div><div class="hz-feas-grid">',
 '<label>Άφιξη στον προορισμό (αν τη γνωρίζεις)<input type="datetime-local" name="arrivalAt" data-hz-feasibility-field></label>',
 '<label>Αναχώρηση από τον προορισμό (αν τη γνωρίζεις)<input type="datetime-local" name="departureAt" data-hz-feasibility-field></label>',
 '<label>Check-in καταλύματος (μόνο εφόσον επιβεβαιώθηκε)<input type="time" name="checkIn" data-hz-feasibility-field></label>',
 '<label>Check-out καταλύματος (μόνο εφόσον επιβεβαιώθηκε)<input type="time" name="checkOut" data-hz-feasibility-field></label>',
 '<label>Περιθώριο μεταφοράς από άφιξη (λεπτά — υπόθεση)<input type="number" min="0" max="600" step="5" name="arrivalGround" value="60" data-hz-feasibility-field></label>',
 '<label>Περιθώριο μεταφοράς προς αναχώρηση (λεπτά — υπόθεση)<input type="number" min="0" max="600" step="5" name="departureGround" value="60" data-hz-feasibility-field></label>',
 '<label>Πρόσθετο περιθώριο προσβασιμότητας / περιορισμένης κινητικότητας (λεπτά — δική σου εκτίμηση)<input type="number" min="0" max="180" step="5" name="accessibilityExtra" value="0" data-hz-feasibility-field></label>',
 '</div><div class="hz-feas-summary" data-hz-feas-summary role="status" aria-live="polite"></div>',
 '<div class="hz-feas-note" data-hz-feas-windows></div><ul class="hz-feas-items" data-hz-feas-items></ul>',
 '<div class="hz-feas-note">Ο έλεγχος εντοπίζει προφανείς συγκρούσεις, όχι επιβεβαιωμένη εφικτότητα. Οι τιμές/ώρες του καταλύματος και οι ώρες λειτουργίας αξιοθέατων απαιτούν ξεχωριστή επαλήθευση. Τα στοιχεία διατηρούνται μόνο στον browser.</div>'
 ].join('');
 const intro=ed.querySelector('.hz-edit-intro');if(intro)intro.after(p);else ed.prepend(p);
 const saved=load(ed);for(const field of p.querySelectorAll('[data-hz-feasibility-field]'))if(Object.prototype.hasOwnProperty.call(saved,field.name))field.value=String(saved[field.name]||'');
 recalc(ed);
}
function boot(){
 let timer=null;const queue=()=>{clearTimeout(timer);timer=setTimeout(augment,60);};
 document.addEventListener('click',e=>{const ed=e.target.closest?.('.hz-itinerary-editor');if(ed&&e.target.closest?.('[data-reset-itinerary]')){try{localStorage.removeItem(key(ed));}catch{}}queue();},true);
 document.addEventListener('input',e=>{const ed=e.target.closest?.('.hz-itinerary-editor');if(!ed)return;if(e.target.matches('[data-hz-feasibility-field]'))save(ed);queue();},true);
 document.addEventListener('horizon:live-flight-price',queue);document.addEventListener('horizon:planner-trip-updated',queue);
 [0,220,780,1500].forEach(ms=>setTimeout(augment,ms));
}
window.HORIZON_FEASIBILITY={evaluate,flightFor,context,datePlus,wall,clock,recalc,augment};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
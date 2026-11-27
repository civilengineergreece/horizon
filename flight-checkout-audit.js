(()=>{
'use strict';
/*
 * Independent, opt-in manual audit of an airline seller's final payment
 * screen. Never implies that Horizon visited the seller, held a seat, paid,
 * verified credentials, or confirmed a booking. Do not retain passenger PII.
 */
const MAX_AGE=30*60*1000,ROOT='.hz-flight-checkout-review',STYLE='hz-flight-checkout-review-css';
function stateNow(){try{return typeof state!=='undefined'&&state?state:{};}catch{return {};}}
function escapeHTML(x){return String(x??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function parseEuro(v){
 const s=String(v??'').replace(/[\s€\u00a0\u202f]/g,'');
 if(!s||!/^[0-9.,]+$/.test(s)||/^\d+[.,]\d{3}$/.test(s))return NaN;
 let a;
 if(/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(s))a=s.replace(/\./g,'').replace(',','.');
 else if(/^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(s))a=s.replace(/,/g,'');
 else if(/^\d+(?:[.,]\d{1,2})?$/.test(s))a=s.replace(',','.');
 else return NaN;
 const n=Number(a);return Number.isFinite(n)&&n>=0&&n<=10000000?n:NaN;
}
const euro=x=>new Intl.NumberFormat('el-GR',{style:'currency',currency:'EUR'}).format(Number(x)||0);
function addDays(d,n){const date=new Date(d+'T00:00:00Z');return Number.isFinite(date.getTime())?new Date(date.getTime()+n*86400000).toISOString().slice(0,10):'';}
function trip(panel){
 const s=stateNow(),t=s.travelers||{},from=String(s.dates?.from||''),duration=Math.max(1,Number(s.duration)||1),
  to=s.dates?.oneWay?'':addDays(from,duration-1),destination=panel.closest('.horizon-detail-overlay')?.querySelector('.hd-head h3')?.textContent?.trim()||'';
 const ctx={origin:String(s.origin||'Αθήνα'),destination,from,to,
  adults:Math.max(1,Number(t.adults)||1),children:Math.max(0,Number(t.children)||0),
  infants:Math.max(0,Number(t.infants)||0)};
 ctx.key='hz-flight-selection-v2:hz-flights-v2:'+
  [ctx.origin,ctx.destination,ctx.from,ctx.to,ctx.adults,ctx.children,ctx.infants].join('|');
 return ctx;
}
function read(ctx){try{const x=JSON.parse(localStorage.getItem(ctx.key)||'null');return x&&typeof x==='object'?x:null;}catch{return null;}}
function validCtx(r,c){
 return !!r&&r.origin===c.origin&&r.destination===c.destination&&r.from===c.from&&
 (r.to||'')===c.to&&Number(r.travelers?.adults)===c.adults&&
 Number(r.travelers?.children)===c.children&&Number(r.travelers?.infants)===c.infants&&
 r.scope===(c.to?'roundtrip':'oneway')&&!!r.outbound&&(!c.to||!!r.returnFlight);
}
function assess(a){
 const problems=[],ctx=a.ctx||{},r=a.selection||{},seller=String(a.seller||'').trim();
 if(!validCtx(r,ctx))problems.push('Η προσφορά δεν αντιστοιχεί στο τρέχον ταξίδι ή στους ταξιδιώτες.');
 const at=Number(r.at);
 if(!Number.isFinite(at)||at<=0||at>Date.now()+30000||Date.now()-at>MAX_AGE)
  problems.push('Η προσφορά πτήσης έχει λήξει (όριο 30 λεπτά): χρειάζεται νέα επιλογή.');
 if(r.bookingFareStage!=='seller_quote'||!r.bookingSeller)
  problems.push('Χρειάζεται πρώτα συγκεκριμένη προσφορά πωλητή — όχι μόνο τιμή αναζήτησης.');
 if(seller.length<2||seller.length>120||seller!==String(r.bookingSeller||''))
  problems.push('Επιβεβαίωσε τον ίδιο ακριβώς πωλητή με την επιλεγμένη προσφορά.');
 if(a.source!=='seller_final_payment_screen')
  problems.push('Δεν ελέγχθηκε η τελευταία οθόνη πριν από την πληρωμή.');
 const total=parseEuro(a.total);
 if(!Number.isFinite(total)||total<=0)
  problems.push('Απαιτείται θετικό, ακριβές ποσό σε ευρώ για ΟΛΟΥΣ τους επιβάτες.');
 if(!a.datesAndFlights)problems.push('Δεν επιβεβαιώθηκαν ακριβώς πτήσεις, ημέρες και ώρες αναχώρησης/επιστροφής.');
 if(!a.passengers)problems.push('Δεν έχουν επιβεβαιωθεί όλοι οι ενήλικες και οι θέσεις.');
 if(ctx.children>0&&!a.children)problems.push('Δεν επιβεβαιώθηκαν τα παιδιά και οι ηλικίες τους στην τιμή.');
 if(ctx.infants>0&&(!a.infants||!a.infantPolicy))
  problems.push('Δεν επιβεβαιώθηκαν τα βρέφη, η θέση/αγκαλιά και οι χρεώσεις τους.');
 if(!a.baggageAndSeats)problems.push('Δεν έχει ελεγχθεί η συμπερίληψη αποσκευών/θέσεων ή το κόστος τους.');
 if(!a.mandatoryCharges)problems.push('Δεν περιλαμβάνονται ή δεν έχουν ελεγχθεί φόροι, τέλη και έξοδα κάρτας/πληρωμής.');
 if(!a.cancellation)problems.push('Δεν εξετάστηκαν οι όροι ακύρωσης και αλλαγής.');
 if(!a.availability)problems.push('Δεν έχει ελεγχθεί η εμφανιζόμενη διαθεσιμότητα στην οθόνη πωλητή.');
 if(a.separateTickets&&!a.separateTicketsReviewed)
  problems.push('Απαιτείται έλεγχος ξεχωριστών εισιτηρίων / ανταποκρίσεων.');
 if(!Number.isFinite(Number(r.ground))||Number(r.ground)<0||
  !Number.isFinite(Number(r.fare))||Number(r.fare)<=0)
  problems.push('Μη έγκυρα ποσά επιλεγμένης προσφοράς ή επίγειων μεταφορών.');
 const ground=Number(r.ground)||0;
 return {complete:problems.length===0,problems,manualOnly:true,
   airlineCheckoutTotal:problems.length?null:Math.round(total*100)/100,
   budgetTransportTotal:problems.length?null:Math.round((total+ground)*100)/100,
   groundSeparate:ground};
}
function style(){
 if(document.getElementById(STYLE))return;const el=document.createElement('style');el.id=STYLE;
 el.textContent='.hz-flight-checkout-review{margin:14px 0;padding:13px;border:1px solid rgba(123,209,246,.4);border-radius:11px;background:#10293a;color:#e5f1f8}.hz-flight-checkout-review h5{font-size:.85rem;margin:0 0 7px}.hz-flight-checkout-help{font-size:.73rem;line-height:1.55;color:#c5d5df}.hz-flight-checkout-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin:12px 0}.hz-flight-checkout-grid label{font-size:.72rem;display:grid;gap:4px}.hz-flight-checkout-grid input,.hz-flight-checkout-grid select{min-width:0;width:100%;box-sizing:border-box;border:1px solid #536a7b;border-radius:6px;padding:8px;background:#091d2d;color:white}.hz-flight-checkout-checks{display:grid;gap:9px}.hz-flight-checkout-checks label{font-size:.71rem;line-height:1.45;display:flex;align-items:start;gap:7px}.hz-flight-checkout-checks input{margin-top:3px}.hz-flight-checkout-save{margin:12px 0 0;padding:9px 13px;border:1px solid #8ccaa3;background:#1a493e;color:white;border-radius:8px;font-weight:850;cursor:pointer}.hz-flight-checkout-status{font-size:.73rem;line-height:1.5;margin:8px 0 0;color:#ffddab}@media(max-width:620px){.hz-flight-checkout-grid{grid-template-columns:1fr}}';
 document.head.appendChild(el);
}
function render(panel){
 if(!panel?.isConnected)return;
 const ctx=trip(panel),r=read(ctx);let root=panel.querySelector(ROOT);
 if(!r||!validCtx(r,ctx)){
   root?.remove();return;
 }
 if(r.bookingFareStage==='user_reported_seller_checkout'&&r.checkoutReviewValid===true){
  if(!root){root=document.createElement('section');root.className='hz-flight-checkout-review';panel.querySelector('.hz-flight-seller-results')?.after(root);}
  root.innerHTML='<h5>Χειροκίνητα δηλωμένο checkout · όχι κράτηση</h5><p class="hz-flight-checkout-help">Αεροπορικό ποσό που δήλωσες ότι είδες πριν την πληρωμή: '+
   euro(r.sellerCheckoutTotal)+' · επίγεια μεταφορά '+euro(r.ground)+
   ' (ενδεικτική/χωριστή) · συνολικό budget μεταφοράς '+euro(r.estimatedTotal)+
   '. Το HORIZON δεν επαλήθευσε την οθόνη του πωλητή και δεν έκανε κράτηση.</p>';return;
 }
 if(r.bookingFareStage!=='seller_quote'){
  root?.remove();return;
 }
 // Only supplier offer identity can reset a partly completed review.
 // Manually editing baggage/airport transfer updates editedAt, but MUST NOT
 // erase all checkboxes while the user is filling the final-screen audit.
 const stamp=[r.at,r.fare,r.bookingSeller,r.bookingFareStage,r.scope].join('|');
 if(root?.dataset.stamp===stamp)return;
 if(!root){root=document.createElement('section');root.className='hz-flight-checkout-review';panel.querySelector('.hz-flight-seller-results')?.after(root);}
 root.dataset.stamp=stamp;root.dataset.selectionKey=ctx.key;
 const cb=(name,label,shown=true)=>shown?'<label><input type="checkbox" name="'+name+'">'+escapeHTML(label)+'</label>':'';
 root.innerHTML='<h5>Έλεγχος τελικού ποσού πωλητή — μόνο χειροκίνητα</h5>'+
  '<p class="hz-flight-checkout-help">Επιλεγμένη προσφορά '+escapeHTML(r.bookingSeller)+
  ': '+euro(r.fare)+'. Άνοιξε τον πωλητή και κατέγραψε τι βλέπεις στην ΤΕΛΕΥΤΑΙΑ οθόνη πριν την πληρωμή. Δεν ζητούνται ονόματα, κάρτες, στοιχεία ταυτότητας ή δεδομένα πληρωμής. Απαιτείται νέα προσφορά όταν λήξει η παλιά.</p>'+
  '<div class="hz-flight-checkout-grid"><label>Πωλητής (ίδιο όνομα)<input name="seller" maxlength="120" value="'+escapeHTML(r.bookingSeller)+'"></label>'+
  '<label>Τελικό αεροπορικό ποσό ΟΛΩΝ των επιβατών (€), με φόρους και αποσκευές<input name="total" inputmode="decimal" placeholder="π.χ. 425,50"></label>'+
  '<label>Πηγή του ποσού<select name="source"><option value="">Επίλεξε</option><option value="seller_final_payment_screen">Τελευταία οθόνη πωλητή πριν την πληρωμή</option><option value="search_result">Μόνο αναζήτηση / προσφορά (όχι αποδεκτό)</option></select></label></div>'+
  '<div class="hz-flight-checkout-checks">'+
  cb('datesAndFlights','Έλεγξα αριθμούς πτήσεων, ώρες και ακριβείς ημερομηνίες και στα δύο σκέλη (όπου υπάρχει).')+
  cb('passengers','Η τιμή καλύπτει και τους '+ctx.adults+' ενήλικες και τις απαιτούμενες θέσεις.')+
  cb('children','Επιβεβαίωσα '+ctx.children+' παιδιά και τις ηλικίες τους.',ctx.children>0)+
  cb('infants','Ο πωλητής δέχθηκε '+ctx.infants+' βρέφη στην επιλεγμένη διαδρομή.',ctx.infants>0)+
  cb('infantPolicy','Επιβεβαίωσα αν το βρέφος ταξιδεύει στην αγκαλιά/σε θέση και ότι ο αντίστοιχος ναύλος/φόροι περιλαμβάνονται.',ctx.infants>0)+
  cb('baggageAndSeats','Έλεγξα χειραποσκευές, παραδιδόμενες αποσκευές, θέσεις και τυχόν χρεώσεις· όλα τα απαιτούμενα περιλαμβάνονται στο δηλωμένο ποσό.')+
  cb('mandatoryCharges','Το ποσό περιλαμβάνει ΟΛΟΥΣ τους υποχρεωτικούς φόρους, τέλη, βρεφικές χρεώσεις και έξοδα τρόπου πληρωμής σε ευρώ.')+
  cb('cancellation','Έλεγξα όρους ακύρωσης και αλλαγής πτήσεων.')+
  cb('availability','Η συγκεκριμένη επιλογή εμφανίζεται διαθέσιμη στον πωλητή πριν την πληρωμή.')+
  cb('separateTicketsReviewed','Εξέτασα τους όρους ξεχωριστών εισιτηρίων, self-transfer και απώλειας ανταποκρίσεων.',r.separateTickets===true)+
  '</div><button type="button" class="hz-flight-checkout-save">Καταχώριση δηλωμένου checkout στο budget</button>'+
  '<p class="hz-flight-checkout-status" role="status" aria-live="polite">Δεν υπάρχει επαληθευμένο τελικό ποσό. Η καταχώριση δεν αποτελεί κράτηση.</p>';
}
function capture(root,ctx,r){
 const v=name=>root.querySelector('[name="'+name+'"]')?.value||'';
 const b=name=>!!root.querySelector('[name="'+name+'"]')?.checked;
 return {ctx,selection:r,seller:v('seller'),total:v('total'),source:v('source'),
  datesAndFlights:b('datesAndFlights'),passengers:b('passengers'),children:b('children'),
  infants:b('infants'),infantPolicy:b('infantPolicy'),baggageAndSeats:b('baggageAndSeats'),
  mandatoryCharges:b('mandatoryCharges'),cancellation:b('cancellation'),
  availability:b('availability'),separateTickets:r?.separateTickets===true,
  separateTicketsReviewed:b('separateTicketsReviewed')};
}
function save(root){
 const panel=root.closest('.hz-flights-panel');if(!panel)return;
 const ctx=trip(panel),r=read(ctx),out=assess(capture(root,ctx,r));
 const msg=root.querySelector('.hz-flight-checkout-status');
 if(root.dataset.selectionKey!==ctx.key||
    root.dataset.stamp!==[r?.at,r?.fare,r?.bookingSeller,r?.bookingFareStage,r?.scope].join('|')){
  if(msg)msg.textContent='Η προσφορά άλλαξε — επανάλαβε τον έλεγχο.';return;
 }
 if(!out.complete){if(msg)msg.textContent='Δεν ενημερώθηκε το budget: '+out.problems.join(' ');return;}
 const now=Date.now();
 const updated={...r,at:Number(r.at),editedAt:now,checkoutAt:now,
  fare:out.airlineCheckoutTotal,sellerCheckoutTotal:out.airlineCheckoutTotal,
  sourceFareBeforeCheckout:Number(r.fare),sourceBaggageExtraBeforeCheckout:Number(r.baggage)||0,
  baggage:0,extras:out.groundSeparate,estimatedTotal:out.budgetTransportTotal,
  bookingFareStage:'user_reported_seller_checkout',bookingStatus:'checkout_user_reported_not_booked',
  source:'User-entered airline seller checkout (not independently verified)',
  reviewEvidence:'manual_flight_seller_checkout',checkoutReviewValid:true,
  infantIncludedUserConfirmed:ctx.infants>0,infantFareVerified:false,
  cancellationReviewed:true,checkoutFinalCurrency:'EUR',booked:false};
 try{localStorage.setItem(ctx.key,JSON.stringify(updated));}catch{
  if(msg)msg.textContent='Αποτυχία αποθήκευσης: το budget δεν άλλαξε.';return;
 }
 render(panel);
 document.dispatchEvent(new CustomEvent('horizon:live-flight-price',{detail:{destination:ctx.destination,
  price:out.airlineCheckoutTotal,extras:out.groundSeparate,selected:true,evidence:'manual_seller_checkout',
  currency:'EUR'}}));
}
function init(){
 style();
 document.addEventListener('click',e=>{
  const button=e.target.closest?.('.hz-flight-checkout-save');
  if(button)save(button.closest(ROOT));
  // Browser's selected source quote may have just changed.
  if(e.target.closest?.('.destination .actions a,.hd-tab,.hz-flight-search,.hz-flight-change'))
   [80,350].forEach(t=>setTimeout(refresh,t));
 },true);
 document.addEventListener('horizon:live-flight-price',()=>setTimeout(refresh,0));
 [100,650].forEach(t=>setTimeout(refresh,t));
}
function refresh(){for(const panel of document.querySelectorAll('.hz-flights-panel'))render(panel);}
window.HORIZON_FLIGHT_CHECKOUT_AUDIT={assess,parseEuro,validCtx};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
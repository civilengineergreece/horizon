(()=>{
'use strict';
const AGE_LIMIT_MS=30*60*1000;
const hookedPanels=new WeakSet();
function parseEuro(v){
  // Greek and international decimal formats; reject malformed or ambiguous amounts.
  const s=String(v??'').replace(/[\s€\u00a0\u202f]/g,'');
  if(!s||!/^[0-9.,]+$/.test(s))return NaN;
  let normalized='';
  if(/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(s))
    normalized=s.replace(/\./g,'').replace(',','.');
  else if(/^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(s))
    normalized=s.replace(/,/g,'');
  else if(/^\d+(?:[.,]\d{1,2})?$/.test(s))
    normalized=s.replace(',','.');
  else return NaN;
  const n=Number(normalized);
  return Number.isFinite(n)&&n>=0?n:NaN;
}
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function amount(v){return new Intl.NumberFormat('el-GR',{style:'currency',currency:'EUR',minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(v)||0);}
function validAmount(v){const n=parseEuro(v);return Number.isFinite(n)&&n>0&&n<=1e7;}
function assess(a){
  const problems=[];
  if(a.source!=='seller_checkout')problems.push('Δεν έχει καταγραφεί έλεγχος στην τελευταία οθόνη του πωλητή.');
  if(!validAmount(a.total))problems.push('Δεν καταχωρίστηκε θετικό συνολικό ποσό σε ευρώ.');
  if(!a.datesConfirmed)problems.push('Δεν επιβεβαιώθηκαν οι ίδιες ημερομηνίες.');
  if(!a.partyConfirmed)problems.push('Δεν επιβεβαιώθηκαν όλοι οι επισκέπτες.');
  if(a.children>0){
    if(!Array.isArray(a.childrenAges)||a.childrenAges.length!==a.children||
       a.childrenAges.some(age=>!Number.isInteger(age)||age<2||age>11))
      problems.push('Δεν έχουν καταγραφεί οι ακριβείς ηλικίες των παιδιών 2–11 ετών.');
    if(!a.childAgesConfirmed)
      problems.push('Δεν επιβεβαιώθηκαν στον πωλητή οι ακριβείς ηλικίες των παιδιών.');
  }
  if(!a.allRoomsConfirmed||!Number.isInteger(a.roomsCount)||a.roomsCount<1||a.roomsCount>30)
    problems.push('Δεν επιβεβαιώθηκε ο αριθμός και το συνολικό κόστος όλων των δωματίων.');
  if(!a.roomConfirmed)problems.push('Δεν επιβεβαιώθηκε ο συγκεκριμένος τύπος δωματίου.');
  if(a.infants>0&&!a.infantIncluded)problems.push('Δεν επιβεβαιώθηκε ότι το βρέφος περιλαμβάνεται στην τιμή.');
  if(a.infants>0&&!a.infantAccepted)problems.push('Δεν επιβεβαιώθηκε ότι το δωμάτιο δέχεται το βρέφος.');
  if(a.infants>0&&!['free','paid','not_needed'].includes(a.cribStatus))
    problems.push('Η διαθεσιμότητα/χρέωση της κούνιας δεν έχει επιβεβαιωθεί ή δεν δηλώθηκε ότι δεν απαιτείται.');
  if(a.infants>0&&a.cribStatus==='paid'&&!validAmount(a.cribFee))
    problems.push('Η χρεώσιμη κούνια απαιτεί ακριβές θετικό ποσό σε ευρώ.');
  const climateSeparate=a.climateStatus==='excluded';
  const cribSeparate=a.infants>0&&a.cribStatus==='paid'&&a.cribChargeLocation==='excluded';
  const coverageExpected=climateSeparate&&cribSeparate?'all_except_climate_and_crib':
    climateSeparate?'all_except_climate':cribSeparate?'all_except_crib':'all_in';
  if(a.totalCoverage!==coverageExpected)
    problems.push('Η δήλωση για τις υποχρεωτικές χρεώσεις δεν συμφωνεί με τον τρόπο πληρωμής τέλους και κούνιας.');
  if(climateSeparate&&!validAmount(a.climateExtra))
    problems.push('Για χωριστό τέλος διαμονής απαιτείται το ακριβές επιβεβαιωμένο επιπλέον ποσό (€).');
  if(a.infants>0&&a.cribStatus==='paid'&&!['included','excluded'].includes(a.cribChargeLocation))
    problems.push('Δεν έχει διευκρινιστεί αν η χρέωση κούνιας περιλαμβάνεται ή καταβάλλεται χωριστά.');
  if(a.cribChargeLocation==='excluded'&&a.cribStatus!=='paid')
    problems.push('Δεν μπορεί να προστεθεί χωριστή χρέωση κούνιας χωρίς επιβεβαιωμένη χρεώσιμη κούνια.');
  if(!['included','excluded','not_applicable'].includes(a.climateStatus))
    problems.push('Η αντιμετώπιση του τέλους διαμονής/ανθεκτικότητας δεν έχει επιβεβαιωθεί.');
  if(a.climateApplicable&&a.climateStatus==='not_applicable')
    problems.push('Για το ελληνικό κατάλυμα το τέλος ανθεκτικότητας θεωρείται εφαρμοστέο, εκτός αν υπάρχει τεκμηριωμένη νόμιμη εξαίρεση. Μην επιλέγεις «δεν εφαρμόζεται» χωρίς επιβεβαίωση.');
  if(!a.cancellationReviewed)problems.push('Δεν έχουν ελεγχθεί οι όροι ακύρωσης.');
  if(a.capacityStatus==='insufficient')problems.push('Η πηγή δηλώνει ανεπαρκή χωρητικότητα για αυτό το δωμάτιο.');
  try{const u=new URL(a.bookingUrl);if(u.protocol!=='https:'||u.username||u.password)throw Error();}catch{problems.push('Δεν υπάρχει ασφαλής σύνδεσμος για τον συγκεκριμένο πωλητή.');}
  const subtotal=parseEuro(a.total),climateExtra=climateSeparate?parseEuro(a.climateExtra):0,
    cribExtra=cribSeparate?parseEuro(a.cribFee):0;
  return {complete:problems.length===0,problems,manualOnly:true,
    budgetTotal:problems.length===0?Math.round((subtotal+climateExtra+cribExtra)*100)/100:null,
    sellerTotal:problems.length===0?subtotal:null,
    separatelyConfirmedClimateFee:problems.length===0?climateExtra:null,
    separatelyConfirmedCribFee:problems.length===0?cribExtra:null};
}
function getPanelDetails(panel){
  const details=panel?._hotelDetails;
  if(!details?.data?.offers||!panel._hotelInfo)return null;
  return details;
}
function status(root,text,isWarning=true){
  const el=root.querySelector('[data-checkout-message]');
  if(!el)return;el.textContent=text;el.style.color=isWarning?'#ffd6a0':'#abedcf';
}
function capture(root,offer,info){
  const value=key=>root.querySelector('[name="'+key+'"]')?.value||'';
  const checked=key=>!!root.querySelector('[name="'+key+'"]')?.checked;
  return {
    source:value('checkoutSource'),total:value('checkoutTotal'),
    datesConfirmed:checked('datesConfirmed'),
    partyConfirmed:checked('partyConfirmed'),
    childAgesConfirmed:checked('childAgesConfirmed'),
    roomsCount:Number(value('roomsCount')),allRoomsConfirmed:checked('allRoomsConfirmed'),
    roomConfirmed:checked('roomConfirmed'),
    infantIncluded:checked('infantIncluded'),infantAccepted:checked('infantAccepted'),
    totalCoverage:value('totalCoverage'),
    cribStatus:value('cribStatus'),cribFee:value('cribFee'),
    cribChargeLocation:value('cribChargeLocation'),
    climateStatus:value('climateStatus'),climateExtra:value('climateExtra'),
    cancellationReviewed:checked('cancellationReviewed'),
    infants:Number(info?.infants)||0,children:Number(info?.children)||0,
    childrenAges:[...(info?.childrenAges||[])],
    capacityStatus:offer.capacityStatus,
    bookingUrl:offer.bookingUrl
  };
}
function inboxMessage(panel,details,offer){
  const info=panel._hotelInfo;
  const babies=Number(info.infants)||0;
  const party=info.adults+' ενήλικες, '+info.children+' παιδιά'+(babies?' και '+babies+' βρέφη':'');
  const offerName=offer.seller+(offer.roomName?' / '+offer.roomName:'');
  const questions=[
    'Το συνολικό πληρωτέο ποσό σε ευρώ για όλη τη διαμονή, μαζί με όλους τους υποχρεωτικούς φόρους και τέλη'+(babies?', το βρέφος και την ενδεχόμενη χρέωση κούνιας':'')+';',
    ...(babies?['Αν επιτρέπεται βρέφος στο συγκεκριμένο δωμάτιο και αν διατίθεται βρεφική κούνια, με ακριβές κόστος και όρους προκράτησης;']:[]),
    'Αν το τέλος ανθεκτικότητας στην κλιματική κρίση περιλαμβάνεται ή εξοφλείται χωριστά και, αν εξοφλείται χωριστά, ποιο είναι το ακριβές συνολικό επιπλέον ποσό για όλα τα δωμάτια και τις διανυκτερεύσεις;',
    'Αν περιλαμβάνεται πρωινό;',
    'Τους πλήρεις όρους ακύρωσης, την προθεσμία και τυχόν χρεώσεις;',
    'Ότι η τελική τιμή καλύπτει ΟΛΑ τα απαιτούμενα δωμάτια, τις ακριβείς ηλικίες παιδιών και όλες τις χρεώσεις που πληρώνονται χωριστά;'
  ];
  return [
    'Καλησπέρα σας,','',
    'Ενδιαφερόμαστε για διαμονή στο '+details.data.name+' από '+info.checkIn+' έως '+info.checkOut+
      ' ('+info.nights+' διανυκτερεύσεις), για '+party+'.','',
    'Μπορείτε να επιβεβαιώσετε γραπτώς για την προσφορά '+offerName+':',
    ...questions.map((q,i)=>(i+1)+'. '+q),'',
    'Παρακαλώ επιβεβαιώστε ότι οι πληροφορίες αφορούν τις συγκεκριμένες ημερομηνίες και τον αριθμό επισκεπτών.','',
    'Ευχαριστούμε.'
  ].join('\n');
}
function render(panel,index){
  const details=getPanelDetails(panel);if(!details)return;
  const offer=details.data.offers[index],hotel=details.hotel,info=panel._hotelInfo;
  if(!offer)return;
  let root=panel.querySelector('.hz-hotel-checkout-audit');
  if(!root){
    root=document.createElement('section');
    root.className='hz-hotel-checkout-audit';
    panel.querySelector('.hz-hotel-detail').after(root);
  }
  const hasURL=(()=>{try{const url=new URL(offer.bookingUrl);return url.protocol==='https:'&&!url.username&&!url.password;}catch{return false;}})();
  root.dataset.offerIndex=String(index);
  const line=(name,label,kind)=>'<label class="hz-checkout-field">'+esc(label)+
    (kind||'<input type="text" name="'+name+'">')+'</label>';
  const sel=(name,items)=>'<select name="'+name+'">'+items.map(i=>'<option value="'+esc(i[0])+'">'+esc(i[1])+'</option>').join('')+'</select>';
  const yes=name=>'<label class="hz-checkout-check"><input type="checkbox" name="'+name+'"> ';
  root.innerHTML='<h5>Έλεγχος τελικής τιμής'+(info.infants?' και βρεφικής κούνιας':'')+'</h5>'+
    '<div class="hz-hotel-checkout-warning"><b>Μόνο χειροκίνητη καταχώριση:</b> τα παρακάτω δεν επαληθεύονται αυτόματα από τη Google Hotels. Δεν ζητούνται στοιχεία επιβατών, κάρτες ή πληρωμές. Η αποθήκευση ΔΕΝ πραγματοποιεί κράτηση.</div>'+
    '<p><b>'+esc(details.data.name)+'</b> · '+esc(offer.seller)+' · '+
    esc(offer.roomName||'ο τύπος δωματίου δεν δόθηκε από την πηγή')+'<br>'+
    esc(info.checkIn)+' – '+esc(info.checkOut)+' · '+esc(info.adults)+' ενήλικες, '+
    esc(info.children)+' παιδιά, '+esc(info.infants)+' βρέφη · προσφορά πηγής '+
    amount(offer.total)+'</p>'+
    (hasURL?'<a href="'+esc(offer.bookingUrl)+'" target="_blank" rel="noopener noreferrer">Άνοιγμα του πωλητή για έλεγχο τιμής πριν την πληρωμή</a>':
      '<p>Δεν δόθηκε ασφαλής σύνδεσμος πωλητή. Δεν επιτρέπεται να θεωρηθεί ελεγμένο checkout.</p>')+
    '<div class="hz-checkout-grid">'+
    line('checkoutSource','Τι ελέγχθηκε;',sel('checkoutSource',[
      ['not_checked','Δεν έχει γίνει έλεγχος'],
      ['seller_checkout','Η τελευταία οθόνη του πωλητή πριν την πληρωμή'],
      ['written_hotel','Γραπτή απάντηση ξενοδοχείου (όχι checkout)']
    ]))+
    line('checkoutTotal','Σύνολο (€) που αναγράφεται πριν την πληρωμή','<input type="text" name="checkoutTotal" inputmode="decimal" placeholder="π.χ. 1.270,00">')+
    line('roomsCount','Αριθμός δωματίων που καλύπτει το συνολικό ποσό','<input type="number" name="roomsCount" min="1" max="30" step="1" placeholder="π.χ. 1">')+
    line('totalCoverage','Περιλαμβάνει όλες τις υποχρεωτικές χρεώσεις;',sel('totalCoverage',[
      ['unknown','Άγνωστο'],
      ['all_in','Ναι, όλα μέσα στο πληρωτέο ποσό'],
      ['all_except_climate','Όλα εκτός από χωριστό τέλος διαμονής'],
      ['all_except_crib','Όλα εκτός από χωριστή χρέωση κούνιας'],
      ['all_except_climate_and_crib','Όλα εκτός από χωριστό τέλος και κούνια'],
      ['not_all_in','Όχι / υπάρχουν άλλες επιπλέον χρεώσεις']
    ]))+
    line('cribStatus','Βρεφική κούνια',sel('cribStatus',[
      ['unknown','Δεν έχει επιβεβαιωθεί'],
      ['on_request','Μόνο κατόπιν αιτήματος · όχι επιβεβαιωμένη'],
      ['free','Επιβεβαιωμένη δωρεάν'],
      ['paid','Επιβεβαιωμένη με χρέωση'],
      ['not_available','Δεν υπάρχει διαθέσιμη'],
      ['not_needed','Δεν απαιτείται κούνια']
    ]))+
    line('cribFee','Συνολική χρέωση όλων των κουνιών (€), αν υπάρχει','<input type="text" name="cribFee" inputmode="decimal" placeholder="Μόνο εάν χρεώνεται">')+
    line('cribChargeLocation','Τρόπος χρέωσης κούνιας',sel('cribChargeLocation',[
      ['unknown','Άγνωστο'],
      ['included','Περιλαμβάνεται στο ποσό checkout'],
      ['excluded','Χρεώνεται επιπλέον · επιβεβαιωμένο ποσό']
    ]))+
    line('climateStatus','Τέλος διαμονής/ανθεκτικότητας',sel('climateStatus',[
      ['unknown','Άγνωστο'],
      ['included','Περιλαμβάνεται στο πληρωτέο ποσό'],
      ['excluded','Πληρώνεται χωριστά · ακριβές ποσό επιβεβαιωμένο'],
      ['not_applicable','Δεν εφαρμόζεται (επιβεβαιώθηκε)']
    ]))+
    line('climateExtra','Επιβεβαιωμένο επιπλέον τέλος διαμονής (€) για όλη τη διαμονή',
      '<input type="text" name="climateExtra" inputmode="decimal" placeholder="Μόνο αν πληρώνεται χωριστά">')+
    '</div><div class="hz-checkout-checks">'+
    yes('datesConfirmed')+'Επαληθεύτηκαν οι ακριβείς ημερομηνίες.</label>'+
    yes('partyConfirmed')+'Επαληθεύτηκαν όλοι οι επισκέπτες'+(info.infants?' (μαζί με τα βρέφη)':'')+'.</label>'+
    (info.children?yes('childAgesConfirmed')+'Επιβεβαίωσα στον πωλητή τις ηλικίες παιδιών: '+esc(info.childrenAges.join(', '))+' ετών.</label>':'')+
    yes('allRoomsConfirmed')+'Το συνολικό ποσό καλύπτει ΟΛΑ τα απαιτούμενα δωμάτια.</label>'+
    yes('roomConfirmed')+'Επαληθεύτηκε ο συγκεκριμένος τύπος δωματίου / κρεβατιών.</label>'+
    yes('infantIncluded')+'Το βρέφος περιλαμβάνεται ρητά στην προσφορά.</label>'+
    yes('infantAccepted')+'Το συγκεκριμένο δωμάτιο δέχεται το βρέφος.</label>'+
    yes('cancellationReviewed')+'Ελέγχθηκαν οι ακριβείς όροι ακύρωσης (ακόμη και αν δεν είναι δωρεάν).</label>'+
    '</div>'+
    '<div class="hz-checkout-actions">'+
    '<button type="button" data-hotel-audit-save>Καταχώριση ελέγχου (χωρίς κράτηση)</button>'+
    '<button type="button" data-hotel-audit-copy>Αντιγραφή ερωτήσεων προς το ξενοδοχείο</button></div>'+
    '<div data-checkout-message role="status" aria-live="polite">Το τελικό πληρωτέο ποσό δεν είναι επιβεβαιωμένο.</div>'+
    '<textarea class="hz-checkout-inquiry" readonly aria-label="Ερωτήσεις προς το ξενοδοχείο"></textarea>';
  if(info.infants===0){
    ['cribStatus','cribFee','cribChargeLocation','infantIncluded','infantAccepted'].forEach(key=>root.querySelector('[name="'+key+'"]')?.closest('label')?.remove());
  }
  root.querySelector('[name="climateExtra"]')?.closest('label')?.insertAdjacentHTML('afterend',
    '<div class="hz-checkout-warning">Καταχώρισε μόνο ΕΠΙΒΕΒΑΙΩΜΕΝΕΣ χρεώσεις. Αν η κούνια ή το τέλος πληρώνονται χωριστά, επίλεξε ακριβώς τις αντίστοιχες εξαιρέσεις ώστε να συνυπολογιστούν μία φορά. Τιμή ενός δωματίου δεν αποτελεί τελικό σύνολο πολλών δωματίων.</div>');
  root.querySelector('.hz-checkout-inquiry').value=inboxMessage(panel,details,offer);
  root.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function save(panel,root){
  const details=getPanelDetails(panel),i=Number(root.dataset.offerIndex);
  const offer=details?.data?.offers?.[i],hotel=details?.hotel,info=panel._hotelInfo;
  if(!offer||!info||!hotel)return;
  const a=capture(root,offer,info);
  // Confirm the current quote belongs to the exact guest composition used in the search.
  const party=typeof state!=='undefined'&&state?.travelers?state.travelers:null;
  if(party&&((Number(party.adults)||1)!==info.adults||
       (Number(party.children)||0)!==info.children||
       (Number(party.infants)||0)!==info.infants||
       (info.children>0&&JSON.stringify(party.childrenAges||[])!==JSON.stringify(info.childrenAges||[])))){
    status(root,'Άλλαξε η σύνθεση των ταξιδιωτών. Κάνε νέα αναζήτηση πριν καταχωρίσεις συνολικό ποσό.');return;
  }
  // Paid stays at Greek hotels, rooms and vacation rentals normally carry the statutory fee.
  // Even if the exact rate is unknown, "not applicable" must not silently pass the audit.
  a.climateApplicable=(window.HORIZON_DESTINATIONS||[]).some(
    d=>d.name===info.name&&d.region==='Ελλάδα'
  );
  const out=assess(a);
  if(!out.complete){
    status(root,'Ανεπαρκής επαλήθευση · δεν αλλάζει το budget: '+out.problems.join(' '));return;
  }
  const fetched=Date.parse(details.data.retrievedAt||'');
  if(!Number.isFinite(fetched)||fetched>Date.now()+30000||Date.now()-fetched>=AGE_LIMIT_MS){
    status(root,'Η προσφορά από τη Google Hotels έχει παλιώσει. Ξαναφόρτωσε τα στοιχεία του καταλύματος πριν συνδέσεις τον έλεγχο με το budget.');return;
  }
  const fee=window.HORIZON_HOTEL_CLIMATE_FEE?.estimate?.({
    checkInDate:info.checkIn,checkOutDate:info.checkOut,
    hotelClass:hotel.hotelClass,type:hotel.type||'hotel',
    countryCode:(window.HORIZON_DESTINATIONS||[]).some(d=>d.name===info.name&&d.region==='Ελλάδα')?'GR':null
  })||null;
  const key='hz-hotel-selection-v1:'+
    [info.name,info.checkIn,info.checkOut,info.adults,info.children,info.infants,
      ...(info.children?(info.childrenAges||[]):[])].join('|');
  const record={
    at:fetched,editedAt:Date.now(),checkoutAt:Date.now(),
    destination:info.name,checkInDate:info.checkIn,checkOutDate:info.checkOut,
    nights:info.nights,adults:info.adults,children:info.children,infants:info.infants,
    childrenAges:info.childrenAges||[],
    name:hotel.name,id:hotel.id,
    seller:offer.seller,roomName:offer.roomName||null,bookingUrl:offer.bookingUrl,
    currency:'EUR',total:out.budgetTotal,userCheckoutTotal:out.budgetTotal,
    sellerCheckoutTotal:out.sellerTotal,confirmedClimateExtraEUR:out.separatelyConfirmedClimateFee,
    confirmedCribExtraEUR:out.separatelyConfirmedCribFee,roomsCount:a.roomsCount,
    providerQuotedTotal:Number(offer.total),priceSource:offer.seller,
    source:'User-entered seller checkout (not independently verified)',
    reviewEvidence:'manual_seller_checkout',checkoutReviewValid:true,
    taxStatus:'user_reported_all_mandatory_accounted_for',
    climateFeeIncluded:a.climateStatus==='included',
    possibleClimateFeeEUR:fee?.amountEUR??null,
    cribStatus:a.cribStatus,cribFee:a.cribStatus==='paid'?parseEuro(a.cribFee):0,
    breakfastIncluded:offer.breakfastIncluded??null,
    freeCancellation:offer.freeCancellation??null,
    bookingKind:offer.roomName?'named_room_offer':'seller_offer_room_not_supplied',
    bookingStatus:'checkout_user_reported_not_booked'
  };
  try{localStorage.setItem(key,JSON.stringify(record));}catch{
    status(root,'Η αποθήκευση στον browser απέτυχε. Δεν ενημερώθηκε το budget.');return;
  }
  status(root,'Καταχωρίστηκε χειροκίνητα συνολικό κόστος '+amount(out.budgetTotal)+
    (out.separatelyConfirmedClimateFee||out.separatelyConfirmedCribFee?
      ' (checkout '+amount(out.sellerTotal)+(out.separatelyConfirmedClimateFee?
      ' + τέλος '+amount(out.separatelyConfirmedClimateFee):'')+
      (out.separatelyConfirmedCribFee?' + κούνια '+amount(out.separatelyConfirmedCribFee):'')+')':'')+
    '. Το Horizon ΔΕΝ το επαλήθευσε ανεξάρτητα και ΔΕΝ πραγματοποιήθηκε κράτηση.',false);
  const chosen=panel.querySelector('.hz-hotel-selected');
  if(chosen)chosen.textContent='Χειροκίνητη καταχώριση συνολικού κόστους: '+amount(out.budgetTotal)+
    ' · '+offer.seller+(info.infants?' · τα βρέφη έχουν δηλωθεί σύμφωνα με τον χρήστη.':'.')+
    ' Τα χωριστά επιβεβαιωμένα τέλη και η τυχόν κούνια έχουν συνυπολογιστεί, για '+a.roomsCount+' δωμάτια. Δεν αποτελεί ανεξάρτητη επαλήθευση ή κράτηση.';
  document.dispatchEvent(new CustomEvent('horizon:live-stay-selected',{
    detail:{destination:info.name,selected:true,total:out.budgetTotal,currency:'EUR',
      evidence:'user_reported_seller_checkout'}
  }));
}
function copyInquiry(root){
  const textarea=root.querySelector('.hz-checkout-inquiry');
  if(!textarea)return;
  const t=textarea.value;
  if(navigator.clipboard?.writeText){
    navigator.clipboard.writeText(t).then(()=>status(root,'Οι ερωτήσεις αντιγράφηκαν.',false))
      .catch(()=>{textarea.focus();textarea.select();status(root,'Επίλεξε Αντιγραφή (Ctrl+C) από το εμφανιζόμενο κείμενο.');});
  }else{textarea.focus();textarea.select();status(root,'Επίλεξε Αντιγραφή (Ctrl+C) από το εμφανιζόμενο κείμενο.');}
}
function install(){
  if(document.getElementById('hz-checkout-audit-css'))return;
  const el=document.createElement('style');el.id='hz-checkout-audit-css';
  el.textContent=[
    '.hz-hotel-checkout-audit{margin:13px 0;padding:14px;border:1px solid #568275;background:#132a30;border-radius:13px;line-height:1.5}',
    '.hz-hotel-checkout-audit h5{font-size:.95rem;margin:0 0 6px}',
    '.hz-hotel-checkout-audit p{font-size:.77rem}',
    '.hz-hotel-checkout-warning{font-size:.76rem;color:#ffe0bc;margin:10px 0}',
    '.hz-checkout-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:14px 0}',
    '.hz-checkout-field{display:grid;gap:4px;font-size:.74rem;color:#c8d3dc}',
    '.hz-checkout-field input,.hz-checkout-field select{background:#0d2430;border:1px solid #608091;border-radius:8px;color:white;padding:10px;width:100%;min-width:0}',
    '.hz-checkout-checks{display:grid;gap:9px}',
    '.hz-checkout-check{display:flex;gap:8px;align-items:flex-start;font-size:.76rem;color:#d6e2e8}',
    '.hz-checkout-actions{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}',
    '.hz-checkout-actions button{border:1px solid #7eab99;background:#25483c;padding:10px 12px;color:white;border-radius:9px;cursor:pointer;font-weight:800}',
    '.hz-checkout-inquiry{margin-top:9px;min-height:75px;width:100%;background:#0c202c;color:#cee0ed;border:1px solid #355769;border-radius:8px;padding:10px;font-size:.73rem}',
    '[data-checkout-message]{font-size:.77rem;margin:9px 0}',
    '@media(max-width:650px){.hz-checkout-grid{grid-template-columns:1fr}}'
  ].join('');
  document.head.appendChild(el);
}
document.addEventListener('horizon:hotel-room-offers',event=>{
  const panel=event.detail?.panel;if(!panel)return;
  install();
  const old=panel.querySelector('.hz-hotel-checkout-audit');if(old)old.remove();
  panel.querySelectorAll('.hz-hotel-offer').forEach((card,i)=>{
    const offer=panel._hotelDetails?.data?.offers?.[i];if(!offer?.bookingUrl)return;
    const button=document.createElement('button');button.type='button';
    button.textContent='Έλεγχος checkout, βρέφους και κούνιας';
    button.className='hz-hotel-detail-btn';button.dataset.checkoutOfferIndex=String(i);
    card.appendChild(button);
  });
  if(hookedPanels.has(panel))return;
  hookedPanels.add(panel);
  panel.addEventListener('click',e=>{
    const btn=e.target.closest?.('[data-checkout-offer-index]');
    if(btn)render(panel,Number(btn.dataset.checkoutOfferIndex));
    const root=e.target.closest?.('.hz-hotel-checkout-audit');
    if(root&&e.target.closest?.('[data-hotel-audit-save]'))save(panel,root);
    if(root&&e.target.closest?.('[data-hotel-audit-copy]'))copyInquiry(root);
  },{once:false});
});
window.HorizonHotelCheckoutAudit={assess};
})();
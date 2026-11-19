(()=>{
'use strict';
const AGE_LIMIT_MS=30*60*1000;
const hookedPanels=new WeakSet();
function parseEuro(v){
  const raw=String(v??'').replace(/\s|€/g,'');
  const standardized=raw.includes(',')&&raw.includes('.')?raw.replace(/\./g,'').replace(',','.'):raw.replace(',','.');
  return /^\d+(?:\.\d{1,2})?$/.test(standardized)?Number(standardized):NaN;
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
  if(!a.roomConfirmed)problems.push('Δεν επιβεβαιώθηκε ο συγκεκριμένος τύπος δωματίου.');
  if(!a.infantIncluded)problems.push('Δεν επιβεβαιώθηκε ότι το βρέφος περιλαμβάνεται στην τιμή.');
  if(a.totalCoverage!=='all_in')problems.push('Δεν επιβεβαιώθηκε ότι το πληρωτέο περιλαμβάνει όλες τις υποχρεωτικές χρεώσεις.');
  if(!['free','paid','not_needed'].includes(a.cribStatus))
    problems.push('Δεν επιβεβαιώθηκε η δωρεάν/χρεώσιμη κούνια ή ότι δεν χρειάζεται.');
  if(a.cribStatus==='paid'&&(!validAmount(a.cribFee)||parseEuro(a.cribFee)<0))
    problems.push('Απαιτείται θετικό κόστος κούνιας όταν δηλώνεται χρεώσιμη.');
  if(!['included','not_applicable'].includes(a.climateStatus))
    problems.push('Το τέλος διαμονής/ανθεκτικότητας δεν έχει επιβεβαιωθεί ότι περιλαμβάνεται ή δεν εφαρμόζεται.');
  if(!a.cancellationReviewed)problems.push('Δεν έχουν ελεγχθεί οι όροι ακύρωσης.');
  if(a.capacityStatus==='insufficient')problems.push('Η πηγή δηλώνει ανεπαρκή χωρητικότητα για αυτό το δωμάτιο.');
  if(!a.bookingUrl||!/^https:\/\//i.test(a.bookingUrl))problems.push('Δεν υπάρχει ασφαλής σύνδεσμος για τον συγκεκριμένο πωλητή.');
  return {complete:problems.length===0,problems,manualOnly:true,
    budgetTotal:problems.length===0?Math.round(parseEuro(a.total)*100)/100:null};
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
function capture(root,offer){
  const value=key=>root.querySelector('[name="'+key+'"]')?.value||'';
  const checked=key=>!!root.querySelector('[name="'+key+'"]')?.checked;
  return {
    source:value('checkoutSource'),total:value('checkoutTotal'),
    datesConfirmed:checked('datesConfirmed'),
    partyConfirmed:checked('partyConfirmed'),
    roomConfirmed:checked('roomConfirmed'),
    infantIncluded:checked('infantIncluded'),
    totalCoverage:value('totalCoverage'),
    cribStatus:value('cribStatus'),cribFee:value('cribFee'),
    climateStatus:value('climateStatus'),
    cancellationReviewed:checked('cancellationReviewed'),
    capacityStatus:offer.capacityStatus,
    bookingUrl:offer.bookingUrl
  };
}
function inboxMessage(panel,details,offer){
  const info=panel._hotelInfo;
  return 'Καλησπέρα σας,\n\nΕνδιαφερόμαστε για διαμονή στο '+details.data.name+
    ' από '+info.checkIn+' έως '+info.checkOut+' ('+info.nights+' διανυκτερεύσεις), για '+
    info.adults+' ενήλικες, '+info.children+' παιδιά και '+info.infants+
    ' βρέφος/βρέφη (κάτω των 2 ετών).\n\n'+
    'Μπορείτε να επιβεβαιώσετε γραπτώς για την προσφορά '+offer.seller+
    (offer.roomName?' / '+offer.roomName:'')+':\n'+
    '1. Το συνολικό πληρωτέο ποσό σε ευρώ για όλη τη διαμονή, συμπεριλαμβανομένου του βρέφους, υποχρεωτικών φόρων/τελών και τυχόν χρέωσης κούνιας;\n'+
    '2. Αν επιτρέπεται βρέφος σε αυτόν τον τύπο δωματίου και αν υπάρχει διαθέσιμη βρεφική κούνια, με ακριβή τιμή και όρους προκράτησης;\n'+
    '3. Αν το τέλος ανθεκτικότητας στην κλιματική κρίση περιλαμβάνεται ή εξοφλείται χωριστά;\n'+
    '4. Αν συμπεριλαμβάνεται πρωινό;\n'+
    '5. Τους πλήρεις όρους ακύρωσης, την προθεσμία και τυχόν χρεώσεις;\n\n'+
    'Παρακαλώ επιβεβαιώστε ότι οι πληροφορίες αφορούν τις συγκεκριμένες ημερομηνίες και τον αριθμό επισκεπτών.\n\nΕυχαριστούμε.';
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
  const hasURL=typeof offer.bookingUrl==='string'&&offer.bookingUrl.startsWith('https://');
  root.dataset.offerIndex=String(index);
  const line=(name,label,kind)=>'<label class="hz-checkout-field">'+esc(label)+
    (kind||'<input type="text" name="'+name+'">')+'</label>';
  const sel=(name,items)=>'<select name="'+name+'">'+items.map(i=>'<option value="'+esc(i[0])+'">'+esc(i[1])+'</option>').join('')+'</select>';
  const yes=name=>'<label class="hz-checkout-check"><input type="checkbox" name="'+name+'"> ';
  root.innerHTML='<h5>Έλεγχος τελικής τιμής και βρεφικής κούνιας</h5>'+
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
    line('checkoutTotal','Σύνολο (€) που αναγράφεται πριν την πληρωμή','<input type="text" name="checkoutTotal" inputmode="decimal" placeholder="π.χ. 270,00">')+
    line('totalCoverage','Περιλαμβάνει όλες τις υποχρεωτικές χρεώσεις;',sel('totalCoverage',[
      ['unknown','Άγνωστο'],
      ['all_in','Ναι, όλα μέσα στο πληρωτέο ποσό'],
      ['not_all_in','Όχι / υπάρχουν επιπλέον χρεώσεις']
    ]))+
    line('cribStatus','Βρεφική κούνια',sel('cribStatus',[
      ['unknown','Δεν έχει επιβεβαιωθεί'],
      ['on_request','Μόνο κατόπιν αιτήματος · όχι επιβεβαιωμένη'],
      ['free','Επιβεβαιωμένη δωρεάν'],
      ['paid','Επιβεβαιωμένη με χρέωση'],
      ['not_available','Δεν υπάρχει διαθέσιμη'],
      ['not_needed','Δεν απαιτείται κούνια']
    ]))+
    line('cribFee','Χρέωση κούνιας (€), αν υπάρχει','<input type="text" name="cribFee" inputmode="decimal" placeholder="Μόνο εάν χρεώνεται">')+
    line('climateStatus','Τέλος διαμονής/ανθεκτικότητας',sel('climateStatus',[
      ['unknown','Άγνωστο'],
      ['included','Περιλαμβάνεται στο πληρωτέο ποσό'],
      ['excluded','Πληρώνεται επιπλέον · το ποσό δεν είναι τελικό'],
      ['not_applicable','Δεν εφαρμόζεται (επιβεβαιώθηκε)']
    ]))+
    '</div><div class="hz-checkout-checks">'+
    yes('datesConfirmed')+'Επαληθεύτηκαν οι ακριβείς ημερομηνίες.</label>'+
    yes('partyConfirmed')+'Επαληθεύτηκαν όλοι οι επισκέπτες (και το βρέφος).</label>'+
    yes('roomConfirmed')+'Επαληθεύτηκε ο συγκεκριμένος τύπος δωματίου / κρεβατιών.</label>'+
    yes('infantIncluded')+'Το βρέφος περιλαμβάνεται ρητά στο πληρωτέο ποσό.</label>'+
    yes('cancellationReviewed')+'Ελέγχθηκαν οι ακριβείς όροι ακύρωσης (ακόμη και αν δεν είναι δωρεάν).</label>'+
    '</div>'+
    '<div class="hz-checkout-actions">'+
    '<button type="button" data-hotel-audit-save>Καταχώριση ελέγχου (χωρίς κράτηση)</button>'+
    '<button type="button" data-hotel-audit-copy>Αντιγραφή ερωτήσεων προς το ξενοδοχείο</button></div>'+
    '<div data-checkout-message role="status" aria-live="polite">Το τελικό πληρωτέο ποσό δεν είναι επιβεβαιωμένο.</div>'+
    '<textarea class="hz-checkout-inquiry" readonly aria-label="Ερωτήσεις προς το ξενοδοχείο"></textarea>';
  root.querySelector('.hz-checkout-inquiry').value=inboxMessage(panel,details,offer);
  root.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function save(panel,root){
  const details=getPanelDetails(panel),i=Number(root.dataset.offerIndex);
  const offer=details?.data?.offers?.[i],hotel=details?.hotel,info=panel._hotelInfo;
  if(!offer||!info||!hotel)return;
  const a=capture(root,offer),out=assess(a);
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
    [info.name,info.checkIn,info.checkOut,info.adults,info.children,info.infants].join('|');
  const record={
    at:fetched,editedAt:Date.now(),checkoutAt:Date.now(),
    destination:info.name,checkInDate:info.checkIn,checkOutDate:info.checkOut,
    nights:info.nights,adults:info.adults,children:info.children,infants:info.infants,
    childrenAges:info.childrenAges||[],
    name:hotel.name,id:hotel.id,
    seller:offer.seller,roomName:offer.roomName||null,bookingUrl:offer.bookingUrl,
    currency:'EUR',total:out.budgetTotal,userCheckoutTotal:out.budgetTotal,
    providerQuotedTotal:Number(offer.total),priceSource:offer.seller,
    source:'User-entered seller checkout (not independently verified)',
    reviewEvidence:'manual_seller_checkout',checkoutReviewValid:true,
    taxStatus:'user_reported_all_mandatory_included',
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
  status(root,'Καταχωρίστηκε από τον χρήστη ποσό '+amount(out.budgetTotal)+
    ' από οθόνη checkout. Το Horizon ΔΕΝ το επαλήθευσε ανεξάρτητα και ΔΕΝ πραγματοποιήθηκε κράτηση.',false);
  const chosen=panel.querySelector('.hz-hotel-selected');
  if(chosen)chosen.textContent='Χειροκίνητη καταχώριση checkout: '+amount(out.budgetTotal)+
    ' · '+offer.seller+' · περιλαμβάνει το βρέφος και τις δηλωμένες χρεώσεις σύμφωνα με τον χρήστη.'+
    ' Δεν αποτελεί ανεξάρτητη επαλήθευση ή κράτηση.';
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
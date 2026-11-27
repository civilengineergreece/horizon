const JSON_HEADERS={'content-type':'application/json; charset=utf-8'};
const WORKER_CACHE_TTL=6*60*60;

function cors(request,env){
  const origin=request.headers.get('Origin')||'';
  const allowed=env.ALLOWED_ORIGIN||'https://civilengineergreece.github.io';
  const ok=!origin||origin===allowed||origin.startsWith('http://localhost:')||origin.startsWith('http://127.0.0.1:');
  return {
    'access-control-allow-origin':ok?(origin||allowed):allowed,
    'access-control-allow-methods':'GET,POST,OPTIONS',
    'access-control-allow-headers':'content-type',
    'access-control-expose-headers':'cf-cache-status,x-horizon-cache',
    'access-control-max-age':'86400',
    'vary':'Origin'
  };
}
function reply(request,env,data,status=200,extra={}){
  return new Response(JSON.stringify(data),{status,headers:{...JSON_HEADERS,...cors(request,env),...extra}});
}
function fail(request,env,status,message,details,extra={}){
  return reply(request,env,{ok:false,error:message,details:details||null,...extra},status,{'cache-control':'no-store'});
}
function cleanText(v,max=160){return String(v||'').trim().slice(0,max);}
function number(v,fallback=0){const n=Number(v);return Number.isFinite(n)?n:fallback;}
function isoDate(v){const s=String(v||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return null;const d=new Date(s+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s?s:null;}
function safeUrl(v){try{const u=new URL(String(v||''));return u.protocol==='https:'?u.toString():null;}catch{return null;}}
function norm(v){return String(v||'').trim().toLocaleLowerCase('el-GR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
async function body(request){
  const type=request.headers.get('content-type')||'';
  if(!type.includes('application/json'))throw new Error('Απαιτείται JSON request.');
  const text=await request.text();
  if(text.length>12000)throw new Error('Το request είναι πολύ μεγάλο.');
  return JSON.parse(text||'{}');
}
async function fetchJson(url,options={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),18000);
  try{
    const res=await fetch(url,{...options,signal:controller.signal});
    const text=await res.text();
    let data={};
    try{data=text?JSON.parse(text):{};}catch{data={raw:text};}
    if(!res.ok||data?.error){
      const e=new Error(data?.error||data?.message||`Provider HTTP ${res.status}`);
      e.status=res.status||502;e.data=data;throw e;
    }
    return data;
  }finally{clearTimeout(timer);}
}
function cacheHeaders(){return {'cache-control':`public, max-age=0, s-maxage=${WORKER_CACHE_TTL}`,'x-horizon-cache':'MISS'};}

function firstSerpImage(item){
  const images=Array.isArray(item?.images)?item.images:[];
  for(const image of images){
    const u=safeUrl(image?.thumbnail)||safeUrl(image?.original_image)||safeUrl(image?.url);
    if(u)return u;
  }
  return safeUrl(item?.thumbnail);
}

function hotelStars(v){
  const raw=String(v??'');
  const m=raw.match(/(?:^|[^\d])([1-5])(?:[^\d]|$)/);
  return m?Number(m[1]):null;
}
function hotelPriceTotal(rate){
  const afterTaxes=positivePrice(rate?.extracted_after_taxes_fees);
  const total=afterTaxes??positivePrice(rate?.extracted_lowest)??positivePrice(rate?.extracted_display_price);
  return {
    total:total??null,
    totalBeforeTaxesFees:positivePrice(rate?.extracted_before_taxes_fees),
    totalAfterTaxesFees:afterTaxes,
    taxStatus:afterTaxes!==null?'provider_reports_after_taxes_fees':total!==null?'taxes_and_fees_unknown':'total_not_provided'
  };
}
function hotelGuestCount(v){
  if(v===null||v===undefined||v==='')return null;
  const match=String(v).match(/^\s*(\d{1,2})(?:\s|$)/);
  const n=match?Number(match[1]):null;
  return Number.isInteger(n)&&n>=1&&n<=30?n:null;
}
function hotelBeds(raw){
  return (Array.isArray(raw)?raw:[]).slice(0,8).map(b=>({
    type:cleanText(b?.type||'',45),
    count:Number.isInteger(Number(b?.count))&&Number(b.count)>0&&Number(b.count)<=8?Number(b.count):null
  })).filter(x=>x.type);
}
function hotelCribAmenity(details){
  const candidates=[
    ...(Array.isArray(details?.amenities)?details.amenities.map(x=>({title:x,available:true})):[]),
    ...(Array.isArray(details?.amenities_detailed?.popular)?details.amenities_detailed.popular:[]),
    ...(Array.isArray(details?.amenities_detailed?.groups)?details.amenities_detailed.groups.flatMap(
      group=>Array.isArray(group?.list)?group.list:[]):[])
  ];
  const match=candidates.find(x=>/\bcrib\b|\bbaby cot\b|\binfant bed\b|βρεφικ|κούνια|κρεβατάκι/i.test(String(x?.title||''))&&x?.available!==false);
  if(!match)return {advertised:false,feeHint:'unknown',source:'none'};
  const label=String(match.label||'').toLowerCase();
  return {
    advertised:true,feeHint:/\bfree\b|δωρεάν/i.test(label)?'property_lists_free':
      /extra\s+charge|additional\s+fee|χρέωσ/i.test(label)?'property_lists_extra_charge':'unknown',
    source:'property_amenity_not_room_confirmation'
  };
}
function hotelOffer(item,seller,official,roomName,guestCount,fallbackLink,roomBeds){
  const quote=hotelPriceTotal(item?.total_rate||{});
  const directOfferLink=safeUrl(item?.link),inheritedSellerLink=safeUrl(fallbackLink);
  const link=directOfferLink||inheritedSellerLink;
  return {
    seller:cleanText(seller||'Μη κατονομασμένος πωλητής',120),
    official:official===true,
    roomName:cleanText(roomName||'',160)||null,
    numGuests:hotelGuestCount(item?.num_guests??guestCount),
    total:quote.total,currency:'EUR',
    totalBeforeTaxesFees:quote.totalBeforeTaxesFees,
    totalAfterTaxesFees:quote.totalAfterTaxesFees,taxStatus:quote.taxStatus,
    bookingUrl:link,
    bookingLinkScope:directOfferLink?'provider_rate_link':inheritedSellerLink?'inherited_seller_link':'not_supplied',
    freeCancellation:item?.free_cancellation===true?true:item?.free_cancellation===false?false:null,
    freeCancellationUntil:cleanText(item?.free_cancellation_until_date||'',80)||null,
    freeCancellationUntilTime:cleanText(item?.free_cancellation_until_time||'',40)||null,
    breakfastIncluded:item?.breakfast_included===true?true:item?.breakfast_included===false?false:null,
    beds:hotelBeds(item?.beds||roomBeds),
    bookingStatus:'linked_offer_not_checked_out'
  };
}
function normalizeHotelDetails(data,adults,children){
  const details=data?.property||data||{},out=[],seen=new Set();
  function add(offer){
    if(!(Number(offer.total)>0))return;
    const signature=[offer.seller,offer.roomName,offer.total,offer.bookingUrl].join('|');
    if(seen.has(signature))return;seen.add(signature);
    out.push({...offer,minimumSleepingGuestCount:adults+children,
      capacityStatus:offer.numGuests===null?'unknown':offer.numGuests>=adults+children?'listed_capacity_sufficient_for_non_infants':'insufficient',
      infantCotStatus:'unverified_contact_property',
      quoteSource:'Google Hotels Property Details via SerpApi'});
  }
  for(const seller of [...(Array.isArray(details.prices)?details.prices:[]),
                       ...(Array.isArray(details.featured_prices)?details.featured_prices:[])]){
    const rooms=Array.isArray(seller.rooms)?seller.rooms:[];
    if(rooms.length){
      for(const room of rooms.slice(0,12)){
        const rates=Array.isArray(room.rates)&&room.rates.length?room.rates:[room];
        for(const rate of rates.slice(0,8))add(hotelOffer(rate,seller.source,seller.official,room.name,
          rate.num_guests??room.num_guests??seller.num_guests,rate.link||room.link||seller.link,room.beds));
      }
    }else add(hotelOffer(seller,seller.source,seller.official,null,seller.num_guests,seller.link));
  }
  const crib=hotelCribAmenity(details);
  return {
    name:cleanText(details.name||'Κατάλυμα',180),address:cleanText(details.address||'',250)||null,
    hotelClass:hotelStars(details.hotel_class),
    propertyUrl:safeUrl(details.link),
    propertyPhone:cleanText(details.phone||'',60)||null,
    cribAdvertised:crib.advertised,
    cribFeeHint:crib.feeHint,
    cribEvidenceScope:crib.source,
    cribConfirmedForParty:false,
    offers:out.sort((a,b)=>a.total-b.total).slice(0,35)
  };
}
async function hotelDetails(request,env,input){
  const roomError=validateHotelRooms(input);
  if(roomError)return fail(request,env,422,roomError,null,{code:'UNSUPPORTED_ROOM_COUNT'});
  const propertyToken=String(input.propertyToken||'').trim();
  if(!/^[A-Za-z0-9_-]{10,220}$/.test(propertyToken)){
    return fail(request,env,400,'Χρειάζεται έγκυρος κωδικός καταλύματος.',null,{code:'INVALID_PROPERTY_TOKEN'});
  }
  const checkIn=isoDate(input.checkInDate),checkOut=isoDate(input.checkOutDate);
  if(!checkIn||!checkOut)return fail(request,env,400,'Χρειάζονται έγκυρες ημερομηνίες.',null,{code:'INVALID_DATES'});
  const nights=Math.round((Date.parse(checkOut)-Date.parse(checkIn))/86400000);
  if(nights<1||nights>90)return fail(request,env,400,'Η διαμονή πρέπει να είναι 1–90 βράδια.',null,{code:'INVALID_NIGHTS'});
  const adults=Number(input.adults),children=Number(input.children??0),infants=Number(input.infants??0);
  if(![adults,children,infants].every(Number.isInteger)||adults<1||adults>10||
     children<0||infants<0||children+infants>10){
    return fail(request,env,422,'Μη έγκυρος αριθμός ταξιδιωτών.',null,{code:'INVALID_OCCUPANCY'});
  }
  const ages=parseChildAges(input.childrenAges);
  if(ages.length!==children||ages.some(x=>!Number.isInteger(x)||x<1||x>17)){
    return fail(request,env,422,'Χρειάζονται οι πραγματικές ηλικίες των παιδιών.',null,{code:'CHILD_AGES_REQUIRED'});
  }
  if(!env.SERPAPI_API_KEY)return fail(request,env,503,'Δεν έχει ρυθμιστεί η υπηρεσία Google Hotels.',null,{code:'SERPAPI_KEY_REQUIRED'});
  const u=new URL('https://serpapi.com/search.json');
  for(const [key,value] of Object.entries({engine:'google_hotels',property_token:propertyToken,
    check_in_date:checkIn,check_out_date:checkOut,adults:String(adults),
    children:String(children+infants),currency:'EUR',gl:'gr',hl:'el',api_key:env.SERPAPI_API_KEY}))u.searchParams.set(key,value);
  if(children+infants)u.searchParams.set('children_ages',[...ages,...Array(infants).fill(1)].join(','));
  const data=await fetchJson(u.toString(),{headers:{accept:'application/json'}});
  const result=normalizeHotelDetails(data,adults,children);
  return reply(request,env,{ok:true,provider:'Google Hotels Property Details via SerpApi',
    propertyToken,checkInDate:checkIn,checkOutDate:checkOut,nights,adults,children,infants,
    retrievedAt:new Date().toISOString(),currency:'EUR',...result,
    disclaimer:'Προσφορές συγκεκριμένων δωματίων/πωλητών. Η επάρκεια κρεβατιών δεν αποδεικνύει ότι περιλαμβάνεται το βρέφος ή βρεφική κούνια. Η διαθεσιμότητα, η ακύρωση, το τέλος ανθεκτικότητας και η τελική τιμή επαληθεύονται πριν από πληρωμή.'},200,{'cache-control':'no-store'});
}

function positivePrice(v){
  if(v===null||v===undefined||v==='')return null;
  const n=Number(v);return Number.isFinite(n)&&n>0?Math.round(n*100)/100:null;
}
function normalizeGoogleHotel(item,currency,nights){
  const rate=item?.rate_per_night||{},totalRate=item?.total_rate||{};
  const nightly=positivePrice(rate.extracted_lowest)||positivePrice(rate.extracted_after_taxes_fees)||positivePrice(rate.extracted_display_price);
  // Only provider-reported totals are labelled as live offers; never manufacture
  // an "exact" total by multiplying a nightly price.
  const afterTaxes=positivePrice(totalRate.extracted_after_taxes_fees);
  const beforeTaxes=positivePrice(totalRate.extracted_before_taxes_fees);
  const providerTotal=positivePrice(totalRate.extracted_lowest)||positivePrice(totalRate.extracted_display_price);
  const total=afterTaxes??providerTotal??null;
  const taxStatus=afterTaxes!==null?'provider_reports_after_taxes_fees':
    total!==null?'taxes_and_fees_unknown':'total_not_provided';
  const totalEstimate=total===null&&nightly!==null?Math.round(nightly*nights*100)/100:null;
  const gps=item?.gps_coordinates||{};
  const amenities=(Array.isArray(item?.amenities)?item.amenities:[]).slice(0,12).map(x=>cleanText(x,70)).filter(Boolean);
  return {
    id:cleanText(item?.property_token||item?.name||'',220),propertyToken:cleanText(item?.property_token||'',220)||null,name:cleanText(item?.name||'Κατάλυμα',180),
    type:cleanText(item?.type||'unknown',80),hotelClass:hotelStars(item?.hotel_class),
    rating:number(item?.overall_rating,0)||null,reviews:number(item?.reviews,0)||null,
    nightly,total,totalEstimate,totalPriceBasis:total!==null?'provider_reported':'estimated_nightly_times_nights',
    totalBeforeTaxesFees:beforeTaxes,totalAfterTaxesFees:afterTaxes,taxStatus,
    currency,image:firstSerpImage(item),latitude:number(gps?.latitude,NaN),longitude:number(gps?.longitude,NaN),
    amenities,priceSource:cleanText(item?.price_source||'Google Hotels',100),source:'Google Hotels'
  };
}
function inputFromUrl(url){return Object.fromEntries(url.searchParams);}
function validateHotelRooms(input){
  for(const key of ['rooms','roomsCount','roomCount']){
    if(input[key]!==undefined&&input[key]!==null&&Number(input[key])!==1)
      return 'Η ζωντανή αναζήτηση δεν υποστηρίζει κατανομή πολλαπλών δωματίων. Χρειάζεται επιβεβαίωση συνολικής προσφοράς από τον πωλητή.';
  }
  if(input.roomAllocations!==undefined)return 'Η κατανομή επισκεπτών ανά δωμάτιο δεν υποστηρίζεται από τη ζωντανή αναζήτηση.';
  return null;
}
function parseChildAges(v){
  if(Array.isArray(v))return v.map(x=>Number(x));
  if(v==null||v==='')return [];
  return String(v).split(',').map(x=>Number(x.trim()));
}
async function stays(request,env,input){
  const roomError=validateHotelRooms(input);
  if(roomError)return fail(request,env,422,roomError,null,{code:'UNSUPPORTED_ROOM_COUNT'});
  const destination=cleanText(input.destination,120),checkIn=isoDate(input.checkInDate),checkOut=isoDate(input.checkOutDate);
  if(destination.length<2)return fail(request,env,400,'Χρειάζεται προορισμός.');
  if(!checkIn||!checkOut)return fail(request,env,400,'Χρειάζονται έγκυρες ημερομηνίες check-in και check-out.');
  const nights=Math.round((Date.parse(checkOut)-Date.parse(checkIn))/86400000);
  if(!Number.isFinite(nights)||nights<1||nights>90)return fail(request,env,400,'Το check-out πρέπει να είναι 1 έως 90 βράδια μετά το check-in.');
  const adults=Number(input.adults??2),children=Number(input.children??0),infants=Number(input.infants??0);
  if(![adults,children,infants].every(Number.isInteger)||adults<1||adults>10||
    children<0||infants<0||children+infants>10)
    return fail(request,env,422,'Μη έγκυρος αριθμός ταξιδιωτών.',null,{code:'INVALID_OCCUPANCY'});
  const childAges=parseChildAges(input.childrenAges);
  if(childAges.length!==children||childAges.some(x=>!Number.isInteger(x)||x<1||x>17)){
    return fail(request,env,422,'Για ακριβή αναζήτηση χρειάζονται οι ηλικίες όλων των παιδιών (1–17), εκτός βρεφών.',null,{code:'CHILD_AGES_REQUIRED'});
  }
  const providerAges=[...childAges,...Array(infants).fill(1)];
  const providerChildren=providerAges.length;
  if(providerChildren>10)return fail(request,env,422,'Η Google Hotels δέχεται έως 10 παιδιά συνολικά.',null,{code:'TOO_MANY_CHILDREN'});
  const nextPageToken=String(input.nextPageToken||'').trim();
  if(nextPageToken&&!/^[A-Za-z0-9_+\/=\-]{1,2048}$/.test(nextPageToken))
    return fail(request,env,400,'Μη έγκυρος κωδικός επόμενης σελίδας.',null,{code:'INVALID_NEXT_PAGE_TOKEN'});
  if(!env.SERPAPI_API_KEY)return fail(request,env,503,'Χρειάζεται SerpApi key για live τιμές.',null,{code:'SERPAPI_KEY_REQUIRED'});
  const currency='EUR',providerUrl=new URL('https://serpapi.com/search.json');
  providerUrl.searchParams.set('engine','google_hotels');providerUrl.searchParams.set('q',destination);
  providerUrl.searchParams.set('check_in_date',checkIn);providerUrl.searchParams.set('check_out_date',checkOut);
  providerUrl.searchParams.set('adults',String(adults));providerUrl.searchParams.set('children',String(providerChildren));
  if(providerChildren)providerUrl.searchParams.set('children_ages',providerAges.join(','));
  providerUrl.searchParams.set('currency',currency);providerUrl.searchParams.set('gl','gr');providerUrl.searchParams.set('hl','el');
  providerUrl.searchParams.set('sort_by','3');providerUrl.searchParams.set('api_key',env.SERPAPI_API_KEY);
  if(nextPageToken)providerUrl.searchParams.set('next_page_token',nextPageToken);
  const data=await fetchJson(providerUrl.toString(),{headers:{accept:'application/json'}});
  const properties=Array.isArray(data?.properties)?data.properties:[];
  const retrievedAt=new Date().toISOString();
  const results=properties.slice(0,20).map(x=>({...normalizeGoogleHotel(x,currency,nights),retrievedAt})).filter(x=>x.name);
  const page=data?.serpapi_pagination||{};
  const following=typeof page.next_page_token==='string'&&/^[A-Za-z0-9_+\/=\-]{1,2048}$/.test(page.next_page_token)?page.next_page_token:null;
  results.sort((a,b)=>(a.total??a.totalEstimate??1e15)-(b.total??b.totalEstimate??1e15));
  return reply(request,env,{ok:true,provider:'Google Hotels via SerpApi',destination,checkInDate:checkIn,checkOutDate:checkOut,nights,adults,children,infants,
    childrenAges:childAges,providerChildren,providerAges,currency,results,retrievedAt,
    pagination:{hasMore:!!following,nextPageToken:following,currentFrom:number(page.current_from,0)||null,currentTo:number(page.current_to,0)||null},
    disclaimer:'Τιμές Google Hotels για επιλεγμένες ημερομηνίες και ηλικίες. Έξοδα διαμονής, κλιματικής ανθεκτικότητας, τοπικοί φόροι και πολιτικές βρεφικής κούνιας χρειάζονται έλεγχο στο κατάλυμα πριν την κράτηση.',
    meta:{total:number(data?.search_information?.total_results,results.length),returned:results.length},
    cache:{enabled:true,layer:'cloudflare-workers-cache',ttlSeconds:WORKER_CACHE_TTL}},200,cacheHeaders());
}

const FLIGHT_IDS={
  'αθηνα':'ATH','athens':'ATH','athina':'ATH','θεσσαλονικη':'SKG','thessaloniki':'SKG','ιωαννινα':'IOA','ioannina':'IOA',
  'σοφια':'SOF','sofia':'SOF','τιρανα':'TIA','tirana':'TIA','σκοπια':'SKP','skopje':'SKP','βελιγραδι':'BEG','belgrade':'BEG',
  'βουκουρεστι':'OTP','bucharest':'OTP','σαραγεβο':'SJJ','sarajevo':'SJJ','ζαγκρεμπ':'ZAG','zagreb':'ZAG','ντουμπροβνικ':'DBV','dubrovnik':'DBV',
  'σπλιτ':'SPU','split':'SPU','λιουμπλιανα':'LJU','ljubljana':'LJU','κωνσταντινουπολη':'IST','istanbul':'IST','ανταλεια':'AYT','antalya':'AYT',
  'παφος':'PFO','paphos':'PFO','λεμεσος':'LCA,PFO','limassol':'LCA,PFO','ναξος':'JNX','naxos':'JNX','συρος':'JSY','syros':'JSY',
  'ροδος':'RHO','rhodes':'RHO','κερκυρα':'CFU','corfu':'CFU','σαντορινη':'JTR','santorini':'JTR','μυκονος':'JMK','mykonos':'JMK',
  'παρος':'PAS','paros':'PAS','μηλος':'MLO','milos':'MLO','χιος':'JKH','chios':'JKH','λεσβος':'MJT','lesvos':'MJT','σαμος':'SMI','samos':'SMI',
  'κως':'KGS','kos':'KGS','καρπαθος':'AOK','karpathos':'AOK','σκιαθος':'JSI','skiathos':'JSI','κρητη':'HER,CHQ','crete':'HER,CHQ',
  'καλαματα':'KLX','kalamata':'KLX','παργα':'PVK','parga':'PVK','χαλκιδικη':'SKG','halkidiki':'SKG','μπανσκο':'SOF','bansko':'SOF'
};
function directFlightId(q){return FLIGHT_IDS[norm(q)]||null;}
async function resolveFlightId(q,env){
  const direct=directFlightId(q);if(direct)return {id:direct,via:'static'};
  const u=new URL('https://serpapi.com/search.json');
  u.searchParams.set('engine','google_flights_autocomplete');u.searchParams.set('q',cleanText(q,100));
  u.searchParams.set('exclude_regions','true');u.searchParams.set('gl','gr');u.searchParams.set('hl','el');u.searchParams.set('api_key',env.SERPAPI_API_KEY);
  const data=await fetchJson(u.toString(),{headers:{accept:'application/json'}});
  const suggestions=Array.isArray(data?.suggestions)?data.suggestions:[];
  const city=suggestions.find(x=>x?.type==='city')||suggestions[0];
  const id=cleanText(city?.id,120)||(Array.isArray(city?.airports)?city.airports.map(a=>cleanText(a?.id,8)).filter(Boolean).slice(0,3).join(','):'');
  if(!id)throw new Error(`Δεν βρέθηκε αεροπορικός προορισμός για «${cleanText(q,80)}».`);
  return {id,name:cleanText(city?.name,100),via:'autocomplete'};
}
function normalizeFlightOption(item,currency){
  const legs=Array.isArray(item?.flights)?item.flights:[];if(!legs.length)return null;
  const first=legs[0],last=legs[legs.length-1];
  const segments=legs.map(x=>({airline:cleanText(x?.airline,80),flightNumber:cleanText(x?.flight_number,30),durationMinutes:number(x?.duration,0)||null,departure:{airport:cleanText(x?.departure_airport?.id,8),name:cleanText(x?.departure_airport?.name,120),time:cleanText(x?.departure_airport?.time,40)},arrival:{airport:cleanText(x?.arrival_airport?.id,8),name:cleanText(x?.arrival_airport?.name,120),time:cleanText(x?.arrival_airport?.time,40)}}));
  const airlines=[...new Set(segments.map(x=>x.airline).filter(Boolean))];
  return {price:number(item?.price,0)||null,currency,durationMinutes:number(item?.total_duration,0)||segments.reduce((s,x)=>s+(x.durationMinutes||0),0)||null,stops:Math.max(0,segments.length-1),airlines,departure:segments[0].departure,arrival:segments[segments.length-1].arrival,segments,type:cleanText(item?.type,80),source:'Google Flights',departureToken:cleanText(item?.departure_token,5000),bookingToken:cleanText(item?.booking_token,5000),fareDetails:{baggage:'unknown',infantBreakdown:'unknown',airportTransfers:'not_included'}};
}

function flightPassengers(input){
  const read=(v,def)=>v===undefined||v===null||v===''?def:Number(v);
  const adults=read(input?.adults,1),children=read(input?.children,0),infants=read(input?.infants,0);
  if(![adults,children,infants].every(Number.isInteger)||
     adults<1||adults>9||children<0||children>8||infants<0||infants>8||
     infants>adults||adults+children+infants>9)return null;
  return {adults,children,infants};
}
function validAirportsAndDate(item,fromId,toId,date){
  const first=item?.segments?.[0],last=item?.segments?.at(-1);
  if(!first||!last)return false;
  const codes=v=>/^[A-Z]{3}(?:,[A-Z]{3})*$/.test(v)?v.split(','):null;
  const fromCodes=codes(fromId),toCodes=codes(toId);
  if(fromCodes&&!fromCodes.includes(first.departure?.airport))return false;
  if(toCodes&&!toCodes.includes(last.arrival?.airport))return false;
  return String(first.departure?.time||'').slice(0,10)===date;
}
function flightInputFromUrl(url){return {origin:url.searchParams.get('origin'),destination:url.searchParams.get('destination'),outboundDate:url.searchParams.get('outboundDate'),returnDate:url.searchParams.get('returnDate'),adults:url.searchParams.get('adults'),children:url.searchParams.get('children'),infants:url.searchParams.get('infants')};}
async function flights(request,env,input){
  if(!env.SERPAPI_API_KEY)return fail(request,env,503,'Χρειάζεται SerpApi key για live πτήσεις.',null,{code:'SERPAPI_KEY_REQUIRED'});
  const origin=cleanText(input.origin,100),destination=cleanText(input.destination,100),outbound=isoDate(input.outboundDate),ret=isoDate(input.returnDate);
  if(origin.length<2||destination.length<2)return fail(request,env,400,'Χρειάζονται αφετηρία και προορισμός.');
  if(!outbound)return fail(request,env,400,'Χρειάζεται έγκυρη ημερομηνία αναχώρησης.');
  if(ret&&ret<outbound)return fail(request,env,400,'Η επιστροφή πρέπει να είναι μετά την αναχώρηση.');
  const pax=flightPassengers(input);if(!pax)return fail(request,env,422,'Μη έγκυρος αριθμός ταξιδιωτών: έως 9 συνολικά, και κάθε βρέφος αγκαλιάς χρειάζεται έναν ενήλικα.',null,{code:'INVALID_PASSENGERS'});
  const {adults,children,infants}=pax;
  const [from,to]=await Promise.all([resolveFlightId(origin,env),resolveFlightId(destination,env)]);
  const currency='EUR',u=new URL('https://serpapi.com/search.json');
  u.searchParams.set('engine','google_flights');u.searchParams.set('departure_id',from.id);u.searchParams.set('arrival_id',to.id);
  u.searchParams.set('outbound_date',outbound);u.searchParams.set('type',ret?'1':'2');if(ret)u.searchParams.set('return_date',ret);
  u.searchParams.set('adults',String(adults));u.searchParams.set('children',String(children));if(infants)u.searchParams.set('infants_on_lap',String(infants));
  u.searchParams.set('currency',currency);u.searchParams.set('gl','gr');u.searchParams.set('hl','el');u.searchParams.set('travel_class','1');u.searchParams.set('sort_by','2');u.searchParams.set('api_key',env.SERPAPI_API_KEY);
  const data=await fetchJson(u.toString(),{headers:{accept:'application/json'}});
  const raw=[...(Array.isArray(data?.best_flights)?data.best_flights:[]),...(Array.isArray(data?.other_flights)?data.other_flights:[])];
  const results=raw.map(x=>normalizeFlightOption(x,currency)).filter(x=>x&&validAirportsAndDate(x,from.id,to.id,outbound)).sort((a,b)=>(a.price??1e15)-(b.price??1e15)).slice(0,15);
  return reply(request,env,{ok:true,provider:'Google Flights via SerpApi',origin,destination,resolved:{origin:from,destination:to},outboundDate:outbound,returnDate:ret||null,adults,children,infants,currency,results,priceInsights:data?.price_insights||null,fareScope:ret?'roundtrip_outbound_only':'one_way',retrievedAt:new Date().toISOString(),meta:{returned:results.length},cache:{enabled:false,layer:'none',ttlSeconds:0}},200,{'cache-control':'no-store'});
}


/**
 * A round-trip Google Flights response initially contains only outbound legs.
 * The selected outbound departure_token is REQUIRED to retrieve return choices.
 * Return result prices are quotes for the selected outbound+return combination.
 * No booking, baggage inclusion or ticket availability is guaranteed here.
 */
async function flightReturns(request,env,input){
  if(!env.SERPAPI_API_KEY)return fail(request,env,503,'Χρειάζεται SerpApi key για live πτήσεις.',null,{code:'SERPAPI_KEY_REQUIRED'});
  const origin=cleanText(input.origin,100),destination=cleanText(input.destination,100);
  const outbound=isoDate(input.outboundDate),ret=isoDate(input.returnDate);
  const departureToken=String(input.departureToken||'');
  if(origin.length<2||destination.length<2||!outbound||!ret||ret<outbound)return fail(request,env,400,'Χρειάζονται έγκυρα στοιχεία πτήσης μετ’ επιστροφής.');
  if(!departureToken||departureToken.length>5000)return fail(request,env,400,'Χρειάζεται έγκυρη επιλογή πτήσης αναχώρησης.');
  const pax=flightPassengers(input);
  if(!pax)return fail(request,env,422,'Μη έγκυρος αριθμός ταξιδιωτών.',null,{code:'INVALID_PASSENGERS'});
  const {adults,children,infants}=pax;
  const [from,to]=await Promise.all([resolveFlightId(origin,env),resolveFlightId(destination,env)]);
  const u=new URL('https://serpapi.com/search.json');
  u.searchParams.set('engine','google_flights');
  u.searchParams.set('departure_id',from.id);
  u.searchParams.set('arrival_id',to.id);
  u.searchParams.set('outbound_date',outbound);
  u.searchParams.set('return_date',ret);
  u.searchParams.set('type','1');
  u.searchParams.set('departure_token',departureToken);
  u.searchParams.set('adults',String(adults));
  u.searchParams.set('children',String(children));
  if(infants)u.searchParams.set('infants_on_lap',String(infants));
  u.searchParams.set('currency','EUR');
  u.searchParams.set('gl','gr');
  u.searchParams.set('hl','el');
  u.searchParams.set('travel_class','1');
  u.searchParams.set('sort_by','2');
  u.searchParams.set('api_key',env.SERPAPI_API_KEY);
  const data=await fetchJson(u.toString(),{headers:{accept:'application/json'}});
  const raw=[...(Array.isArray(data?.best_flights)?data.best_flights:[]),...(Array.isArray(data?.other_flights)?data.other_flights:[])];
  const results=raw.map(x=>normalizeFlightOption(x,'EUR')).filter(x=>x&&validAirportsAndDate(x,to.id,from.id,ret)).sort((a,b)=>(a.price??1e15)-(b.price??1e15)).slice(0,15);
  return reply(request,env,{ok:true,provider:'Google Flights via SerpApi',fareScope:'roundtrip_return_options',
    origin,destination,outboundDate:outbound,returnDate:ret,adults,children,infants,
    currency:'EUR',results,retrievedAt:new Date().toISOString(),
    fareNote:'Η τιμή αφορά τον επιλεγμένο συνδυασμό αναχώρησης και επιστροφής κατά την αναζήτηση. Αποσκευές, τυχόν βρεφικές επιβαρύνσεις και τελική διαθεσιμότητα απαιτούν έλεγχο πριν την κράτηση.'
  },200,{'cache-control':'no-store'});
}


/**
 * Google Flights booking_request is a genuine provider handoff, NOT seller
 * checkout confirmation. POST data is opaque and must not be changed to GET,
 * server-side fetched, rewritten, or submitted to non-Google hosts.
 */
function bookingHandoff(raw){
  if(!raw||typeof raw!=='object')return null;
  const url=safeUrl(raw.url);
  if(!url)return null;
  let u;
  try{u=new URL(url);}catch{return null;}
  if(u.username||u.password||u.port||
    ['localhost','127.0.0.1','0.0.0.0','::1'].includes(u.hostname.toLowerCase())||
    /^(?:10|127|169\.254|172\.(?:1[6-9]|2\d|3[01])|192\.168)\./.test(u.hostname))return null;
  if(raw.post_data!==undefined&&raw.post_data!==null&&raw.post_data!==''){
    if(!['www.google.com','google.com'].includes(u.hostname.toLowerCase())||
       u.pathname!=='/travel/clk/f'||u.search||
       typeof raw.post_data!=='string'||raw.post_data.length>32768||
       !/^[A-Za-z0-9_~-]+=[A-Za-z0-9_.~%+\-=]+(?:&[A-Za-z0-9_~-]+=[A-Za-z0-9_.~%+\-=]+)*$/.test(raw.post_data))return null;
    const params=new URLSearchParams(raw.post_data);
    if(![...params].length||[...params].length>5)return null;
    return {method:'POST',url,postData:raw.post_data,source:'google_flights_booking_request'};
  }
  return {method:'GET',url,source:'google_flights_booking_request'};
}
/**
 * Seller quotes for a selected itinerary. Google Flights can return booking
 * options and baggage policies for a booking_token. Quotes are NOT checkout
 * guarantees; booking handoff only occurs after explicit browser interaction.
 */
function normalizeBookingOptions(data){
  const textList=v=>Array.isArray(v)?v.filter(x=>typeof x==='string').map(x=>cleanText(x,240)).slice(0,12):[];
  const money=v=>{const n=Number(v);return Number.isFinite(n)&&n>0?Math.round(n*100)/100:null;};
  const baggage=Object.fromEntries(['together','departing','returning'].map(k=>[k,textList(data?.baggage_prices?.[k])]));
  const results=(Array.isArray(data?.booking_options)?data.booking_options:[]).slice(0,40).map((option,index)=>{
    const together=option?.together||null,departing=option?.departing||null,returning=option?.returning||null;
    const total=money(together?.price) ?? (departing&&returning&&money(departing?.price)!==null&&money(returning?.price)!==null?
      Math.round((money(departing.price)+money(returning.price))*100)/100:null);
    const source=together||departing||{};
    const combined=bookingHandoff(together?.booking_request);
    const departingHandoff=bookingHandoff(departing?.booking_request);
    const returningHandoff=bookingHandoff(returning?.booking_request);
    const bookingActions=combined?[{part:'combined',seller:cleanText(together?.book_with||source.book_with,140),
      handoff:combined}]:option?.separate_tickets===true||returning?
      [{part:'departing',seller:cleanText(departing?.book_with,140),handoff:departingHandoff},
       {part:'returning',seller:cleanText(returning?.book_with,140),handoff:returningHandoff}]
        .filter(x=>x.handoff):departingHandoff?[{part:'departing',seller:cleanText(source.book_with,140),
      handoff:departingHandoff}]:[];
    const firstHandoff=bookingActions[0]?.handoff||null;
    return {id:index,seller:cleanText(source.book_with||'Μη κατονομασμένος πωλητής',140),
      separateTickets:option?.separate_tickets===true,
      departingSeller:cleanText(departing?.book_with||'',140)||null,returningSeller:cleanText(returning?.book_with||'',140)||null,
      price:total,currency:'EUR',priceScope:total!==null?'combined_quote':'not_available',
      baggage:{together:textList(together?.baggage_prices).length?textList(together.baggage_prices):baggage.together,
        departing:textList(departing?.baggage_prices).length?textList(departing.baggage_prices):baggage.departing,
        returning:textList(returning?.baggage_prices).length?textList(returning.baggage_prices):baggage.returning},
      bookingActions,
      bookingMethod:firstHandoff?firstHandoff.method==='POST'?'provider_post_required':'provider_direct_link':'not_supplied',
      bookingUrl:firstHandoff?.method==='GET'&&bookingActions.length===1?firstHandoff.url:null,
      infantFareBreakdown:null,
      note:'Τιμή πωλητή κατά την αναζήτηση, όχι εγγυημένη τελική χρέωση.'
    };
  }).filter(x=>x.price!==null).sort((a,b)=>a.price-b.price);
  return {results,baggage};
}

function pinnedFlightSegments(v){
  if(!Array.isArray(v)||!v.length||v.length>6)return null;
  const out=[];
  for(const segment of v){
    const n=cleanText(segment?.flightNumber,18).replace(/\s+/g,'').toUpperCase();
    const departureId=cleanText(segment?.departure?.airport,5).toUpperCase();
    const arrivalId=cleanText(segment?.arrival?.airport,5).toUpperCase();
    const date=String(segment?.departure?.time||'').slice(0,10);
    if(!/^[A-Z0-9]{2}\d{1,4}[A-Z]?$/.test(n)||
       !/^[A-Z]{3}$/.test(departureId)||!/^[A-Z]{3}$/.test(arrivalId)||
       !isoDate(date))return null;
    out.push({flight_number:n,departure_id:departureId,arrival_id:arrivalId,date});
  }
  return out;
}

function pinnedRouteMatches(segments,from,to,date){
  if(!segments?.length||segments[0].date!==date)return false;
  const airports=x=>/^[A-Z]{3}(?:,[A-Z]{3})*$/.test(x)?x.split(','):null;
  const a=airports(from),b=airports(to);
  if(a&&!a.includes(segments[0].departure_id))return false;
  if(b&&!b.includes(segments.at(-1).arrival_id))return false;
  for(let i=1;i<segments.length;i++)
    if(segments[i-1].arrival_id!==segments[i].departure_id)return false;
  return true;
}
function publicSelectedItinerary(data){
  const groups=Array.isArray(data?.selected_flights)?data.selected_flights:[];
  return groups.slice(0,3).map(g=>normalizeFlightOption(g,'EUR')).filter(Boolean).map(g=>({
    departure:g.departure,arrival:g.arrival,airlines:g.airlines,
    segments:g.segments.map(s=>({flightNumber:s.flightNumber,departure:s.departure,arrival:s.arrival}))
  }));
}
function selectedPinComparison(itinerary,outboundPins,returnPins){
  const expected=[...(outboundPins||[]),...(returnPins||[])];
  if(!expected.length||!itinerary?.length)return 'not_provided';
  const actual=itinerary.flatMap(g=>g.segments||[]);
  if(actual.length!==expected.length)return 'mismatch';
  const equal=actual.every((item,i)=>{
    const pin=expected[i];
    return String(item.flightNumber||'').replace(/\s+/g,'').toUpperCase()===pin.flight_number&&
      item.departure?.airport===pin.departure_id&&item.arrival?.airport===pin.arrival_id&&
      String(item.departure?.time||'').slice(0,10)===pin.date;
  });
  return equal?'confirmed':'mismatch';
}
async function flightBookingOptions(request,env,input){
  if(!env.SERPAPI_API_KEY)return fail(request,env,503,'Χρειάζεται SerpApi key για live πτήσεις.',null,{code:'SERPAPI_KEY_REQUIRED'});
  const token=String(input?.bookingToken||'');
  const outbound=isoDate(input?.outboundDate),ret=isoDate(input?.returnDate);
  const origin=cleanText(input?.origin,100),destination=cleanText(input?.destination,100);
  const outboundSegments=pinnedFlightSegments(input?.outboundSegments);
  const returnSegments=ret?pinnedFlightSegments(input?.returnSegments):null;
  const canPin=!!outboundSegments&&(!ret||!!returnSegments);
  if((!token&&!canPin)||token.length>5000||!outbound||origin.length<2||destination.length<2||ret&&ret<outbound){
    return fail(request,env,400,'Χρειάζεται έγκυρος κωδικός και στοιχεία επιλεγμένης πτήσης.');
  }
  const pax=flightPassengers(input);
  if(!pax)return fail(request,env,422,'Μη έγκυρος αριθμός ταξιδιωτών.',null,{code:'INVALID_PASSENGERS'});
  const {adults,children,infants}=pax;
  const [from,to]=await Promise.all([resolveFlightId(origin,env),resolveFlightId(destination,env)]);
  if(!token&&(!pinnedRouteMatches(outboundSegments,from.id,to.id,outbound)||
     ret&&!pinnedRouteMatches(returnSegments,to.id,from.id,ret))){
    return fail(request,env,400,'Τα επιλεγμένα δρομολόγια δεν ταιριάζουν στις ζητούμενες ημερομηνίες ή στα αεροδρόμια.',null,{code:'PINNED_FLIGHT_MISMATCH'});
  }
  const u=new URL('https://serpapi.com/search.json');
  const q={engine:'google_flights',departure_id:from.id,arrival_id:to.id,outbound_date:outbound,
    type:ret?'1':'2',adults:String(adults),children:String(children),currency:'EUR',
    gl:'gr',hl:'el',travel_class:'1',booking_token:token,api_key:env.SERPAPI_API_KEY};
  if(ret)q.return_date=ret;
  if(infants)q.infants_on_lap=String(infants);
  if(!token){delete q.booking_token;q.selected_flights_json=JSON.stringify({outbound:outboundSegments,...(ret?{return:returnSegments}:{})});}
  for(const [k,v] of Object.entries(q))u.searchParams.set(k,v);
  const data=await fetchJson(u.toString(),{headers:{accept:'application/json'}});
  const normalized=normalizeBookingOptions(data);
  const selectedItinerary=publicSelectedItinerary(data);
  const itineraryMatch=selectedPinComparison(selectedItinerary,outboundSegments,returnSegments);
  if(itineraryMatch==='mismatch')return fail(request,env,502,'Ο πάροχος επέστρεψε διαφορετικές πτήσεις από την επιλογή σου.',null,{code:'ITINERARY_MISMATCH'});
  return reply(request,env,{ok:true,provider:'Google Flights Booking Options via SerpApi',
    fareScope:ret?'roundtrip_seller_options':'oneway_seller_options',
    currency:'EUR',origin,destination,outboundDate:outbound,returnDate:ret||null,
    adults,children,infants,results:normalized.results,baggage:normalized.baggage,
    selectedItinerary,itineraryMatch,
    retrievedAt:new Date().toISOString(),
    lookupMethod:token?'booking_token':'selected_flights_json',infantBreakdownConfirmed:false,
    notice:'Οι προσφορές πωλητών, οι πολιτικές αποσκευών και οι χρεώσεις βρεφών υπόκεινται σε έλεγχο πριν την πληρωμή. Καμία τιμή δεν είναι εγγυημένη τιμή checkout.'},
    200,{'cache-control':'no-store'});
}

export default {
  async fetch(request,env){
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors(request,env)});
    const url=new URL(request.url);
    try{
      if(url.pathname==='/health')return reply(request,env,{ok:true,service:'Horizon Live API',providers:{googleHotels:{enabled:!!env.SERPAPI_API_KEY,via:'SerpApi'},googleFlights:{enabled:!!env.SERPAPI_API_KEY,via:'SerpApi'},liveCards:!!env.SERPAPI_API_KEY},cache:{enabled:true,layer:'cloudflare-workers-cache',ttlHours:WORKER_CACHE_TTL/3600}},200,{'cache-control':'no-store'});
      if(url.pathname==='/flight-capabilities'){
        return reply(request,env,{ok:true,service:'Horizon Flight Price Integrity',
          schemaVersion:3,quoteCacheNoStore:true,
          validatesRealCalendarDates:true,validatesTravelerCounts:true,
          validatesRouteAndReturn:true,validatesPinnedFlightIdentity:true
        },200,{'cache-control':'no-store'});
      }
      if(url.pathname==='/hotel-capabilities'){
        return reply(request,env,{ok:true,service:'Horizon Hotel Pricing',
          schemaVersion:5,hotelRoomOffers:true,hotelPagination:true,hotelMapCoordinates:true,hotelRoomTerms:true,infantAgeRule:'infant_is_age_1_for_google_hotels',
          requiresAgesForOtherChildren:true,taxBasisLabels:true,multiRoomSearch:false,validatesTravelerCounts:true,
          nightlyEstimateNeverReportedAsActualTotal:true
        },200,{'cache-control':'no-store'});
      }
      if(url.pathname==='/hotel-details'){
        if(request.method!=='POST')return fail(request,env,405,'Χρησιμοποίησε POST.');
        return await hotelDetails(request,env,await body(request));
      }
      if(url.pathname==='/stays'){
        if(request.method==='GET')return await stays(request,env,inputFromUrl(url));
        if(request.method==='POST')return await stays(request,env,await body(request));
        return fail(request,env,405,'Χρησιμοποίησε GET ή POST.');
      }
      if(url.pathname==='/flight-booking-options'){
        if(request.method!=='POST')return fail(request,env,405,'Χρησιμοποίησε POST.');
        return await flightBookingOptions(request,env,await body(request));
      }
      if(url.pathname==='/flight-returns'){
        if(request.method!=='POST')return fail(request,env,405,'Χρησιμοποίησε POST.');
        return await flightReturns(request,env,await body(request));
      }
      if(url.pathname==='/flights'){
        if(request.method==='GET')return await flights(request,env,flightInputFromUrl(url));
        if(request.method==='POST')return await flights(request,env,await body(request));
        return fail(request,env,405,'Χρησιμοποίησε GET ή POST.');
      }
      return fail(request,env,404,'Άγνωστο endpoint.');
    }catch(e){
      const status=Number(e.status)||0,text=String(e.message||'');
      if(status===429||/quota|limit|searches per month/i.test(text))return fail(request,env,429,'Έφτασες το δωρεάν όριο αναζητήσεων του μήνα.',null,{code:'FREE_QUOTA_REACHED'});
      return fail(request,env,status>=400&&status<600?502:400,'Ο πάροχος δεν ολοκλήρωσε την αναζήτηση. Δοκίμασε ξανά.',null,{code:'FLIGHT_PROVIDER_ERROR'});
    }
  }
};

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
function isoDate(v){return /^\d{4}-\d{2}-\d{2}$/.test(String(v||''))?String(v):null;}
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
function normalizeGoogleHotel(item,currency,nights){
  const nightly=number(item?.rate_per_night?.extracted_lowest,0)||null;
  let total=number(item?.total_rate?.extracted_lowest,0)||null;
  if(!total&&nightly&&nights)total=Math.round(nightly*nights*100)/100;
  const gps=item?.gps_coordinates||{};
  const amenities=(Array.isArray(item?.amenities)?item.amenities:[]).slice(0,12).map(x=>cleanText(x,70)).filter(Boolean);
  return {
    id:cleanText(item?.property_token||item?.name||'',220),name:cleanText(item?.name||'Κατάλυμα',180),
    type:cleanText(item?.type||'hotel',80),hotelClass:number(item?.hotel_class,0)||null,
    rating:number(item?.overall_rating,0)||null,reviews:number(item?.reviews,0)||null,
    nightly,total,currency,image:firstSerpImage(item),latitude:number(gps?.latitude,NaN),longitude:number(gps?.longitude,NaN),
    amenities,priceSource:cleanText(item?.price_source||'Google Hotels',100),source:'Google Hotels'
  };
}
function inputFromUrl(url){return {destination:url.searchParams.get('destination'),checkInDate:url.searchParams.get('checkInDate'),checkOutDate:url.searchParams.get('checkOutDate'),adults:url.searchParams.get('adults'),children:url.searchParams.get('children')};}
async function stays(request,env,input){
  const destination=cleanText(input.destination,120),checkIn=isoDate(input.checkInDate),checkOut=isoDate(input.checkOutDate);
  if(destination.length<2)return fail(request,env,400,'Χρειάζεται προορισμός.');
  if(!checkIn||!checkOut)return fail(request,env,400,'Χρειάζονται έγκυρες ημερομηνίες check-in και check-out.');
  if(checkOut<=checkIn)return fail(request,env,400,'Το check-out πρέπει να είναι μετά το check-in.');
  if(!env.SERPAPI_API_KEY)return fail(request,env,503,'Χρειάζεται SerpApi key για live τιμές.',null,{code:'SERPAPI_KEY_REQUIRED'});
  const adults=Math.min(10,Math.max(1,Math.floor(number(input.adults,2))));
  const children=Math.min(10,Math.max(0,Math.floor(number(input.children,0))));
  const nights=Math.max(1,Math.round((Date.parse(checkOut)-Date.parse(checkIn))/86400000)),currency='EUR';
  const providerUrl=new URL('https://serpapi.com/search.json');
  providerUrl.searchParams.set('engine','google_hotels');providerUrl.searchParams.set('q',destination);
  providerUrl.searchParams.set('check_in_date',checkIn);providerUrl.searchParams.set('check_out_date',checkOut);
  providerUrl.searchParams.set('adults',String(adults));providerUrl.searchParams.set('children',String(children));
  providerUrl.searchParams.set('currency',currency);providerUrl.searchParams.set('gl','gr');providerUrl.searchParams.set('hl','el');
  providerUrl.searchParams.set('sort_by','3');providerUrl.searchParams.set('api_key',env.SERPAPI_API_KEY);
  const data=await fetchJson(providerUrl.toString(),{headers:{accept:'application/json'}});
  const properties=Array.isArray(data?.properties)?data.properties:[];
  const results=properties.slice(0,20).map(x=>normalizeGoogleHotel(x,currency,nights)).filter(x=>x.name);
  results.sort((a,b)=>(a.nightly??1e15)-(b.nightly??1e15));
  return reply(request,env,{ok:true,provider:'Google Hotels via SerpApi',destination,checkInDate:checkIn,checkOutDate:checkOut,nights,adults,children,currency,results,meta:{total:number(data?.search_information?.total_results,results.length),returned:results.length},cache:{enabled:true,layer:'cloudflare-workers-cache',ttlSeconds:WORKER_CACHE_TTL}},200,cacheHeaders());
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
  return {price:number(item?.price,0)||null,currency,durationMinutes:number(item?.total_duration,0)||segments.reduce((s,x)=>s+(x.durationMinutes||0),0)||null,stops:Math.max(0,segments.length-1),airlines,departure:segments[0].departure,arrival:segments[segments.length-1].arrival,segments,type:cleanText(item?.type,80),source:'Google Flights'};
}
function flightInputFromUrl(url){return {origin:url.searchParams.get('origin'),destination:url.searchParams.get('destination'),outboundDate:url.searchParams.get('outboundDate'),returnDate:url.searchParams.get('returnDate'),adults:url.searchParams.get('adults'),children:url.searchParams.get('children'),infants:url.searchParams.get('infants')};}
async function flights(request,env,input){
  if(!env.SERPAPI_API_KEY)return fail(request,env,503,'Χρειάζεται SerpApi key για live πτήσεις.',null,{code:'SERPAPI_KEY_REQUIRED'});
  const origin=cleanText(input.origin,100),destination=cleanText(input.destination,100),outbound=isoDate(input.outboundDate),ret=isoDate(input.returnDate);
  if(origin.length<2||destination.length<2)return fail(request,env,400,'Χρειάζονται αφετηρία και προορισμός.');
  if(!outbound)return fail(request,env,400,'Χρειάζεται έγκυρη ημερομηνία αναχώρησης.');
  if(ret&&ret<outbound)return fail(request,env,400,'Η επιστροφή πρέπει να είναι μετά την αναχώρηση.');
  const adults=Math.min(9,Math.max(1,Math.floor(number(input.adults,1)))),children=Math.min(8,Math.max(0,Math.floor(number(input.children,0)))),infants=Math.min(8,Math.max(0,Math.floor(number(input.infants,0))));
  const [from,to]=await Promise.all([resolveFlightId(origin,env),resolveFlightId(destination,env)]);
  const currency='EUR',u=new URL('https://serpapi.com/search.json');
  u.searchParams.set('engine','google_flights');u.searchParams.set('departure_id',from.id);u.searchParams.set('arrival_id',to.id);
  u.searchParams.set('outbound_date',outbound);u.searchParams.set('type',ret&&ret>outbound?'1':'2');if(ret&&ret>outbound)u.searchParams.set('return_date',ret);
  u.searchParams.set('adults',String(adults));u.searchParams.set('children',String(children));if(infants)u.searchParams.set('infants_on_lap',String(infants));
  u.searchParams.set('currency',currency);u.searchParams.set('gl','gr');u.searchParams.set('hl','el');u.searchParams.set('travel_class','1');u.searchParams.set('sort_by','2');u.searchParams.set('api_key',env.SERPAPI_API_KEY);
  const data=await fetchJson(u.toString(),{headers:{accept:'application/json'}});
  const raw=[...(Array.isArray(data?.best_flights)?data.best_flights:[]),...(Array.isArray(data?.other_flights)?data.other_flights:[])];
  const results=raw.map(x=>normalizeFlightOption(x,currency)).filter(Boolean).sort((a,b)=>(a.price??1e15)-(b.price??1e15)).slice(0,15);
  return reply(request,env,{ok:true,provider:'Google Flights via SerpApi',origin,destination,resolved:{origin:from,destination:to},outboundDate:outbound,returnDate:ret||null,adults,children,infants,currency,results,priceInsights:data?.price_insights||null,meta:{returned:results.length},cache:{enabled:true,layer:'cloudflare-workers-cache',ttlSeconds:WORKER_CACHE_TTL}},200,cacheHeaders());
}

export default {
  async fetch(request,env){
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors(request,env)});
    const url=new URL(request.url);
    try{
      if(url.pathname==='/health')return reply(request,env,{ok:true,service:'Horizon Live API',providers:{googleHotels:{enabled:!!env.SERPAPI_API_KEY,via:'SerpApi'},googleFlights:{enabled:!!env.SERPAPI_API_KEY,via:'SerpApi'},liveCards:!!env.SERPAPI_API_KEY},cache:{enabled:true,layer:'cloudflare-workers-cache',ttlHours:WORKER_CACHE_TTL/3600}},200,{'cache-control':'no-store'});
      if(url.pathname==='/stays'){
        if(request.method==='GET')return await stays(request,env,inputFromUrl(url));
        if(request.method==='POST')return await stays(request,env,await body(request));
        return fail(request,env,405,'Χρησιμοποίησε GET ή POST.');
      }
      if(url.pathname==='/flights'){
        if(request.method==='GET')return await flights(request,env,flightInputFromUrl(url));
        if(request.method==='POST')return await flights(request,env,await body(request));
        return fail(request,env,405,'Χρησιμοποίησε GET ή POST.');
      }
      return fail(request,env,404,'Άγνωστο endpoint.');
    }catch(e){
      const status=Number(e.status)||0,text=String(e.message||'');
      if(status===429||/quota|limit|searches per month/i.test(text))return fail(request,env,429,'Έφτασες το δωρεάν όριο αναζητήσεων του μήνα.',e.data||null,{code:'FREE_QUOTA_REACHED'});
      return fail(request,env,status>=400&&status<600?502:400,text||'Σφάλμα live provider',e.data||null);
    }
  }
};

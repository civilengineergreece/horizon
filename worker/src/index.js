const JSON_HEADERS={'content-type':'application/json; charset=utf-8'};
let tokenCache={token:null,expiresAt:0,key:''};

function cors(request,env){
  const origin=request.headers.get('Origin')||'';
  const allowed=env.ALLOWED_ORIGIN||'https://civilengineergreece.github.io';
  const ok=!origin||origin===allowed||origin.startsWith('http://localhost:')||origin.startsWith('http://127.0.0.1:');
  return {
    'access-control-allow-origin':ok?(origin||allowed):allowed,
    'access-control-allow-methods':'GET,POST,OPTIONS',
    'access-control-allow-headers':'content-type',
    'access-control-max-age':'86400',
    'vary':'Origin'
  };
}
function reply(request,env,data,status=200,extra={}){
  return new Response(JSON.stringify(data),{status,headers:{...JSON_HEADERS,...cors(request,env),...extra}});
}
function fail(request,env,status,message,details){return reply(request,env,{ok:false,error:message,details:details||null},status);}
function cleanText(v,max=160){return String(v||'').trim().slice(0,max);}
function number(v,fallback=0){const n=Number(v);return Number.isFinite(n)?n:fallback;}
function isoDate(v){return /^\d{4}-\d{2}-\d{2}$/.test(String(v||''))?String(v):null;}
function addDays(iso,n){const [y,m,d]=iso.split('-').map(Number);const x=new Date(Date.UTC(y,m-1,d));x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10);}
async function body(request){
  const type=request.headers.get('content-type')||'';
  if(!type.includes('application/json'))throw new Error('Απαιτείται JSON request.');
  const text=await request.text();
  if(text.length>20000)throw new Error('Το request είναι πολύ μεγάλο.');
  return JSON.parse(text||'{}');
}
async function fetchJson(url,options={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),15000);
  try{
    const res=await fetch(url,{...options,signal:controller.signal});
    const text=await res.text();
    let data={};
    try{data=text?JSON.parse(text):{};}catch{data={raw:text};}
    if(!res.ok){const e=new Error(`Provider HTTP ${res.status}`);e.status=res.status;e.data=data;throw e;}
    return data;
  }finally{clearTimeout(timer);}
}
function parseMaybeJson(v){if(v&&typeof v==='string'){try{return JSON.parse(v);}catch{return v;}}return v;}
function flatTolls(route){
  const raw=Array.isArray(route?.tolls)?route.tolls.flat(3):[];
  return raw.filter(x=>x&&typeof x==='object').slice(0,40).map(x=>({
    name:x.name||x.road||x.type||'Διόδιο',road:x.road||null,country:x.country||null,state:x.state||null,type:x.type||null,
    currency:x.currency||null,cashCost:x.cashCost??null,creditCardCost:x.creditCardCost??null,tagCost:x.tagCost??null,
    prepaidCardCost:x.prepaidCardCost??null,licensePlateCost:x.licensePlateCost??null
  }));
}
function routeCost(costs={}){
  const preferred=[costs.cash,costs.creditCard,costs.prepaidCard,costs.tag,costs.licensePlate].map(Number).filter(Number.isFinite);
  const base=preferred.length?preferred[0]:0;
  return Math.max(0,base+number(costs.otherCost,0));
}
function normalizeRoad(data,consumptionL100=7.5,fuelPriceEur=2){
  const routes=Array.isArray(data?.routes)?data.routes:[];
  return routes.slice(0,3).map((r,i)=>{
    const duration=parseMaybeJson(r?.summary?.duration)||{};
    const distance=parseMaybeJson(r?.summary?.distance)||{};
    const distanceM=number(distance?.value,0);
    const distanceKm=distanceM>0?distanceM/1000:0;
    const hours=number(duration?.value,0)/3600;
    const fuelLiters=distanceKm*consumptionL100/100;
    const fuelCost=fuelLiters*fuelPriceEur;
    const tolls=flatTolls(r);
    const explicitVignettes=(Array.isArray(r?.vignettes)?r.vignettes:[]).slice(0,20);
    return {
      index:i,name:r?.summary?.name||`Διαδρομή ${i+1}`,hasTolls:!!r?.summary?.hasTolls,
      distanceKm:Math.round(distanceKm*10)/10,hours:Math.round(hours*100)/100,
      tollCost:Math.round(routeCost(r?.costs)*100)/100,fuelLiters:Math.round(fuelLiters*10)/10,
      fuelCost:Math.round(fuelCost*100)/100,totalRoadCost:Math.round((routeCost(r?.costs)+fuelCost)*100)/100,
      costs:r?.costs||{},tolls,vignettes:explicitVignettes,mapUrl:r?.summary?.url||null
    };
  });
}
async function road(request,env){
  if(!env.TOLLGURU_API_KEY)return fail(request,env,503,'Το TollGuru API δεν έχει συνδεθεί ακόμη.');
  const b=await body(request),origin=cleanText(b.origin),destination=cleanText(b.destination);
  if(origin.length<2||destination.length<2)return fail(request,env,400,'Χρειάζονται αφετηρία και προορισμός.');
  const consumption=Math.min(30,Math.max(1,number(b.consumptionL100,7.5)));
  const fuelPrice=Math.min(5,Math.max(.5,number(b.fuelPriceEur,2)));
  const payload={from:{address:origin},to:{address:destination},waypoints:[],serviceProvider:'here',vehicle:{type:'2AxlesAuto'}};
  if(b.departureDateTime)payload.departure_time=cleanText(b.departureDateTime,40);
  const data=await fetchJson('https://apis.tollguru.com/toll/v2/origin-destination-waypoints',{
    method:'POST',headers:{'content-type':'application/json','x-api-key':env.TOLLGURU_API_KEY},body:JSON.stringify(payload)
  });
  const routes=normalizeRoad(data,consumption,fuelPrice);
  return reply(request,env,{ok:true,provider:'TollGuru',live:true,origin,destination,consumptionL100:consumption,fuelPriceEur:fuelPrice,routes});
}
function amadeusBase(env){return String(env.AMADEUS_ENV||'test').toLowerCase()==='production'?'https://api.amadeus.com':'https://test.api.amadeus.com';}
async function amadeusToken(env){
  if(!env.AMADEUS_CLIENT_ID||!env.AMADEUS_CLIENT_SECRET)throw new Error('Το Amadeus API δεν έχει συνδεθεί ακόμη.');
  const key=`${env.AMADEUS_ENV||'test'}:${env.AMADEUS_CLIENT_ID}`;
  if(tokenCache.token&&tokenCache.key===key&&Date.now()<tokenCache.expiresAt-60000)return tokenCache.token;
  const form=new URLSearchParams({grant_type:'client_credentials',client_id:env.AMADEUS_CLIENT_ID,client_secret:env.AMADEUS_CLIENT_SECRET});
  const data=await fetchJson(`${amadeusBase(env)}/v1/security/oauth2/token`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:form.toString()});
  tokenCache={token:data.access_token,expiresAt:Date.now()+number(data.expires_in,1800)*1000,key};
  return tokenCache.token;
}
async function amadeusGet(env,path,params={}){
  const token=await amadeusToken(env),url=new URL(`${amadeusBase(env)}${path}`);
  Object.entries(params).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=='')url.searchParams.set(k,String(v));});
  return fetchJson(url.toString(),{headers:{authorization:`Bearer ${token}`}});
}
async function resolveLocation(env,keyword){
  const q=cleanText(keyword,70);if(q.length<3)throw new Error('Η τοποθεσία είναι πολύ σύντομη.');
  const data=await amadeusGet(env,'/v1/reference-data/locations',{subType:'CITY,AIRPORT',keyword:q.slice(0,10),view:'LIGHT'});
  const items=Array.isArray(data?.data)?data.data:[];
  const best=items.find(x=>x.subType==='CITY')||items[0];
  if(!best)throw new Error(`Δεν βρέθηκε αεροπορική τοποθεσία για «${q}».`);
  return {iataCode:best.iataCode,name:best.name||q,subType:best.subType,geoCode:best.geoCode||null,address:best.address||null};
}
function flightSummary(offer,date){
  const its=Array.isArray(offer?.itineraries)?offer.itineraries:[];
  const legs=its.map(it=>{
    const segs=Array.isArray(it.segments)?it.segments:[];
    return {
      duration:it.duration||null,stops:Math.max(0,segs.length-1),
      departure:segs[0]?.departure||null,arrival:segs.at(-1)?.arrival||null,
      carriers:[...new Set(segs.map(s=>s.carrierCode).filter(Boolean))]
    };
  });
  return {id:offer.id||null,date,total:number(offer?.price?.grandTotal||offer?.price?.total,0),currency:offer?.price?.currency||'EUR',oneWay:!!offer?.oneWay,validatingAirlineCodes:offer?.validatingAirlineCodes||[],legs};
}
async function flights(request,env){
  const b=await body(request),origin=cleanText(b.origin),destination=cleanText(b.destination),departure=isoDate(b.departureDate);
  if(!departure)return fail(request,env,400,'Χρειάζεται έγκυρη ημερομηνία αναχώρησης.');
  const duration=Math.max(1,Math.floor(number(b.duration,1))),flex=Math.min(3,Math.max(0,Math.floor(number(b.flexDays,0))));
  const adults=Math.min(9,Math.max(1,Math.floor(number(b.adults,1)))),children=Math.min(8,Math.max(0,Math.floor(number(b.children,0))));
  const [o,d]=await Promise.all([resolveLocation(env,origin),resolveLocation(env,destination)]);
  const dates=[];for(let i=-flex;i<=flex;i++){const x=addDays(departure,i);if(x>=new Date().toISOString().slice(0,10))dates.push(x);}
  const calls=dates.map(async dep=>{
    const ret=addDays(dep,duration-1);
    try{
      const data=await amadeusGet(env,'/v2/shopping/flight-offers',{originLocationCode:o.iataCode,destinationLocationCode:d.iataCode,departureDate:dep,returnDate:ret,adults,children:children||undefined,currencyCode:'EUR',max:10});
      return (data?.data||[]).map(x=>flightSummary(x,dep));
    }catch(e){return [];}
  });
  const offers=(await Promise.all(calls)).flat().filter(x=>x.total>0).sort((a,b)=>a.total-b.total).slice(0,20);
  return reply(request,env,{ok:true,provider:'Amadeus',live:String(env.AMADEUS_ENV||'test').toLowerCase()==='production',environment:env.AMADEUS_ENV||'test',origin:o,destination:d,offers});
}
async function resolveCity(env,keyword){
  const q=cleanText(keyword,70);
  try{
    const data=await amadeusGet(env,'/v1/reference-data/locations/cities',{keyword:q.slice(0,10),max:10,include:'AIRPORTS'});
    const items=Array.isArray(data?.data)?data.data:[];
    const best=items[0];
    if(best)return {name:best.name||q,iataCode:best.iataCode||null,geoCode:best.geoCode||null,address:best.address||null};
  }catch{}
  const loc=await resolveLocation(env,q);return {name:loc.name,iataCode:loc.iataCode,geoCode:loc.geoCode,address:loc.address};
}
function hotelOffer(item){
  const offer=Array.isArray(item?.offers)?item.offers[0]:null;
  if(!offer)return null;
  return {hotelId:item?.hotel?.hotelId||null,name:item?.hotel?.name||'Ξενοδοχείο',latitude:item?.hotel?.latitude??null,longitude:item?.hotel?.longitude??null,
    offerId:offer.id||null,checkInDate:offer.checkInDate||null,checkOutDate:offer.checkOutDate||null,roomQuantity:offer.roomQuantity||null,
    total:number(offer?.price?.total,0),currency:offer?.price?.currency||'EUR',room:offer?.room?.description?.text||offer?.room?.typeEstimated||null,policies:offer?.policies||null};
}
async function hotels(request,env){
  const b=await body(request),destination=cleanText(b.destination),checkIn=isoDate(b.checkInDate),duration=Math.max(1,Math.floor(number(b.duration,1)));
  if(!checkIn)return fail(request,env,400,'Χρειάζεται έγκυρη ημερομηνία check-in.');
  if(duration===1)return reply(request,env,{ok:true,provider:'Amadeus',live:String(env.AMADEUS_ENV||'test').toLowerCase()==='production',dayTrip:true,offers:[]});
  const adults=Math.min(9,Math.max(1,Math.floor(number(b.adults,1)))),rooms=Math.min(9,Math.max(1,Math.floor(number(b.rooms,Math.ceil(adults/2))))),checkOut=addDays(checkIn,duration-1);
  const city=await resolveCity(env,destination);
  let hotelIds=[];
  if(city.geoCode?.latitude&&city.geoCode?.longitude){
    const list=await amadeusGet(env,'/v1/reference-data/locations/hotels/by-geocode',{latitude:city.geoCode.latitude,longitude:city.geoCode.longitude,radius:15,radiusUnit:'KM',hotelSource:'ALL'});
    hotelIds=(list?.data||[]).map(x=>x.hotelId).filter(Boolean).slice(0,25);
  }else if(city.iataCode){
    const list=await amadeusGet(env,'/v1/reference-data/locations/hotels/by-city',{cityCode:city.iataCode});
    hotelIds=(list?.data||[]).map(x=>x.hotelId).filter(Boolean).slice(0,25);
  }
  if(!hotelIds.length)return reply(request,env,{ok:true,provider:'Amadeus',live:String(env.AMADEUS_ENV||'test').toLowerCase()==='production',city,offers:[]});
  const data=await amadeusGet(env,'/v3/shopping/hotel-offers',{hotelIds:hotelIds.join(','),adults,checkInDate:checkIn,checkOutDate:checkOut,roomQuantity:rooms,currency:'EUR',bestRateOnly:'true'});
  const offers=(data?.data||[]).map(hotelOffer).filter(Boolean).sort((a,b)=>a.total-b.total).slice(0,20);
  return reply(request,env,{ok:true,provider:'Amadeus',live:String(env.AMADEUS_ENV||'test').toLowerCase()==='production',environment:env.AMADEUS_ENV||'test',city,checkInDate:checkIn,checkOutDate:checkOut,rooms,offers});
}

export default {
  async fetch(request,env){
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors(request,env)});
    const url=new URL(request.url);
    try{
      if(url.pathname==='/health')return reply(request,env,{ok:true,service:'Horizon Live API',providers:{tollGuru:!!env.TOLLGURU_API_KEY,amadeus:!!(env.AMADEUS_CLIENT_ID&&env.AMADEUS_CLIENT_SECRET),amadeusEnvironment:env.AMADEUS_ENV||'test'}});
      if(request.method!=='POST')return fail(request,env,405,'Χρησιμοποίησε POST.');
      if(url.pathname==='/road')return await road(request,env);
      if(url.pathname==='/flights')return await flights(request,env);
      if(url.pathname==='/hotels')return await hotels(request,env);
      return fail(request,env,404,'Άγνωστο endpoint.');
    }catch(e){
      const status=e.status&&e.status>=400&&e.status<600?502:400;
      return fail(request,env,status,e.message||'Σφάλμα live provider',e.data||null);
    }
  }
};

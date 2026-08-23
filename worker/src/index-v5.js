import v4 from './index-v4.js';

const JSON_HEADERS={'content-type':'application/json; charset=utf-8'};
const TRANSITOUS_URL='https://api.transitous.org/api/v6/plan';
const TRAIN_TTL=10*60;

const STATIONS={
  'αθηνα':{name:'Αθήνα · Σταθμός Λαρίσης',coord:'37.99228,23.72056'},
  'athens':{name:'Αθήνα · Σταθμός Λαρίσης',coord:'37.99228,23.72056'},
  'athina':{name:'Αθήνα · Σταθμός Λαρίσης',coord:'37.99228,23.72056'},
  'θεσσαλονικη':{name:'Θεσσαλονίκη · Νέος Σιδηροδρομικός Σταθμός',coord:'40.64447,22.92914'},
  'thessaloniki':{name:'Θεσσαλονίκη · Νέος Σιδηροδρομικός Σταθμός',coord:'40.64447,22.92914'},
  'μετεωρα':{name:'Μετέωρα · Σταθμός Καλαμπάκας',coord:'39.70306,21.62556'},
  'meteora':{name:'Μετέωρα · Σταθμός Καλαμπάκας',coord:'39.70306,21.62556'},
  'καλαμπακα':{name:'Καλαμπάκα',coord:'39.70306,21.62556'},
  'kalambaka':{name:'Καλαμπάκα',coord:'39.70306,21.62556'},
  'λαρισα':{name:'Λάρισα',coord:'39.62950,22.42280'},
  'larissa':{name:'Λάρισα',coord:'39.62950,22.42280'}
};

function norm(v){return String(v||'').trim().toLocaleLowerCase('el-GR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
function clean(v,max=220){return String(v??'').trim().slice(0,max);}
function iso(v){return /^\d{4}-\d{2}-\d{2}$/.test(String(v||''))?String(v):null;}
function cors(request,env){
  const origin=request.headers.get('Origin')||'';
  const allowed=env.ALLOWED_ORIGIN||'https://civilengineergreece.github.io';
  const ok=!origin||origin===allowed||origin.startsWith('http://localhost:')||origin.startsWith('http://127.0.0.1:');
  return {'access-control-allow-origin':ok?(origin||allowed):allowed,'access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type','access-control-expose-headers':'cf-cache-status,x-horizon-cache','access-control-max-age':'86400','vary':'Origin'};
}
function reply(request,env,data,status=200,extra={}){return new Response(JSON.stringify(data),{status,headers:{...JSON_HEADERS,...cors(request,env),...extra}});}
function station(v){return STATIONS[norm(v)]||null;}
function timeForDate(date){return `${date}T00:00:00Z`;}
function asArray(v){return Array.isArray(v)?v:[];}
function number(v){const n=Number(v);return Number.isFinite(n)?n:null;}
function trainLegs(it){return asArray(it?.legs).filter(l=>['RAIL','HIGHSPEED_RAIL','LONG_DISTANCE','NIGHT_RAIL','REGIONAL_RAIL','REGIONAL_FAST_RAIL','SUBURBAN','SUBWAY'].includes(String(l?.mode||'').toUpperCase()));}
function firstValue(obj,names){for(const n of names){const v=obj?.[n];if(v!==undefined&&v!==null&&v!=='')return v;}return null;}
function collectFareProducts(v,out=[]){
  if(v==null)return out;
  if(Array.isArray(v)){for(const x of v)collectFareProducts(x,out);return out;}
  if(typeof v!=='object')return out;
  const amount=number(v.amount),currency=clean(v.currency||'',8).toUpperCase(),name=clean(v.name||'',120);
  if(amount!==null&&currency&&name)out.push({amount,currency,name,riderCategory:v.riderCategory||null});
  for(const [k,x] of Object.entries(v))if(k!=='riderCategory'&&k!=='media')collectFareProducts(x,out);
  return out;
}
function fareFromItinerary(it){
  // MOTIS fare composition can be complex. We only expose a feed fare when the
  // journey has one rail leg, where choosing the cheapest standard fare product
  // cannot undercount multiple mandatory train legs. Otherwise Horizon keeps an estimate.
  if(trainLegs(it).length!==1)return null;
  const transfers=asArray(it?.fareTransfers);if(!transfers.length)return null;
  const all=collectFareProducts(transfers,[]).filter(x=>x.amount>0&&!/(week|weekly|month|monthly|annual|season|day pass|24.?hour|7.?day|30.?day)/i.test(x.name));
  if(!all.length)return null;
  const defaults=all.filter(x=>x.riderCategory?.isDefaultFareCategory===true);
  const uncategorized=all.filter(x=>!x.riderCategory);
  const pool=defaults.length?defaults:uncategorized.length?uncategorized:all;
  pool.sort((a,b)=>a.amount-b.amount);
  const p=pool[0];
  return {amount:Math.round(p.amount*100)/100,currency:p.currency,kind:'feed-fare-direct',name:p.name,riderCategory:p.riderCategory?.riderCategoryName||null};
}
function normalizeItinerary(it){
  const legs=trainLegs(it);if(!legs.length)return null;
  const first=legs[0],last=legs[legs.length-1];
  const departure=firstValue(first,['startTime','expectedDeparture','scheduledStartTime','scheduledDeparture']);
  const scheduledDeparture=firstValue(first,['scheduledStartTime','scheduledDeparture']);
  const arrival=firstValue(last,['endTime','expectedArrival','scheduledEndTime','scheduledArrival']);
  const scheduledArrival=firstValue(last,['scheduledEndTime','scheduledArrival']);
  const durationSeconds=number(it?.duration);
  const delay=departure&&scheduledDeparture?Math.round((Date.parse(departure)-Date.parse(scheduledDeparture))/60000):null;
  const validDelay=Number.isFinite(delay)?delay:null;
  const route=clean(firstValue(first,['routeShortName','displayName','routeLongName','headsign'])||'',80)||null;
  const agency=clean(firstValue(first,['agencyName'])||first?.route?.agencyName||'',120)||null;
  const from=clean(first?.from?.name||'',120)||null,to=clean(last?.to?.name||'',120)||null;
  return {
    departure:departure||null,scheduledDeparture:scheduledDeparture||null,
    arrival:arrival||null,scheduledArrival:scheduledArrival||null,
    durationMinutes:durationSeconds===null?null:Math.round(durationSeconds/60),
    transfers:number(it?.transfers)??Math.max(0,legs.length-1),
    realtime:legs.some(l=>Boolean(l?.realTime)),delayMinutes:validDelay,
    cancelled:legs.some(l=>Boolean(l?.cancelled||l?.canceled)),
    route,agency,from,to,tripId:clean(first?.tripId||'',160)||null,
    fare:fareFromItinerary(it),source:'Transitous/MOTIS'
  };
}
function itineraryKey(x){return [x.departure,x.arrival,x.route,x.tripId].join('|');}
function normalizeResponse(data){
  const raw=asArray(data?.itineraries).length?asArray(data.itineraries):asArray(data?.plan?.itineraries);
  const out=[],seen=new Set();
  for(const it of raw){const x=normalizeItinerary(it);if(!x)continue;const k=itineraryKey(x);if(seen.has(k))continue;seen.add(k);out.push(x);}
  return out.sort((a,b)=>String(a.departure||'').localeCompare(String(b.departure||''))).slice(0,8);
}
async function queryTransitous(from,to,date){
  const u=new URL(TRANSITOUS_URL);
  u.searchParams.set('fromPlace',from.coord);
  u.searchParams.set('toPlace',to.coord);
  u.searchParams.set('time',timeForDate(date));
  u.searchParams.set('arriveBy','false');
  u.searchParams.set('transitModes','RAIL');
  u.searchParams.set('numItineraries','8');
  u.searchParams.set('maxItineraries','12');
  u.searchParams.set('maxTransfers','2');
  u.searchParams.set('withFares','true');
  u.searchParams.set('realtimeMode','REALTIME');
  u.searchParams.set('detailedLegs','false');
  u.searchParams.set('detailedTransfers','false');
  u.searchParams.set('language','el,en');
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);
  try{
    const r=await fetch(u.toString(),{
      headers:{
        accept:'application/json',
        'user-agent':'Horizon-Travel-Planner/0.1 (+https://civilengineergreece.github.io/horizon/)',
        referer:'https://civilengineergreece.github.io/horizon/'
      },
      signal:controller.signal
    });
    const data=await r.json().catch(()=>null);
    if(!r.ok||!data)throw new Error(`Transitous HTTP ${r.status}`);
    return normalizeResponse(data);
  }finally{clearTimeout(timer);}
}
function cheapestFare(list){
  const fares=asArray(list).map(x=>x?.fare).filter(x=>number(x?.amount)!==null&&x.amount>0);
  if(!fares.length)return null;
  return fares.sort((a,b)=>a.amount-b.amount)[0];
}
async function trains(request,env,url){
  const originName=clean(url.searchParams.get('origin'),100),destinationName=clean(url.searchParams.get('destination'),100);
  const date=iso(url.searchParams.get('date')),returnDate=iso(url.searchParams.get('returnDate'));
  const from=station(originName),to=station(destinationName);
  if(!from||!to)return reply(request,env,{ok:false,error:'Η live δοκιμή τρένων καλύπτει προς το παρόν Αθήνα, Θεσσαλονίκη, Λάρισα και Μετέωρα/Καλαμπάκα.',code:'TRAIN_STATION_NOT_MAPPED'},400,{'cache-control':'no-store'});
  if(!date)return reply(request,env,{ok:false,error:'Χρειάζεται έγκυρη ημερομηνία αναχώρησης.'},400,{'cache-control':'no-store'});
  const cacheKey=new Request(url.toString(),{method:'GET'});
  try{
    const cached=await caches.default.match(cacheKey);
    if(cached){const headers=new Headers(cached.headers);Object.entries(cors(request,env)).forEach(([k,v])=>headers.set(k,v));headers.set('x-horizon-cache','HIT');return new Response(cached.body,{status:cached.status,headers});}
  }catch{}
  try{
    const outboundPromise=queryTransitous(from,to,date);
    const inboundPromise=returnDate&&returnDate>=date?queryTransitous(to,from,returnDate):Promise.resolve([]);
    const [outbound,inbound]=await Promise.all([outboundPromise,inboundPromise]);
    const outFare=cheapestFare(outbound),inFare=cheapestFare(inbound);
    const roundTripFare=outFare&&inFare&&outFare.currency===inFare.currency?{amount:Math.round((outFare.amount+inFare.amount)*100)/100,currency:outFare.currency,kind:'feed-fare-direct'}:null;
    const data={ok:true,provider:'Transitous/MOTIS',source:'Hellenic Train / Greek railway open feeds as aggregated by Transitous',origin:originName,destination:destinationName,originStation:from.name,destinationStation:to.name,date,returnDate:returnDate||null,outbound,inbound,fares:{outbound:outFare,inbound:inFare,roundTrip:roundTripFare},fareNote:roundTripFare?'Το fare προέρχεται από fare information του Transitous/MOTIS για απλό απευθείας σιδηροδρομικό σκέλος. Δεν αποτελεί εγγύηση διαθεσιμότητας ή τελικής τιμής κράτησης.':'Το ελληνικό feed δεν επέστρεψε αξιοποιήσιμο και μη αμφίσημο fare για αυτή την αναζήτηση· το Horizon κρατά στενή εκτίμηση τιμής.',realtimeNote:'Το Transitous χρησιμοποιεί realtime ενημερώσεις όταν παρέχονται από την πηγή. Οι προγραμματισμένες ώρες παραμένουν διαθέσιμες όταν δεν υπάρχει realtime σήμα.',attribution:'https://transitous.org/sources/',cache:{enabled:true,ttlSeconds:TRAIN_TTL}};
    const response=reply(request,env,data,200,{'cache-control':`public, max-age=0, s-maxage=${TRAIN_TTL}`,'x-horizon-cache':'MISS'});
    try{await caches.default.put(cacheKey,response.clone());}catch{}
    return response;
  }catch(e){return reply(request,env,{ok:false,error:'Δεν ολοκληρώθηκε η live αναζήτηση τρένων.',details:clean(e?.message||String(e),300),code:'TRANSITOUS_ERROR',provider:'Transitous/MOTIS'},502,{'cache-control':'no-store'});}
}

export default {
  async fetch(request,env,ctx){
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors(request,env)});
    const url=new URL(request.url);
    if(url.pathname==='/trains'){
      if(request.method!=='GET')return reply(request,env,{ok:false,error:'Χρησιμοποίησε GET.'},405,{'cache-control':'no-store'});
      return trains(request,env,url);
    }
    if(url.pathname==='/health'){
      const r=await v4.fetch(request,env,ctx);const data=await r.clone().json().catch(()=>({ok:true,service:'Horizon Live API'}));
      data.providers={...(data.providers||{}),transitous:{enabled:true,via:'MOTIS v6 public API',modes:['train'],fares:'when supplied by underlying feed',realtime:true}};
      return reply(request,env,data,r.status,{'cache-control':'no-store'});
    }
    return v4.fetch(request,env,ctx);
  }
};

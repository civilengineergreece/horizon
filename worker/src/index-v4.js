import base from './index.js';

const JSON_HEADERS={'content-type':'application/json; charset=utf-8'};
const MCP_URL='https://mcp.ferryhopper.com/mcp';
const FERRY_TTL=30*60;

function cors(request,env){
  const origin=request.headers.get('Origin')||'';
  const allowed=env.ALLOWED_ORIGIN||'https://civilengineergreece.github.io';
  const ok=!origin||origin===allowed||origin.startsWith('http://localhost:')||origin.startsWith('http://127.0.0.1:');
  return {'access-control-allow-origin':ok?(origin||allowed):allowed,'access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type','access-control-expose-headers':'cf-cache-status,x-horizon-cache','access-control-max-age':'86400','vary':'Origin'};
}
function reply(request,env,data,status=200,extra={}){return new Response(JSON.stringify(data),{status,headers:{...JSON_HEADERS,...cors(request,env),...extra}});}
function clean(v,max=180){return String(v??'').trim().slice(0,max);}
function norm(v){return String(v||'').trim().toLocaleLowerCase('el-GR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
function iso(v){return /^\d{4}-\d{2}-\d{2}$/.test(String(v||''))?String(v):null;}
function num(v){
  if(v&&typeof v==='object')return num(v.amount??v.value??v.min??v.lowest);
  const n=Number(v);return Number.isFinite(n)?n:null;
}
function safeUrl(v){try{const u=new URL(String(v||''));return u.protocol==='https:'?u.toString():null;}catch{return null;}}
function parseMcp(text){
  try{return JSON.parse(text);}catch{}
  const lines=String(text||'').split(/\r?\n/);
  const events=[];
  for(const line of lines){if(line.startsWith('data:')){try{events.push(JSON.parse(line.slice(5).trim()));}catch{}}}
  return events.length?events[events.length-1]:null;
}
async function postMcp(payload,session){
  const headers={'content-type':'application/json','accept':'application/json, text/event-stream'};
  if(session)headers['mcp-session-id']=session;
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),18000);
  try{
    const res=await fetch(MCP_URL,{method:'POST',headers,body:JSON.stringify(payload),signal:controller.signal});
    const text=await res.text();const data=parseMcp(text);
    if(!res.ok||data?.error){const e=new Error(data?.error?.message||`Ferryhopper MCP HTTP ${res.status}`);e.status=res.status;e.details=data||text;throw e;}
    return {data,session:res.headers.get('mcp-session-id')||session||null};
  }finally{clearTimeout(timer);}
}
async function searchTrips(origin,destination,date){
  const init=await postMcp({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'Horizon Travel Planner',version:'1.0'}}});
  const session=init.session;
  try{await postMcp({jsonrpc:'2.0',method:'notifications/initialized',params:{}},session);}catch{}
  const call=await postMcp({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'search_trips',arguments:{departureLocation:origin,arrivalLocation:destination,date}}},session);
  return call.data?.result??call.data;
}
function structured(result){
  if(result?.structuredContent)return result.structuredContent;
  if(Array.isArray(result?.content)){
    for(const x of result.content){if(x?.type==='text'&&x.text){try{return JSON.parse(x.text);}catch{}}}
  }
  return result;
}
function pick(obj,names){for(const n of names){const v=obj?.[n];if(v!==undefined&&v!==null&&v!=='')return v;}return null;}
function normalizeTrip(x){
  if(!x||typeof x!=='object'||Array.isArray(x))return null;
  const dep=pick(x,['departureDateTime','departure_datetime','departureTime','departure_time','departure']);
  const arr=pick(x,['arrivalDateTime','arrival_datetime','arrivalTime','arrival_time','arrival']);
  const operator=pick(x,['operatorName','operator','company','carrier','ownerCompany']);
  const vessel=pick(x,['vesselName','vessel','shipName','ship']);
  const priceRaw=pick(x,['price','lowestPrice','minPrice','fare','startingPrice','priceFrom']);
  const price=num(priceRaw);
  const currency=clean((priceRaw&&typeof priceRaw==='object'&&(priceRaw.currency||priceRaw.currencyCode))||x.currency||x.currencyCode||'EUR',8);
  const bookingUrl=safeUrl(pick(x,['bookingUrl','booking_url','redirectUrl','redirect_url','deeplink','url']));
  const duration=num(pick(x,['durationMinutes','duration_minutes','duration']));
  if(!dep&&!arr&&!operator&&!vessel&&price===null&&!bookingUrl)return null;
  return {operator:clean(typeof operator==='object'?(operator.name||operator.label):operator,100)||null,vessel:clean(typeof vessel==='object'?(vessel.name||vessel.label):vessel,100)||null,departure:clean(typeof dep==='object'?(dep.dateTime||dep.time||dep.value):dep,100)||null,arrival:clean(typeof arr==='object'?(arr.dateTime||arr.time||arr.value):arr,100)||null,durationMinutes:duration,price,currency,bookingUrl,source:'Ferryhopper'};
}
function collect(root){
  const out=[],seen=new Set();
  function walk(v,depth=0){
    if(depth>8||v==null)return;
    if(Array.isArray(v)){for(const x of v)walk(x,depth+1);return;}
    if(typeof v!=='object')return;
    const t=normalizeTrip(v);
    if(t){const k=JSON.stringify([t.operator,t.vessel,t.departure,t.arrival,t.price,t.bookingUrl]);if(!seen.has(k)){seen.add(k);out.push(t);}}
    for(const x of Object.values(v))walk(x,depth+1);
  }
  walk(root);return out.slice(0,30);
}
const ATHENS=new Set(['αθηνα','athens','athina']);
const RAFINA_FIRST=new Set(['ανδρος','τηνος','μυκονος']);
const LAVRIO_FIRST=new Set(['κεα','κυθνος']);
function ports(origin,destination){
  if(!ATHENS.has(norm(origin)))return [origin];
  const d=norm(destination);
  if(RAFINA_FIRST.has(d))return ['Rafina','Piraeus','Lavrio'];
  if(LAVRIO_FIRST.has(d))return ['Lavrio','Piraeus','Rafina'];
  return ['Piraeus','Rafina','Lavrio'];
}
async function oneDirection(origin,destination,date){
  const raw=structured(await searchTrips(origin,destination,date));
  return collect(raw);
}
async function ferries(request,env,url){
  const origin=clean(url.searchParams.get('origin'),100),destination=clean(url.searchParams.get('destination'),100),date=iso(url.searchParams.get('date')),returnDate=iso(url.searchParams.get('returnDate'));
  if(origin.length<2||destination.length<2)return reply(request,env,{ok:false,error:'Χρειάζονται αφετηρία και προορισμός.'},400,{'cache-control':'no-store'});
  if(!date)return reply(request,env,{ok:false,error:'Χρειάζεται έγκυρη ημερομηνία αναχώρησης.'},400,{'cache-control':'no-store'});
  const candidates=ports(origin,destination);let lastError=null;
  for(const port of candidates){
    try{
      const outbound=await oneDirection(port,destination,date);
      if(!outbound.length&&port!==candidates[candidates.length-1])continue;
      let inbound=[];
      if(returnDate&&returnDate>=date)inbound=await oneDirection(destination,port,returnDate);
      return reply(request,env,{ok:true,provider:'Ferryhopper MCP',requestedOrigin:origin,ferryPort:port,destination,date,returnDate:returnDate||null,outbound,inbound,priceNote:'Οι τιμές Ferryhopper είναι ενδεικτικές τιμές έναρξης ανά διαθέσιμη επιλογή· το τελικό ποσό επιβεβαιώνεται στην κράτηση.',meta:{outbound:outbound.length,inbound:inbound.length},cache:{enabled:true,ttlSeconds:FERRY_TTL}},200,{'cache-control':`public, max-age=0, s-maxage=${FERRY_TTL}`,'x-horizon-cache':'MISS'});
    }catch(e){lastError=e;}
  }
  return reply(request,env,{ok:false,error:'Δεν ολοκληρώθηκε η live αναζήτηση πλοίων.',details:clean(lastError?.message||'Δεν βρέθηκαν δρομολόγια από τα διαθέσιμα λιμάνια της Αττικής.',300),code:'FERRYHOPPER_MCP_ERROR'},502,{'cache-control':'no-store'});
}

export default {
  async fetch(request,env,ctx){
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors(request,env)});
    const url=new URL(request.url);
    if(url.pathname==='/ferries'){
      if(request.method!=='GET')return reply(request,env,{ok:false,error:'Χρησιμοποίησε GET.'},405,{'cache-control':'no-store'});
      return ferries(request,env,url);
    }
    if(url.pathname==='/ground')return reply(request,env,{ok:false,error:'Η σύνδεση Omio Meta Search API χρειάζεται partner credentials.',code:'OMIO_PARTNER_ACCESS_REQUIRED',provider:'Omio Meta Search API',modes:['train','bus'],readyForIntegration:true},503,{'cache-control':'no-store'});
    if(url.pathname==='/health'){
      const r=await base.fetch(request,env,ctx);const data=await r.clone().json().catch(()=>({ok:true,service:'Horizon Live API'}));
      data.providers={...(data.providers||{}),ferryhopper:{enabled:true,via:'Official MCP',sessionMode:'stateless-compatible'},omio:{enabled:false,via:'Meta Search API',status:'partner-access-required'}};
      return reply(request,env,data,r.status,{'cache-control':'no-store'});
    }
    return base.fetch(request,env,ctx);
  }
};

import base from './index.js';

const JSON_HEADERS={'content-type':'application/json; charset=utf-8'};
const FERRY_MCP='https://mcp.ferryhopper.com/mcp';
const FERRY_CACHE_TTL=30*60;

function cors(request,env){
  const origin=request.headers.get('Origin')||'';
  const allowed=env.ALLOWED_ORIGIN||'https://civilengineergreece.github.io';
  const ok=!origin||origin===allowed||origin.startsWith('http://localhost:')||origin.startsWith('http://127.0.0.1:');
  return {
    'access-control-allow-origin':ok?(origin||allowed):allowed,
    'access-control-allow-methods':'GET,POST,OPTIONS',
    'access-control-allow-headers':'content-type',
    'access-control-expose-headers':'cf-cache-status,x-horizon-cache',
    'access-control-max-age':'86400','vary':'Origin'
  };
}
function reply(request,env,data,status=200,extra={}){
  return new Response(JSON.stringify(data),{status,headers:{...JSON_HEADERS,...cors(request,env),...extra}});
}
function clean(v,max=160){return String(v??'').trim().slice(0,max);}
function iso(v){return /^\d{4}-\d{2}-\d{2}$/.test(String(v||''))?String(v):null;}
function num(v){const n=Number(typeof v==='object'&&v?v.amount:v);return Number.isFinite(n)?n:null;}
function safeUrl(v){try{const u=new URL(String(v||''));return u.protocol==='https:'?u.toString():null;}catch{return null;}}
function parseMcpBody(text){
  try{return JSON.parse(text);}catch{}
  const rows=String(text||'').split(/\r?\n/).filter(x=>x.startsWith('data:'));
  for(let i=rows.length-1;i>=0;i--){try{return JSON.parse(rows[i].slice(5).trim());}catch{}}
  return null;
}
async function mcpPost(payload,session){
  const headers={'content-type':'application/json','accept':'application/json, text/event-stream'};
  if(session)headers['mcp-session-id']=session;
  const res=await fetch(FERRY_MCP,{method:'POST',headers,body:JSON.stringify(payload)});
  const text=await res.text();
  const data=parseMcpBody(text);
  if(!res.ok||data?.error){const e=new Error(data?.error?.message||`Ferryhopper MCP HTTP ${res.status}`);e.status=res.status;e.data=data||text;throw e;}
  return {data,session:res.headers.get('mcp-session-id')||session||null};
}
async function ferryTool(name,args){
  const init=await mcpPost({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'Horizon Travel Planner',version:'1.0'}}});
  const session=init.session;
  if(!session)throw new Error('Το Ferryhopper MCP δεν επέστρεψε session id.');
  try{await mcpPost({jsonrpc:'2.0',method:'notifications/initialized',params:{}},session);}catch{}
  const call=await mcpPost({jsonrpc:'2.0',id:2,method:'tools/call',params:{name,arguments:args}},session);
  return call.data?.result||call.data;
}
function structured(result){
  if(result?.structuredContent)return result.structuredContent;
  if(result?.content&&Array.isArray(result.content)){
    for(const item of result.content){
      if(item?.type==='text'&&item.text){try{return JSON.parse(item.text);}catch{}}
    }
  }
  return result;
}
function scalar(obj,names){
  for(const n of names){const v=obj?.[n];if(v!==undefined&&v!==null&&v!=='')return v;}
  return null;
}
function normalizeTrip(x){
  if(!x||typeof x!=='object'||Array.isArray(x))return null;
  const dep=scalar(x,['departureDateTime','departure_datetime','departureTime','departure_time','departure']);
  const arr=scalar(x,['arrivalDateTime','arrival_datetime','arrivalTime','arrival_time','arrival']);
  const operator=scalar(x,['operatorName','operator','ownerCompany','company','carrier']);
  const vessel=scalar(x,['vesselName','vessel','shipName','ship']);
  const priceObj=scalar(x,['price','lowestPrice','minPrice','fare']);
  const price=num(priceObj);
  const currency=clean((typeof priceObj==='object'&&priceObj&&(priceObj.currency||priceObj.currencyCode))||x.currency||'EUR',8);
  const duration=scalar(x,['durationMinutes','duration_minutes','duration']);
  const bookingUrl=safeUrl(scalar(x,['bookingUrl','booking_url','redirectUrl','redirect_url','url','deeplink']));
  if(!dep&&!arr&&!operator&&!vessel&&price===null)return null;
  return {operator:clean(typeof operator==='object'?(operator.name||operator.label):operator,100)||null,vessel:clean(typeof vessel==='object'?(vessel.name||vessel.label):vessel,100)||null,departure:clean(typeof dep==='object'?(dep.dateTime||dep.time||dep.value):dep,80)||null,arrival:clean(typeof arr==='object'?(arr.dateTime||arr.time||arr.value):arr,80)||null,durationMinutes:num(duration),price,currency,bookingUrl,source:'Ferryhopper'};
}
function collectTrips(root){
  const found=[],seen=new Set();
  function walk(v,depth=0){
    if(depth>7||v==null)return;
    if(Array.isArray(v)){for(const x of v)walk(x,depth+1);return;}
    if(typeof v!=='object')return;
    const t=normalizeTrip(v);
    if(t){const k=JSON.stringify([t.operator,t.vessel,t.departure,t.arrival,t.price]);if(!seen.has(k)){seen.add(k);found.push(t);}}
    for(const x of Object.values(v))walk(x,depth+1);
  }
  walk(root);return found.slice(0,25);
}
function ferryInput(url){return {origin:url.searchParams.get('origin'),destination:url.searchParams.get('destination'),date:url.searchParams.get('date'),returnDate:url.searchParams.get('returnDate')};}
async function ferries(request,env,input){
  const origin=clean(input.origin,100),destination=clean(input.destination,100),date=iso(input.date),returnDate=iso(input.returnDate);
  if(origin.length<2||destination.length<2)return reply(request,env,{ok:false,error:'Χρειάζονται αφετηρία και προορισμός.'},400,{'cache-control':'no-store'});
  if(!date)return reply(request,env,{ok:false,error:'Χρειάζεται έγκυρη ημερομηνία αναχώρησης.'},400,{'cache-control':'no-store'});
  const outboundRaw=structured(await ferryTool('search_trips',{departureLocation:origin,arrivalLocation:destination,date}));
  const outbound=collectTrips(outboundRaw);
  let inbound=[];
  if(returnDate&&returnDate>=date){
    const inboundRaw=structured(await ferryTool('search_trips',{departureLocation:destination,arrivalLocation:origin,date:returnDate}));
    inbound=collectTrips(inboundRaw);
  }
  return reply(request,env,{ok:true,provider:'Ferryhopper MCP',origin,destination,date,returnDate:returnDate||null,outbound,inbound,meta:{outbound:outbound.length,inbound:inbound.length},cache:{enabled:true,ttlSeconds:FERRY_CACHE_TTL}},200,{'cache-control':`public, max-age=0, s-maxage=${FERRY_CACHE_TTL}`,'x-horizon-cache':'MISS'});
}

export default {
  async fetch(request,env,ctx){
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors(request,env)});
    const url=new URL(request.url);
    if(url.pathname==='/ferries'){
      if(request.method!=='GET')return reply(request,env,{ok:false,error:'Χρησιμοποίησε GET.'},405,{'cache-control':'no-store'});
      try{return await ferries(request,env,ferryInput(url));}
      catch(e){return reply(request,env,{ok:false,error:'Δεν ολοκληρώθηκε η live αναζήτηση πλοίων.',details:clean(e?.message,300),code:'FERRYHOPPER_MCP_ERROR'},502,{'cache-control':'no-store'});}
    }
    if(url.pathname==='/ground'){
      return reply(request,env,{ok:false,error:'Η σύνδεση Omio Meta Search API χρειάζεται έγκριση συνεργάτη και credentials.',code:'OMIO_PARTNER_ACCESS_REQUIRED',provider:'Omio Meta Search API',modes:['train','bus'],readyForIntegration:true},503,{'cache-control':'no-store'});
    }
    if(url.pathname==='/health'){
      const r=await base.fetch(request,env,ctx);const data=await r.clone().json().catch(()=>({ok:true,service:'Horizon Live API'}));
      data.providers={...(data.providers||{}),ferryhopper:{enabled:true,via:'Official open-access MCP'},omio:{enabled:false,via:'Meta Search API',status:'partner-access-required'}};
      return reply(request,env,data,r.status,{'cache-control':'no-store'});
    }
    return base.fetch(request,env,ctx);
  }
};

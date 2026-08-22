const JSON_HEADERS={'content-type':'application/json; charset=utf-8'};

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
function fail(request,env,status,message,details,extra={}){return reply(request,env,{ok:false,error:message,details:details||null,...extra},status);}
function cleanText(v,max=160){return String(v||'').trim().slice(0,max);}
function number(v,fallback=0){const n=Number(v);return Number.isFinite(n)?n:fallback;}
function isoDate(v){return /^\d{4}-\d{2}-\d{2}$/.test(String(v||''))?String(v):null;}
async function body(request){
  const type=request.headers.get('content-type')||'';
  if(!type.includes('application/json'))throw new Error('Απαιτείται JSON request.');
  const text=await request.text();
  if(text.length>12000)throw new Error('Το request είναι πολύ μεγάλο.');
  return JSON.parse(text||'{}');
}
async function fetchJson(url,options={}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),12000);
  try{
    const res=await fetch(url,{...options,signal:controller.signal});
    const text=await res.text();
    let data={};
    try{data=text?JSON.parse(text):{};}catch{data={raw:text};}
    if(!res.ok){const e=new Error(data?.message||data?.error||`Provider HTTP ${res.status}`);e.status=res.status;e.data=data;throw e;}
    return {data,headers:res.headers};
  }finally{clearTimeout(timer);}
}
function safeUrl(v){
  try{const u=new URL(String(v||''));return /^https:$/.test(u.protocol)?u.toString():null;}catch{return null;}
}
function firstImage(media){
  const list=Array.isArray(media)?media:[];
  for(const item of list){
    const candidates=[item?.url,item?.src,item?.href,item?.images?.large,item?.images?.medium,item?.images?.small];
    for(const c of candidates){const u=safeUrl(c);if(u)return u;}
  }
  return null;
}
function normalizeStay(item,currency,nights){
  const suppliers=item?.suppliers&&typeof item.suppliers==='object'?item.suppliers:{};
  const offers=Object.entries(suppliers).map(([provider,s])=>{
    const total=number(s?.price?.total,0);
    return {provider,link:safeUrl(s?.link),total:total>0?total:null};
  }).filter(x=>x.link||x.total).sort((a,b)=>(a.total??1e15)-(b.total??1e15));
  const priced=offers.filter(x=>x.total!==null);
  const best=priced[0]||offers[0]||null;
  const coords=item?.location?.coordinates||{};
  return {
    id:String(item?.id||''),
    name:cleanText(item?.name||'Κατάλυμα',180),
    type:cleanText(item?.type||'Accommodation',80),
    rating:number(item?.rating,0)||null,
    address:cleanText(item?.location?.address||'',220)||null,
    distanceInMeters:number(item?.location?.distanceInMeters,0)||null,
    latitude:number(coords?.latitude??coords?.lat,NaN),
    longitude:number(coords?.longitude??coords?.lng??coords?.lon,NaN),
    image:firstImage(item?.media),
    url:safeUrl(item?.url),
    bestProvider:best?.provider||null,
    bestTotal:best?.total??null,
    nightly:best?.total&&nights?Math.round((best.total/nights)*100)/100:null,
    currency,
    suppliers:offers.slice(0,4)
  };
}
async function stays(request,env){
  const b=await body(request);
  const destination=cleanText(b.destination,120);
  const checkIn=isoDate(b.checkInDate);
  const checkOut=isoDate(b.checkOutDate);
  if(destination.length<2)return fail(request,env,400,'Χρειάζεται προορισμός.');
  if(!checkIn||!checkOut)return fail(request,env,400,'Χρειάζονται έγκυρες ημερομηνίες check-in και check-out.');
  if(checkOut<=checkIn)return fail(request,env,400,'Το check-out πρέπει να είναι μετά το check-in.');

  if(!env.STAY22_API_KEY){
    return fail(
      request,
      env,
      503,
      'Οι live κάρτες καταλυμάτων χρειάζονται Stay22 API key.',
      null,
      {code:'STAY22_API_KEY_REQUIRED',fallbackAvailable:true}
    );
  }

  const page=Math.min(10,Math.max(1,Math.floor(number(b.page,1))));
  const pageSize=Math.min(20,Math.max(5,Math.floor(number(b.pageSize,12))));
  const url=new URL('https://api.stay22.com/v2/accommodations');
  url.searchParams.set('address',destination);
  url.searchParams.set('checkin',checkIn);
  url.searchParams.set('checkout',checkOut);
  url.searchParams.set('currency','EUR');
  url.searchParams.set('page',String(page));
  url.searchParams.set('pageSize',String(pageSize));
  const headers={accept:'application/json','X-API-KEY':env.STAY22_API_KEY};
  const {data,headers:providerHeaders}=await fetchJson(url.toString(),{headers});
  const meta=data?.meta||{};
  const nights=Math.max(1,number(meta.nights,Math.round((Date.parse(checkOut)-Date.parse(checkIn))/86400000)));
  const currency=String(meta.currency||'EUR');
  const results=(Array.isArray(data?.results)?data.results:[]).map(x=>normalizeStay(x,currency,nights));
  results.sort((a,b)=>(a.bestTotal??1e15)-(b.bestTotal??1e15));
  return reply(request,env,{
    ok:true,
    provider:'Stay22 Direct Travel API',
    demo:false,
    destination,checkInDate:checkIn,checkOutDate:checkOut,nights,currency,
    meta:{page:number(meta.page,page),pageSize:number(meta.pageSize,pageSize),total:number(meta.total,results.length),hasMore:!!meta.hasMore},
    rateLimit:{limit:providerHeaders.get('X-RateLimit-Limit'),remaining:providerHeaders.get('X-RateLimit-Remaining'),reset:providerHeaders.get('X-RateLimit-Reset')},
    results
  });
}

export default {
  async fetch(request,env){
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors(request,env)});
    const url=new URL(request.url);
    try{
      if(url.pathname==='/health')return reply(request,env,{
        ok:true,
        service:'Horizon Live API',
        providers:{
          stay22:true,
          stay22Mode:env.STAY22_API_KEY?'api-key':'api-key-required',
          liveCards:!!env.STAY22_API_KEY,
          fallback:true
        }
      });
      if(request.method!=='POST')return fail(request,env,405,'Χρησιμοποίησε POST.');
      if(url.pathname==='/stays')return await stays(request,env);
      return fail(request,env,404,'Άγνωστο endpoint.');
    }catch(e){
      const providerStatus=Number(e.status)||0;
      if(providerStatus===429)return fail(request,env,429,'Έφτασες προσωρινά το όριο αναζητήσεων. Περίμενε περίπου ένα λεπτό και ξαναδοκίμασε.',e.data||null);
      const status=providerStatus>=400&&providerStatus<600?502:400;
      return fail(request,env,status,e.message||'Σφάλμα live provider',e.data||null);
    }
  }
};

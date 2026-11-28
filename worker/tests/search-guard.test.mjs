import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index-v6.js';

const base='https://horizon-live-api.example.workers.dev';
const origin='https://civilengineergreece.github.io';
const stay='/stays?destination=Athens&checkInDate=2026-12-01&checkOutDate=2026-12-04&adults=2&children=0&infants=1';
const paid=[
  {path:stay,method:'GET'},
  {path:'/flights',method:'POST'},
  {path:'/flight-returns',method:'POST'},
  {path:'/flight-booking-options',method:'POST'},
  {path:'/hotel-details',method:'POST'}
];
function request(path,method='GET',headers={},body={}){
  return new Request(base+path,{method,headers:{
    Origin:origin,'CF-Connecting-IP':'203.0.113.42',
    ...(method==='POST'?{'content-type':'application/json'}:{}),...headers},
    ...(method==='POST'?{body:JSON.stringify(body)}:{})});
}
const env=(limiter)=>({
  SERPAPI_API_KEY:'fake-paid-provider-token-for-tests',
  ALLOWED_ORIGIN:origin,
  ...(limiter?{TRAVEL_SEARCH_RATE_LIMIT:limiter}:{})
});
function stubFetch(fn){
  const before=globalThis.fetch;
  globalThis.fetch=fn;
  return ()=>{globalThis.fetch=before;};
}

test('every billable route is fail-closed when Cloudflare search limiter is not configured',async()=>{
  let outside=0;const restore=stubFetch(()=>{outside++;throw Error('No external paid requests');});
  try{
    for(const {path,method} of paid){
      const response=await worker.fetch(request(path,method),env(),{});
      assert.equal(response.status,503,path);
      const data=await response.json();
      assert.equal(data.code,'SEARCH_PROTECTION_UNAVAILABLE',path);
      assert.equal(data.ok,false);
      assert.equal(response.headers.get('cache-control'),'no-store');
    }
    assert.equal(outside,0);
  }finally{restore();}
});

test('server-side search never considers browser CORS a substitute for exact Origin',async()=>{
  const keys=[],limit={limit:async ({key})=>{keys.push(key);return {success:true};}};
  const restore=stubFetch(()=>{throw Error('Should never fetch paid provider');});
  try{
    for(const h of [
      {Origin:'https://evil.example'},
      {Origin:''},
      {Origin:'http://localhost:8765'},
      {Origin:'https://civilengineergreece.github.io.attacker.example'}
    ]){
      const response=await worker.fetch(request(stay,'GET',h),env(limit),{});
      assert.equal(response.status,403);
      assert.equal((await response.json()).code,'SEARCH_ORIGIN_DENIED');
    }
    assert.deepEqual(keys,[],'Denied origin must not use quota limiter or paid provider');
  }finally{restore();}
});

test('source IP cannot be absent/spoofed through X-Forwarded-For; limiter fails closed',async()=>{
  const limiter={limit:async()=>({success:true})};
  const restore=stubFetch(()=>{throw Error('Should never fetch SerpApi');});
  try{
    for(const ip of ['', 'not a valid ip']){
      const response=await worker.fetch(request(stay,'GET',{
        'CF-Connecting-IP':ip,'X-Forwarded-For':'203.0.113.1'
      }),env(limiter),{});
      assert.equal(response.status,403);
      assert.equal((await response.json()).code,'SEARCH_CLIENT_UNVERIFIED');
    }
  }finally{restore();}
});

test('denied or failing Cloudflare limiter blocks request without spending provider quota',async()=>{
  const restore=stubFetch(()=>{throw Error('Never use paid provider');});
  try{
    const cases=[
      [{limit:async()=>({success:false})},429,'SEARCH_RATE_LIMIT'],
      [{limit:async()=>{throw Error('Cloudflare temporary unavailable');}},503,
        'SEARCH_PROTECTION_UNAVAILABLE'],
      [{limit:async()=>null},429,'SEARCH_RATE_LIMIT']
    ];
    for(const [limiter,status,code] of cases){
      const response=await worker.fetch(request(stay),env(limiter),{});
      assert.equal(response.status,status);
      assert.equal((await response.json()).code,code);
    }
  }finally{restore();}
});

test('allowed lookup still delegates a real valid hotel search, without exposing paid key',async()=>{
  const keys=[],urls=[];
  const limiter={limit:async ({key})=>{keys.push(key);return {success:true};}};
  const restore=stubFetch(async url=>{
    urls.push(String(url));
    assert.equal(new URL(url).hostname,'serpapi.com');
    assert.equal(new URL(url).searchParams.get('api_key'),'fake-paid-provider-token-for-tests');
    return Response.json({properties:[],serpapi_pagination:{}});
  });
  try{
    const response=await worker.fetch(request(stay),env(limiter),{});
    assert.equal(response.status,200);
    const data=await response.json();
    assert.equal(data.ok,true);
    assert.deepEqual(data.results,[]);
    assert.deepEqual(keys,['search-ip:203.0.113.42']);
    assert.equal(urls.length,1);
    assert.equal(response.headers.get('access-control-allow-origin'),origin);
    assert.ok(!JSON.stringify(data).includes('fake-paid-provider-token-for-tests'));
  }finally{restore();}
});

test('public health/preflight never spends a billable rate limit',async()=>{
  let n=0;
  const limiter={limit:async()=>{n++;return {success:true};}};
  const r=await worker.fetch(request('/health'),env(limiter),{});
  assert.equal(r.status,200);
  assert.equal((await r.json()).ok,true);
  const preflight=new Request(base+stay,{method:'OPTIONS',headers:{Origin:origin}});
  const options=await worker.fetch(preflight,env(limiter),{});
  assert.equal(options.status,204);
  assert.equal(n,0);
});


test('read-only public protection capability reports actual limiter binding without paid provider calls',async()=>{
  let outside=0;const restore=stubFetch(()=>{outside++;throw Error('No external provider');});
  try{
    const configured=await worker.fetch(request('/search-protection-capabilities'),
      env({limit:async()=>({success:true})}),{});
    assert.equal(configured.status,200);
    const yes=await configured.json();
    assert.equal(yes.ok,true);
    assert.equal(yes.guarded,true);
    assert.equal(yes.rateLimitConfigured,true);
    assert.equal(yes.perIpLimit,12);
    assert.equal(yes.periodSeconds,60);
    assert.deepEqual([...yes.endpoints].sort(),[
      '/flights','/flight-returns','/flight-booking-options','/stays','/hotel-details'
    ].sort());
    const missing=await worker.fetch(request('/search-protection-capabilities'),env(),{});
    assert.equal(missing.status,200);
    assert.equal((await missing.json()).rateLimitConfigured,false);
    assert.equal(outside,0);
  }finally{restore();}
});

test('surface searches share the fail-closed quota guard',async()=>{
 let outside=0;const restore=stubFetch(()=>{outside++;throw Error('No external requests');});
 try{
   for(const path of ['/ferries','/trains']){
     const disabled=await worker.fetch(request(path),env(),{});
     assert.equal(disabled.status,503);
     const limited=await worker.fetch(request(path),env({limit:async()=>({success:false})}),{});
     assert.equal(limited.status,429);
   }
   assert.equal(outside,0);
 }finally{restore();}
});
test('invalid optional flight return is not silently converted to one way',async()=>{
 let outside=0;const restore=stubFetch(()=>{outside++;throw Error('No external requests');});
 try{
   const response=await worker.fetch(request('/flights','POST',{},{
     origin:'Athens',destination:'Thessaloniki',outboundDate:'2027-03-28',returnDate:'2027-02-31'
   }),env({limit:async()=>({success:true})}),{});
   assert.equal(response.status,400);
   assert.equal((await response.json()).code,'INVALID_RETURN_DATE');
   assert.equal(outside,0);
 }finally{restore();}
});

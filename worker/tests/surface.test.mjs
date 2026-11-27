import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index-v6.js';

const base='https://example.workers.dev';
const origin='https://civilengineergreece.github.io';
const req=(path)=>new Request(base+path,{headers:{Origin:origin}});
const env={ALLOWED_ORIGIN:origin};

test('ferries validate dates without calling a provider',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=()=>{throw new Error('Supplier must not be called for invalid dates');};
 try{
  for(const path of [
   '/ferries?origin=Athens&destination=Syros&date=2026-02-31',
   '/ferries?origin=Athens&destination=Syros&date=2026-12-04&returnDate=2026-12-03',
   '/ferries?origin=Athens&destination=Syros&date=2026-12-04&returnDate=2026-13-06'
  ]){
   const response=await worker.fetch(req(path),env,{});
   assert.ok([400,422].includes(response.status),path);
   assert.equal((await response.json()).ok,false);
  }
 }finally{globalThis.fetch=original;}
});

test('ferry supplier starting fares do not become family, infant, cabin or vehicle prices',async()=>{
 const original=globalThis.fetch,searches=[];
 globalThis.fetch=async (input,opts={})=>{
  const u=new URL(String(input));assert.equal(u.hostname,'mcp.ferryhopper.com');
  const body=JSON.parse(opts.body);
  if(body.method==='initialize')return Response.json({jsonrpc:'2.0',id:1,result:{capabilities:{}}},
    {headers:{'mcp-session-id':'test-session'}});
  if(body.method==='notifications/initialized')return Response.json({jsonrpc:'2.0',result:{}});
  assert.equal(body.method,'tools/call');
  const args=body.params.arguments;searches.push(args);
  const outbound=args.departureLocation==='Piraeus';
  return Response.json({jsonrpc:'2.0',id:2,result:{structuredContent:{trips:[
    {departureDateTime:outbound?'2026-12-04T07:30:00+02:00':'2026-12-06T16:30:00+02:00',
      arrivalDateTime:outbound?'2026-12-04T11:10:00+02:00':'2026-12-06T20:20:00+02:00',
      operatorName:'Sample <script>alert(1)</script>',vesselName:'Example',
      price:outbound?46:null,bookingUrl:'https://www.ferryhopper.com/'},
    {price:1,bookingUrl:'https://example.com/not-a-ferry-trip'},
    {departureDateTime:'2026-12-20T08:00:00+02:00',
      arrivalDateTime:'2026-12-20T12:00:00+02:00',
      operatorName:'Wrong-day ferry',price:2}]}}});
 };
 try{
  const path='/ferries?origin=Athens&destination=Syros&date=2026-12-04&returnDate=2026-12-06';
  const response=await worker.fetch(req(path),env,{});
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.ok,true);
  assert.equal(data.provider,'Ferryhopper MCP');
  assert.equal(data.ferryPort,'Piraeus');
  assert.equal(data.pricingScope.passengerMixApplied,false);
  assert.equal(data.pricingScope.vehicleIncluded,false);
  assert.equal(data.pricingScope.cabinIncluded,false);
  assert.equal(data.pricingScope.finalCheckoutVerified,false);
  assert.equal(data.priceBasis,'per_option_starting_fare');
  assert.equal(data.outbound.length,1,'Exclude price-only objects and departures on other dates');
  assert.equal(data.inbound.length,1,'Return date must also match');
  assert.equal(data.outbound[0].price,46);
  assert.equal(data.outbound[0].includesInfantFare,false);
  assert.equal(data.outbound[0].booked,false);
  assert.equal(data.inbound[0].price,null,'Missing return fare must remain unknown, not 0');
  assert.equal(searches.length,2);
  assert.equal(searches[0].departureLocation,'Piraeus');
  assert.equal(searches[1].departureLocation,'Syros');
  assert.ok(Number.isFinite(Date.parse(data.retrievedAt)));
 }finally{globalThis.fetch=original;}
});

test('KTEL/Omio is unavailable rather than a phantom connected booking engine',async()=>{
 const r=await worker.fetch(req('/ground?mode=bus'),env,{});
 assert.equal(r.status,503);
 const data=await r.json();assert.equal(data.ok,false);
 assert.equal(data.code,'OMIO_PARTNER_ACCESS_REQUIRED');
});

function trainTrip(day,route,mode='RAIL',fare={amount:40,currency:'EUR',name:'Adult standard',
  riderCategory:{isDefaultFareCategory:true,riderCategoryName:'Adult'}}){
 const from=route==='out'?'Athens':'Thessaloniki',to=route==='out'?'Thessaloniki':'Athens';
 return {duration:4*3600,transfers:0,legs:[
  {mode,startTime:day+'T07:00:00+02:00',endTime:day+'T11:00:00+02:00',
    from:{name:from},to:{name:to},routeShortName:'IC 100'}],
  fareTransfers:[{products:[fare]}]};
}
test('Transitous keeps Greek local requested day and individual fare provenance',async()=>{
 const original=globalThis.fetch,calls=[];
 globalThis.fetch=async url=>{
  const u=new URL(String(url));assert.equal(u.hostname,'api.transitous.org');
  calls.push(u);
  assert.ok(/T00:00:00\+02:00$/.test(u.searchParams.get('time')),'Greek midnight local, not UTC midnight');
  const day=u.searchParams.get('time').slice(0,10),out=u.searchParams.get('fromPlace')==='37.99228,23.72056';
  return Response.json({itineraries:[
   trainTrip(day,out?'out':'in'),
   trainTrip(day,out?'out':'in','BUS'),
   trainTrip('2026-12-20',out?'out':'in')
  ]});
 };
 try{
  const path='/trains?origin=Athens&destination=Thessaloniki&date=2026-12-04&returnDate=2026-12-06';
  const response=await worker.fetch(req(path),env,{});
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.ok,true);
  assert.equal(data.priceBasis,'individual_feed_fare_unverified_travel_party');
  assert.equal(data.pricingScope.passengerMixApplied,false);
  assert.equal(data.pricingScope.finalCheckoutVerified,false);
  assert.equal(data.outbound.length,1,'Exclude wrong-day and mixed motorized routes');
  assert.equal(data.inbound.length,1);
  assert.equal(data.fares.roundTrip.amount,80);
  assert.equal(data.outbound[0].fare.amount,40);
  assert.equal(calls.length,2);
 }finally{globalThis.fetch=original;}
});

test('Transitous does not treat an unrecognized child-only category as adult fare',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async url=>{
  const u=new URL(String(url)),day=u.searchParams.get('time').slice(0,10);
  return Response.json({itineraries:[trainTrip(day,'out','RAIL',
    {amount:8,currency:'EUR',name:'Child only',riderCategory:{riderCategoryName:'Child'}})]});
 };
 try{
  const r=await worker.fetch(req('/trains?origin=Athens&destination=Thessaloniki&date=2026-12-04'),env,{});
  assert.equal(r.status,200);
  const x=await r.json();
  assert.equal(x.outbound.length,1);
  assert.equal(x.outbound[0].fare,null);
  assert.equal(x.fares.roundTrip,null);
 }finally{globalThis.fetch=original;}
});

test('Transitous rejects impossible calendar and inverted return dates',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=()=>{throw Error('No provider call expected');};
 try{
  for(const path of [
   '/trains?origin=Athens&destination=Thessaloniki&date=2026-02-30',
   '/trains?origin=Athens&destination=Thessaloniki&date=2026-12-04&returnDate=2026-12-01'
  ]){
   const response=await worker.fetch(req(path),env,{});
   assert.ok([400,422].includes(response.status));
  }
 }finally{globalThis.fetch=original;}
});

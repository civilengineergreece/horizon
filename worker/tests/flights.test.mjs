import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index-v6.js';

const origin='https://civilengineergreece.github.io';
const base='https://example.workers.dev';
const outbound={price:281,total_duration:55,departure_token:'mock-return-selection',
  flights:[{airline:'SKY express',flight_number:'GQ100',duration:55,
    departure_airport:{id:'ATH',time:'2026-11-27 07:30'},
    arrival_airport:{id:'SKG',time:'2026-11-27 08:25'}}]};
const inbound={price:337,total_duration:60,booking_token:'mock-booking-selection',
  flights:[{airline:'SKY express',flight_number:'GQ101',duration:60,
    departure_airport:{id:'SKG',time:'2026-11-29 20:00'},
    arrival_airport:{id:'ATH',time:'2026-11-29 21:00'}}]};
const query=new URLSearchParams({origin:'Athens',destination:'Thessaloniki',
  outboundDate:'2026-11-27',returnDate:'2026-11-29',adults:'2',infants:'1'});

test('round trip flow retains selected outbound token and quotes return combination',async()=>{
  const originalFetch=globalThis.fetch;
  const calls=[];
  globalThis.fetch=async url=>{
    const u=new URL(url);
    calls.push(u);
    assert.equal(u.hostname,'serpapi.com');
    assert.equal(u.searchParams.get('type'),'1');
    assert.equal(u.searchParams.get('adults'),'2');
    assert.equal(u.searchParams.get('infants_on_lap'),'1');
    if(u.searchParams.has('departure_token')){
      assert.equal(u.searchParams.get('departure_token'),'mock-return-selection');
      return Response.json({best_flights:[inbound]});
    }
    return Response.json({best_flights:[outbound]});
  };
  try{
    const env={SERPAPI_API_KEY:'mock-only',ALLOWED_ORIGIN:origin};
    const outgoing=await worker.fetch(new Request(base+'/flights?'+query,{headers:{Origin:origin}}),env,{});
    assert.equal(outgoing.status,200);
    const departure=await outgoing.json();
    assert.equal(departure.fareScope,'roundtrip_outbound_only');
    assert.equal(departure.results[0].departureToken,'mock-return-selection');
    assert.equal(departure.results[0].price,281);
    const response=await worker.fetch(new Request(base+'/flight-returns',{
      method:'POST',headers:{Origin:origin,'content-type':'application/json'},
      body:JSON.stringify({origin:'Athens',destination:'Thessaloniki',
        outboundDate:'2026-11-27',returnDate:'2026-11-29',adults:2,infants:1,
        departureToken:departure.results[0].departureToken})
    }),env,{});
    assert.equal(response.status,200);
    const returned=await response.json();
    assert.equal(returned.fareScope,'roundtrip_return_options');
    assert.equal(returned.results[0].price,337);
    assert.equal(returned.results[0].departure.airport,'SKG');
    assert.equal(returned.results[0].arrival.airport,'ATH');
    assert.equal(calls.length,2);
  }finally{globalThis.fetch=originalFetch;}
});

test('return selection requires a departure token',async()=>{
  const env={SERPAPI_API_KEY:'mock-only'};
  const request=new Request(base+'/flight-returns',{method:'POST',
    headers:{'content-type':'application/json'},body:JSON.stringify({
      origin:'Athens',destination:'Thessaloniki',outboundDate:'2026-11-27',
      returnDate:'2026-11-29',adults:2,departureToken:''})});
  const response=await worker.fetch(request,env,{});
  assert.equal(response.status,400);
  assert.equal((await response.json()).ok,false);
});

test('return endpoint rejects GET',async()=>{
  const r=await worker.fetch(new Request(base+'/flight-returns'),{SERPAPI_API_KEY:'mock-only'},{});
  assert.equal(r.status,405);
});

test('missing provider key reports unavailable rather than fake results',async()=>{
  const r=await worker.fetch(new Request(base+'/flights?'+query),{},{});
  assert.equal(r.status,503);
  assert.equal((await r.json()).code,'SERPAPI_KEY_REQUIRED');
});


test('booking options use selected booking token and return seller price and baggage policies',async()=>{
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async url=>{
    const u=new URL(url);
    assert.equal(u.hostname,'serpapi.com');
    assert.equal(u.searchParams.get('booking_token'),'selected-booking-token');
    assert.equal(u.searchParams.get('type'),'1');
    assert.equal(u.searchParams.get('infants_on_lap'),'1');
    assert.equal(u.searchParams.get('return_date'),'2026-11-29');
    return Response.json({baggage_prices:{together:['1 free carry-on','Checked bag: 30']},
      booking_options:[{together:{book_with:'Example airline',price:355,
        baggage_prices:['1 free carry-on','Checked bag: 30'],
        booking_request:{url:'https://www.google.com/travel/clk/f',post_data:'signed=token'}}}]});
  };
  try{
    const input={origin:'Athens',destination:'Thessaloniki',
      outboundDate:'2026-11-27',returnDate:'2026-11-29',adults:2,children:0,infants:1,
      bookingToken:'selected-booking-token'};
    const response=await worker.fetch(new Request(base+'/flight-booking-options',{method:'POST',
      headers:{Origin:origin,'content-type':'application/json'},body:JSON.stringify(input)}),
      {SERPAPI_API_KEY:'mock-only',ALLOWED_ORIGIN:origin},{});
    assert.equal(response.status,200);
    const result=await response.json();
    assert.equal(result.results[0].price,355);
    assert.equal(result.results[0].seller,'Example airline');
    assert.deepEqual(result.results[0].baggage.together,['1 free carry-on','Checked bag: 30']);
    assert.equal(result.results[0].bookingUrl,null,'POST booking actions must not be exposed as ordinary links');
    assert.equal(result.infantBreakdownConfirmed,false,'No unsupported claim of infant fare breakdown');
  }finally{globalThis.fetch=originalFetch;}
});

test('booking endpoint rejects missing token and non-POST request',async()=>{
  const env={SERPAPI_API_KEY:'mock-only'};
  const bad=await worker.fetch(new Request(base+'/flight-booking-options',{method:'POST',
    headers:{'content-type':'application/json'},body:JSON.stringify({
      origin:'Athens',destination:'Thessaloniki',outboundDate:'2026-11-27',bookingToken:''})}),env,{});
  assert.equal(bad.status,400);
  const invalidMethod=await worker.fetch(new Request(base+'/flight-booking-options'),env,{});
  assert.equal(invalidMethod.status,405);
});

test('separate-ticket booking prices combine only when both parts have explicit prices',async()=>{
  const originalFetch=globalThis.fetch;
  let n=0;
  globalThis.fetch=async()=>{
    n++;
    return Response.json({booking_options:[{separate_tickets:true,
      departing:{book_with:'Seller A',price:150},returning:{book_with:'Seller B',price:170}},
      {separate_tickets:true,departing:{book_with:'Seller C',price:80}}]});
  };
  try{
    const response=await worker.fetch(new Request(base+'/flight-booking-options',{method:'POST',
      headers:{'content-type':'application/json'},body:JSON.stringify({
        origin:'Athens',destination:'Thessaloniki',outboundDate:'2026-11-27',
        returnDate:'2026-11-29',adults:1,bookingToken:'valid'})}),
        {SERPAPI_API_KEY:'mock-only'},{});
    const data=await response.json();
    assert.equal(n,1);
    assert.equal(data.results.length,1);
    assert.equal(data.results[0].price,320);
    assert.equal(data.results[0].separateTickets,true);
  }finally{globalThis.fetch=originalFetch;}
});

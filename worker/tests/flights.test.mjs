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
    assert.equal(returned.results[0].bookingToken,'mock-booking-selection');
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
    assert.equal(result.results[0].bookingActions.length,1);
    assert.deepEqual(result.results[0].bookingActions[0].handoff,{
      method:'POST',url:'https://www.google.com/travel/clk/f',postData:'signed=token',
      source:'google_flights_booking_request'
    });
    assert.equal(result.infantBreakdownConfirmed,false,'No unsupported claim of infant fare breakdown');
  }finally{globalThis.fetch=originalFetch;}
});

test('seller booking handoffs are source-provided, URL-validated and never server-side followed',async()=>{
 const original=globalThis.fetch,calls=[];
 globalThis.fetch=async url=>{
   calls.push(String(url));
   return Response.json({booking_options:[
    {together:{book_with:'Direct airline',price:222,booking_request:{url:'https://airline.example/booking?offer=pinned'}}},
    {together:{book_with:'Signed Google',price:255,booking_request:{url:'https://www.google.com/travel/clk/f',post_data:'u=signed_mock_payload%2B01'}}},
    {together:{book_with:'Unsafe scripted',price:280,booking_request:{url:'javascript:alert(1)'}}},
    {together:{book_with:'Unsafe POST domain',price:290,booking_request:{url:'https://phishing.example/submit',post_data:'u=signed'}}},
    {together:{book_with:'Local private host',price:300,booking_request:{url:'https://127.0.0.1/test'}}},
    {together:{book_with:'Malformed signed token',price:310,booking_request:{url:'https://www.google.com/travel/clk/f',post_data:'u=signed\\nInjected:1'}}}
   ]});
 };
 try{
  const req=new Request(base+'/flight-booking-options',{method:'POST',
    headers:{'content-type':'application/json'},body:JSON.stringify({
      origin:'Athens',destination:'Thessaloniki',outboundDate:'2026-12-04',
      adults:2,bookingToken:'mock-booking-token'
    })});
  const response=await worker.fetch(req,{SERPAPI_API_KEY:'fake-only'},{}),json=await response.json();
  assert.equal(response.status,200);
  assert.equal(calls.length,1,'Worker should ONLY call SerpApi, never post to merchant/Google');
  assert.equal(new URL(calls[0]).hostname,'serpapi.com');
  assert.equal(json.results[0].bookingActions[0].handoff.method,'GET');
  assert.equal(json.results[0].bookingActions[0].handoff.url,'https://airline.example/booking?offer=pinned');
  assert.equal(json.results[1].bookingActions[0].handoff.method,'POST');
  assert.equal(json.results[1].bookingActions[0].handoff.postData,'u=signed_mock_payload%2B01');
  for(const entry of json.results.slice(2))assert.equal(entry.bookingActions.length,0,entry.seller);
 }finally{globalThis.fetch=original;}
});

test('roundtrip with two sellers exposes two separate provider handoffs, never one combined booking',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async()=>Response.json({booking_options:[{
  separate_tickets:true,
  departing:{book_with:'Departure Seller',price:100,
    booking_request:{url:'https://www.google.com/travel/clk/f',post_data:'u=outbound_signed'}},
  returning:{book_with:'Return Seller',price:140,
    booking_request:{url:'https://return.example/flight-offer'}}
 }]});
 try{
  const req=new Request(base+'/flight-booking-options',{method:'POST',
   headers:{'content-type':'application/json'},body:JSON.stringify({
    origin:'Athens',destination:'Thessaloniki',outboundDate:'2026-12-04',
    returnDate:'2026-12-06',adults:2,bookingToken:'mock-booking-token'
   })});
  const res=await worker.fetch(req,{SERPAPI_API_KEY:'fake-only'},{}),j=await res.json();
  assert.equal(res.status,200);
  assert.equal(j.results[0].price,240);
  assert.deepEqual(j.results[0].bookingActions.map(a=>a.part),['departing','returning']);
  assert.deepEqual(j.results[0].bookingActions.map(a=>a.handoff.method),['POST','GET']);
  assert.equal(j.results[0].bookingUrl,null);
 }finally{globalThis.fetch=original;}
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


test('booking can pin exact outbound+return segment flight numbers without booking_token',async()=>{
  const originalFetch=globalThis.fetch;
  let calls=0;
  globalThis.fetch=async url=>{
    calls++;
    const u=new URL(url);
    assert.equal(u.searchParams.has('booking_token'),false);
    const json=JSON.parse(u.searchParams.get('selected_flights_json'));
    assert.deepEqual(json,{outbound:[{flight_number:'GQ100',departure_id:'ATH',arrival_id:'SKG',date:'2026-12-04'}],
      return:[{flight_number:'GQ101',departure_id:'SKG',arrival_id:'ATH',date:'2026-12-06'}]});
    return Response.json({booking_options:[{together:{book_with:'Pin Seller',price:365}}]});
  };
  try{
    const response=await worker.fetch(new Request(base+'/flight-booking-options',{method:'POST',
      headers:{'content-type':'application/json'},body:JSON.stringify({
        origin:'Athens',destination:'Thessaloniki',outboundDate:'2026-12-04',returnDate:'2026-12-06',
        adults:2,infants:1,bookingToken:'',
        outboundSegments:[{flightNumber:'GQ 100',departure:{airport:'ATH',time:'2026-12-04 07:30'},arrival:{airport:'SKG',time:'2026-12-04 08:25'}}],
        returnSegments:[{flightNumber:'GQ 101',departure:{airport:'SKG',time:'2026-12-06 19:00'},arrival:{airport:'ATH',time:'2026-12-06 20:00'}}]
      })}),{SERPAPI_API_KEY:'mock-only'},{});
    const data=await response.json();
    assert.equal(response.status,200);
    assert.equal(data.lookupMethod,'selected_flights_json');
    assert.equal(data.results[0].price,365);
    assert.equal(calls,1);
  }finally{globalThis.fetch=originalFetch;}
});

test('invalid pin segments without booking_token cannot trigger provider searches',async()=>{
  const response=await worker.fetch(new Request(base+'/flight-booking-options',{method:'POST',
    headers:{'content-type':'application/json'},body:JSON.stringify({
      origin:'Athens',destination:'Thessaloniki',outboundDate:'2026-12-04',returnDate:'2026-12-06',
      outboundSegments:[{flightNumber:'invalid',departure:{airport:'ATH',time:'2026-12-04 07:30'},arrival:{airport:'SKG'}}],
      returnSegments:[{flightNumber:'GQ100'}]
    })}),{SERPAPI_API_KEY:'mock-only'},{});
  assert.equal(response.status,400);
});


test('official SKY express screenshot fixture is arithmetically consistent without double-counting taxes',()=>{
  // Official selection summary supplied by a user, 4–6 Dec 2026,
  // ATH–SKG GQ380 / SKG–ATH GQ389; not a live booking quote or dynamic API value.
  const outAdultBase=82,outInfant=7.16,outTaxes=61.24;
  const inAdultBase=98,inInfant=7.38,bothLegTaxes=110.84;
  assert.equal(outAdultBase+outInfant+outTaxes,150.40);
  assert.equal(inAdultBase+inInfant+(bothLegTaxes-outTaxes),154.98);
  assert.equal(Math.round(((outAdultBase+inAdultBase)+(outInfant+inInfant)+bothLegTaxes)*100)/100,305.38);
  assert.equal(Math.round((2*(71.62+73.80)+(outInfant+inInfant))*100)/100,305.38);
});

test('do not silently clamp passenger counts or allow more lap infants than adults',async()=>{
  const env={SERPAPI_API_KEY:'mock-only'};
  const invalidGroups=[
    {adults:1,children:0,infants:2},
    {adults:10,children:0,infants:0},
    {adults:2,children:9,infants:0},
    {adults:1.5,children:0,infants:0},
    {adults:2,children:0,infants:-1},
    {adults:2,children:0,infants:8}
  ];
  for(const group of invalidGroups){
    const fields=new URLSearchParams({...group,origin:'Athens',destination:'Thessaloniki',
      outboundDate:'2026-12-04',returnDate:'2026-12-06'});
    const res=await worker.fetch(new Request(base+'/flights?'+fields.toString()),env,{});
    assert.equal(res.status,422,JSON.stringify(group));
    assert.equal((await res.json()).code,'INVALID_PASSENGERS');
  }
});

test('invalid calendar dates are rejected rather than passed to provider',async()=>{
  const env={SERPAPI_API_KEY:'mock-only'};
  for(const date of ['2026-02-30','2026-13-01','2026-11-31']){
    const fields=new URLSearchParams({origin:'Athens',destination:'Thessaloniki',outboundDate:date,returnDate:'2026-12-06'});
    const res=await worker.fetch(new Request(base+'/flights?'+fields),env,{});
    assert.equal(res.status,400,date);
  }
});

test('invalid airport/date itineraries are filtered and fare searches cannot be cached for six hours',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async()=>Response.json({best_flights:[
    {...outbound,price:50,flights:[{...outbound.flights[0],departure_airport:{id:'SKG',time:'2026-11-27 07:30'}}]},
    {...outbound,price:60,flights:[{...outbound.flights[0],departure_airport:{id:'ATH',time:'2026-11-28 07:30'}}]},
    outbound
  ]});
  try{
    const res=await worker.fetch(new Request(base+'/flights?'+query),{SERPAPI_API_KEY:'mock-only'},{});
    assert.equal(res.status,200);
    assert.equal(res.headers.get('cache-control'),'no-store');
    const data=await res.json();
    assert.equal(data.cache.ttlSeconds,0);
    assert.equal(data.results.length,1);
    assert.equal(data.results[0].price,281);
  }finally{globalThis.fetch=original;}
});

test('return results from the wrong airport or day are rejected',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async()=>Response.json({best_flights:[
    {...inbound,price:15,flights:[{...inbound.flights[0],departure_airport:{id:'ATH',time:'2026-11-29 20:00'}}]},
    {...inbound,price:20,flights:[{...inbound.flights[0],departure_airport:{id:'SKG',time:'2026-11-30 20:00'}}]},
    inbound
  ]});
  try{
    const res=await worker.fetch(new Request(base+'/flight-returns',{method:'POST',
      headers:{'content-type':'application/json'},body:JSON.stringify({
        origin:'Athens',destination:'Thessaloniki',outboundDate:'2026-11-27',
        returnDate:'2026-11-29',adults:2,infants:1,departureToken:'mock-return-selection'
      })}),{SERPAPI_API_KEY:'mock-only'},{});
    assert.equal(res.status,200);
    const data=await res.json();
    assert.equal(data.results.length,1);
    assert.equal(data.results[0].price,337);
  }finally{globalThis.fetch=original;}
});

test('provider errors must not echo API keys in public responses',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async()=>Response.json({error:'Provider query failed',api_key:'secret-should-not-leak'}, {status:502});
  try{
    const res=await worker.fetch(new Request(base+'/flights?'+query),{SERPAPI_API_KEY:'secret-should-not-leak'},{});
    assert.ok(res.status>=400);
    assert.equal((await res.text()).includes('secret-should-not-leak'),false);
  }finally{globalThis.fetch=original;}
});


test('pinned booking lookup rejects an itinerary that differs from requested airports/date',async()=>{
  const original=globalThis.fetch;let searches=0;
  globalThis.fetch=async()=>{searches++;throw Error('should not query provider');};
  try{
    const response=await worker.fetch(new Request(base+'/flight-booking-options',{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({origin:'Athens',destination:'Thessaloniki',
        outboundDate:'2026-12-04',returnDate:'2026-12-06',adults:2,infants:1,
        outboundSegments:[{flightNumber:'GQ380',departure:{airport:'SKG',time:'2026-12-04 07:30'},arrival:{airport:'ATH',time:'2026-12-04 08:25'}}],
        returnSegments:[{flightNumber:'GQ389',departure:{airport:'SKG',time:'2026-12-06 22:00'},arrival:{airport:'ATH',time:'2026-12-06 23:00'}}]
      })
    }),{SERPAPI_API_KEY:'mock-only'},{});
    assert.equal(response.status,400);
    assert.equal((await response.json()).code,'PINNED_FLIGHT_MISMATCH');
    assert.equal(searches,0);
  }finally{globalThis.fetch=original;}
});

test('booking options preserve evidence of exact provider-selected flights when exposed',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async()=>Response.json({
    selected_flights:[
      {flights:[{airline:'SKY express',flight_number:'GQ380',duration:55,
        departure_airport:{id:'ATH',time:'2026-12-04 07:30'},arrival_airport:{id:'SKG',time:'2026-12-04 08:25'}}]},
      {flights:[{airline:'SKY express',flight_number:'GQ389',duration:60,
        departure_airport:{id:'SKG',time:'2026-12-06 22:00'},arrival_airport:{id:'ATH',time:'2026-12-06 23:00'}}]}
    ],
    booking_options:[{together:{book_with:'Official Seller',price:305.38}}]
  });
  try{
    const req=new Request(base+'/flight-booking-options',{method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({origin:'Athens',destination:'Thessaloniki',outboundDate:'2026-12-04',returnDate:'2026-12-06',
        adults:2,infants:1,bookingToken:'',
        outboundSegments:[{flightNumber:'GQ380',departure:{airport:'ATH',time:'2026-12-04 07:30'},arrival:{airport:'SKG',time:'2026-12-04 08:25'}}],
        returnSegments:[{flightNumber:'GQ389',departure:{airport:'SKG',time:'2026-12-06 22:00'},arrival:{airport:'ATH',time:'2026-12-06 23:00'}}]
      })});
    const response=await worker.fetch(req,{SERPAPI_API_KEY:'mock-only'},{});
    assert.equal(response.status,200);
    const data=await response.json();
    assert.deepEqual(data.selectedItinerary.flatMap(g=>g.segments.map(s=>s.flightNumber)),['GQ380','GQ389']);
    assert.equal(data.results[0].price,305.38);
    assert.equal(data.infantBreakdownConfirmed,false);
  }finally{globalThis.fetch=original;}
});


test('flight capability endpoint needs no paid provider call and confirms strict version',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async()=>{throw Error('Must not call SerpApi for readiness');};
  try{
    const res=await worker.fetch(new Request(base+'/flight-capabilities'),{},{});
    assert.equal(res.status,200);
    assert.equal(res.headers.get('cache-control'),'no-store');
    const caps=await res.json();
    assert.equal(caps.schemaVersion,3);
    assert.equal(caps.quoteCacheNoStore,true);
    assert.equal(caps.validatesTravelerCounts,true);
  }finally{globalThis.fetch=original;}
});


test('seller quote is rejected if provider-selected flight numbers contradict the pinned selection',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async()=>Response.json({
    selected_flights:[
      {flights:[{airline:'SKY express',flight_number:'GQ380',duration:55,
        departure_airport:{id:'ATH',time:'2026-12-04 07:30'},arrival_airport:{id:'SKG',time:'2026-12-04 08:25'}}]},
      {flights:[{airline:'SKY express',flight_number:'GQ388',duration:60,
        departure_airport:{id:'SKG',time:'2026-12-06 22:00'},arrival_airport:{id:'ATH',time:'2026-12-06 23:00'}}]}
    ],
    booking_options:[{together:{book_with:'Different Flight Seller',price:150}}]
  });
  try{
    const response=await worker.fetch(new Request(base+'/flight-booking-options',{method:'POST',
      headers:{'content-type':'application/json'},body:JSON.stringify({
        origin:'Athens',destination:'Thessaloniki',outboundDate:'2026-12-04',
        returnDate:'2026-12-06',adults:2,infants:1,
        outboundSegments:[{flightNumber:'GQ380',departure:{airport:'ATH',time:'2026-12-04 07:30'},arrival:{airport:'SKG',time:'2026-12-04 08:25'}}],
        returnSegments:[{flightNumber:'GQ389',departure:{airport:'SKG',time:'2026-12-06 22:00'},arrival:{airport:'ATH',time:'2026-12-06 23:00'}}]
      })}),{SERPAPI_API_KEY:'mock-only'},{});
    assert.equal(response.status,502);
    assert.equal((await response.json()).code,'ITINERARY_MISMATCH');
  }finally{globalThis.fetch=original;}
});

import test from 'node:test';
import assert from 'node:assert/strict';
// Provider normalization unit tests isolate legacy domain logic; search-guard.test.mjs
// separately tests the deployed v6 Cloudflare authorization/rate-limit boundary.
import worker from '../src/index.js';
const base='https://example.workers.dev';

test('invalid occupancy and unsupported room allocations fail before provider billing',async()=>{
  const old=globalThis.fetch;
  globalThis.fetch=async()=>{throw Error('Provider must not be called');};
  try{
    const input={destination:'Thessaloniki',checkInDate:'2026-12-04',checkOutDate:'2026-12-06',adults:2};
    for(const patch of [{adults:0},{adults:2.5},{adults:11},{children:-1},{infants:'bad'},
      {rooms:2},{roomsCount:2},{roomCount:0},{roomAllocations:[{adults:2}]}]){
      for(const method of ['GET','POST']){
        const payload={...input,...patch};
        const request=method==='GET'?new Request(base+'/stays?'+new URLSearchParams(payload)):
          new Request(base+'/stays',{method,headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
        const response=await worker.fetch(request,{SERPAPI_API_KEY:'mock'},{});
        assert.equal(response.status,422,JSON.stringify(patch));
      }
    }
    const response=await worker.fetch(new Request(base+'/hotel-details',{method:'POST',
      headers:{'content-type':'application/json'},body:JSON.stringify({rooms:2})}),{SERPAPI_API_KEY:'mock'},{});
    assert.equal(response.status,422);
  }finally{globalThis.fetch=old;}
});

test('Google Hotels receives infant age 1 and does not conflate child occupancy',async()=>{
  const original=globalThis.fetch;
  let requests=0;
  globalThis.fetch=async uri=>{
    requests++;
    const u=new URL(uri);
    assert.equal(u.searchParams.get('engine'),'google_hotels');
    assert.equal(u.searchParams.get('adults'),'2');
    assert.equal(u.searchParams.get('children'),'1');
    assert.equal(u.searchParams.get('children_ages'),'1');
    assert.equal(u.searchParams.get('check_in_date'),'2026-12-04');
    assert.equal(u.searchParams.get('check_out_date'),'2026-12-06');
    return Response.json({properties:[
      {name:'Sample after-tax hotel',rate_per_night:{extracted_lowest:105},
        total_rate:{extracted_lowest:220,extracted_after_taxes_fees:250,extracted_before_taxes_fees:210}},
      {name:'Sample nightly-only hotel',rate_per_night:{extracted_lowest:70}},
      {name:'Sample ambiguous tax hotel',total_rate:{extracted_lowest:200},rate_per_night:{extracted_lowest:90}}
    ]});
  };
  try{
    const input={destination:'Thessaloniki',checkInDate:'2026-12-04',checkOutDate:'2026-12-06',
      adults:2,children:0,infants:1};
    const req=new Request(base+'/stays',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input)});
    const response=await worker.fetch(req,{SERPAPI_API_KEY:'mock-only'},{});
    assert.equal(response.status,200);
    const data=await response.json();
    assert.equal(data.nights,2);
    assert.equal(data.adults,2);
    assert.equal(data.infants,1);
    assert.equal(data.children,0);
    assert.deepEqual(data.providerAges,[1]);
    assert.equal(requests,1);
    const exact=data.results.find(x=>x.name==='Sample after-tax hotel');
    assert.equal(exact.total,250);
    assert.equal(exact.taxStatus,'provider_reports_after_taxes_fees');
    assert.equal(exact.totalBeforeTaxesFees,210);
    const nightly=data.results.find(x=>x.name==='Sample nightly-only hotel');
    assert.equal(nightly.total,null,'nightly×nights is not a verified live total');
    assert.equal(nightly.totalEstimate,140);
    assert.equal(nightly.taxStatus,'total_not_provided');
    const ambiguous=data.results.find(x=>x.name==='Sample ambiguous tax hotel');
    assert.equal(ambiguous.total,200);
    assert.equal(ambiguous.taxStatus,'taxes_and_fees_unknown');
  }finally{globalThis.fetch=original;}
});

test('School-aged children require real ages; infants independently use age 1',async()=>{
  const noAges=await worker.fetch(new Request(base+'/stays',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({destination:'Thessaloniki',checkInDate:'2026-12-04',
      checkOutDate:'2026-12-06',adults:2,children:1,infants:1})}),{SERPAPI_API_KEY:'mock'},{});
  assert.equal(noAges.status,422);
  assert.equal((await noAges.json()).code,'CHILD_AGES_REQUIRED');
  const original=globalThis.fetch;
  globalThis.fetch=async uri=>{
    const u=new URL(uri);
    assert.equal(u.searchParams.get('children'),'2');
    assert.equal(u.searchParams.get('children_ages'),'8,1');
    return Response.json({properties:[]});
  };
  try{
    const valid=await worker.fetch(new Request(base+'/stays',{method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({destination:'Thessaloniki',checkInDate:'2026-12-04',
        checkOutDate:'2026-12-06',adults:2,children:1,childrenAges:[8],infants:1})}),{SERPAPI_API_KEY:'mock'},{});
    assert.equal(valid.status,200);
    assert.deepEqual((await valid.json()).providerAges,[8,1]);
  }finally{globalThis.fetch=original;}
});


test('health-style hotel capabilities endpoint is free of provider calls',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async()=>{throw Error('Capabilities must not contact SerpApi');};
  try{
    const res=await worker.fetch(new Request(base+'/hotel-capabilities'),{},{});
    assert.equal(res.status,200);
    const data=await res.json();
    assert.equal(data.schemaVersion,5);
    assert.equal(data.nightlyEstimateNeverReportedAsActualTotal,true);
    assert.equal(data.hotelRoomOffers,true);
    assert.equal(data.hotelPagination,true);
    assert.equal(data.hotelMapCoordinates,true);
    assert.equal(data.hotelRoomTerms,true);
  }finally{globalThis.fetch=original;}
});


test('hotel pagination preserves exact search criteria and never exposes SerpApi private key',async()=>{
  const original=globalThis.fetch;let hit=0;
  globalThis.fetch=async uri=>{
    hit++;
    const u=new URL(uri);
    assert.equal(u.searchParams.get('engine'),'google_hotels');
    assert.equal(u.searchParams.get('next_page_token'),'CBI=');
    assert.equal(u.searchParams.get('adults'),'2');
    assert.equal(u.searchParams.get('children'),'1');
    assert.equal(u.searchParams.get('children_ages'),'1');
    assert.equal(u.searchParams.get('check_in_date'),'2026-12-04');
    return Response.json({properties:[{name:'Second Page Hotel',
      property_token:'ChgIsecondPageToken2026',gps_coordinates:{latitude:40.62,longitude:22.94},
      hotel_class:'4-star hotel',total_rate:{extracted_after_taxes_fees:224}}],
      serpapi_pagination:{current_from:21,current_to:21,next_page_token:'CDI='}});
  };
  try{
    const req=new Request(base+'/stays?'+new URLSearchParams({
      destination:'Thessaloniki',checkInDate:'2026-12-04',checkOutDate:'2026-12-06',
      adults:2,children:0,infants:1,nextPageToken:'CBI='
    }));
    const res=await worker.fetch(req,{SERPAPI_API_KEY:'not-for-public-response'},{});
    assert.equal(res.status,200);
    const raw=await res.text();
    assert.equal(raw.includes('not-for-public-response'),false);
    const data=JSON.parse(raw);
    assert.equal(hit,1);
    assert.equal(data.results.length,1);
    assert.equal(data.results[0].total,224);
    assert.equal(data.results[0].hotelClass,4);
    assert.equal(data.results[0].latitude,40.62);
    assert.ok(data.results[0].retrievedAt,'Hotel quote should carry individual retrieval timestamp');
    assert.equal(data.pagination.nextPageToken,'CDI=');
    assert.equal(data.pagination.hasMore,true);
    assert.equal(data.pagination.currentFrom,21);
  }finally{globalThis.fetch=original;}
});

test('malformed pagination token fails before any paid provider call',async()=>{
  const old=globalThis.fetch;let used=0;
  globalThis.fetch=async()=>{used++;throw Error('must not call provider');};
  try{
    for(const token of ['a b c','!malicious!', 'x'.repeat(2100)]){
      const req=new Request(base+'/stays?'+new URLSearchParams({
        destination:'Thessaloniki',checkInDate:'2026-12-04',
        checkOutDate:'2026-12-06',adults:2,infants:1,nextPageToken:token
      }));
      const res=await worker.fetch(req,{SERPAPI_API_KEY:'mock-only'},{});
      assert.equal(res.status,400);
      assert.equal((await res.json()).code,'INVALID_NEXT_PAGE_TOKEN');
    }
    assert.equal(used,0);
  }finally{globalThis.fetch=old;}
});

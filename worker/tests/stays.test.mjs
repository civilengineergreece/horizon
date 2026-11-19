import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index-v6.js';
const base='https://example.workers.dev';

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

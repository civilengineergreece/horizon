import test from 'node:test';
import assert from 'node:assert/strict';
// Provider normalization unit tests isolate legacy domain logic; search-guard.test.mjs
// separately tests the deployed v6 Cloudflare authorization/rate-limit boundary.
import worker from '../src/index.js';
const root='https://example.workers.dev';
const input={propertyToken:'ChgIexamplePropertyToken2026',checkInDate:'2026-12-04',checkOutDate:'2026-12-06',
  adults:2,children:0,infants:1};

test('room lookup sends actual family composition and returns named room quotes with provider tax basis',async()=>{
  const old=globalThis.fetch;let called=0;
  globalThis.fetch=async raw=>{
    called++;
    const u=new URL(raw);
    assert.equal(u.searchParams.get('engine'),'google_hotels');
    assert.equal(u.searchParams.get('property_token'),input.propertyToken);
    assert.equal(u.searchParams.get('adults'),'2');
    assert.equal(u.searchParams.get('children'),'1');
    assert.equal(u.searchParams.get('children_ages'),'1');
    assert.equal(u.searchParams.get('check_in_date'),'2026-12-04');
    assert.equal(u.searchParams.get('check_out_date'),'2026-12-06');
    return Response.json({name:'Family Example Hotel',hotel_class:'4-star hotel',amenities:['WiFi'],
      amenities_detailed:{popular:[{title:'Crib',label:'Free',available:true}]},
      address:'Sample address',
      prices:[{source:'Hotel direct',official:true,link:'https://example.com/direct',rooms:[
        {name:'Double with cot on request',num_guests:2,beds:[{type:'Queen',count:1}],rates:[
          {total_rate:{extracted_after_taxes_fees:255,extracted_before_taxes_fees:234},
            free_cancellation:true,free_cancellation_until_date:'2026-12-01',free_cancellation_until_time:'6:00pm',
            breakfast_included:true,link:'https://example.com/book'},
          {total_rate:{extracted_lowest:220},free_cancellation:false,link:'https://example.com/locked'}]},
        {name:'Single room',num_guests:1,total_rate:{extracted_lowest:150}}
      ]},
      {source:'Unknown capacity seller',num_guests:null,link:'http://invalid.test',
        total_rate:{extracted_lowest:200}}]});
  };
  try{
    const res=await worker.fetch(new Request(root+'/hotel-details',{method:'POST',
      headers:{'content-type':'application/json'},body:JSON.stringify(input)}),
      {SERPAPI_API_KEY:'mock-only'},{});
    assert.equal(res.status,200);
    const d=await res.json();
    assert.equal(d.name,'Family Example Hotel');
    assert.equal(d.hotelClass,4);
    assert.equal(d.infants,1);
    assert.equal(d.cribAdvertised,true);
    assert.equal(d.cribFeeHint,'property_lists_free');
    assert.equal(d.cribEvidenceScope,'property_amenity_not_room_confirmation');
    assert.equal(d.cribConfirmedForParty,false);
    assert.equal(d.offers.length,4);
    const refundable=d.offers.find(x=>x.total===255);
    assert.equal(refundable.numGuests,2);
    assert.equal(refundable.capacityStatus,'listed_capacity_sufficient_for_non_infants');
    assert.equal(refundable.freeCancellation,true);
    assert.equal(refundable.freeCancellationUntil,'2026-12-01');
    assert.equal(refundable.freeCancellationUntilTime,'6:00pm');
    assert.equal(refundable.breakfastIncluded,true);
    assert.equal(refundable.beds.length,1);
    assert.equal(refundable.beds[0].type,'Queen');
    assert.equal(refundable.taxStatus,'provider_reports_after_taxes_fees');
    assert.equal(refundable.totalBeforeTaxesFees,234);
    assert.equal(refundable.bookingLinkScope,'provider_rate_link');
    assert.equal(refundable.bookingUrl,'https://example.com/book');
    const inherited=d.offers.find(x=>x.total===150);
    assert.equal(inherited.bookingLinkScope,'inherited_seller_link');
    assert.equal(inherited.bookingUrl,'https://example.com/direct');
    const cheap=d.offers.find(x=>x.total===150);
    assert.equal(cheap.capacityStatus,'insufficient');
    const unknown=d.offers.find(x=>x.total===200);
    assert.equal(unknown.capacityStatus,'unknown');
    assert.equal(unknown.bookingUrl,null);
    assert.equal(res.headers.get('cache-control'),'no-store');
    assert.equal(called,1);
  }finally{globalThis.fetch=old;}
});

test('invalid property token, dates and age combinations cannot consume provider quota',async()=>{
  const old=globalThis.fetch;let called=0;
  globalThis.fetch=async()=>{called++;throw Error('should never call');};
  try{
    const cases=[
      [{...input,propertyToken:'fake!token'},400,'INVALID_PROPERTY_TOKEN'],
      [{...input,checkOutDate:'2026-12-04'},400,'INVALID_NIGHTS'],
      [{...input,checkInDate:'2026-13-04'},400,'INVALID_DATES'],
      [{...input,children:1,childrenAges:[]},422,'CHILD_AGES_REQUIRED'],
      [{...input,infants:11},422,'INVALID_OCCUPANCY']
    ];
    for(const [payload,status,code] of cases){
      const res=await worker.fetch(new Request(root+'/hotel-details',{method:'POST',
        headers:{'content-type':'application/json'},body:JSON.stringify(payload)}),
        {SERPAPI_API_KEY:'mock-only'},{});
      assert.equal(res.status,status,code);
      assert.equal((await res.json()).code,code);
    }
    assert.equal(called,0);
  }finally{globalThis.fetch=old;}
});

import assert from 'node:assert/strict';
import {appendFileSync} from 'node:fs';

const base='https://horizon-live-api.gnchristou.workers.dev';
const results=[];
function mark(k,v){const msg=k+': '+v;results.push(msg);console.log(msg);}
async function get(url){
  const r=await fetch(base+url,{signal:AbortSignal.timeout(26000)});
  const body=await r.json().catch(()=>({}));
  return {status:r.status,body};
}
try{
  const health=await get('/health');
  mark('Worker health','HTTP '+health.status);
  assert.equal(health.status,200);
  assert.equal(health.body.ok,true);
  let capabilities;
  for(let attempt=0;attempt<16;attempt++){
    capabilities=await get('/hotel-capabilities');
    if(capabilities.status===200&&capabilities.body.schemaVersion===5)break;
    if(attempt<15)await new Promise(resolve=>setTimeout(resolve,10000));
  }
  mark('Hotel API production version','HTTP '+capabilities.status+'; schema '+String(capabilities.body.schemaVersion||'not published'));
  assert.equal(capabilities.status,200,'New hotel Worker not deployed');
  assert.equal(capabilities.body.schemaVersion,5,'New hotel pricing schema not deployed');
  const params=new URLSearchParams({
    destination:'Thessaloniki',checkInDate:'2026-12-04',
    checkOutDate:'2026-12-06',adults:'2',children:'0',infants:'1'
  });
  const live=await get('/stays?'+params);
  mark('Family hotel search','HTTP '+live.status+'; '+(live.body?.results?.length||0)+' hotels');
  assert.equal(live.status,200,'Google Hotels call failed: '+String(live.body?.error||''));
  assert.equal(live.body.adults,2);
  assert.equal(live.body.children,0);
  assert.equal(live.body.infants,1);
  assert.deepEqual(live.body.providerAges,[1],'Production Worker must translate infant to Google Hotels age 1');
  assert.equal(live.body.nights,2);
  assert.ok(live.body.results?.length>0,'No actual hotel listings were returned');
  const mapped=live.body.results.filter(h=>typeof h.latitude==='number'&&typeof h.longitude==='number'&&
    Number.isFinite(h.latitude)&&Number.isFinite(h.longitude)&&Math.abs(h.latitude)<=90&&Math.abs(h.longitude)<=180);
  mark('Real hotel coordinates',mapped.length+' of '+live.body.results.length+' with valid GPS positions');
  assert.ok(mapped.length>0,'No map-able hotel coordinates returned by production Google Hotels');
  assert.ok(live.body.pagination&&typeof live.body.pagination.hasMore==='boolean',
    'Production hotel API must expose trustworthy pagination metadata');
  mark('Google Hotels more pages',String(live.body.pagination.hasMore));
  let secondPageItems=[];
  if(live.body.pagination.hasMore){
    const token=live.body.pagination.nextPageToken;
    assert.ok(typeof token==='string'&&token.length>0,'No valid nextPageToken');
    const nextParams=new URLSearchParams(params);
    nextParams.set('nextPageToken',token);
    const next=await get('/stays?'+nextParams);
    mark('Real second hotel page','HTTP '+next.status+'; '+(next.body.results?.length||0)+' listings');
    assert.equal(next.status,200,'Second Google Hotels page failed');
    assert.equal(next.body.adults,2);
    assert.equal(next.body.infants,1);
    assert.equal(next.body.nights,2);
    assert.ok(next.body.results?.length>0,'Google Hotels page token returned no listings');
    secondPageItems=next.body.results;
    const firstIds=new Set(live.body.results.map(x=>String(x.propertyToken||x.id||x.name)));
    const fresh=next.body.results.filter(x=>!firstIds.has(String(x.propertyToken||x.id||x.name)));
    mark('Unique second-page properties',String(fresh.length));
    assert.ok(fresh.length>0,'Next-page token did not discover additional distinct hotels');
    const located2=fresh.filter(h=>typeof h.latitude==='number'&&typeof h.longitude==='number'&&
      Number.isFinite(h.latitude)&&Number.isFinite(h.longitude));
    mark('Second-page geolocated properties',String(located2.length));
    assert.ok(located2.length>0,'No second-page hotels can be plotted on the map');
  }

  // Safe public properties only: no opaque property tokens, booking URLs, private identifiers or API secrets.
  // These are shortlisting leads, NOT a claim of merchant checkout availability.
  const seenHotels=new Set();
  const allHotels=[...live.body.results,...secondPageItems].filter(h=>{
    const id=String(h.propertyToken||h.id||h.name);
    if(seenHotels.has(id))return false;seenHotels.add(id);return true;
  });
  const qualified=allHotels.filter(h=>Number(h.total)>0&&Number(h.rating)>=4.3&&
    Number(h.reviews)>=20&&Number(h.hotelClass)>=3&&Number(h.hotelClass)<=5);
  const choices=(qualified.length>=3?qualified:allHotels.filter(h=>Number(h.total)>0&&
    Number(h.rating)>=4.0)).sort((a,b)=>Number(a.total)-Number(b.total)).slice(0,10);
  mark('Shortlist candidate count',String(choices.length)+' (2 adults + infant, same two nights)');
  for(const [i,h] of choices.entries()){
    mark('Candidate '+(i+1),
      String(h.name||'Unknown').replace(/[\r\n]/g,' ').slice(0,100)+
      ' | 2-night Google Hotels total €'+Number(h.total).toFixed(2)+
      ' | '+(Number(h.hotelClass)||'?')+' stars'+
      ' | '+(Number(h.rating)||'?')+'/5 from '+(Number(h.reviews)||0)+' reviews'+
      ' | taxes '+String(h.taxStatus)+' | MERCHANT CHECKOUT + COT UNKNOWN');
  }

  assert.ok(live.body.results.every(x=>Number.isFinite(Date.parse(x.retrievedAt))),
    'Per-hotel timestamps are required to prevent stale map prices');
  for(const h of live.body.results){
    if(Number(h.total)>0)assert.ok(['provider_reports_after_taxes_fees','taxes_and_fees_unknown'].includes(h.taxStatus));
    else if(Number(h.totalEstimate)>0)assert.equal(h.taxStatus,'total_not_provided');
  }
  mark('Infant occupancy','PASS: 2 adults + infant age 1 represented accurately');

  // Independent property-details API call; never log property token, provider key,
  // booking links, or any personally identifying guest data.
  const hotel=live.body.results.find(x=>/^[A-Za-z0-9_-]{10,220}$/.test(String(x.propertyToken||'')));
  assert.ok(hotel,'No Google Hotels listing exposed a usable property token');
  const detailResponse=await fetch(base+'/hotel-details',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({propertyToken:hotel.propertyToken,checkInDate:'2026-12-04',checkOutDate:'2026-12-06',
      adults:2,children:0,infants:1}),signal:AbortSignal.timeout(26000)});
  const details=await detailResponse.json().catch(()=>({}));
  mark('Real family property details','HTTP '+detailResponse.status+'; '+(details.offers?.length||0)+' seller/room offers');
  assert.equal(detailResponse.status,200,'Hotel details search failed: '+String(details.code||details.error||''));
  assert.equal(details.adults,2);
  assert.equal(details.infants,1);
  assert.equal(details.nights,2);
  assert.equal(details.cribConfirmedForParty,false,'Crib availability must never be invented');
  assert.ok(Array.isArray(details.offers),'Missing normalized property room list');
  mark('Named room offers',details.offers.filter(x=>x.roomName).length+' / '+details.offers.length);
  mark('Breakfast term coverage',details.offers.filter(x=>x.breakfastIncluded!==null).length+' / '+details.offers.length);
  mark('Bed term coverage',details.offers.filter(x=>x.beds?.length>0).length+' / '+details.offers.length);
  mark('Crib policy signal',String(details.cribFeeHint||'unknown')+' (property-level only; not room confirmation)');
  mark('Safe seller links',details.offers.filter(x=>x.bookingUrl?.startsWith('https://')).length+' / '+details.offers.length);
  mark('Cancellation terms',details.offers.filter(x=>x.freeCancellation!==null).length+' / '+details.offers.length);
  mark('Named room checkout','NOT guaranteed; only a merchant link and a quoted amount are available');

  mark('Pricing integrity','PASS: provider totals and estimated totals are identified separately');
  mark('Taxes / checkout','Amounts may omit local climate resilience and other checkout charges; not guaranteed');
  mark('RESULT','PASS');
}catch(error){
  mark('RESULT','FAIL — '+String(error?.message||error).slice(0,350));
  process.exitCode=1;
}finally{
  if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    '### Hotel real provider smoke test\n\n'+results.map(x=>'- '+x).join('\n')+'\n');
}

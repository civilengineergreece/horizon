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
    if(capabilities.status===200&&capabilities.body.schemaVersion===3)break;
    if(attempt<15)await new Promise(resolve=>setTimeout(resolve,10000));
  }
  mark('Hotel API production version','HTTP '+capabilities.status+'; schema '+String(capabilities.body.schemaVersion||'not published'));
  assert.equal(capabilities.status,200,'New hotel Worker not deployed');
  assert.equal(capabilities.body.schemaVersion,3,'New hotel pricing schema not deployed');
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
  for(const h of live.body.results){
    if(Number(h.total)>0)assert.ok(['provider_reports_after_taxes_fees','taxes_and_fees_unknown'].includes(h.taxStatus));
    else if(Number(h.totalEstimate)>0)assert.equal(h.taxStatus,'total_not_provided');
  }
  mark('Infant occupancy','PASS: 2 adults + infant age 1 represented accurately');
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

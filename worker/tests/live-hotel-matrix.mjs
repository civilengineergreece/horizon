import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
if(process.env.HORIZON_ALLOW_BILLABLE!=='true'){
  console.error('Live audit blocked: explicit HORIZON_ALLOW_BILLABLE=true authorization is required.');
  process.exit(2);
}
const originHeader='https://civilengineergreece.github.io';
const base='https://horizon-live-api.gnchristou.workers.dev';
const origin='https://civilengineergreece.github.io';
const day=offset=>new Date(Date.now()+offset*86400000).toISOString().slice(0,10);
const common={destination:'Thessaloniki',checkInDate:day(14),checkOutDate:day(16),adults:2,children:0,infants:0};
const expectedErrors={two_rooms:'UNSUPPORTED_ROOM_COUNT',invalid_adults:'INVALID_OCCUPANCY',missing_child_age:'CHILD_AGES_REQUIRED'};
const report={testedAt:new Date().toISOString(),search:common,cases:[],passed:true};
for(const [name,patch] of [ ['adults',{}],['child',{children:1,childrenAges:'8'}],
  ['infant',{infants:1}],['family',{children:1,childrenAges:'8',infants:1}],
  ['two_rooms',{adults:4,rooms:2}],['invalid_adults',{adults:0}],['missing_child_age',{children:1}] ]){
  const response=await fetch(base+'/stays?'+new URLSearchParams({...common,...patch}),
    {headers:{Origin:origin},signal:AbortSignal.timeout(30000)});
  const data=await response.json();
  const result={name,status:response.status,code:data.code,adults:data.adults,children:data.children,
    infants:data.infants,providerAges:data.providerAges,count:data.results?.length,
    cors:response.headers.get('access-control-allow-origin'),retrievedAt:data.retrievedAt,
    examples:data.results?.slice(0,3).map(x=>({name:x.name,total:x.total,totalEstimate:x.totalEstimate,taxStatus:x.taxStatus}))};
  report.cases.push(result);console.log(JSON.stringify(result));
  try{
    assert.equal(result.cors,origin,'CORS must allow the published site');
    if(expectedErrors[name]){
      assert.equal(response.status,422,'Invalid or unsupported input must fail');
      assert.equal(data.code,expectedErrors[name]);
    }else{
      assert.equal(response.status,200,'Live search must succeed');
      const requested={...common,...patch};
      for(const key of ['adults','children','infants'])assert.equal(data[key],requested[key],key);
      assert.deepEqual(data.providerAges,[...(requested.children?[8]:[]),...(requested.infants?[1]:[])]);
      assert.ok(data.results?.length>0,'Expected real hotel results');
      assert.ok(data.results.some(x=>Number(x.total)>0||Number(x.totalEstimate)>0),'Expected a positive quote');
    }
    result.passed=true;
  }catch(error){
    result.passed=false;result.failure=error.message;report.passed=false;
    console.error(name+': '+error.message);
  }
}
writeFileSync(new URL('../../docs/live-hotel-matrix.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
if(!report.passed)process.exitCode=1;

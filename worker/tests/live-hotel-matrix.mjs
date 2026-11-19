import {writeFileSync} from 'node:fs';
const base='https://horizon-live-api.gnchristou.workers.dev';
const origin='https://civilengineergreece.github.io';
const common={destination:'Thessaloniki',checkInDate:'2026-12-04',checkOutDate:'2026-12-06',adults:2,children:0,infants:0};
const report={testedAt:new Date().toISOString(),cases:[]};
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
}
writeFileSync(new URL('../../docs/live-hotel-matrix.json',import.meta.url),JSON.stringify(report,null,2)+'\n');

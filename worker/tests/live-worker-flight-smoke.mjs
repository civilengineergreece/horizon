/**
 * One-off external smoke test of the deployed HORIZON Worker from a GitHub-hosted runner.
 * Does not expose provider secrets or any departure token in output.
 * The two live flight searches consume external provider quota only after verifying the new route.
 */
import assert from 'node:assert/strict';
import {appendFileSync} from 'node:fs';

const base='https://horizon-live-api.gnchristou.workers.dev';
const report=[];
function record(name,detail){const line=name+': '+detail;console.log(line);report.push(line);}
function finish(){
  if(process.env.GITHUB_STEP_SUMMARY){
    appendFileSync(process.env.GITHUB_STEP_SUMMARY,'### Horizon Worker — production flight smoke test\n\n'+
      report.map(x=>'- '+x).join('\n')+'\n');
  }
}
async function request(path,options={}){
  const response=await fetch(base+path,{...options,signal:AbortSignal.timeout(25000)});
  const data=await response.json().catch(()=>({}));
  return {status:response.status,data};
}
try{
  const health=await request('/health');
  record('Health','HTTP '+health.status);
  assert.equal(health.status,200,'Public Worker /health must respond with HTTP 200');
  assert.equal(health.data.ok,true);
  record('Flights provider configured',String(!!health.data?.providers?.googleFlights?.enabled));

  // Current Worker version exposes POST /flight-returns. GET must return 405.
  // Older deployments route GET requests to the 404 fallback.
  const route=await request('/flight-returns');
  record('Return-flight endpoint presence','GET returns HTTP '+route.status+' (expected 405)');
  assert.equal(route.status,405,'Worker appears to run an older version without /flight-returns');

  // A single live round-trip query; do not log departure_token or provider credentials.
  const fields=new URLSearchParams({
    origin:'Athens',destination:'Thessaloniki',
    outboundDate:'2026-12-04',returnDate:'2026-12-06',
    adults:'1',children:'0',infants:'0'
  });
  const departure=await request('/flights?'+fields.toString());
  record('Outbound live query','HTTP '+departure.status+'; '+(departure.data?.results?.length||0)+' options');
  assert.equal(departure.status,200,'Live outbound flights request failed: '+String(departure.data?.code||departure.data?.error||''));
  assert.equal(departure.data.fareScope,'roundtrip_outbound_only');
  const selectable=departure.data.results?.find(x=>x.departureToken&&Number(x.price)>0);
  assert.ok(selectable,'No selectable outbound departure_token/price was returned');
  record('Outbound token','Received (never printed)');

  const returned=await request('/flight-returns',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({
      origin:'Athens',destination:'Thessaloniki',
      outboundDate:'2026-12-04',returnDate:'2026-12-06',
      adults:1,children:0,infants:0,departureToken:selectable.departureToken
    })
  });
  record('Return live query','HTTP '+returned.status+'; '+(returned.data?.results?.length||0)+' options');
  assert.equal(returned.status,200,'Live return query failed: '+String(returned.data?.code||returned.data?.error||''));
  assert.equal(returned.data.fareScope,'roundtrip_return_options');
  const inbound=returned.data.results?.find(x=>Number(x.price)>0 && x.departure?.airport==='SKG' && x.arrival?.airport==='ATH');
  assert.ok(inbound,'No return SKG→ATH itinerary with a fare was confirmed');
  record('Full round-trip flow','PASS: selected outbound leads to return options and combined quote');
  record('Limitations','Offer != guaranteed checkout fare; baggage/infant charges and airport transfers remain unverified');
}catch(error){
  record('RESULT','FAIL — '+String(error?.message||error).slice(0,350));
  process.exitCode=1;
}finally{finish();}

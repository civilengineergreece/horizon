/**
 * Independent production comparison with a user-captured SKY express quote.
 * Makes ONE pinned live booking-options request; credentials never reach logs.
 * Does NOT book or pay, and never assumes today's prices equal the screenshot.
 */
import assert from 'node:assert/strict';
import {appendFileSync} from 'node:fs';
const root='https://horizon-live-api.gnchristou.workers.dev';
const log=[];
const say=(k,v)=>{const line=k+': '+v;log.push(line);console.log(line);};
const requested={origin:'Athens',destination:'Thessaloniki',outboundDate:'2026-12-04',
  returnDate:'2026-12-06',adults:2,children:0,infants:1,
  bookingToken:'',
  outboundSegments:[{flightNumber:'GQ380',departure:{airport:'ATH',time:'2026-12-04 07:30'},arrival:{airport:'SKG',time:'2026-12-04 08:25'}}],
  returnSegments:[{flightNumber:'GQ389',departure:{airport:'SKG',time:'2026-12-06 22:00'},arrival:{airport:'ATH',time:'2026-12-06 23:00'}}]
};
try{
  const health=await fetch(root+'/health',{signal:AbortSignal.timeout(15000)});
  assert.equal(health.status,200);
  say('Worker','HTTP 200');
  let schema=null;
  for(let n=0;n<16;n++){
    const r=await fetch(root+'/flight-capabilities',{signal:AbortSignal.timeout(12000)});
    schema=r.ok?await r.json().catch(()=>null):null;
    if(schema?.schemaVersion===3)break;
    if(n<15)await new Promise(resolve=>setTimeout(resolve,10000));
  }
  say('Published strict flight schema',String(schema?.schemaVersion||'NOT READY'));
  assert.equal(schema?.schemaVersion,3,'Worker deployment missing flight-price audit guards');
  const res=await fetch(root+'/flight-booking-options',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify(requested),signal:AbortSignal.timeout(30000)
  });
  const data=await res.json().catch(()=>({}));
  say('Exact GQ380/GQ389 booking lookup','HTTP '+res.status+', '+(data.results?.length||0)+' seller options');
  assert.equal(res.status,200,'Cannot verify exact flight seller quote: '+String(data.code||data.error||''));
  assert.equal(data.lookupMethod,'selected_flights_json');
  assert.equal(data.adults,2);
  assert.equal(data.infants,1);
  const availableFlights=(data.selectedItinerary||[]).flatMap(g=>(g.segments||[]).map(x=>
    String(x.flightNumber||'').replace(/\s+/g,'').toUpperCase()));
  say('Provider-confirmed selected flight numbers',availableFlights.join(',')||'NOT SUPPLIED');
  const expected=['GQ380','GQ389'];
  const exactMatch=expected.every(x=>availableFlights.includes(x));
  say('Exact flight identity',exactMatch?'CONFIRMED':'NOT CONFIRMED');
  const sellers=(data.results||[]).filter(x=>Number(x.price)>0&&x.currency==='EUR');
  say('Seller price range',sellers.length?
    '€'+Math.min(...sellers.map(x=>x.price)).toFixed(2)+'–€'+Math.max(...sellers.map(x=>x.price)).toFixed(2):
    'NO OFFERS');
  say('Historical SKY express selection screenshot','€305.38 for this exact party/itinerary on 2026-11-19; NOT a guaranteed current price');
  say('Infant fee itemization',data.infantBreakdownConfirmed===true?'Provided':'NOT provided by SerpApi');
  say('Baggage policy availability',sellers.filter(x=>
    ['together','departing','returning'].some(k=>x.baggage?.[k]?.length)).length+' of '+sellers.length+' seller options');
  assert.ok(sellers.length>0,'No live seller quotes for the exact two flights');
  assert.ok(exactMatch,'SerpApi did not provide independent confirmation of these precise flight numbers; audit stays OPEN');
  say('RESULT','PASS — one live seller option and exact flight identity match, but NOT checkout confirmation');
}catch(e){
  say('RESULT','INCONCLUSIVE / FAIL — '+String(e?.message||e).slice(0,280));
  process.exitCode=1;
}finally{
  if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    '### SKY express flight identity and fare audit\n\n'+log.map(x=>'- '+x).join('\n')+'\n');
}

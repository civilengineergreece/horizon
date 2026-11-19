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
  let schema=null;
  for(let n=0;n<16;n++){
    const r=await request('/flight-capabilities');
    if(r.status===200&&r.data.schemaVersion===3){schema=r.data;break;}
    if(n<15)await new Promise(resolve=>setTimeout(resolve,10000));
  }
  record('Flight production schema',String(schema?.schemaVersion||'NOT READY'));
  assert.equal(schema?.schemaVersion,3,'Cloudflare is not running the strict flight price audit version');

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
  if(process.env.GITHUB_EVENT_NAME==='push'){
    let bookingRoute;
    for(let attempt=0;attempt<8;attempt++){
      bookingRoute=await request('/flight-booking-options');
      if(bookingRoute.status===405)break;
      if(attempt<7)await new Promise(resolve=>setTimeout(resolve,12000));
    }
    record('Booking options endpoint','GET returns HTTP '+bookingRoute.status+' (expected 405)');
    assert.equal(bookingRoute.status,405,'Cloudflare deployment did not expose /flight-booking-options');

    const bookable=returned.data.results?.find(x=>x.bookingToken&&Number(x.price)>0)||inbound;
    assert.ok(bookable,'No selected return itinerary');
    if(!bookable.bookingToken)record('Booking lookup method','Pinned exact outbound + return flight numbers (booking_token unavailable)');
    const details=await request('/flight-booking-options',{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({
        origin:'Athens',destination:'Thessaloniki',outboundDate:'2026-12-04',
        returnDate:'2026-12-06',adults:1,children:0,infants:0,
        bookingToken:bookable.bookingToken||'',
        outboundSegments:selectable.segments||[],returnSegments:bookable.segments||[]
      })
    });
    record('Real seller booking options','HTTP '+details.status+'; '+(details.data?.results?.length||0)+' seller quotes');
    assert.equal(details.status,200,'Booking options provider returned: '+String(details.data?.code||details.data?.error||''));
    assert.equal(details.data.fareScope,'roundtrip_seller_options');
    assert.ok(details.data.results?.length>0,'No seller booking prices available in this live search');
    assert.ok(details.data.results.every(x=>Number(x.price)>0&&x.currency==='EUR'),'Invalid seller price values');
    record('Baggage policies','Available for '+details.data.results.filter(x=>
      (x.baggage?.together?.length||0)+(x.baggage?.departing?.length||0)+(x.baggage?.returning?.length||0)>0).length+' options');
    record('Infant fare breakdown','Not asserted, because live test has zero infants; revalidate infant charges separately');
    // Independent family request: verify the actual provider receives two adults
    // and an infant-on-lap (NOT a guarantee that checkout itemizes infant fees).
    const familyFields=new URLSearchParams({
      origin:'Athens',destination:'Thessaloniki',outboundDate:'2026-12-04',
      returnDate:'2026-12-06',adults:'2',children:'0',infants:'1'
    });
    const familyOutbound=await request('/flights?'+familyFields);
    record('Family outbound search (2 adults + 1 infant)','HTTP '+familyOutbound.status+'; '+(familyOutbound.data?.results?.length||0)+' options');
    assert.equal(familyOutbound.status,200,'Provider failed on the actual family composition');
    assert.equal(familyOutbound.data.adults,2);
    assert.equal(familyOutbound.data.infants,1);
    const familyChoice=familyOutbound.data.results?.find(x=>x.departureToken&&Number(x.price)>0);
    assert.ok(familyChoice,'No live family outbound with departure_token');

    const familyReturn=await request('/flight-returns',{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({
        origin:'Athens',destination:'Thessaloniki',outboundDate:'2026-12-04',
        returnDate:'2026-12-06',adults:2,children:0,infants:1,
        departureToken:familyChoice.departureToken
      })
    });
    record('Family return search (2 adults + 1 infant)','HTTP '+familyReturn.status+'; '+(familyReturn.data?.results?.length||0)+' options');
    assert.equal(familyReturn.status,200);
    assert.equal(familyReturn.data.infants,1);
    const familyInbound=familyReturn.data.results?.find(x=>Number(x.price)>0 && x.departure?.airport==='SKG'&&x.arrival?.airport==='ATH');
    assert.ok(familyInbound,'No matching family return fare');

    const familySellers=await request('/flight-booking-options',{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({
        origin:'Athens',destination:'Thessaloniki',outboundDate:'2026-12-04',
        returnDate:'2026-12-06',adults:2,children:0,infants:1,
        bookingToken:familyInbound.bookingToken||'',
        outboundSegments:familyChoice.segments||[],returnSegments:familyInbound.segments||[]
      })
    });
    record('Family seller offers (2 adults + 1 infant)','HTTP '+familySellers.status+'; '+(familySellers.data?.results?.length||0)+' seller quotes');
    assert.equal(familySellers.status,200);
    assert.equal(familySellers.data.adults,2);
    assert.equal(familySellers.data.infants,1);
    assert.ok(familySellers.data.results?.some(x=>Number(x.price)>0),'Seller returned no family price');
    assert.equal(familySellers.data.infantBreakdownConfirmed,false,'No infant breakdown should be invented');
    record('Family infant charge status','Family quote obtainable; infant-only fee and final checkout remain unverified');

  }

  record('Limitations','Offer != guaranteed checkout fare; baggage/infant charges and airport transfers remain unverified');
}catch(error){
  record('RESULT','FAIL — '+String(error?.message||error).slice(0,350));
  process.exitCode=1;
}finally{finish();}

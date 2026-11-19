import assert from 'node:assert/strict';
import {appendFileSync} from 'node:fs';
const base='https://horizon-live-api.gnchristou.workers.dev';
const msgs=[],push=(label,value)=>{const l=label+': '+value;console.log(l);msgs.push(l)};
const expected={origin:'Athens',destination:'Thessaloniki',outboundDate:'2026-12-04',returnDate:'2026-12-06',adults:2,children:0,infants:1};
async function call(path,opts={}){
  const r=await fetch(base+path,{...opts,signal:AbortSignal.timeout(30000)});
  return {status:r.status,data:await r.json().catch(()=>({}))};
}
function numbers(item){return (item?.segments||[]).map(x=>String(x.flightNumber||'').replace(/\s+/g,'').toUpperCase());}
try{
  const caps=await call('/flight-capabilities');
  assert.equal(caps.data.schemaVersion,3,'Strict flight Worker version not deployed');
  push('Strict Worker version','3');

  const params=new URLSearchParams(expected);
  const outbound=await call('/flights?'+params);
  push('Actual family outbound results','HTTP '+outbound.status+' / '+(outbound.data?.results?.length||0)+' returned (top 15)');
  assert.equal(outbound.status,200);
  assert.equal(outbound.data.adults,2);
  assert.equal(outbound.data.infants,1);
  assert.equal(outbound.data.fareScope,'roundtrip_outbound_only');
  assert.equal(outbound.data.cache.ttlSeconds,0,'Airfare API should not cache for 6 hours');
  push('Outbound options numbers',outbound.data.results.map(x=>numbers(x).join('+')||'?').join(',').slice(0,380)||'none');
  const exactOutbound=outbound.data.results.find(x=>
    numbers(x).length===1&&numbers(x)[0]==='GQ380'&&
    x.departure?.airport==='ATH'&&x.arrival?.airport==='SKG');
  if(!exactOutbound){
    push('GQ380','NOT present in first 15 priced outbound results (NOT proof of unavailability)');
    push('RESULT','UNVERIFIED: exact requested itinerary not independently found');
    process.exitCode=1;
  }else{
    push('GQ380','FOUND — ATH→SKG '+String(exactOutbound.departure?.time)+' price '+String(exactOutbound.price));
    assert.ok(exactOutbound.departureToken,'No valid token to retrieve return flights');
    const returned=await call('/flight-returns',{method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({...expected,departureToken:exactOutbound.departureToken})});
    push('Returns after selecting GQ380','HTTP '+returned.status+' / '+(returned.data?.results?.length||0)+' results');
    assert.equal(returned.status,200);
    const exactReturn=returned.data.results.find(x=>
      numbers(x).length===1&&numbers(x)[0]==='GQ389'&&
      x.departure?.airport==='SKG'&&x.arrival?.airport==='ATH');
    push('Return flight numbers',returned.data.results.map(x=>numbers(x).join('+')||'?').join(',').slice(0,350)||'none');
    if(!exactReturn){
      push('GQ389','NOT present among results for chosen GQ380 (NOT proof of unavailability)');
      push('RESULT','UNVERIFIED: the exact selected return was not returned');
      process.exitCode=1;
    }else{
      push('GQ389','FOUND — SKG→ATH '+String(exactReturn.departure?.time));
      const total=Number(exactReturn.price);
      assert.ok(Number.isFinite(total)&&total>0);
      push('Google Flights combined search quote for family','€'+total.toFixed(2)+' (2 adults + 1 infant requested; itemization unverified)');
      push('Comparison to official SKY express selection on 2026-11-19','€'+(total-305.38).toFixed(2)+' difference; not required to be equal');
      const booking=await call('/flight-booking-options',{method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({...expected,bookingToken:exactReturn.bookingToken||'',
          outboundSegments:exactOutbound.segments,returnSegments:exactReturn.segments})});
      push('Exact selected legs seller quote','HTTP '+booking.status+'; '+(booking.data?.results?.length||0)+' quotes');
      if(booking.status===200){
        push('Provider-selected itinerary identity',booking.data.itineraryMatch||'not provided');
        push('Seller prices',booking.data.results.map(x=>'€'+Number(x.price).toFixed(2)).slice(0,5).join(',')||'none');
      }
      assert.equal(booking.status,200,'Booking options unavailable for exact selected trip');
      assert.ok(booking.data.results?.length>0);
      assert.equal(booking.data.itineraryMatch,'confirmed','Provider did not independently corroborate exact GQ380/GQ389');
      push('RESULT','PASS: exact outbound/return and seller quote evidenced; checkout still unverified');
    }
  }
}catch(e){
  push('RESULT','UNVERIFIED / FAIL — '+String(e?.message||e).slice(0,320));
  process.exitCode=1;
}finally{
  if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    '### Independent GQ380/GQ389 family itinerary trace\n\n'+msgs.map(x=>'- '+x).join('\n')+'\n');
}

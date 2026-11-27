/**
 * Non-billable production release readiness: no searches, no passenger data,
 * no SerpApi quota usage, no secrets logged.
 */
import assert from 'node:assert/strict';

const base='https://horizon-live-api.gnchristou.workers.dev';
async function get(path) {
  const response=await fetch(base+path,{
    headers:{Accept:'application/json',Origin:'https://civilengineergreece.github.io'},
    signal:AbortSignal.timeout(20000)
  });
  assert.equal(response.status,200,path+' HTTP status');
  const data=await response.json();
  assert.equal(data.ok,true,path+' ok');
  assert.equal(response.headers.get('access-control-allow-origin'),
    'https://civilengineergreece.github.io',path+' CORS');
  return data;
}
try {
  const health=await get('/health');
  assert.equal(health.providers?.googleHotels?.enabled,true,'Google Hotels must be configured');
  assert.equal(health.providers?.googleFlights?.enabled,true,'Google Flights must be configured');
  const hotels=await get('/hotel-capabilities');
  assert.ok(hotels.schemaVersion>=5,'Hotel Worker schema >= 5 required');
  assert.equal(hotels.validatesTravelerCounts,true);
  assert.equal(hotels.requiresAgesForOtherChildren,true);
  assert.equal(hotels.multiRoomSearch,false,'Multi-room prices must not be invented');
  const flights=await get('/flight-capabilities');
  assert.ok(flights.schemaVersion>=4,'Production Worker must have seller handoff API schema >= 4');
  assert.equal(flights.quoteCacheNoStore,true);
  assert.equal(flights.validatesTravelerCounts,true);
  assert.equal(flights.providerBookingHandoff,true,'Published Worker must support supplier-provided seller handoff');
  assert.equal(flights.signedGooglePostSupported,true,'Published Worker must support signed Google Flights POST');
  assert.equal(flights.sellerCheckoutVerified,false,'Do not misrepresent real checkout or transaction verification');
  const emailGet=await fetch(base+'/email-pdf',{
    headers:{Accept:'application/json',Origin:'https://civilengineergreece.github.io'},
    signal:AbortSignal.timeout(20000)});
  assert.equal(emailGet.status,405,'GET email relay must not send anything');
  assert.equal(emailGet.headers.get('cache-control'),'no-store');
  const emailInvalid=await fetch(base+'/email-pdf',{
    method:'POST',headers:{Origin:'https://civilengineergreece.github.io',
      'content-type':'application/json'},body:'{}',signal:AbortSignal.timeout(20000)});
  assert.ok([400,503].includes(emailInvalid.status),'Invalid/disabled email relay must deny');
  const emailInvalidBody=await emailInvalid.json();
  assert.equal(emailInvalidBody.ok,false);
  assert.ok(['EMAIL_DISABLED','INVALID_EMAIL','EMAIL_PROVIDER_NOT_CONFIGURED'].includes(emailInvalidBody.code),
    'No real email must be sent during readiness check');
  console.log('PASS: public email relay rejects invalid/disabled requests without any mail or billing');
  // On PR builds production still runs the previously deployed Worker. On main
  // production must prove the NEW search guard binding is live, not merely
  // green syntax tests in an un-deployed branch. Poll briefly for Cloudflare
  // Workers Builds to finish without making any billable supplier request.
  const requireSearchGuard=process.env.HORIZON_REQUIRE_SEARCH_PROTECTION==='true';
  let protectedAPI=null,lastStatus=null;
  for(let n=0;n<(requireSearchGuard?22:1);n++){
    const response=await fetch(base+'/search-protection-capabilities',{
      headers:{Accept:'application/json',Origin:'https://civilengineergreece.github.io'},
      signal:AbortSignal.timeout(20000)});
    lastStatus=response.status;
    if(response.ok){
      const data=await response.json();
      if(data?.ok===true&&data.guarded===true&&data.rateLimitConfigured===true&&
         data.perIpLimit===12&&data.periodSeconds===60&&
         ['/flights','/flight-returns','/flight-booking-options','/stays','/hotel-details']
          .every(path=>data.endpoints?.includes(path))){
        protectedAPI=data;break;
      }
    }
    if(!requireSearchGuard)break;
    await new Promise(resolve=>setTimeout(resolve,4000));
  }
  if(requireSearchGuard){
    assert.ok(protectedAPI,'Deployed Worker MUST have Cloudflare paid-search rate-limit binding (last status '+lastStatus+')');
    console.log('PASS: PRODUCTION search guard is live and bound: 12/min/IP on all five SerpApi endpoints, 0 billable calls');
  }else if(protectedAPI){
    console.log('PASS: existing production Search rate-limit protection is present (candidate run)');
  }else{
    console.log('INFO: pre-audit production Worker is awaiting approved patch deployment; no billable search attempted');
  }
  console.log('PASS: production Worker up; Google Flights & Hotels configured; '+
    'capabilities and CORS verified, without any paid provider lookup');
}catch(err) {
  console.error('FAIL: non-billable production health gate:',err.message);
  process.exitCode=1;
}

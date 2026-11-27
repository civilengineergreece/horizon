/**
 * Browser integration smoke test against the DEPLOYED GitHub Pages frontend.
 * Responses from external flight endpoints are mocked. Real Worker/provider
 * connectivity is checked separately by live-worker-flight-smoke.mjs.
 */
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';

const site=process.env.HORIZON_TEST_URL||'http://127.0.0.1:8765/';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1280,height:960}});
const reports=[];
function log(step,msg){reports.push(step+': '+msg);console.log(step+': '+msg);}
const flight=(departure,arrival,price,token=null)=>({
  price,currency:'EUR',durationMinutes:55,stops:0,airlines:[departure==='ATH'?'AEGEAN':'SKY express'],
  departure:{airport:departure,name:departure,time:'2026-12-04 07:30'},
  arrival:{airport:arrival,name:arrival,time:'2026-12-04 08:25'},
  segments:[{airline:departure==='ATH'?'AEGEAN':'SKY express',flightNumber:departure==='ATH'?'GQ 100':'GQ 101',durationMinutes:55,
    departure:{airport:departure,time:'2026-12-04 07:30'},
    arrival:{airport:arrival,time:'2026-12-04 08:25'}}],
  departureToken:token
});
let outboundHits=0,returnHits=0;
try{
  await page.route(/\/flights\?/,async route=>{
    outboundHits++;
    const q=new URL(route.request().url()).searchParams;
    if(q.get('outboundDate')==='2026-12-20')await new Promise(resolve=>setTimeout(resolve,800));
    await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},
      body:JSON.stringify({ok:true,fareScope:'roundtrip_outbound_only',retrievedAt:new Date().toISOString(),currency:'EUR',results:[flight('ATH','SKG',281,'test-token')]})});
  });
  await page.route(/\/flight-returns$/,async route=>{
    returnHits++;
    assert.equal(route.request().method(),'POST');
    const payload=route.request().postDataJSON();
    assert.equal(payload.departureToken,'test-token');
    await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},
      body:JSON.stringify({ok:true,fareScope:'roundtrip_return_options',retrievedAt:new Date().toISOString(),currency:'EUR',results:[flight('SKG','ATH',337)]})});
  });
  await page.route(/\/flight-booking-options$/,async route=>{
    assert.equal(route.request().method(),'POST');
    const data=route.request().postDataJSON();
    assert.equal(data.bookingToken,'');
    assert.equal(data.outboundSegments[0].flightNumber,'GQ 100');
    assert.equal(data.returnSegments[0].flightNumber,'GQ 101');
    await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},
      body:JSON.stringify({ok:true,provider:'Google Flights via SerpApi',retrievedAt:new Date().toISOString(),
        results:[{seller:'Test Seller',price:355,currency:'EUR',separateTickets:false,
          baggage:{together:['1 cabin bag included','1st checked bag: €30'],departing:[],returning:[]}}]})});
  });
  await page.goto(site,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>
    Array.isArray(window.HORIZON_DESTINATIONS) &&
    window.HORIZON_DESTINATIONS.some(x=>x.name==='Θεσσαλονίκη') &&
    !!document.querySelector('script[data-horizon-flights-panel]') &&
    typeof window.renderResults==='function',
    {timeout:20000});
  await page.waitForTimeout(1200);
  await page.evaluate(()=>{
    state={origin:'Αθήνα',dates:{from:'2026-12-04',flex:0},duration:3,
      budget:{amount:1500,transport:'all'},travelers:{adults:1,children:0,infants:1},
      style:'city',stay:'hotel',transport:'plane',interests:['history'],special:''};
    const dest=window.HORIZON_DESTINATIONS.find(x=>x.name==='Θεσσαλονίκη');
    scored=[scoreDest(dest)];
    document.getElementById('questionCard').classList.add('hidden');
    document.getElementById('resultsCard').classList.remove('hidden');
    document.querySelector('.progress-card')?.classList.add('hidden');
    window.renderResults('match','all');
  });
  const card=page.locator('.destination').filter({hasText:'Θεσσαλονίκη'});
  await card.waitFor({timeout:12000});
  await card.locator('.actions a').filter({hasText:'μεταφορ'}).first().click();
  await page.locator('.hz-flights-panel').waitFor({timeout:15000});
  log('Frontend','Transport overlay and flight form loaded');
  const baggage=page.locator('[data-flight-baggage]');
  assert.equal(await baggage.isVisible(),true,'Luggage extras must not be hidden by prefill');
  const ground=page.locator('[data-flight-ground]');
  assert.equal(await ground.isVisible(),true,'Airport transfer input must be visible');
  await page.locator('.hz-flight-search').click();
  await page.locator('[data-flight-step="outbound"]').waitFor({timeout:15000});
  assert.equal(outboundHits,1);
  assert.equal(await page.locator('.hz-flight-results').innerText().then(x=>x.includes('δεν έχει επιλεγεί επιστροφή')),true);
  log('Outbound','Initial fare correctly labelled as incomplete');
  await page.locator('[data-flight-step="outbound"]').click();
  await page.locator('[data-flight-step="return"]').waitFor({timeout:15000});
  assert.equal(returnHits,1);
  const before=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('hz-flight-selection-v2:')));
  assert.equal(before.length,0,'Outbound-only selection must not update budget');
  await page.locator('[data-flight-step="return"]').click();
  const record=await page.evaluate(()=>{
    const k=Object.keys(localStorage).find(k=>k.startsWith('hz-flight-selection-v2:'));
    return k?JSON.parse(localStorage.getItem(k)):null;
  });
  assert.ok(record,'Complete flight choice should be stored');
  assert.equal(record.scope,'roundtrip');
  const infantPolicy=await page.locator('[data-infant-policy]').innerText();
  assert.ok(infantPolicy.includes('AEGEAN')&&infantPolicy.includes('SKY express'));
  assert.ok(infantPolicy.includes('10%')&&infantPolicy.includes('90%'));
  assert.equal(record.infantFareVerified,false,'Non-itemized infant surcharge must remain unverified');
  log('Infant fare rules','Official AEGEAN/SKY express policies shown without invented infant charge');
  assert.equal(record.fare,337);
  assert.equal(await ground.inputValue(),'15','Automatic bus fare benchmark for one adult ATH-SKG return');
  assert.equal(await page.locator('[data-flight-ground-mins]').inputValue(),'120','120 minutes for both airport bus rides per one-way trip');
  assert.equal(record.groundCostOrigin,'public_bus_fare_benchmark');
  assert.equal(record.groundEstimate?.airportBufferTotalMinutes,240);
  log('Airport ground benchmark','€15 roundtrip for one adult + 120 min airport buses per direction; 2h departure buffer');
  const summary=await page.locator('.hz-flight-cost').innerText();
  assert.ok(summary.includes('Αναχώρηση'));
  assert.ok(summary.includes('Επιστροφή'));
  assert.ok(summary.includes('€337'));
  log('Round trip','Both legs displayed and only combined €337 fare included');

  await page.locator('.hz-flight-booking').click();
  await page.locator('[data-seller-index="0"]').waitFor({timeout:15000});
  const sellerContents=await page.locator('.hz-flight-seller-results').innerText();
  assert.ok(sellerContents.includes('Test Seller'));
  assert.ok(sellerContents.includes('1 cabin bag included'));
  await page.locator('[data-seller-index="0"]').click();
  const sellerRecord=await page.evaluate(()=>{
    const k=Object.keys(localStorage).find(k=>k.startsWith('hz-flight-selection-v2:'));
    return k?JSON.parse(localStorage.getItem(k)):null;
  });
  assert.equal(sellerRecord.fare,355);
  assert.equal(sellerRecord.bookingSeller,'Test Seller');
  assert.equal(sellerRecord.infantFareVerified,false);
  log('Seller booking quote','Baggage rules and €355 seller price selected; infant fee not asserted free');

  await baggage.fill('40');await ground.fill('30');
  const after=await page.evaluate(()=>{
    const k=Object.keys(localStorage).find(k=>k.startsWith('hz-flight-selection-v2:'));
    return k?JSON.parse(localStorage.getItem(k)):null;
  });
  assert.equal(after.extras,70);
  assert.equal(after.estimatedTotal,425);
  assert.equal(after.at,sellerRecord.at,'Changing manual baggage/ground amounts must NOT reset source quote freshness');
  log('Manual fees','Separated €70 of baggage/transfers from €355 seller fare');

  const audit=page.locator('.hz-flight-checkout-review');
  await audit.locator('[name="total"]').waitFor({timeout:15000});
  assert.ok((await audit.innerText()).includes('μόνο χειροκίνητα'));
  await audit.locator('[name="total"]').fill('440,50');
  await audit.locator('[name="source"]').selectOption('search_result');
  await audit.locator('.hz-flight-checkout-save').click();
  assert.ok((await audit.locator('.hz-flight-checkout-status').innerText()).includes('Δεν ενημερώθηκε το budget'));
  let beforeAudit=await page.evaluate(()=>{
    const key=Object.keys(localStorage).find(x=>x.startsWith('hz-flight-selection-v2:'));
    return JSON.parse(localStorage.getItem(key));
  });
  assert.equal(beforeAudit.fare,355,'Search price must never become verified checkout');
  await audit.locator('[name="source"]').selectOption('seller_final_payment_screen');
  for(const name of ['datesAndFlights','passengers','infants','infantPolicy','baggageAndSeats',
    'mandatoryCharges','cancellation','availability'])
    await audit.locator('[name="'+name+'"]').check();
  await audit.locator('.hz-flight-checkout-save').click();
  const manuallyAudited=await page.evaluate(()=>{
    const key=Object.keys(localStorage).find(x=>x.startsWith('hz-flight-selection-v2:'));
    return JSON.parse(localStorage.getItem(key));
  });
  assert.equal(manuallyAudited.fare,440.50);
  assert.equal(manuallyAudited.baggage,0,'Seller total includes requested baggage; never double count old €40');
  assert.equal(manuallyAudited.extras,30,'Ground is separately estimated, not part of airline checkout');
  assert.equal(manuallyAudited.estimatedTotal,470.50);
  assert.equal(manuallyAudited.sourceFareBeforeCheckout,355);
  assert.equal(manuallyAudited.sourceBaggageExtraBeforeCheckout,40);
  assert.equal(manuallyAudited.bookingStatus,'checkout_user_reported_not_booked');
  assert.equal(manuallyAudited.reviewEvidence,'manual_flight_seller_checkout');
  assert.equal(manuallyAudited.infantFareVerified,false,'Manual checklist is not independent infant-fare verification');
  assert.ok((await audit.innerText()).includes('όχι κράτηση'));
  log('Airline seller final-screen audit','Manually checked €440.50 all-in airline + €30 ground, no double baggage, never marked booked');
  await baggage.fill('41');
  const afterBaggageEdit=await page.evaluate(()=>{
    const key=Object.keys(localStorage).find(x=>x.startsWith('hz-flight-selection-v2:'));
    return JSON.parse(localStorage.getItem(key));
  });
  assert.equal(afterBaggageEdit.bookingStatus,'quote_only_not_checked_out',
    'Editing extras must invalidate manual checkout instead of silently adjusting final price');
  assert.equal(afterBaggageEdit.fare,355);

  const change=page.locator('.hz-flight-change');
  await change.click();
  assert.equal(await page.locator('[data-flight-step="outbound"]').count(),1);
  const stale=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('hz-flight-selection-v2:')));
  assert.equal(stale.length,0);
  log('Reset','Changing outbound clears prior selected fare');

  // Choose a fresh complete itinerary, then change the flight dates.
  // The Planner duration, total budget inputs and old selection must follow.
  await page.locator('[data-flight-step="outbound"]').click();
  await page.locator('[data-flight-step="return"]').waitFor({timeout:15000});
  await page.locator('[data-flight-step="return"]').click();
  const beforeDateChange=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('hz-flight-selection-v2:')));
  assert.equal(beforeDateChange.length,1);
  await page.locator('.hz-flights-panel .hz-auto-trip-edit').click();
  await page.locator('.hz-flight-from').fill('2026-12-10');
  await page.locator('.hz-flight-to').fill('2026-12-15');
  const dateState=await page.evaluate(()=>({from:state.dates.from,duration:state.duration}));
  assert.equal(dateState.from,'2026-12-10');
  assert.equal(dateState.duration,6);
  assert.equal(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('hz-flight-selection-v2:')).length),0);
  assert.ok((await page.locator('#resultsCard').innerText()).includes('6 ημέρες'),'New duration should appear in rendered results');
  log('Date/budget sync','Flight dates 10–15 Dec synchronized to six-day Planner duration; old fare invalidated');

  // A one-way trip has no return date; the old Planner implementation silently
  // required round-trip fares and omitted genuine one-way prices from the budget.
  await page.locator('.hz-flight-to').fill('');
  await page.locator('.hz-flight-search').click();
  await page.locator('[data-flight-step="outbound"]').waitFor({timeout:15000});
  await page.locator('[data-flight-step="outbound"]').click();
  const oneWay=await page.evaluate(()=>{
    const key=Object.keys(localStorage).find(k=>k.startsWith('hz-flight-selection-v2:'));
    return {record:key?JSON.parse(localStorage.getItem(key)):null,oneWay:state.dates.oneWay};
  });
  assert.equal(oneWay.oneWay,true);
  assert.equal(oneWay.record.scope,'oneway');
  assert.equal(oneWay.record.baggage,0,'Past baggage estimate must not carry to a different itinerary');
  assert.equal(oneWay.record.ground,7.5,'One-way bus transfer should replace old roundtrip manual value');
  await page.waitForTimeout(100);
  const planeTotal=await page.locator('.destination').filter({hasText:'Θεσσαλονίκη'})
    .locator('.break').filter({hasText:'Επιλεγμένη αεροπορική μεταφορά'}).innerText();
  assert.ok(planeTotal.includes('288,50'),'One-way €281 fare + €7.50 bus transfers should be reflected in budget');

  // Starting a new search with the same dates must immediately remove the
  // previous quote from the budget, even when the next result is browser-cached.
  await page.locator('.hz-flight-search').click();
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>
    Object.keys(localStorage).filter(k=>k.startsWith('hz-flight-selection-v2:')).length),0);
  const clearTotal=await page.locator('.destination').filter({hasText:'Θεσσαλονίκη'})
    .locator('.break').filter({hasText:'Μεταφορά'}).innerText();
  assert.ok(clearTotal.includes('Live τιμή'),'New flight search must clear prior selected budget quote');
  log('One-way and fare reset','One-way quote included; new search immediately removes old fare from budget');

  // Delayed upstream response from an abandoned search must not overwrite a
  // new trip or leave the search button disabled.
  await page.locator('.hz-flight-from').fill('2026-12-20');
  await page.locator('.hz-flight-to').fill('2026-12-22');
  await page.locator('.hz-flight-search').click();
  await page.locator('.hz-flight-from').fill('2026-12-21');
  await page.waitForTimeout(1000);
  assert.equal(await page.locator('.hz-flight-card').count(),0,'Old in-flight response must be discarded');
  assert.equal(await page.locator('.hz-flight-search').isEnabled(),true,'User can start a new search after cancelling old trip');
  log('Async safety','Delayed response discarded after date change; search button stays enabled');




  console.log('RESULT: PASS — browser interactions against served PR branch with mocked provider responses');
}catch(e){
  console.error('RESULT: FAIL',e?.stack||String(e));
  mkdirSync('artifacts',{recursive:true});
  await page.screenshot({path:'artifacts/horizon-flight-ui-failure.png',fullPage:true}).catch(()=>{});
  process.exitCode=1;
}finally{await browser.close();}

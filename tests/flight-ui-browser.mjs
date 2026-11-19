/**
 * Browser integration smoke test against the DEPLOYED GitHub Pages frontend.
 * Responses from external flight endpoints are mocked. Real Worker/provider
 * connectivity is checked separately by live-worker-flight-smoke.mjs.
 */
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';

const site=process.env.HORIZON_TEST_URL||'http://127.0.0.1:8765/';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1280,height:960}});
const reports=[];
function log(step,msg){reports.push(step+': '+msg);console.log(step+': '+msg);}
const flight=(departure,arrival,price,token=null)=>({
  price,currency:'EUR',durationMinutes:55,stops:0,airlines:['Test airline'],
  departure:{airport:departure,name:departure,time:'2026-12-04 07:30'},
  arrival:{airport:arrival,name:arrival,time:'2026-12-04 08:25'},
  segments:[{airline:'Test airline',durationMinutes:55,
    departure:{airport:departure,time:'2026-12-04 07:30'},
    arrival:{airport:arrival,time:'2026-12-04 08:25'}}],
  departureToken:token
});
let outboundHits=0,returnHits=0;
try{
  await page.route(/\/flights\?/,async route=>{
    outboundHits++;
    await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},
      body:JSON.stringify({ok:true,fareScope:'roundtrip_outbound_only',retrievedAt:'2026-11-19T08:50:00Z',currency:'EUR',results:[flight('ATH','SKG',281,'test-token')]})});
  });
  await page.route(/\/flight-returns$/,async route=>{
    returnHits++;
    assert.equal(route.request().method(),'POST');
    const payload=route.request().postDataJSON();
    assert.equal(payload.departureToken,'test-token');
    await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},
      body:JSON.stringify({ok:true,fareScope:'roundtrip_return_options',retrievedAt:'2026-11-19T08:50:00Z',currency:'EUR',results:[flight('SKG','ATH',337)]})});
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
      budget:{amount:1500,transport:'all'},travelers:{adults:1,children:0,infants:0},
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
  assert.equal(record.fare,337);
  const summary=await page.locator('.hz-flight-cost').innerText();
  assert.ok(summary.includes('Αναχώρηση'));
  assert.ok(summary.includes('Επιστροφή'));
  assert.ok(summary.includes('€337'));
  log('Round trip','Both legs displayed and only combined €337 fare included');

  await baggage.fill('40');await ground.fill('30');
  const after=await page.evaluate(()=>{
    const k=Object.keys(localStorage).find(k=>k.startsWith('hz-flight-selection-v2:'));
    return k?JSON.parse(localStorage.getItem(k)):null;
  });
  assert.equal(after.extras,70);
  assert.equal(after.estimatedTotal,407);
  log('Manual fees','Separated €70 of baggage/transfers from €337 fare');

  const change=page.locator('.hz-flight-change');
  await change.click();
  assert.equal(await page.locator('[data-flight-step="outbound"]').count(),1);
  const stale=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('hz-flight-selection-v2:')));
  assert.equal(stale.length,0);
  log('Reset','Changing outbound clears prior selected fare');

  console.log('RESULT: PASS — actual GitHub Pages UI interactions with mocked provider responses');
}catch(e){
  console.error('RESULT: FAIL',e?.stack||String(e));
  mkdirSync('artifacts',{recursive:true});
  await page.screenshot({path:'artifacts/horizon-flight-ui-failure.png',fullPage:true}).catch(()=>{});
  process.exitCode=1;
}finally{await browser.close();}

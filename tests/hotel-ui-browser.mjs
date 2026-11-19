import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';

const site=process.env.HORIZON_TEST_URL||'http://127.0.0.1:8765/';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1280,height:960}});
let searches=0;
try{
  await page.route(/\/stays(\?|$)/,async route=>{
    const u=new URL(route.request().url());
    searches++;
    assert.equal(route.request().method(),'GET','Client bridge should cache equivalent hotel search as GET');
    assert.equal(u.searchParams.get('destination'),'Θεσσαλονίκη');
    assert.equal(u.searchParams.get('adults'),'2');
    assert.equal(u.searchParams.get('children'),'0');
    assert.equal(u.searchParams.get('infants'),'1');
    await route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},
      body:JSON.stringify({ok:true,provider:'Google Hotels via SerpApi',nights:2,adults:2,children:0,infants:1,currency:'EUR',
        results:[
          {id:'taxed',name:'Test Hotel Taxes Included',hotelClass:4,rating:4.8,nightly:120,total:250,taxStatus:'provider_reports_after_taxes_fees',totalPriceBasis:'provider_reported',currency:'EUR',amenities:['WiFi']},
          {id:'unpriced',name:'Test Hotel Nightly Only',hotelClass:3,rating:4.2,nightly:70,total:null,totalEstimate:140,taxStatus:'total_not_provided',totalPriceBasis:'estimated_nightly_times_nights',currency:'EUR',amenities:['WiFi']}
        ],retrievedAt:'2026-11-19T09:20:00Z',cache:{hit:false}})});
  });
  await page.goto(site,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>Array.isArray(window.HORIZON_DESTINATIONS)&&
    window.HORIZON_DESTINATIONS.some(x=>x.name==='Θεσσαλονίκη')&&
    !!document.querySelector('script[data-horizon-hotels-panel]')&&
    typeof window.renderResults==='function', {timeout:20000});
  await page.waitForTimeout(900);
  await page.evaluate(()=>{
    state={origin:'Αθήνα',dates:{from:'2026-12-04',flex:0},duration:3,
      budget:{amount:1500,transport:'all'},travelers:{adults:2,children:0,infants:1},
      style:'city',stay:'hotel',transport:'plane',interests:['history'],special:''};
    const dest=window.HORIZON_DESTINATIONS.find(x=>x.name==='Θεσσαλονίκη');
    scored=[scoreDest(dest)];
    document.getElementById('questionCard').classList.add('hidden');
    document.getElementById('resultsCard').classList.remove('hidden');
    document.querySelector('.progress-card')?.classList.add('hidden');
    window.renderResults('match','all');
  });
  const card=page.locator('.destination').filter({hasText:'Θεσσαλονίκη'});
  await card.waitFor({timeout:15000});
  await card.locator('.actions a').filter({hasText:'διαμον'}).first().click();
  await page.locator('.hz-hotels-panel .hz-stay-load').waitFor({timeout:15000});
  assert.ok((await page.locator('.hz-hotels-panel').innerText()).includes('βρέφ'));
  await page.locator('.hz-stay-load').click();
  await page.locator('.hz-stay-card').first().waitFor({timeout:15000});
  assert.equal(searches,1);
  const cards=await page.locator('.hz-stay-card').allInnerTexts();
  assert.equal(cards.length,2);
  const real=cards.find(x=>x.includes('Test Hotel Taxes Included'));
  const estimate=cards.find(x=>x.includes('Test Hotel Nightly Only'));
  assert.ok(real?.includes('250'), 'Google Hotels reported whole-trip total must be displayed');
  assert.ok(real?.includes('Η πηγή περιλαμβάνει φόρους/τέλη'), 'Clearly label reported tax basis');
  assert.ok(estimate?.includes('Εκτίμηση'), 'Nightly-only must not be shown as verified total');
  assert.ok(estimate?.includes('140'), 'Nightly-only indicative multiplication is visible as estimate');
  assert.ok(estimate?.includes('φόροι/τέλη άγνωστοι'), 'Taxes disclaimer shown');

  const choiceCard=page.locator('.hz-stay-card').filter({hasText:'Test Hotel Taxes Included'});
  const rejected=page.locator('.hz-stay-card').filter({hasText:'Test Hotel Nightly Only'});
  assert.equal(await rejected.locator('.hz-hotel-select').count(),0,'Estimated nightly stays cannot be chosen as a live quote');
  await choiceCard.locator('.hz-hotel-select').click();
  const selection=await page.evaluate(()=>{
    const key=Object.keys(localStorage).find(k=>k.startsWith('hz-hotel-selection-v1:'));
    return key?JSON.parse(localStorage.getItem(key)):null;
  });
  assert.equal(selection.total,250);
  assert.equal(selection.nights,2);
  assert.equal(selection.infants,1);
  assert.equal(selection.bookingStatus,'quote_only_not_checked_out');

  const stayBreak=card.locator('.break').filter({hasText:'Επιλεγμένη διαμονή'});
  await stayBreak.waitFor({timeout:5000});
  assert.ok((await stayBreak.innerText()).includes('250'),'Selected hotel quote should replace original estimated accommodation');
  const expected=await page.evaluate(()=>{
    const r=scored.find(x=>x.name==='Θεσσαλονίκη');
    return Math.round(r.total-r.transport-r.accommodation+250+305.38+30);
  });
  await page.evaluate(()=>{
    const key='hz-flight-selection-v2:hz-flights-v2:'+
      ['Αθήνα','Θεσσαλονίκη','2026-12-04','2026-12-06',2,0,1].join('|');
    localStorage.setItem(key,JSON.stringify({at:Date.now(),fare:305.38,extras:30,scope:'roundtrip'}));
    document.dispatchEvent(new CustomEvent('horizon:live-flight-price',{detail:{destination:'Θεσσαλονίκη',selected:true}}));
  });
  await page.waitForTimeout(100);
  assert.ok((await card.locator('.cost').innerText()).includes(expected.toLocaleString('el-GR')),
    'Hotel quote plus flight and airport ground fees should replace two estimates without double counting');
  console.log('Hotel budget: PASS — selected €250 quote plus €305.38 flight and €30 ground, old hotel/air estimates removed');

  await page.evaluate(()=>{
    state.dates.from='2026-12-10';
    scored=[scoreDest(window.HORIZON_DESTINATIONS.find(x=>x.name==='Θεσσαλονίκη'))];
    window.renderResults('match','all');
  });
  await page.waitForTimeout(100);
  const refreshed=page.locator('.destination').filter({hasText:'Θεσσαλονίκη'});
  assert.equal(await refreshed.locator('.break').filter({hasText:'Επιλεγμένη διαμονή'}).count(),0,
    'Hotel quote from old dates must not count after changing trip dates');
  console.log('Hotel quote date safety: PASS');

  console.log('RESULT: PASS — hotel occupancy, tax truth, selected quote budget integration and stale-date safety in Chrome');
}catch(e){
  console.error('RESULT: FAIL',e?.stack||String(e));process.exitCode=1;
  mkdirSync('artifacts',{recursive:true});
  await page.screenshot({path:'artifacts/horizon-hotel-ui-failure.png',fullPage:true}).catch(()=>{});
}finally{await browser.close();}

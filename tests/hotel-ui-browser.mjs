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
  console.log('RESULT: PASS — hotel occupancy, price provenance, tax labels and estimate transparency in Chrome');
}catch(e){
  console.error('RESULT: FAIL',e?.stack||String(e));process.exitCode=1;
  mkdirSync('artifacts',{recursive:true});
  await page.screenshot({path:'artifacts/horizon-hotel-ui-failure.png',fullPage:true}).catch(()=>{});
}finally{await browser.close();}

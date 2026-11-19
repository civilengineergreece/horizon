import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';

const url=process.env.HORIZON_TEST_URL||'http://127.0.0.1:8765/';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1300,height:980}});
try{
  // The Leaflet runtime and SRI-checked CDN are REAL. Only the Google Hotels
  // response and map-image tile requests are intercepted to avoid quota,
  // uncontrolled third-party map downloads and flaky external hotel prices.
  await page.route('https://tile.openstreetmap.org/**',async route=>
    route.fulfill({status:204,body:''}));
  await page.route(/\/stays(\?|$)/,async route=>{
    await route.fulfill({status:200,contentType:'application/json',
      headers:{'access-control-allow-origin':'*'},
      body:JSON.stringify({
        ok:true,nights:2,currency:'EUR',retrievedAt:new Date().toISOString(),
        pagination:{hasMore:false,nextPageToken:null},
        results:[{id:'actual-leaflet-fixture',name:'Real Leaflet Hotel Test',
          type:'hotel',latitude:40.635,longitude:22.95,
          rating:4.8,reviews:212,hotelClass:4,
          nightly:128,total:256,taxStatus:'provider_reports_after_taxes_fees',
          currency:'EUR',amenities:['WiFi']}]
      })});
  });
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>Array.isArray(window.HORIZON_DESTINATIONS)&&
    window.HORIZON_DESTINATIONS.some(x=>x.name==='Θεσσαλονίκη')&&
    !!document.querySelector('script[data-horizon-hotels-map]')&&
    typeof window.renderResults==='function',null,{timeout:25000});
  await page.evaluate(()=>{
    state={origin:'Αθήνα',dates:{from:'2026-12-04',flex:0},duration:3,
      budget:{amount:1500,transport:'all'},travelers:{adults:2,children:0,infants:1},
      style:'city',stay:'hotel',transport:'plane',interests:['history'],special:''};
    scored=[scoreDest(window.HORIZON_DESTINATIONS.find(x=>x.name==='Θεσσαλονίκη'))];
    document.getElementById('questionCard').classList.add('hidden');
    document.getElementById('resultsCard').classList.remove('hidden');
    document.querySelector('.progress-card')?.classList.add('hidden');
    window.renderResults('match','all');
  });
  await page.locator('.destination').filter({hasText:'Θεσσαλονίκη'})
    .locator('.actions a').filter({hasText:'διαμον'}).first().click();
  await page.locator('.hz-stay-load').click();
  await page.locator('.hz-hotel-map-shell').waitFor({timeout:15000});
  await page.locator('.hz-price-marker').first().waitFor({timeout:20000});
  assert.ok(await page.evaluate(()=>!!window.L?.map),'Real Leaflet loaded through pinned CDN');
  assert.equal(await page.locator('.leaflet-container').count(),1);
  assert.ok((await page.locator('.hz-price-marker').first().innerText()).includes('€256'));
  assert.ok((await page.locator('.hz-hotel-map-copy').innerText()).includes('1 από 1'));
  const attr=await page.locator('.leaflet-control-attribution').innerText();
  assert.ok(attr.includes('OpenStreetMap'),'OSM attribution must remain visible');
  await page.locator('.hz-price-marker').first().click();
  await page.locator('.leaflet-popup-content').waitFor({timeout:5000});
  const popup=await page.locator('.leaflet-popup-content').innerText();
  assert.ok(popup.includes('Real Leaflet Hotel Test'));
  assert.ok(popup.includes('4.8/5'));
  assert.ok(popup.includes('4★'));
  assert.ok(popup.includes('256,00'));
  await page.locator('[data-hotel-map-focus]').click();
  await page.locator('.hz-stay-card.hz-map-focused').first().waitFor({timeout:5000});
  console.log('RESULT: PASS — REAL Leaflet CDN rendering, OSM attribution, clickable price marker and list focus');
}catch(e){
  console.error('RESULT: FAIL',e?.stack||String(e));process.exitCode=1;
  mkdirSync('artifacts',{recursive:true});
  await page.screenshot({path:'artifacts/horizon-real-leaflet-failure.png',fullPage:true}).catch(()=>{});
}finally{await browser.close();}

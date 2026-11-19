import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';

const site=process.env.HORIZON_TEST_URL||'http://127.0.0.1:8765/';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1300,height:980}});
let requests=0;
try{
  // Stub only the map renderer. Hotel panel, pagination, filters and pricing
  // execute as real browser Javascript with normal DOM and network bridge.
  await page.addInitScript(()=>{
    window.__mapAudit={visible:[],loaded:0,fits:0};
    window.L={
      map:()=>({invalidateSize(){},fitBounds(){window.__mapAudit.fits++;},
        setView(){window.__mapAudit.fits++;},removeLayer(layer){
          if(layer?.markers)window.__mapAudit.visible=[];
        },remove(){}}),
      tileLayer:()=>({addTo(){return this;}}),
      latLngBounds:points=>points,
      divIcon:opts=>opts,
      marker:(point,opts)=>({point,opts,popup:null,bindPopup(html){this.popup=html;return this;}}),
      layerGroup:()=>({markers:[],addLayer(marker){this.markers.push(marker);},
        addTo(){window.__mapAudit.visible=this.markers;window.__mapAudit.loaded++;return this;}})
    };
  });
  await page.route(/\/stays(\?|$)/,async route=>{
    const u=new URL(route.request().url()),pageToken=u.searchParams.get('nextPageToken');
    requests++;
    assert.equal(route.request().method(),'GET','Hotel fetch bridge retains GET pagination');
    assert.equal(u.searchParams.get('destination'),'Θεσσαλονίκη');
    assert.equal(u.searchParams.get('checkInDate'),'2026-12-04');
    assert.equal(u.searchParams.get('checkOutDate'),'2026-12-06');
    assert.equal(u.searchParams.get('adults'),'2');
    assert.equal(u.searchParams.get('infants'),'1');
    const common={ok:true,nights:2,currency:'EUR',retrievedAt:new Date().toISOString(),cache:{hit:false}};
    const initial=[
      {id:'on-map',name:'Test 4 Star Map Hotel',type:'hotel',rating:4.8,reviews:343,hotelClass:4,
        latitude:40.634,longitude:22.946,total:256,nightly:128,
        taxStatus:'provider_reports_after_taxes_fees',currency:'EUR',amenities:['WiFi']},
      {id:'no-gps',name:'Hotel Without GPS',type:'hotel',rating:4.6,hotelClass:3,
        latitude:null,longitude:null,total:null,totalEstimate:145,nightly:72.5,
        taxStatus:'total_not_provided',currency:'EUR',amenities:['WiFi']}
    ];
    const second=[
      {id:'next-page',name:'Page Two Hotel',type:'hotel',rating:4.1,hotelClass:5,
        latitude:40.64,longitude:22.95,total:333,nightly:166.5,
        taxStatus:'taxes_and_fees_unknown',currency:'EUR',amenities:['WiFi']},
      initial[0]
    ];
    assert.ok(pageToken===null||pageToken==='CBI=');
    await route.fulfill({status:200,contentType:'application/json',
      headers:{'access-control-allow-origin':'*'},
      body:JSON.stringify({...common,results:pageToken?second:initial,
        pagination:pageToken?{hasMore:false,nextPageToken:null}:{hasMore:true,nextPageToken:'CBI='}})});
  });
  await page.goto(site,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>Array.isArray(window.HORIZON_DESTINATIONS)&&
    window.HORIZON_DESTINATIONS.some(x=>x.name==='Θεσσαλονίκη')&&
    !!document.querySelector('script[data-horizon-hotels-map]')&&
    typeof window.renderResults==='function',null,{timeout:25000});
  await page.waitForTimeout(700);
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
  await card.locator('.actions a').filter({hasText:'διαμον'}).first().click();
  await page.locator('.hz-stay-load').click();
  await page.locator('.hz-stay-card').first().waitFor({timeout:15000});
  await page.waitForFunction(()=>window.__mapAudit.visible.length===1,null,{timeout:10000});
  assert.equal(requests,1);
  assert.equal(await page.locator('.hz-stay-card').count(),2);
  assert.ok((await page.locator('.hz-hotel-map-copy').innerText()).includes('1 από 2'));
  assert.ok((await page.locator('.hz-hotel-map-copy').innerText()).includes('1 χωρίς συντεταγμένες'));
  const first=await page.evaluate(()=>window.__mapAudit.visible.map(m=>({
    label:m.opts.icon.html,popup:m.popup,lat:m.point[0]
  })));
  assert.ok(first[0].label.includes('€256'));
  assert.ok(first[0].popup.includes('4.8/5'));
  assert.ok(first[0].popup.includes('4★'));
  assert.ok(first[0].popup.includes('256,00'));
  assert.equal(first[0].lat,40.634);
  console.log('Map: PASS — source-reported 2-night total price pin, stars, rating, missing GPS count');

  await page.locator('.hz-rating').selectOption('4.5');
  await page.locator('.hz-hotel-next-page').click();
  await page.waitForFunction(()=>document.querySelectorAll('.hz-stay-card').length===2&&
    document.querySelector('.hz-stay-summary')?.textContent.includes('3 αποτελέσματα'),null,{timeout:15000});
  assert.equal(requests,2);
  assert.equal(await page.locator('.hz-rating').inputValue(),'4.5','Filter survives pagination');
  assert.ok((await page.locator('.hz-hotel-map-copy').innerText()).includes('1 από 2'));
  const merged=await page.evaluate(()=>{
    const p=document.querySelector('.hz-hotels-panel');
    return {length:p._hotelData.results.length,more:p._hotelData.pagination.hasMore};
  });
  assert.deepEqual(merged,{length:3,more:false},'Duplicate hotel from later page must be removed');
  await page.locator('.hz-rating').selectOption('0');
  await page.waitForFunction(()=>window.__mapAudit.visible.length===2,null,{timeout:10000});
  const p2=await page.evaluate(()=>window.__mapAudit.visible.map(m=>m.popup));
  assert.ok(p2.some(x=>x.includes('Page Two Hotel')&&x.includes('5★')&&x.includes('333,00')));
  assert.equal(await page.locator('.hz-hotel-next-page').isVisible(),false);
  console.log('Pagination: PASS — all loaded properties mapped, duplicate deduplication, filters synced');

  await page.locator('.hz-hotel-map-toggle').click();
  assert.equal(await page.locator('.hz-hotel-map').isVisible(),false);
  await page.locator('.hz-hotel-map-toggle').click();
  assert.equal(await page.locator('.hz-hotel-map').isVisible(),true);
  assert.ok((await page.locator('.hz-hotel-map-legend').innerText()).includes('διαμονή'));
  console.log('Map toggle: PASS — responsive control retains all loaded markers');
  console.log('RESULT: PASS — interactive hotel map, rating/class/full-stay prices and paginated filtered coverage');
}catch(e){
  console.error('RESULT: FAIL',e?.stack||String(e));process.exitCode=1;
  mkdirSync('artifacts',{recursive:true});
  await page.screenshot({path:'artifacts/horizon-hotel-map-failure.png',fullPage:true}).catch(()=>{});
}finally{await browser.close();}

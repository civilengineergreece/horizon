/**
 * Stage 6 degraded-mode check: all HORIZON API calls fail from the browser.
 * The UI must not invent flights, stays, a checkout or a confirmed booking;
 * the local editable itinerary and direct PDF must remain usable.
 *
 * Not a full offline/PWA guarantee: external map tiles and PDF assets may
 * require connectivity. The test only simulates the travel provider outage.
 */
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
const url=process.env.HORIZON_TEST_URL||'http://127.0.0.1:8765/';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
try{
 for(const width of [1280,390]){
  const page=await browser.newPage({viewport:{width,height:width===390?844:920}});
  const denied=[];
  await page.route('https://horizon-live-api.gnchristou.workers.dev/**',route=>{
    denied.push(new URL(route.request().url()).pathname);
    return route.abort('failed');
  });
  try{
   await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
   await page.waitForFunction(()=>typeof window.HORIZON_PLANNER_V2_PDF?.makePdf==='function'&&
     window.__HZ_MM_SCORE_PATCH__===true&&typeof window.renderResults==='function',
     null,{timeout:30000});
   await page.waitForTimeout(500);
   await page.evaluate(()=>{
     localStorage.clear();
     state={origin:'Αθήνα',dates:{from:'2026-12-04',flex:0},duration:3,
       budget:{amount:1500,transport:'all'},
       travelers:{adults:2,children:0,infants:1},
       style:'city',stay:'hotel',transport:'plane',
       interests:['family','history'],special:''};
     scored=[scoreDest(window.HORIZON_DESTINATIONS.find(d=>d.name==='Θεσσαλονίκη'))];
     document.getElementById('questionCard').classList.add('hidden');
     document.getElementById('resultsCard').classList.remove('hidden');
     window.renderResults('match','all');
   });
   const card=page.locator('.destination').filter({hasText:'Θεσσαλονίκη'}).first();
   await card.locator('.actions a').filter({hasText:'μεταφορ'}).first().click();
   await page.locator('.hz-flights-panel .hz-flight-search').waitFor({timeout:15000});
   await page.locator('.hz-flight-search').click();
   await page.waitForFunction(()=>/Αποτυχία|Δεν είναι διαθέσιμο/.test(
     document.querySelector('.hz-flight-status')?.textContent||''),null,{timeout:15000});
   assert.equal(await page.locator('.hz-flight-card').count(),0,
     'Provider outage must not create fabricated airline offers');
   assert.equal(await page.locator('.hz-flight-handoff-btn').count(),0,
     'Provider outage must not provide a fictional booking handoff');
   console.log('PASS provider outage '+width+'px: flight request fails without invented offer');

   await page.locator('.hd-close').click();
   await page.locator('.horizon-detail-overlay').waitFor({state:'detached',timeout:15000});
   await page.locator('.destination').filter({hasText:'Θεσσαλονίκη'}).first()
     .locator('.actions a').filter({hasText:'διαμον'}).first().click();
   await page.locator('.hz-hotels-panel .hz-stay-load').waitFor({timeout:15000});
   await page.locator('.hz-stay-load').click();
   await page.waitForFunction(()=>document.querySelector('.hz-stay-status')?.classList.contains('error')===true,
     null,{timeout:15000});
   assert.equal(await page.locator('.hz-stay-card').count(),0,
     'Hotel API outage must not generate a fabricated bookable stay');
   console.log('PASS provider outage '+width+'px: stay request fails without fake room');

   await page.locator('.hd-tab[data-tab="things"]').click();
   await page.locator('.hz-itinerary-editor .hz-edit-day').first().waitFor({timeout:15000});
   const local=await page.evaluate(async()=>{
     const ed=document.querySelector('.hz-itinerary-editor');
     const api=window.HORIZON_PLANNER_V2_PDF;
     const bytes=await api.makePdf(api.collect(ed));
     const doc=await window.PDFLib.PDFDocument.load(bytes);
     return {bytes:bytes.length,pages:doc.getPageCount(),
       mapUrl:api.collect(ed).mapUrl};
   });
   assert.ok(local.bytes>10000&&local.pages===4,
     'Local itinerary must still export real editable PDF under provider outage');
   assert.match(local.mapUrl,/\/map\.html\?d=/);
   assert.ok(denied.includes('/flights')&&denied.includes('/stays'),
     'Test must actually exercise both failed live provider paths');
   assert.equal(await page.locator('[data-email-consent]').isChecked(),false,
     'No email consent should be inferred during provider outage');
   console.log('PASS provider outage '+width+'px: itinerary + PDF remain usable without API');
  }catch(err){
   mkdirSync('artifacts',{recursive:true});
   await page.screenshot({path:'artifacts/stage6-provider-outage-'+width+'.png',fullPage:true}).catch(()=>{});
   throw err;
  }finally{await page.close();}
 }
 console.log('PASS Stage 6 degraded mode on desktop/mobile, zero external bookings');
}catch(err){
 console.error('STAGE 6 PROVIDER-OUTAGE GATE FAILED:',err?.stack||String(err));
 process.exitCode=1;
}finally{await browser.close();}

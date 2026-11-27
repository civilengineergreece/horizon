/**
 * Stage 3 — browser acceptance for Greek surface transport price provenance.
 * Provider responses are mocked: no Ferryhopper/Transitous quota/booking call.
 */
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
const url=process.env.HORIZON_TEST_URL||'http://127.0.0.1:8765/';
const api='https://horizon-live-api.gnchristou.workers.dev';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
async function open(page,name){
 const card=page.locator('#resultsCard .destination').filter({hasText:name});
 await card.waitFor({timeout:15000});
 await card.locator('.actions a').filter({hasText:/μεταφορ|σύγκρι/i}).first().click();
 await page.locator('.hd-tab[data-tab="transport"]').click().catch(()=>{});
 await page.locator('.hz-surface-live').waitFor({state:'attached',timeout:16000});
 await page.waitForTimeout(350);
 if(!(await page.locator('.hz-surface-live').isVisible())){
  const info=await page.evaluate(()=>{
   const name=document.querySelector('.horizon-detail-overlay .hd-head h3')?.textContent?.trim();
   const d=(window.HORIZON_DESTINATIONS||[]).find(x=>x.name===name);
   const p=document.querySelector('.hz-surface-live');
   return {name,selectedTransport:state.transport,destination:{region:d?.region,type:d?.type,transport:d?.transport},
    buttons:[...(p?.querySelectorAll('[data-surface]')||[])].map(b=>({mode:b.dataset.surface,hidden:b.classList.contains('hz-live-hidden')})),
    boxClasses:p?.className,html:p?.outerHTML.slice(0,950)};
  });
  throw Error('Transport panel hidden: '+JSON.stringify(info));
 }
}
async function close(page){
 await page.locator('.hd-close').click();
 await page.locator('.horizon-detail-overlay').waitFor({state:'detached',timeout:15000});
}
async function search(page,name,transport){
 await page.evaluate(({name,transport})=>{
  state={origin:'Αθήνα',dates:{from:'2026-12-04',flex:0},duration:3,
   budget:{amount:5000,transport:'all'},travelers:{adults:2,children:1,infants:1},
   style:'mixed',stay:'hotel',transport,interests:['history','family'],special:''};
  scored=[scoreDest(window.HORIZON_DESTINATIONS.find(d=>d.name===name))];
  document.getElementById('questionCard').classList.add('hidden');
  document.getElementById('resultsCard').classList.remove('hidden');
  document.querySelector('.progress-card')?.classList.add('hidden');
  window.renderResults('match','all');
  document.getElementById('resultsCard').classList.remove('hidden');
 },{name,transport});
}
try{
 for(const width of [1280,390]){
  const page=await browser.newPage({viewport:{width,height:width===390?844:920}});
  try{
   const counts={ferries:0,trains:0,ground:0};
   await page.route(api+'/**',async route=>{
    const u=new URL(route.request().url());
    if(u.pathname==='/ferries'){
     counts.ferries++;
     const name=u.searchParams.get('destination');
     return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      ok:true,provider:'Ferryhopper MCP',requestedOrigin:'Αθήνα',
      ferryPort:'Piraeus',destination:name,date:u.searchParams.get('date'),
      returnDate:u.searchParams.get('returnDate'),
      priceBasis:'per_option_starting_fare',
      pricingScope:{passengerMixApplied:false,vehicleIncluded:false,cabinIncluded:false,finalCheckoutVerified:false},
      retrievedAt:'2026-11-27T09:00:00Z',
      outbound:[
       {operator:'Operator <img src=x onerror=alert(1)>',vessel:'Blue Example',
        departure:'2026-12-04T07:30:00+02:00',arrival:'2026-12-04T10:50:00+02:00',
        durationMinutes:200,price:46,currency:'EUR',bookingUrl:'javascript:alert(1)'},
       {operator:'Legitimate ferry',departure:'2026-12-04T10:00:00+02:00',
        arrival:'2026-12-04T13:00:00+02:00',price:55,currency:'EUR',
        bookingUrl:'https://www.ferryhopper.com/'}],
      inbound:[{operator:'Return ferry',departure:'2026-12-06T16:30:00+02:00',
        arrival:'2026-12-06T20:20:00+02:00',price:48,currency:'EUR'}]
     })});
    }
    if(u.pathname==='/trains'){
     counts.trains++;
     return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
      ok:true,provider:'Transitous/MOTIS',origin:'Αθήνα',destination:'Θεσσαλονίκη',
      date:'2026-12-04',returnDate:'2026-12-06',
      pricingScope:{passengerMixApplied:false,finalCheckoutVerified:false},
      outbound:[{route:'IC 100',agency:'Hellenic Train',
       departure:'2026-12-04T07:00:00+02:00',arrival:'2026-12-04T11:00:00+02:00',
       durationMinutes:240,transfers:0,realtime:false,cancelled:false,
       fare:{amount:40,currency:'EUR',name:'Adult standard'}}],
      fares:{roundTrip:{amount:80,currency:'EUR'}},attribution:'https://transitous.org/sources/'
     })});
    }
    if(u.pathname==='/ground'){counts.ground++;return route.fulfill({status:503,body:'{}'});}
    return route.continue();
   });
   await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
   await page.waitForFunction(()=>Array.isArray(window.HORIZON_DESTINATIONS)&&
    window.HORIZON_DESTINATIONS.length>100&&window.__HZ_MM_SCORE_PATCH__===true&&
    window.__HORIZON_RESULTS_TRUTH__===true&&
    window.__HORIZON_FLIGHT_TIMES_CORE__===true&&
    typeof window.renderResults==='function',null,{timeout:30000});
   await page.waitForTimeout(750);
   await page.evaluate(()=>{localStorage.clear();window.__ferryBudgetEvents=0;
    document.addEventListener('horizon:live-ferry-price',()=>window.__ferryBudgetEvents++);});

   await search(page,'Σύρος','ferry');
   await open(page,'Σύρος');
   const ferryRow=page.locator('.hz-tr-table tbody tr').filter({hasText:'Πλοίο'}).first();
   const before=await ferryRow.locator('td').nth(2).innerText();
   await page.locator('.hz-surface-live [data-surface="ferry"]').click();
   await page.locator('.hz-surface-results .hz-surface-card').first().waitFor({timeout:15000});
   await page.waitForTimeout(150);
   assert.equal(await page.locator('.hz-surface-results .hz-surface-card').count(),3);
   const after=await ferryRow.locator('td').nth(2).innerText();
   assert.equal(after,before,'Starting fare must not replace the family comparison total');
   assert.equal(await page.evaluate(()=>window.__ferryBudgetEvents),0,'Never publish per-option fare as group total');
   assert.equal(counts.ferries,1);
   const disclaimer=await page.locator('[data-ferry-disclaimer]').innerText();
   assert.ok(disclaimer.includes('2 ενήλικες')&&disclaimer.includes('1 παιδιά')&&disclaimer.includes('1 βρέφη'));
   assert.ok(disclaimer.includes('όχημα')&&disclaimer.includes('καμπίνα'));
   const allText=await page.locator('.hz-surface-results').innerText();
   assert.ok(allText.includes('από / επιλογή')&&allText.includes('Επιστροφή'));
   assert.equal(await page.locator('.hz-surface-results .hz-surface-card img').count(),0,'Untrusted supplier HTML inserted');
   assert.equal(await page.locator('.hz-surface-results a[href^="javascript:"]').count(),0,'Unsafe booking URL');
   assert.equal(await page.locator('.hz-surface-results a[href^="https:"]').count(),1);
   console.log('PASS '+width+'px ferry: return/outbound source quotes, unsafe supplier HTML/URL rejected, no false family total');

   await close(page);
   await search(page,'Θεσσαλονίκη','train');
   await open(page,'Θεσσαλονίκη');
   const trainRow=page.locator('.hz-tr-table tbody tr').filter({hasText:'Τρένο'}).first();
   const trainBefore=await trainRow.locator('td').nth(2).locator('b').first().innerText();
   await page.locator('.hz-surface-live [data-surface="train"]').click();
   await page.locator('.hz-surface-results .hz-surface-card').first().waitFor({timeout:15000});
   const trainAfter=await trainRow.locator('td').nth(2).locator('b').first().innerText();
   assert.equal(trainAfter,trainBefore,'Individual rail fare must not override group estimate');
   assert.ok((await trainRow.locator('td').nth(2).innerText()).includes('Ατομικός ναύλος feed'));
   assert.ok((await page.locator('.hz-surface-results').innerText()).includes('όχι οικογένεια'));
   assert.equal(counts.trains,1);
   console.log('PASS '+width+'px train: feed rider fare distinguished from group budget');

   await close(page);
   await search(page,'Ναύπλιο','bus');
   await open(page,'Ναύπλιο');
   const bus=page.locator('.hz-surface-live [data-surface="bus"]');
   await bus.waitFor();
   assert.ok((await bus.innerText()).includes('χωρίς live'));
   await bus.click();
   assert.ok((await page.locator('.hz-surface-results').innerText()).includes('Δεν έχει συνδεθεί πάροχος'));
   assert.equal(counts.ground,0,'KTEL status must not call phantom provider or claim availability');
   console.log('PASS '+width+'px KTEL: no live provider invented or bookings performed');
   const road=await page.evaluate(()=>{
     const previousOrigin=state.origin,previousTransport=state.transport;
     state.origin='Θεσσαλονίκη';state.transport='car';
     try{
       const d=window.HORIZON_DESTINATIONS.find(x=>x.name==='Ναύπλιο');
       const r=scoreDest(d);
       return {mode:r.transportMode,roadKm:r.transportDetails?.roadKm,
         fuelCost:r.transportDetails?.fuelCost,tolls:r.transportDetails?.tolls,
         label:r.transportDetails?.label,note:r.transportDetails?.note};
     }finally{state.origin=previousOrigin;state.transport=previousTransport;}
   });
   assert.equal(road.mode,'car');
   assert.equal(road.roadKm,null,'Athens road distance must not apply from Thessaloniki');
   assert.equal(road.fuelCost,null);
   assert.equal(road.tolls,null);
   assert.ok(road.note.includes('ΟΧΙ καύσιμα'));
   console.log('PASS '+width+'px car: Athens-only road assumptions not applied from another origin');

  }catch(e){
   mkdirSync('artifacts',{recursive:true});
   await page.screenshot({path:'artifacts/horizon-transport-truth-'+width+'.png',fullPage:true}).catch(()=>{});
   throw e;
  }finally{await page.close();}
 }
 console.log('RESULT: PASS — stage 3 ferry/train/KTEL price provenance in Chrome desktop/mobile');
}catch(e){console.error('RESULT: FAIL — transport truth',e?.stack||String(e));process.exitCode=1;}
finally{await browser.close();}

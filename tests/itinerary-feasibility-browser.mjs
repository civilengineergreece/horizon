/**
 * Stage 2: browser verification of source-matched transport timing, family
 * buffers, boundary conflicts, explicit unknowns and PDF carry-through.
 * No external travel search, seller checkout or booking.
 */
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
const url=process.env.HORIZON_TEST_URL||'http://127.0.0.1:8765/';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
async function open(page){
  const card=page.locator('.destination').filter({hasText:'Θεσσαλονίκη'});
  await card.waitFor({timeout:15000});
  await card.locator('.actions a').filter({hasText:'διαμον'}).first().click();
  await page.locator('.hd-tab[data-tab="things"]').click();
  await page.locator('.hz-itinerary-editor .hz-itinerary-feasibility').waitFor({timeout:15000});
}
try{
 for(const width of [1280,390]){
  const page=await browser.newPage({viewport:{width,height:width===390?844:920}});
  try{
   await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
   await page.waitForFunction(()=>Array.isArray(window.HORIZON_DESTINATIONS)&&
     typeof window.HORIZON_FEASIBILITY?.flightFor==='function'&&
     typeof window.HORIZON_PLANNER_V2_PDF?.makePdf==='function'&&
     window.__HZ_MM_SCORE_PATCH__===true,null,{timeout:30000});
   await page.waitForTimeout(500);
   await page.evaluate(()=>{
    localStorage.clear();
    state={origin:'Αθήνα',dates:{from:'2026-12-04',flex:0},duration:3,
      budget:{amount:1500,transport:'all'},travelers:{adults:2,children:0,infants:1},
      style:'city',stay:'hotel',transport:'plane',interests:['history','family'],special:''};
    scored=[scoreDest(window.HORIZON_DESTINATIONS.find(d=>d.name==='Θεσσαλονίκη'))];
    document.getElementById('questionCard').classList.add('hidden');
    document.getElementById('resultsCard').classList.remove('hidden');
    document.querySelector('.progress-card')?.classList.add('hidden');
    window.renderResults('match','all');
   });
   await open(page);
   assert.equal(await page.locator('.hz-edit-day').count(),3);
   assert.equal(await page.locator('.hz-edit-day').first().locator('.hz-slot-time').first().inputValue(),'',
     'Arrival day must not invent a 09:30 attraction start');
   assert.equal(await page.locator('.hz-edit-day').last().locator('.hz-slot-time').last().inputValue(),'',
     'Departure day must not invent a fixed 16:00 transfer');
   assert.equal(await page.locator('.hz-itinerary-feasibility').getAttribute('data-status'),'unverified');
   assert.ok((await page.locator('[data-hz-feas-items]').innerText()).includes('Άγνωστη ώρα άφιξης'));
   console.log('PASS '+width+'px: unsourced arrival/departure and POI feasibility explicitly unknown');

   const matching=await page.evaluate(()=>{
     const c=window.HORIZON_FEASIBILITY.context(document.querySelector('.hz-itinerary-editor'));
     const key='hz-flight-selection-v2:hz-flights-v2:'+
       [c.origin,c.destination,c.from,c.to,c.adults,c.children,c.infants].join('|');
     const record={at:Date.now(),origin:c.origin,destination:c.destination,
       from:c.from,to:c.to,travelers:{adults:c.adults,children:c.children,infants:c.infants},
       scope:'roundtrip',outbound:{arrival:{time:'2026-12-04 18:20'}},
       returnFlight:{departure:{time:'2026-12-06 15:10'}}};
     localStorage.setItem(key,JSON.stringify(record));
     window.HORIZON_FEASIBILITY.augment();
     return window.HORIZON_FEASIBILITY.flightFor(c);
   });
   assert.equal(matching.arrivalAt,'2026-12-04T18:20');
   assert.equal(matching.departureAt,'2026-12-06T15:10');
   assert.ok((await page.locator('[data-hz-feas-source]').innerText()).includes('Google Flights'));
   console.log('PASS '+width+'px: exact flight selection supplies both timing boundaries, not booking status');

   const first=page.locator('.hz-edit-day').first().locator('.hz-slot-time').first();
   const last=page.locator('.hz-edit-day').last().locator('.hz-slot-time').last();
   await first.fill('09:30');
   await last.fill('16:00');
   await page.waitForFunction(()=>document.querySelector('.hz-itinerary-feasibility')?.dataset.status==='conflict',{timeout:10000});
   const conflicts=await page.evaluate(()=>window.HORIZON_FEASIBILITY.recalc(document.querySelector('.hz-itinerary-editor')).conflicts);
   assert.ok(conflicts.some(x=>x.includes('πριν από την άφιξη')));
   assert.ok(conflicts.some(x=>x.includes('πολύ κοντά στην αναχώρηση')));
   assert.ok(await page.locator('.hz-edit-row[data-hz-feas-conflict="1"]').count()>=2);
   console.log('PASS '+width+'px: 09:30 activities before 18:20 arrival and 16:00 after 15:10 departure flagged');

   await first.fill('20:10');
   await last.fill('10:00');
   const after=await page.evaluate(()=>window.HORIZON_FEASIBILITY.recalc(document.querySelector('.hz-itinerary-editor')));
   assert.equal(after.conflicts.length,0,'Adjusted plan must remove resolved timing conflicts');
   assert.equal(after.status,'unverified','No conflict never means fully verified POI feasibility');
   assert.equal(after.family,30,'Infant requires an additional 30-minute planning allowance');

   await page.locator('[name="arrivalAt"][data-hz-feasibility-field]').fill('2026-12-04T06:00');
   await page.locator('[name="departureAt"][data-hz-feasibility-field]').fill('2026-12-06T22:00');
   await page.locator('[name="checkIn"][data-hz-feasibility-field]').fill('15:00');
   await page.locator('[name="checkOut"][data-hz-feasibility-field]').fill('11:00');
   const manual=await page.evaluate(()=>window.HORIZON_FEASIBILITY.recalc(document.querySelector('.hz-itinerary-editor')));
   assert.equal(manual.arrivalAt,'2026-12-04T06:00','Explicit manual arrival overrides a source offer');
   assert.equal(manual.departureAt,'2026-12-06T22:00','Explicit manual departure overrides a source offer');
   assert.ok(manual.notes.some(x=>x.includes('δηλωμένου check-in')));
   assert.ok(manual.notes.some(x=>x.includes('δηλωμένο check-out')));
   console.log('PASS '+width+'px: manual time override, check-in/out and baggage/transfer reminders');

   const mismatch=await page.evaluate(()=>{
     const ed=document.querySelector('.hz-itinerary-editor'),c=window.HORIZON_FEASIBILITY.context(ed);
     return {
       wrongParty:window.HORIZON_FEASIBILITY.flightFor({...c,infants:0}),
       wrongDates:window.HORIZON_FEASIBILITY.flightFor({...c,from:'2026-12-11',to:'2026-12-13'}),
       impossible:window.HORIZON_FEASIBILITY.evaluate(c,{
         arrivalAt:'2026-12-08T11:00',departureAt:'2026-12-06T15:10',
         arrivalGround:'60',departureGround:'60'},[{slots:[{time:'25:90',text:'x'}]},{slots:[]},{slots:[]}]).conflicts
     };
   });
   assert.equal(mismatch.wrongParty,null);
   assert.equal(mismatch.wrongDates,null);
   assert.ok(mismatch.impossible.some(x=>x.includes('εκτός ημερομηνιών')));
   assert.ok(mismatch.impossible.some(x=>x.includes('μη έγκυρη ώρα')));
   console.log('PASS '+width+'px: stale passenger/date offers discarded and malformed times rejected');

   await page.waitForTimeout(200);
   await page.locator('.hd-close').click();
   await open(page);
   assert.equal(await page.locator('[name="checkIn"][data-hz-feasibility-field]').inputValue(),'15:00');
   assert.equal(await page.locator('[name="arrivalAt"][data-hz-feasibility-field]').inputValue(),'2026-12-04T06:00');
   assert.equal((await page.locator('.hz-itinerary-feasibility').getAttribute('data-status')),'unverified');
   if(width===390){
     const box=await page.locator('.hz-itinerary-feasibility').boundingBox();
     assert.ok(box&&box.x>=-5&&box.x+box.width<=395,'Mobile feasibility panel is clipped');
   }
   if(width===1280){
     const data=await page.evaluate(async()=>{
       const ed=document.querySelector('.hz-itinerary-editor'),
         pdf=window.HORIZON_PLANNER_V2_PDF,
         collected=pdf.collect(ed),bytes=await pdf.makePdf(collected),
         parsed=await window.PDFLib.PDFDocument.load(bytes);
       return {pages:parsed.getPageCount(),
         content:parsed.getForm().getTextField('trip_feasibility').getText()};
     });
     assert.equal(data.pages,4);
     assert.ok(data.content.includes('ΜΗ ΕΠΑΛΗΘΕΥΜΕΝΗ')||data.content.includes('ΕΚΚΡΕΜΕΙ:'),
       'PDF must carry the unverified state rather than present activities as certified');
     assert.ok(data.content.includes('2026-12-04T06:00'));
     console.log('PASS desktop: PDF includes unverified scheduling and manually entered source times');
   }
   console.log('PASS '+width+'px: stage-2 itinerary feasibility browser acceptance');
  }catch(e){
   mkdirSync('artifacts',{recursive:true});
   await page.screenshot({path:'artifacts/horizon-feasibility-'+width+'.png',fullPage:true}).catch(()=>{});
   throw e;
  }finally{await page.close();}
 }
 console.log('RESULT: PASS — stage 2 timing, family and provenance gates on desktop/mobile');
}catch(e){console.error('RESULT: FAIL — stage 2 feasibility',e?.stack||String(e));process.exitCode=1;}
finally{await browser.close();}

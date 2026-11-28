/**
 * HORIZON itinerary / PDF end-to-end release gate.
 * Runs real browser UI + real pdf-lib/fontkit/QR libraries, but no
 * live flight/hotel searches, payment, email or reservation requests.
 */
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';

const url=process.env.HORIZON_TEST_URL||'http://127.0.0.1:8765/';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1280,height:940},acceptDownloads:true});
const destination='Θεσσαλονίκη';

async function openItinerary(){
  const card=page.locator('.destination').filter({hasText:destination});
  await card.waitFor({timeout:15000});
  await card.locator('.actions a').filter({hasText:'διαμον'}).first().click();
  await page.locator('.hd-tab[data-tab="things"]').click();
  await page.locator('.hz-itinerary-editor [data-hz-budget-low]').first().waitFor({timeout:15000});
}
async function closeItinerary(){
  await page.locator('.hd-close').click();
  await page.locator('.horizon-detail-overlay').waitFor({state:'detached',timeout:15000});
}
try{
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>
    Array.isArray(window.HORIZON_DESTINATIONS)&&
    window.HORIZON_DESTINATIONS.some(d=>d.name==='Θεσσαλονίκη')&&
    typeof window.HORIZON_PLANNER_V2_PDF?.makePdf==='function'&&
    typeof window.scoreDest==='function'&&
    window.__HZ_MM_SCORE_PATCH__===true,null,{timeout:30000});
  await page.waitForTimeout(500);
  await page.evaluate(()=>{
    localStorage.clear();
    state={origin:'Αθήνα',dates:{from:'2026-12-04',flex:0},duration:3,
      budget:{amount:1500,transport:'all'},
      travelers:{adults:2,children:0,infants:1},style:'city',stay:'hotel',
      transport:'plane',interests:['history','family'],special:''};
    scored=[scoreDest(window.HORIZON_DESTINATIONS.find(d=>d.name==='Θεσσαλονίκη'))];
    document.getElementById('questionCard').classList.add('hidden');
    document.getElementById('resultsCard').classList.remove('hidden');
    document.querySelector('.progress-card')?.classList.add('hidden');
    window.renderResults('match','all');
  });
  await openItinerary();
  assert.equal(await page.locator('.hz-itinerary-editor .hz-edit-day').count(),3);
  const consent=page.locator('.hz-itinerary-editor [data-email-consent]');
  await consent.waitFor({timeout:15000});
  assert.equal(await consent.isChecked(),false,'Email consent must start unchecked');
  const emailButton=page.locator('.hz-itinerary-editor [data-email-pdf-v2]');
  await emailButton.waitFor({timeout:15000});
  await page.locator('.hz-itinerary-editor [data-email]').fill('user@example.test');
  await emailButton.click();
  assert.match(await page.locator('.hz-edit-status').textContent(),/συγκατάθεση|διαβίβαση/);
  await consent.check();
  await emailButton.click();
  assert.match(await page.locator('.hz-edit-status').textContent(),/δεν έχει ενεργοποιηθεί/);
  const challengeLoaded=await page.evaluate(()=>[...document.scripts].some(x=>
    x.src.includes('challenges.cloudflare.com/turnstile/')));
  assert.equal(challengeLoaded,false,'No third-party challenge loaded before email is configured');
  for(const path of ['privacy.html','terms.html']){
    const response=await page.request.get(new URL(path,url).toString());
    assert.equal(response.status(),200,path+' should be published and accessible');
    const body=await response.text();
    assert.match(body,/HORIZON/);
    assert.ok(body.includes('δοκιμαστικ')||body.includes('Δοκιμαστικ'));
  }
  assert.equal(await page.locator('footer a[href="./privacy.html"]').count(),1);
  assert.equal(await page.locator('footer a[href="./terms.html"]').count(),1);
  console.log('PASS: Stage 5 privacy/terms, non-prechecked email consent and inactive provider fail closed');
  const title=page.locator('.hz-itinerary-editor .hz-day-title').first();
  const activity=page.locator('.hz-itinerary-editor .hz-slot-text').first();
  const low=page.locator('.hz-itinerary-editor [data-hz-budget-low]').first();
  const high=page.locator('.hz-itinerary-editor [data-hz-budget-high]').first();
  await title.fill('Ημέρα Α — προσωπικό πλάνο');
  await activity.fill('Περίπατος στην παραλία και Λευκός Πύργος');
  await low.fill('40');
  await high.fill('90');
  await page.locator('.hz-itinerary-editor .hz-trip-notes').fill('Δοκιμαστική σημείωση PDF');
  await page.locator('.hz-itinerary-editor [data-save-itinerary]').click();
  await page.waitForTimeout(500);

  const keys=await page.evaluate(()=>({
    itinerary:Object.keys(localStorage).filter(k=>k.startsWith('horizon-itinerary-editor-v2:')),
    budget:Object.keys(localStorage).filter(k=>k.startsWith('horizon-planner-v2:'))
  }));
  assert.equal(keys.itinerary.length,1,'Day itinerary must be saved under trip-scoped key');
  assert.equal(keys.budget.length,1,'Daily budgets must be saved under trip-scoped key');
  console.log('PASS: edits and budgets persisted with trip dates + passenger party');

  await closeItinerary();
  await openItinerary();
  assert.equal(await page.locator('.hz-itinerary-editor .hz-day-title').first().inputValue(),
    'Ημέρα Α — προσωπικό πλάνο','Title must survive reopening');
  assert.equal(await page.locator('.hz-itinerary-editor .hz-slot-text').first().inputValue(),
    'Περίπατος στην παραλία και Λευκός Πύργος','Activity must survive reopening');
  assert.equal(await page.locator('.hz-itinerary-editor [data-hz-budget-low]').first().inputValue(),'40');
  assert.equal(await page.locator('.hz-itinerary-editor [data-hz-budget-high]').first().inputValue(),'90');

  const pdfAudit=await page.evaluate(async()=>{
    const editor=document.querySelector('.hz-itinerary-editor');
    const api=window.HORIZON_PLANNER_V2_PDF;
    const data=api.collect(editor);
    const bytes=await api.makePdf(data);
    const pdfDoc=await window.PDFLib.PDFDocument.load(bytes);
    const form=pdfDoc.getForm();
    return {
      bytes:bytes.length,pages:pdfDoc.getPageCount(),
      names:form.getFields().map(f=>f.getName()),
      title:form.getTextField('day_1_title').getText(),
      plan:form.getTextField('day_1_plan').getText(),
      low:form.getTextField('day_1_budget_low').getText(),
      high:form.getTextField('day_1_budget_high').getText(),
      tripNotes:form.getTextField('trip_notes').getText(),
      mapUrl:data.mapUrl,dayMapUrl:data.days[0].mapUrl
    };
  });
  assert.equal(pdfAudit.pages,4,'Three days require summary + 3 printable pages');
  assert.ok(pdfAudit.bytes>10000,'PDF must contain real embedded content');
  assert.equal(pdfAudit.title,'Ημέρα Α — προσωπικό πλάνο');
  assert.ok(pdfAudit.plan.includes('Λευκός Πύργος'));
  assert.equal(pdfAudit.low,'40');
  assert.equal(pdfAudit.high,'90');
  assert.equal(pdfAudit.tripNotes,'Δοκιμαστική σημείωση PDF');
  assert.ok(pdfAudit.names.includes('day_3_plan')&&pdfAudit.names.includes('day_1_done'));
  assert.ok(pdfAudit.mapUrl.includes('/map.html?d=')&&new URL(pdfAudit.dayMapUrl).searchParams.getAll('stop').length>0);
  console.log('PASS: real PDF generated, loaded again; 4 pages, Greek text, editable forms and map links');

  // Bad manual values must never silently become negative or inverted PDF totals.
  const validation=await page.evaluate(()=>{
    const editor=document.querySelector('.hz-itinerary-editor');
    const input=editor.querySelector('[data-hz-budget-low]');
    const before=input.value;input.value='-5';
    try{window.HORIZON_PLANNER_V2_PDF.collect(editor);return false;}
    catch(e){return /budget/.test(e.message);}
    finally{input.value=before;}
  });
  assert.equal(validation,true,'Invalid PDF budget must be rejected');
  console.log('PASS: invalid daily budget is rejected before PDF export');

  // Changing the travel party, without changing the destination, must
  // create a fresh itinerary + budget, never reuse the infant trip.
  await closeItinerary();
  await page.evaluate(()=>{
    state.travelers.infants=0;
    scored=[scoreDest(window.HORIZON_DESTINATIONS.find(d=>d.name==='Θεσσαλονίκη'))];
    window.renderResults('match','all');
  });
  await openItinerary();
  assert.notEqual(await page.locator('.hz-itinerary-editor .hz-day-title').first().inputValue(),
    'Ημέρα Α — προσωπικό πλάνο','Unrelated passenger party inherited saved itinerary');
  assert.notEqual(await page.locator('.hz-itinerary-editor [data-hz-budget-low]').first().inputValue(),
    '40','Unrelated passenger party inherited saved daily budget');
  console.log('PASS: changing passenger composition invalidates saved itinerary and budget');

  // Changing departure date also isolates the saved notes and budget.
  await closeItinerary();
  await page.evaluate(()=>{
    state.travelers.infants=1;
    state.dates.from='2026-12-18';
    scored=[scoreDest(window.HORIZON_DESTINATIONS.find(d=>d.name==='Θεσσαλονίκη'))];
    window.renderResults('match','all');
  });
  await openItinerary();
  assert.notEqual(await page.locator('.hz-itinerary-editor .hz-day-title').first().inputValue(),
    'Ημέρα Α — προσωπικό πλάνο','Changed date inherited previous itinerary');
  assert.notEqual(await page.locator('.hz-itinerary-editor [data-hz-budget-low]').first().inputValue(),
    '40','Changed date inherited previous daily budget');
  console.log('PASS: departure date changes isolate saved itinerary and budget');

  const book=await page.evaluate(()=>Object.keys(localStorage)
    .some(k=>k.startsWith('hz-flight-selection-')||k.startsWith('hz-hotel-selection-')));
  assert.equal(book,false,'Itinerary/PDF QA must not select fares or book hotels');
  console.log('RESULT: PASS — editable itinerary, reload, PDF, budget validation and isolation');
}catch(error){
  console.error('RESULT: FAIL — itinerary/PDF',error?.stack||String(error));
  mkdirSync('artifacts',{recursive:true});
  await page.screenshot({path:'artifacts/horizon-itinerary-pdf-failure.png',fullPage:true}).catch(()=>{});
  process.exitCode=1;
}finally{await browser.close();}

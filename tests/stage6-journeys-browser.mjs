/**
 * Stage 6: five Greece-first end-to-end journeys in real Chrome.
 * Verify destination -> budget -> editable itinerary -> real form PDF ->
 * route/map link for desktop and mobile, without any paid provider calls.
 */
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';

const url=process.env.HORIZON_TEST_URL||'http://127.0.0.1:8765/';
const scenarios=[
  {name:'Θεσσαλονίκη',transport:'plane',adults:2,children:0,infants:1,stay:'hotel'},
  {name:'Ναύπλιο',transport:'car',adults:2,children:1,infants:0,stay:'hotel'},
  {name:'Σύρος',transport:'ferry',adults:2,children:0,infants:0,stay:'hotel'},
  {name:'Ιωάννινα',transport:'car',adults:1,children:0,infants:0,stay:'any'},
  {name:'Ρόδος',transport:'plane',adults:2,children:1,infants:1,stay:'hotel'}
];
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
const totals=new Map();
try{
  for(const width of [1280,390]){
    const page=await browser.newPage({viewport:{width,height:width===390?844:920}});
    const paidSearches=[];
    // All supplier search endpoints are blocked BEFORE the page is opened.
    // The test therefore cannot consume SerpApi quota or book anything.
    await page.route('https://horizon-live-api.gnchristou.workers.dev/**',route=>{
      const path=new URL(route.request().url()).pathname;
      if(['/stays','/hotel-details','/flights','/flight-returns','/flight-booking-options',
          '/surface-search','/ferries','/trains','/email-pdf'].includes(path))
        paidSearches.push(path);
      return route.abort('blockedbyclient');
    });
    try{
      await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
      await page.waitForFunction(()=>Array.isArray(window.HORIZON_DESTINATIONS)&&
        window.HORIZON_DESTINATIONS.length>=100&&
        typeof window.scoreDest==='function'&&
        typeof window.renderResults==='function'&&
        typeof window.HORIZON_PLANNER_V2_PDF?.makePdf==='function'&&
        window.__HZ_MM_SCORE_PATCH__===true,null,{timeout:30000});
      await page.waitForTimeout(600);
      const release=await page.locator('meta[name="horizon-mvp-release"]').getAttribute('content');
      assert.equal(release,'2026-11-27-stage6','Published code must match Stage 6 tested release');
      assert.equal(await page.locator('meta[name="horizon-audit-patch"]').getAttribute('content'),
        '2026-11-27-audit1','Published code must include audited fixes, not a stale release');

      for(const scenario of scenarios){
        const outcome=await page.evaluate(s=>{
          localStorage.clear();
          const d=window.HORIZON_DESTINATIONS.find(x=>x.name===s.name);
          if(!d)return {missing:true};
          state={origin:'Αθήνα',dates:{from:'2026-12-04',flex:0},duration:3,
            budget:{amount:1500,transport:'all'},
            travelers:{adults:s.adults,children:s.children,infants:s.infants},
            style:'mixed',stay:s.stay,transport:s.transport,
            interests:['family','history'],special:''};
          scored=[scoreDest(d)];
          document.getElementById('questionCard').classList.add('hidden');
          document.getElementById('resultsCard').classList.remove('hidden');
          document.querySelector('.progress-card')?.classList.add('hidden');
          window.renderResults('match','all');
          const card=[...document.querySelectorAll('#resultsCard .destination')]
            .find(el=>el.querySelector('h4')?.textContent?.trim()===s.name);
          return {missing:false,total:scored[0]?.total,card:!!card,
            price:card?.querySelector('.cost')?.textContent||'',
            breakdown:!!card?.querySelector('.breakdown')};
        },scenario);
        assert.equal(outcome.missing,false,scenario.name+' missing from destination data');
        assert.equal(outcome.card,true,scenario.name+' no real result card');
        assert.equal(outcome.breakdown,true,scenario.name+' no budget breakdown');
        assert.ok(Number.isFinite(outcome.total)&&outcome.total>=0,scenario.name+' has invalid total');
        assert.match(outcome.price,/€/,'Every Greece-first quote should use EUR');
        if(totals.has(scenario.name)){
          assert.equal(outcome.total,totals.get(scenario.name),
            'Mobile and desktop differ for exactly the same scenario: '+scenario.name);
        }else totals.set(scenario.name,outcome.total);

        const card=page.locator('.destination').filter({has:page.locator('h4',{hasText:scenario.name})}).first();
        await card.locator('.actions a').filter({hasText:'διαμον'}).first().click();
        await page.locator('.horizon-detail-overlay .hd-tab[data-tab="things"]').click();
        const editor=page.locator('.hz-itinerary-editor');
        await editor.locator('.hz-edit-day').first().waitFor({timeout:15000});
        assert.equal(await editor.locator('.hz-edit-day').count(),3,'Three-day itinerary required');
        const title='MVP '+scenario.name+' '+width;
        await editor.locator('.hz-day-title').first().fill(title);
        await editor.locator('.hz-trip-notes').fill('Stage 6 Greece-first '+scenario.name);
        await editor.locator('[data-save-itinerary]').click();

        const result=await page.evaluate(async()=>{
          const el=document.querySelector('.hz-itinerary-editor');
          const api=window.HORIZON_PLANNER_V2_PDF;
          const data=api.collect(el);
          const bytes=await api.makePdf(data);
          const pdf=await window.PDFLib.PDFDocument.load(bytes);
          const form=pdf.getForm();
          return {bytes:bytes.length,pages:pdf.getPageCount(),
            title:form.getTextField('day_1_title').getText(),
            tripNotes:form.getTextField('trip_notes').getText(),
            firstBudgetLow:form.getTextField('day_1_budget_low').getText(),
            firstBudgetHigh:form.getTextField('day_1_budget_high').getText(),
            fields:form.getFields().map(x=>x.getName()),
            mapUrl:data.mapUrl,
            dayMapUrl:data.days[0]?.mapUrl};
        });
        assert.ok(result.bytes>10000,'Real embedded PDF required, not a text placeholder');
        assert.equal(result.pages,4,'Three days require summary + 3 PDF pages');
        assert.equal(result.title,title);
        assert.ok(result.tripNotes.includes(scenario.name));
        assert.ok(Number(result.firstBudgetLow)>=0);
        assert.ok(Number(result.firstBudgetHigh)>=Number(result.firstBudgetLow));
        assert.ok(result.fields.includes('day_1_done')&&result.fields.includes('day_3_plan'));
        const map=new URL(result.mapUrl),day=new URL(result.dayMapUrl);
        assert.equal(map.pathname,new URL('map.html',url).pathname);
        assert.equal(map.searchParams.get('d'),scenario.name);
        assert.equal(day.searchParams.get('d'),scenario.name);
        assert.ok(day.searchParams.getAll('stop').some(stop=>stop.trim().length>5),'Every scenario needs at least one actual daily map stop');
        const mapPage=await page.request.get(map.toString());
        assert.equal(mapPage.status(),200,'Static map route must resolve in deployed release');
        const mapSource=await mapPage.text();
        assert.match(mapSource,/maplibre|MapLibre/i,'Map page must contain its renderer');
        assert.match(mapSource,/ενδεικτικής οδικής διαδρομής/,
          'Map must not imply independently verified foot/public-transit navigation');

        if(width===390){
          const bounds=await editor.boundingBox();
          assert.ok(bounds&&bounds.x>=-5&&bounds.x+bounds.width<=395,
            'Editable itinerary should fit narrow mobile width: '+scenario.name);
        }
        await page.locator('.hd-close').click();
        await page.locator('.horizon-detail-overlay').waitFor({state:'detached',timeout:15000});
        console.log('PASS Stage 6 '+width+'px '+scenario.name+
          ' / '+scenario.transport+' / €'+outcome.total+
          ' / 4-page editable PDF / verified map route');
      }
      assert.equal(paidSearches.length,0,
        'Release tests must never make billable travel searches: '+paidSearches.join(', '));
    }catch(err){
      mkdirSync('artifacts',{recursive:true});
      await page.screenshot({path:'artifacts/stage6-'+width+'.png',fullPage:true}).catch(()=>{});
      throw err;
    }finally{await page.close();}
  }
  assert.equal(totals.size,5);
  console.log('PASS Stage 6: 5 Greece-first journeys x 2 viewports, real PDF, map and budget, 0 paid API calls');
}catch(err){
  console.error('STAGE 6 JOURNEY GATE FAILED:',err?.stack||String(err));
  process.exitCode=1;
}finally{await browser.close();}

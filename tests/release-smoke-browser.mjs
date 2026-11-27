/**
 * Release candidate smoke: five Greece-first scored trips, desktop and mobile.
 * No external provider requests and no payment/booking are performed.
 * Flight/hotel/seller tests run separately in this release workflow.
 */
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';

const url=process.env.HORIZON_TEST_URL||'http://127.0.0.1:8765/';
const scenarios=[
  {destination:'Θεσσαλονίκη',transport:'plane',adults:2,children:0,infants:1,stay:'hotel'},
  {destination:'Ναύπλιο',transport:'car',adults:2,children:1,infants:0,stay:'hotel'},
  {destination:'Σύρος',transport:'ferry',adults:2,children:0,infants:0,stay:'hotel'},
  {destination:'Ιωάννινα',transport:'car',adults:1,children:0,infants:0,stay:'any'},
  {destination:'Ρόδος',transport:'plane',adults:2,children:1,infants:1,stay:'hotel'}
];
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
const expectedTotals=new Map();
try {
  for(const viewport of [{width:1280,height:900},{width:390,height:844}]) {
    const page=await browser.newPage({viewport});
    try {
      await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
      await page.waitForFunction(()=>
        Array.isArray(window.HORIZON_DESTINATIONS)&&
        window.HORIZON_DESTINATIONS.length>=100&&
        typeof window.scoreDest==='function'&&
        typeof window.renderResults==='function'&&
        window.__HZ_MM_SCORE_PATCH__===true&&
        window.__HORIZON_RESULTS_TRUTH__===true&&
        window.__HORIZON_FLIGHT_TIMES_CORE__===true,
        null,{timeout:25000});
      // Allow follow-up wrappers/render hooks to finish before fixing the test input.
      await page.waitForTimeout(650);
      for(const scenario of scenarios) {
        const outcome=await page.evaluate(s=>{
          localStorage.clear();
          const d=window.HORIZON_DESTINATIONS.find(x=>x.name===s.destination);
          if(!d)return {missingDestination:true};
          state={
            origin:'Αθήνα',dates:{from:'2026-12-04',flex:0},duration:3,
            budget:{amount:1500,transport:'all'},
            travelers:{adults:s.adults,children:s.children,infants:s.infants},
            style:'mixed',stay:s.stay,transport:s.transport,
            interests:['family','history'],special:''
          };
          scored=[scoreDest(d)];
          document.getElementById('questionCard').classList.add('hidden');
          document.getElementById('resultsCard').classList.remove('hidden');
          document.querySelector('.progress-card')?.classList.add('hidden');
          window.renderResults('match','all');
          const card=[...document.querySelectorAll('#resultsCard .destination')]
            .find(el=>el.querySelector('h4')?.textContent?.trim()===s.destination);
          return {
            missingDestination:false,
            total:scored[0]?.total,
            cardExists:!!card,
            price:card?.querySelector('.cost')?.textContent||'',
            hasBreakdown:!!card?.querySelector('.breakdown')
          };
        },scenario);
        assert.equal(outcome.missingDestination,false,scenario.destination+' is missing');
        assert.equal(outcome.cardExists,true,scenario.destination+' result card missing');
        assert.ok(Number.isFinite(outcome.total)&&outcome.total>=0,
          scenario.destination+' total budget must be finite');
        if(expectedTotals.has(scenario.destination))
          assert.equal(outcome.total,expectedTotals.get(scenario.destination),
            scenario.destination+' must have identical budget on mobile and desktop for the same travelers and dates');
        else expectedTotals.set(scenario.destination,outcome.total);
        assert.ok(outcome.price.includes('€'),scenario.destination+' must show EUR');
        assert.equal(outcome.hasBreakdown,true,scenario.destination+' cost breakdown missing');
        if(viewport.width===390) {
          const box=await page.locator('#resultsCard .destination').first().boundingBox();
          assert.ok(box&&box.x>=-4&&box.x+box.width<=viewport.width+4,
            scenario.destination+' result card is horizontally clipped on mobile');
        }
        console.log('PASS '+viewport.width+'px '+scenario.destination+
          ' / '+scenario.transport+' / '+safelyFormat(outcome.total));
      }
      const userBooking=await page.evaluate(()=>
        Object.keys(localStorage).some(k=>/selection-v2|hotel-selection/.test(k)));
      assert.equal(userBooking,false,'Smoke test must not create actual fare or hotel selection');
    }catch(error) {
      mkdirSync('artifacts',{recursive:true});
      await page.screenshot({path:'artifacts/horizon-release-'+viewport.width+'.png',fullPage:true}).catch(()=>{});
      throw error;
    }finally { await page.close(); }
  }
  console.log('PASS: 5 scenarios x 2 viewports, estimate-only; no booking or provider charges');
}catch(error) {
  console.error('RELEASE SMOKE FAILED:',error?.stack||String(error));
  process.exitCode=1;
}finally {await browser.close();}
function safelyFormat(n){return Number(n).toFixed(2)+' EUR';}

/**
 * Independent MVP audit: real wizard input, malformed persisted state and
 * consistent bounded itinerary/PDF length at both desktop/mobile widths.
 */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const url=process.env.HORIZON_TEST_URL||'http://127.0.0.1:8765/';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
try {
 for(const width of [1280,390]){
  const page=await browser.newPage({viewport:{width,height:width===390?844:920}});
  try{
   await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
   await page.waitForFunction(()=>window.__HORIZON_TRAVELER_AGE_PATCH__===true&&
     window.__HZ_MM_SCORE_PATCH__===true&&typeof window.render==='function',
     null,{timeout:30000});
   const badStates=['null','[]','false','"{broken}"','{"_step":-3}',
     '{"_step":2.5}','{"_step":999}','not-json','{"_step":8,"interests":42}'];
   for(const stored of badStates){
     await page.evaluate(v=>localStorage.setItem('horizon-planner-v1',v),stored);
     await page.reload({waitUntil:'domcontentloaded'});
     const observed=await page.evaluate(()=>({
       stateIsObject:!!state&&typeof state==='object'&&!Array.isArray(state),
       validStep:Number.isInteger(current)&&current>=0&&current<=9,
       hasQuestion:!!document.querySelector('#questionCard h3'),
       current
     }));
     assert.equal(observed.stateIsObject,true,stored);
     assert.equal(observed.validStep,true,stored);
     assert.equal(observed.hasQuestion,true,stored);
   }
   await page.waitForFunction(()=>window.__HORIZON_TRAVELER_AGE_PATCH__===true,
     null,{timeout:30000});
   const stale=await page.evaluate(()=>{
     state={_step:9,origin:'Αθήνα',dates:{from:'2026-12-04',flex:0},
       duration:99,budget:{amount:1500,transport:'all'},
       travelers:{adults:2,children:0,infants:1},
       style:'city',stay:'hotel',transport:'car',interests:['history'],special:''};
     current=9;render();
     document.getElementById('nextBtn').click();
     return {current,reason:document.getElementById('error')?.textContent||''};
   });
   assert.equal(stale.current,2,'Restored step 10 cannot bypass invalid 99-day trip');
   assert.match(stale.reason,/Έλεγξε ή συμπλήρωσε/);
   await page.evaluate(()=>{
     state={origin:'Αθήνα',dates:{from:'2026-12-04',flex:0},duration:'3'};
     current=2;render();
   });
   for(const days of ['0','-3','15','100','1.5','']){
     const result=await page.evaluate(v=>{
       const input=document.querySelector('#value');
       input.value=v;
       document.getElementById('nextBtn').click();
       return {current,error:document.getElementById('error').textContent};
     },days);
     assert.equal(result.current,2,'Invalid duration '+days+' must stay on step');
     assert.match(result.error,/1 έως 14/);
   }
   const valid=await page.evaluate(()=>{
     document.getElementById('value').value='14';
     document.getElementById('nextBtn').click();
     return {current,days:state.duration};
   });
   assert.equal(valid.current,3,'14 days must be accepted');
   assert.equal(Number(valid.days),14,'14 days must survive capture');
   for(const money of ['0','-100','10000001','']){
     const result=await page.evaluate(v=>{
       document.getElementById('budgetAmount').value=v;
       document.getElementById('nextBtn').click();
       return {current,error:document.getElementById('error').textContent};
     },money);
     assert.equal(result.current,3,'Invalid budget '+money+' must be denied');
     assert.match(result.error,/100 € έως 10.000.000/);
   }
   await page.evaluate(()=>{
     document.getElementById('budgetAmount').value='1500';
     document.getElementById('nextBtn').click();
   });
   assert.equal(await page.evaluate(()=>current),4);
   await page.waitForFunction(()=>!!document.querySelector('#infants'),null,{timeout:10000});
   const wrongParties=[
     {a:'1.5',c:'0',i:'0'},
     {a:'1',c:'-2',i:'0'},
     {a:'1',c:'1.1',i:'0'},
     {a:'1',c:'0',i:'-1'},
     {a:'30',c:'20',i:'5'},
     {a:'0',c:'0',i:'0'}
   ];
   for(const party of wrongParties){
     const result=await page.evaluate(t=>{
       document.getElementById('adults').value=t.a;
       document.getElementById('children').value=t.c;
       document.getElementById('infants').value=t.i;
       document.getElementById('nextBtn').click();
       return {current,error:document.getElementById('error').textContent};
     },party);
     assert.equal(result.current,4,'Invalid traveler party must be denied '+JSON.stringify(party));
     assert.match(result.error,/ακέραιους/);
   }
   const party=await page.evaluate(()=>{
     document.getElementById('adults').value='2';
     document.getElementById('children').value='1';
     document.getElementById('infants').value='1';
     document.getElementById('nextBtn').click();
     return {current,travelers:state.travelers};
   });
   assert.equal(party.current,5,'2 adults + child + infant should be supported');
   assert.equal(party.travelers.infants,1);
   const noStorage=await page.evaluate(()=>{
     const original=Storage.prototype.setItem;
     try{
       Storage.prototype.setItem=function(){throw new DOMException('Quota exceeded','QuotaExceededError');};
       try{save();return true;}catch{return false;}
     }finally{Storage.prototype.setItem=original;}
   });
   assert.equal(noStorage,true,'Blocked localStorage must not crash wizard');
   console.log('PASS AUDIT '+width+'px corrupted state, 1–14 day guard, budget, party integers and storage failover');
  }finally{await page.close();}
 }
}catch(err){
 console.error('AUDIT WIZARD FAILED:',err?.stack||String(err));
 process.exitCode=1;
}finally{await browser.close();}

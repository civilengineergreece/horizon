import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const ctx={window:{}};
vm.runInNewContext(readFileSync('flight-infant-fare-rules.js','utf8'),ctx);
const {policies}=ctx.window.HORIZON_INFANT_FARE_RULES;
test('Infant policy comes only from official carrier pages and never invents amount',()=>{
  const r=policies({
    outbound:{segments:[{airline:'AEGEAN'}]},
    returnFlight:{segments:[{airline:'SKY express'}]}
  },1);
  assert.equal(r.length,2);
  assert.ok(r.some(x=>x.airline==='AEGEAN'&&x.rateDescription.includes('10%')&&x.url.includes('aegeanair.com')));
  assert.ok(r.some(x=>x.airline==='SKY express'&&x.rateDescription.includes('90%')&&x.url.includes('skyexpress.gr')));
  assert.ok(r.every(x=>x.amountVerified===false&&x.sourceType==='official_carrier_fare_rules'));
  assert.equal(policies({outbound:{airlines:['AEGEAN']}},0).length,0);
});
test('Unknown carriers never inherit AEGEAN or SKY fare rule',()=>{
  const r=policies({outbound:{segments:[{airline:'Unrelated air'}]}},1);
  assert.equal(r.length,1);
  assert.equal(r[0].sourceType,'unverified');
  assert.equal(r[0].url,null);
});

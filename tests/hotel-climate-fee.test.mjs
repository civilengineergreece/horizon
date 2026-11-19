import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const ctx={window:{},Date};
vm.runInNewContext(readFileSync('hotel-climate-fee.js','utf8'),ctx);
const calculate=ctx.window.HORIZON_HOTEL_CLIMATE_FEE.estimate;
const stay=(from,to,hotelClass,type='hotel')=>calculate({checkInDate:from,checkOutDate:to,hotelClass,type,countryCode:'GR'});
test('official 2026 December hotel levy per room per night, not per person',()=>{
  const four=stay('2026-12-04','2026-12-06',4);
  assert.equal(four.amountEUR,6);
  assert.equal(four.mustNotAutoAddToQuote,true);
  assert.equal(four.inclusionInProviderPrice,'unknown');
  assert.equal(stay('2026-12-04','2026-12-06',5).amountEUR,8);
  assert.equal(stay('2026-12-04','2026-12-06',3).amountEUR,3);
});
test('month boundary rates are charged per night including April switch',()=>{
  assert.equal(stay('2026-03-31','2026-04-02',4).amountEUR,13);
  assert.equal(stay('2026-10-31','2026-11-02',4).amountEUR,13);
});
test('unknown classes, multiple rooms and years outside verified rule cannot produce invented levies',()=>{
  assert.equal(stay('2026-12-04','2026-12-06',null),null);
  assert.equal(stay('2026-12-04','2026-12-06',4,'vacation rental'),null);
  assert.equal(stay('2027-01-04','2027-01-06',4),null);
  assert.equal(calculate({checkInDate:'2026-12-04',checkOutDate:'2026-12-06',hotelClass:4,countryCode:'GR',units:2}),null);
  assert.equal(calculate({checkInDate:'2026-12-04',checkOutDate:'2026-12-06',hotelClass:4,countryCode:'IT'}),null);
});

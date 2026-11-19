import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const ctx={window:{},document:{addEventListener(){}},navigator:{},Intl,Date};
vm.runInNewContext(readFileSync('hotel-checkout-audit.js','utf8'),ctx);
const assess=ctx.window.HorizonHotelCheckoutAudit.assess;
const complete={
  source:'seller_checkout',total:'286,25',
  datesConfirmed:true,partyConfirmed:true,roomConfirmed:true,infantIncluded:true,
  totalCoverage:'all_in',cribStatus:'free',cribFee:'',
  climateStatus:'included',cancellationReviewed:true,
  capacityStatus:'listed_capacity_sufficient_for_non_infants',
  bookingUrl:'https://example.com/seller'
};
test('full verified-by-user seller checkout can replace a quote but is NEVER independent confirmation',()=>{
  const r=assess(complete);
  assert.equal(r.complete,true);
  assert.equal(r.manualOnly,true);
  assert.equal(r.budgetTotal,286.25);
  assert.equal(r.problems.length,0);
});
test('one missing factor must block a final checkout label and budget update',()=>{
  const cases=[
    {source:'written_hotel'},
    {source:'not_checked'},
    {total:''},
    {total:'not a number'},
    {total:'-20'},
    {datesConfirmed:false},
    {partyConfirmed:false},
    {roomConfirmed:false},
    {infantIncluded:false},
    {totalCoverage:'unknown'},
    {totalCoverage:'not_all_in'},
    {cribStatus:'on_request'},
    {cribStatus:'not_available'},
    {cribStatus:'unknown'},
    {climateStatus:'excluded'},
    {climateStatus:'unknown'},
    {cancellationReviewed:false},
    {capacityStatus:'insufficient'},
    {bookingUrl:'http://insecure.example'}
  ];
  for(const patch of cases){
    const r=assess({...complete,...patch});
    assert.equal(r.complete,false,JSON.stringify(patch));
    assert.equal(r.budgetTotal,null,JSON.stringify(patch));
    assert.ok(r.problems.length>0);
  }
});
test('paid infant cot requires exact fee and all-in seller total',()=>{
  for(const cotFee of ['', '0', '-1', '??']){
    const r=assess({...complete,cribStatus:'paid',cribFee:cotFee});
    assert.equal(r.complete,false,cotFee);
  }
  const yes=assess({...complete,cribStatus:'paid',cribFee:'12,50'});
  assert.equal(yes.complete,true);
  assert.equal(yes.budgetTotal,286.25,'Already-inclusive checkout total must not double-add cot price');
});
test('Greek numerical input is parsed, not rounded or silently allowed if ambiguous',()=>{
  assert.equal(assess({...complete,total:'1.234,56'}).budgetTotal,1234.56);
  assert.equal(assess({...complete,total:'1,234.56'}).complete,false);
  assert.equal(assess({...complete,total:'286,255'}).complete,false);
});
test('no infant cot needed and levy not applicable can be explicitly confirmed',()=>{
  const r=assess({...complete,cribStatus:'not_needed',climateStatus:'not_applicable'});
  assert.equal(r.complete,true);
  assert.equal(r.manualOnly,true);
});

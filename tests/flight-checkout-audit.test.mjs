import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const ctx={window:{},document:{readyState:'loading',addEventListener(){}},Date,Number,
 Intl,URL,console,setTimeout,clearTimeout,localStorage:{}};
vm.runInNewContext(readFileSync('flight-checkout-audit.js','utf8'),ctx);
const {assess,parseEuro,validCtx}=ctx.window.HORIZON_FLIGHT_CHECKOUT_AUDIT;
const context={origin:'Αθήνα',destination:'Θεσσαλονίκη',from:'2026-12-04',to:'2026-12-06',adults:2,children:1,infants:1};
const selection=()=>({at:Date.now(),editedAt:Date.now(),bookingFareStage:'seller_quote',bookingStatus:'quote_only_not_checked_out',
 bookingSeller:'Example Seller',fare:355,ground:20,baggage:40,scope:'roundtrip',
 origin:context.origin,destination:context.destination,from:context.from,to:context.to,
 travelers:{adults:2,children:1,infants:1},outbound:{segments:[{flightNumber:'F100'}]},returnFlight:{segments:[{flightNumber:'F101'}]}});
const good=()=>({ctx:context,selection:selection(),seller:'Example Seller',total:'440,50',
 source:'seller_final_payment_screen',datesAndFlights:true,passengers:true,
 children:true,infants:true,infantPolicy:true,baggageAndSeats:true,
 mandatoryCharges:true,cancellation:true,availability:true,separateTickets:false,
 separateTicketsReviewed:false});
test('parses Greek and US EUR but rejects ambiguous amounts',()=>{
 assert.equal(parseEuro('1.234,56'),1234.56);
 assert.equal(parseEuro('1,234.56'),1234.56);
 assert.equal(parseEuro('440,50'),440.5);
 for(const x of ['1.234','-5','NaN','40.1234',''])assert.ok(Number.isNaN(parseEuro(x)),x);
});
test('manual airline checkout includes all-in airfare once plus separate ground only',()=>{
 const r=assess(good());
 assert.equal(r.complete,true);
 assert.equal(r.manualOnly,true);
 assert.equal(r.airlineCheckoutTotal,440.5);
 assert.equal(r.groundSeparate,20);
 assert.equal(r.budgetTransportTotal,460.5);
 assert.equal(validCtx(good().selection,context),true);
});
test('all material airline/cot-like/infant/seller and payment-screen omissions block budget',()=>{
 const base=good();
 for(const patch of [
  {source:'search_result'},{seller:'Different Seller'},{total:''},{total:'1.234'},
  {datesAndFlights:false},{passengers:false},{children:false},{infants:false},
  {infantPolicy:false},{baggageAndSeats:false},{mandatoryCharges:false},
  {cancellation:false},{availability:false},
  {selection:{...base.selection,bookingFareStage:'search_offer'}},
  {selection:{...base.selection,bookingSeller:null}},
  {selection:{...base.selection,at:Date.now()-31*60000}},
  {selection:{...base.selection,at:Date.now()+100000}},
  {selection:{...base.selection,travelers:{adults:2,children:0,infants:1}}},
  {selection:{...base.selection,to:'2026-12-07'}},
  {selection:{...base.selection,scope:'oneway'}},
  {selection:{...base.selection,ground:-1}}
 ]){
  const r=assess({...base,...patch});
  assert.equal(r.complete,false,JSON.stringify(patch));
  assert.equal(r.airlineCheckoutTotal,null);
  assert.equal(r.budgetTransportTotal,null);
 }
});
test('separate tickets need explicit review, adults-only skip irrelevant infant checks',()=>{
 const a=good();a.separateTickets=true;assert.equal(assess(a).complete,false);
 a.separateTicketsReviewed=true;assert.equal(assess(a).complete,true);
 const adult={...good(),ctx:{...context,children:0,infants:0},
  selection:{...selection(),travelers:{adults:2,children:0,infants:0}},
  children:false,infants:false,infantPolicy:false};
 assert.equal(assess(adult).complete,true);
});

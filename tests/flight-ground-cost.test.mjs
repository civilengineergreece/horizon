import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const ctx={window:{}};
vm.runInNewContext(readFileSync('flight-ground-cost.js','utf8'),ctx);
const estimate=ctx.window.HORIZON_FLIGHT_GROUND_ESTIMATE.estimate;
const out={departure:{airport:'ATH'},arrival:{airport:'SKG'}};
const back={departure:{airport:'SKG'},arrival:{airport:'ATH'}};

test('published airport fares for two adults + infant and round trip total €30',()=>{
  const x=estimate({adults:2,children:0,infants:1},{scope:'roundtrip',outbound:out,returnFlight:back});
  assert.ok(x);
  assert.equal(x.amountEUR,30);
  assert.equal(x.minutesEachWay,120);
  assert.equal(x.airportBufferTotalMinutes,240);
  assert.equal(x.infantsFareBasis,'under_6_free_on_both_bus_networks');
  assert.equal(x.sourceType,'public_tariff_city_centre_benchmark');
  assert.ok(x.profiles.every(p=>p.faresUrl.startsWith('https://')));
});

test('one-way fare for one adult is €7.50, two transport legs',()=>{
  const x=estimate({adults:1,children:0,infants:0},{scope:'oneway',outbound:out});
  assert.equal(x.amountEUR,7.5);
  assert.equal(x.journeyCount,1);
  assert.equal(x.minutesEachWay,120);
  assert.equal(x.airportBufferTotalMinutes,120);
});

test('unknown airports, incompatible returns and unspecified children do not receive invented total fares',()=>{
  assert.equal(estimate({adults:1},{scope:'oneway',outbound:{departure:{airport:'ATH'},arrival:{airport:'LHR'}}}),null);
  assert.equal(estimate({adults:1},{scope:'roundtrip',outbound:out,returnFlight:{departure:{airport:'ATH'},arrival:{airport:'SKG'}}}),null);
  assert.equal(estimate({adults:2,children:1,infants:0},{scope:'roundtrip',outbound:out,returnFlight:back}),null);
});

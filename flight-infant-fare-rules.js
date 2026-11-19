(()=>{
'use strict';
// Verified 2026-11-19 from airlines' published fare rules.
// Applies only to lap infants (<2 years) on the named operating carrier.
// 10% of adult *fare* is not 10% of a family all-in quote.
// We intentionally NEVER calculate a monetary infant charge here.
const RULES={
  aegean:{airline:'AEGEAN',rateDescription:'Βρέφος κάτω των 2 ετών χωρίς θέση: 10% του ναύλου ενηλίκου.',
    url:'https://el.aegeanair.com/organoste/fare-rules/'},
  sky:{airline:'SKY express',rateDescription:'Βρέφος 0–2 ετών στην αγκαλιά: έκπτωση 90% στον ναύλο ενηλίκου.',
    url:'https://www.skyexpress.gr/en/sky-experience/before-fly/fare-types'}
};
function match(name){
  const v=String(name||'').trim().toLocaleLowerCase('en');
  if(/\baegean\b/.test(v))return RULES.aegean;
  if(/\bsky\s*express\b/.test(v))return RULES.sky;
  return null;
}
function policies(selection,infants){
  if(!(Number(infants)>0))return [];
  const names=[];
  for(const flight of [selection?.outbound,selection?.returnFlight]){
    if(!flight)continue;
    if(Array.isArray(flight.segments)&&flight.segments.length){
      for(const seg of flight.segments)names.push(seg.airline);
    }else for(const x of (flight.airlines||[]))names.push(x);
  }
  const known=new Map(),unknown=new Set();
  for(const airline of names){
    const rule=match(airline);
    if(rule)known.set(rule.airline,rule);
    else if(airline)unknown.add(String(airline));
  }
  const results=[...known.values()].map(rule=>({...rule,sourceType:'official_carrier_fare_rules',checkedAt:'2026-11-19',amountVerified:false}));
  if(unknown.size)results.push({airline:[...unknown].join(' / '),rateDescription:'Δεν έχει επαληθευτεί επίσημος βρεφικός ναύλος για αυτή την αεροπορική.',url:null,sourceType:'unverified',checkedAt:null,amountVerified:false});
  if(!names.length)results.push({airline:'Άγνωστη αεροπορική',rateDescription:'Απαιτείται έλεγχος βρεφικού ναύλου στον πωλητή.',url:null,sourceType:'unverified',checkedAt:null,amountVerified:false});
  return results;
}
window.HORIZON_INFANT_FARE_RULES={policies,checkedAt:'2026-11-19'};
})();

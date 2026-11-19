(()=>{
'use strict';
// Public-fare benchmarks, NOT live schedules and NOT door-to-door routing.
// Checked against operator fare pages on 2026-11-19.
const PROFILES=Object.freeze({
  ATH:Object.freeze({
    city:'Πλατεία Συντάγματος, Αθήνα',airport:'ATH',mode:'ΟΑΣΑ X95',
    adultOneWayEUR:5.50,rideMinutesEstimate:60,
    faresUrl:'https://www.oasa.gr/en/tickets/prices-of-products/',
    journeyUrl:'https://www.oasa.gr/en/visit-athens/airport-express-bus-lines/'
  }),
  SKG:Object.freeze({
    city:'Κέντρο Θεσσαλονίκης / ΚΤΕΛ',airport:'SKG',mode:'ΟΣΕΘ 01Χ',
    adultOneWayEUR:2.00,rideMinutesEstimate:60,
    faresUrl:'https://oseth.com.gr/el/times-proionton-leoforeion',
    journeyUrl:'https://oseth.com.gr/el/anazitisi-dromologion-leoforeion?route=01X'
  })
});
const SOURCES_CHECKED='2026-11-19';
const AIRPORT_BUFFER_MIN=120; // AIA airport advice: arrive >=2 hours ahead of departure
function estimate(travelers,selection){
  const adults=Number(travelers?.adults),children=Number(travelers?.children)||0;
  const infants=Number(travelers?.infants)||0;
  if(!Number.isInteger(adults)||adults<1||children>0||infants<0)return null;
  const outbound=selection?.outbound,returnFlight=selection?.returnFlight;
  const from=outbound?.departure?.airport,to=outbound?.arrival?.airport;
  if(!Object.hasOwn(PROFILES,from)||!Object.hasOwn(PROFILES,to)||from===to)return null;
  const roundtrip=selection?.scope==='roundtrip';
  if(roundtrip&&(returnFlight?.departure?.airport!==to||returnFlight?.arrival?.airport!==from))return null;
  if(!roundtrip&&selection?.scope!=='oneway')return null;
  const fromProfile=PROFILES[from],toProfile=PROFILES[to];
  const journeys=roundtrip?2:1;
  const singleJourneyCost=adults*(fromProfile.adultOneWayEUR+toProfile.adultOneWayEUR);
  return {
    sourceType:'public_tariff_city_centre_benchmark',
    currency:'EUR',
    amountEUR:Math.round(singleJourneyCost*journeys*100)/100,
    minutesEachWay:fromProfile.rideMinutesEstimate+toProfile.rideMinutesEstimate,
    journeyCount:journeys,
    departureAirportBufferMinutes:AIRPORT_BUFFER_MIN,
    airportBufferTotalMinutes:AIRPORT_BUFFER_MIN*journeys,
    covers:'city_centre_to_airport_and_airport_to_city_centre',
    infantsFareBasis:infants>0?'under_6_free_on_both_bus_networks':'not_applicable',
    childrenIncluded:false,
    adultsIncluded:adults,
    verifiedFareDate:SOURCES_CHECKED,
    profiles:[fromProfile,toProfile],
    caveats:'Οι τιμές λεωφορείων είναι δημόσια δημοσιευμένα κόμιστρα, όχι ζωντανή διαθεσιμότητα. Οι χρόνοι είναι εκτιμήσεις χωρίς αναμονή, περπάτημα ή πραγματική διεύθυνση. Προστέθηκε περιθώριο 2 ωρών ανά αναχώρηση αεροπλάνου.'
  };
}
window.HORIZON_FLIGHT_GROUND_ESTIMATE={estimate,profiles:PROFILES,checkedAt:SOURCES_CHECKED};
})();

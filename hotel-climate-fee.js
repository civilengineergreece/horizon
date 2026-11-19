(()=>{
'use strict';
// N. 5177/2025 art. 44: fee per room/unit and occupied night, not per guest.
// Source: https://tax2.taxheaven.gr/law/5177/2025/arthro/44
// These values are the 2025-2026 rule. Do NOT assume future legal rates.
const RATES={
  1:{high:2,low:0.5},2:{high:2,low:0.5},
  3:{high:5,low:1.5},4:{high:10,low:3},5:{high:15,low:4}
};
function isoDate(s){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(s||'')))return null;
  const d=new Date(s+'T00:00:00Z');
  return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s?d:null;
}
function estimate({checkInDate,checkOutDate,hotelClass,type='hotel',countryCode,units=1}={}){
  const from=isoDate(checkInDate),to=isoDate(checkOutDate),stars=Number(hotelClass);
  const kind=String(type||'').trim().toLowerCase();
  if(countryCode!=='GR'||!from||!to||to<=from||!Number.isInteger(units)||units!==1 ||
     !(kind==='hotel'||kind==='ξενοδοχείο')||!RATES[stars])return null;
  const nights=Math.round((to-from)/86400000);
  if(nights<1||nights>90||from.getUTCFullYear()!==2026&&to.getUTCFullYear()!==2026)return null;
  let euro=0;
  for(let n=0;n<nights;n++){
    const d=new Date(from.getTime()+n*86400000),m=d.getUTCMonth()+1;
    if(d.getUTCFullYear()!==2026)return null;
    euro+=m>=4&&m<=10?RATES[stars].high:RATES[stars].low;
  }
  return {
    amountEUR:Math.round(euro*100)/100,
    rateScope:'one_hotel_room_2026',
    units:1,nights,hotelClass:stars,
    feeBasis:'statutory_per_room_night',
    inclusionInProviderPrice:'unknown',
    mustNotAutoAddToQuote:true,
    officialRule:'Ν. 5177/2025, άρθρο 44',
    sourceUrl:'https://tax2.taxheaven.gr/law/5177/2025/arthro/44'
  };
}
window.HORIZON_HOTEL_CLIMATE_FEE={estimate,sourceDate:'2026-11-19'};
})();
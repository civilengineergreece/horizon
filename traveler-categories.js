(()=>{
'use strict';

const STYLE_ID='horizon-traveler-categories-style';

function installStyles(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
    .traveler-age-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
    .traveler-age-note{margin-top:-6px;color:#8fa0ac;font-size:.78rem;line-height:1.45}
    @media(max-width:620px){.traveler-age-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
}

function n(value,fallback=0){const x=Number(value);return Number.isFinite(x)?Math.floor(x):fallback;}
function travelers(){
  const t=(typeof state!=='undefined'&&state?.travelers)||{};
  return {
    adults:Math.max(1,n(t.adults,1)),
    children:Math.max(0,n(t.children,0)),
    infants:Math.max(0,n(t.infants,0))
  };
}

function installPlannerPatch(){
  if(typeof fieldsHTML!=='function'||typeof capture!=='function'||typeof calcCost!=='function'||typeof renderResults!=='function')return false;
  if(window.__HORIZON_TRAVELER_AGE_PATCH__)return true;
  window.__HORIZON_TRAVELER_AGE_PATCH__=true;
  installStyles();

  const originalFieldsHTML=fieldsHTML;
  fieldsHTML=function(step){
    if(step?.type!=='travelers')return originalFieldsHTML(step);
    const v=(typeof state!=='undefined'&&state?.[step.key])||{};
    const adults=Math.max(1,n(v.adults,1));
    const children=Math.max(0,n(v.children,0));
    const infants=Math.max(0,n(v.infants,0));
    return `<div class="fields traveler-age-grid"><div class="field"><label>Ταξιδιώτες 12+ ετών</label><input class="control" id="adults" type="number" min="1" max="9" value="${adults}"></div><div class="field"><label>Παιδιά 2–11 ετών</label><input class="control" id="children" type="number" min="0" max="8" value="${children}"></div><div class="field"><label>Βρέφη κάτω των 2 ετών</label><input class="control" id="infants" type="number" min="0" max="9" value="${infants}"></div></div><div class="traveler-age-note">Για τις πτήσεις: έως 9 θέσεις συνολικά στις κατηγορίες 12+ και παιδιά. Τα βρέφη ταξιδεύουν χωρίς δική τους θέση και δεν μπορούν να είναι περισσότερα από τους ταξιδιώτες 12+.</div>`;
  };

  const originalCapture=capture;
  capture=function(){
    const s=(typeof steps!=='undefined'&&typeof current!=='undefined')?steps[current]:null;
    if(s?.type!=='travelers')return originalCapture();
    const a=document.getElementById('adults'),c=document.getElementById('children'),i=document.getElementById('infants');
    state[s.key]={adults:Math.max(1,n(a?.value,1)),children:Math.max(0,n(c?.value,0)),infants:Math.max(0,n(i?.value,0))};
    if(typeof save==='function')save();
  };

  if(typeof validate==='function'){
    const originalValidate=validate;
    validate=function(){
      const s=(typeof steps!=='undefined'&&typeof current!=='undefined')?steps[current]:null;
      if(s?.type!=='travelers')return originalValidate();
      const t=travelers();
      return t.adults>=1&&t.adults<=9&&t.children>=0&&t.infants>=0&&(t.adults+t.children)<=9&&t.infants<=t.adults;
    };
  }

  const originalCalcCost=calcCost;
  calcCost=function(d){
    const t=travelers();
    const days=Math.max(1,Number(state.duration)||1),nights=Math.max(0,days-1);
    const weighted=t.adults+t.children*.55+t.infants*.15;
    let stayFactor=.94;if(state.stay==='hotel')stayFactor=1.12;else if(state.stay==='airbnb')stayFactor=.98;else if(state.stay==='camping')stayFactor=.66;
    const accommodation=Math.round(d.daily*nights*weighted*.52*stayFactor),foodLocal=Math.round(d.daily*days*(t.adults+t.children*.55+t.infants*.08)*.34),activities=Math.round(d.activity*days*(t.adults+t.children*.55+t.infants*.05)),transport=state.budget?.transport==='no'?0:Math.round(d.travel*(t.adults+t.children*.7+t.infants*.15));
    return {accommodation,foodLocal,activities,transport,total:accommodation+foodLocal+activities+transport};
  };
  window.__HORIZON_ORIGINAL_CALC_COST__=originalCalcCost;

  const originalRenderResults=renderResults;
  renderResults=function(...args){
    const out=originalRenderResults(...args);
    const t=travelers(),total=t.adults+t.children+t.infants;
    document.querySelectorAll('#resultsCard .result-summary .sum').forEach(box=>{
      if(box.querySelector('small')?.textContent?.trim()==='Ταξιδιώτες'){
        const strong=box.querySelector('strong');if(strong)strong.textContent=String(total);
      }
    });
    return out;
  };

  // If the user refreshes while already on the traveler question, redraw it with the new categories.
  try{
    const q=document.getElementById('questionCard');
    if(typeof current==='number'&&steps?.[current]?.type==='travelers'&&q&&!q.classList.contains('hidden')&&typeof render==='function')render();
  }catch(e){}
  return true;
}

function installFlightSearchPatch(){
  if(window.__HORIZON_FLIGHT_INFANT_PATCH__)return;
  window.__HORIZON_FLIGHT_INFANT_PATCH__=true;
  const nativeReplace=history.replaceState.bind(history);
  history.replaceState=function(stateObject,title,url){
    let next=url;
    try{
      const u=new URL(String(url),location.href);
      let code=u.searchParams.get('flightSearch');
      if(code&&typeof state!=='undefined'){
        const t=travelers();
        const oldSuffix=`${t.adults}${t.children?String(t.children):''}`;
        if(code.endsWith(oldSuffix)){
          const newSuffix=t.infants>0?`${t.adults}${t.children}${t.infants}`:(t.children>0?`${t.adults}${t.children}`:`${t.adults}`);
          code=code.slice(0,-oldSuffix.length)+newSuffix;
          u.searchParams.set('flightSearch',code);
          next=u.pathname+u.search+u.hash;
        }
      }
    }catch(e){}
    return nativeReplace(stateObject,title,next);
  };
}

installFlightSearchPatch();
let tries=0;
const timer=setInterval(()=>{
  if(installPlannerPatch()||++tries>=40)clearInterval(timer);
},100);
installPlannerPatch();
})();

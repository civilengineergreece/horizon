(()=>{
'use strict';

const UNSURE='any';

function stateNow(){try{return typeof state!=='undefined'&&state?state:{};}catch{return {};}}
function saveNow(){try{if(typeof save==='function')save();}catch{}}
function stepByKey(key){try{return Array.isArray(steps)?steps.find(s=>s.key===key):null;}catch{return null;}}
function replaceOption(step,key,label,sub){
  if(!step||!Array.isArray(step.options))return;
  const i=step.options.findIndex(o=>o[0]===key);
  if(i>=0)step.options[i]=[key,label,sub];
  else step.options.push([key,label,sub]);
}
function patchSteps(){
  const style=stepByKey('style');
  replaceOption(style,'mixed','Δεν έχω αποφασίσει','Δείξε μου διαφορετικούς τύπους προορισμών');

  const stay=stepByKey('stay');
  replaceOption(stay,'any','Δεν έχω αποφασίσει','Δείξε όλες τις επιλογές διαμονής');

  const transport=stepByKey('transport');
  replaceOption(transport,'any','Δεν έχω αποφασίσει','Σύγκρινε όλους τους διαθέσιμους τρόπους');

  const interests=stepByKey('interests');
  replaceOption(interests,UNSURE,'Δεν γνωρίζω ακόμη','Δείξε μου ποικιλία και άφησε το Horizon να προτείνει');

  const st=stateNow();
  if(Array.isArray(st.interests)&&st.interests.includes(UNSURE)&&st.interests.length>1){
    st.interests=[UNSURE];saveNow();
  }
}
function patchBind(){
  if(window.__HZ_UNSURE_BIND__||typeof window.bindCurrent!=='function')return false;
  window.__HZ_UNSURE_BIND__=true;
  const base=window.bindCurrent;
  window.bindCurrent=function(){
    base();
    let step;try{step=steps?.[current];}catch{return;}
    if(step?.key!=='interests')return;
    document.querySelectorAll('[data-choice]').forEach(btn=>{
      btn.onclick=()=>{
        const val=btn.dataset.choice;
        let arr=Array.isArray(state.interests)?[...state.interests]:[];
        if(val===UNSURE)arr=[UNSURE];
        else{
          arr=arr.filter(x=>x!==UNSURE);
          arr.includes(val)?arr=arr.filter(x=>x!==val):arr.push(val);
        }
        state.interests=arr;
        saveNow();
        if(typeof render==='function')render();
      };
    });
  };
  return true;
}
function rerender(){try{if(typeof current==='number'&&typeof render==='function'&&['style','stay','transport','interests'].includes(steps?.[current]?.key))render();}catch{}}
function boot(){
  patchSteps();
  let tries=0;(function wait(){if(patchBind()){patchSteps();rerender();return;}if(++tries<40)setTimeout(wait,50);})();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

(()=>{
'use strict';
const OPTIONS=[
  ['plane','✈ Αεροπλάνο','Γρήγορα & μακριά'],
  ['train','🚆 Τρένο','Άνεση χωρίς οδήγηση'],
  ['bus','🚌 Λεωφορείο','Οικονομικές οδικές διαδρομές'],
  ['ferry','⛴ Πλοίο','Νησιά & ακτοπλοΐα'],
  ['car','🚗 ΙΧ','Ελευθερία & road trip'],
  ['any','Όλοι οι τρόποι','Δείξε κάθε διαθέσιμη επιλογή']
];
function getState(){try{return typeof state!=='undefined'&&state?state:null;}catch{return null;}}
function normalize(){
  const st=getState();if(!st)return;
  let arr=Array.isArray(st.transport)?[...st.transport]:(st.transport?[st.transport]:['any']);
  arr=[...new Set(arr)].filter(x=>['plane','train','bus','ferry','car','any'].includes(x));
  if(!arr.length)arr=['any'];
  if(arr.includes('any')&&arr.length>1)arr=['any'];
  st.transport=arr;
  try{if(typeof save==='function')save();}catch{}
}
function patchStep(){
  try{
    if(typeof steps==='undefined'||!Array.isArray(steps))return false;
    const s=steps.find(x=>x.key==='transport');if(!s)return false;
    s.multi=true;
    s.hint='Με ποιους τρόπους θα ήθελες να ταξιδέψεις;';
    s.options=OPTIONS;
    normalize();
    return true;
  }catch{return false;}
}
function addNote(){
  try{
    if(typeof current==='undefined'||typeof steps==='undefined'||steps[current]?.key!=='transport')return;
    const choices=document.querySelector('#questionCard .choices');if(!choices||document.querySelector('#transportMultiNote'))return;
    const n=document.createElement('div');n.id='transportMultiNote';n.className='tiny muted';n.style.marginTop='10px';
    n.textContent='Μπορείς να επιλέξεις περισσότερους από έναν τρόπους μετακίνησης.';
    choices.after(n);
  }catch{}
}
function rerenderIfNeeded(){
  try{
    if(typeof current==='number'&&typeof steps!=='undefined'&&steps[current]?.key==='transport'&&typeof render==='function'){
      render();setTimeout(addNote,0);
    }
  }catch{}
}
function patchClicks(){
  if(window.__HZ_TRANSPORT_MULTI_CLICK_FIX__)return;window.__HZ_TRANSPORT_MULTI_CLICK_FIX__=true;
  document.addEventListener('click',e=>{
    const b=e.target.closest('#questionCard [data-choice]');if(!b)return;
    try{
      if(typeof current==='undefined'||typeof steps==='undefined'||steps[current]?.key!=='transport')return;
      e.preventDefault();e.stopImmediatePropagation();
      const st=getState();if(!st)return;
      const val=b.dataset.choice;let arr=Array.isArray(st.transport)?[...st.transport]:[];
      if(val==='any')arr=['any'];
      else{
        arr=arr.filter(x=>x!=='any');
        arr.includes(val)?arr=arr.filter(x=>x!==val):arr.push(val);
        if(!arr.length)arr=['any'];
      }
      st.transport=arr;
      try{if(typeof save==='function')save();}catch{}
      if(typeof render==='function')render();
      setTimeout(addNote,0);
    }catch{}
  },true);
}
function boot(){
  patchClicks();
  let tries=0;
  const tick=()=>{
    if(patchStep()){
      rerenderIfNeeded();
      setTimeout(addNote,0);
      return;
    }
    if(++tries<80)setTimeout(tick,50);
  };
  tick();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

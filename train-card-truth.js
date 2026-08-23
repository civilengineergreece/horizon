(()=>{
'use strict';

const TRAIN={
  'Θεσσαλονίκη':{adultRT:80,hours:5.0},
  'Μετέωρα':{adultRT:55,hours:4.8}
};
const RANGE=.08;

function stateNow(){try{return typeof state!=='undefined'&&state?state:{};}catch{return {};}}
function selected(){const v=stateNow().transport;return Array.isArray(v)?v:[v||'any'];}
function trainOnly(){const s=selected().filter(x=>x!=='any');return s.length===1&&s[0]==='train';}
function peopleWeight(){const t=stateNow().travelers||{};return Math.max(1,Number(t.adults)||1)+Math.max(0,Number(t.children)||0)*.55+Math.max(0,Number(t.infants)||0)*.05;}
function round5(n){return Math.max(5,Math.round(Number(n||0)/5)*5);}
function estimate(name){const p=TRAIN[name];if(!p)return null;const center=round5(p.adultRT*peopleWeight()),low=round5(center*(1-RANGE)),high=Math.max(low+5,round5(center*(1+RANGE)));return {center,low,high,hours:p.hours};}
function euro(n){return `€${Math.round(Number(n)||0).toLocaleString('el-GR')}`;}
function resultByName(name){try{return Array.isArray(scored)?scored.find(x=>x.name===name):null;}catch{return null;}}
function fixData(name,x){
  const r=resultByName(name);if(!r)return null;
  const old=Number(r.transport)||0,base=Number(r.total)||0,without=Math.max(0,base-old);
  r.transport=x.center;
  r.total=without+x.center;
  r.remaining=(Number(stateNow().budget?.amount)||0)-r.total;
  r.transportMode='train';
  r.travelHours=x.hours;
  r.transportDetails={mode:'train',cost:x.center,rawCost:x.center,hours:x.hours,label:'Εκτίμηση τιμής',note:`περ. ${euro(x.low)}–${euro(x.high)} · live δρομολόγιο μέσω Transitous`};
  return r;
}
function fixCard(card){
  const name=card.querySelector('h4')?.textContent?.trim();if(!TRAIN[name])return;
  const r=resultByName(name);if(!trainOnly()&&r?.transportMode!=='train')return;
  const x=estimate(name);if(!x)return;
  const data=fixData(name,x)||r;
  const breaks=[...card.querySelectorAll('.break')];
  const transport=breaks.find(b=>/μεταφορ/i.test(b.querySelector('span')?.textContent||''));
  if(transport){
    const label=transport.querySelector('span'),value=transport.querySelector('b');
    if(label)label.textContent='Εκτίμηση μεταφοράς με τρένο';
    if(value)value.textContent=`~${euro(x.center)}`;
    transport.querySelectorAll('.hz-card-est-note,small').forEach(n=>n.remove());
    const note=document.createElement('small');note.className='hz-card-est-note';note.style.cssText='display:block;color:#8fa0ac;margin-top:4px;font-size:.66rem;line-height:1.4';note.textContent=`περ. ${euro(x.low)}–${euro(x.high)} μετ’ επιστροφής · η τιμή είναι εκτίμηση, το δρομολόγιο ελέγχεται live μέσω Transitous.`;transport.appendChild(note);
  }
  if(data){
    const total=card.querySelector('.cost');if(total)total.innerHTML=`~${euro(data.total)} <span>ενδεικτικό budget model · όχι live</span>`;
    const rem=card.querySelector('.cost-head .tiny');if(rem){const d=(Number(stateNow().budget?.amount)||0)-Number(data.total||0);rem.dataset.truth='1';rem.textContent=d>=0?`Ενδεικτικά: Μένουν ${euro(d)}`:`Ενδεικτικά: +${euro(Math.abs(d))} πάνω από budget`;}
  }
}
function patch(){if(!selected().includes('train'))return;document.querySelectorAll('#resultsCard .destination').forEach(fixCard);}
function install(){
  if(window.__HZ_TRAIN_CARD_TRUTH__)return;window.__HZ_TRAIN_CARD_TRUTH__=true;
  if(typeof window.renderResults==='function'){
    const base=window.renderResults;window.renderResults=function(...args){const out=base.apply(this,args);setTimeout(patch,0);setTimeout(patch,120);return out;};
  }
  document.addEventListener('click',()=>setTimeout(patch,80),true);
  setTimeout(patch,0);setTimeout(patch,300);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

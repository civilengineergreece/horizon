(()=>{
'use strict';
const STYLE_ID='horizon-estimate-truth-style';
function installStyles(){if(document.getElementById(STYLE_ID))return;const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`.hz-estimate-warning{margin:14px 0 18px;padding:12px 14px;border:1px solid rgba(255,122,22,.34);border-radius:13px;background:rgba(255,122,22,.09);color:#ffd2ad;font-size:.84rem;line-height:1.5}.hz-estimate-warning b{color:#fff}.hz-live-action{border-color:rgba(101,211,154,.35)!important}`;document.head.appendChild(s);}
function patch(){
  const root=document.getElementById('resultsCard');if(!root||root.classList.contains('hidden'))return;
  const intro=[...root.querySelectorAll('p.muted')][0];
  if(intro&&!root.querySelector('.hz-estimate-warning')){
    const w=document.createElement('div');w.className='hz-estimate-warning';w.innerHTML='<b>Σημαντικό:</b> τα ποσά στις κάρτες είναι μοντέλο προϋπολογισμού για την κατάταξη των προορισμών — δεν είναι πραγματικές τρέχουσες τιμές. Οι πραγματικές τιμές εμφανίζονται μέσα στο Horizon όταν ανοίξεις <b>Live διαμονή</b> ή <b>Live μεταφορά</b>.';intro.after(w);
  }
  const sort=document.getElementById('sortResults');if(sort){const o=[...sort.options].find(x=>x.value==='cheap');if(o)o.textContent='Χαμηλότερη εκτίμηση';}
  root.querySelectorAll('.destination').forEach(card=>{
    const cost=card.querySelector('.cost span');if(cost)cost.textContent='ενδεικτικό budget model · όχι live';
    const remaining=card.querySelector('.cost-head .tiny');if(remaining&&!remaining.dataset.truth){remaining.dataset.truth='1';remaining.textContent=`Ενδεικτικά: ${remaining.textContent}`;}
    const labels=[...card.querySelectorAll('.break span')];
    labels.forEach(el=>{const t=el.textContent.trim();if(!/^Εκτίμηση /.test(t))el.textContent=`Εκτίμηση ${t.toLowerCase()}`;});
    card.querySelectorAll('.actions a').forEach(a=>{
      const t=a.textContent.trim().toLowerCase();
      if(t.includes('διαμον')){a.textContent='Live διαμονή';a.classList.add('hz-live-action');}
      else if(t.includes('μεταφορ')){a.textContent='Live μεταφορά';a.classList.add('hz-live-action');}
    });
  });
}
function install(){installStyles();if(window.__HORIZON_RESULTS_TRUTH__){patch();return true;}if(typeof window.renderResults!=='function')return false;window.__HORIZON_RESULTS_TRUTH__=true;const base=window.renderResults;window.renderResults=function(){const out=base.apply(this,arguments);queueMicrotask(patch);return out;};patch();setTimeout(patch,0);return true;}
let tries=0;(function boot(){if(install())return;if(++tries<40)setTimeout(boot,50);})();
})();

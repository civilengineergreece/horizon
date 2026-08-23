(()=>{
'use strict';
const STYLE_ID='horizon-live-transport-cta-style';
function styles(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
  .hz-live-cta-kicker{display:flex;align-items:center;gap:8px;margin:0 0 7px;font-size:.68rem;font-weight:950;letter-spacing:.08em;text-transform:uppercase}
  .hz-live-cta-kicker.flight{color:#ffb46f}.hz-live-cta-kicker.train{color:#83d8ff}
  .hz-live-pill{display:inline-flex;align-items:center;border-radius:999px;padding:3px 7px;font-size:.6rem;font-weight:950;letter-spacing:.04em;white-space:nowrap}
  .hz-live-pill.flight{background:rgba(255,122,22,.16);border:1px solid rgba(255,122,22,.45);color:#ffc18f}
  .hz-live-pill.train{background:rgba(64,177,255,.13);border:1px solid rgba(64,177,255,.4);color:#a8ddff}
  .hz-flights-panel.hz-live-flight-box{border-color:rgba(255,122,22,.58);background:linear-gradient(180deg,rgba(255,122,22,.075),rgba(5,16,26,.55));box-shadow:0 0 0 1px rgba(255,122,22,.06),0 14px 34px rgba(0,0,0,.14)}
  .hz-live-flight-box .hz-flights-title{font-size:1.02rem;color:#fff}
  .hz-live-flight-box .hz-flight-search{position:relative;min-height:52px;padding:13px 116px 13px 15px;text-align:left;background:linear-gradient(180deg,#ff8b29,#e25f08);box-shadow:0 10px 24px rgba(255,122,22,.18);font-size:.86rem}
  .hz-live-flight-box .hz-flight-search:after{content:'LIVE ΤΙΜΕΣ';position:absolute;right:12px;top:50%;transform:translateY(-50%);padding:4px 8px;border-radius:999px;background:rgba(6,17,28,.28);border:1px solid rgba(255,255,255,.25);font-size:.58rem;letter-spacing:.05em}
  .hz-live-train-box{border-color:rgba(64,177,255,.34)!important;background:linear-gradient(180deg,rgba(64,177,255,.055),rgba(5,16,26,.34))!important}
  .hz-live-train-box .hz-surface-head{font-size:1rem;color:#fff}
  .hz-live-train-box [data-surface="train"]{position:relative;min-height:54px;min-width:min(100%,420px);padding:12px 150px 12px 14px;text-align:left;border-color:rgba(64,177,255,.58)!important;background:linear-gradient(180deg,#12334a,#0b2436)!important;box-shadow:0 8px 22px rgba(20,120,180,.12);font-size:.84rem}
  .hz-live-train-box [data-surface="train"]:after{content:'LIVE ΔΡΟΜΟΛΟΓΙΑ';position:absolute;right:11px;top:50%;transform:translateY(-50%);padding:4px 7px;border-radius:999px;background:rgba(64,177,255,.11);border:1px solid rgba(123,211,255,.35);color:#a8ddff;font-size:.56rem;letter-spacing:.035em}
  .hz-live-cta-sub{margin-top:6px;color:#8fa6b6;font-size:.68rem;line-height:1.4}
  .hz-live-found{margin:10px 0 0;padding:8px 10px;border-radius:10px;font-size:.7rem;font-weight:800}
  .hz-live-found.flight{background:rgba(255,122,22,.07);color:#ffc18f;border:1px solid rgba(255,122,22,.2)}
  .hz-live-found.train{background:rgba(64,177,255,.07);color:#a8ddff;border:1px solid rgba(64,177,255,.2)}
  @media(max-width:620px){
    .hz-live-flight-box .hz-flight-search{padding-right:105px}
    .hz-live-train-box [data-surface="train"]{width:100%;min-width:0;padding-right:135px}
  }
  `;document.head.appendChild(s);
}
function patchFlight(){
  document.querySelectorAll('.horizon-detail-overlay .hz-flights-panel').forEach(panel=>{
    panel.classList.add('hz-live-flight-box');
    const title=panel.querySelector('.hz-flights-title');if(title)title.textContent='Ζωντανός έλεγχος πτήσεων';
    if(!panel.querySelector('.hz-live-cta-kicker.flight')){
      const k=document.createElement('div');k.className='hz-live-cta-kicker flight';k.innerHTML='✈ ΠΤΗΣΕΙΣ <span class="hz-live-pill flight">LIVE ΤΙΜΕΣ</span>';panel.prepend(k);
    }
    const copy=panel.querySelector('.hz-flights-copy');if(copy)copy.textContent='Δες πραγματικές τιμές Google Flights για τις ημερομηνίες και τους ταξιδιώτες σου. Η χαμηλότερη live τιμή ενημερώνει αυτόματα και τη σύγκριση.';
    const btn=panel.querySelector('.hz-flight-search');
    if(btn&&!btn.disabled&&!/Αναζήτηση/.test(btn.textContent||''))btn.textContent='✈ Έλεγχος πραγματικών τιμών πτήσεων';
    else if(btn&&!btn.disabled&&/Αναζήτηση live πτήσεων/.test(btn.textContent||''))btn.textContent='✈ Έλεγχος πραγματικών τιμών πτήσεων';
    if(btn&&!panel.querySelector('.hz-live-cta-sub.flight')){
      const sub=document.createElement('div');sub.className='hz-live-cta-sub flight';sub.textContent='Google Flights · πραγματικές τιμές για τις ημερομηνίες σου';btn.after(sub);
    }
    const status=panel.querySelector('.hz-flight-status');
    const m=(status?.textContent||'').match(/^(\d+) live επιλογές/);
    if(m){status.textContent=`✓ Βρέθηκαν ${m[1]} live επιλογές πτήσεων.`;status.classList.add('hz-live-found','flight');}
  });
}
function patchTrain(){
  document.querySelectorAll('.horizon-detail-overlay .hz-surface-live').forEach(box=>{
    const btn=box.querySelector('[data-surface="train"]');if(!btn)return;
    box.classList.add('hz-live-train-box');
    const head=box.querySelector('.hz-surface-head');if(head)head.textContent='Ζωντανός έλεγχος μεταφοράς';
    if(!box.querySelector('.hz-live-cta-kicker.train')){
      const k=document.createElement('div');k.className='hz-live-cta-kicker train';k.innerHTML='🚆 ΤΡΕΝΑ <span class="hz-live-pill train">LIVE ΔΡΟΜΟΛΟΓΙΑ</span>';box.prepend(k);
    }
    if(!btn.disabled)btn.textContent='🚆 Έλεγχος πραγματικών δρομολογίων τρένων';
    if(!box.querySelector('.hz-live-cta-sub.train')){
      const sub=document.createElement('div');sub.className='hz-live-cta-sub train';sub.textContent='Transitous / MOTIS · πραγματικές ώρες, διάρκεια και realtime ενημέρωση όπου υπάρχει';btn.after(sub);
    }
    if(box.dataset.liveMode==='train'){
      const count=box.querySelectorAll('.hz-surface-results .hz-surface-card').length;
      let found=box.querySelector('.hz-live-found.train');
      if(count){if(!found){found=document.createElement('div');found.className='hz-live-found train';box.querySelector('.hz-surface-actions')?.after(found);}if(found)found.textContent=`✓ Βρέθηκαν ${count} live δρομολόγια τρένων.`;}
    }
  });
}
function patch(){styles();patchFlight();patchTrain();}
function burst(){[0,80,220,600].forEach(ms=>setTimeout(patch,ms));}
function install(){
  styles();
  document.addEventListener('click',e=>{
    const train=e.target.closest('[data-surface="train"]');if(train){const box=train.closest('.hz-surface-live');if(box)box.dataset.liveMode='train';}
    burst();
  },true);
  document.addEventListener('horizon:live-flight-price',burst);
  document.addEventListener('horizon:live-train-price',burst);
  burst();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

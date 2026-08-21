(()=>{
'use strict';

const STYLE_ID='horizon-calendar-duration-style';
const MONTHS=['Ιανουάριος','Φεβρουάριος','Μάρτιος','Απρίλιος','Μάιος','Ιούνιος','Ιούλιος','Αύγουστος','Σεπτέμβριος','Οκτώβριος','Νοέμβριος','Δεκέμβριος'];
const WEEK=['Δε','Τρ','Τε','Πε','Πα','Σα','Κυ'];

function ensureStyles(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
  .hz-native-hidden{position:absolute!important;left:-9999px!important;width:1px!important;height:1px!important;overflow:hidden!important;opacity:0!important;pointer-events:none!important}
  .hz-date-wrap,.hz-duration-wrap{margin:20px 0 10px}
  .hz-calendar{border:1px solid rgba(255,255,255,.11);border-radius:18px;background:linear-gradient(180deg,#0a1b2a,#081724);padding:18px;max-width:650px}
  .hz-cal-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:15px}.hz-cal-title{font-weight:900;font-size:1.08rem}.hz-cal-nav{width:38px;height:38px;border-radius:10px;border:1px solid rgba(255,255,255,.11);background:#0d2030;color:white;cursor:pointer;font-size:1.15rem}.hz-cal-nav:disabled{opacity:.3;cursor:not-allowed}
  .hz-week,.hz-days{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}.hz-week{margin-bottom:6px;color:#8398a8;font-size:.72rem;text-align:center;font-weight:800}.hz-day{min-height:46px;border:1px solid transparent;border-radius:10px;background:transparent;color:#dfe7ec;cursor:pointer;position:relative;font-weight:750}.hz-day:hover:not(:disabled){border-color:rgba(255,122,22,.45);background:rgba(255,122,22,.07)}.hz-day:disabled{opacity:.22;cursor:not-allowed}.hz-day.empty{visibility:hidden}.hz-day.in-flex{background:rgba(255,122,22,.09);border-color:rgba(255,122,22,.12)}.hz-day.selected{background:linear-gradient(180deg,#ff8d2e,#df5d08);border-color:#ff9d4d;color:white;box-shadow:0 7px 18px rgba(255,122,22,.25)}.hz-day.today:after{content:'';position:absolute;width:4px;height:4px;border-radius:50%;background:#65d39a;left:50%;bottom:4px;transform:translateX(-50%)}
  .hz-flex{margin-top:17px}.hz-flex-title{font-size:.82rem;color:#a9b5c0;margin-bottom:9px}.hz-flex-row{display:flex;gap:8px;flex-wrap:wrap}.hz-flex-btn,.hz-duration-btn{border:1px solid rgba(255,255,255,.11);background:#0d2030;color:#dfe7ec;border-radius:11px;padding:9px 12px;cursor:pointer;font-weight:800}.hz-flex-btn.active,.hz-duration-btn.active{border-color:#ff7a16;background:rgba(255,122,22,.13);color:white}
  .hz-date-summary,.hz-duration-summary{margin-top:14px;padding:12px 14px;border-radius:12px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07);color:#b7c5ce;font-size:.86rem}.hz-date-summary b,.hz-duration-summary b{color:white}
  .hz-duration-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px;margin-bottom:14px}.hz-duration-btn{min-height:62px;padding:8px}.hz-duration-btn strong{display:block;font-size:1.05rem}.hz-duration-btn span{display:block;color:#8fa1ae;font-size:.72rem;font-weight:600}.hz-duration-custom{display:grid;grid-template-columns:1fr;max-width:300px}.hz-duration-custom label{font-size:.8rem;color:#a9b5c0;margin:0 0 7px 2px}
  @media(max-width:720px){.hz-calendar{padding:13px}.hz-day{min-height:42px}.hz-duration-grid{grid-template-columns:repeat(4,1fr)}}
  @media(max-width:460px){.hz-week,.hz-days{gap:3px}.hz-day{min-height:39px;font-size:.82rem}.hz-flex-btn{flex:1 1 calc(50% - 8px)}.hz-duration-grid{grid-template-columns:repeat(3,1fr)}}
  `;
  document.head.appendChild(style);
}

function localDateFromISO(iso){
  if(!iso)return null;
  const [y,m,d]=iso.split('-').map(Number);
  if(!y||!m||!d)return null;
  return new Date(y,m-1,d,12,0,0,0);
}
function isoLocal(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function startDay(d){const x=new Date(d);x.setHours(12,0,0,0);return x;}
function addDays(d,n){const x=startDay(d);x.setDate(x.getDate()+n);return x;}
function sameDay(a,b){return !!a&&!!b&&a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();}
function fmt(d){return d.toLocaleDateString('el-GR',{day:'numeric',month:'short',year:'numeric'});}
function diffDays(a,b){return Math.round((startDay(a)-startDay(b))/86400000);}

function enhanceDateStep(){
  if(typeof current==='undefined'||current!==1)return;
  const card=document.getElementById('questionCard');
  const input=card?.querySelector('#dateFrom');
  const flexSelect=card?.querySelector('#dateFlex');
  if(!card||!input||!flexSelect||card.querySelector('.hz-date-wrap'))return;
  ensureStyles();

  const nativeFields=input.closest('.fields');
  if(nativeFields)nativeFields.classList.add('hz-native-hidden');
  const nativeNote=[...card.querySelectorAll('.tiny.muted')].find(x=>x.textContent.includes('επιστροφή'));
  if(nativeNote)nativeNote.classList.add('hz-native-hidden');

  const today=startDay(new Date());
  let selected=localDateFromISO(input.value);
  let view=selected?new Date(selected.getFullYear(),selected.getMonth(),1,12):new Date(today.getFullYear(),today.getMonth(),1,12);
  let flex=Math.max(0,Math.min(3,Number(flexSelect.value)||0));

  const wrap=document.createElement('div');
  wrap.className='hz-date-wrap';
  wrap.innerHTML=`<div class="hz-calendar"><div class="hz-cal-head"><button type="button" class="hz-cal-nav" data-prev aria-label="Προηγούμενος μήνας">‹</button><div class="hz-cal-title"></div><button type="button" class="hz-cal-nav" data-next aria-label="Επόμενος μήνας">›</button></div><div class="hz-week">${WEEK.map(x=>`<div>${x}</div>`).join('')}</div><div class="hz-days"></div><div class="hz-flex"><div class="hz-flex-title">Πόσο ευέλικτος είσαι στην αναχώρηση;</div><div class="hz-flex-row">${[[0,'Ακριβής'],[1,'±1 ημέρα'],[2,'±2 ημέρες'],[3,'±3 ημέρες']].map(([n,t])=>`<button type="button" class="hz-flex-btn" data-flex="${n}">${t}</button>`).join('')}</div></div><div class="hz-date-summary"></div></div>`;
  const error=card.querySelector('#error');
  card.insertBefore(wrap,error);

  const title=wrap.querySelector('.hz-cal-title'),daysBox=wrap.querySelector('.hz-days'),summary=wrap.querySelector('.hz-date-summary'),prev=wrap.querySelector('[data-prev]');
  const duration=Math.max(0,Number(state?.duration)||0);

  function renderSummary(){
    if(!selected){summary.innerHTML='Επίλεξε την <b>ιδανική ημερομηνία αναχώρησης</b>.';return;}
    let html=`Ιδανική αναχώρηση: <b>${fmt(selected)}</b>`;
    if(flex)html+=` · διαθέσιμο παράθυρο <b>${fmt(addDays(selected,-flex))} – ${fmt(addDays(selected,flex))}</b>`;
    if(duration>=2){const ret=addDays(selected,duration-1);html+=`<br>Με ${duration} ημέρες ταξιδιού, ενδεικτική επιστροφή: <b>${fmt(ret)}</b>`;}
    summary.innerHTML=html;
  }
  function renderCal(){
    title.textContent=`${MONTHS[view.getMonth()]} ${view.getFullYear()}`;
    const first=new Date(view.getFullYear(),view.getMonth(),1,12),last=new Date(view.getFullYear(),view.getMonth()+1,0,12);
    const offset=(first.getDay()+6)%7;
    const cells=[];
    for(let i=0;i<offset;i++)cells.push('<button type="button" class="hz-day empty" tabindex="-1"></button>');
    for(let day=1;day<=last.getDate();day++){
      const d=new Date(view.getFullYear(),view.getMonth(),day,12);
      const past=d<today;
      const sel=sameDay(d,selected);
      const within=selected&&flex>0&&Math.abs(diffDays(d,selected))<=flex&&!sel;
      const cls=['hz-day',sel?'selected':'',within?'in-flex':'',sameDay(d,today)?'today':''].filter(Boolean).join(' ');
      cells.push(`<button type="button" class="${cls}" data-date="${isoLocal(d)}" ${past?'disabled':''}>${day}</button>`);
    }
    daysBox.innerHTML=cells.join('');
    daysBox.querySelectorAll('[data-date]').forEach(btn=>btn.onclick=()=>{selected=localDateFromISO(btn.dataset.date);input.value=btn.dataset.date;input.dispatchEvent(new Event('change',{bubbles:true}));renderCal();renderSummary();});
    wrap.querySelectorAll('[data-flex]').forEach(btn=>btn.classList.toggle('active',Number(btn.dataset.flex)===flex));
    prev.disabled=view.getFullYear()===today.getFullYear()&&view.getMonth()===today.getMonth();
  }
  prev.onclick=()=>{const n=new Date(view.getFullYear(),view.getMonth()-1,1,12);if(n>=new Date(today.getFullYear(),today.getMonth(),1,12)){view=n;renderCal();}};
  wrap.querySelector('[data-next]').onclick=()=>{view=new Date(view.getFullYear(),view.getMonth()+1,1,12);renderCal();};
  wrap.querySelectorAll('[data-flex]').forEach(btn=>btn.onclick=()=>{flex=Number(btn.dataset.flex);flexSelect.value=String(flex);flexSelect.dispatchEvent(new Event('change',{bubbles:true}));renderCal();renderSummary();});
  renderCal();renderSummary();
}

function enhanceDurationStep(){
  if(typeof current==='undefined'||current!==2)return;
  const card=document.getElementById('questionCard');
  const input=card?.querySelector('#value');
  if(!card||!input||card.querySelector('.hz-duration-wrap'))return;
  ensureStyles();

  const nativeFields=input.closest('.fields');
  if(nativeFields)nativeFields.classList.add('hz-native-hidden');
  const wrap=document.createElement('div');
  wrap.className='hz-duration-wrap';
  const presets=[2,3,4,5,7,10,14];
  wrap.innerHTML=`<div class="hz-duration-grid">${presets.map(n=>`<button type="button" class="hz-duration-btn" data-duration="${n}"><strong>${n}</strong><span>${n===1?'ημέρα':'ημέρες'}</span></button>`).join('')}</div><div class="hz-duration-custom"><label for="hzDurationCustom">Άλλη διάρκεια</label><input class="control" id="hzDurationCustom" type="number" min="2" max="30" value="${input.value||''}" placeholder="2–30 ημέρες"></div><div class="hz-duration-summary"></div>`;
  const error=card.querySelector('#error');
  card.insertBefore(wrap,error);
  const custom=wrap.querySelector('#hzDurationCustom'),summary=wrap.querySelector('.hz-duration-summary');

  function update(v){
    const n=Number(v);
    if(Number.isFinite(n)&&n>=2&&n<=30){input.value=String(n);custom.value=String(n);}
    wrap.querySelectorAll('[data-duration]').forEach(b=>b.classList.toggle('active',Number(b.dataset.duration)===n));
    const dep=localDateFromISO(state?.dates?.from);
    if(dep&&n>=2&&n<=30){
      const ret=addDays(dep,n-1),flex=Math.max(0,Math.min(3,Number(state?.dates?.flex)||0));
      let html=`Αν φύγεις <b>${fmt(dep)}</b>, επιστρέφεις περίπου <b>${fmt(ret)}</b>.`;
      if(flex)html+=` Με ευελιξία ±${flex}, μετακινείται αντίστοιχα και η επιστροφή.`;
      summary.innerHTML=html;
    }else summary.innerHTML='Διάλεξε πόσες ημέρες θέλεις να λείψεις.';
  }
  wrap.querySelectorAll('[data-duration]').forEach(btn=>btn.onclick=()=>update(Number(btn.dataset.duration)));
  custom.addEventListener('input',()=>{const n=Number(custom.value);input.value=custom.value;wrap.querySelectorAll('[data-duration]').forEach(b=>b.classList.toggle('active',Number(b.dataset.duration)===n));update(n);});
  update(Number(input.value)||0);
}

function enhance(){enhanceDateStep();enhanceDurationStep();}

window.addEventListener('DOMContentLoaded',()=>{
  ensureStyles();
  if(typeof window.render==='function'){
    const base=window.render;
    window.render=function(){base();setTimeout(enhance,0);};
  }
  setTimeout(enhance,0);
});
})();

(()=>{
'use strict';
const STYLE_ID='horizon-trip-prefill-style';
function installStyles(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
  .hz-auto-trip{display:flex;justify-content:space-between;gap:12px;align-items:center;margin:10px 0 14px;padding:11px 12px;border:1px solid rgba(101,211,154,.24);border-radius:12px;background:rgba(101,211,154,.07)}
  .hz-auto-trip-copy{min-width:0}.hz-auto-trip-kicker{color:#80ddb0;font-size:.69rem;font-weight:900;text-transform:uppercase;letter-spacing:.04em}.hz-auto-trip-main{color:#e8f1f5;font-size:.79rem;line-height:1.45;margin-top:2px}
  .hz-auto-trip-edit{flex:0 0 auto;border:1px solid rgba(255,255,255,.13);background:#0b1d2b;color:#fff;border-radius:9px;padding:7px 9px;font-size:.72rem;font-weight:850;cursor:pointer}
  .hz-flight-field.hz-prefill-hidden{display:none}.hz-flights-panel .hz-flights-title,.hz-hotels-panel h4{letter-spacing:0}
  @media(max-width:620px){.hz-auto-trip{align-items:flex-start;flex-direction:column}.hz-auto-trip-edit{width:100%}}
  `;document.head.appendChild(s);
}
function stateNow(){try{return typeof state!=='undefined'&&state?state:{};}catch{return {};}}
function parseISO(iso){const m=String(iso||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?new Date(Number(m[1]),Number(m[2])-1,Number(m[3]),12):null;}
function pretty(iso){const d=parseISO(iso);return d?d.toLocaleDateString('el-GR',{day:'numeric',month:'short',year:'numeric'}):'—';}
function addDays(iso,n){const d=parseISO(iso);if(!d)return '';d.setDate(d.getDate()+n);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function tripData(name){
  const s=stateNow(),t=s.travelers||{},days=Math.max(1,Number(s.duration)||1),from=s.dates?.from||'',to=from?addDays(from,Math.max(0,days-1)):'';
  return {name,origin:s.origin||'Αθήνα',from,to,adults:Math.max(1,Number(t.adults)||1),children:Math.max(0,Number(t.children)||0),infants:Math.max(0,Number(t.infants)||0)};
}
function peopleText(t){const p=[`${t.adults} ${t.adults===1?'ενήλικας':'ενήλικες'}`];if(t.children)p.push(`${t.children} ${t.children===1?'παιδί':'παιδιά'}`);if(t.infants)p.push(`${t.infants} ${t.infants===1?'βρέφος':'βρέφη'}`);return p.join(' · ');}
function lineFor(t,kind){const route=kind==='flight'?`${t.origin} → ${t.name}`:t.name;return `${route} · ${pretty(t.from)} → ${pretty(t.to)} · ${peopleText(t)}`;}
function supportsPlane(name){const d=(window.HORIZON_DESTINATIONS||[]).find(x=>x.name===name);return !!d?.transport?.includes?.('plane');}
function editPlanner(){
  document.querySelector('.horizon-detail-overlay')?.remove();
  const btn=document.getElementById('editBtn');if(btn){btn.click();setTimeout(()=>document.getElementById('planner')?.scrollIntoView({behavior:'smooth',block:'start'}),30);}
}
function summaryBox(t,kind,onEdit){
  const box=document.createElement('div');box.className='hz-auto-trip';
  box.innerHTML=`<div class="hz-auto-trip-copy"><div class="hz-auto-trip-kicker">✓ Αυτόματα από τις απαντήσεις σου</div><div class="hz-auto-trip-main"></div></div><button type="button" class="hz-auto-trip-edit">Αλλαγή</button>`;
  const render=()=>{box.querySelector('.hz-auto-trip-main').textContent=lineFor(t,kind);};render();
  box.querySelector('.hz-auto-trip-edit').addEventListener('click',onEdit);return {box,render};
}
function patchFlight(panel){
  if(!panel)return;const overlay=panel.closest('.horizon-detail-overlay'),name=overlay?.querySelector('.hd-head h3')?.textContent?.trim()||'';if(!name)return;
  const title=panel.querySelector('.hz-flights-title');if(title)title.textContent='Πραγματικές τιμές πτήσεων';
  const copy=panel.querySelector('.hz-flights-copy');if(copy)copy.textContent='Το Horizon έχει ήδη περάσει αφετηρία, ημερομηνίες και ταξιδιώτες από το ταξίδι σου. Πατάς μόνο έλεγχο τιμών.';
  const btn=panel.querySelector('.hz-flight-search');if(btn&&!btn.disabled)btn.textContent='Έλεγχος πραγματικών τιμών';
  if(panel.dataset.prefillUi==='1')return;panel.dataset.prefillUi='1';
  const from=panel.querySelector('.hz-flight-from'),to=panel.querySelector('.hz-flight-to'),t=tripData(name);if(from?.value)t.from=from.value;if(to?.value)t.to=to.value;
  const fields=[...panel.querySelectorAll('.hz-flight-field')];fields.forEach(x=>x.classList.add('hz-prefill-hidden'));
  const {box,render}=summaryBox(t,'flight',()=>{
    const hidden=fields.every(x=>x.classList.contains('hz-prefill-hidden'));fields.forEach(x=>x.classList.toggle('hz-prefill-hidden',!hidden));
    box.querySelector('.hz-auto-trip-edit').textContent=hidden?'Κλείσιμο αλλαγών':'Αλλαγή';
  });
  copy?.after(box);
  from?.addEventListener('change',()=>{t.from=from.value;render();});to?.addEventListener('change',()=>{t.to=to.value;render();});
  btn?.addEventListener('click',()=>{[150,800,2500,6000].forEach(ms=>setTimeout(()=>{if(btn&&!btn.disabled)btn.textContent='Έλεγχος πραγματικών τιμών';},ms));});
}
function patchHotel(panel){
  if(!panel)return;const overlay=panel.closest('.horizon-detail-overlay'),name=overlay?.querySelector('.hd-head h3')?.textContent?.trim()||'';if(!name)return;
  const title=panel.querySelector('h4');if(title&&/live|τιμ/i.test(title.textContent))title.textContent='Πραγματικές τιμές διαμονής';
  const copy=panel.querySelector('.hz-hotels-copy');if(copy&&!/μονοήμερη/i.test(copy.textContent))copy.textContent='Το Horizon χρησιμοποιεί αυτόματα προορισμό, check-in/check-out και ταξιδιώτες από τις απαντήσεις σου. Δεν χρειάζεται να τα ξανασυμπληρώσεις.';
  if(panel.dataset.prefillUi==='1'||/μονοήμερη/i.test(copy?.textContent||''))return;panel.dataset.prefillUi='1';
  const t=tripData(name),{box}=summaryBox(t,'stay',editPlanner);copy?.after(box);
  const btn=panel.querySelector('.hz-stay-load');if(btn&&!btn.disabled)btn.textContent='Έλεγχος πραγματικών τιμών διαμονής';
}
function patchActions(){
  document.querySelectorAll('#resultsCard .destination').forEach(card=>{
    const name=card.querySelector('h4')?.textContent?.trim()||'';
    card.querySelectorAll('.actions a').forEach(a=>{
      const txt=(a.textContent||'').toLowerCase();
      if(txt.includes('live διαμον')||txt.includes('πραγματικ')&&txt.includes('διαμον'))a.textContent='Πραγματικές τιμές διαμονής';
      else if(txt.includes('live μεταφορ')||txt.includes('μεταφορά')&&supportsPlane(name))a.textContent=supportsPlane(name)?'Πραγματικές πτήσεις':'Μεταφορά';
    });
  });
}
function patchAll(){installStyles();patchActions();document.querySelectorAll('.hz-flights-panel').forEach(patchFlight);document.querySelectorAll('.hz-hotels-panel').forEach(patchHotel);}
function burst(){[0,60,180,450,900].forEach(ms=>setTimeout(patchAll,ms));}
function init(){patchAll();document.addEventListener('click',e=>{if(e.target.closest('.destination .actions a,.hd-tab,.hz-flight-search,.hz-stay-load'))burst();},true);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
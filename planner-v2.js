(()=>{
'use strict';
const STYLE_ID='horizon-planner-v2-style';
function editor(){return document.querySelector('.hz-itinerary-editor');}
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function num(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f;}
function parseCost(text){const m=String(text||'').match(/(\d+)\s*[–-]\s*€?(\d+)/);return m?{low:Number(m[1]),high:Number(m[2])}:{low:50,high:80};}
function key(ed){return `horizon-planner-v2:${ed?.dataset?.destination||'trip'}:${location.search||''}`;}
function load(ed){try{return JSON.parse(localStorage.getItem(key(ed))||'{}')||{};}catch{return {};}}
function save(ed){
  const data={days:[...ed.querySelectorAll('.hz-edit-day')].map((d,i)=>({day:i+1,low:num(d.querySelector('[data-hz-budget-low]')?.value),high:num(d.querySelector('[data-hz-budget-high]')?.value)}))};
  try{localStorage.setItem(key(ed),JSON.stringify(data));}catch{}
}
function mapUrl(ed,day=null){
  const d=ed?.dataset?.destination||'';let rows=[];
  if(day)rows=[...day.querySelectorAll('.hz-edit-row')];else rows=[...ed.querySelectorAll('.hz-edit-row')];
  const stops=rows.map(r=>String(r.querySelector('.hz-slot-text')?.value||'').trim()).filter(Boolean).filter(x=>!/^(Γεύμα|Πρωινό|Check|Μετάβαση|Ελεύθερος χρόνος)/i.test(x)).slice(0,10);
  const u=new URL('map.html',location.href);u.searchParams.set('d',d);u.searchParams.set('stops',stops.join('|'));return u.toString();
}
function ensureStyles(){
  if(document.getElementById(STYLE_ID))return;const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
  .hz-v2-summary{margin:14px 0;padding:14px;border:1px solid rgba(255,122,22,.24);border-radius:16px;background:linear-gradient(135deg,rgba(255,122,22,.07),rgba(58,153,255,.04))}.hz-v2-summary-title{font-weight:950;font-size:.92rem}.hz-v2-summary-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-top:10px}.hz-v2-kpi{padding:10px;border-radius:12px;background:#0a1d2b;border:1px solid rgba(255,255,255,.08)}.hz-v2-kpi b{display:block;font-size:1rem;color:#fff}.hz-v2-kpi span{display:block;font-size:.66rem;color:#91a4b2;margin-top:2px}.hz-v2-map-all{margin-top:10px;border:1px solid rgba(92,190,255,.35);background:#0b2536;color:#dff4ff;border-radius:10px;padding:9px 11px;font-weight:900;cursor:pointer}.hz-v2-tools{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:10px 0 2px;padding:9px;border-radius:11px;background:rgba(4,20,31,.55);border:1px solid rgba(255,255,255,.07)}.hz-v2-tools label{font-size:.66rem;color:#9fb0bd;display:flex;align-items:center;gap:5px}.hz-v2-tools input{width:72px;background:#081925;border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:7px 8px;color:#fff;font-weight:850}.hz-v2-map{margin-left:auto;border:1px solid rgba(92,190,255,.32);background:#0b2536;color:#e4f6ff;border-radius:9px;padding:7px 9px;font-weight:850;cursor:pointer;font-size:.7rem}.hz-v2-beta{font-size:.62rem;color:#7f94a2;margin-top:7px;line-height:1.45}@media(max-width:650px){.hz-v2-summary-grid{grid-template-columns:1fr}.hz-v2-map{margin-left:0}}
  `;document.head.appendChild(s);
}
function syncSummary(ed){
  const ds=[...ed.querySelectorAll('.hz-edit-day')].map(d=>({low:num(d.querySelector('[data-hz-budget-low]')?.value),high:num(d.querySelector('[data-hz-budget-high]')?.value)}));
  const low=ds.reduce((a,x)=>a+x.low,0),high=ds.reduce((a,x)=>a+x.high,0);const box=ed.querySelector('.hz-v2-summary');if(!box)return;box.querySelector('[data-v2-total]')?.replaceChildren(document.createTextNode(`€${low}–€${high}`));box.querySelector('[data-v2-average]')?.replaceChildren(document.createTextNode(ds.length?`€${Math.round(low/ds.length)}–€${Math.round(high/ds.length)}`:'—'));box.querySelector('[data-v2-days]')?.replaceChildren(document.createTextNode(String(ds.length)));
}
function augment(){
  ensureStyles();const ed=editor();if(!ed||ed.dataset.hzPlannerV2==='1')return;ed.dataset.hzPlannerV2='1';const saved=load(ed),intro=ed.querySelector('.hz-edit-intro');
  const summary=document.createElement('div');summary.className='hz-v2-summary';summary.innerHTML=`<div class="hz-v2-summary-title">Horizon Planner v2 · Budget & 3D χάρτης</div><div class="hz-v2-summary-grid"><div class="hz-v2-kpi"><b data-v2-days>—</b><span>ημέρες ταξιδιού</span></div><div class="hz-v2-kpi"><b data-v2-total>—</b><span>ενδεικτικό συνολικό ημερήσιο budget</span></div><div class="hz-v2-kpi"><b data-v2-average>—</b><span>μέσο budget / ημέρα</span></div></div><button type="button" class="hz-v2-map-all" data-v2-map-all>🗺️ Άνοιξε 3D χάρτη όλου του ταξιδιού</button><div class="hz-v2-beta">Ο 3D χάρτης είναι prototype χωρίς API key, με OpenStreetMap/OpenFreeMap. Η αυτόματη γεωκωδικοποίηση μπορεί να χρειαστεί λίγα δευτερόλεπτα.</div>`;intro?.after(summary);
  [...ed.querySelectorAll('.hz-edit-day')].forEach((day,i)=>{
    const base=parseCost(day.querySelector('.hz-edit-cost')?.textContent),sv=saved.days?.find(x=>x.day===i+1)||{};const low=num(sv.low,base.low),high=Math.max(low,num(sv.high,base.high));
    const tools=document.createElement('div');tools.className='hz-v2-tools';tools.innerHTML=`<label>Budget από € <input type="number" min="0" step="5" value="${low}" data-hz-budget-low></label><label>έως € <input type="number" min="0" step="5" value="${high}" data-hz-budget-high></label><button type="button" class="hz-v2-map" data-v2-map-day>🧭 3D χάρτης ημέρας</button>`;day.querySelector('.hz-edit-head')?.after(tools);
    const cost=day.querySelector('.hz-edit-cost');if(cost)cost.textContent=`€${low}–€${high}`;
  });syncSummary(ed);
}
function burst(){[0,100,280,700,1400].forEach(ms=>setTimeout(augment,ms));}
document.addEventListener('click',e=>{const ed=editor();if(!ed){burst();return;}const dayBtn=e.target.closest?.('[data-v2-map-day]');if(dayBtn){e.preventDefault();window.open(mapUrl(ed,dayBtn.closest('.hz-edit-day')),'_blank','noopener');return;}if(e.target.closest?.('[data-v2-map-all]')){e.preventDefault();window.open(mapUrl(ed),'_blank','noopener');return;}burst();},true);
document.addEventListener('input',e=>{const ed=e.target.closest?.('.hz-itinerary-editor');if(!ed)return;if(e.target.matches?.('[data-hz-budget-low],[data-hz-budget-high]')){const day=e.target.closest('.hz-edit-day'),lo=Math.max(0,num(day.querySelector('[data-hz-budget-low]')?.value)),hi=Math.max(lo,num(day.querySelector('[data-hz-budget-high]')?.value));day.querySelector('[data-hz-budget-low]').value=lo;day.querySelector('[data-hz-budget-high]').value=hi;const cost=day.querySelector('.hz-edit-cost');if(cost)cost.textContent=`€${lo}–€${hi}`;save(ed);syncSummary(ed);}},true);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',burst,{once:true});else burst();
})();

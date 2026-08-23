(()=>{
'use strict';
const STYLE_ID='horizon-itinerary-premium-style';
const PRICE='19,90€';
const DESTINATION_PLANS={
  'Θεσσαλονίκη':['Πλατεία Αριστοτέλους & παραλία','Λευκός Πύργος & Νέα Παραλία','Ροτόντα – Καμάρα – Ναυαρίνου','Άνω Πόλη & Κάστρα','Αγορά Μοδιάνο & Καπάνι','Μουσείο Βυζαντινού Πολιτισμού','Λαδάδικα & τοπική γαστρονομία','Βαλαωρίτου / κέντρο για βραδινή έξοδο'],
  'Αθήνα':['Ακρόπολη & Μουσείο Ακρόπολης','Πλάκα & Αναφιώτικα','Μοναστηράκι & Ψυρρή','Εθνικός Κήπος & Σύνταγμα','ΚΠΙΣΝ & παραλιακή','Κουκάκι & τοπική γαστρονομία','Λυκαβηττός για θέα','Κέντρο για βραδινή έξοδο'],
  'Ναύπλιο':['Παλιά Πόλη & Σύνταγμα','Παλαμήδι & πανοραμική θέα','Μπούρτζι & παραλιακός περίπατος','Αρβανιτιά','Καραθώνα','Τοπική γαστρονομία','Απογευματινός καφές στο λιμάνι','Βραδινή βόλτα στην Παλιά Πόλη'],
  'Δελφοί':['Αρχαιολογικός χώρος Δελφών','Αρχαιολογικό Μουσείο','Θόλος Αθηνάς Προναίας','Περίπατος με θέα στον ελαιώνα','Αράχωβα για γεύμα/βόλτα','Τοπική γαστρονομία','Χαλαρό απόγευμα στο χωριό','Ηλιοβασίλεμα στην περιοχή'],
  'Μονεμβασιά':['Καστροπολιτεία','Άνω Πόλη','Ναός Αγίας Σοφίας','Παραλιακός περίπατος','Τοπικά κρασιά & γεύσεις','Χαλαρή παραλία','Φωτογραφική βόλτα στα σοκάκια','Ηλιοβασίλεμα στα τείχη'],
  'Σύρος':['Ερμούπολη & Πλατεία Μιαούλη','Θέατρο Απόλλων','Βαπόρια','Άνω Σύρος','Παραλία Γαλησσά ή Κίνι','Τοπική συριανή γαστρονομία','Παραλιακή βόλτα','Βραδινή έξοδος στην Ερμούπολη'],
  'Άνδρος':['Χώρα Άνδρου','Μουσείο Σύγχρονης Τέχνης','Παραλία Νειμποριό','Μπατσί','Μονοπάτι ή φυσική διαδρομή','Τοπική γαστρονομία','Χαλαρό μπάνιο','Ηλιοβασίλεμα'],
  'Σέριφος':['Χώρα Σερίφου','Λιβάδι','Παραλία Ψιλή Άμμος','Παραλία Βαγιά','Περίπατος στα σοκάκια','Τοπική γαστρονομία','Χαλαρό μπάνιο','Ηλιοβασίλεμα στη Χώρα'],
  'Τήνος':['Χώρα Τήνου','Παναγία Ευαγγελίστρια','Πύργος & Μουσείο Μαρμαροτεχνίας','Βώλαξ','Παραλία Κολυμπήθρα','Τοπική γαστρονομία','Χωριά της ενδοχώρας','Ηλιοβασίλεμα & χαλαρό βράδυ'],
  'Σόφια':['Alexander Nevsky Cathedral','Vitosha Boulevard','Serdica & ρωμαϊκά κατάλοιπα','Boyana Church','Vitosha Mountain / viewpoint','Central Market Hall περιοχή','Βουλγαρική γαστρονομία','Βραδινή έξοδος στο κέντρο']
};
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function stateNow(){try{return typeof state!=='undefined'&&state?state:{};}catch{return {};}}
function destByName(name){return (window.HORIZON_DESTINATIONS||[]).find(d=>d.name===name)||{};}
function addUnique(arr,v){if(v&&!arr.includes(v))arr.push(v);}
function interests(){const x=stateNow().interests;return Array.isArray(x)?x.filter(v=>v!=='any'):[];}
function genericIdeas(d){
  const tags=new Set([...(d.tags||[]),...interests()]),out=[];
  if(tags.has('history')){addUnique(out,'Ιστορικό κέντρο & βασικά μνημεία');addUnique(out,'Μουσείο ή πολιτιστικό σημείο');}
  if(tags.has('sea')){addUnique(out,'Παραλία ή παραθαλάσσιος περίπατος');addUnique(out,'Ηλιοβασίλεμα δίπλα στη θάλασσα');}
  if(tags.has('nature')||tags.has('mountain')){addUnique(out,'Διαδρομή στη φύση ή viewpoint');addUnique(out,'Χαλαρή υπαίθρια εξερεύνηση');}
  if(tags.has('food')){addUnique(out,'Τοπική αγορά & γαστρονομία');addUnique(out,'Δείπνο με τοπικές σπεσιαλιτέ');}
  if(tags.has('nightlife'))addUnique(out,'Βραδινή έξοδος σε ζωντανή περιοχή');
  if(tags.has('wellness'))addUnique(out,'Χαλαρή εμπειρία / wellness');
  if(tags.has('adventure'))addUnique(out,'Outdoor δραστηριότητα ή εμπειρία');
  if(tags.has('family'))addUnique(out,'Εύκολη οικογενειακή δραστηριότητα');
  if(tags.has('romantic'))addUnique(out,'Ρομαντική βόλτα ή σημείο με θέα');
  ['Κεντρική βόλτα και γνωριμία με τον προορισμό','Καφές σε χαρακτηριστική γειτονιά','Τοπική γαστρονομία','Ελεύθερος χρόνος για αυθόρμητη εξερεύνηση','Βραδινή βόλτα'].forEach(x=>addUnique(out,x));
  return out;
}
function pool(name,d){return [...(DESTINATION_PLANS[name]||[]),...genericIdeas(d)];}
function duration(){return Math.max(1,Math.min(14,Number(stateNow().duration)||1));}
function travelers(){const t=stateNow().travelers||{};return Math.max(1,(Number(t.adults)||1)+(Number(t.children)||0)+(Number(t.infants)||0));}
function dailyEstimate(d){
  const n=travelers(),base=Math.max(25,Math.round((Number(d.daily)||65)*.42*n)),act=Math.max(0,Math.round((Number(d.activity)||15)*n));
  return {low:Math.max(20,Math.round((base+act)*.85/5)*5),high:Math.max(30,Math.round((base+act)*1.15/5)*5)};
}
function buildDays(name,d){
  const ideas=pool(name,d),days=duration(),cost=dailyEstimate(d),out=[];
  for(let i=0;i<days;i++){
    const last=i===days-1&&days>1,offset=(i*4)%Math.max(1,ideas.length);
    const a=ideas[offset%ideas.length],b=ideas[(offset+1)%ideas.length],c=ideas[(offset+2)%ideas.length],e=ideas[(offset+3)%ideas.length];
    const slots=last?[
      ['09:00','Πρωινό & check-out / οργάνωση αποσκευών'],['10:30',a],['12:30','Τελευταία βόλτα ή αγορές'],['14:00',b],['16:00','Μετάβαση προς σταθμό / λιμάνι / αεροδρόμιο με περιθώριο χρόνου']
    ]:[
      ['09:30',a],['11:30',b],['13:30','Γεύμα με τοπικές γεύσεις'],['16:30',c],['20:30',e]
    ];
    out.push({day:i+1,title:i===0?'Άφιξη & πρώτη γνωριμία':last?'Τελευταία ημέρα & επιστροφή':`Εξερεύνηση ${i+1}`,slots,cost});
  }
  return out;
}
function styles(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
  .hz-itin-wrap{margin-top:20px}.hz-itin-eyebrow{color:#ff9d4d;font-weight:950;font-size:.7rem;letter-spacing:.08em;text-transform:uppercase}.hz-itin-title{font-size:1.15rem;font-weight:950;margin:5px 0 5px}.hz-itin-copy{color:#9fb0bd;font-size:.8rem;line-height:1.5;margin-bottom:12px}
  .hz-day{border:1px solid rgba(255,255,255,.09);border-radius:15px;background:rgba(255,255,255,.025);padding:14px;margin-top:10px}.hz-day-head{display:flex;justify-content:space-between;gap:12px;align-items:start}.hz-day-head b{font-size:.92rem}.hz-day-cost{font-size:.68rem;color:#8fdcb3;white-space:nowrap}.hz-day-grid{margin-top:10px;display:grid;gap:7px}.hz-day-row{display:grid;grid-template-columns:58px 1fr;gap:8px;font-size:.77rem}.hz-day-time{color:#ff9d4d;font-weight:900}.hz-day-text{color:#d6e0e6;border-bottom:1px solid rgba(255,255,255,.06);padding-bottom:7px}
  .hz-premium-lock{margin-top:16px;border:1px solid rgba(255,122,22,.45);border-radius:17px;padding:16px;background:linear-gradient(135deg,rgba(255,122,22,.10),rgba(255,255,255,.025))}.hz-premium-top{display:flex;justify-content:space-between;gap:14px;align-items:start}.hz-premium-price{font-size:1.45rem;font-weight:950;color:#fff}.hz-premium-badge{display:inline-flex;padding:4px 8px;border-radius:999px;background:rgba(255,122,22,.14);border:1px solid rgba(255,122,22,.35);color:#ffc08d;font-size:.62rem;font-weight:950}.hz-premium-list{margin:11px 0 0;padding:0;list-style:none;display:grid;gap:6px;color:#cbd6dd;font-size:.76rem}.hz-premium-list li:before{content:'✓';color:#65d39a;font-weight:950;margin-right:7px}
  .hz-premium-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:13px}.hz-premium-btn{border:1px solid rgba(255,255,255,.12);border-radius:11px;padding:11px 10px;background:#0b1d2b;color:#fff;font-weight:900;font-size:.76rem;cursor:pointer}.hz-premium-btn.primary{grid-column:1/-1;background:linear-gradient(180deg,#ff8b29,#df5e08);border-color:transparent}.hz-premium-btn[disabled]{opacity:.55;cursor:not-allowed}.hz-premium-note{margin-top:8px;color:#8fa3b2;font-size:.66rem;line-height:1.45}
  .hz-locked-days{margin-top:12px;display:grid;gap:8px}.hz-locked-day{position:relative;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:12px;color:#748795;background:rgba(255,255,255,.018);overflow:hidden}.hz-locked-day:after{content:'🔒 Premium';position:absolute;right:10px;top:10px;color:#ffc08d;font-size:.65rem;font-weight:900}.hz-locked-lines{filter:blur(3px);user-select:none;opacity:.5;line-height:1.7;font-size:.73rem}
  @media(max-width:620px){.hz-premium-actions{grid-template-columns:1fr}.hz-premium-btn.primary{grid-column:auto}.hz-premium-top{display:block}.hz-premium-price{margin-top:8px}}
  `;document.head.appendChild(s);
}
function dayHTML(day,full=true){
  if(!full)return `<div class="hz-locked-day"><b>Ημέρα ${day.day} — ${esc(day.title)}</b><div class="hz-locked-lines">09:30 Προσωποποιημένη δραστηριότητα<br>13:30 Γεύμα & τοπικές γεύσεις<br>16:30 Επόμενη εμπειρία<br>20:30 Βραδινό πρόγραμμα</div></div>`;
  return `<div class="hz-day"><div class="hz-day-head"><b>Ημέρα ${day.day} — ${esc(day.title)}</b><span class="hz-day-cost">~€${day.cost.low}–${day.cost.high} τοπικά</span></div><div class="hz-day-grid">${day.slots.map(([t,x])=>`<div class="hz-day-row"><span class="hz-day-time">${esc(t)}</span><span class="hz-day-text">${esc(x)}</span></div>`).join('')}</div></div>`;
}
function buildPremiumBox(days){
  const locked=days.slice(1).map(d=>dayHTML(d,false)).join('');
  return `<div class="hz-premium-lock"><div class="hz-premium-top"><div><span class="hz-premium-badge">HORIZON FULL TRIP</span><div class="hz-itin-title">Πλήρες πρόγραμμα ημέρα-ημέρα</div><div class="hz-itin-copy">Η δωρεάν έκδοση δείχνει την πρώτη ημέρα. Το πλήρες πακέτο θα ξεκλειδώνει μετά την πληρωμή.</div></div><div class="hz-premium-price">${PRICE}</div></div><ul class="hz-premium-list"><li>Όλες οι ημέρες με ώρες, δραστηριότητες και προτεινόμενο ρυθμό</li><li>Ημερήσιο budget και πρακτικές σημειώσεις</li><li>Πλήρες PDF για αποθήκευση/εκτύπωση</li><li>Άμεση λήψη μετά την πληρωμή</li><li>Προαιρετική αυτόματη αποστολή του PDF στο email του αγοραστή</li></ul>${locked?`<div class="hz-locked-days">${locked}</div>`:''}<div class="hz-premium-actions"><button class="hz-premium-btn primary" data-hz-buy>Ξεκλείδωμα πλήρους πλάνου · ${PRICE}</button><button class="hz-premium-btn" data-hz-pdf disabled>⬇ PDF μετά την πληρωμή</button><button class="hz-premium-btn" data-hz-email disabled>✉ Αποστολή στο email</button></div><div class="hz-premium-note">Δοκιμαστική έκδοση: η χρέωση δεν είναι ακόμη ενεργή. Η τελική ροή θα δίνει και άμεσο download και email αντίγραφο.</div></div>`;
}
function patchPane(){
  styles();
  const ov=document.querySelector('.horizon-detail-overlay');if(!ov)return;
  const pane=ov.querySelector('[data-pane="things"]');if(!pane||pane.dataset.hzItinerary==='1')return;
  const name=ov.querySelector('.hd-head h3')?.textContent?.trim();if(!name)return;
  const d=destByName(name),days=buildDays(name,d);
  const mini=[...pane.querySelectorAll('.hd-section')].find(s=>/Mini πρόγραμμα ημέρας/i.test(s.querySelector('h4')?.textContent||''));
  const host=mini||pane.querySelector('.hd-cta-row');
  if(!host)return;
  if(mini)mini.style.display='none';
  const wrap=document.createElement('div');wrap.className='hz-itin-wrap';wrap.innerHTML=`<div class="hz-itin-eyebrow">ΔΩΡΕΑΝ ΠΡΟΕΠΙΣΚΟΠΗΣΗ</div><div class="hz-itin-title">Το ταξίδι σου, ημέρα-ημέρα</div><div class="hz-itin-copy">Πρώτη ημέρα προσαρμοσμένη στον προορισμό και στις προτιμήσεις σου. Οι ώρες είναι προτεινόμενες και προσαρμόζονται αργότερα σε πραγματικές αφίξεις/κρατήσεις.</div>${dayHTML(days[0],true)}${buildPremiumBox(days)}`;
  host.before(wrap);pane.dataset.hzItinerary='1';
  wrap.querySelector('[data-hz-buy]')?.addEventListener('click',()=>alert('Η πληρωμή θα ενεργοποιηθεί στην επαγγελματική έκδοση. Το πακέτο έχει ήδη σχεδιαστεί για άμεσο PDF download και προαιρετική αποστολή στο email μετά την επιτυχή πληρωμή.'));
  window.HORIZON_PREMIUM={price:19.90,currency:'EUR',destination:name,days,buildPayload:()=>({destination:name,days,state:{...stateNow()}})};
}
function burst(){[0,80,220,600].forEach(ms=>setTimeout(patchPane,ms));}
function install(){styles();document.addEventListener('click',e=>{if(e.target.closest?.('[data-tab="things"],.destination .actions'))burst();},true);burst();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

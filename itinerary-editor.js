(()=>{
'use strict';

const STYLE_ID='horizon-itinerary-editor-style';
const EDITOR_CLASS='hz-itinerary-editor';
const PDF_LIB='https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js';
const FONTKIT='https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js';
const PDF_FONT='https://cdn.jsdelivr.net/npm/notosans@5.0.0/NotoSans-Regular.woff2';
const FUTURE_PRICE='19,90€';

const SPECIAL={
  'Θεσσαλονίκη':['Πλατεία Αριστοτέλους & παραλία','Λευκός Πύργος & Νέα Παραλία','Ροτόντα – Καμάρα – Ναυαρίνου','Άνω Πόλη & Κάστρα','Αγορά Μοδιάνο & Καπάνι','Μουσείο Βυζαντινού Πολιτισμού','Λαδάδικα & τοπική γαστρονομία','Βαλαωρίτου / κέντρο για βραδινή έξοδο'],
  'Αθήνα':['Ακρόπολη & Μουσείο Ακρόπολης','Πλάκα & Αναφιώτικα','Μοναστηράκι & Ψυρρή','Εθνικός Κήπος & Σύνταγμα','Κουκάκι & τοπική γαστρονομία','Λυκαβηττός για θέα','ΚΠΙΣΝ & παραλιακή','Κέντρο για βραδινή έξοδο'],
  'Ναύπλιο':['Παλιά Πόλη & Σύνταγμα','Παλαμήδι & πανοραμική θέα','Μπούρτζι & παραλιακός περίπατος','Αρβανιτιά','Καραθώνα','Τοπική γαστρονομία','Καφές στο λιμάνι','Βραδινή βόλτα στην Παλιά Πόλη'],
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
function destinationName(){return document.querySelector('.horizon-detail-overlay .hd-head h3')?.textContent?.trim()||'';}
function destination(name){return (window.HORIZON_DESTINATIONS||[]).find(d=>d.name===name)||{};}
function duration(){const s=stateNow();const n=Number(s.duration?.value??s.duration);return Math.max(1,Math.min(14,Number.isFinite(n)&&n>0?n:1));}
function travelers(){const t=stateNow().travelers||{};return Math.max(1,(Number(t.adults)||1)+(Number(t.children)||0)+(Number(t.infants)||0));}
function interests(){const x=stateNow().interests;return new Set(Array.isArray(x)?x.filter(v=>v!=='any'):[]);}
function add(arr,v){if(v&&!arr.includes(v))arr.push(v);}
function genericIdeas(d){
  const tags=new Set([...(d.tags||[]),...interests()]),out=[];
  if(tags.has('history')){add(out,'Ιστορικό κέντρο & βασικά μνημεία');add(out,'Μουσείο ή πολιτιστικό σημείο');}
  if(tags.has('sea')){add(out,'Παραλία ή παραθαλάσσιος περίπατος');add(out,'Ηλιοβασίλεμα δίπλα στη θάλασσα');}
  if(tags.has('nature')||tags.has('mountain')){add(out,'Διαδρομή στη φύση ή viewpoint');add(out,'Χαλαρή υπαίθρια εξερεύνηση');}
  if(tags.has('food')){add(out,'Τοπική αγορά & γαστρονομία');add(out,'Δείπνο με τοπικές σπεσιαλιτέ');}
  if(tags.has('nightlife'))add(out,'Βραδινή έξοδος σε ζωντανή περιοχή');
  if(tags.has('wellness'))add(out,'Χαλαρή εμπειρία / wellness');
  if(tags.has('adventure'))add(out,'Outdoor δραστηριότητα ή εμπειρία');
  if(tags.has('family'))add(out,'Εύκολη οικογενειακή δραστηριότητα');
  if(tags.has('romantic'))add(out,'Ρομαντική βόλτα ή σημείο με θέα');
  ['Κεντρική βόλτα και γνωριμία με τον προορισμό','Καφές σε χαρακτηριστική γειτονιά','Τοπική γαστρονομία','Ελεύθερος χρόνος για αυθόρμητη εξερεύνηση','Βραδινή βόλτα'].forEach(x=>add(out,x));
  return out;
}
function ideaPool(name,d){return [...(SPECIAL[name]||[]),...genericIdeas(d)];}
function dailyCost(d){
  const n=travelers(),base=Math.max(25,Math.round((Number(d.daily)||65)*.42*n)),act=Math.max(0,Math.round((Number(d.activity)||15)*n));
  return {low:Math.max(20,Math.round((base+act)*.85/5)*5),high:Math.max(30,Math.round((base+act)*1.15/5)*5)};
}
function defaultDays(name,d){
  const ideas=ideaPool(name,d),count=duration(),cost=dailyCost(d),days=[];
  for(let i=0;i<count;i++){
    const last=i===count-1&&count>1,offset=(i*4)%Math.max(1,ideas.length);
    const a=ideas[offset%ideas.length],b=ideas[(offset+1)%ideas.length],c=ideas[(offset+2)%ideas.length],e=ideas[(offset+3)%ideas.length];
    const slots=last?[
      {time:'09:00',text:'Πρωινό & check-out / οργάνωση αποσκευών'},
      {time:'10:30',text:a},{time:'12:30',text:'Τελευταία βόλτα ή αγορές'},
      {time:'14:00',text:b},{time:'16:00',text:'Μετάβαση προς σταθμό / λιμάνι / αεροδρόμιο με περιθώριο χρόνου'}
    ]:[
      {time:'09:30',text:a},{time:'11:30',text:b},{time:'13:30',text:'Γεύμα με τοπικές γεύσεις'},
      {time:'16:30',text:c},{time:'20:30',text:e}
    ];
    days.push({day:i+1,title:i===0?'Άφιξη & πρώτη γνωριμία':last?'Τελευταία ημέρα & επιστροφή':`Εξερεύνηση ${i+1}`,slots,notes:'',done:false,cost});
  }
  return days;
}
function storageKey(name){
  const s=stateNow(),dates=s.dates||s.dateRange||s.calendar||{};
  return `horizon-itinerary-editor-v1:${name}:${JSON.stringify(dates)}:${duration()}`;
}
function loadPlan(name,d){
  const fresh={name,days:defaultDays(name,d),tripNotes:''};
  try{
    const raw=localStorage.getItem(storageKey(name));if(!raw)return fresh;
    const saved=JSON.parse(raw);if(!saved||!Array.isArray(saved.days)||saved.days.length!==fresh.days.length)return fresh;
    return saved;
  }catch{return fresh;}
}
function savePlan(name,data){try{localStorage.setItem(storageKey(name),JSON.stringify(data));}catch{}}

function ensureStyles(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement('style');s.id=STYLE_ID;s.textContent=`
  [data-pane="things"].hz-things-v2>.hd-section,[data-pane="things"].hz-things-v2>.hd-cta-row,[data-pane="things"].hz-things-v2>.hz-itin-wrap{display:none!important}
  .${EDITOR_CLASS}{margin-top:16px}.hz-free-pill{display:inline-flex;gap:6px;align-items:center;padding:5px 9px;border-radius:999px;border:1px solid rgba(101,211,154,.35);background:rgba(101,211,154,.08);color:#8ae5b5;font-weight:950;font-size:.64rem}
  .hz-edit-intro{margin:8px 0 14px;color:#9fb0bd;font-size:.8rem;line-height:1.5}.hz-edit-day{border:1px solid rgba(255,255,255,.09);border-radius:16px;background:rgba(255,255,255,.025);padding:14px;margin-top:11px}.hz-edit-head{display:flex;gap:9px;align-items:center}.hz-edit-head input{flex:1;background:#0b1d2b;border:1px solid rgba(255,255,255,.1);border-radius:9px;padding:9px 10px;color:white;font-weight:900}.hz-edit-cost{font-size:.67rem;color:#8fdcb3;white-space:nowrap}
  .hz-edit-row{display:grid;grid-template-columns:78px 1fr 30px;gap:7px;margin-top:8px;align-items:start}.hz-edit-row input,.hz-edit-row textarea,.hz-edit-notes,.hz-trip-notes{width:100%;box-sizing:border-box;background:#091a28;border:1px solid rgba(255,255,255,.09);border-radius:9px;padding:8px 9px;color:#e7eef2;font:inherit}.hz-edit-row textarea{min-height:42px;resize:vertical}.hz-edit-remove{width:30px;height:30px;border-radius:8px;border:1px solid rgba(255,255,255,.1);background:#0b1d2b;color:#aebcc5;cursor:pointer}.hz-edit-add{margin-top:8px;border:1px dashed rgba(255,255,255,.16);background:transparent;color:#b9c8d1;border-radius:9px;padding:8px 10px;cursor:pointer;font-weight:800}.hz-edit-notes,.hz-trip-notes{margin-top:9px;min-height:58px;resize:vertical}
  .hz-edit-toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.hz-edit-btn{border:1px solid rgba(255,255,255,.12);border-radius:10px;background:#0b1d2b;color:#fff;padding:10px 12px;font-weight:900;cursor:pointer}.hz-edit-btn.primary{background:linear-gradient(180deg,#ff8b29,#df5e08);border-color:transparent}.hz-edit-status{margin-top:8px;color:#91a4b2;font-size:.7rem;min-height:1em}
  .hz-pdf-box{margin-top:16px;border:1px solid rgba(255,122,22,.34);border-radius:16px;padding:14px;background:linear-gradient(135deg,rgba(255,122,22,.08),rgba(255,255,255,.02))}.hz-pdf-title{font-weight:950}.hz-pdf-copy{margin-top:4px;color:#a7b6c1;font-size:.76rem;line-height:1.5}.hz-email-row{display:grid;grid-template-columns:1fr auto;gap:7px;margin-top:10px}.hz-email-row input{min-width:0;background:#091a28;border:1px solid rgba(255,255,255,.1);border-radius:9px;padding:10px;color:#fff}.hz-email-row button{border:1px solid rgba(255,255,255,.12);border-radius:9px;background:#0b1d2b;color:#fff;padding:10px 11px;font-weight:900;cursor:pointer}.hz-future-note{margin-top:10px;color:#8fa3b2;font-size:.68rem;line-height:1.45}
  @media(max-width:620px){.hz-edit-row{grid-template-columns:64px 1fr 28px}.hz-email-row{grid-template-columns:1fr}.hz-edit-head{align-items:flex-start;flex-direction:column}.hz-edit-head input{width:100%;box-sizing:border-box}}
  `;document.head.appendChild(s);
}

function dayHtml(day){
  return `<div class="hz-edit-day" data-day="${day.day}">
    <div class="hz-edit-head"><input class="hz-day-title" value="${esc(day.title)}" aria-label="Τίτλος ημέρας ${day.day}"><span class="hz-edit-cost">~€${day.cost.low}–${day.cost.high} / ημέρα</span></div>
    <div class="hz-day-rows">${day.slots.map((s,i)=>rowHtml(s,i)).join('')}</div>
    <button class="hz-edit-add" type="button" data-add-row>+ Προσθήκη στάσης</button>
    <textarea class="hz-edit-notes" placeholder="Σημειώσεις ημέρας…">${esc(day.notes||'')}</textarea>
  </div>`;
}
function rowHtml(slot,i){return `<div class="hz-edit-row" data-row="${i}"><input class="hz-slot-time" value="${esc(slot.time)}" aria-label="Ώρα"><textarea class="hz-slot-text" aria-label="Δραστηριότητα">${esc(slot.text)}</textarea><button type="button" class="hz-edit-remove" data-remove-row aria-label="Αφαίρεση">×</button></div>`;}
function collect(editor,name){
  const d=destination(name),cost=dailyCost(d),days=[...editor.querySelectorAll('.hz-edit-day')].map((day,idx)=>({
    day:idx+1,title:day.querySelector('.hz-day-title')?.value?.trim()||`Ημέρα ${idx+1}`,
    slots:[...day.querySelectorAll('.hz-edit-row')].map(r=>({time:r.querySelector('.hz-slot-time')?.value?.trim()||'',text:r.querySelector('.hz-slot-text')?.value?.trim()||''})).filter(x=>x.time||x.text),
    notes:day.querySelector('.hz-edit-notes')?.value||'',done:false,cost
  }));
  return {name,days,tripNotes:editor.querySelector('.hz-trip-notes')?.value||''};
}
function setStatus(editor,text,ok=false){const x=editor.querySelector('.hz-edit-status');if(x){x.textContent=text;x.style.color=ok?'#8ae5b5':'#91a4b2';}}

function render(){
  ensureStyles();
  const pane=document.querySelector('.horizon-detail-overlay [data-pane="things"]');if(!pane)return;
  const name=destinationName();if(!name)return;
  pane.classList.add('hz-things-v2');
  pane.querySelectorAll(`.${EDITOR_CLASS}`).forEach(x=>x.remove());
  const data=loadPlan(name,destination(name));
  const editor=document.createElement('div');editor.className=EDITOR_CLASS;editor.dataset.destination=name;
  editor.innerHTML=`
    <span class="hz-free-pill">✓ ΠΛΗΡΕΣ ITINERARY · ΔΩΡΕΑΝ ΣΤΗ ΔΟΚΙΜΑΣΤΙΚΗ ΕΚΔΟΣΗ</span>
    <div class="hz-edit-intro"><b>Το πρόγραμμά σου είναι πλήρως επεξεργάσιμο.</b> Άλλαξε ώρες, δραστηριότητες και σημειώσεις πριν το αποθηκεύσεις ή το μετατρέψεις σε διαδραστικό PDF.</div>
    ${data.days.map(dayHtml).join('')}
    <textarea class="hz-trip-notes" placeholder="Γενικές σημειώσεις ταξιδιού…">${esc(data.tripNotes||'')}</textarea>
    <div class="hz-edit-toolbar"><button type="button" class="hz-edit-btn" data-save-itinerary>Αποθήκευση αλλαγών</button><button type="button" class="hz-edit-btn" data-reset-itinerary>Επαναφορά πρότασης</button></div>
    <div class="hz-pdf-box"><div class="hz-pdf-title">📄 Διαδραστικό PDF ταξιδιού</div><div class="hz-pdf-copy">Το PDF θα περιέχει επεξεργάσιμα πεδία ανά ημέρα, checkbox ολοκλήρωσης και προσωπικές σημειώσεις. Μπορείς να το αποθηκεύσεις στον υπολογιστή και να συνεχίσεις να το αλλάζεις σε PDF viewer που υποστηρίζει φόρμες.</div><div class="hz-edit-toolbar"><button type="button" class="hz-edit-btn primary" data-download-pdf>Κατέβασε διαδραστικό PDF</button></div><div class="hz-email-row"><input type="email" data-email placeholder="Email για αντίγραφο PDF"><button type="button" data-email-pdf>Αποστολή στο email</button></div><div class="hz-future-note">Στη σημερινή δοκιμαστική έκδοση το πλήρες itinerary είναι δωρεάν. Στην επίσημη έκδοση μπορεί να ενεργοποιηθεί χρέωση (ενδεικτικά ${FUTURE_PRICE}). Η αυτόματη αποστολή email θα ενεργοποιηθεί όταν συνδεθεί email provider στο Horizon.</div></div>
    <div class="hz-edit-status" aria-live="polite"></div>`;
  const hero=pane.querySelector(':scope > .hd-hero');if(hero)hero.after(editor);else pane.prepend(editor);
}

let saveTimer=null;
function autoSave(editor){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{const name=editor.dataset.destination;savePlan(name,collect(editor,name));setStatus(editor,'Οι αλλαγές αποθηκεύτηκαν τοπικά.',true);},350);}

function loadExternal(src,globalName){return new Promise((resolve,reject)=>{if(globalName&&window[globalName])return resolve();const old=document.querySelector(`script[data-hz-src="${src}"]`);if(old){old.addEventListener('load',resolve,{once:true});old.addEventListener('error',reject,{once:true});return;}const s=document.createElement('script');s.src=src;s.async=true;s.dataset.hzSrc=src;s.onload=resolve;s.onerror=reject;document.head.appendChild(s);});}
async function ensurePdfLib(){await loadExternal(PDF_LIB,'PDFLib');await loadExternal(FONTKIT,'fontkit');if(!window.PDFLib||!window.fontkit)throw new Error('PDF library unavailable');}
function safeFileName(name){return String(name||'trip').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-+|-+$/g,'')||'trip';}
async function buildPdf(name,data){
  await ensurePdfLib();
  const {PDFDocument,rgb}=window.PDFLib,pdf=await PDFDocument.create();pdf.registerFontkit(window.fontkit);
  const fontBytes=await fetch(PDF_FONT).then(r=>{if(!r.ok)throw new Error('Font download failed');return r.arrayBuffer();});
  const font=await pdf.embedFont(fontBytes,{subset:true});const form=pdf.getForm();const A4=[595.28,841.89];
  const header=(page,title,sub)=>{page.drawRectangle({x:0,y:775,width:A4[0],height:67,color:rgb(.035,.10,.15)});page.drawText('HORIZON',{x:38,y:808,size:17,font,color:rgb(1,.48,.09)});page.drawText(title,{x:38,y:786,size:13,font,color:rgb(.96,.98,1)});if(sub)page.drawText(sub,{x:38,y:762,size:8.5,font,color:rgb(.38,.48,.55)});};
  const summary=pdf.addPage(A4);header(summary,`${name} · Προσωπικό itinerary`,`${data.days.length} ημέρες · ${travelers()} ταξιδιώτες`);summary.drawText('Το αρχείο είναι διαδραστικό: μπορείς να αλλάξεις τα πεδία και να το αποθηκεύσεις ξανά.',{x:38,y:720,size:9,font,color:rgb(.2,.27,.32),maxWidth:515});
  const tripNotes=form.createTextField('trip_notes');tripNotes.enableMultiline();tripNotes.setFontSize(10);tripNotes.setText(data.tripNotes||'');tripNotes.addToPage(summary,{x:38,y:470,width:519,height:210,borderWidth:1,borderColor:rgb(.75,.78,.8),backgroundColor:rgb(.98,.99,1),textColor:rgb(.08,.12,.16)});summary.drawText('Γενικές σημειώσεις ταξιδιού',{x:38,y:692,size:10,font,color:rgb(.08,.12,.16)});
  data.days.forEach(day=>{
    const page=pdf.addPage(A4);header(page,`Ημέρα ${day.day} · ${day.title}`,`Ενδεικτικό ημερήσιο budget: €${day.cost.low}–${day.cost.high}`);
    page.drawText('Ολοκληρώθηκε',{x:58,y:720,size:9,font,color:rgb(.08,.12,.16)});const cb=form.createCheckBox(`day_${day.day}_done`);cb.addToPage(page,{x:38,y:716,width:14,height:14,borderWidth:1,borderColor:rgb(.35,.4,.45)});if(day.done)cb.check();
    page.drawText('Πρόγραμμα ημέρας — επεξεργάσιμο πεδίο',{x:38,y:690,size:10,font,color:rgb(.08,.12,.16)});
    const plan=form.createTextField(`day_${day.day}_plan`);plan.enableMultiline();plan.setFontSize(10);plan.setText(day.slots.map(s=>`${s.time}  ${s.text}`).join('\n'));plan.addToPage(page,{x:38,y:300,width:519,height:375,borderWidth:1,borderColor:rgb(.75,.78,.8),backgroundColor:rgb(.98,.99,1),textColor:rgb(.08,.12,.16)});
    page.drawText('Προσωπικές σημειώσεις ημέρας',{x:38,y:274,size:10,font,color:rgb(.08,.12,.16)});const notes=form.createTextField(`day_${day.day}_notes`);notes.enableMultiline();notes.setFontSize(10);notes.setText(day.notes||'');notes.addToPage(page,{x:38,y:100,width:519,height:158,borderWidth:1,borderColor:rgb(.75,.78,.8),backgroundColor:rgb(.98,.99,1),textColor:rgb(.08,.12,.16)});
  });
  form.updateFieldAppearances(font);return pdf.save();
}
function downloadBytes(bytes,name){const blob=new Blob([bytes],{type:'application/pdf'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`Horizon-${safeFileName(name)}-itinerary.pdf`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
function bytesToBase64(bytes){let bin='';const u=new Uint8Array(bytes),step=0x8000;for(let i=0;i<u.length;i+=step)bin+=String.fromCharCode(...u.subarray(i,i+step));return btoa(bin);}
async function emailPdf(editor,email){
  const endpoint=window.HORIZON_LIVE_CONFIG?.emailPdfEndpoint;if(!endpoint){setStatus(editor,'Η αυτόματη αποστολή email δεν είναι ακόμη ενεργή. Το PDF μπορεί να κατέβει άμεσα δωρεάν.',false);return;}
  const name=editor.dataset.destination,data=collect(editor,name),bytes=await buildPdf(name,data);const res=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,filename:`Horizon-${safeFileName(name)}-itinerary.pdf`,pdfBase64:bytesToBase64(bytes)})});if(!res.ok)throw new Error('Email send failed');setStatus(editor,`Το PDF στάλθηκε στο ${email}.`,true);
}

function handleClick(e){
  const editor=e.target.closest?.(`.${EDITOR_CLASS}`);if(!editor){[0,80,220].forEach(ms=>setTimeout(render,ms));return;}
  const name=editor.dataset.destination;
  if(e.target.closest('[data-add-row]')){const day=e.target.closest('.hz-edit-day'),rows=day.querySelector('.hz-day-rows'),wrap=document.createElement('div');wrap.innerHTML=rowHtml({time:'',text:''},rows.children.length);rows.appendChild(wrap.firstElementChild);autoSave(editor);return;}
  if(e.target.closest('[data-remove-row]')){e.target.closest('.hz-edit-row')?.remove();autoSave(editor);return;}
  if(e.target.closest('[data-save-itinerary]')){savePlan(name,collect(editor,name));setStatus(editor,'Οι αλλαγές αποθηκεύτηκαν.',true);return;}
  if(e.target.closest('[data-reset-itinerary]')){try{localStorage.removeItem(storageKey(name));}catch{}render();return;}
  if(e.target.closest('[data-download-pdf]')){(async()=>{try{setStatus(editor,'Δημιουργία διαδραστικού PDF…');const data=collect(editor,name);savePlan(name,data);const bytes=await buildPdf(name,data);downloadBytes(bytes,name);setStatus(editor,'Το διαδραστικό PDF δημιουργήθηκε και κατέβηκε.',true);}catch(err){console.error(err);setStatus(editor,'Δεν μπόρεσε να δημιουργηθεί το PDF. Δοκίμασε ξανά σε λίγα δευτερόλεπτα.');}})();return;}
  if(e.target.closest('[data-email-pdf]')){const email=editor.querySelector('[data-email]')?.value?.trim();if(!/^\S+@\S+\.\S+$/.test(email||'')){setStatus(editor,'Γράψε πρώτα ένα έγκυρο email.');return;}(async()=>{try{setStatus(editor,'Προετοιμασία PDF για email…');await emailPdf(editor,email);}catch(err){console.error(err);setStatus(editor,'Η αποστολή email απέτυχε. Μπορείς να κατεβάσεις το PDF άμεσα.');}})();}
}
function handleInput(e){const editor=e.target.closest?.(`.${EDITOR_CLASS}`);if(editor)autoSave(editor);}
function boot(){ensureStyles();document.addEventListener('click',handleClick,true);document.addEventListener('input',handleInput,true);[0,250,800].forEach(ms=>setTimeout(render,ms));}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

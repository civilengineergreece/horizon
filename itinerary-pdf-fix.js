(()=>{
'use strict';
const PDF_LIB='https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js';
const FONTKIT='https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js';
const PDF_FONT='https://pdf-lib.js.org/assets/ubuntu/Ubuntu-R.ttf';

function loadScript(src,globalName){return new Promise((resolve,reject)=>{if(globalName&&window[globalName])return resolve();const old=[...document.scripts].find(s=>s.src===src);if(old){if(globalName&&window[globalName])return resolve();old.addEventListener('load',resolve,{once:true});old.addEventListener('error',reject,{once:true});return;}const s=document.createElement('script');s.src=src;s.async=true;s.onload=resolve;s.onerror=reject;document.head.appendChild(s);});}
async function ensurePdf(){await loadScript(PDF_LIB,'PDFLib');await loadScript(FONTKIT,'fontkit');if(!window.PDFLib||!window.fontkit)throw new Error('PDF libraries unavailable');}
function safe(v){return String(v||'').trim();}
function fileName(name){return String(name||'trip').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-+|-+$/g,'')||'trip';}
function status(editor,text,ok=false){const el=editor.querySelector('.hz-edit-status');if(el){el.textContent=text;el.style.color=ok?'#8ae5b5':'#91a4b2';}}
function collect(editor){
  const name=editor.dataset.destination||document.querySelector('.horizon-detail-overlay .hd-head h3')?.textContent?.trim()||'Ταξίδι';
  const days=[...editor.querySelectorAll('.hz-edit-day')].map((day,i)=>({
    day:i+1,
    title:safe(day.querySelector('.hz-day-title')?.value)||`Ημέρα ${i+1}`,
    rows:[...day.querySelectorAll('.hz-edit-row')].map(r=>({time:safe(r.querySelector('.hz-slot-time')?.value),text:safe(r.querySelector('.hz-slot-text')?.value)})).filter(x=>x.time||x.text),
    notes:day.querySelector('.hz-edit-notes')?.value||''
  }));
  return {name,days,tripNotes:editor.querySelector('.hz-trip-notes')?.value||''};
}
function setFieldStyle(field,size=10){field.setFontSize(size);field.enableMultiline?.();}
async function makePdf(data){
  await ensurePdf();
  const {PDFDocument,rgb}=window.PDFLib;
  const pdf=await PDFDocument.create();
  pdf.registerFontkit(window.fontkit);
  const res=await fetch(PDF_FONT,{cache:'force-cache',mode:'cors'});if(!res.ok)throw new Error(`Font ${res.status}`);
  const font=await pdf.embedFont(await res.arrayBuffer(),{subset:true});
  const form=pdf.getForm();
  // pdf-lib's default form font is Helvetica/WinAnsi. Force our Unicode font
  // both when widgets are first added and again on save so Greek never falls
  // back to Helvetica.
  const rawUpdate=form.updateFieldAppearances.bind(form);
  form.updateFieldAppearances=()=>rawUpdate(font);
  const A4=[595.28,841.89];
  const addHeader=(page,title,sub='')=>{
    page.drawRectangle({x:0,y:775,width:A4[0],height:67,color:rgb(.035,.10,.15)});
    page.drawText('HORIZON',{x:38,y:808,size:17,font,color:rgb(1,.48,.09)});
    page.drawText(title,{x:38,y:786,size:12.5,font,color:rgb(.96,.98,1)});
    if(sub)page.drawText(sub,{x:38,y:762,size:8.5,font,color:rgb(.38,.48,.55)});
  };
  const fieldOpts=(extra={})=>({borderWidth:1,borderColor:rgb(.72,.76,.80),backgroundColor:rgb(.99,.995,1),textColor:rgb(.08,.12,.16),font,...extra});

  const summary=pdf.addPage(A4);
  addHeader(summary,`${data.name} · Προσωπικό itinerary`,`${data.days.length} ημέρες · διαδραστικό PDF`);
  summary.drawText('Το PDF περιέχει επεξεργάσιμα πεδία. Για καλύτερη συμβατότητα άνοιξέ το σε Adobe Acrobat Reader ή άλλο PDF viewer που υποστηρίζει φόρμες.',{x:38,y:720,size:9,font,color:rgb(.16,.22,.27),maxWidth:515,lineHeight:13});
  summary.drawText('Γενικές σημειώσεις ταξιδιού',{x:38,y:675,size:10,font,color:rgb(.08,.12,.16)});
  const trip=form.createTextField('trip_notes');setFieldStyle(trip,10);trip.setText(data.tripNotes||'');trip.addToPage(summary,fieldOpts({x:38,y:410,width:519,height:245}));

  data.days.forEach(day=>{
    const page=pdf.addPage(A4);
    addHeader(page,`Ημέρα ${day.day}`,data.name);
    page.drawText('Τίτλος ημέρας',{x:38,y:720,size:9,font,color:rgb(.08,.12,.16)});
    const title=form.createTextField(`day_${day.day}_title`);title.setFontSize(11);title.setText(day.title);title.addToPage(page,fieldOpts({x:38,y:680,width:519,height:30}));

    page.drawText('Ολοκληρώθηκε',{x:58,y:651,size:9,font,color:rgb(.08,.12,.16)});
    const cb=form.createCheckBox(`day_${day.day}_done`);cb.addToPage(page,{x:38,y:646,width:14,height:14,borderWidth:1,borderColor:rgb(.35,.4,.45)});

    page.drawText('Πρόγραμμα ημέρας — μπορείς να αλλάξεις ώρες και δραστηριότητες',{x:38,y:620,size:9,font,color:rgb(.08,.12,.16)});
    const plan=form.createTextField(`day_${day.day}_plan`);setFieldStyle(plan,10);plan.setText(day.rows.map(r=>`${r.time}${r.time&&r.text?'  ':''}${r.text}`).join('\n'));plan.addToPage(page,fieldOpts({x:38,y:300,width:519,height:300}));

    page.drawText('Προσωπικές σημειώσεις ημέρας',{x:38,y:274,size:9,font,color:rgb(.08,.12,.16)});
    const notes=form.createTextField(`day_${day.day}_notes`);setFieldStyle(notes,10);notes.setText(day.notes||'');notes.addToPage(page,fieldOpts({x:38,y:90,width:519,height:165}));
  });

  form.updateFieldAppearances(font);
  return pdf.save({updateFieldAppearances:true});
}
function download(bytes,name){const blob=new Blob([bytes],{type:'application/pdf'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`Horizon-${fileName(name)}-interactive-itinerary.pdf`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);}
function patchButtons(){document.querySelectorAll('.hz-itinerary-editor [data-download-pdf]').forEach(btn=>{btn.removeAttribute('data-download-pdf');btn.setAttribute('data-download-pdf-fixed','1');btn.textContent='Κατέβασε διαδραστικό PDF';});}
function burst(){[0,80,220,600,1200].forEach(ms=>setTimeout(patchButtons,ms));}
function install(){
  burst();
  document.addEventListener('click',e=>{
    const btn=e.target.closest?.('[data-download-pdf-fixed]');
    if(!btn){burst();return;}
    e.preventDefault();e.stopImmediatePropagation();
    const editor=btn.closest('.hz-itinerary-editor');if(!editor)return;
    (async()=>{try{btn.disabled=true;status(editor,'Δημιουργία διαδραστικού PDF…');const data=collect(editor);const bytes=await makePdf(data);download(bytes,data.name);status(editor,'Το διαδραστικό PDF δημιουργήθηκε και κατέβηκε.',true);}catch(err){console.error('Horizon PDF',err);status(editor,`Η δημιουργία PDF απέτυχε (${err?.message||'άγνωστο σφάλμα'}).`);}finally{btn.disabled=false;}})();
  },true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

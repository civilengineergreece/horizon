(()=>{
'use strict';
const PDF_LIB='https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js';
const FONTKIT='https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js';
const QR_LIB='https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
const PDF_FONT='https://pdf-lib.js.org/assets/ubuntu/Ubuntu-R.ttf';
function loadScript(src,globalName){return new Promise((resolve,reject)=>{if(globalName&&window[globalName])return resolve();const old=[...document.scripts].find(s=>s.src===src);if(old){if(globalName&&window[globalName])return resolve();old.addEventListener('load',resolve,{once:true});old.addEventListener('error',reject,{once:true});return;}const s=document.createElement('script');s.src=src;s.async=true;s.onload=resolve;s.onerror=reject;document.head.appendChild(s);});}
async function ensureLibs(){await loadScript(PDF_LIB,'PDFLib');await loadScript(FONTKIT,'fontkit');await loadScript(QR_LIB,'QRCode');if(!window.PDFLib||!window.fontkit||!window.QRCode)throw new Error('PDF/QR libraries unavailable');}
function safe(v){return String(v||'').trim();}
function n(v,f=0){const x=Number(v);return Number.isFinite(x)?x:f;}
function fileName(name){return String(name||'trip').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-+|-+$/g,'')||'trip';}
function status(editor,text,ok=false){const el=editor.querySelector('.hz-edit-status');if(el){el.textContent=text;el.style.color=ok?'#8ae5b5':'#91a4b2';}}
function parseCost(text){const m=String(text||'').match(/(\d+)\s*[–-]\s*€?(\d+)/);return m?{low:Number(m[1]),high:Number(m[2])}:{low:50,high:80};}
function makeMapUrl(name,rows){const stops=rows.map(r=>safe(r.text)).filter(Boolean).filter(x=>!/^(Γεύμα|Πρωινό|Check|Μετάβαση|Ελεύθερος χρόνος)/i.test(x)).slice(0,10);const u=new URL('map.html',location.href);u.searchParams.set('d',name);u.searchParams.set('stops',stops.join('|'));return u.toString();}
function collect(editor){
  const name=editor.dataset.destination||document.querySelector('.horizon-detail-overlay .hd-head h3')?.textContent?.trim()||'Ταξίδι';
  const days=[...editor.querySelectorAll('.hz-edit-day')].map((day,i)=>{
    const rows=[...day.querySelectorAll('.hz-edit-row')].map(r=>({time:safe(r.querySelector('.hz-slot-time')?.value),text:safe(r.querySelector('.hz-slot-text')?.value)})).filter(x=>x.time||x.text);
    const fallback=parseCost(day.querySelector('.hz-edit-cost')?.textContent),low=n(day.querySelector('[data-hz-budget-low]')?.value,fallback.low),high=Math.max(low,n(day.querySelector('[data-hz-budget-high]')?.value,fallback.high));
    return {day:i+1,title:safe(day.querySelector('.hz-day-title')?.value)||`Ημέρα ${i+1}`,rows,notes:day.querySelector('.hz-edit-notes')?.value||'',budget:{low,high},mapUrl:makeMapUrl(name,rows)};
  });
  const allRows=days.flatMap(d=>d.rows);return {name,days,tripNotes:editor.querySelector('.hz-trip-notes')?.value||'',mapUrl:makeMapUrl(name,allRows)};
}
function prepareMultiline(field){field.enableMultiline();}
function finishField(field,font,size){try{field.setFontSize(size);}catch{}field.updateAppearances(font);}
async function qrBytes(text){
  const host=document.createElement('div');host.style.cssText='position:fixed;left:-9999px;top:-9999px;width:220px;height:220px;background:#fff';document.body.appendChild(host);
  try{new window.QRCode(host,{text,width:220,height:220,colorDark:'#06131d',colorLight:'#ffffff',correctLevel:window.QRCode.CorrectLevel.M});await new Promise(r=>setTimeout(r,40));const canvas=host.querySelector('canvas'),img=host.querySelector('img');const data=canvas?.toDataURL('image/png')||img?.src;if(!data)throw new Error('QR generation failed');return fetch(data).then(r=>r.arrayBuffer());}finally{host.remove();}
}
function addUriLink(pdf,page,url,x,y,w,h){
  try{const {PDFName,PDFString}=window.PDFLib;const action=pdf.context.obj({S:PDFName.of('URI'),URI:PDFString.of(url)});const annot=pdf.context.register(pdf.context.obj({Type:PDFName.of('Annot'),Subtype:PDFName.of('Link'),Rect:[x,y,x+w,y+h],Border:[0,0,0],A:action}));page.node.addAnnot(annot);}catch(e){console.debug('PDF link annotation unavailable',e);}
}
async function makePdf(data){
  await ensureLibs();
  const {PDFDocument,rgb}=window.PDFLib,pdf=await PDFDocument.create();pdf.registerFontkit(window.fontkit);
  const res=await fetch(PDF_FONT,{cache:'force-cache',mode:'cors'});if(!res.ok)throw new Error(`Font ${res.status}`);
  const font=await pdf.embedFont(await res.arrayBuffer(),{subset:true}),form=pdf.getForm(),A4=[595.28,841.89];
  const orange=rgb(1,.48,.09),dark=rgb(.035,.10,.15),ink=rgb(.08,.12,.16),muted=rgb(.38,.48,.55),line=rgb(.72,.76,.80),paper=rgb(.99,.995,1);
  const addHeader=(page,title,sub='')=>{page.drawRectangle({x:0,y:775,width:A4[0],height:67,color:dark});page.drawText('HORIZON',{x:38,y:808,size:17,font,color:orange});page.drawText(title,{x:38,y:786,size:12.5,font,color:rgb(.96,.98,1)});if(sub)page.drawText(sub,{x:38,y:762,size:8.5,font,color:muted});};
  const fieldOpts=extra=>({borderWidth:1,borderColor:line,backgroundColor:paper,textColor:ink,font,...extra});
  const totalLow=data.days.reduce((a,d)=>a+d.budget.low,0),totalHigh=data.days.reduce((a,d)=>a+d.budget.high,0);
  const summary=pdf.addPage(A4);addHeader(summary,`${data.name} · Horizon Planner v2`,`${data.days.length} ημέρες · διαδραστικό PDF`);
  summary.drawText('Σύνοψη ταξιδιού',{x:38,y:724,size:12,font,color:ink});
  const cards=[['Ημέρες',String(data.days.length)],['Budget από',`€${totalLow}`],['Budget έως',`€${totalHigh}`]];cards.forEach((c,i)=>{const x=38+i*170;summary.drawRectangle({x,y:666,width:155,height:42,color:rgb(.965,.975,.982),borderColor:line,borderWidth:.7});summary.drawText(c[0],{x:x+10,y:691,size:7.5,font,color:muted});summary.drawText(c[1],{x:x+10,y:674,size:12,font,color:ink});});
  summary.drawRectangle({x:38,y:610,width:350,height:34,color:rgb(.93,.97,.99),borderColor:rgb(.35,.65,.82),borderWidth:.8});summary.drawText('Άνοιξε τον διαδραστικό 3D χάρτη ταξιδιού',{x:50,y:622,size:9.2,font,color:rgb(.05,.28,.42)});addUriLink(pdf,summary,data.mapUrl,38,610,350,34);
  try{const qr=await pdf.embedPng(await qrBytes(data.mapUrl));summary.drawImage(qr,{x:430,y:585,width:120,height:120});summary.drawText('3D map',{x:468,y:574,size:7.5,font,color:muted});}catch(e){console.debug('Trip QR skipped',e);}
  summary.drawText('Γενικές σημειώσεις ταξιδιού',{x:38,y:575,size:10,font,color:ink});
  const trip=form.createTextField('trip_notes');prepareMultiline(trip);trip.setText(data.tripNotes||'');trip.addToPage(summary,fieldOpts({x:38,y:245,width:350,height:310}));finishField(trip,font,10);
  summary.drawText('Το PDF είναι επεξεργάσιμο. Τα budget πεδία, οι τίτλοι, το πρόγραμμα και οι σημειώσεις μπορούν να αλλάξουν και να αποθηκευτούν ξανά.',{x:38,y:205,size:8.5,font,color:muted,maxWidth:515,lineHeight:12});
  for(const day of data.days){
    const page=pdf.addPage(A4);addHeader(page,`Ημέρα ${day.day}`,data.name);
    page.drawText('Τίτλος ημέρας',{x:38,y:720,size:8.5,font,color:ink});const title=form.createTextField(`day_${day.day}_title`);title.setText(day.title);title.addToPage(page,fieldOpts({x:38,y:680,width:390,height:30}));finishField(title,font,11);
    try{const qr=await pdf.embedPng(await qrBytes(day.mapUrl));page.drawImage(qr,{x:455,y:648,width:100,height:100});}catch(e){console.debug('Day QR skipped',e);}
    page.drawText('Budget ημέρας από (€)',{x:38,y:656,size:7.5,font,color:muted});const blo=form.createTextField(`day_${day.day}_budget_low`);blo.setText(String(day.budget.low));blo.addToPage(page,fieldOpts({x:38,y:620,width:90,height:27}));finishField(blo,font,10);
    page.drawText('έως (€)',{x:150,y:656,size:7.5,font,color:muted});const bhi=form.createTextField(`day_${day.day}_budget_high`);bhi.setText(String(day.budget.high));bhi.addToPage(page,fieldOpts({x:150,y:620,width:90,height:27}));finishField(bhi,font,10);
    page.drawRectangle({x:260,y:620,width:168,height:27,color:rgb(.93,.97,.99),borderColor:rgb(.35,.65,.82),borderWidth:.8});page.drawText('3D χάρτης ημέρας',{x:288,y:630,size:8.5,font,color:rgb(.05,.28,.42)});addUriLink(pdf,page,day.mapUrl,260,620,168,27);
    page.drawText('Ολοκληρώθηκε',{x:58,y:590,size:9,font,color:ink});const cb=form.createCheckBox(`day_${day.day}_done`);cb.addToPage(page,{x:38,y:585,width:14,height:14,borderWidth:1,borderColor:rgb(.35,.4,.45)});
    page.drawText('Πρόγραμμα ημέρας — επεξεργάσιμο',{x:38,y:560,size:9,font,color:ink});const plan=form.createTextField(`day_${day.day}_plan`);prepareMultiline(plan);plan.setText(day.rows.map(r=>`${r.time}${r.time&&r.text?'  ':''}${r.text}`).join('\n'));plan.addToPage(page,fieldOpts({x:38,y:280,width:519,height:265}));finishField(plan,font,10);
    page.drawText('Προσωπικές σημειώσεις ημέρας',{x:38,y:250,size:9,font,color:ink});const notes=form.createTextField(`day_${day.day}_notes`);prepareMultiline(notes);notes.setText(day.notes||'');notes.addToPage(page,fieldOpts({x:38,y:80,width:519,height:150}));finishField(notes,font,10);
  }
  return pdf.save({updateFieldAppearances:false});
}
function download(bytes,name){const blob=new Blob([bytes],{type:'application/pdf'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`Horizon-${fileName(name)}-Planner-v2.pdf`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);}
function patchButtons(){document.querySelectorAll('.hz-itinerary-editor [data-download-pdf],.hz-itinerary-editor [data-download-pdf-fixed]').forEach(btn=>{btn.removeAttribute('data-download-pdf');btn.setAttribute('data-download-pdf-fixed','1');btn.textContent='Κατέβασε Planner v2 PDF';});}
function burst(){[0,80,220,600,1200].forEach(ms=>setTimeout(patchButtons,ms));}
function install(){burst();document.addEventListener('click',e=>{const btn=e.target.closest?.('[data-download-pdf-fixed]');if(!btn){burst();return;}e.preventDefault();e.stopImmediatePropagation();const editor=btn.closest('.hz-itinerary-editor');if(!editor)return;(async()=>{try{btn.disabled=true;status(editor,'Δημιουργία Planner v2 PDF με budget & QR…');const data=collect(editor),bytes=await makePdf(data);download(bytes,data.name);status(editor,'Το Planner v2 PDF δημιουργήθηκε: editable budget + QR προς 3D χάρτη.',true);}catch(err){console.error('Horizon PDF v2',err);status(editor,`Η δημιουργία PDF απέτυχε (${err?.message||'άγνωστο σφάλμα'}).`);}finally{btn.disabled=false;}})();},true);}
window.HORIZON_PLANNER_V2_PDF={collect,makePdf,fileName};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

(()=>{
'use strict';
function status(editor,text,ok=false){const el=editor.querySelector('.hz-edit-status');if(el){el.textContent=text;el.style.color=ok?'#8ae5b5':'#91a4b2';}}
function bytesToBase64(bytes){let bin='';const u=new Uint8Array(bytes),step=0x8000;for(let i=0;i<u.length;i+=step)bin+=String.fromCharCode(...u.subarray(i,i+step));return btoa(bin);}
function patch(){document.querySelectorAll('.hz-itinerary-editor [data-email-pdf]').forEach(btn=>{btn.removeAttribute('data-email-pdf');btn.setAttribute('data-email-pdf-v2','1');btn.textContent='Στείλε Planner v2 στο email';});}
function burst(){[0,90,240,650,1300].forEach(ms=>setTimeout(patch,ms));}
function install(){
  burst();
  document.addEventListener('click',e=>{
    const btn=e.target.closest?.('[data-email-pdf-v2]');if(!btn){burst();return;}
    e.preventDefault();e.stopImmediatePropagation();const editor=btn.closest('.hz-itinerary-editor');if(!editor)return;
    const email=editor.querySelector('[data-email]')?.value?.trim();if(!/^\S+@\S+\.\S+$/.test(email||'')){status(editor,'Γράψε πρώτα ένα έγκυρο email.');return;}
    (async()=>{try{
      btn.disabled=true;const api=window.HORIZON_PLANNER_V2_PDF;if(!api)throw new Error('Planner v2 PDF generator unavailable');const endpoint=window.HORIZON_LIVE_CONFIG?.emailPdfEndpoint;if(!endpoint){status(editor,'Το email delivery είναι έτοιμο στον κώδικα, αλλά δεν έχει ενεργοποιηθεί ακόμη ο email provider.');return;}
      status(editor,'Δημιουργία Planner v2 PDF για αποστολή…');const data=api.collect(editor),bytes=await api.makePdf(data);status(editor,'Αποστολή PDF στο email…');
      const res=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,filename:`Horizon-${api.fileName(data.name)}-Planner-v2.pdf`,pdfBase64:bytesToBase64(bytes)})});const body=await res.json().catch(()=>({}));
      if(!res.ok){if(body?.code==='EMAIL_PROVIDER_NOT_CONFIGURED'){status(editor,'Η λειτουργία email είναι έτοιμη, αλλά χρειάζεται να συνδέσουμε τον email provider του Horizon.');return;}throw new Error(body?.error||`Email HTTP ${res.status}`);}
      status(editor,`Το Planner v2 PDF στάλθηκε στο ${email}.`,true);
    }catch(err){console.error('Horizon email v2',err);status(editor,`Η αποστολή email απέτυχε (${err?.message||'άγνωστο σφάλμα'}). Το PDF παραμένει διαθέσιμο για άμεσο κατέβασμα.`);}finally{btn.disabled=false;}})();
  },true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();

(()=>{
'use strict';
const CONSENT_VERSION='2026-11-27';
const SCRIPT='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let turnstilePromise;
function status(editor,text,ok=false){
  const el=editor.querySelector('.hz-edit-status');
  if(el){el.textContent=text;el.style.color=ok?'#8ae5b5':'#c3d0db';}
}
function bytesToBase64(bytes){
  let bin='';const u=new Uint8Array(bytes),step=0x8000;
  for(let i=0;i<u.length;i+=step)bin+=String.fromCharCode(...u.subarray(i,i+step));
  return btoa(bin);
}
function patch(){
  document.querySelectorAll('.hz-itinerary-editor [data-email-pdf]').forEach(btn=>{
    btn.removeAttribute('data-email-pdf');
    btn.setAttribute('data-email-pdf-v2','1');
    btn.textContent='Αποστολή PDF στο email';
  });
}
function burst(){[0,90,240,650,1300].forEach(ms=>setTimeout(patch,ms));}
function loadTurnstile(){
  if(window.turnstile?.render)return Promise.resolve(window.turnstile);
  if(!turnstilePromise)turnstilePromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=SCRIPT;script.async=true;script.referrerPolicy='no-referrer';
    script.onload=()=>window.turnstile?.render?resolve(window.turnstile):
      reject(new Error('Αποτυχία φόρτωσης ελέγχου ασφαλείας'));
    script.onerror=()=>reject(new Error('Δεν φορτώθηκε ο έλεγχος ασφαλείας'));
    document.head.appendChild(script);
  }).catch(err=>{turnstilePromise=null;throw err;});
  return turnstilePromise;
}
async function initializeChallenge(editor,siteKey){
  const target=editor.querySelector('[data-email-turnstile]');
  if(!target)throw new Error('Δεν βρέθηκε η φόρμα ασφαλείας.');
  if(editor._hzEmailTurnstileWidget!==undefined)return;
  const widget=await loadTurnstile();
  // The token is not stored in localStorage, cookies or URL.
  editor._hzEmailTurnstileToken=null;
  editor._hzEmailTurnstileWidget=widget.render(target,{
    sitekey:siteKey,action:'email_pdf',theme:'dark',
    callback:token=>{editor._hzEmailTurnstileToken=token;status(editor,'Ο έλεγχος ολοκληρώθηκε. Πάτησε ξανά αποστολή PDF.');},
    'expired-callback':()=>{editor._hzEmailTurnstileToken=null;status(editor,'Ο έλεγχος έληξε. Ολοκλήρωσέ τον ξανά.');},
    'error-callback':()=>{editor._hzEmailTurnstileToken=null;status(editor,'Ο έλεγχος ασφαλείας απέτυχε. Μπορείς να κατεβάσεις το PDF.');}
  });
}
async function sendPdf(editor,btn){
  const email=editor.querySelector('[data-email]')?.value?.trim()||'';
  if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)){
    status(editor,'Συμπλήρωσε έγκυρο email παραλαβής.');return;
  }
  if(editor.querySelector('[data-email-consent]')?.checked!==true){
    status(editor,'Πριν την αποστολή χρειάζεται να αποδεχτείς τη διαβίβαση του PDF και του email.');return;
  }
  const endpoint=window.HORIZON_LIVE_CONFIG?.emailPdfEndpoint;
  const siteKey=window.HORIZON_LIVE_CONFIG?.turnstileSiteKey;
  if(!endpoint||!siteKey){
    status(editor,'Η ασφαλής αποστολή email δεν έχει ενεργοποιηθεί. Κατέβασε δωρεάν το PDF.');return;
  }
  if(!editor._hzEmailTurnstileToken){
    await initializeChallenge(editor,siteKey);
    if(!editor._hzEmailTurnstileToken)status(editor,'Ολοκλήρωσε τον έλεγχο ασφαλείας και πάτησε ξανά αποστολή.');
    return;
  }
  const token=editor._hzEmailTurnstileToken;
  // A token is consumed exactly once, even if the request times out.
  editor._hzEmailTurnstileToken=null;
  try{
    btn.disabled=true;
    const api=window.HORIZON_PLANNER_V2_PDF;
    if(!api)throw new Error('Ο δημιουργός PDF δεν είναι διαθέσιμος.');
    status(editor,'Δημιουργία Planner PDF…');
    const data=api.collect(editor),bytes=await api.makePdf(data);
    status(editor,'Ασφαλής αποστολή PDF…');
    const res=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({email,filename:`Horizon-${api.fileName(data.name)}-Planner-v2.pdf`,
        pdfBase64:bytesToBase64(bytes),consent:true,consentVersion:CONSENT_VERSION,turnstileToken:token})});
    const result=await res.json().catch(()=>({}));
    if(!res.ok){
      if(['EMAIL_DISABLED','EMAIL_PROTECTION_UNAVAILABLE'].includes(result.code)){
        status(editor,'Η ασφαλής αποστολή δεν είναι ενεργή. Κατέβασε το PDF στη συσκευή σου.');return;
      }
      throw new Error(result.error||`Email HTTP ${res.status}`);
    }
    status(editor,'Ο πάροχος αποδέχτηκε το αίτημα αποστολής PDF. Έλεγξε το email σου.',true);
  }catch(err){
    // Avoid logging email address, PDF content or verification tokens.
    status(editor,'Η αποστολή απέτυχε: '+String(err?.message||'άγνωστο σφάλμα')+
      '. Μπορείς να κατεβάσεις το PDF.');
  }finally{
    try{if(editor._hzEmailTurnstileWidget!==undefined)
      window.turnstile?.reset(editor._hzEmailTurnstileWidget);}catch{}
    btn.disabled=false;
  }
}
function install(){
  burst();
  document.addEventListener('click',event=>{
    const btn=event.target.closest?.('[data-email-pdf-v2]');
    if(!btn){burst();return;}
    event.preventDefault();event.stopImmediatePropagation();
    const editor=btn.closest('.hz-itinerary-editor');
    if(!editor||btn.disabled)return;
    sendPdf(editor,btn).catch(()=>status(editor,'Η αποστολή δεν είναι διαθέσιμη. Κατέβασε το PDF.'));
  },true);
}
if(document.readyState==='loading')
  document.addEventListener('DOMContentLoaded',install,{once:true});
else install();
})();

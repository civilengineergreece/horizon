import v5 from './index-v5.js';

// Email is deliberately fail-closed. It may be activated only when the owner
// has configured a verified sender, secret Turnstile key and a Cloudflare rate
// limit binding. CORS is not authentication against scripted/spam requests.
const JSON_HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'no-store',
  'x-content-type-options':'nosniff','referrer-policy':'no-referrer'};
const CONSENT_VERSION='2026-11-27';
const BILLABLE_SEARCH_PATHS=new Set([
  '/flights','/flight-returns','/flight-booking-options','/stays','/hotel-details'
]);
const EDGE_IP=/^[a-fA-F\\d.:]{2,45}$/;


function allowedOrigin(env){return env.ALLOWED_ORIGIN||'https://civilengineergreece.github.io';}
function cors(request,env){
  const origin=request.headers.get('Origin');
  const allowed=allowedOrigin(env);
  return {...(origin===allowed?{'access-control-allow-origin':origin}:{}),
    'access-control-allow-methods':'POST,OPTIONS',
    'access-control-allow-headers':'content-type',
    'access-control-max-age':'600','vary':'Origin'};
}
function reply(request,env,data,status=200,extra={}){
  return new Response(JSON.stringify(data),{status,headers:{...JSON_HEADERS,...cors(request,env),...extra}});
}
function deny(request,env,status,code,message){
  return reply(request,env,{ok:false,code,error:message},status);
}
function clean(v,max=200){return typeof v==='string'?v.trim().slice(0,max):'';}
function validEmail(v){return typeof v==='string'&&v.length<=254&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v);}
function configured(env){
  return env.EMAIL_PDF_ENABLED==='true'&&!!env.RESEND_API_KEY&&!!env.TURNSTILE_SECRET_KEY&&
    validEmail(clean(env.EMAIL_FROM,254))&&typeof env.EMAIL_PDF_RATE_LIMIT?.limit==='function';
}
function validPdf(b64){
  if(typeof b64!=='string'||b64.length<32||b64.length>8_500_000||
     b64.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(b64))return false;
  try{return atob(b64.slice(0,32)).startsWith('%PDF-');}catch{return false;}
}
function safeFileName(raw){
  const file=clean(raw,140).replace(/[\\/<>:"|?*\x00-\x1f\x7f]/g,'-');
  return /\.pdf$/i.test(file)?file:'Horizon-Planner.pdf';
}
// All potentially paid SerpApi lookups must pass a Cloudflare rate-limit
// binding before legacy endpoint routing. An API key or browser CORS is
// NOT a quota control. Missing protection fails CLOSED, including POST.
async function limitPaidSearch(request,env,url){
  if(!BILLABLE_SEARCH_PATHS.has(url.pathname)||
     !['GET','POST'].includes(request.method))return null;
  const origin=request.headers.get('Origin');
  if(origin!==allowedOrigin(env))
    return deny(request,env,403,'SEARCH_ORIGIN_DENIED',
      'Η αναζήτηση είναι διαθέσιμη μόνο μέσα από το HORIZON.');
  const ip=request.headers.get('CF-Connecting-IP')||'';
  if(!EDGE_IP.test(ip))
    return deny(request,env,403,'SEARCH_CLIENT_UNVERIFIED',
      'Δεν επιβεβαιώθηκε η προέλευση της αναζήτησης.');
  if(typeof env.TRAVEL_SEARCH_RATE_LIMIT?.limit!=='function')
    return deny(request,env,503,'SEARCH_PROTECTION_UNAVAILABLE',
      'Η ασφαλής αναζήτηση δεν είναι προσωρινά διαθέσιμη.');
  try{
    const result=await env.TRAVEL_SEARCH_RATE_LIMIT.limit({key:'search-ip:'+ip});
    if(result?.success!==true)
      return deny(request,env,429,'SEARCH_RATE_LIMIT',
        'Πολλές αναζητήσεις σε μικρό διάστημα. Δοκίμασε αργότερα.');
  }catch{
    return deny(request,env,503,'SEARCH_PROTECTION_UNAVAILABLE',
      'Η ασφαλής αναζήτηση δεν είναι προσωρινά διαθέσιμη.');
  }
  return null;
}
async function emailRecipientKey(email){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(email.toLowerCase()));
  return 'recipient:'+Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function verifyHuman(token,ip,env){
  try{
    const params=new URLSearchParams({secret:env.TURNSTILE_SECRET_KEY,response:token,remoteip:ip});
    const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
      method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:params,
      signal:AbortSignal.timeout(8000)});
    if(!response.ok)return false;
    const result=await response.json();
    return result?.success===true&&result?.action==='email_pdf'&&
      result?.hostname===new URL(allowedOrigin(env)).hostname;
  }catch{return false;}
}
async function emailPdf(request,env){
  // A configured Resend key ALONE is not enough to enable an email relay.
  if(!configured(env))return deny(request,env,503,'EMAIL_DISABLED',
    'Η αποστολή email δεν είναι διαθέσιμη. Κατέβασε το PDF στη συσκευή σου.');
  if(request.headers.get('Origin')!==allowedOrigin(env))
    return deny(request,env,403,'ORIGIN_DENIED','Μη επιτρεπόμενο αίτημα.');
  if(!/application\/json(?:\s*;|\s*$)/i.test(request.headers.get('content-type')||''))
    return deny(request,env,415,'JSON_REQUIRED','Απαιτείται JSON αίτημα.');
  const size=Number(request.headers.get('content-length')||0);
  if(size>9_000_000)return deny(request,env,413,'PAYLOAD_TOO_LARGE','Το PDF είναι πολύ μεγάλο.');
  let input;
  try{
    const raw=await request.text();
    if(raw.length>9_000_000)return deny(request,env,413,'PAYLOAD_TOO_LARGE','Το PDF είναι πολύ μεγάλο.');
    input=JSON.parse(raw);
  }catch{return deny(request,env,400,'INVALID_JSON','Μη έγκυρο αίτημα.');}
  const email=clean(input?.email,254),filename=safeFileName(input?.filename);
  if(!validEmail(email))return deny(request,env,400,'INVALID_EMAIL','Μη έγκυρο email.');
  if(input?.consent!==true||input?.consentVersion!==CONSENT_VERSION)
    return deny(request,env,422,'CONSENT_REQUIRED','Απαιτείται ρητή συγκατάθεση αποστολής PDF.');
  if(!validPdf(input?.pdfBase64))
    return deny(request,env,422,'INVALID_PDF','Επίλεξε έγκυρο PDF για αποστολή.');
  const token=input?.turnstileToken;
  if(typeof token!=='string'||token.length<10||token.length>2048)
    return deny(request,env,403,'HUMAN_VERIFICATION_REQUIRED','Χρειάζεται επιβεβαίωση ασφαλείας.');
  // On Cloudflare incoming requests cf-connecting-ip is controlled by the edge.
  // Never rely on client-supplied X-Forwarded-For for rate-limit keys.
  const ip=request.headers.get('CF-Connecting-IP')||'';
  if(!/^[a-fA-F\d.:]{2,45}$/.test(ip))
    return deny(request,env,403,'CLIENT_ID_REQUIRED','Δεν ήταν δυνατή η επαλήθευση του αιτήματος.');
  try{
    const ipResult=await env.EMAIL_PDF_RATE_LIMIT.limit({key:'ip:'+ip});
    if(ipResult?.success!==true)return deny(request,env,429,'EMAIL_RATE_LIMIT','Πολλά αιτήματα. Δοκίμασε αργότερα.');
  }catch{return deny(request,env,503,'EMAIL_PROTECTION_UNAVAILABLE','Η ασφαλής αποστολή δεν είναι διαθέσιμη.');}
  if(!await verifyHuman(token,ip,env))
    return deny(request,env,403,'HUMAN_VERIFICATION_FAILED','Ο έλεγχος ασφαλείας απέτυχε ή έληξε.');
  try{
    const recipientKey=await emailRecipientKey(email);
    const recipientResult=await env.EMAIL_PDF_RATE_LIMIT.limit({key:recipientKey});
    if(recipientResult?.success!==true)return deny(request,env,429,'EMAIL_RATE_LIMIT','Πολλά αιτήματα. Δοκίμασε αργότερα.');
  }catch{return deny(request,env,503,'EMAIL_PROTECTION_UNAVAILABLE','Η ασφαλής αποστολή δεν είναι διαθέσιμη.');}
  try{
    const result=await fetch('https://api.resend.com/emails',{
      method:'POST',headers:{authorization:`Bearer ${env.RESEND_API_KEY}`,'content-type':'application/json'},
      body:JSON.stringify({from:env.EMAIL_FROM,to:[email],subject:'Το PDF ταξιδιού από το HORIZON',
        html:'<div style="font-family:Arial,sans-serif"><h2>HORIZON Planner</h2><p>Σου επισυνάπτουμε το PDF ταξιδιού που ζήτησες. Δεν αποτελεί επιβεβαίωση κράτησης ή πληρωμής.</p></div>',
        attachments:[{filename,content:input.pdfBase64}]}),
      signal:AbortSignal.timeout(12000)});
    if(!result.ok)return deny(request,env,502,'EMAIL_PROVIDER_ERROR','Η αποστολή απέτυχε. Κατέβασε το PDF.');
    return reply(request,env,{ok:true,status:'submitted_to_email_provider'},200);
  }catch{return deny(request,env,502,'EMAIL_PROVIDER_ERROR','Η αποστολή απέτυχε. Κατέβασε το PDF.');}
}
export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(url.pathname==='/email-pdf'){
      if(request.method==='OPTIONS'){
        if(request.headers.get('Origin')!==allowedOrigin(env))
          return deny(request,env,403,'ORIGIN_DENIED','Μη επιτρεπόμενο αίτημα.');
        return new Response(null,{status:204,headers:{...cors(request,env),'cache-control':'no-store'}});
      }
      if(request.method!=='POST')return deny(request,env,405,'METHOD_NOT_ALLOWED','Χρησιμοποίησε POST.');
      return emailPdf(request,env);
    }
    const denied=await limitPaidSearch(request,env,url);
    if(denied)return denied;
    return v5.fetch(request,env,ctx);
  }
};

import v5 from './index-v5.js';

function cors(request,env){
  const origin=request.headers.get('Origin')||'';
  const allowed=env.ALLOWED_ORIGIN||'https://civilengineergreece.github.io';
  const ok=!origin||origin===allowed||origin.startsWith('http://localhost:')||origin.startsWith('http://127.0.0.1:');
  return {'access-control-allow-origin':ok?(origin||allowed):allowed,'access-control-allow-methods':'POST,OPTIONS','access-control-allow-headers':'content-type','access-control-max-age':'86400','vary':'Origin'};
}
function reply(request,env,data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8',...cors(request,env),'cache-control':'no-store'}});}
function clean(v,max=200){return String(v??'').trim().slice(0,max);}
function validEmail(v){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||''));}

async function emailPdf(request,env){
  if(!env.RESEND_API_KEY)return reply(request,env,{ok:false,code:'EMAIL_PROVIDER_NOT_CONFIGURED',error:'Η αποστολή email είναι έτοιμη τεχνικά αλλά δεν έχει συνδεθεί ακόμη ο email provider του Horizon.'},503);
  let body;try{body=await request.json();}catch{return reply(request,env,{ok:false,error:'Μη έγκυρο αίτημα.'},400);}
  const email=clean(body?.email,254),filename=clean(body?.filename,140)||'Horizon-Planner-v2.pdf',pdfBase64=String(body?.pdfBase64||'');
  if(!validEmail(email))return reply(request,env,{ok:false,error:'Μη έγκυρο email.'},400);
  if(!pdfBase64||pdfBase64.length>9_000_000)return reply(request,env,{ok:false,error:'Το PDF λείπει ή είναι πολύ μεγάλο για email.'},413);
  const from=clean(env.EMAIL_FROM,180)||'Horizon <onboarding@resend.dev>';
  const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:`Bearer ${env.RESEND_API_KEY}`,'content-type':'application/json'},body:JSON.stringify({from,to:[email],subject:'Το Horizon Planner v2 ταξίδι σου',html:'<div style="font-family:Arial,sans-serif"><h2>Horizon Planner v2</h2><p>Σου επισυνάπτουμε το διαδραστικό πρόγραμμα του ταξιδιού σου.</p><p>Το PDF περιλαμβάνει επεξεργάσιμα πεδία, ημερήσιο budget και QR προς τον διαδραστικό χάρτη.</p></div>',attachments:[{filename,content:pdfBase64}]})});
  const data=await r.json().catch(()=>null);
  if(!r.ok)return reply(request,env,{ok:false,code:'EMAIL_PROVIDER_ERROR',error:'Ο email provider δεν ολοκλήρωσε την αποστολή.',details:clean(data?.message||`HTTP ${r.status}`,300)},502);
  return reply(request,env,{ok:true,id:data?.id||null,email});
}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(url.pathname==='/email-pdf'){
      if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors(request,env)});
      if(request.method!=='POST')return reply(request,env,{ok:false,error:'Χρησιμοποίησε POST.'},405);
      return emailPdf(request,env);
    }
    return v5.fetch(request,env,ctx);
  }
};

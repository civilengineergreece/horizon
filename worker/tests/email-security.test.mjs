import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index-v6.js';

const root='https://horizon-live-api.example.workers.dev',origin='https://civilengineergreece.github.io';
const pdf=Buffer.from('%PDF-1.7\nFake privacy unit-test PDF\n%%EOF').toString('base64');
const payload={email:'recipient@example.test',filename:'Family-Trip.pdf',pdfBase64:pdf,
  consent:true,consentVersion:'2026-11-27',turnstileToken:'mock_turnstile_token_123'};
const makeEnv=(rateLimit={limit:async()=>({success:true})})=>({
  ALLOWED_ORIGIN:origin,EMAIL_PDF_ENABLED:'true',EMAIL_FROM:'verified@example.test',
  RESEND_API_KEY:'secret-for-unit-only',TURNSTILE_SECRET_KEY:'turnstile-unit-only',
  EMAIL_PDF_RATE_LIMIT:rateLimit
});
function req(data=payload,extraHeaders={}){
  return new Request(root+'/email-pdf',{method:'POST',
    headers:{origin,'content-type':'application/json','CF-Connecting-IP':'203.0.113.12',...extraHeaders},
    body:JSON.stringify(data)});
}
function mockOutbound(handler){
  const before=globalThis.fetch,requests=[];
  globalThis.fetch=async (url,options)=>{
    requests.push({url:String(url),options});
    return handler(String(url),options,requests.length);
  };
  return {requests,restore:()=>{globalThis.fetch=before;}};
}

test('email relay defaults to closed: a Resend API secret alone cannot enable delivery',async()=>{
  const mock=mockOutbound(()=>{throw Error('Must never send');});
  try{
    const response=await worker.fetch(req(),{RESEND_API_KEY:'configured-but-unprotected'},{});
    assert.equal(response.status,503);
    assert.equal((await response.json()).code,'EMAIL_DISABLED');
    assert.equal(mock.requests.length,0);
    const insecure=makeEnv();delete insecure.TURNSTILE_SECRET_KEY;
    assert.equal((await worker.fetch(req(),insecure,{})).status,503);
    delete insecure.EMAIL_PDF_RATE_LIMIT;
    assert.equal((await worker.fetch(req(),insecure,{})).status,503);
    assert.equal(mock.requests.length,0);
  }finally{mock.restore();}
});

test('email relay rejects cross-origin/no-origin HTTP clients and OPTIONS without billing',async()=>{
  const mock=mockOutbound(()=>{throw Error('Must never send');});
  try{
    const env=makeEnv();
    for(const headers of [{origin:'https://evil.example'},{origin:''}]){
      const res=await worker.fetch(req(payload,headers),env,{});
      assert.equal(res.status,403);
      assert.equal((await res.json()).code,'ORIGIN_DENIED');
      assert.equal(res.headers.get('access-control-allow-origin'),null);
    }
    const blocked=await worker.fetch(new Request(root+'/email-pdf',{method:'OPTIONS',
      headers:{origin:'https://evil.example'}}),env,{});
    assert.equal(blocked.status,403);
    const options=await worker.fetch(new Request(root+'/email-pdf',{method:'OPTIONS',
      headers:{origin}}),env,{});
    assert.equal(options.status,204);
    assert.equal(options.headers.get('access-control-allow-origin'),origin);
    assert.equal(mock.requests.length,0);
  }finally{mock.restore();}
});

test('email requires explicit privacy consent, a PDF and valid security token',async()=>{
  const mock=mockOutbound(()=>{throw Error('Must not contact provider');});
  try{
    const env=makeEnv(),cases=[
      [{...payload,consent:false},422,'CONSENT_REQUIRED'],
      [{...payload,consentVersion:'other'},422,'CONSENT_REQUIRED'],
      [{...payload,pdfBase64:'PGh0bWw+PC9odG1sPg=='},422,'INVALID_PDF'],
      [{...payload,pdfBase64:'data:application/pdf;base64,'+pdf},422,'INVALID_PDF'],
      [{...payload,email:'bad@address'},400,'INVALID_EMAIL'],
      [{...payload,turnstileToken:''},403,'HUMAN_VERIFICATION_REQUIRED']
    ];
    for(const [data,status,code] of cases){
      const res=await worker.fetch(req(data),env,{});
      assert.equal(res.status,status,code);
      assert.equal((await res.json()).code,code);
    }
    const content=await worker.fetch(req(payload,{'content-type':'text/plain'}),env,{});
    assert.equal(content.status,415);
    assert.equal(mock.requests.length,0);
  }finally{mock.restore();}
});

test('valid human-confirmed PDF is submitted once to Resend, with only hashed recipient limiter key',async()=>{
  const keys=[],env=makeEnv({limit:async ({key})=>{keys.push(key);return {success:true};}});
  const mock=mockOutbound((url,options)=>{
    if(url.includes('siteverify')){
      assert.equal(options.method,'POST');
      const sent=new URLSearchParams(options.body);
      assert.equal(sent.get('secret'),env.TURNSTILE_SECRET_KEY);
      assert.equal(sent.get('response'),payload.turnstileToken);
      return Response.json({success:true,action:'email_pdf',hostname:'civilengineergreece.github.io'});
    }
    assert.equal(url,'https://api.resend.com/emails');
    const email=JSON.parse(options.body);
    assert.deepEqual(email.to,['recipient@example.test']);
    assert.equal(email.from,'verified@example.test');
    assert.equal(email.attachments[0].content,pdf);
    assert.equal(email.attachments[0].filename,'Family-Trip.pdf');
    assert.ok(!/confirmed|booked/i.test(email.subject));
    return Response.json({id:'simulated-provider-accepted'});
  });
  try{
    const res=await worker.fetch(req(),env,{});
    assert.equal(res.status,200);
    assert.deepEqual(await res.json(),{ok:true,status:'submitted_to_email_provider'});
    assert.equal(mock.requests.length,2);
    assert.equal(keys.length,2);
    assert.equal(keys[0],'ip:203.0.113.12');
    assert.match(keys[1],/^recipient:[a-f0-9]{64}$/);
    assert.ok(!keys[1].includes('recipient@example.test'),'Plain email cannot be rate-limit key');
    assert.equal(res.headers.get('cache-control'),'no-store');
    assert.equal(res.headers.get('x-content-type-options'),'nosniff');
  }finally{mock.restore();}
});

test('wrong Turnstile action or hostname never sends an email',async()=>{
  for(const verification of [
    {success:true,action:'login',hostname:'civilengineergreece.github.io'},
    {success:true,action:'email_pdf',hostname:'attacker.example'},
    {success:false,action:'email_pdf',hostname:'civilengineergreece.github.io'}
  ]){
    const mock=mockOutbound((url)=>{
      assert.ok(url.includes('siteverify'),'Only Turnstile is called');
      return Response.json(verification);
    });
    try{
      const response=await worker.fetch(req(),makeEnv(),{});
      assert.equal(response.status,403);
      assert.equal((await response.json()).code,'HUMAN_VERIFICATION_FAILED');
      assert.equal(mock.requests.length,1);
    }finally{mock.restore();}
  }
});

test('IP and recipient rate limit fail closed before sending to an email provider',async()=>{
  const blockedIP=makeEnv({limit:async()=>({success:false})});
  const noCalls=mockOutbound(()=>{throw Error('No paid provider calls allowed');});
  try{
    const resp=await worker.fetch(req(),blockedIP,{});
    assert.equal(resp.status,429);
    assert.equal((await resp.json()).code,'EMAIL_RATE_LIMIT');
    assert.equal(noCalls.requests.length,0);
  }finally{noCalls.restore();}
  const env=makeEnv({limit:async ({key})=>({success:!key.startsWith('recipient:')})});
  const mock=mockOutbound(url=>{
    assert.ok(url.includes('siteverify'));
    return Response.json({success:true,action:'email_pdf',hostname:'civilengineergreece.github.io'});
  });
  try{
    const resp=await worker.fetch(req(),env,{});
    assert.equal(resp.status,429);
    assert.equal((await resp.json()).code,'EMAIL_RATE_LIMIT');
    assert.equal(mock.requests.length,1,'Blocked recipient is never emailed');
  }finally{mock.restore();}
});

test('invalid PDF/large payload and provider errors expose no keys, email or file content',async()=>{
  const env=makeEnv(),mock=mockOutbound(url=>{
    if(url.includes('siteverify'))
      return Response.json({success:true,action:'email_pdf',hostname:'civilengineergreece.github.io'});
    return Response.json({message:'Provider said something about recipient@example.test and secret-for-unit-only'},
      {status:500});
  });
  try{
    const bad=await worker.fetch(req({...payload,pdfBase64:'garbage'}),env,{});
    assert.equal(bad.status,422);
    const large=await worker.fetch(req(payload,{'content-length':'9000001'}),env,{});
    assert.equal(large.status,413);
    const failed=await worker.fetch(req(),env,{});
    assert.equal(failed.status,502);
    const body=JSON.stringify(await failed.json());
    assert.ok(!body.includes(payload.email));
    assert.ok(!body.includes(env.RESEND_API_KEY));
    assert.ok(!body.includes('Provider said'));
    assert.equal(mock.requests.length,2);
  }finally{mock.restore();}
});

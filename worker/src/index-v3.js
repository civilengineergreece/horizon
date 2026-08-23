import base from './index-v2.js';

function norm(v){return String(v||'').trim().toLocaleLowerCase('el-GR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');}

const ATHENS_ORIGINS=new Set(['αθηνα','athens','athina']);
const RAFINA_FIRST=new Set(['ανδρος','τηνος','μυκονος']);
const LAVRIO_FIRST=new Set(['κεα','κυθνος']);

function portOrder(destination){
  const d=norm(destination);
  if(RAFINA_FIRST.has(d))return ['Rafina','Piraeus','Lavrio'];
  if(LAVRIO_FIRST.has(d))return ['Lavrio','Piraeus','Rafina'];
  return ['Piraeus','Rafina','Lavrio'];
}

async function ferryViaPort(request,env,ctx,port){
  const u=new URL(request.url);
  u.searchParams.set('origin',port);
  const r=await base.fetch(new Request(u.toString(),request),env,ctx);
  let data=null;
  try{data=await r.clone().json();}catch{}
  return {r,data,port};
}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(url.pathname==='/ferries'&&request.method==='GET'&&ATHENS_ORIGINS.has(norm(url.searchParams.get('origin')))){
      const ports=portOrder(url.searchParams.get('destination'));
      let last=null;
      for(const port of ports){
        const attempt=await ferryViaPort(request,env,ctx,port);
        last=attempt;
        if(attempt.r.ok&&attempt.data?.ok&&((attempt.data.outbound?.length||0)>0||(attempt.data.inbound?.length||0)>0)){
          attempt.data.requestedOrigin='Αθήνα';
          attempt.data.ferryPort=port;
          attempt.data.portFallbackUsed=port!==ports[0];
          const headers=new Headers(attempt.r.headers);
          headers.set('content-type','application/json; charset=utf-8');
          return new Response(JSON.stringify(attempt.data),{status:attempt.r.status,headers});
        }
      }
      if(last?.data){
        last.data.requestedOrigin='Αθήνα';
        last.data.ferryPortsTried=ports;
        const headers=new Headers(last.r.headers);headers.set('content-type','application/json; charset=utf-8');
        return new Response(JSON.stringify(last.data),{status:last.r.status,headers});
      }
      return last?.r||base.fetch(request,env,ctx);
    }
    return base.fetch(request,env,ctx);
  }
};

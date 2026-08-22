window.HORIZON_LIVE_CONFIG={
  apiBase:'https://horizon-live-api.gnchristou.workers.dev',
  enabled:true
};
(()=>{
  try{
    const u=new URL(location.href);
    if(u.searchParams.has('flightSearch')){
      u.searchParams.delete('flightSearch');
      history.replaceState(history.state,'',u.pathname+(u.search||'')+(u.hash||''));
    }
  }catch(e){}

  const loadScript=(src,attr,done)=>{
    const existing=document.querySelector(`script[${attr}]`);
    if(existing){done?.();return;}
    const s=document.createElement('script');
    s.src=src;
    s.setAttribute(attr,'1');
    if(done){s.onload=done;s.onerror=done;}
    document.body.appendChild(s);
  };

  const installHotelFetchBridge=()=>{
    if(window.__HORIZON_STAYS_FETCH_BRIDGE__)return;
    window.__HORIZON_STAYS_FETCH_BRIDGE__=true;
    const nativeFetch=window.fetch.bind(window);
    const apiOrigin=(()=>{try{return new URL(window.HORIZON_LIVE_CONFIG.apiBase).origin;}catch{return '';}})();
    window.fetch=async(input,init={})=>{
      try{
        const raw=typeof input==='string'?input:input?.url;
        const reqUrl=new URL(raw,location.href);
        const method=String(init?.method||(typeof input!=='string'&&input?.method)||'GET').toUpperCase();
        if(apiOrigin&&reqUrl.origin===apiOrigin&&reqUrl.pathname==='/stays'&&method==='POST'){
          const payload=JSON.parse(String(init?.body||'{}'));
          const u=new URL(`${apiOrigin}/stays`);
          u.searchParams.set('destination',String(payload.destination||''));
          u.searchParams.set('checkInDate',String(payload.checkInDate||''));
          u.searchParams.set('checkOutDate',String(payload.checkOutDate||''));
          u.searchParams.set('adults',String(payload.adults||2));
          u.searchParams.set('children',String((Number(payload.children)||0)+(Number(payload.infants)||0)));
          u.searchParams.set('kind',String(payload.kind||window.__HORIZON_STAY_KIND__||'hotels'));
          const res=await nativeFetch(u.toString(),{method:'GET',signal:init?.signal});
          const cacheStatus=String(res.headers.get('cf-cache-status')||res.headers.get('x-horizon-cache')||'').toUpperCase();
          const data=await res.clone().json().catch(()=>null);
          if(data&&typeof data==='object'){
            data.cache={...(data.cache||{}),hit:cacheStatus==='HIT'};
            const headers=new Headers(res.headers);
            headers.set('content-type','application/json; charset=utf-8');
            return new Response(JSON.stringify(data),{status:res.status,statusText:res.statusText,headers});
          }
          return res;
        }
      }catch(e){}
      return nativeFetch(input,init);
    };
  };

  const loadStayTools=()=>{
    loadScript('hotels-panel.js?v=20260822-9','data-horizon-hotels-panel',()=>{
      loadScript('stay-ui-el-safe.js?v=20260822-1','data-horizon-stay-ui-safe',()=>window.HorizonStayUiSafe?.attach?.());
      setTimeout(()=>window.HorizonHotels?.refresh?.(),0);
    });
  };

  const loadFlightTools=()=>{
    loadScript('travelpayouts-lazy.js?v=20260822-3','data-horizon-flights-lazy',()=>{
      setTimeout(()=>window.HorizonFlightsLazy?.refresh?.(),0);
    });
    setTimeout(()=>window.HorizonFlightDurationCore?.patch?.(),25);
  };

  const installLazyActionLoader=()=>{
    if(window.__HORIZON_LAZY_ACTION_LOADER__)return;
    window.__HORIZON_LAZY_ACTION_LOADER__=true;
    document.addEventListener('click',e=>{
      const action=e.target.closest('.destination .actions a,.destination .actions button');
      if(!action)return;
      const txt=(action.textContent||'').trim().toLowerCase();
      if(txt.includes('διαμον'))setTimeout(loadStayTools,0);
      else if(txt.includes('μεταφορ'))setTimeout(loadFlightTools,0);
    },true);
  };

  const boot=()=>{
    installHotelFetchBridge();
    installLazyActionLoader();
    loadScript('flight-duration-core.js?v=20260822-1','data-horizon-flight-duration-core');
    if(!document.querySelector('script[data-horizon-travelers]')){
      loadScript('traveler-categories.js?v=20260822-3','data-horizon-travelers');
    }
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

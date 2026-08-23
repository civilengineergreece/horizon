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
          const res=await nativeFetch(u.toString(),{method:'GET',signal:init?.signal});
          const cacheStatus=String(res.headers.get('cf-cache-status')||res.headers.get('x-horizon-cache')||'').toUpperCase();
          const data=await res.clone().json().catch(()=>null);
          if(data&&typeof data==='object'){
            data.cache={...(data.cache||{}),hit:cacheStatus==='HIT'};
            const headers=new Headers(res.headers);headers.set('content-type','application/json; charset=utf-8');
            return new Response(JSON.stringify(data),{status:res.status,statusText:res.statusText,headers});
          }
          return res;
        }
      }catch(e){}
      return nativeFetch(input,init);
    };
  };

  const loadScript=(src,attr,done)=>{
    if(document.querySelector(`script[${attr}]`)){done?.();return;}
    const s=document.createElement('script');s.async=false;s.src=src;s.setAttribute(attr,'1');
    if(done){s.onload=done;s.onerror=done;}document.body.appendChild(s);
  };

  const loadEnhancements=()=>{
    installHotelFetchBridge();
    loadScript('transport-choice-ui-fix.js?v=20260823-1','data-horizon-transport-choice-fix');
    loadScript('interest-categories.js?v=20260823-1','data-horizon-interest-categories');
    loadScript('flight-times-core.js?v=20260822-2','data-horizon-flight-times-core');
    loadScript('results-truth.js?v=20260822-2','data-horizon-results-truth');
    loadScript('transport-label-fix.js?v=20260822-2','data-horizon-transport-labels');
    loadScript('hotels-panel.js?v=20260822-7','data-horizon-hotels-panel');
    loadScript('flights-panel.js?v=20260822-2','data-horizon-flights-panel');
    loadScript('trip-prefill-ui.js?v=20260823-1','data-horizon-trip-prefill');
    loadScript('multimodal-transport.js?v=20260823-3','data-horizon-multimodal');
    loadScript('multimodal-safety.js?v=20260823-2','data-horizon-multimodal-safety');
    loadScript('transport-results-compare.js?v=20260823-1','data-horizon-transport-results-compare');
    loadScript('surface-live.js?v=20260823-1','data-horizon-surface-live');
  };

  const load=()=>{
    if(document.querySelector('script[data-horizon-travelers]')){loadEnhancements();return;}
    const s=document.createElement('script');s.async=false;s.src='traveler-categories.js?v=20260822-3';s.dataset.horizonTravelers='1';
    s.onload=loadEnhancements;s.onerror=loadEnhancements;document.body.appendChild(s);
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
})();

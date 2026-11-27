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
      let reqUrl,method,payload;
      try{
        const raw=typeof input==='string'?input:input?.url;
        reqUrl=new URL(raw,location.href);
        method=String(init?.method||(typeof input!=='string'&&input?.method)||'GET').toUpperCase();
        if(!(apiOrigin&&reqUrl.origin===apiOrigin&&reqUrl.pathname==='/stays'&&method==='POST'))
          return nativeFetch(input,init);
        payload=JSON.parse(String(init?.body||'{}'));
      }catch(e){
        // Don't silently retry an unsuccessful /stays request with a different HTTP method.
        if(reqUrl?.origin===apiOrigin&&reqUrl?.pathname==='/stays'&&method==='POST')throw e;
        return nativeFetch(input,init);
      }
      const u=new URL(apiOrigin+'/stays');
      for(const [key,value] of Object.entries({
        destination:String(payload.destination||''),
        checkInDate:String(payload.checkInDate||''),
        checkOutDate:String(payload.checkOutDate||''),
        adults:String(payload.adults??2),
        children:String(payload.children??0),
        infants:String(payload.infants??0)
      }))u.searchParams.set(key,value);
      for(const key of ['rooms','roomsCount','roomCount','roomAllocations'])
        if(payload[key]!==undefined)u.searchParams.set(key,typeof payload[key]==='object'?JSON.stringify(payload[key]):String(payload[key]));
      if(Array.isArray(payload.childrenAges)&&payload.childrenAges.length)
        u.searchParams.set('childrenAges',payload.childrenAges.join(','));
      if(payload.nextPageToken)u.searchParams.set('nextPageToken',String(payload.nextPageToken));
      if(payload.pageSize)u.searchParams.set('pageSize',String(payload.pageSize));
      // Propagate timeout/network failures; never mask them by retrying POST.
      const res=await nativeFetch(u.toString(),{method:'GET',signal:init?.signal});
      const cacheStatus=String(res.headers.get('cf-cache-status')||
        res.headers.get('x-horizon-cache')||'').toUpperCase();
      const data=await res.clone().json().catch(()=>null);
      if(data&&typeof data==='object'){
        data.cache={...(data.cache||{}),hit:data.cache?.hit===true||cacheStatus==='HIT'};
        const headers=new Headers(res.headers);
        headers.set('content-type','application/json; charset=utf-8');
        return new Response(JSON.stringify(data),{
          status:res.status,statusText:res.statusText,headers
        });
      }
      return res;
    };
  };

  const loadScript=(src,attr,done)=>{
    if(document.querySelector(`script[${attr}]`)){done?.();return;}
    const s=document.createElement('script');s.async=false;s.src=src;s.setAttribute(attr,'1');
    if(done){s.onload=done;s.onerror=done;}document.body.appendChild(s);
  };

  const loadEnhancements=()=>{
    installHotelFetchBridge();
    loadScript('transport-choice-ui-fix.js?v=20260823-2','data-horizon-transport-choice-fix');
    loadScript('interest-categories.js?v=20260823-1','data-horizon-interest-categories');
    loadScript('flight-times-core.js?v=20260822-2','data-horizon-flight-times-core');
    loadScript('results-truth.js?v=20261127-7','data-horizon-results-truth');
    loadScript('transport-label-fix.js?v=20260822-2','data-horizon-transport-labels');
    loadScript('hotel-climate-fee.js?v=20261119-2','data-horizon-hotel-climate-fee');
    loadScript('hotels-panel.js?v=20261119-11','data-horizon-hotels-panel');
    loadScript('hotels-map.js?v=20261119-1','data-horizon-hotels-map');
    loadScript('hotel-checkout-audit.js?v=20261119-6','data-horizon-hotel-checkout-audit');
    loadScript('flight-ground-cost.js?v=20261119-1','data-horizon-flight-ground-cost');
    loadScript('flight-infant-fare-rules.js?v=20261119-1','data-horizon-infant-fares');
    loadScript('flights-panel.js?v=20261127-7','data-horizon-flights-panel');
    loadScript('flight-checkout-audit.js?v=20261127-1','data-horizon-flight-checkout-audit');
    loadScript('trip-prefill-ui.js?v=20261119-5','data-horizon-trip-prefill');
    loadScript('multimodal-transport.js?v=20261127-4','data-horizon-multimodal');
    loadScript('multimodal-safety.js?v=20260823-2','data-horizon-multimodal-safety');
    loadScript('transport-results-compare.js?v=20261127-7','data-horizon-transport-results-compare');
    loadScript('airport-transport-fix.js?v=20260823-1','data-horizon-airport-transport-fix');
    loadScript('surface-live.js?v=20261127-4','data-horizon-surface-live');
    loadScript('prototype-transport-policy.js?v=20261127-4','data-horizon-prototype-transport-policy');
    loadScript('train-live.js?v=20261127-3','data-horizon-train-live');
    loadScript('train-match-fix.js?v=20260823-1','data-horizon-train-match-fix');
    loadScript('train-card-truth.js?v=20260823-1','data-horizon-train-card-truth');
    loadScript('live-transport-cta.js?v=20260823-1','data-horizon-live-transport-cta');
    loadScript('planner-uncertain-options.js?v=20260823-1','data-horizon-planner-uncertain');
    loadScript('transport-cleanup-v1.js?v=20261127-3','data-horizon-transport-cleanup');
    loadScript('itinerary-editor.js?v=20261127-2','data-horizon-itinerary-editor');
    loadScript('planner-v2.js?v=20261127-1','data-horizon-planner-v2');
    loadScript('itinerary-pdf-fix.js?v=20261127-3','data-horizon-itinerary-pdf-fix');
    loadScript('itinerary-feasibility.js?v=20261127-2','data-horizon-itinerary-feasibility');
    loadScript('email-delivery-v2.js?v=20260825-1','data-horizon-email-v2');
  };

  const load=()=>{
    if(document.querySelector('script[data-horizon-travelers]')){loadEnhancements();return;}
    const s=document.createElement('script');s.async=false;s.src='traveler-categories.js?v=20261119-4';s.dataset.horizonTravelers='1';
    s.onload=loadEnhancements;s.onerror=loadEnhancements;document.body.appendChild(s);
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
})();

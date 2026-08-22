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
    if(document.querySelector(`script[${attr}]`)){done?.();return;}
    const s=document.createElement('script');
    s.src=src;
    s.setAttribute(attr,'1');
    if(done){s.onload=done;s.onerror=done;}
    document.body.appendChild(s);
  };

  const loadEnhancements=()=>{
    loadScript('transport-label-fix.js?v=20260822-2','data-horizon-transport-labels');
    loadScript('hotels-panel.js?v=20260822-5','data-horizon-hotels-panel');
    loadScript('travelpayouts-lazy.js?v=20260822-1','data-horizon-flights-lazy');
  };

  const load=()=>{
    if(document.querySelector('script[data-horizon-travelers]')){loadEnhancements();return;}
    const s=document.createElement('script');
    s.src='traveler-categories.js?v=20260822-3';
    s.dataset.horizonTravelers='1';
    s.onload=loadEnhancements;
    s.onerror=loadEnhancements;
    document.body.appendChild(s);
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
})();

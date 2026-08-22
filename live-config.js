window.HORIZON_LIVE_CONFIG={
  apiBase:'https://horizon-live-api.gnchristou.workers.dev',
  enabled:true
};
(()=>{
  // Safety cleanup for the old Travelpayouts deep-link parameter.
  try{
    const u=new URL(location.href);
    if(u.searchParams.has('flightSearch')){
      u.searchParams.delete('flightSearch');
      history.replaceState(history.state,'',u.pathname+(u.search||'')+(u.hash||''));
    }
  }catch(e){}

  // Keep the improved traveler age categories, but do NOT load
  // Travelpayouts until we re-integrate it without URL/deep-link side effects.
  const load=()=>{
    if(document.querySelector('script[data-horizon-travelers]'))return;
    const s=document.createElement('script');
    s.src='traveler-categories.js?v=20260822-3';
    s.dataset.horizonTravelers='1';
    document.body.appendChild(s);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
})();

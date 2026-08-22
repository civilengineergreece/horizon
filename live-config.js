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

  const loadFlightsGate=()=>{
    if(document.querySelector('script[data-horizon-flights-lazy]'))return;
    const s=document.createElement('script');
    s.src='travelpayouts-lazy.js?v=20260822-1';
    s.dataset.horizonFlightsLazy='1';
    document.body.appendChild(s);
  };

  const load=()=>{
    if(document.querySelector('script[data-horizon-travelers]')){loadFlightsGate();return;}
    const s=document.createElement('script');
    s.src='traveler-categories.js?v=20260822-3';
    s.dataset.horizonTravelers='1';
    s.onload=loadFlightsGate;
    s.onerror=loadFlightsGate;
    document.body.appendChild(s);
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
})();

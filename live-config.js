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

  const loadFlights=()=>{
    if(document.querySelector('script[data-horizon-travelpayouts]'))return;
    const s=document.createElement('script');
    s.src='travelpayouts.js?v=20260822-5';
    s.dataset.horizonTravelpayouts='1';
    document.body.appendChild(s);
  };
  const load=()=>{
    if(document.querySelector('script[data-horizon-travelers]')){loadFlights();return;}
    const s=document.createElement('script');
    s.src='traveler-categories.js?v=20260822-2';
    s.dataset.horizonTravelers='1';
    s.onload=loadFlights;
    s.onerror=loadFlights;
    document.body.appendChild(s);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
})();

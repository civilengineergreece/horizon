window.HORIZON_LIVE_CONFIG={
  apiBase:'https://horizon-live-api.gnchristou.workers.dev',
  enabled:true
};
(()=>{
  const load=()=>{
    if(document.querySelector('script[data-horizon-travelpayouts]'))return;
    const s=document.createElement('script');
    s.src='travelpayouts.js?v=20260822-4';
    s.dataset.horizonTravelpayouts='1';
    document.body.appendChild(s);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
})();

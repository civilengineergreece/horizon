window.HORIZON_LIVE_CONFIG={
  apiBase:'https://horizon-live-api.gnchristou.workers.dev',
  enabled:true
};
window.addEventListener('load',()=>{
  if(document.querySelector('script[data-horizon-road-roundtrip]'))return;
  const s=document.createElement('script');
  s.src='live-road-roundtrip.js';
  s.dataset.horizonRoadRoundtrip='1';
  document.body.appendChild(s);
});

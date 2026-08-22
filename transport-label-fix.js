(()=>{
'use strict';

function travelState(){return typeof state!=='undefined'&&state?state:{};}
function scoredByName(name){return (typeof scored!=='undefined'&&Array.isArray(scored)?scored:[]).find(d=>d.name===name)||{};}

function isPlaneOverlay(overlay){
  const name=overlay.querySelector('.hd-head h3')?.textContent?.trim()||'';
  const d=scoredByName(name);
  const mode=d.transportMode||travelState().transport;
  if(mode==='plane')return true;
  return !!overlay.querySelector('.hz-flight-gate')||/αεροπλάνο|αεροπορικά/i.test(overlay.textContent||'');
}

function fixOverlay(overlay){
  if(!overlay||!isPlaneOverlay(overlay))return;

  overlay.querySelectorAll('.hd-card').forEach(card=>{
    const small=card.querySelector('small');
    const value=card.querySelector('b');
    if(small?.textContent?.trim()==='Μέσο'&&value&&value.textContent!=='Αεροπλάνο'){
      value.textContent='Αεροπλάνο';
    }
  });

  overlay.querySelectorAll('.hd-hero small,.hd-hero p,.hd-hero div').forEach(el=>{
    const txt=el.textContent?.trim()||'';
    if(/^Μεταφορά\s*·/i.test(txt)){
      const next=txt.replace(/^Μεταφορά/i,'Αεροπορικά μετ’ επιστροφής');
      if(next!==txt)el.textContent=next;
    }
  });
}

let scheduled=false;
function refresh(){
  scheduled=false;
  document.querySelectorAll('.horizon-detail-overlay').forEach(fixOverlay);
}
function scheduleRefresh(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(refresh);
}
function init(){
  const observer=new MutationObserver(mutations=>{
    if(mutations.some(m=>m.addedNodes&&m.addedNodes.length))scheduleRefresh();
  });
  observer.observe(document.body,{childList:true,subtree:true});
  scheduleRefresh();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();

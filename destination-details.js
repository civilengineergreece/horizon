(()=>{
'use strict';

const STYLE_ID='horizon-detail-panel-style';
const OVERLAY_ID='horizon-detail-overlay';
const SAVED_KEY='horizon-saved-destination';

const activityOverrides={
  'Ναύπλιο':['Παλαμήδι & πανοραμική θέα','Βόλτα στην Παλιά Πόλη','Μπούρτζι & παραλιακός περίπατος','Αρβανιτιά','Καραθώνα & χαλαρό μπάνιο'],
  'Καλαμάτα':['Ιστορικό κέντρο','Παραλιακή βόλτα','Κάστρο Καλαμάτας','Τοπική γαστρονομία & ελιές','Εκδρομή προς Μάνη'],
  'Πήλιο':['Παραδοσιακά χωριά','Διαδρομές στη φύση','Παραλίες Αιγαίου','Τοπική γαστρονομία','Θέα Παγασητικού'],
  'Μονεμβασιά':['Καστροπολιτεία','Άνω Πόλη','Παραλιακός περίπατος','Τοπικά κρασιά & γεύσεις','Ηλιοβασίλεμα στα τείχη'],
  'Χαλκιδική':['Παραλίες & κολπίσκοι','Παραθαλάσσιο φαγητό','Ηλιοβασίλεμα','Μικρές ημερήσιες εκδρομές','Χαλαρή οικογενειακή ημέρα'],
  'Πάργα':['Κάστρο Πάργας','Παραλία Βάλτος','Παραλιακός περίπατος','Νησάκι Παναγιάς','Τοπική γαστρονομία'],
  'Σαντορίνη':['Οία & ηλιοβασίλεμα','Φηρά–Ημεροβίγλι','Καλντέρα','Παραλίες ηφαιστειακής άμμου','Οινογνωσία'],
  'Μύκονος':['Χώρα & Μικρή Βενετία','Ανεμόμυλοι','Παραλίες','Άνω Μερά','Βραδινή έξοδος'],
  'Ρώμη':['Κολοσσαίο & Forum','Πάνθεον','Trastevere','Βατικανό','Piazza Navona & βραδινή βόλτα'],
  'Βαρκελώνη':['Sagrada Família','Gothic Quarter','Park Güell','Παραλία Barceloneta','Tapas & βραδινή βόλτα'],
  'Παρίσι':['Σηκουάνας & Île de la Cité','Λούβρο','Montmartre','Πύργος του Άιφελ','Bistro & βραδινή βόλτα'],
  'Λονδίνο':['Westminster','South Bank','British Museum','Covent Garden','Pub & West End'],
  'Κωνσταντινούπολη':['Αγία Σοφία & Sultanahmet','Βόσπορος','Grand Bazaar','Galata','Τοπική γαστρονομία'],
  'Ντουμπρόβνικ':['Παλιά Πόλη & τείχη','Stradun','Τελεφερίκ & θέα','Παραλία','Ηλιοβασίλεμα στο λιμάνι'],
  'Κότορ':['Παλιά Πόλη','Κάστρο San Giovanni','Κόλπος Κότορ','Παραλιακή βόλτα','Τοπική γαστρονομία']
};

function ensureStyles(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
  .horizon-detail-overlay{position:fixed;inset:0;z-index:120;background:rgba(2,8,14,.78);backdrop-filter:blur(10px);display:flex;justify-content:flex-end;animation:hdoFade .18s ease}
  .horizon-detail-panel{width:min(680px,96vw);height:100%;overflow:auto;background:linear-gradient(180deg,#102537 0,#091a28 100%);border-left:1px solid rgba(255,255,255,.12);box-shadow:-28px 0 80px rgba(0,0,0,.42);padding:0 0 34px;animation:hdoSlide .24s ease}
  .hd-head{position:sticky;top:0;z-index:2;padding:24px 26px 18px;background:rgba(9,26,40,.94);backdrop-filter:blur(14px);border-bottom:1px solid rgba(255,255,255,.09)}
  .hd-top{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.hd-eyebrow{color:#ff9d4d;font-size:.76rem;letter-spacing:.11em;text-transform:uppercase;font-weight:900}.hd-head h3{font-size:2rem;line-height:1.05;margin:5px 0 5px}.hd-sub{color:#9fb0bd;font-size:.88rem}.hd-close{width:42px;height:42px;border-radius:50%;border:1px solid rgba(255,255,255,.13);background:rgba(255,255,255,.04);color:white;font-size:1.35rem;cursor:pointer}.hd-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:18px}.hd-tab{border:1px solid rgba(255,255,255,.1);background:#0a1b29;color:#cbd5dc;border-radius:11px;padding:10px 8px;font-weight:800;cursor:pointer}.hd-tab.active{border-color:#ff7a16;background:rgba(255,122,22,.11);color:white}
  .hd-body{padding:24px 26px}.hd-pane{display:none}.hd-pane.active{display:block}.hd-hero{padding:18px;border:1px solid rgba(255,122,22,.25);background:linear-gradient(120deg,rgba(255,122,22,.10),rgba(255,255,255,.02));border-radius:17px;margin-bottom:16px}.hd-hero small{color:#93a8b7;display:block}.hd-hero strong{font-size:1.45rem;display:block;margin-top:3px}.hd-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.hd-card{border:1px solid rgba(255,255,255,.09);border-radius:15px;background:rgba(255,255,255,.035);padding:15px}.hd-card small{display:block;color:#8fa3b2;margin-bottom:5px}.hd-card b{display:block}.hd-section{margin-top:20px}.hd-section h4{margin:0 0 10px;font-size:1rem}.hd-list{display:grid;gap:8px}.hd-item{display:flex;gap:11px;align-items:flex-start;padding:11px 12px;border-radius:12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07)}.hd-num{display:grid;place-items:center;flex:0 0 26px;height:26px;border-radius:8px;background:rgba(255,122,22,.13);color:#ff9d4d;font-size:.75rem;font-weight:900}.hd-note{color:#a7b6c1;font-size:.84rem}.hd-cta-row{display:flex;gap:9px;flex-wrap:wrap;margin-top:20px}.hd-cta{border:1px solid rgba(255,255,255,.13);border-radius:11px;padding:11px 13px;background:#0b1d2b;color:white;font-weight:800;cursor:pointer;text-decoration:none}.hd-cta.primary{border-color:transparent;background:linear-gradient(180deg,#ff8b29,#df5e08)}.hd-save.saved{border-color:#65d39a;color:#8ae5b5}.hd-mini-plan{display:grid;gap:9px}.hd-plan-row{display:grid;grid-template-columns:92px 1fr;gap:10px;align-items:start}.hd-plan-time{color:#ff9d4d;font-weight:900;font-size:.8rem;padding-top:2px}.hd-plan-copy{padding-bottom:9px;border-bottom:1px solid rgba(255,255,255,.07)}
  @keyframes hdoFade{from{opacity:0}to{opacity:1}}@keyframes hdoSlide{from{transform:translateX(35px);opacity:.6}to{transform:translateX(0);opacity:1}}
  @media(max-width:620px){.horizon-detail-panel{width:100vw}.hd-head,.hd-body{padding-left:18px;padding-right:18px}.hd-head h3{font-size:1.65rem}.hd-grid{grid-template-columns:1fr}.hd-tabs{font-size:.8rem}}
  `;
  document.head.appendChild(style);
}

function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
function q(v){return encodeURIComponent(String(v||''));}
function labelMode(mode){return mode==='car'?'ΙΧ':mode==='plane'?'Αεροπλάνο':mode==='ferry'?'Πλοίο':'Μεταφορά';}
function textFrom(card,selector){return card.querySelector(selector)?.textContent?.trim()||'';}
function extractBreak(card,index){const el=card.querySelectorAll('.break')[index];return el?el.innerText.trim():'';}
function findDestination(name){return (window.HORIZON_DESTINATIONS||[]).find(d=>d.name===name)||{};}
function getTags(d,card){const fromData=Array.isArray(d.tags)?d.tags:[];const fromCard=[...card.querySelectorAll('.tag')].map(x=>x.textContent.trim());return [...new Set([...fromData,...fromCard])];}
function activityIdeas(name,tags){
  if(activityOverrides[name])return activityOverrides[name];
  const ideas=[];
  if(tags.includes('sea'))ideas.push('Παραλία ή παραθαλάσσιος περίπατος','Χαλαρό γεύμα δίπλα στη θάλασσα');
  if(tags.includes('history'))ideas.push('Ιστορικό κέντρο & βασικά μνημεία','Μουσείο ή πολιτιστικό σημείο');
  if(tags.includes('nature'))ideas.push('Διαδρομή στη φύση ή viewpoint','Χαλαρή υπαίθρια δραστηριότητα');
  if(tags.includes('food'))ideas.push('Τοπική αγορά & γαστρονομία','Δείπνο με τοπικές σπεσιαλιτέ');
  if(tags.includes('nightlife'))ideas.push('Βραδινή βόλτα & ποτό');
  return [...new Set(ideas)].slice(0,5).concat(['Ελεύθερος χρόνος για αυθόρμητη εξερεύνηση']).slice(0,5);
}
function stayAdvice(d,tags){
  if(tags.includes('sea'))return ['Κοντά στην παραλία ή σε παραλιακή ζώνη','Εύκολη πρόσβαση σε φαγητό και βραδινή βόλτα','Δωρεάν parking αν ταξιδεύεις με ΙΧ'];
  if(d.type==='city')return ['Ιστορικό κέντρο ή walkable γειτονιά','Κοντά σε βασικές συγκοινωνίες','Καλή βαθμολογία τοποθεσίας για να μειώσεις μετακινήσεις'];
  if(d.type==='nature')return ['Κεντρικό χωριό/βάση για εξορμήσεις','Parking και εύκολη οδική πρόσβαση','Πρωινό ή κουζίνα για μεγαλύτερη ευελιξία'];
  return ['Κεντρική και ασφαλής τοποθεσία','Καλή πρόσβαση στα βασικά σημεία','Ευέλικτη ακύρωση όπου γίνεται'];
}
function buildMiniPlan(name,tags){
  const items=activityIdeas(name,tags);
  return [
    ['Πρωί',items[0]||'Κεντρική βόλτα και γνωριμία με τον προορισμό'],
    ['Μεσημέρι',items[1]||'Τοπική γαστρονομία και χαλαρός ρυθμός'],
    ['Απόγευμα',items[2]||'Κύριο αξιοθέατο ή εμπειρία'],
    ['Βράδυ',items[3]||'Δείπνο και βραδινή βόλτα']
  ];
}
function googleHotelUrl(name){return `https://www.google.com/travel/hotels?q=${q(name)}`;}
function bookingUrl(name){return `https://www.booking.com/searchresults.html?ss=${q(name)}`;}
function mapsUrl(name){return `https://www.google.com/maps/search/?api=1&query=${q(name)}`;}
function thingsUrl(name){return `https://www.google.com/search?q=${q(name+' αξιοθέατα δραστηριότητες')}`;}

function createOverlay(card,initialTab){
  const name=textFrom(card,'h4');
  if(!name)return;
  const d=findDestination(name);
  const tags=getTags(d,card);
  const country=(textFrom(card,'.rank').replace(/^#\d+\s*·\s*/,''))||d.country||'';
  const region=textFrom(card,'.region');
  const total=textFrom(card,'.cost');
  const transport=extractBreak(card,0);
  const stay=extractBreak(card,1);
  const food=extractBreak(card,2);
  const activities=extractBreak(card,3);
  const mode=card.querySelector('.break span')?.textContent?.includes('ΙΧ')?'car':card.querySelector('.break span')?.textContent?.includes('Αεροπορ')?'plane':card.querySelector('.break span')?.textContent?.includes('Ακτοπλο')?'ferry':null;
  const stayIdeas=stayAdvice(d,tags);
  const actIdeas=activityIdeas(name,tags);
  const miniPlan=buildMiniPlan(name,tags);
  const saved=localStorage.getItem(SAVED_KEY)===name;

  document.getElementById(OVERLAY_ID)?.remove();
  const overlay=document.createElement('div');
  overlay.id=OVERLAY_ID;
  overlay.className='horizon-detail-overlay';
  overlay.innerHTML=`
    <aside class="horizon-detail-panel" role="dialog" aria-modal="true" aria-label="Λεπτομέρειες ${esc(name)}">
      <div class="hd-head">
        <div class="hd-top"><div><div class="hd-eyebrow">Horizon destination brief</div><h3>${esc(name)}</h3><div class="hd-sub">${esc(country)}${region?' · '+esc(region):''}</div></div><button class="hd-close" aria-label="Κλείσιμο">×</button></div>
        <div class="hd-tabs"><button class="hd-tab" data-tab="stay">Διαμονή</button><button class="hd-tab" data-tab="transport">Μεταφορά</button><button class="hd-tab" data-tab="things">Τι να κάνεις</button></div>
      </div>
      <div class="hd-body">
        <section class="hd-pane" data-pane="stay">
          <div class="hd-hero"><small>Ενδεικτικό ποσό διαμονής στο πλάνο σου</small><strong>${esc(stay.split('\n').slice(-1)[0]||stay||'—')}</strong><div class="hd-note">Η τιμή προέρχεται από την τρέχουσα εκτίμηση του Horizon και όχι από live διαθεσιμότητα.</div></div>
          <div class="hd-grid"><div class="hd-card"><small>Τύποι που ταιριάζουν</small><b>${esc((d.stay||['hotel','airbnb']).map(x=>x==='hotel'?'Ξενοδοχείο':x==='airbnb'?'Διαμέρισμα':'Camping').join(' · '))}</b></div><div class="hd-card"><small>Κριτήριο περιοχής</small><b>${tags.includes('sea')?'Παραλιακή / walkable ζώνη':d.type==='nature'?'Βάση κοντά στις εξορμήσεις':'Κεντρική walkable περιοχή'}</b></div></div>
          <div class="hd-section"><h4>Τι να προτιμήσεις</h4><div class="hd-list">${stayIdeas.map((x,i)=>`<div class="hd-item"><span class="hd-num">${i+1}</span><div>${esc(x)}</div></div>`).join('')}</div></div>
          <div class="hd-cta-row"><button class="hd-cta hd-save ${saved?'saved':''}" data-save>${saved?'✓ Αποθηκευμένο':'☆ Αποθήκευση επιλογής'}</button><a class="hd-cta primary" target="_blank" rel="noopener" href="${bookingUrl(name)}">Booking live επιλογές ↗</a><a class="hd-cta" target="_blank" rel="noopener" href="${googleHotelUrl(name)}">Google Hotels ↗</a></div>
        </section>
        <section class="hd-pane" data-pane="transport">
          <div class="hd-hero"><small>Τρέχουσα εκτίμηση μεταφοράς</small><strong>${esc(transport.split('\n').find(x=>/^€/.test(x))||'—')}</strong><div class="hd-note">${esc(transport.replace(/\n/g,' · '))}</div></div>
          <div class="hd-grid"><div class="hd-card"><small>Μέσο</small><b>${esc(labelMode(mode))}</b></div><div class="hd-card"><small>Χρόνος</small><b>${esc(region.match(/~[^·]+ώρες[^·]*/)?.[0]?.replace('~','')||'Δες την κάρτα αποτελέσματος')}</b></div></div>
          <div class="hd-section"><h4>Horizon check πριν φύγεις</h4><div class="hd-list"><div class="hd-item"><span class="hd-num">1</span><div>Έλεγξε την τελική διαδρομή και πιθανές καθυστερήσεις πριν την αναχώρηση.</div></div><div class="hd-item"><span class="hd-num">2</span><div>${mode==='car'?'Τα διόδια/οδικά τέλη και τα καύσιμα έχουν ήδη συνυπολογιστεί στην εκτίμηση όπου υπάρχουν διαθέσιμα στοιχεία.':'Σύγκρινε ωράρια και τελικές τιμές πριν την κράτηση.'}</div></div><div class="hd-item"><span class="hd-num">3</span><div>Άφησε μικρό περιθώριο στο budget για parking, τοπικές μετακινήσεις ή αποσκευές.</div></div></div></div>
          <div class="hd-cta-row"><a class="hd-cta primary" target="_blank" rel="noopener" href="${mapsUrl(name)}">Άνοιγμα διαδρομής ↗</a></div>
        </section>
        <section class="hd-pane" data-pane="things">
          <div class="hd-hero"><small>Ενδεικτικό ποσό δραστηριοτήτων</small><strong>${esc(activities.split('\n').slice(-1)[0]||activities||'—')}</strong><div class="hd-note">Ένα πρώτο πλάνο για να δεις αν ο προορισμός ταιριάζει στον ρυθμό του ταξιδιού σου.</div></div>
          <div class="hd-section"><h4>5 ιδέες που ταιριάζουν στον προορισμό</h4><div class="hd-list">${actIdeas.map((x,i)=>`<div class="hd-item"><span class="hd-num">${i+1}</span><div>${esc(x)}</div></div>`).join('')}</div></div>
          <div class="hd-section"><h4>Mini πρόγραμμα ημέρας</h4><div class="hd-mini-plan">${miniPlan.map(([t,c])=>`<div class="hd-plan-row"><div class="hd-plan-time">${esc(t)}</div><div class="hd-plan-copy">${esc(c)}</div></div>`).join('')}</div></div>
          <div class="hd-cta-row"><button class="hd-cta hd-save ${saved?'saved':''}" data-save>${saved?'✓ Αποθηκευμένο':'☆ Αποθήκευση επιλογής'}</button><a class="hd-cta primary" target="_blank" rel="noopener" href="${thingsUrl(name)}">Live αναζήτηση δραστηριοτήτων ↗</a></div>
        </section>
      </div>
    </aside>`;
  document.body.appendChild(overlay);
  document.body.style.overflow='hidden';

  const activate=tab=>{
    overlay.querySelectorAll('.hd-tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
    overlay.querySelectorAll('.hd-pane').forEach(p=>p.classList.toggle('active',p.dataset.pane===tab));
  };
  activate(initialTab);
  overlay.querySelectorAll('.hd-tab').forEach(b=>b.onclick=()=>activate(b.dataset.tab));
  const close=()=>{overlay.remove();document.body.style.overflow='';};
  overlay.querySelector('.hd-close').onclick=close;
  overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
  document.addEventListener('keydown',function key(e){if(e.key==='Escape'){close();document.removeEventListener('keydown',key);}});
  overlay.querySelectorAll('[data-save]').forEach(btn=>btn.onclick=()=>{
    const isSaved=localStorage.getItem(SAVED_KEY)===name;
    if(isSaved)localStorage.removeItem(SAVED_KEY);else localStorage.setItem(SAVED_KEY,name);
    overlay.querySelectorAll('[data-save]').forEach(x=>{x.classList.toggle('saved',!isSaved);x.textContent=!isSaved?'✓ Αποθηκευμένο':'☆ Αποθήκευση επιλογής';});
  });
}

function interceptActionClick(e){
  const link=e.target.closest('.destination .actions a, .destination .actions button');
  if(!link)return;
  const txt=link.textContent.trim().toLowerCase();
  let tab=null;
  if(txt.includes('διαμον'))tab='stay';
  else if(txt.includes('μεταφορ'))tab='transport';
  else if(txt.includes('τι να κάν')||txt.includes('δραστηρ'))tab='things';
  if(!tab)return;
  e.preventDefault();e.stopPropagation();
  createOverlay(link.closest('.destination'),tab);
}

ensureStyles();
document.addEventListener('click',interceptActionClick,true);
})();
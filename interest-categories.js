(()=>{
'use strict';

const OPTIONS=[
  ['sea','🌊 Θάλασσα','Παραλίες, νησιά & παραθαλάσσιες εμπειρίες'],
  ['mountain','🏔️ Βουνό','Ορεινά χωριά, κορυφές & αλπικά τοπία'],
  ['nature','🌲 Φύση & τοπία','Δάση, λίμνες, φαράγγια & εθνικά πάρκα'],
  ['history','🏛️ Ιστορία & πολιτισμός','Μνημεία, μουσεία, αρχαιολογία & τέχνη'],
  ['food','🍽️ Φαγητό','Τοπική κουζίνα, αγορές & γαστρονομία'],
  ['nightlife','🌙 Νυχτερινή ζωή','Bars, clubs, events & βραδινές έξοδοι'],
  ['family','👨‍👩‍👧 Οικογένεια','Ήρεμες, εύκολες & παιδικές επιλογές'],
  ['adventure','🥾 Περιπέτεια & outdoor','Πεζοπορία, rafting, καταδύσεις & δραστηριότητες'],
  ['wellness','🧖 Χαλάρωση & wellness','Spa, θερμά λουτρά, ηρεμία & αποφόρτιση'],
  ['romantic','❤️ Ρομαντικό ταξίδι','Ζευγάρια, honeymoon & ιδιαίτερη ατμόσφαιρα'],
  ['winter','⛷️ Χειμερινές δραστηριότητες','Ski, χιόνι, σαλέ & χειμερινές αποδράσεις']
];

const ROMANTIC=new Set([
  'Σαντορίνη','Μονεμβασιά','Ναύπλιο','Πάρος','Μήλος','Σύρος','Τήνος','Κέρκυρα',
  'Παρίσι','Βενετία','Φλωρεντία','Ρώμη','Πράγα','Μπριζ','Νίκαια','Ντουμπρόβνικ','Κότορ',
  'Λίμνη Μπλεντ','Λουκέρνη','Μαδέρα','Μάλτα','Πόρτο','Λισαβόνα','Βαρκελώνη','Κιότο'
]);
const WINTER=new Set([
  'Αράχωβα','Μπάνσκο','Ζαγόρι','Πήλιο','Μετέωρα','Σάλτσμπουργκ','Ιντερλάκεν','Λίμνη Μπλεντ',
  'Λουκέρνη','Ζυρίχη','Μόναχο','Ρέικιαβικ','Όσλο','Μπέργκεν','Λοφότεν','Στοκχόλμη','Ελσίνκι'
]);
const WELLNESS=new Set([
  'Ρέικιαβικ','Βουδαπέστη','Μαδέρα','Μπαλί','Πουκέτ','Μάλτα','Πάφος','Λεμεσός','Ζαγόρι','Πήλιο',
  'Λίμνη Μπλεντ','Λουκέρνη','Ιντερλάκεν','Κρήτη','Μήλος','Νάξος','Σαντορίνη'
]);
const ADVENTURE=new Set([
  'Ζαγόρι','Πήλιο','Μετέωρα','Μπάνσκο','Καππαδοκία','Ιντερλάκεν','Λοφότεν','Μπέργκεν','Μαδέρα',
  'Μπαλί','Πουκέτ','Ζανζιβάρη','Κέιπ Τάουν','Κανκούν','Κρήτη','Μήλος','Νάξος','Σάμος','Κάρπαθος'
]);
const MOUNTAIN=new Set([
  'Αράχωβα','Ζαγόρι','Πήλιο','Μετέωρα','Μπάνσκο','Καππαδοκία','Σάλτσμπουργκ','Ιντερλάκεν','Λίμνη Μπλεντ',
  'Λουκέρνη','Λοφότεν','Μπέργκεν','Μαδέρα','Μπρασόβ'
]);

function addTag(d,tag){
  if(!Array.isArray(d.tags))d.tags=[];
  if(!d.tags.includes(tag))d.tags.push(tag);
}
function enrichDestinationTags(){
  (window.HORIZON_DESTINATIONS||[]).forEach(d=>{
    if(d.type==='nature'){
      addTag(d,'nature');addTag(d,'mountain');addTag(d,'adventure');addTag(d,'wellness');
    }
    if(d.type==='island'){
      addTag(d,'sea');addTag(d,'wellness');addTag(d,'romantic');
    }
    if(d.type==='mixed')addTag(d,'adventure');
    if(MOUNTAIN.has(d.name))addTag(d,'mountain');
    if(ADVENTURE.has(d.name))addTag(d,'adventure');
    if(WELLNESS.has(d.name))addTag(d,'wellness');
    if(ROMANTIC.has(d.name))addTag(d,'romantic');
    if(WINTER.has(d.name)){addTag(d,'winter');addTag(d,'mountain');}
    if(d.tags.includes('sea'))addTag(d,'adventure');
    if(d.tags.includes('family')||d.type==='nature')addTag(d,'family');
  });
}

function patchLabels(){
  try{
    Object.assign(tagLabels,{
      sea:'Θάλασσα',mountain:'Βουνό',nature:'Φύση & τοπία',history:'Ιστορία & πολιτισμός',food:'Φαγητό',
      nightlife:'Νυχτερινή ζωή',family:'Οικογένεια',adventure:'Περιπέτεια & outdoor',wellness:'Χαλάρωση & wellness',
      romantic:'Ρομαντικό ταξίδι',winter:'Χειμερινές δραστηριότητες'
    });
  }catch(e){}
}

function patchStep(){
  try{
    if(typeof steps==='undefined'||!Array.isArray(steps))return false;
    const s=steps.find(x=>x.key==='interests');if(!s)return false;
    s.hint='Τι θέλεις να έχει το ταξίδι;';
    s.multi=true;
    s.options=OPTIONS;
    if(typeof state!=='undefined'&&state){
      if(!Array.isArray(state.interests))state.interests=state.interests?[state.interests]:[];
      const allowed=new Set(OPTIONS.map(x=>x[0]));
      state.interests=[...new Set(state.interests)].filter(x=>allowed.has(x));
      try{if(typeof save==='function')save();}catch(e){}
    }
    return true;
  }catch(e){return false;}
}

function rerenderIfNeeded(){
  try{
    if(typeof current==='number'&&typeof render==='function'&&steps?.[current]?.key==='interests')render();
  }catch(e){}
}

function boot(){
  enrichDestinationTags();
  patchLabels();
  if(patchStep())rerenderIfNeeded();
  else setTimeout(()=>{enrichDestinationTags();patchLabels();if(patchStep())rerenderIfNeeded();},80);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

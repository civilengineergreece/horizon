(()=>{
const out=[];
const dailyBase=[0,58,76,102,145],activityBase=[0,14,18,25,34];
const tags={city:['history','food','nightlife'],island:['sea','food','family','nature'],nature:['nature','food','family'],mixed:['sea','food','history','nature']};
const desc={
  city:'City break με ιστορία, γαστρονομία και αστική εμπειρία.',
  island:'Νησιωτική απόδραση με παραλίες, τοπικές γεύσεις και χαλάρωση.',
  nature:'Απόδραση φύσης με τοπία, outdoor εμπειρίες και χαλαρό ρυθμό.',
  mixed:'Συνδυαστική εμπειρία με πόλη, φύση, φαγητό και διαφορετικές δραστηριότητες.'
};
const CAR_CONSUMPTION=7.5,FUEL_PRICE=2.00;
const planeAdultRT={'Ελλάδα':170,'Ανατολική Μεσόγειος':230,'Βαλκάνια':190,'Βαλτική':310,'Βόρεια Ευρώπη':340,'Δυτική Ευρώπη':290,'Κεντρική Ευρώπη':260,'Νότια Ευρώπη':250,'Μέση Ανατολή':420,'Βόρεια Αφρική':360,'Ανατολική Ασία':920,'Νοτιοανατολική Ασία':850,'Βόρεια Αμερική':980,'Λατινική Αμερική':1150,'Καραϊβική':1080,'Υποσαχάρια Αφρική':980,'Ωκεανία':1550};
const airHours={'Ελλάδα':3.0,'Ανατολική Μεσόγειος':3.7,'Βαλκάνια':3.4,'Βαλτική':4.8,'Βόρεια Ευρώπη':5.0,'Δυτική Ευρώπη':4.7,'Κεντρική Ευρώπη':4.3,'Νότια Ευρώπη':4.1,'Μέση Ανατολή':5.3,'Βόρεια Αφρική':5.0,'Ανατολική Ασία':15.0,'Νοτιοανατολική Ασία':15.5,'Βόρεια Αμερική':14.0,'Λατινική Αμερική':18.0,'Καραϊβική':17.0,'Υποσαχάρια Αφρική':14.0,'Ωκεανία':24.0};
const greekPrice={'Ναύπλιο':[72,22,13],'Θεσσαλονίκη':[78,45,18],'Μονεμβασιά':[82,32,14],'Ιωάννινα':[70,42,15],'Δελφοί':[65,25,14],'Νάξος':[88,100,17],'Σύρος':[80,78,15],'Ρόδος':[92,150,20],'Κέρκυρα':[90,145,18],'Λευκάδα':[82,28,16],'Σαντορίνη':[135,150,24],'Μύκονος':[155,145,28],'Πάρος':[105,110,20],'Μήλος':[98,120,18],'Τήνος':[84,82,15],'Άνδρος':[78,68,14],'Σίφνος':[95,100,18],'Σέριφος':[82,88,14],'Χίος':[76,130,15],'Λέσβος':[74,135,15],'Σάμος':[78,140,16],'Κως':[88,145,18],'Κάρπαθος':[80,160,17],'Σκιάθος':[95,110,18],'Σκόπελος':[82,100,16],'Αλόννησος':[80,105,16],'Κρήτη':[82,145,20],'Μάνη':[76,30,15],'Καλαμάτα':[70,24,14],'Πάργα':[86,35,17],'Χαλκιδική':[88,35,18],'Πήλιο':[72,28,15],'Ζαγόρι':[76,38,17],'Μετέωρα':[68,30,16],'Αράχωβα':[90,25,18]};
const transportOverride={'Ναύπλιο':['car'],'Μονεμβασιά':['car'],'Δελφοί':['car'],'Λευκάδα':['car'],'Μάνη':['car'],'Καλαμάτα':['car'],'Πάργα':['car'],'Χαλκιδική':['car'],'Πήλιο':['car'],'Ζαγόρι':['car'],'Μετέωρα':['car'],'Αράχωβα':['car'],'Θεσσαλονίκη':['plane','car'],'Ιωάννινα':['plane','car']};
const roadProfiles={'Ναύπλιο':{km:139,toll:7.55,hours:1.8},'Θεσσαλονίκη':{km:503,toll:36.70,hours:5.1},'Μονεμβασιά':{km:310,toll:10.35,hours:3.7},'Ιωάννινα':{km:446,toll:44.70,hours:4.7},'Δελφοί':{km:182,toll:8.65,hours:2.4},'Λευκάδα':{km:379,toll:37.45,hours:4.3},'Μάνη':{km:285,toll:16.35,hours:3.5},'Καλαμάτα':{km:287,toll:16.35,hours:2.8},'Πάργα':{km:406,toll:40.45,hours:4.8},'Χαλκιδική':{km:610,toll:36.70,hours:6.2},'Πήλιο':{km:330,toll:13.90,hours:3.6},'Ζαγόρι':{km:470,toll:44.70,hours:5.2},'Μετέωρα':{km:355,toll:19.35,hours:4.0},'Αράχωβα':{km:171,toll:8.65,hours:2.2},'Σόφια':{km:790,toll:28,hours:8.5},'Σκόπια':{km:700,toll:20,hours:7.3},'Μπάνσκο':{km:680,toll:28,hours:7.5},'Τίρανα':{km:700,toll:22,hours:8.3},'Σαράντα':{km:570,toll:18,hours:8.0},'Σαράγεβο':{km:1080,toll:35,hours:12.0},'Ζάγκρεμπ':{km:1480,toll:55,hours:14.5},'Ντουμπρόβνικ':{km:1030,toll:35,hours:12.5},'Σπλιτ':{km:1290,toll:48,hours:14.0},'Κότορ':{km:900,toll:28,hours:11.0},'Μπούντβα':{km:910,toll:28,hours:11.2},'Βουκουρέστι':{km:1180,toll:42,hours:12.0},'Μπρασόβ':{km:1250,toll:42,hours:13.0},'Βελιγράδι':{km:1090,toll:38,hours:10.8},'Λιουμπλιάνα':{km:1340,toll:48,hours:13.5},'Λίμνη Μπλεντ':{km:1390,toll:48,hours:14.0}};
const ferryHours={'Άνδρος':2.0,'Σύρος':2.3,'Τήνος':2.4,'Μύκονος':2.8,'Σέριφος':2.4,'Σίφνος':2.9,'Πάρος':3.4,'Νάξος':4.0,'Μήλος':3.6,'Σαντορίνη':5.0,'Σκιάθος':2.5,'Σκόπελος':3.3,'Αλόννησος':4.2,'Χίος':7.5,'Λέσβος':10.5,'Σάμος':8.5,'Κως':9.5,'Ρόδος':13.0,'Κάρπαθος':14.0,'Κρήτη':8.5};

function hash01(text,salt=0){let h=2166136261^salt;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return ((h>>>0)%10000)/9999}
function G(country,region,type,tier,names){
  names.split('|').forEach(name=>{
    let transport=['plane'];
    if(region==='Ελλάδα')transport=type==='island'?['ferry','plane']:['car','plane'];
    else if(region==='Βαλκάνια')transport=['plane','car'];
    if(transportOverride[name])transport=transportOverride[name];
    let stay=['hotel','airbnb'];
    if(type==='island'||type==='nature')stay=['hotel','airbnb','camping'];
    const key=`${country}-${name}`;
    const dailyFactor=.84+hash01(key,11)*.34,activityFactor=.78+hash01(key,47)*.44,typeFactor=type==='island'?1.06:type==='nature'?.94:type==='mixed'?1.03:1;
    let daily=Math.round(dailyBase[tier]*dailyFactor*typeFactor),activity=Math.round(activityBase[tier]*activityFactor),travel=Math.round((planeAdultRT[region]||280)*(.88+hash01(key,29)*.24));
    if(greekPrice[name]){daily=greekPrice[name][0];travel=greekPrice[name][1];activity=greekPrice[name][2]}
    out.push({name,country,region,type,tags:[...tags[type]],transport,stay,daily,travel,activity,desc:desc[type]});
  });
}

G('Ιαπωνία','Ανατολική Ασία','city',4,'Τόκιο|Κιότο');G('Νότια Κορέα','Ανατολική Ασία','city',3,'Σεούλ');G('Κύπρος','Ανατολική Μεσόγειος','mixed',2,'Λεμεσός|Πάφος');G('Τουρκία','Ανατολική Μεσόγειος','city',2,'Κωνσταντινούπολη');G('Τουρκία','Ανατολική Μεσόγειος','mixed',2,'Αττάλεια');G('Τουρκία','Ανατολική Μεσόγειος','nature',2,'Καππαδοκία');
G('Αλβανία','Βαλκάνια','city',1,'Τίρανα');G('Αλβανία','Βαλκάνια','mixed',2,'Σαράντα');G('Βοσνία και Ερζεγοβίνη','Βαλκάνια','city',1,'Σαράγεβο');G('Βουλγαρία','Βαλκάνια','city',1,'Σόφια');G('Βουλγαρία','Βαλκάνια','nature',2,'Μπάνσκο');G('Βόρεια Μακεδονία','Βαλκάνια','city',1,'Σκόπια');G('Κροατία','Βαλκάνια','city',2,'Ζάγκρεμπ');G('Κροατία','Βαλκάνια','island',4,'Χβαρ');G('Κροατία','Βαλκάνια','mixed',2,'Ντουμπρόβνικ|Σπλιτ');G('Μαυροβούνιο','Βαλκάνια','mixed',2,'Κότορ|Μπούντβα');G('Ρουμανία','Βαλκάνια','city',2,'Βουκουρέστι');G('Ρουμανία','Βαλκάνια','mixed',2,'Μπρασόβ');G('Σερβία','Βαλκάνια','city',2,'Βελιγράδι');G('Σλοβενία','Βαλκάνια','mixed',2,'Λιουμπλιάνα');G('Σλοβενία','Βαλκάνια','nature',3,'Λίμνη Μπλεντ');
G('Εσθονία','Βαλτική','city',2,'Ταλίν');G('Λετονία','Βαλτική','city',2,'Ρίγα');G('Λιθουανία','Βαλτική','city',2,'Βίλνιους');G('ΗΠΑ','Βόρεια Αμερική','city',4,'Νέα Υόρκη|Σαν Φρανσίσκο');G('ΗΠΑ','Βόρεια Αμερική','mixed',4,'Μαϊάμι|Λος Άντζελες');G('Καναδάς','Βόρεια Αμερική','city',4,'Τορόντο|Μόντρεαλ');G('Αίγυπτος','Βόρεια Αφρική','city',2,'Κάιρο');G('Μαρόκο','Βόρεια Αφρική','city',2,'Μαρακές');G('Τυνησία','Βόρεια Αφρική','city',2,'Τύνιδα');G('Τυνησία','Βόρεια Αφρική','island',2,'Τζέρμπα');
G('Δανία','Βόρεια Ευρώπη','city',4,'Κοπεγχάγη');G('Ηνωμένο Βασίλειο','Βόρεια Ευρώπη','city',3,'Λονδίνο|Εδιμβούργο|Μάντσεστερ');G('Ιρλανδία','Βόρεια Ευρώπη','city',4,'Δουβλίνο');G('Ισλανδία','Βόρεια Ευρώπη','nature',4,'Ρέικιαβικ');G('Νορβηγία','Βόρεια Ευρώπη','city',4,'Όσλο');G('Νορβηγία','Βόρεια Ευρώπη','mixed',4,'Μπέργκεν');G('Νορβηγία','Βόρεια Ευρώπη','nature',4,'Λοφότεν');G('Σουηδία','Βόρεια Ευρώπη','city',4,'Στοκχόλμη');G('Φινλανδία','Βόρεια Ευρώπη','city',4,'Ελσίνκι');G('Βέλγιο','Δυτική Ευρώπη','city',3,'Βρυξέλλες|Μπριζ');G('Γαλλία','Δυτική Ευρώπη','city',3,'Παρίσι|Λυών|Μπορντό|Στρασβούργο');G('Γαλλία','Δυτική Ευρώπη','mixed',4,'Νίκαια|Μασσαλία');G('Ολλανδία','Δυτική Ευρώπη','city',4,'Άμστερνταμ|Ρότερνταμ');
G('Ελλάδα','Ελλάδα','city',2,'Ναύπλιο|Θεσσαλονίκη|Μονεμβασιά|Ιωάννινα|Δελφοί');G('Ελλάδα','Ελλάδα','island',3,'Νάξος|Σύρος|Ρόδος|Κέρκυρα|Λευκάδα|Σαντορίνη|Μύκονος|Πάρος|Μήλος|Τήνος|Άνδρος|Σίφνος|Σέριφος|Χίος|Λέσβος|Σάμος|Κως|Κάρπαθος|Σκιάθος|Σκόπελος|Αλόννησος');G('Ελλάδα','Ελλάδα','mixed',2,'Κρήτη|Μάνη|Καλαμάτα|Πάργα|Χαλκιδική');G('Ελλάδα','Ελλάδα','nature',2,'Πήλιο|Ζαγόρι|Μετέωρα|Αράχωβα');
G('Κούβα','Καραϊβική','city',2,'Αβάνα');G('Μεξικό','Καραϊβική','mixed',3,'Κανκούν');G('Αυστρία','Κεντρική Ευρώπη','city',4,'Βιέννη|Σάλτσμπουργκ');G('Γερμανία','Κεντρική Ευρώπη','city',3,'Βερολίνο|Μόναχο|Αμβούργο|Κολωνία|Δρέσδη');G('Ελβετία','Κεντρική Ευρώπη','city',4,'Ζυρίχη');G('Ελβετία','Κεντρική Ευρώπη','mixed',4,'Λουκέρνη');G('Ελβετία','Κεντρική Ευρώπη','nature',4,'Ιντερλάκεν');G('Ουγγαρία','Κεντρική Ευρώπη','city',2,'Βουδαπέστη');G('Πολωνία','Κεντρική Ευρώπη','city',2,'Κρακοβία|Βαρσοβία');G('Πολωνία','Κεντρική Ευρώπη','mixed',2,'Γκντανσκ');G('Τσεχία','Κεντρική Ευρώπη','city',2,'Πράγα|Τσέσκι Κρούμλοβ');
G('Αργεντινή','Λατινική Αμερική','city',2,'Μπουένος Άιρες');G('Μεξικό','Λατινική Αμερική','city',2,'Πόλη του Μεξικού');G('Ηνωμένα Αραβικά Εμιράτα','Μέση Ανατολή','city',4,'Ντουμπάι|Άμπου Ντάμπι');G('Ιορδανία','Μέση Ανατολή','mixed',3,'Αμμάν & Πέτρα');G('Κατάρ','Μέση Ανατολή','city',4,'Ντόχα');G('Ομάν','Μέση Ανατολή','mixed',3,'Μουσκάτ');G('Βιετνάμ','Νοτιοανατολική Ασία','city',1,'Ανόι|Χο Τσι Μινχ');G('Ινδονησία','Νοτιοανατολική Ασία','mixed',2,'Μπαλί');G('Μαλαισία','Νοτιοανατολική Ασία','city',2,'Κουάλα Λουμπούρ');G('Σιγκαπούρη','Νοτιοανατολική Ασία','city',4,'Σιγκαπούρη');G('Ταϊλάνδη','Νοτιοανατολική Ασία','city',2,'Μπανγκόκ');G('Ταϊλάνδη','Νοτιοανατολική Ασία','island',2,'Πουκέτ');
G('Ισπανία','Νότια Ευρώπη','city',2,'Σεβίλλη|Μαδρίτη|Γρανάδα|Μπιλμπάο');G('Ισπανία','Νότια Ευρώπη','island',3,'Μαγιόρκα');G('Ισπανία','Νότια Ευρώπη','mixed',2,'Βαρκελώνη|Βαλένθια|Μάλαγα');G('Ιταλία','Νότια Ευρώπη','city',3,'Ρώμη|Νάπολη|Μπολόνια|Φλωρεντία|Βενετία|Μιλάνο|Τορίνο');G('Ιταλία','Νότια Ευρώπη','mixed',2,'Παλέρμο');G('Μάλτα','Νότια Ευρώπη','mixed',2,'Μάλτα');G('Πορτογαλία','Νότια Ευρώπη','city',2,'Λισαβόνα|Πόρτο');G('Πορτογαλία','Νότια Ευρώπη','mixed',3,'Αλγκάρβε');G('Πορτογαλία','Νότια Ευρώπη','nature',3,'Μαδέρα');G('Νότια Αφρική','Υποσαχάρια Αφρική','mixed',3,'Κέιπ Τάουν');G('Τανζανία','Υποσαχάρια Αφρική','island',3,'Ζανζιβάρη');G('Αυστραλία','Ωκεανία','mixed',4,'Σίδνεϊ');

window.HORIZON_DESTINATIONS=out;
window.HORIZON_CAR_ASSUMPTIONS={consumptionL100:CAR_CONSUMPTION,fuelPricePerL:FUEL_PRICE,roadProfiles};

function norm(v){return String(v||'').toLocaleLowerCase('el-GR').normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
function isAthensOrigin(v){const s=norm(v);return s.includes('αθην')||s.includes('athen')}
function validConsumption(v){const n=Number(v);return Number.isFinite(n)&&n>=2&&n<=25}
function currentConsumption(){const v=state?.carConsumption?.value;return validConsumption(v)?Number(v):CAR_CONSUMPTION}
function validTravelHours(v){const n=Number(String(v??'').replace(',','.'));return Number.isFinite(n)&&n>=.5&&n<=30}
function parseHoursFromSpecial(){
  if(state?.maxTravelHours?.unlimited)return null;
  if(Number(state?.maxTravelHours?.value)>0)return Number(state.maxTravelHours.value);
  const s=norm(state?.special);
  const m=s.match(/(?:μεχρι|εως|το πολυ|max(?:imum)?|οχι πανω απο|<=?)?\s*(\d+(?:[.,]\d+)?)\s*(?:ωρ(?:α|ες)?|hours?|hrs?|h)/);
  if(m&&/(διαδρο|μετακιν|ταξιδ|ωρ|hour)/.test(s))return Number(m[1].replace(',','.'));
  return null;
}
function modeHours(d,mode){
  if(mode==='car'){
    if(!d.transport.includes('car'))return Infinity;
    const p=roadProfiles[d.name];
    if(p&&isAthensOrigin(state.origin))return p.hours;
    return d.region==='Βαλκάνια'?9+hash01(d.name,83)*5:d.region==='Ελλάδα'?3+hash01(d.name,84)*3:Infinity;
  }
  if(mode==='ferry'){
    if(!d.transport.includes('ferry'))return Infinity;
    return (ferryHours[d.name]||6)+.6;
  }
  if(mode==='plane'){
    if(!d.transport.includes('plane'))return Infinity;
    return (airHours[d.region]||5)+hash01(d.name,87)*.45;
  }
  return Infinity;
}
function carCost(d,adults,children){
  const cars=Math.max(1,Math.ceil((adults+children)/5)),p=roadProfiles[d.name],cons=currentConsumption();
  let oneWayKm,toll,hours,exact=false;
  if(p&&isAthensOrigin(state.origin)){oneWayKm=p.km;toll=p.toll;hours=p.hours;exact=true}
  else{
    const countryBase={'Βουλγαρία':790,'Βόρεια Μακεδονία':700,'Αλβανία':680,'Βοσνία και Ερζεγοβίνη':1080,'Κροατία':1250,'Μαυροβούνιο':900,'Ρουμανία':1180,'Σερβία':1090,'Σλοβενία':1350};
    oneWayKm=Math.round((countryBase[d.country]||650)*(.9+hash01(d.name,91)*.2));toll=Math.round(oneWayKm*.035);hours=oneWayKm/85+.6;
  }
  const roadKm=Math.round(oneWayKm*2),fuelLiters=roadKm*cons/100*cars,fuelCost=Math.round(fuelLiters*FUEL_PRICE),tolls=Math.round(toll*2*cars*100)/100;
  return {mode:'car',cost:Math.round(fuelCost+tolls),hours,roadKm,fuelLiters:Math.round(fuelLiters*10)/10,fuelCost,tolls,cars,exact};
}
function planeCost(d,adults,children){
  const adult=Math.max(d.travel,Math.round((planeAdultRT[d.region]||280)*(.9+hash01(d.name,93)*.18)));
  return {mode:'plane',cost:Math.round(adult*adults+adult*.78*children),hours:modeHours(d,'plane'),adultRT:adult};
}
function ferryCost(d,adults,children){
  const adult=Math.max(55,d.travel);
  return {mode:'ferry',cost:Math.round(adult*adults+adult*.55*children),hours:modeHours(d,'ferry'),adultRT:adult};
}
function chooseTransport(d){
  const adults=Math.max(1,state.travelers?.adults||1),children=Math.max(0,state.travelers?.children||0);
  if(state.budget?.transport==='no')return {mode:state.transport==='any'?d.transport[0]:state.transport,cost:0,hours:0};
  const modes=state.transport==='any'?d.transport:[state.transport],candidates=[];
  modes.forEach(m=>{
    if(!d.transport.includes(m))return;
    if(m==='car')candidates.push(carCost(d,adults,children));
    else if(m==='plane')candidates.push(planeCost(d,adults,children));
    else if(m==='ferry')candidates.push(ferryCost(d,adults,children));
  });
  if(!candidates.length)return null;
  const limit=parseHoursFromSpecial(),within=limit?candidates.filter(c=>c.hours<=limit):candidates,pool=within.length?within:candidates;
  return pool.sort((a,b)=>a.cost-b.cost)[0];
}

function injectTransportExtras(){
  if(typeof current==='undefined'||current!==7||!state)return;
  const card=document.getElementById('questionCard');
  if(!card||card.querySelector('#transportExtras'))return;
  const error=card.querySelector('#error');
  if(!error)return;

  const inferred=parseHoursFromSpecial();
  const storedValue=Number(state.maxTravelHours?.value)||null;
  const selected=state.maxTravelHours?.unlimited?'unlimited':storedValue===2?'2':storedValue===4?'4':storedValue===6?'6':storedValue?'custom':(inferred===2?'2':inferred===4?'4':inferred===6?'6':inferred?'custom':'unlimited');
  const customValue=selected==='custom'?(storedValue||inferred||''):'';

  const panel=document.createElement('div');
  panel.id='transportExtras';
  panel.style.cssText='margin:18px 0 4px;padding:18px;border:1px solid rgba(255,122,22,.35);border-radius:14px;background:rgba(255,122,22,.07)';
  panel.innerHTML=`
    <div style="font-weight:800;margin-bottom:6px">Μέγιστος χρόνος μονής διαδρομής</div>
    <div class="tiny muted" style="margin-bottom:12px">Προαιρετικό σκληρό φίλτρο. Αν δεν σε ενδιαφέρει ο χρόνος μετακίνησης, άφησε «Δεν έχω όριο».</div>
    <div id="timePresetChoices" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px">
      <button type="button" class="choice" data-time-preset="2" style="min-height:58px;padding:10px;text-align:center"><strong>Έως 2 ώρες</strong></button>
      <button type="button" class="choice" data-time-preset="4" style="min-height:58px;padding:10px;text-align:center"><strong>Έως 4 ώρες</strong></button>
      <button type="button" class="choice" data-time-preset="6" style="min-height:58px;padding:10px;text-align:center"><strong>Έως 6 ώρες</strong></button>
      <button type="button" class="choice" data-time-preset="unlimited" style="min-height:58px;padding:10px;text-align:center"><strong>Δεν έχω όριο</strong></button>
      <button type="button" class="choice" data-time-preset="custom" style="min-height:58px;padding:10px;text-align:center"><strong>Άλλο</strong></button>
    </div>
    <div id="customTimeWrap" style="display:${selected==='custom'?'block':'none'};margin-top:10px">
      <div class="field"><label>Άλλο όριο (ώρες μονής διαδρομής)</label><input class="control" id="maxTravelHoursInput" type="number" min="0.5" max="30" step="0.5" value="${customValue}" placeholder="π.χ. 3,5"></div>
    </div>
    <div class="tiny muted" id="timeLimitStatus" style="margin-top:8px"></div>
    ${state.transport==='car'?`
      <div style="height:1px;background:rgba(255,255,255,.09);margin:16px 0"></div>
      <div style="font-weight:800;margin-bottom:6px">Κατανάλωση ΙΧ</div>
      <div class="tiny muted" style="margin-bottom:12px">Βενζίνη €${FUEL_PRICE.toLocaleString('el-GR',{minimumFractionDigits:2})}/L.</div>
      <div style="display:flex;gap:10px;align-items:end;flex-wrap:wrap">
        <div class="field" style="flex:1;min-width:190px"><label>Λίτρα / 100 χλμ.</label><input class="control" id="carConsumptionInput" type="number" min="2" max="25" step="0.1" value="${validConsumption(state.carConsumption?.value)?state.carConsumption.value:''}" placeholder="π.χ. 6,5"></div>
        <button type="button" class="btn ghost" id="carUnknownBtn">Δεν γνωρίζω — 7,5 L/100 km</button>
      </div>
      <div class="tiny" id="carConsumptionStatus" style="margin-top:8px"></div>
    `:''}
  `;
  error.parentNode.insertBefore(panel,error);

  const buttons=[...panel.querySelectorAll('[data-time-preset]')];
  const customWrap=panel.querySelector('#customTimeWrap');
  const timeInput=panel.querySelector('#maxTravelHoursInput');
  const timeStatus=panel.querySelector('#timeLimitStatus');

  function setSelected(value){
    buttons.forEach(b=>b.classList.toggle('selected',b.dataset.timePreset===value));
  }
  function setStatus(){
    const limit=parseHoursFromSpecial();
    if(state.maxTravelHours?.unlimited){
      timeStatus.textContent='Δεν θα εφαρμοστεί όριο χρόνου μετακίνησης.';
    }else if(limit){
      timeStatus.textContent=`Θα αποκλείονται προορισμοί με μονή διαδρομή πάνω από ${limit.toLocaleString('el-GR')} ώρες.`;
    }else{
      timeStatus.textContent='Επίλεξε όριο ή «Δεν έχω όριο».';
    }
  }

  setSelected(selected);
  setStatus();

  buttons.forEach(button=>{
    button.addEventListener('click',()=>{
      const value=button.dataset.timePreset;
      setSelected(value);
      if(value==='unlimited'){
        state.maxTravelHours={value:null,unlimited:true,preset:'unlimited'};
        customWrap.style.display='none';
      }else if(value==='custom'){
        state.maxTravelHours={value:validTravelHours(timeInput?.value)?Number(String(timeInput.value).replace(',','.')):null,unlimited:false,preset:'custom'};
        customWrap.style.display='block';
        setTimeout(()=>timeInput?.focus(),0);
      }else{
        state.maxTravelHours={value:Number(value),unlimited:false,preset:value};
        customWrap.style.display='none';
      }
      save();
      setStatus();
    });
  });

  if(timeInput){
    timeInput.addEventListener('input',()=>{
      const n=Number(String(timeInput.value).replace(',','.'));
      setSelected('custom');
      if(n>=.5&&n<=30){
        state.maxTravelHours={value:n,unlimited:false,preset:'custom'};
      }else{
        state.maxTravelHours={value:null,unlimited:false,preset:'custom'};
      }
      save();
      setStatus();
    });
  }

  if(!state.maxTravelHours&&!inferred){
    state.maxTravelHours={value:null,unlimited:true,preset:'unlimited'};
    save();
    setSelected('unlimited');
    setStatus();
  }

  if(state.transport==='car'){
    const cInput=panel.querySelector('#carConsumptionInput'),cStatus=panel.querySelector('#carConsumptionStatus');
    const persist=(v,def)=>{
      const n=Number(String(v).replace(',','.'));
      if(!validConsumption(n)){
        delete state.carConsumption;save();
        cStatus.style.color='#ffb1a3';
        cStatus.textContent='Βάλε 2,0–25,0 L/100 km ή πάτησε «Δεν γνωρίζω».';
        return false;
      }
      state.carConsumption={value:Math.round(n*10)/10,defaulted:!!def,fuel:'petrol',fuelPrice:FUEL_PRICE};
      save();
      cInput.value=state.carConsumption.value;
      cStatus.style.color='#65d39a';
      cStatus.textContent=def?'Χρήση 7,5 L/100 km βενζίνης.':`Χρήση ${state.carConsumption.value.toLocaleString('el-GR')} L/100 km βενζίνης.`;
      return true;
    };
    cInput.addEventListener('input',()=>persist(cInput.value,false));
    panel.querySelector('#carUnknownBtn').onclick=()=>persist(CAR_CONSUMPTION,true);
    if(validConsumption(state.carConsumption?.value))persist(state.carConsumption.value,!!state.carConsumption.defaulted);
    const nextBtn=document.getElementById('nextBtn');
    if(nextBtn)nextBtn.addEventListener('click',e=>{
      if(!validConsumption(state.carConsumption?.value)){
        e.preventDefault();e.stopImmediatePropagation();
        cStatus.style.color='#ffb1a3';
        cStatus.textContent='Συμπλήρωσε κατανάλωση ή πάτησε «Δεν γνωρίζω».';
        cInput.focus();
      }
    },true);
  }
}

window.addEventListener('DOMContentLoaded',()=>{
  if(typeof window.calcCost!=='function')return;
  const originalCalc=window.calcCost;
  window.calcCost=function(d){
    const base=originalCalc(d),chosen=chooseTransport(d);
    if(!chosen)return {...base,transport:99999,total:base.total-base.transport+99999,transportMode:null,travelHours:Infinity};
    return {...base,transport:chosen.cost,total:base.total-base.transport+chosen.cost,transportMode:chosen.mode,travelHours:chosen.hours,transportDetails:chosen,fuelCost:chosen.fuelCost??0,tolls:chosen.tolls??0,fuelLiters:chosen.fuelLiters??0,roadKm:chosen.roadKm??0,consumptionL100:currentConsumption()};
  };
  const originalScore=window.scoreDest;
  window.scoreDest=function(d){
    const r=originalScore(d),limit=parseHoursFromSpecial(),modeCompatible=state.transport==='any'||d.transport.includes(state.transport),timeCompatible=!limit||r.travelHours<=limit;
    return {...r,hardExcluded:!modeCompatible||!timeCompatible,timeLimit:limit};
  };
  const originalRender=window.render;
  window.render=function(){originalRender();setTimeout(injectTransportExtras,0)};
  if(typeof window.renderResults==='function'){
    const originalRR=window.renderResults;
    window.renderResults=function(sort='match',region='all'){
      const before=scored.length,limit=parseHoursFromSpecial();
      scored=scored.filter(d=>!d.hardExcluded);
      originalRR(sort,region);
      let pool=region==='all'?[...scored]:scored.filter(d=>d.region===region);
      pool.sort((a,b)=>sort==='cheap'?a.total-b.total:sort==='fit'?b.fit-a.fit:b.score-a.score||a.total-b.total);
      const list=pool.slice(0,8),cards=[...document.querySelectorAll('#resultsCard .destination')];
      cards.forEach((card,i)=>{
        const d=list[i];if(!d)return;
        const reg=card.querySelector('.region');
        if(reg&&Number.isFinite(d.travelHours))reg.innerHTML+=` · ~${d.travelHours.toLocaleString('el-GR',{maximumFractionDigits:1})} ώρες διαδρομή`;
        const firstBreak=card.querySelector('.break');
        if(firstBreak){
          if(d.transportMode==='car'&&d.transportDetails){
            const x=d.transportDetails;
            firstBreak.innerHTML=`<span>Μεταφορά ΙΧ · ${x.roadKm||'—'} χλμ μετ' επιστροφής</span><b>€${d.transport.toLocaleString('el-GR')}</b><span>${x.exact?'':'εκτίμηση · '}${d.consumptionL100.toLocaleString('el-GR')} L/100 km · καύσιμα €${(x.fuelCost||0).toLocaleString('el-GR')} + διόδια/τέλη €${Number(x.tolls||0).toLocaleString('el-GR',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>`;
          }else if(d.transportMode==='plane'){
            firstBreak.innerHTML=`<span>Αεροπορικά μετ’ επιστροφής</span><b>€${d.transport.toLocaleString('el-GR')}</b><span>εκτίμηση για όλους τους ταξιδιώτες</span>`;
          }else if(d.transportMode==='ferry'){
            firstBreak.innerHTML=`<span>Ακτοπλοϊκά μετ’ επιστροφής</span><b>€${d.transport.toLocaleString('el-GR')}</b><span>εκτίμηση για όλους τους ταξιδιώτες</span>`;
          }
        }
      });
      const p=document.querySelector('#resultsCard>p.muted');
      if(p){
        const excluded=before-scored.length;
        if(limit)p.innerHTML+=`<br><span class="tiny">Σκληρό φίλτρο μετακίνησης: έως ${limit.toLocaleString('el-GR')} ώρες ανά μονή διαδρομή · αποκλείστηκαν ${excluded} μη συμβατοί προορισμοί.</span>`;
        if(state.transport==='car')p.innerHTML+=`<br><span class="tiny">ΙΧ: ${currentConsumption().toLocaleString('el-GR')} L/100 km · βενζίνη €${FUEL_PRICE.toLocaleString('el-GR',{minimumFractionDigits:2})}/L · καύσιμα + διόδια/οδικά τέλη.</span>`;
      }
      if(!scored.length){
        const grid=document.querySelector('#resultsCard .destinations');
        if(grid)grid.innerHTML='<div style="grid-column:1/-1;padding:24px;border:1px solid rgba(255,122,22,.3);border-radius:16px">Δεν βρέθηκαν προορισμοί που να ικανοποιούν ταυτόχρονα το μέσο μεταφοράς και το όριο χρόνου. Αύξησε το όριο ή επίλεξε διαφορετικό μέσο.</div>';
      }
    };
  }
  setTimeout(injectTransportExtras,0);
});
})();
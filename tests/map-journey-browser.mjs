import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base=process.env.HORIZON_TEST_URL||'http://127.0.0.1:8765/';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
try {
  const page=await browser.newPage({viewport:{width:390,height:844}});
  // Only third-party data/graphics are mocked. Run the exact published map HTML.
  await page.addInitScript(()=>{
    window.maplibregl={
      Map:class{addControl(){} getLayer(){} getStyle(){return {sources:{}};} on(event,fn){if(event==='load')setTimeout(fn,0);} fitBounds(){} easeTo(){} flyTo(){} addSource(){window.routeDrawn=true;} addLayer(){}},
      Marker:class{constructor(o){this.el=o.element;} setLngLat(){return this;} addTo(){document.body.append(this.el);return this;}},
      NavigationControl:class{},LngLatBounds:class{extend(){}}
    };
  });
  let geocoded=[],routes=0;
  await page.route('https://**/*',async r=>{
    const u=new URL(r.request().url());
    if(u.hostname==='civilengineergreece.github.io')return r.continue();
    if(u.hostname==='unpkg.com')return r.abort();
    if(u.hostname==='nominatim.openstreetmap.org'){
      const q=u.searchParams.get('q');geocoded.push(q);
      const n=Number(/Stop (\d+)/.exec(q)?.[1]||0);
      return r.fulfill({json:n===12?[]:[{lat:String(37+n/1000),lon:'23.7',display_name:q}]});
    }
    if(u.hostname==='router.project-osrm.org'||u.hostname==='routing.openstreetmap.de'){
      routes++;return r.fulfill({status:503,body:'Unavailable'});
    }
    return r.abort();
  });
  const url=new URL('map.html',base);url.searchParams.set('d','Athens');
  for(let n=1;n<=13;n++)url.searchParams.append('stop','Stop '+n);
  await page.goto(url.toString(),{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelectorAll('.hz-legend-item').length===10,{},{timeout:25000});
  assert.equal(geocoded.length,10);
  assert.match(await page.locator('#status').innerText(),/router/);
  assert.equal(await page.evaluate(()=>!!window.routeDrawn),false,'No straight line when routing fails');
  await page.getByRole('link',{name:'Επόμενες →'}).click();
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Stop 12'),{},{timeout:20000});
  assert.deepEqual(geocoded.slice(10).map(q=>q.split(',')[0]),['Stop 10','Stop 11','Stop 12','Stop 13']);
  assert.deepEqual(await page.locator('.hz-legend-num').allTextContents(),['10','11','13']);
  assert.match(await page.locator('#status').innerText(),/Δεν υπολογίστηκε οδική διαδρομή/);
  assert.equal(routes,2,'Only the first complete segment may call the router');
  assert.equal(await page.evaluate(()=>!!window.routeDrawn),false);
  console.log('PASS: 13 stops, overlap, preserved numbering, no fake route on failure or missing stop; no live provider calls');
}finally{await browser.close();}

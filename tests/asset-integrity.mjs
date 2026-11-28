import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const assets=[
  ['map-css','https://unpkg.com/maplibre-gl@5.24.1/dist/maplibre-gl.css'],
  ['map-js','https://unpkg.com/maplibre-gl@5.24.1/dist/maplibre-gl.js'],
  ['pdf','https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js'],
  ['fontkit','https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js'],
  ['qr','https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'],
  ['font','https://pdf-lib.js.org/assets/ubuntu/Ubuntu-R.ttf']
];
for(const [name,url] of assets){
  const res=await fetch(url,{signal:AbortSignal.timeout(20000),redirect:'error'});
  assert.equal(res.status,200,name);
  const bytes=Buffer.from(await res.arrayBuffer());
  assert.ok(bytes.length>1000,name+' asset too short');
  assert.ok(!res.headers.get('content-type')?.includes('text/html'),name+' unexpected HTML');
  console.log(name+' sha384-'+createHash('sha384').update(bytes).digest('base64')+' bytes='+bytes.length);
}

import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const assets=[
  ['map-css','https://unpkg.com/maplibre-gl@5.24.1/dist/maplibre-gl.css'],
  ['map-js','https://unpkg.com/maplibre-gl@5.24.1/dist/maplibre-gl.js'],
  ['pdf','https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js'],
  ['fontkit','https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js'],
  ['pdf','https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js'],
  ['fontkit','https://unpkg.com/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js'],
  ['qr','https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'],
  ['font','https://pdf-lib.js.org/assets/ubuntu/Ubuntu-R.ttf']
];
const expected={
  "map-css": "sha384-uTttxo/aOKbdE5RlD/SPzSDoDmNvGlUYPjONi2MN/b7c9HPSvW07OIuyP7uL6jxK",
  "map-js": "sha384-nXMl9YiLoSG5KBPTFgvxVuIqQQcqIvo0bFrvoEaGJC6r7IibIzF1S36Zbf/sKBtL",
  "pdf": "sha384-weMABwrltA6jWR8DDe9Jp5blk+tZQh7ugpCsF3JwSA53WZM9/14PjS5LAJNHNjAI",
  "fontkit": "sha384-2p6U+1mmqF10USehFeRiyG2ESG9FwIqN+jxULn5w9jjQIihSn9Pt13dVCn/Hawjn",
  "qr": "sha384-3zSEDfvllQohrq0PHL1fOXJuC/jSOO34H46t6UQfobFOmxE5BpjjaIJY5F2/bMnU",
  "font": "sha384-Kaa1DR9RrWRmy77vZ4Y+EtGcndRNQ2I+Xf3+fpAxpEzWYF6Ch9ybkd7NPMjV+xEt"
};
for(const [name,url] of assets){
  const res=await fetch(url,{signal:AbortSignal.timeout(20000),redirect:'error'});
  assert.equal(res.status,200,name);
  const bytes=Buffer.from(await res.arrayBuffer());
  assert.ok(bytes.length>1000,name+' asset too short');
  assert.ok(!res.headers.get('content-type')?.includes('text/html'),name+' unexpected HTML');
  const digest='sha384-'+createHash('sha384').update(bytes).digest('base64');
  assert.equal(digest,expected[name],name+' integrity mismatch');
  console.log(name+' '+digest+' bytes='+bytes.length);
}

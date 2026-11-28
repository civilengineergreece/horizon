import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const names=['live-hotel-smoke','live-worker-flight-smoke','live-sky-pinned-audit','live-gq-family-discovery','live-hotel-matrix'];
test('paid audit scripts refuse to make any request without explicit opt-in',()=>{
  for(const name of names){
    const res=spawnSync(process.execPath,['worker/tests/'+name+'.mjs'],{encoding:'utf8',env:{...process.env,HORIZON_ALLOW_BILLABLE:'false'},timeout:5000});
    assert.equal(res.status,2,name);
    assert.match(res.stderr,/Live audit blocked/);
    assert.equal(res.stdout,'',name);
  }
});
test('billable CI workflows require manual operator approval',()=>{
  for(const name of ['live-hotel-smoke','live-worker-flight-smoke','sky-exact-flight-audit','gq-family-flight-discovery']){
    const source=readFileSync('.github/workflows/'+name+'.yml','utf8');
    assert.doesNotMatch(source,/^  (push|pull_request):/m);
    assert.match(source,/workflow_dispatch:/);
    assert.match(source,/if: inputs.authorize_billable == true/);
    assert.match(source,/HORIZON_ALLOW_BILLABLE: 'true'/);
  }
});
test('active frontend and trip map use CSP with externalized application JavaScript',()=>{
  for(const file of ['index.html','map.html']){
    const source=readFileSync(file,'utf8');
    const policy=source.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/i)?.[1];
    assert.ok(policy,file);
    assert.match(policy,/object-src 'none'/);
    assert.doesNotMatch(policy.match(/script-src [^;]+/)?.[0]||'',/unsafe-inline|unsafe-eval/);
    assert.doesNotMatch(source,/<script\s*>/i);
  }
});

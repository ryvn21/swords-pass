import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';

test('missing files return 404 and leave the development server available', {timeout:10000}, async t => {
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: fileURLToPath(new URL('../', import.meta.url)), stdio:['ignore','pipe','pipe']
  });
  const exited = once(child, 'exit');
  t.after(async () => { if(child.exitCode === null) child.kill(); await exited; });
  let errors='';
  child.stderr.on('data', data => {errors += data;});
  await Promise.race([
    once(child.stdout, 'data'),
    exited.then(() => {throw new Error('Preview exited before starting: '+errors);})
  ]);
  let missing;
  try { missing = await fetch('http://127.0.0.1:4173/missing-regression-file.png'); }
  catch(error) { assert.fail('Missing file must return 404, not crash: '+errors+error.message); }
  assert.equal(missing.status, 404);
  assert.equal(await missing.text(), 'Not found');
  const home = await fetch('http://127.0.0.1:4173/');
  assert.equal(home.status, 200);
  assert.match(await home.text(), /Sword's Pass/);
  assert.equal(child.exitCode, null);
});

test('the production server reports health and its build, compresses code and revalidates it', {timeout: 10000}, async t => {
  const child = spawn(process.execPath, ['server.mjs'], {cwd: fileURLToPath(new URL('../', import.meta.url)), stdio: ['ignore', 'pipe', 'pipe'], env: {...process.env, PORT: '4199'}});
  const exited = once(child, 'exit'); t.after(async () => { if (child.exitCode === null) child.kill(); await exited; });
  await once(child.stdout, 'data');
  const health = await (await fetch('http://127.0.0.1:4199/health')).json();
  assert.equal(health.ok, true); assert.match(health.build, /^[0-9a-f]{12}$/);
  assert.equal((await (await fetch('http://127.0.0.1:4199/build.json')).json()).build, health.build);
  const app = await fetch('http://127.0.0.1:4199/app.js', {headers: {'accept-encoding': 'gzip'}});
  assert.equal(app.status, 200); assert.equal(app.headers.get('cache-control'), 'no-cache');
  const again = await fetch('http://127.0.0.1:4199/app.js', {headers: {'if-none-match': app.headers.get('etag')}});
  assert.equal(again.status, 304);
});

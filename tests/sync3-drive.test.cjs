'use strict';
/* Sync V3 Drive layer on the in-memory fake Drive: md5, names, one-call listing with paging, changed-only download,
   verified upload (corrupt upload retried, crash keeps the old file, quota full surfaces), shadow guard. */
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../js/sync3-drive.js');
const { FakeDrive, md5 } = require('./support/sync3-fake-drive.cjs');

test('md5 matches the reference implementation (empty, short, long, non-ASCII)', () => {
  for (const s of ['', 'a', 'abc', 'message digest', 'x'.repeat(1000), 'héllo wörld ✓ 日本語', JSON.stringify({ a: [1, 2, 3], b: 'x'.repeat(70) })]) assert.equal(D.md5Hex(s), md5(s));
});

test('names round-trip: device, replicas, content parts, snapshots, migration marker', () => {
  const N = D.N;
  assert.deepEqual(D.parseName(N.dev('d1')), { type: 'dev', dev: 'd1' });
  assert.deepEqual(D.parseName(N.form('d1', 'n-11')), { type: 'form', dev: 'd1', uid: 'n-11' });
  assert.deepEqual(D.parseName(N.form('d1', '__QBANK__')), { type: 'form', dev: 'd1', uid: '__QBANK__' });
  assert.deepEqual(D.parseName(N.form('d1', 'a.b c')), { type: 'form', dev: 'd1', uid: 'a.b c' });
  assert.deepEqual(D.parseName(N.lib('d1')), { type: 'lib', dev: 'd1' });
  assert.deepEqual(D.parseName(N.lease('d1')), { type: 'lease', dev: 'd1' });
  assert.deepEqual(D.parseName(N.content('abc123', 2)), { type: 'content', sha: 'abc123', part: 2 });
  assert.deepEqual(D.parseName(N.content('abc123')), { type: 'content', sha: 'abc123', part: null });
  assert.deepEqual(D.parseName(N.snapshot('d1', '20261025', 'n-11')), { type: 'snapshot', dev: 'd1', day: '20261025', uid: 'n-11' });
  assert.equal(D.parseName('v3.migration.json').type, 'migration'); assert.equal(D.parseName('exam-simulator2.manifest.json').type, 'other');
});

test('listV3: one paged call returns every v3 file with its checksum; V2 files are not listed', async () => {
  const fake = new FakeDrive(); fake.pageSize = 2;
  for (let i = 0; i < 5; i++) fake.put(`v3.r.d${i}.lib.json`, { i });
  fake.put('exam-simulator2.manifest.json', {});
  const drive = D.create({ auth: fake });
  const files = await drive.listV3();
  assert.equal(files.length, 5); assert.ok(files.every(f => f.md5Checksum && f.name.startsWith('v3.')));
  assert.equal(files[0].md5Checksum, md5(JSON.stringify({ i: 0 })));
});

test('downloadChanged: only files whose checksum differs from the cache are fetched, 4 in parallel; errors are reported not thrown', async () => {
  const fake = new FakeDrive();
  for (let i = 0; i < 6; i++) fake.put(`v3.r.d${i}.lib.json`, { i });
  fake.put('v3.r.bad.lib.json', '{not json');
  const drive = D.create({ auth: fake }), files = await drive.listV3();
  const first = await drive.downloadChanged(files, {});
  assert.equal(Object.keys(first.downloaded).length, 6); assert.deepEqual(Object.keys(first.errors), ['v3.r.bad.lib.json']);
  const cache = Object.fromEntries(Object.entries(first.downloaded).map(([n, f]) => [n, { md5: f.md5 }]));
  fake.set('v3.r.d3.lib.json', { i: 33 });
  const again = await drive.downloadChanged(await drive.listV3(), cache);
  assert.deepEqual(Object.keys(again.downloaded), ['v3.r.d3.lib.json']); assert.deepEqual(Object.keys(again.errors), ['v3.r.bad.lib.json']);
  assert.equal(again.downloaded['v3.r.d3.lib.json'].json.i, 33); assert.equal(again.skipped, 5);
});

test('Release A: writes are refused before any request (shadow mode)', async () => {
  const fake = new FakeDrive(), drive = D.create({ auth: fake });
  for (const op of [() => drive.upload('v3.r.d.lib.json', {}), () => drive.copy('x', 'y'), () => drive.remove('x')]) await assert.rejects(op, e => e instanceof D.ShadowModeError);
  assert.equal(fake.log.length, 0, 'no request was made'); assert.equal(fake.files.size, 0);
});

test('verified upload (writes enabled for the test): new file, update, corrupt upload retried, crash keeps the old content, quota full surfaces', async () => {
  const fake = new FakeDrive(), drive = D.create({ auth: fake, writesEnabled: true });
  const a = await drive.upload('v3.r.d.lib.json', { n: 1 });
  assert.equal(a.md5Checksum, md5(JSON.stringify({ n: 1 }))); assert.deepEqual(fake.json('v3.r.d.lib.json'), { n: 1 });
  await drive.upload('v3.r.d.lib.json', { n: 2 }); assert.equal(fake.names().filter(n => n === 'v3.r.d.lib.json').length, 1);
  fake.faults.corruptNext = true;
  await drive.upload('v3.r.d.lib.json', { n: 3 }); assert.deepEqual(fake.json('v3.r.d.lib.json'), { n: 3 }, 'retried until the checksum matched');
  fake.faults.crashMidUpload = true;
  await assert.rejects(drive.upload('v3.r.d.lib.json', { n: 4 })); assert.deepEqual(fake.json('v3.r.d.lib.json'), { n: 3 }, 'old file intact');
  fake.faults.quotaFull = true;
  await assert.rejects(drive.upload('v3.r.d.lib.json', { n: 5 })); assert.deepEqual(fake.json('v3.r.d.lib.json'), { n: 3 });
  delete fake.faults.quotaFull; fake.faults.authExpired = true;
  await assert.rejects(drive.upload('v3.r.d.lib.json', { n: 6 })); assert.deepEqual(fake.json('v3.r.d.lib.json'), { n: 3 });
  delete fake.faults.authExpired;
  const c = await drive.copy(fake.byName('v3.r.d.lib.json').id, 'v3.c.abc.json'); assert.equal(c.md5Checksum, md5(JSON.stringify({ n: 3 })));
  await drive.remove(c.id); assert.equal(fake.byName('v3.c.abc.json'), null);
});

test('content parts: small content is one file, large content is split into 4 MB parts', () => {
  const drive = D.create({ auth: new FakeDrive() });
  assert.deepEqual(drive.contentParts('ab', 'xyz').map(p => p.name), ['v3.c.ab.p0.json']);
  const big = 'x'.repeat(D.PART_BYTES * 2 + 5);
  assert.deepEqual(drive.contentParts('ab', big).map(p => p.name), ['v3.c.ab.p0.json', 'v3.c.ab.p1.json', 'v3.c.ab.p2.json']);
});

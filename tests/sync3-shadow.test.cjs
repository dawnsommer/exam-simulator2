'use strict';
/* Sync V3 ThunderShadow logger files (v3.t.*): merged, never replaced. Two simulated devices (own disk and cache, the REAL logger) and one fake Drive:
   upload, pull-merge, convergence to one Drive object per file, deletes (tombstones), failed/invalid downloads, name parsing. */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const Drive = require('../js/sync3-drive.js');
const Sync = require('../js/sync3-sync.js');
const { load, entry, bucket } = require('./support/shadow-env.cjs');

const source = path.join(__dirname, '..', 'shadow-logger.js');
const sha = t => crypto.createHash('sha256').update(t).digest('hex');

function fakeDrive() {
  let n = 0; const files = new Map(), log = { up: [], rm: [], dl: [] };
  return {
    files, log,
    drive: {
      async upload(name, obj) { log.up.push(name); for (const [id, f] of files) if (f.name === name) { f.obj = obj; return { id }; } const id = 'id' + ++n; files.set(id, { name, obj }); return { id }; },
      async remove(id) { log.rm.push(files.get(id).name); files.delete(id); },
      async downloadJson(id) { log.dl.push(files.get(id).name); return JSON.parse(JSON.stringify(files.get(id).obj)); }
    },
    listing: () => [...files].map(([id, f]) => ({ id, name: f.name })),
    names: () => [...files.values()].map(f => f.name).sort()
  };
}
function device(seed) {
  const env = load({ source, seed });
  const shadow = { list: () => env.SL.files.list(), write: (id, t) => env.SL.files.write(id, t), merge: (a, b) => env.SL.files.merge(a, b), sha256: async t => sha(t) };
  return { ...env, shadow };
}
const run = (d, fd) => Sync.syncShadow({ files: fd.listing(), drive: fd.drive, Drive, shadow: d.shadow });
const seedOf = (entries, over) => ({ forms: { 'F1::A1': bucket(entries, over) } });
const E = (n, extra) => entry(1, n, Object.assign({ entryNumber: n }, extra));

test('names: shadow objects round-trip through parseName', () => {
  const name = Drive.N.shadow('C-IM-07', sha('x'));
  assert.deepEqual(Drive.parseName(name), { type: 'shadow', id: 'C-IM-07', sha: sha('x').slice(0, 16) });
  assert.equal(Drive.parseName('v3.t.bad id.json').type, 'other');
  assert.notEqual(Drive.parseName('v3.s.dev.20261110.F1.json').type, 'shadow');
});

test('a log the Drive does not hold is uploaded; running again moves nothing', async () => {
  const fd = fakeDrive(), a = device(seedOf({ '1.02': E(2) }));
  let r = await run(a, fd);
  assert.deepEqual(r.uploaded, ['F1']); assert.equal(fd.names().length, 1);
  const o = [...fd.files.values()][0].obj; assert.equal(o.type, 'step-sync3-shadow'); assert.equal(o.id, 'F1'); assert.equal(sha(o.text).slice(0, 16), o.sha);
  fd.log.up.length = 0; fd.log.dl.length = 0;
  r = await run(a, fd);
  assert.equal(r.uploaded.length + r.pulled.length + r.removed, 0); assert.equal(fd.log.up.length, 0);
});

test('a new device with no log pulls it; its TSV matches', async () => {
  const fd = fakeDrive(), a = device(seedOf({ '1.02': E(2, { note: 'n' }), '1.05': E(5) })); await run(a, fd);
  const b = device(); const r = await run(b, fd);
  assert.deepEqual(r.pulled, ['F1']); assert.equal(b.SL.tsv(), a.SL.tsv());
  assert.equal(r.uploaded.length, 0); assert.equal(fd.names().length, 1);
});

test('two devices that both worked offline end up with the union, one Drive object, identical bytes', async () => {
  const fd = fakeDrive(), a = device(seedOf({ '1.02': E(2) })), b = device(seedOf({ '1.03': E(3), '1.02': E(2, { note: 'b edit', updatedAt: '2026-11-09T00:00:00.000Z' }) }));
  await run(a, fd); await run(b, fd); await run(a, fd); await run(b, fd);
  assert.equal(fd.names().length, 1, fd.names().join(','));
  assert.equal(a.SL.tsv(), b.SL.tsv());
  assert.equal(a.disk.get('progress/F1_shadow_log.json'), b.disk.get('progress/F1_shadow_log.json'));
  const rows = a.SL.tsv().split('\n'); assert.equal(rows.length, 3); assert.ok(rows[1].includes('b edit'));
});

test('concurrent uploads from both devices converge in two rounds and older copies are removed', async () => {
  const fd = fakeDrive(), a = device(seedOf({ '1.01': E(1) })), b = device(seedOf({ '1.01': E(1) }));
  await run(a, fd); await run(b, fd);
  a.SL.files.write; // both edit offline
  await a.SL.files.write('F1', JSON.stringify({ type: 'ThunderShadowLog', v: 2, id: 'F1', buckets: { 'F1::A1': bucket({ '1.07': E(7) }) } }));
  await b.SL.files.write('F1', JSON.stringify({ type: 'ThunderShadowLog', v: 2, id: 'F1', buckets: { 'F1::A1': bucket({ '1.08': E(8) }) } }));
  await run(a, fd); await run(b, fd); await run(a, fd);
  assert.equal(fd.names().length, 1);
  assert.equal(a.SL.tsv(), b.SL.tsv()); assert.equal(a.SL.tsv().split('\n').length, 4);
});

test('a delete on one device reaches the other and is not undone by a stale copy', async () => {
  const fd = fakeDrive(), a = device(seedOf({ '1.02': E(2), '1.03': E(3) }));
  await run(a, fd);
  const b = device(); await run(b, fd);
  const text = JSON.stringify({ type: 'ThunderShadowLog', v: 2, id: 'F1', buckets: { 'F1::A1': bucket({ '1.02': { examItem: '1.02', block: 1, item: 2, deleted: true, updatedAt: '2030-01-01T00:00:00.000Z' } }) } });
  await b.SL.files.write('F1', text);
  await run(b, fd); await run(a, fd);
  assert.equal(a.SL.tsv().split('\n').length, 2); assert.equal(a.SL.tsv(), b.SL.tsv());
  const stale = device(seedOf({ '1.02': E(2), '1.03': E(3) })); await run(stale, fd);
  assert.equal(stale.SL.tsv().split('\n').length, 2, 'a stale device does not resurrect the deleted question'); assert.equal(fd.names().length, 1);
});

test('different forms stay separate objects; Qbank sessions too', async () => {
  const fd = fakeDrive();
  const a = device({ forms: { 'F1::A1': bucket({ '1.01': E(1) }), 'F2::A1': bucket({ '1.01': E(1) }, { formId: 'F2', form: 'Two' }), 'QBANK_MODE::s': bucket({ '1.01': E(1) }, { formId: 'QBANK_MODE', form: 'Q' }) } });
  await run(a, fd);
  assert.deepEqual(fd.names().map(n => Drive.parseName(n).id).map(i => i.replace(/-[0-9a-f]{8}$/, '')), ['F1', 'F2', 'QBANK_MODE']);
});

test('an invalid or hash-mismatched Drive copy is reported, never merged, never removed; the local log is untouched', async () => {
  const fd = fakeDrive(), a = device(seedOf({ '1.02': E(2) }));
  const bad = { type: 'step-sync3-shadow', v: 1, id: 'F1', sha: 'a'.repeat(16), text: 'not json' };
  fd.files.set('x1', { name: Drive.N.shadow('F1', 'a'.repeat(16)), obj: bad });
  const before = a.SL.tsv();
  const r = await run(a, fd);
  assert.ok(r.errors.F1); assert.equal(a.SL.tsv(), before);
  assert.ok([...fd.files.values()].some(f => f.obj === bad), 'the unreadable copy is left alone');
  assert.deepEqual(r.uploaded, ['F1']);
});

test('a log that cannot be saved here (no DATA folder) is not uploaded as a merge result and nothing is removed', async () => {
  const fd = fakeDrive(), a = device(seedOf({ '1.02': E(2) })); await run(a, fd);
  const b = load({ source, noDisk: true, seed: seedOf({ '1.09': E(9) }) });
  const bs = { list: async () => [], write: (id, t) => b.SL.files.write(id, t), merge: (x, y) => b.SL.files.merge(x, y), sha256: async t => sha(t) };
  const r = await Sync.syncShadow({ files: fd.listing(), drive: fd.drive, Drive, shadow: bs });
  assert.ok(r.errors.F1); assert.equal(fd.names().length, 1); assert.equal(r.removed, 0);
  assert.equal(b.SL.tsv().split('\n').length, 3, 'the pulled entries are in the cache so a later run can save them');
});

test('a Drive copy is removed only when its content is really inside the saved result', async () => {
  const fd = fakeDrive(), a = device(seedOf({ '1.02': E(2) })), b = device(seedOf({ '1.03': E(3) }));
  await run(a, fd); await run(b, fd);
  const lying = { ...a.shadow, write: async (id, t) => ({ written: true, text: a.disk.get('progress/' + id + '_shadow_log.json') }) }; // claims it saved the merge but returns the old text
  const before = fd.names().length;
  await Sync.syncShadow({ files: fd.listing(), drive: fd.drive, Drive, shadow: lying });
  assert.ok(fd.names().length >= before - 0 && fd.names().length >= 1);
  assert.ok([...fd.files.values()].some(f => JSON.parse(f.obj.text).buckets['F1::A1'].entries['1.03']), "b's copy is not deleted");
});

test('the cycle runs the shadow step after the push and records it', async () => {
  const src = require('node:fs').readFileSync(path.join(__dirname, '..', 'js', 'sync3-sync.js'), 'utf8');
  assert.match(src, /shadow=null/); assert.match(src, /rep\.shadow=/); assert.match(src, /lastShadow/);
  const boot = require('node:fs').readFileSync(path.join(__dirname, '..', 'js', 'sync3-boot.js'), 'utf8');
  assert.match(boot, /createShadowAdapter/); assert.match(boot, /stepsim:shadowlog-write/);
});

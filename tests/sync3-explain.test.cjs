'use strict';
/* Sync V3 Rapid Review files (v3.x.*): upload when the Drive has no equal or newer key, pull when a file is missing or older,
   an equal key never moves a file, older Drive copies are removed, hash and shape checks, name parsing. */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const Drive = require('../js/sync3-drive.js');
const Sync = require('../js/sync3-sync.js');

const sha = t => crypto.createHash('sha256').update(t).digest('hex');
const mk = (id, gen, extra = {}) => JSON.stringify({ type: 'StepRapidReview', version: 1, formId: id, generatedAt: gen, items: { q1: { task: 'T' } }, ...extra });
const key = d => String(d).replace(/\D/g, '').padEnd(14, '0').slice(0, 14);

/* a fake Drive: files by id, a listing in the shape syncExplain takes, and the three calls it makes */
function rig({ remote = {}, local = {}, installed = Object.keys(local) } = {}) {
  let n = 0;
  const files = new Map(), log = { up: [], rm: [] };
  const put = (name, obj) => { const id = 'id' + ++n; files.set(id, { name, obj }); return id; };
  for (const [name, obj] of Object.entries(remote)) put(name, obj);
  const drive = {
    async upload(name, obj) { log.up.push(name); for (const [id, f] of files) if (f.name === name) { f.obj = obj; return { id }; } return { id: put(name, obj) }; },
    async remove(id) { log.rm.push(files.get(id).name); files.delete(id); },
    async downloadJson(id) { return JSON.parse(JSON.stringify(files.get(id).obj)); }
  };
  const store = { ...local };
  const explain = {
    async list() { return Object.entries(store).map(([id, t]) => { const d = JSON.parse(t); return { id, key: key(d.updatedAt || d.generatedAt), text: t }; }); },
    async installedIds() { return installed; },
    async write(id, text) { store[id] = text; return { written: true }; },
    sha256: async t => sha(t)
  };
  const listing = () => [...files].map(([id, f]) => ({ id, name: f.name }));
  const run = (extra = {}) => Sync.syncExplain({ files: listing(), drive, Drive, explain, ...extra });
  return { run, store, files, log, drive };
}
const wrap = (id, text) => { const d = JSON.parse(text), k = key(d.updatedAt || d.generatedAt), s = sha(text).slice(0, 16); return [Drive.N.explain(id, k, s), { type: 'step-sync3-explain', v: 1, formId: id, key: k, sha: s, text }]; };

test('names: explain objects round-trip through parseName', () => {
  const name = Drive.N.explain('C-IM-07', '20261030000000', sha('x'));
  assert.deepEqual(Drive.parseName(name), { type: 'explain', formId: 'C-IM-07', key: '20261030000000', sha: sha('x').slice(0, 16) });
  assert.equal(Drive.parseName('v3.x.bad.json').type, 'other');
});

test('a local file the Drive does not hold is uploaded as write-once content', async () => {
  const t = mk('A', '2026-10-30');
  const r = rig({ local: { A: t } });
  const out = await r.run();
  assert.deepEqual(out.uploaded, ['A']);
  const [name, obj] = wrap('A', t);
  assert.deepEqual(r.log.up, [name]);
  assert.deepEqual([...r.files.values()][0].obj, obj);
  assert.equal(out.saved, 1); assert.equal(out.total, 1);
});

test('the same file again uploads nothing; an equal key with other content does not move either side', async () => {
  const t = mk('A', '2026-10-30'), t2 = mk('A', '2026-10-30', { extra: 1 });
  const [name, obj] = wrap('A', t);
  const same = rig({ local: { A: t }, remote: { [name]: obj } });
  let out = await same.run(); assert.equal(out.uploaded.length + out.pulled.length, 0); assert.equal(out.saved, 1);
  const tie = rig({ local: { A: t2 }, remote: { [name]: obj } });
  out = await tie.run(); assert.equal(out.uploaded.length + out.pulled.length, 0); assert.equal(tie.store.A, t2); assert.equal(out.saved, 0);
});

test('a newer local file is uploaded and the older Drive copies are removed', async () => {
  const old = mk('A', '2026-10-29'), now = mk('A', '2026-10-30', { updatedAt: '2026-10-31T08:00:00Z' });
  const [oname, oobj] = wrap('A', old);
  const r = rig({ local: { A: now }, remote: { [oname]: oobj } });
  const out = await r.run();
  assert.deepEqual(out.uploaded, ['A']); assert.equal(out.removed, 1); assert.deepEqual(r.log.rm, [oname]);
  assert.deepEqual([...r.files.values()].map(f => f.name), [wrap('A', now)[0]]);
});

test('a missing file of an installed form is pulled, verified and written; an uninstalled form is not', async () => {
  const t = mk('A', '2026-10-30'), u = mk('B', '2026-10-30');
  const [an, ao] = wrap('A', t), [bn, bo] = wrap('B', u);
  const r = rig({ local: {}, installed: ['A'], remote: { [an]: ao, [bn]: bo } });
  const out = await r.run();
  assert.deepEqual(out.pulled, ['A']); assert.equal(r.store.A, t); assert.equal(r.store.B, undefined);
  assert.equal(out.saved, 1);
});

test('a newer Drive copy replaces an older local file', async () => {
  const old = mk('A', '2026-10-29'), now = mk('A', '2026-10-30', { updatedAt: '2026-10-31T08:00:00Z' });
  const [n, o] = wrap('A', now);
  const r = rig({ local: { A: old }, remote: { [n]: o } });
  const out = await r.run();
  assert.deepEqual(out.pulled, ['A']); assert.equal(r.store.A, now); assert.equal(out.uploaded.length, 0);
});

test('a damaged or mismatched Drive object is refused and the local state is kept', async () => {
  const t = mk('A', '2026-10-30'), [n, o] = wrap('A', t);
  const bad = rig({ local: {}, installed: ['A'], remote: { [n]: { ...o, text: t + ' ' } } });
  let out = await bad.run(); assert.equal(out.pulled.length, 0); assert.ok(out.errors.A); assert.equal(bad.store.A, undefined);
  const wrong = rig({ local: {}, installed: ['A'], remote: { [n]: { ...o, formId: 'Z' } } });
  out = await wrong.run(); assert.equal(out.pulled.length, 0); assert.ok(out.errors.A);
});

test('the upload budget defers the rest to the next cycle', async () => {
  const a = mk('A', '2026-10-30'), b = mk('B', '2026-10-30');
  const r = rig({ local: { A: a, B: b } });
  let out = await r.run({ budget: a.length + 1 });
  assert.equal(out.uploaded.length, 1); assert.equal(out.deferred, 1);
  out = await r.run({ budget: 1e6 });
  assert.equal(out.uploaded.length, 1); assert.equal(out.saved, 2);
});

test('a failed upload is reported for that form and the others still go', async () => {
  const a = mk('A', '2026-10-30'), b = mk('B', '2026-10-30');
  const r = rig({ local: { A: a, B: b } });
  const up = r.drive.upload; r.drive.upload = async (name, obj) => { if (obj.formId === 'A') throw new Error('offline'); return up(name, obj); };
  const out = await r.run();
  assert.deepEqual(out.uploaded, ['B']); assert.match(out.errors.A, /offline/);
});

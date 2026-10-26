'use strict';
/* Sync V3 shadow engine: stamping by diff (only changed values get a stamp), explicit defaults, write-once keys,
   attempt delete / reset tombstones and the bootstrap gate, QID-pending forms, per-device time, dirty flags. */
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/sync3-core.js');
const Bridge = require('../js/sync3-bridge.js');
const Store = require('../js/sync3-store.js');
const Sync = require('../js/sync3-sync.js');
const { K } = C;

const QIDS = ['q1', 'q2', 'q3'];
function blockOf(over = {}) {
  return { blockName: 'B1', total: 3, questionQids: QIDS, answers: [null, null, null], firstAnswers: [null, null, null], flagged: [false, false, false], struck: {}, revealed: {}, questionTime: [0, 0, 0], notes: '', blockCompleted: false, answerChangeLog: [], stemHighlightAnchors: {}, explanationHighlightAnchors: {}, ...over };
}
const progress = (blocks, att = 'a1') => ({ bundle: { activeAttemptId: att, attempts: [{ attemptId: att, label: '1st', session: { blocks } }] } });
const REC = { id: 'F1', formUid: 'f1', qidSchemaVersion: 1, bankHash: 'H', displayName: 'F1', defaultName: 'F1' };

function rig(opts = {}) {
  let t = Date.parse('2026-10-25T12:00:00Z'), state = { progress: null, settings: {} };
  const store = Store.create({ backend: Store.memoryBackend(), now: () => t, random: () => 'aaaaaaaa' });
  const source = {
    async readForms() { const forms = {}; if (state.progress !== undefined) forms.f1 = { extract: await Bridge.extractForm({ formUid: 'f1', rec: REC, progress: state.progress, dev: 'daaaaaaaa' }) }; return { forms }; },
    async readSettings() { return state.settings; }
  };
  const eng = Sync.create({ store, source, now: () => t });
  return { store, eng, state, tick: ms => { t += ms; } };
}

test('first scan stamps every unit; a scan with no change stamps nothing; stamps are unique and increasing', async () => {
  const r = rig(); r.state.progress = progress([blockOf({ answers: [1, null, 2], firstAnswers: [1, null, 2], flagged: [true, false, false] })]);
  const a = await r.eng.scan();
  assert.ok(a.totals.changed >= 6); assert.equal(a.forms.f1.complete, true);
  const known = await r.store.known(), stamps = Object.values(known).map(u => u.t);
  assert.equal(new Set(stamps).size, stamps.length);
  const b = await r.eng.scan(); assert.equal(b.totals.changed, 0); assert.deepEqual(await r.store.known(), known);
  assert.equal((await r.store.dirty()).forms.f1, true, 'form marked dirty (nothing is pushed in Release A)');
});

test('changing one answer stamps exactly that unit (and the log entry); first answer is write-once', async () => {
  const r = rig(); r.state.progress = progress([blockOf({ answers: [1, null, null], firstAnswers: [1, null, null] })]);
  await r.eng.scan(); r.tick(5000);
  r.state.progress = progress([blockOf({ answers: [3, null, null], firstAnswers: [1, null, null], answerChangeLog: [{ item: 1, from: 1, to: 3 }] })]);
  const rep = await r.eng.scan(), known = await r.store.known();
  assert.equal(rep.totals.changed, 2);                                  // ans + log
  assert.equal(known[K.item('f1:a1', 'q1', 'ans')].v, 3); assert.equal(known[K.item('f1:a1', 'q1', 'first')].v, 1);
  const log = known[K.item('f1:a1', 'q1', 'log')].v; assert.equal(log.length, 1); assert.ok(C.parseStamp(log[0].t));
  // a second change appends to the log, the existing entry keeps its stamp
  const firstT = log[0].t; r.tick(5000);
  r.state.progress = progress([blockOf({ answers: [2, null, null], firstAnswers: [1, null, null], answerChangeLog: [{ item: 1, from: 1, to: 3 }, { item: 1, from: 3, to: 2 }] })]);
  await r.eng.scan(); const log2 = (await r.store.known())[K.item('f1:a1', 'q1', 'log')].v;
  assert.equal(log2.length, 2); assert.equal(log2[0].t, firstT); assert.equal(log2[1].to, 2);
});

test('clearing a value writes its default explicitly (absence never deletes): answer, flag, strikes, notes', async () => {
  const r = rig(); r.state.progress = progress([blockOf({ answers: [1, null, null], flagged: [true, false, false], struck: { 0: [2] }, notes: 'x' })]);
  await r.eng.scan(); r.tick(1000);
  r.state.progress = progress([blockOf()]);
  const rep = await r.eng.scan(), k = await r.store.known();
  assert.equal(rep.totals.changed, 4);
  assert.equal(k[K.item('f1:a1', 'q1', 'ans')].v, null); assert.equal(k[K.item('f1:a1', 'q1', 'fl')].v, false);
  assert.deepEqual(k[K.item('f1:a1', 'q1', 'st')].v, []); assert.equal(k[K.block('f1:a1', 1, 'nt')].v, '');
  assert.equal(C.countUnits(C.view(k, { now: Date.now() }).units).answered, 0);
});

test('completed blocks stay completed (true wins); per-device time is this device\'s share only', async () => {
  const r = rig(); r.state.progress = progress([blockOf({ answers: [1, 1, 1], blockCompleted: true, questionTime: [30, 0, 0] })]);
  await r.eng.scan();
  const k0 = await r.store.known(); assert.equal(k0[K.block('f1:a1', 1, 'done')].v.done, true); assert.deepEqual(k0[K.item('f1:a1', 'q1', 'tm')].v, { daaaaaaaa: 30 });
  // another device's time for q1 arrives in known (merged); the app then shows 40 s in total -> this device holds 30, not 40
  k0[K.item('f1:a1', 'q1', 'tm')] = { v: { daaaaaaaa: 30, dother: 10 }, t: k0[K.item('f1:a1', 'q1', 'tm')].t }; await r.store.setKnown(k0);
  r.state.progress = progress([blockOf({ answers: [1, 1, 1], blockCompleted: true, questionTime: [40, 0, 0] })]);
  assert.equal((await r.eng.scan()).totals.changed, 0);
  r.state.progress = progress([blockOf({ answers: [1, 1, 1], blockCompleted: true, questionTime: [50, 0, 0] })]);
  assert.equal((await r.eng.scan()).totals.changed, 1);
  assert.deepEqual((await r.store.known())[K.item('f1:a1', 'q1', 'tm')].v, { daaaaaaaa: 40, dother: 10 });
});

test('deleting an attempt writes A.del; deleting all progress writes F.reset; held back until the first pull (bootstrap gate)', async () => {
  for (const boot of [true, false]) {
    const r = rig(); await r.store.setBootstrapped(boot);
    const two = { bundle: { activeAttemptId: 'a1', attempts: [{ attemptId: 'a1', label: '1', session: { blocks: [blockOf({ answers: [1, null, null] })] } }, { attemptId: 'a2', label: '2', session: { blocks: [blockOf({ answers: [2, null, null] })] } }] } };
    r.state.progress = two; await r.eng.scan(); r.tick(1000);
    r.state.progress = progress([blockOf({ answers: [1, null, null] })], 'a1');          // attempt a2 deleted
    let rep = await r.eng.scan(), k = await r.store.known();
    if (boot) { assert.equal(rep.totals.tombstones, 1); assert.deepEqual(k[K.attField('f1:a2', 'del')].v, { del: true }); }
    else { assert.equal(rep.totals.held, 1); assert.ok(!k[K.attField('f1:a2', 'del')], 'no tombstone before the first pull'); }
    r.tick(1000); r.state.progress = null;                                                // all progress deleted
    rep = await r.eng.scan(); k = await r.store.known();
    if (boot) { assert.deepEqual(Object.keys(k).filter(x => x.endsWith('.reset')), [K.form('f1', 'reset')]); assert.ok(k[K.form('f1', 'reset')].v.at); assert.equal(C.countUnits(C.view(k, { now: Date.now() }).units).attempts, 0); }
    else assert.ok(!Object.keys(k).some(x => x.endsWith('.reset')));
  }
});

test('a form whose QIDs are pending is never read as deleted and produces no tombstones', async () => {
  const r = rig(); await r.store.setBootstrapped(true);
  r.state.progress = progress([blockOf({ answers: [1, null, null] })]); await r.eng.scan(); r.tick(1000);
  const b = blockOf({ answers: [1, null, null] }); delete b.questionQids; r.state.progress = progress([b]);
  const rep = await r.eng.scan();
  assert.equal(rep.totals.tombstones, 0); assert.equal(rep.totals.problems, 1); assert.equal(rep.forms.f1.complete, false);
  assert.ok(!(await r.store.known())[K.attField('f1:a1', 'del')]);
});

test('settings: changed values are stamped once; unchanged values are not', async () => {
  const r = rig(); r.state.progress = null; r.state.settings = { [K.setting('g', 'accent')]: 'blue' };
  assert.equal((await r.eng.scan()).settings.changed, 1); assert.equal((await r.eng.scan()).settings.changed, 0);
  r.state.settings = { [K.setting('g', 'accent')]: 'teal' }; assert.equal((await r.eng.scan()).settings.changed, 1);
  assert.equal((await r.store.dirty()).set, true);
});

test('only=<uid> scans one form (after a progress write) and leaves settings alone', async () => {
  const r = rig(); r.state.progress = progress([blockOf({ answers: [1, null, null] })]); r.state.settings = { [K.setting('g', 'accent')]: 'blue' };
  const rep = await r.eng.scan({ only: 'f1' }); assert.equal(rep.settings.changed, 0); assert.ok(rep.totals.changed > 0);
});

test('before the first pull, units carry the record\'s real modification time; after it they carry now', async () => {
  const r = rig(); r.state.progress = progress([blockOf({ answers: [1, null, null] })]);
  const wall = Date.parse('2026-09-01T10:00:00Z');
  const store = r.store, source = { async readForms() { return { forms: { f1: { modifiedAt: wall, extract: await Bridge.extractForm({ formUid: 'f1', rec: REC, progress: r.state.progress, dev: 'daaaaaaaa' }) } } }; }, async readSettings() { return {}; } };
  const eng = Sync.create({ store, source, now: () => wall + 86400000 * 54 });
  await eng.scan(); const k = await store.known();
  assert.ok(Object.values(k).every(u => C.parseStamp(u.t).wall === wall), 'old stamps while not bootstrapped');
  await store.setBootstrapped(true);
  r.state.progress = progress([blockOf({ answers: [2, null, null] })]);
  const source2 = { async readForms() { return { forms: { f1: { modifiedAt: wall + 1000, extract: await Bridge.extractForm({ formUid: 'f1', rec: REC, progress: r.state.progress, dev: 'daaaaaaaa' }) } } }; }, async readSettings() { return {}; } };
  await Sync.create({ store, source: source2, now: () => wall + 86400000 * 54 }).scan();
  assert.equal(C.parseStamp((await store.known())[K.item('f1:a1', 'q1', 'ans')].t).wall, Date.parse('2026-10-25T12:00:00Z'), 'stamped with the device clock once bootstrapped');
});

test('time already held by other devices adds nothing of mine (no echo after an apply)', async () => {
  const r = rig(); r.state.progress = progress([blockOf({ answers: [1, 1, 1], questionTime: [40, 0, 0] })]);
  await r.eng.scan(); await r.store.markDirty('lib');
  const k = await r.store.known(), tk = K.item('f1:a1', 'q1', 'tm');
  k[tk] = { v: { dother: 40 }, t: C.fmtStamp(Date.parse('2026-10-25T11:00:00Z'), 0, 'other') }; await r.store.setKnown(k);
  assert.equal((await r.eng.scan()).totals.changed, 0); assert.deepEqual((await r.store.known())[tk].v, { dother: 40 });
});

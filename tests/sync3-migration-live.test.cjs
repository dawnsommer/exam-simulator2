'use strict';
/* Sync V3 LIVE migration (Release B, plan section 8 steps 1-9, cleanup, restore) on the in-memory Drive with simulated devices:
   first device, later devices, crash and resume, two at once, fallback pauses, freeze + old app, cleanup rules, restore. */
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/sync3-core.js');
const D = require('../js/sync3-drive.js');
const M = require('../js/sync3-migrate.js');
const B = require('../js/sync3-bridge.js');
const { World, SimDevice } = require('./support/sync3-sim.cjs');
const { K } = C;

const Q = ['q1', 'q2', 'q3', 'q4'], MAN = 'exam-simulator2.manifest.json';
const blk = (o = {}) => ({ blockName: 'B1', configuredIndex: 0, total: 4, questionQids: Q, answers: [null, null, null, null], firstAnswers: [null, null, null, null], flagged: [false, false, false, false], struck: {}, revealed: {}, questionTime: [0, 0, 0, 0], notes: '', blockCompleted: false, answerChangeLog: [], stemHighlightAnchors: {}, explanationHighlightAnchors: {}, ...o });
const prog = (b, att = 'a1') => ({ fileType: 'StepExamSimulatorV10ProgressBundle', bundle: { activeAttemptId: att, attempts: [{ attemptId: att, label: att, type: 'initial', createdAt: '2026-10-20T00:00:00Z', session: { bankHash: 'H1', blocks: [blk(b)] } }] } });
const REC = { questionIndex: Q.map((q, i) => ({ qid: q, blockIndex: 0, questionIndex: i })) };
const backup = p => ({ type: 'x', payload: { progress: p, suspended: null, threeDigitScore: '' } });

/* a V2 adapter over the fake drive: rows are given by the test (what V2's analysis would say) */
function v2For(world, dev, rows, opts = {}) {
  const drive = dev.driveApi;
  return {
    flags: { disabled: false },
    async analyze() { return { rows: rows(), recs: Object.values(dev.app.forms).map(f => f.rec), manifest: { ...(world.drive.json(dev.v2scope ? M.FALLBACK_MANIFEST : MAN) || {}), schemaVersion: 2, updatedAt: '2026-10-24T10:00:00Z' } }; },
    async readBackup(entry, which) { const id = which === 'previous' ? entry.previousDriveFileId : entry.driveFileId; if (!id) throw new Error('none'); return JSON.parse(await drive.downloadText(id)); },
    files: () => M.v2Inventory(drive),
    freeze: fallback => M.freezeV2({ drive, manifestName: MAN, manifestType: 'exam-simulator2-progress-manifest', appId: 'exam-simulator2', fallback }),
    async disable() { this.flags.disabled = true; },
    async scope(uids) { this.flags.scope = uids.slice(); dev.v2scope = uids.length ? uids.slice() : null; }       // V2 reads the fallback manifest, only these forms
  };
}
function seedV2(world, uid, progress) {
  const id = world.drive.put('exam-simulator2.form.' + uid + '.r1.json', backup(progress));
  const man = world.drive.byName(MAN) ? world.drive.json(MAN) : { type: 'exam-simulator2-progress-manifest', schemaVersion: 2, appId: 'exam-simulator2', forms: {} };
  man.forms[uid] = { kind: 'form', formId: uid.toUpperCase(), formUid: uid, currentVersionId: 'r1', driveFileId: id, previousDriveFileId: null, checksum: 'c', updatedAt: '2026-10-24T10:00:00Z', deviceId: 'OLDDEV' };
  world.drive.set(MAN, man); return id;
}
const row = (uid, state, dev, over = {}) => ({ key: uid, formUid: uid, kind: 'form', state, meta: {}, cloud: (JSON.parse(dev.world.drive.byName(dev.v2scope ? M.FALLBACK_MANIFEST : MAN).body).forms || {})[uid] || null, local: dev.app.forms[uid] ? { formId: dev.app.forms[uid].rec.id, progress: dev.app.forms[uid].progress, suspended: null, threeDigitScore: '', modifiedAt: '2026-10-25T09:00:00Z', rec: dev.app.forms[uid].rec } : null, ...over });
const ctxOf = (dev, v2, extra = {}) => ({ store: dev.store, drive: dev.driveApi, engine: dev.engine, cycle: dev.getCycle(), applier: dev.applier, v2, now: dev.now, gateState: { runtime: { examVisible: false } }, ...extra });
const ans = (d, uid, a, i) => d.app.forms[uid].progress.bundle.attempts.find(x => x.attemptId === a).session.blocks[0].answers[i];
async function world1() {
  const w = new World(); w.catalog.f1 = { questions: Q }; w.catalog.f2 = { questions: Q };
  const A = new SimDevice(w, 'devA'); A.getCycle();
  seedV2(w, 'f1', prog({ answers: [1, null, null, null], firstAnswers: [1, null, null, null] }));
  seedV2(w, 'f2', prog({ answers: [2, 2, null, null], firstAnswers: [2, 2, null, null] }));
  A.install('f1', REC, prog({ answers: [null, 3, null, null], firstAnswers: [null, 3, null, null] }));          // DIVERGED: other questions than the cloud
  A.install('f2', REC, prog({ answers: [2, 2, null, null], firstAnswers: [2, 2, null, null] }));                // ALIGNED
  return { w, A };
}
const rowsOf = A => () => [row('f1', 'DIVERGED', A), row('f2', 'ALIGNED', A)];

test('first device: V2 forms are converted, DIVERGED merges both sides, replicas are pushed, V2 is frozen with an archive and a stub, marker done (+30 days)', async () => {
  const { w, A } = await world1(), v2 = v2For(w, A, rowsOf(A)), old = w.drive.byName(MAN).body, steps = [];
  const r = await M.runMigration(ctxOf(A, v2, { onProgress: p => steps.push(p.step) }));
  assert.equal(r.status, 'done'); assert.ok(steps.includes('legacy') && steps.includes('freeze') && steps.at(-1) === 'done');
  const names = w.drive.names();
  for (const n of ['v3.r.v2legacy.f.f1.json', 'v3.r.v2legacy.f.f2.json', 'v3.migration.json', 'v2.archive.manifest.json']) assert.ok(names.includes(n), n);
  assert.ok(names.some(n => n.startsWith('v3.r.' + 'devA'.padEnd(9, '0').replace(/^/, 'd').slice(0, 0))) || names.some(n => /^v3\.r\.d[^.]+\.f\.f1\.json$/.test(n) && !n.includes('v2legacy')), 'own replica pushed');
  assert.equal(w.drive.byName('v2.archive.manifest.json').body, old, 'the archive is an exact copy of the old manifest');
  const stub = w.drive.json(MAN); assert.equal(stub.schemaVersion, 3); assert.equal(stub.movedTo, 'v3');
  assert.notEqual(stub.schemaVersion, 2, 'old apps fail validateManifest (schema 2 required) and stop without writing');
  const m = w.drive.json('v3.migration.json'); assert.equal(m.status, 'done'); assert.equal(m.keepUntil, new Date(A.now() + 30 * 86400000).toISOString()); assert.ok(m.v2Files.length >= 3);
  assert.equal(v2.flags.disabled, true);
  assert.equal(ans(A, 'f1', 'a1', 0), 1, 'the cloud answer arrived'); assert.equal(ans(A, 'f1', 'a1', 1), 3, 'this device\'s answer kept'); assert.equal(ans(A, 'f2', 'a1', 1), 2);
  assert.equal((await A.store.migration()).status, 'done');
});

test('legacy replicas are byte-identical whichever device writes them (deterministic), also after a crash and a second run', async () => {
  const bodies = [];
  for (const crash of [false, true]) {
    const { w, A } = await world1(), v2 = v2For(w, A, rowsOf(A));
    if (crash) {
      let n = 0, orig = A.driveApi.upload.bind(A.driveApi);
      A.driveApi.upload = async (name, obj) => { if (++n === 4) throw new Error('connection lost'); return orig(name, obj); };
      await assert.rejects(M.runMigration(ctxOf(A, v2)));
      A.driveApi.upload = orig;
      assert.equal(w.drive.json('v3.migration.json').status, 'in-progress', 'a crash leaves the marker in progress');
    }
    A.world.advance(15);                                                   // heartbeat is stale: resumable
    const r = await M.runMigration(ctxOf(A, v2)); assert.equal(r.status, 'done');
    bodies.push(w.drive.byName('v3.r.v2legacy.f.f1.json').body + w.drive.byName('v3.r.v2legacy.f.f2.json').body);
  }
  assert.equal(bodies[0], bodies[1]);
});

test('per-form fallback: a form that cannot be converted stays on V2 through its own manifest; the other forms move', async () => {
  const { w, A } = await world1(), v2 = v2For(w, A, rowsOf(A)), man = w.drive.json(MAN);
  const bad = prog({ answers: [1, 1, 1, 1] }); delete bad.bundle.attempts[0].session.blocks[0].questionQids;
  A.setProgress('f1', bad);
  const r = await M.runMigration(ctxOf(A, v2));
  assert.equal(r.status, 'done'); assert.deepEqual(r.fallback.map(f => f.uid), ['f1']); assert.match(r.fallback[0].reasons.join(' '), /QIDs/);
  assert.deepEqual(v2.flags.scope, ['f1'], 'V2 keeps syncing f1 only'); assert.equal(v2.flags.disabled, false, 'V2 is not switched off');
  const fb = w.drive.json(M.FALLBACK_MANIFEST); assert.deepEqual(Object.keys(fb.forms), ['f1']); assert.deepEqual(fb.forms.f1, man.forms.f1, 'the entry is copied as it was (V2 stays ALIGNED)');
  assert.equal(w.drive.json(MAN).movedTo, 'v3'); assert.deepEqual(w.drive.json('v3.migration.json').fallback, ['f1']);
  const names = w.drive.names(); assert.ok(names.includes('v3.r.v2legacy.f.f2.json') && !names.includes('v3.r.v2legacy.f.f1.json'));
  const k = await A.store.known(); assert.ok(!Object.keys(k).some(x => x.startsWith('A.f1:') || x === K.lib('f1')), 'V3 holds nothing of f1');
  A.app.forms.f1.progress.bundle.attempts[0].session.blocks[0].answers[3] = 0;
  const sc = await A.scan(); assert.equal(sc.forms.f1, undefined, 'the engine leaves f1 to V2'); await A.sync();
  assert.ok(!w.drive.names().some(n => /\.f\.f1\.json$/.test(n)), 'no V3 replica of f1 is pushed');
});

test('per-form fallback: when nothing can be converted the upgrade pauses: nothing is written, nothing is frozen', async () => {
  const { w, A } = await world1(); const before = JSON.stringify(w.drive.names()), man = w.drive.byName(MAN).body;
  for (const uid of ['f1', 'f2']) { const bad = prog({ answers: [1, 1, 1, 1] }); delete bad.bundle.attempts[0].session.blocks[0].questionQids; A.setProgress(uid, bad); }
  const r = await M.runMigration(ctxOf(A, v2For(w, A, rowsOf(A))));
  assert.equal(r.status, 'paused'); assert.deepEqual(r.forms, ['f1', 'f2']); assert.equal(JSON.stringify(w.drive.names()), before); assert.equal(w.drive.byName(MAN).body, man);
  assert.match((await A.store.migration()).reason, /f1/);
});

test('per-form fallback: a later device follows the marker; once the form converts (next launch) it moves to V3 everywhere and V2 is switched off', async () => {
  const { w, A } = await world1(), v2a = v2For(w, A, rowsOf(A));
  const bad = prog({ answers: [1, 1, 1, 1] }); delete bad.bundle.attempts[0].session.blocks[0].questionQids;
  A.setProgress('f1', bad); await M.runMigration(ctxOf(A, v2a));
  const Bd = new SimDevice(w, 'devB'); Bd.getCycle(); Bd.install('f1', REC, prog({ answers: [3, null, null, null], firstAnswers: [3, null, null, null] })); Bd.install('f2', REC);
  const v2b = v2For(w, Bd, () => []);
  const j = await M.runMigration(ctxOf(Bd, v2b, { localRows: async () => [] }));
  assert.equal(j.status, 'done'); assert.deepEqual(v2b.flags.scope, ['f1']); assert.equal(v2b.flags.disabled, false);
  assert.ok(!w.drive.names().some(n => /\.f\.f1\.json$/.test(n)), 'B did not push f1 through V3 either');
  assert.equal((await M.retryFallback(ctxOf(A, v2a))).status, 'kept', 'still unconvertible: kept on V2');
  // the QID baseline arrives for f1 on A: the next launch moves it
  A.setProgress('f1', prog({ answers: [1, 1, null, null], firstAnswers: [1, 1, null, null] }));
  const mv = await M.retryFallback(ctxOf(A, v2a));
  assert.equal(mv.status, 'moved'); assert.deepEqual(mv.moved, ['f1']); assert.deepEqual(w.drive.json('v3.migration.json').fallback, []);
  assert.deepEqual(v2a.flags.scope, []); assert.equal(v2a.flags.disabled, true); assert.ok(w.drive.names().includes('v3.r.v2legacy.f.f1.json'));
  // B on its next launch follows the marker: V2 off, f1 now synced by V3 (its own work merges)
  const rb = await M.retryFallback(ctxOf(Bd, v2b)); assert.equal(rb.status, 'none'); assert.deepEqual(v2b.flags.scope, []); assert.equal(v2b.flags.disabled, true);
  await Bd.scan(); await Bd.sync(); await A.sync();
  assert.equal(ans(Bd, 'f1', 'a1', 1), 1, 'A\'s answers reached B'); assert.equal(ans(A, 'f1', 'a1', 0), 3, 'B\'s newer answer on q1 (stamped later) reached A');
});

test('per-form fallback cleanup: after keepUntil only the moved forms\' V2 files go; fallback files changing do not hold it back', async () => {
  const { w, A } = await world1();
  const bad = prog({ answers: [1, 1, 1, 1] }); delete bad.bundle.attempts[0].session.blocks[0].questionQids;
  A.setProgress('f1', bad); await M.runMigration(ctxOf(A, v2For(w, A, rowsOf(A))));
  w.drive.set('exam-simulator2.form.f1.r2.json', { v2: 'still syncing' }); w.drive.set('exam-simulator2.progress-history.json', { h: 2 });
  w.drive.set('v3.dev.dOLDDEV.json', { deviceId: 'OLDDEV', name: 'old iPad', appVersion: '24', lastSeen: new Date(A.now() + 1000).toISOString() });
  A.world.advance(31 * 24 * 60);
  const c = await M.runCleanup({ store: A.store, drive: A.driveApi, now: A.now });
  assert.equal(c.status, 'partial'); assert.deepEqual(c.removed, ['exam-simulator2.form.f2.r1.json']);
  const names = w.drive.names();
  for (const n of ['exam-simulator2.form.f1.r1.json', 'exam-simulator2.form.f1.r2.json', MAN, 'v2.archive.manifest.json', M.FALLBACK_MANIFEST]) assert.ok(names.includes(n), n + ' kept');
  assert.equal(M.v2FileOf('exam-simulator2.form.f1.r2.json', ['f1']), true); assert.equal(M.v2FileOf('exam-simulator2.form.f1.x.r2.json', ['f1']), false);
});

test('an open block or a pending QID baseline makes the migration wait before anything happens', async () => {
  const { w, A } = await world1();
  const r = await M.runMigration(ctxOf(A, v2For(w, A, rowsOf(A)), { gateState: { runtime: { examVisible: true }, qidBaselinePending: true } }));
  assert.equal(r.status, 'waiting'); assert.equal(r.reasons.length, 2); assert.equal(w.drive.byName('v3.migration.json'), null);
});

test('two devices at once: a fresh in-progress marker makes the second wait; a stale one is taken over', async () => {
  const { w, A } = await world1();
  w.drive.set('v3.migration.json', { status: 'in-progress', by: 'someoneElse', heartbeat: new Date(A.now() - 2 * 60000).toISOString(), at: new Date(A.now()).toISOString() });
  assert.equal((await M.runMigration(ctxOf(A, v2For(w, A, rowsOf(A))))).status, 'other-device');
  A.world.advance(11);
  assert.equal((await M.runMigration(ctxOf(A, v2For(w, A, rowsOf(A))))).status, 'done');
});

test('a later device (marker done): its unsynced local work is stamped with real times, merged, applied and pushed; both devices converge', async () => {
  const { w, A } = await world1(); await M.runMigration(ctxOf(A, v2For(w, A, rowsOf(A))));
  const Bd = new SimDevice(w, 'devB'); Bd.getCycle(); w.advance(60);
  Bd.install('f1', REC, prog({ answers: [null, null, 0, null], firstAnswers: [null, null, 0, null] }));       // work done before V3, never synced
  Bd.install('f2', REC);
  const v2 = v2For(w, Bd, () => []);
  const r = await M.runMigration(ctxOf(Bd, v2, { localRows: async () => Object.entries(Bd.app.forms).map(([uid, f]) => ({ key: uid, formUid: uid, local: { formId: f.rec.id, progress: f.progress, suspended: null, threeDigitScore: '', rec: f.rec } })) }));
  assert.equal(r.status, 'done'); assert.equal(v2.flags.disabled, true); assert.deepEqual(r.attention, []);
  assert.equal(ans(Bd, 'f1', 'a1', 0), 1); assert.equal(ans(Bd, 'f1', 'a1', 1), 3); assert.equal(ans(Bd, 'f1', 'a1', 2), 0, 'its own work survived');
  await A.sync(); assert.equal(ans(A, 'f1', 'a1', 2), 0, 'and reached the first device');
  assert.equal((await Bd.store.getRaw('preV3Recovery')).forms.f1.progress.bundle.attempts.length, 1);
});

test('cleanup: nothing before keepUntil; a V2 change re-arms 30 days', async () => {
  const { w, A } = await world1(); await M.runMigration(ctxOf(A, v2For(w, A, rowsOf(A))));
  const args = () => ({ store: A.store, drive: A.driveApi, now: A.now });
  assert.equal((await M.runCleanup(args())).status, 'kept');
  A.world.advance(31 * 24 * 60);
  w.drive.set('exam-simulator2.form.f1.r2.json', { new: true });                                              // an old app wrote after the freeze
  const c1 = await M.runCleanup(args()); assert.equal(c1.status, 'v2-changed'); assert.deepEqual(c1.files, ['exam-simulator2.form.f1.r2.json']);
  assert.ok(Date.parse(w.drive.json('v3.migration.json').keepUntil) > A.now() + 29 * 86400000);
  assert.ok(w.drive.names().includes('exam-simulator2.form.f1.r2.json'), 'nothing deleted');
});

test('cleanup: a V2 device not seen on V3 holds it back for 60 days; then V2 files, archive and stub are deleted for real and logged', async () => {
  const { w, A } = await world1(); await M.runMigration(ctxOf(A, v2For(w, A, rowsOf(A))));
  const args = () => ({ store: A.store, drive: A.driveApi, now: A.now });
  A.world.advance(31 * 24 * 60);
  const c2 = await M.runCleanup(args()); assert.equal(c2.status, 'kept'); assert.match(c2.reason, /devices/); assert.deepEqual(c2.devices, ['OLDDEV']);
  A.world.advance(30 * 24 * 60);
  const c3 = await M.runCleanup(args()); assert.equal(c3.status, 'cleaned');
  assert.ok(!w.drive.names().some(n => n.startsWith('exam-simulator2.') || n === 'v2.archive.manifest.json'), 'V2 files, archive and stub are gone');
  assert.ok(w.drive.names().includes('v3.r.v2legacy.f.f1.json'), 'V3 data stays'); assert.equal(w.drive.json('v3.migration.json').cleaned, true);
  assert.equal(await A.store.getRaw('preV3Recovery'), null); assert.equal((await M.runCleanup(args())).status, 'cleaned');
  assert.equal((await A.store.getRaw('cleanupLog'))[0].removed.length >= 3, true);
});

test('cleanup: a V2 device that has appeared on V3 does not hold it back', async () => {
  const { w, A } = await world1(); await M.runMigration(ctxOf(A, v2For(w, A, rowsOf(A))));
  A.world.advance(31 * 24 * 60);
  w.drive.set('v3.dev.dOLDDEV.json', { deviceId: 'OLDDEV', name: 'old iPad', appVersion: '24', lastSeen: new Date(A.now()).toISOString() });
  assert.equal((await M.runCleanup({ store: A.store, drive: A.driveApi, now: A.now })).status, 'cleaned');
});

test('cleanup waits while a fallback form exists, and every device deletes its pre-upgrade copy only when it is due', async () => {
  const { w, A } = await world1(); await M.runMigration(ctxOf(A, v2For(w, A, rowsOf(A))));
  const m = w.drive.json('v3.migration.json'); m.fallback = ['f9']; w.drive.set('v3.migration.json', m); A.world.advance(40 * 24 * 60);
  assert.equal((await M.runCleanup({ store: A.store, drive: A.driveApi, now: A.now })).status, 'kept');
  assert.equal(await M.expireRecovery({ store: A.store, now: A.now }), true); assert.equal(await A.store.getRaw('preV3Recovery'), null);
});

test('restore from the pre-upgrade copy: new stamps win everywhere, a deleted attempt comes back', async () => {
  const { w, A } = await world1(); await M.runMigration(ctxOf(A, v2For(w, A, rowsOf(A))));
  const Bd = new SimDevice(w, 'devB'); Bd.getCycle(); await Bd.sync();
  assert.equal(ans(Bd, 'f2', 'a1', 0), 2);
  A.setProgress('f2', null); await A.scan(); await A.sync(); await Bd.sync(); assert.equal(Bd.app.forms.f2.progress, null, 'progress deleted everywhere');
  w.advance(5);
  const r = await M.restoreFromRecovery({ store: A.store, applier: A.applier, getRec: uid => A.app.forms[uid] && A.app.forms[uid].rec, uids: ['f2'], now: A.now });
  assert.deepEqual(r.restored, ['f2']); assert.equal(ans(A, 'f2', 'a1~restored', 1), 2, 'restored locally, as a new attempt (the deleted one stays deleted)');
  await A.sync(); w.advance(1); await Bd.sync(); assert.equal(ans(Bd, 'f2', 'a1~restored', 1), 2, 'and on the other device');
  const echo = await A.scan(); assert.equal(echo.totals.changed, 0);
  await assert.rejects(M.restoreFromRecovery({ store: Bd.store, applier: Bd.applier }), /no pre-upgrade backup/);
});

test('restore from the V2 archive on Drive: any device can restore what the old sync last held (current version, else the previous one); new stamps win everywhere', async () => {
  const { w, A } = await world1(), v2 = v2For(w, A, rowsOf(A)); await M.runMigration(ctxOf(A, v2));
  const Bd = new SimDevice(w, 'devB'); Bd.getCycle(); Bd.install('f1', REC); Bd.install('f2', REC); await Bd.sync();
  // work after the upgrade on A changes f2's answer; B (no pre-upgrade copy of its own) restores the archived V2 state
  A.app.forms.f2.progress.bundle.attempts[0].session.blocks[0].answers[0] = 0; await A.scan(); await A.sync(); await Bd.sync();
  assert.equal(ans(Bd, 'f2', 'a1', 0), 0);
  const list = await M.readArchive({ drive: Bd.driveApi });
  assert.deepEqual(list.entries.map(e => e.uid).sort(), ['f1', 'f2']);
  // the archived current version of f1 is unreadable: the previous one is used; f2 restores normally
  const f1 = w.drive.json('v2.archive.manifest.json').forms.f1; f1.previousDriveFileId = f1.driveFileId; w.drive.byName('exam-simulator2.form.f1.r1.json').body = '{broken';
  w.drive.put('exam-simulator2.form.f1.r0.json', backup(prog({ answers: [1, null, null, null], firstAnswers: [1, null, null, null] })));
  const am = w.drive.json('v2.archive.manifest.json'); am.forms.f1.previousDriveFileId = w.drive.byName('exam-simulator2.form.f1.r0.json').id; w.drive.set('v2.archive.manifest.json', am);
  w.advance(5);
  const r = await M.restoreFromArchive({ store: Bd.store, drive: Bd.driveApi, applier: Bd.applier, getRec: uid => Bd.app.forms[uid] && Bd.app.forms[uid].rec, now: Bd.now, readBackup: v2.readBackup });
  assert.deepEqual(r.restored.sort(), ['f1', 'f2']); assert.deepEqual(r.errors, {});
  assert.equal(ans(Bd, 'f2', 'a1', 0), 2, 'the archived answer is back on B');
  await Bd.sync(); w.advance(1); await A.sync(); assert.equal(ans(A, 'f2', 'a1', 0), 2, 'and wins on A (stamped now)');
  assert.equal((await Bd.scan()).totals.changed, 0, 'no echo');
  w.drive.files.delete(w.drive.byName('v2.archive.manifest.json').id);
  await assert.rejects(M.restoreFromArchive({ store: Bd.store, drive: Bd.driveApi, applier: Bd.applier, readBackup: v2.readBackup }), /no old-sync archive/);
});

test('forms stay usable during the upgrade: an open form is not overwritten, nothing is read as cleared, and it merges once it is left', async () => {
  const { w, A } = await world1();
  A.open = { uid: 'f1' };                                                                                     // an exam on f1 is open while the upgrade runs
  const r = await M.runMigration(ctxOf(A, v2For(w, A, rowsOf(A)), { gateState: { runtime: { examVisible: false } } }));
  assert.equal(r.status, 'done');
  assert.equal(ans(A, 'f1', 'a1', 0), null, 'the open form was not written under the user'); assert.equal(ans(A, 'f1', 'a1', 1), 3);
  A.app.forms.f1.progress.bundle.attempts[0].session.blocks[0].answers[3] = 2;                               // still answering
  A.open = null;
  const sc = await A.scan(); assert.equal(sc.forms.f1.tombstones, 0);
  const k = await A.store.known(); assert.notEqual(k[K.item('f1:a1', 'q1', 'ans')] && k[K.item('f1:a1', 'q1', 'ans')].v, null, 'the cloud answer it had not applied yet was not stamped as cleared');
  await A.sync();
  assert.equal(ans(A, 'f1', 'a1', 0), 1, 'cloud answer merged after leaving the form'); assert.equal(ans(A, 'f1', 'a1', 1), 3); assert.equal(ans(A, 'f1', 'a1', 3), 2, 'the answer made during the upgrade survived');
  assert.equal((await A.scan()).totals.changed, 0, 'no echo');
});

test('a form changed while the upgrade runs is not overwritten with the planned state; the change is merged by the next cycle', async () => {
  const { w, A } = await world1();
  const v2 = v2For(w, A, rowsOf(A)), base = rowsOf(A)();                                                      // the plan sees f2 as it was
  v2.analyze = async () => ({ rows: base, recs: Object.values(A.app.forms).map(f => f.rec), manifest: { ...w.drive.json(MAN), schemaVersion: 2 } });
  const planned = JSON.parse(JSON.stringify(A.app.forms.f2.progress)); void planned;
  A.app.forms.f2.progress = JSON.parse(JSON.stringify(A.app.forms.f2.progress)); A.app.forms.f2.progress.bundle.attempts[0].session.blocks[0].answers[3] = 1;   // written after the plan
  const r = await M.runMigration(ctxOf(A, v2, { changedDuring: () => new Set(['f2']) }));
  assert.equal(r.status, 'done'); assert.equal(ans(A, 'f2', 'a1', 3), 1, 'not overwritten by the upgrade');
  await A.scan(); await A.sync(); assert.equal(ans(A, 'f2', 'a1', 3), 1); assert.equal(ans(A, 'f2', 'a1', 0), 2);
  const Bd = new SimDevice(w, 'devB'); Bd.getCycle(); Bd.install('f2', REC); await Bd.sync(); assert.equal(ans(Bd, 'f2', 'a1', 3), 1, 'and reached other devices');
});

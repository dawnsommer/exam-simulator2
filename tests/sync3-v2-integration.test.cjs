'use strict';
/* Sync V3 shadow migration against the REAL V2 modules (sync-config / sync-merge / sync-storage / progress-sync) on the mock V2 Drive:
   DIVERGED / CLOUD_AHEAD / ALIGNED rows, schema-1 and id@@hash manifests, corrupt newest backup, a deleted entry,
   a QID baseline pending; the check only reads (no create / upload / copy / delete reaches the Drive). */
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { MockDriveBackend, buildDevice, seedCloud, setSyncMeta, currentEntry } = require('./support/autonomous-harness.cjs');

const ROOT = path.resolve(__dirname, '..');
const QIDS = ['n-11-q1', 'n-11-q2', 'n-11-q3'];
const blk = o => ({ blockName: 'B1', total: 3, questionQids: QIDS, answers: [null, null, null], firstAnswers: [null, null, null], flagged: [false, false, false], struck: {}, revealed: {}, questionTime: [0, 0, 0], notes: '', blockCompleted: false, answerChangeLog: [], stemHighlightAnchors: {}, explanationHighlightAnchors: {}, ...o });
const prog = (b, bank = 'BANK1') => ({ fileType: 'StepExamSimulatorV10ProgressBundle', saveVersion: '10.2', formSlot: 'N-11', bundle: { updatedAt: '2026-08-12T06:00:00.000Z', activeAttemptId: 'att-1', attempts: [{ attemptId: 'att-1', label: '1st', createdAt: '2026-08-12T05:00:00.000Z', session: { bankHash: bank, updatedAt: '2026-08-12T06:00:00.000Z', blocks: [blk(b)] } }] } });
const P_CLOUD = prog({ answers: [1, null, null], firstAnswers: [1, null, null] }), P_LOCAL = prog({ answers: [null, 2, 3], firstAnswers: [null, 2, 3], flagged: [false, true, false] });
const WRITES = /CREATE_FILE|UPLOAD_FILE|COMMIT_MANIFEST|DELETE_FILE|COPY_FILE/;

async function setup(opts = {}) {
  const drive = new MockDriveBackend();
  const d = await buildDevice({ drive, deviceId: 'DEV-A', questionCount: 3, qids: QIDS, progress: opts.local || null });
  for (const f of ['sync3-core', 'sync3-bridge', 'sync3-store', 'sync3-drive', 'sync3-sync', 'sync3-migrate']) vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f + '.js'), 'utf8'), d.context, { filename: f });
  const W = d.context;
  const store = W.StepSync3Store.create({ backend: W.StepSync3Store.memoryBackend(), screen: { width: 1180, height: 820 } });
  const sd = W.StepSync3Drive.create({ auth: d.runtime.auth });
  return { d, W, store, sd, run: () => { const from = drive.operationLog.length; return W.StepSync3Migrate.runShadow({ store, drive: sd, R: d.runtime }).then(r => ({ r, ops: drive.operationLog.slice(from) })); } };
}

test('DIVERGED in V2 (changes on both devices): the shadow check merges both sides, reads only, and says what V2 would do', async () => {
  const s = await setup();
  const seed = await seedCloud(s.d, P_CLOUD); s.d.state.progress = JSON.parse(JSON.stringify(P_LOCAL));
  await setSyncMeta(s.d, seed.key, { baseCloudVersionId: 'OLD', dirty: true, updatedAt: '2026-08-12T07:00:00.000Z' });
  const { r, ops } = await s.run(); const f = r.forms[0];
  assert.equal(f.v2State, 'DIVERGED'); assert.match(f.v2Decision, /ask the user/); assert.equal(f.ok, true); assert.equal(f.source, 'download');
  assert.equal(f.counts.merged.answered, 3); assert.equal(f.counts.cloud.answered, 1); assert.equal(f.counts.local.answered, 2);
  assert.equal(r.wroteToDrive, false); assert.ok(!ops.some(o => WRITES.test(o.operation)), 'read-only: ' + JSON.stringify(ops.map(o => o.operation)));
  assert.ok(ops.some(o => o.operation === 'DOWNLOAD_FILE'), 'the cloud backup was downloaded');
  const diag = await s.store.diag(); assert.equal(diag.length, 1); assert.equal((await s.store.getRaw('preV3Recovery')).forms['n-11'].progress.bundle.attempts.length, 1);
  assert.equal((await s.store.migration()).status, 'shadow');
});

test('ALIGNED: this device is the source, nothing is downloaded', async () => {
  const s = await setup();
  const seed = await seedCloud(s.d, P_CLOUD); await s.d.runtime.sync.checkCloud({});
  const { r, ops } = await s.run();
  assert.equal(r.forms[0].v2State, 'ALIGNED'); assert.equal(r.forms[0].source, 'indexeddb'); assert.ok(!ops.some(o => o.operation === 'DOWNLOAD_FILE' && o.name && !/manifest/.test(o.name)), 'no backup download');
  void seed;
});

test('schema-1 manifest (entries) and id@@hash keys are read through V2\'s own migrateManifest', async () => {
  for (const shape of ['schema1', 'at-at']) {
    const s = await setup();
    const seed = await seedCloud(s.d, P_CLOUD); s.d.state.progress = JSON.parse(JSON.stringify(P_LOCAL));
    await setSyncMeta(s.d, seed.key, { baseCloudVersionId: 'OLD', dirty: true });
    const file = s.d.drive.byName(s.d.runtime.config.MANIFEST_FILE)[0], m = JSON.parse(file.body), e = m.forms[seed.key];
    if (shape === 'schema1') file.body = JSON.stringify({ schemaVersion: 1, appId: 'exam-simulator2', updatedAt: m.updatedAt, entries: { [seed.key]: { ...e, kind: 'form', backupId: e.currentVersionId } } });
    else file.body = JSON.stringify({ ...m, forms: { ['N-11@@' + e.bankHash]: e } });
    const { r } = await s.run();
    assert.equal(r.forms.length, 1, shape); assert.equal(r.forms[0].uid, 'n-11', shape); assert.equal(r.forms[0].ok, true, shape + ' ' + JSON.stringify(r.forms[0].reasons)); assert.equal(r.forms[0].counts.merged.answered, 3, shape);
  }
});

test('corrupt newest backup: the previous version is used, or the form falls back (V2 keeps syncing it)', async () => {
  const s = await setup();
  const seed = await seedCloud(s.d, P_CLOUD, 'R1');
  const cur = s.d.drive.byName(s.d.runtime.config.MANIFEST_FILE)[0], m = JSON.parse(cur.body), prevId = m.forms[seed.key].driveFileId;
  const newer = s.d.drive.addJson('seed-R2.json', { ...JSON.parse(s.d.drive.files.get(prevId).body), payload: { progress: P_LOCAL, suspended: null, threeDigitScore: '' } });
  m.forms[seed.key] = { ...m.forms[seed.key], currentVersionId: 'R2', progressRevisionId: 'R2', driveFileId: newer.id, previousDriveFileId: prevId, previousVersionId: 'R1' }; cur.body = JSON.stringify(m);
  s.d.state.progress = null;
  s.d.drive.files.get(newer.id).body = '{"truncated":';                                                      // newest backup is corrupt
  const a = await s.run(); assert.equal(a.r.forms[0].ok, true); assert.match(a.r.forms[0].notes[0], /previous/); assert.equal(a.r.forms[0].counts.merged.answered, 1);
  s.d.drive.files.get(prevId).body = '{"also":';                                                           // both corrupt
  const b = await s.run(); assert.equal(b.r.forms[0].fallback, true); assert.equal(b.r.totals.fallback, 1);
});

test('a deleted V2 entry becomes a tombstone; a QID baseline that is pending only makes the migration wait', async () => {
  const s = await setup({ local: P_LOCAL });
  const seed = await seedCloud(s.d, P_CLOUD); s.d.state.progress = null;
  await s.d.meta.set('formSyncMetaV2', {});
  const file = s.d.drive.byName(s.d.runtime.config.MANIFEST_FILE)[0], m = JSON.parse(file.body); m.forms[seed.key].deleted = true; file.body = JSON.stringify(m);
  const a = await s.run(); assert.equal(a.r.forms[0].source, 'tombstone'); assert.equal(a.r.totals.tombstones, 1);
  await s.d.meta.set('qidMigrationPendingBaseline', { at: 'x' });
  const b = await s.run(); assert.equal(b.r.gate.ok, false); assert.match(b.r.gate.reasons[0], /QID baseline/);
});

test('per-form fallback: the REAL V2 modules follow the scope (fallback manifest, only the fallback forms); no scope = V2 exactly as before', async () => {
  const s = await setup();
  const seed = await seedCloud(s.d, P_CLOUD), R = s.d.runtime, MAIN = R.config.MAIN_MANIFEST_FILE, M = s.W.StepSync3Migrate;
  assert.equal(R.config.MANIFEST_FILE, MAIN, 'no localStorage at all: the main manifest');
  const ls = new Map(); s.W.localStorage = { getItem: k => (ls.has(k) ? ls.get(k) : null), setItem: (k, v) => ls.set(k, String(v)), removeItem: k => ls.delete(k) };
  assert.equal(R.config.MANIFEST_FILE, MAIN, 'no scope stored: unchanged');
  const before = (await R.sync.analyze()).summary.rows.map(r => r.key + ':' + r.state);
  // freeze with n-11 in fallback: its entry moves to the fallback manifest, the main one becomes the stub
  const mainManifest = s.d.drive.jsonByName(MAIN);
  s.d.drive.addJson(M.FALLBACK_MANIFEST, M.fallbackManifestOf(mainManifest, [seed.key], false));
  s.d.drive.addJson(MAIN, { type: R.config.MANIFEST_TYPE, schemaVersion: 3, appId: 'exam-simulator2', movedTo: 'v3' });
  ls.set(R.config.V2_SCOPE_KEY, JSON.stringify({ manifest: M.FALLBACK_MANIFEST, forms: ['n-11'], qbank: false }));
  assert.equal(R.config.MANIFEST_FILE, M.FALLBACK_MANIFEST);
  assert.deepEqual((await R.sync.analyze()).summary.rows.map(r => r.key + ':' + r.state), before, 'the fallback form syncs exactly as it did before the freeze');
  // a V2 backup of the fallback form writes the fallback manifest, never the stub
  s.d.state.progress = JSON.parse(JSON.stringify(P_LOCAL));
  await setSyncMeta(s.d, seed.key, { baseCloudVersionId: 'R1', lastKnownCloudVersionId: 'R1', dirty: true });
  await R.sync.backupNow({ reason: 'fallback form edited' });
  assert.equal(s.d.drive.jsonByName(MAIN).movedTo, 'v3', 'the stub is untouched');
  assert.notEqual(s.d.drive.jsonByName(M.FALLBACK_MANIFEST).forms[seed.key].currentVersionId, 'R1', 'the fallback manifest advanced');
  // the form moved to V3 (out of scope): V2 neither reads it locally nor restores its cloud entry
  ls.set(R.config.V2_SCOPE_KEY, JSON.stringify({ manifest: M.FALLBACK_MANIFEST, forms: ['other'], qbank: false }));
  const a = await R.sync.analyze(); assert.ok(a.summary.rows.every(r => !r.local && !r.cloud), 'nothing of n-11 is V2\'s any more (at most an inert row from its old sync metadata)');
  const from = s.d.drive.operationLog.length; await R.sync.backupNow({ reason: 'after the move' });
  assert.ok(!s.d.drive.operationLog.slice(from).some(o => /UPLOAD_FILE|CREATE_FILE|DELETE_FILE|COMMIT_MANIFEST/.test(o.operation)), 'V2 writes nothing for a moved form');
  ls.delete(R.config.V2_SCOPE_KEY); assert.equal(R.config.MANIFEST_FILE, MAIN);
});

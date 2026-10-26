'use strict';
/* Sync V3 migration V2 -> V3 in shadow mode (Release A): gate, source choice per form, deterministic conversion,
   verification (counts, QIDs, scores), fallback, V3-vs-V2 decisions; nothing is written to Drive. */
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/sync3-core.js');
const M = require('../js/sync3-migrate.js');
const D = require('../js/sync3-drive.js');
const { FakeDrive } = require('./support/sync3-fake-drive.cjs');
const Store = require('../js/sync3-store.js');
const { K } = C;

const NOW = Date.parse('2026-10-25T12:00:00Z');
const QIDS = ['q1', 'q2', 'q3'];
const block = (over = {}) => ({ blockName: 'B1', total: 3, questionQids: QIDS, answers: [null, null, null], firstAnswers: [null, null, null], flagged: [false, false, false], struck: {}, revealed: {}, questionTime: [0, 0, 0], notes: '', blockCompleted: false, answerChangeLog: [], stemHighlightAnchors: {}, explanationHighlightAnchors: {}, ...over });
const prog = (blocks, att = 'a1', extra = {}) => ({ bundle: { activeAttemptId: att, attempts: [{ attemptId: att, label: '1st', createdAt: '2026-10-20T00:00:00Z', session: { blocks } }], ...extra } });
const done = answers => block({ answers, firstAnswers: answers, blockCompleted: true, result: { correct: 3, answers: [{ item: 1, correct: 1 }, { item: 2, correct: 0 }, { item: 3, correct: 3 }] } });
const REC = { id: 'F1', formUid: 'f1', qidSchemaVersion: 1, bankHash: 'H', questionIndex: QIDS.map(q => ({ qid: q })) };
const entry = (uid, over = {}) => ({ kind: 'form', key: uid, formId: 'F1', formUid: uid, currentVersionId: 'v1', driveFileId: 'cur', previousDriveFileId: 'prev', checksum: 'c', updatedAt: '2026-10-24T10:00:00Z', ...over });
const backup = p => ({ type: 'x', payload: { progress: p, suspended: null, threeDigitScore: '' } });
const local = (p, over = {}) => ({ formId: 'F1', progress: p, suspended: null, threeDigitScore: '', modifiedAt: '2026-10-25T09:00:00Z', rec: REC, ...over });
const row = (state, o = {}) => ({ key: 'f1', formUid: 'f1', kind: 'form', state, meta: {}, cloud: null, local: null, ...o });
const reader = (cur, prev) => async (e, which) => { const v = which === 'previous' ? prev : cur; if (!v) throw new Error('missing ' + which); if (v instanceof Error) throw v; return v; };
const plan = (rows, readBackup, extra = {}) => M.planShadow({ dev: 'dev1', rows, readBackup: readBackup || reader(null, null), recs: [REC], now: NOW, ...extra });

test('step 1 gate: open block, pending QID baseline or a committing form install make the migration wait', () => {
  assert.deepEqual(M.gate({ runtime: { examVisible: false }, qidBaselinePending: false, committing: false }), { ok: true, reasons: [] });
  const g = M.gate({ runtime: { examVisible: true }, qidBaselinePending: true, committing: true });
  assert.equal(g.ok, false); assert.equal(g.reasons.length, 3);
  assert.equal(M.gate({ runtime: { hasActiveSession: true, examVisible: false } }).ok, true, 'a suspended block that is not on screen is not open');
  assert.equal(M.gate({ runtime: { examVisible: true } }).ok, false);
});

test('ALIGNED form: read from this device (no download), units equal what the cloud backup would give', async () => {
  const p = prog([done([1, 0, 3])]); let downloads = 0;
  const rd = async () => { downloads++; return backup(p); };
  const a = await plan([row('ALIGNED', { cloud: entry('f1'), local: local(p) })], rd);
  const f = a.report.forms[0];
  assert.equal(downloads, 0); assert.equal(f.source, 'indexeddb'); assert.equal(f.ok, true); assert.equal(f.v2Decision, 'nothing to do');
  const b = await plan([row('CLOUD_AHEAD', { cloud: entry('f1'), local: null })], async () => backup(p));
  assert.equal(b.report.forms[0].source, 'download');
  assert.equal(JSON.stringify(a.forms[0].unitsPreview.legacy), JSON.stringify(b.forms[0].unitsPreview.legacy), 'same units whichever source');
});

test('deterministic: two runs and two devices give byte-identical legacy units (stamps come from the V2 entry time)', async () => {
  const p = prog([block({ answers: [1, 2, null], firstAnswers: [1, 2, null], answerChangeLog: [{ item: 1, from: 0, to: 1 }], questionTime: [20, 5, 0], notes: 'n', flagged: [true, false, false] })]);
  const r = row('CLOUD_AHEAD', { cloud: entry('f1') });
  const a = await M.planShadow({ dev: 'devA', rows: [r], readBackup: async () => backup(p), recs: [REC], now: NOW });
  const b = await M.planShadow({ dev: 'devB', rows: [r], readBackup: async () => backup(p), recs: [REC], now: NOW + 99999 });
  assert.equal(JSON.stringify(a.forms[0].unitsPreview.legacy), JSON.stringify(b.forms[0].unitsPreview.legacy));
  const u = a.forms[0].unitsPreview.legacy;
  assert.ok(u.every(x => C.parseStamp(x.t).dev === 'v2legacy' && C.parseStamp(x.t).wall === Date.parse('2026-10-24T10:00:00Z')));
  assert.equal(new Set(u.map(x => x.t)).size, u.length, 'unique stamps');
  assert.deepEqual(u.find(x => x.k === K.item('f1:a1', 'q1', 'tm')).v, { v2legacy: 20 });
});

test('corrupt newest backup: the previous version is used; both corrupt: the form goes to fallback (V2 keeps syncing it)', async () => {
  const p = prog([done([1, 0, 3])]);
  const a = await plan([row('CLOUD_ONLY', { cloud: entry('f1') })], reader(new Error('bad json'), backup(p)));
  assert.equal(a.report.forms[0].ok, true); assert.match(a.report.forms[0].notes[0], /previous/);
  const b = await plan([row('CLOUD_ONLY', { cloud: entry('f1') })], reader(new Error('bad json'), new Error('bad too')));
  assert.equal(b.report.forms[0].fallback, true); assert.equal(b.report.totals.fallback, 1);
});

test('DIVERGED: both sides merge (V2 would ask the user and drop one); counts >= the larger of cloud and local', async () => {
  const cloudP = prog([block({ answers: [1, null, null], firstAnswers: [1, null, null] })]), localP = prog([block({ answers: [null, 2, 3], firstAnswers: [null, 2, 3], flagged: [false, true, false] })]);
  const a = await plan([row('DIVERGED', { cloud: entry('f1'), local: local(localP) })], async () => backup(cloudP));
  const f = a.report.forms[0];
  assert.equal(f.v2Decision, 'ask the user: keep one side, the other is lost'); assert.equal(f.counts.merged.answered, 3); assert.equal(f.counts.merged.marked, 1);
  assert.equal(f.ok, true); assert.match(f.v3Decision, /merge both sides/); assert.equal(f.units.conflicting, 0);
  assert.ok(f.units.onlyLocal > 0 && f.units.onlyCloud > 0);
});

test('DIVERGED on the same question: the newer stamp wins, first answer = earlier, nothing flagged as lost', async () => {
  const cloudP = prog([block({ answers: [1, null, null], firstAnswers: [1, null, null] })]);
  const localP = prog([block({ answers: [3, null, null], firstAnswers: [3, null, null] })]);
  const a = await plan([row('DIVERGED', { cloud: entry('f1', { updatedAt: '2026-10-24T10:00:00Z' }), local: local(localP, { modifiedAt: '2026-10-25T09:00:00Z' }) })], async () => backup(cloudP));
  const merged = C.merge({}, [a.forms[0].unitsPreview.legacy, a.forms[0].unitsPreview.own], { now: NOW }).units;
  assert.equal(merged[K.item('f1:a1', 'q1', 'ans')].v, 3, 'local is newer'); assert.equal(merged[K.item('f1:a1', 'q1', 'first')].v, 1, 'earliest first answer');
  assert.equal(a.report.forms[0].units.conflicting, 2);
});

test('LOCAL_ONLY / unsynced work: own units are stamped with the record\'s real modifiedAt, form is ok', async () => {
  const p = prog([block({ answers: [1, null, null] })]);
  const a = await plan([row('LOCAL_ONLY', { local: local(p, { modifiedAt: '2026-10-22T08:30:00Z' }) })]);
  const own = a.forms[0].unitsPreview.own;
  assert.ok(own.length && own.every(u => C.parseStamp(u.t).wall === Date.parse('2026-10-22T08:30:00Z') && C.parseStamp(u.t).dev === 'dev1'));
  assert.equal(a.report.forms[0].v2Decision, 'upload this device'); assert.equal(a.report.forms[0].source, 'none');
});

test('CLOUD_AHEAD: the unchanged older local copy is not re-imported (cloud wins, as in V2)', async () => {
  const old = prog([block({ answers: [1, 1, 1] })]), cur = prog([block({ answers: [null, 2, null] })]);
  const a = await plan([row('CLOUD_AHEAD', { cloud: entry('f1'), local: local(old) })], async () => backup(cur));
  assert.deepEqual(a.forms[0].unitsPreview.own, []); assert.equal(a.report.forms[0].counts.merged.answered, 1);
});

test('V2 deletion becomes a stamped reset (progress hidden); newer local work after it survives', async () => {
  const a = await plan([row('ALIGNED', { cloud: entry('f1', { deleted: true, updatedAt: '2026-10-24T10:00:00Z' }), local: null })]);
  const f = a.report.forms[0]; assert.equal(f.source, 'tombstone'); assert.match(f.v3Decision, /tombstone/);
  const reset = a.forms[0].unitsPreview.legacy.find(u => u.k === K.form('f1', 'reset'));
  assert.equal(reset.v.at, reset.t);
  const b = await plan([row('UNTRACKED_BOTH', { cloud: entry('f1', { deleted: true, updatedAt: '2026-10-24T10:00:00Z' }), local: local(prog([block({ answers: [2, null, null] })]), { modifiedAt: '2026-10-25T09:00:00Z' }) })]);
  assert.equal(b.report.forms[0].counts.merged.answered, 1, 'work done after the delete survives (the item reappears)');
});

test('local explicit delete (V2 DELETED_LOCAL_SAFE) writes this device\'s reset', async () => {
  const a = await plan([row('DELETED_LOCAL_SAFE', { cloud: entry('f1'), local: null, meta: { deleted: true, updatedAt: '2026-10-25T10:00:00Z' } })], async () => backup(prog([block({ answers: [1, 1, 1] })])));
  const own = a.forms[0].unitsPreview.own; assert.equal(own.length, 1); assert.equal(own[0].k, K.form('f1', 'reset'));
  assert.equal(a.report.forms[0].counts.merged.answered, 0); assert.equal(a.report.forms[0].checks.counts.explainedByTombstone, true);
});

test('QIDs that do not resolve in the installed form, or blocks without QIDs: fallback; form not installed: waits, not a failure', async () => {
  const bad = prog([block({ questionQids: ['q1', 'zzz', 'q3'], answers: [1, 1, 1] })]);
  const a = await plan([row('LOCAL_ONLY', { local: local(bad) })]);
  assert.equal(a.report.forms[0].fallback, true); assert.deepEqual(a.report.forms[0].checks.qids.unresolved, ['zzz']);
  const noq = block({ answers: [1, 1, 1] }); delete noq.questionQids;
  const b = await plan([row('LOCAL_ONLY', { local: local(prog([noq])) })]);
  assert.equal(b.report.forms[0].fallback, true); assert.match(b.report.forms[0].reasons.join(), /without QIDs/);
  const c = await M.planShadow({ dev: 'dev1', rows: [row('CLOUD_ONLY', { cloud: entry('f1') })], readBackup: async () => backup(prog([block({ answers: [1, 1, 1] })])), recs: [], now: NOW });
  assert.equal(c.report.forms[0].waitsForForm, true); assert.equal(c.report.forms[0].fallback, false); assert.equal(c.report.totals.waitingForForm, 1);
});

test('score check: recomputed block scores equal V2\'s stored results; a corrupted answer is caught', async () => {
  const good = prog([done([1, 0, 3])]);
  const a = await plan([row('LOCAL_ONLY', { local: local(good) })]);
  assert.equal(a.report.forms[0].checks.scores.checked, 1); assert.equal(a.report.forms[0].checks.scores.ok, true);
  const wrong = prog([done([1, 0, 3])]); wrong.bundle.attempts[0].session.blocks[0].result.correct = 3;            // V2 says 3 correct, answers give 3? (1,0,3 == 1,0,3 -> 3)
  const b = await plan([row('LOCAL_ONLY', { local: local(wrong) })]);
  assert.equal(b.report.forms[0].checks.scores.ok, true);
  wrong.bundle.attempts[0].session.blocks[0].result.correct = 1;
  const c = await plan([row('LOCAL_ONLY', { local: local(wrong) })]);
  assert.equal(c.report.forms[0].checks.scores.ok, false); assert.equal(c.report.forms[0].fallback, true);
});

test('Qbank is converted as attempts of __QBANK__ and resolved against every installed form', async () => {
  const q = { sessions: [{ attemptId: 'qt1', session: { qbankMode: true, qbankKeys: ['f1::q1', 'f1::q2'], blocks: [{ total: 2, answers: [1, null], firstAnswers: [1, null], flagged: [false, false], struck: {}, revealed: {}, questionTime: [0, 0], notes: '', blockCompleted: true }] } }] };
  const a = await M.planShadow({ dev: 'dev1', rows: [{ key: '__QBANK__', formUid: '__QBANK__', kind: 'qbank', state: 'LOCAL_ONLY', meta: {}, cloud: null, local: { formId: '', progress: q, suspended: null, threeDigitScore: '', modifiedAt: '2026-10-25T09:00:00Z', rec: null } }], readBackup: reader(null, null), recs: [REC], now: NOW });
  assert.equal(a.report.forms[0].kind, 'qbank'); assert.equal(a.report.forms[0].ok, true); assert.equal(a.report.forms[0].counts.merged.attempts, 1);
  const bad = JSON.parse(JSON.stringify(q)); bad.sessions[0].session.qbankKeys[0] = 'f1::nope';
  const b = await M.planShadow({ dev: 'dev1', rows: [{ key: '__QBANK__', formUid: '__QBANK__', kind: 'qbank', state: 'LOCAL_ONLY', meta: {}, cloud: null, local: { formId: '', progress: bad, suspended: null, threeDigitScore: '', modifiedAt: '2026-10-25T09:00:00Z', rec: null } }], readBackup: reader(null, null), recs: [REC], now: NOW });
  assert.equal(b.report.forms[0].fallback, true);
});

test('report: shadow mode, keepUntil = +30 days, per-form numbers, totals, and not one Drive write', async () => {
  const fake = new FakeDrive(), drive = D.create({ auth: fake });
  const p = prog([done([1, 0, 3])]);
  fake.put('exam-simulator2.manifest.json', {}); const id = fake.put('exam-simulator2.form.f1.json', backup(p));
  const a = await plan([row('CLOUD_ONLY', { cloud: entry('f1', { driveFileId: id }) }), row('LOCAL_ONLY', { key: 'f2', formUid: 'f2', local: local(prog([block({ answers: [1, null, null] })]), { rec: { ...REC, formUid: 'f2' } }) })],
    async e => JSON.parse(await drive.downloadText(e.driveFileId)), { recs: [REC, { ...REC, id: 'F2', formUid: 'f2' }] });
  const r = a.report;
  assert.equal(r.mode, 'shadow'); assert.equal(r.wroteToDrive, false); assert.equal(r.keepUntil, new Date(NOW + 30 * 86400000).toISOString());
  assert.equal(r.totals.forms, 2); assert.equal(r.totals.ok, 2); assert.equal(r.totals.downloaded, 1);
  assert.ok(!fake.log.some(l => /^(POST|PATCH|DELETE)/.test(l)), 'only reads reached Drive: ' + fake.log.join(' | '));
  assert.ok(!('unitsPreview' in r.forms[0]), 'stored report carries no unit dumps');
});

test('step 2: preV3Recovery keeps a local copy of all progress for 30 days, once, and is never overwritten while valid', async () => {
  const store = Store.create({ backend: Store.memoryBackend() }), p = prog([block({ answers: [1, null, null] })]);
  const rows = [row('LOCAL_ONLY', { local: local(p) }), row('CLOUD_ONLY', { key: 'f2', formUid: 'f2', cloud: entry('f2') })];
  const a = await M.ensurePreV3Recovery({ store, rows, now: NOW });
  assert.deepEqual([a.created, a.forms], [true, 1]);
  const saved = await store.getRaw('preV3Recovery'); assert.equal(saved.expiresAt, new Date(NOW + 30 * 86400000).toISOString()); assert.deepEqual(saved.forms.f1.progress, p);
  const b = await M.ensurePreV3Recovery({ store, rows: [], now: NOW + 86400000 });
  assert.equal(b.created, false); assert.equal((await store.getRaw('preV3Recovery')).forms.f1.progress.bundle.activeAttemptId, 'a1');
  const c = await M.ensurePreV3Recovery({ store, rows, now: NOW + 31 * 86400000 });           // expired: a new copy
  assert.equal(c.created, true);
});

test('a completed block: identical on both sides keeps its answers; completed on both with different answers: the earliest completer\'s whole answer set wins', async () => {
  const same = prog([done([1, 0, 3])]);
  const a = await plan([row('UNTRACKED_BOTH', { cloud: entry('f1'), local: local(same, { modifiedAt: '2026-10-25T09:00:00Z' }) })], async () => backup(same));
  assert.equal(a.report.forms[0].counts.merged.answered, 3); assert.equal(a.report.forms[0].ok, true); assert.equal(a.forms[0].unitsPreview.own.filter(u => u.k.includes('.ans')).length, 0);
  const other = prog([done([2, 0, null])]);                           // same block completed on this device later, with different answers
  const b = await plan([row('DIVERGED', { cloud: entry('f1'), local: local(other, { modifiedAt: '2026-10-25T09:00:00Z' }) })], async () => backup(same));
  const f = b.report.forms[0];
  assert.equal(f.ok, true, 'explained, not a failure'); assert.equal(f.counts.merged.answered, 3, 'the cloud completer was first: its 3 answers win'); assert.match(f.notes.join(), /earliest completer/);
  const m = C.merge({}, [b.forms[0].unitsPreview.legacy, b.forms[0].unitsPreview.own], { now: NOW }).units, vis = C.view(m, { now: NOW }).units;
  assert.equal(vis[K.item('f1:a1', 'q1', 'ans')].v, 1); assert.equal(vis[K.item('f1:a1', 'q3', 'ans')].v, 3);
  const m2 = C.merge({}, [b.forms[0].unitsPreview.own, b.forms[0].unitsPreview.legacy], { now: NOW }).units;
  assert.ok(C.sameUnits(C.view(m2, { now: NOW }).units, C.view(m, { now: NOW }).units), 'merge order does not matter');
});

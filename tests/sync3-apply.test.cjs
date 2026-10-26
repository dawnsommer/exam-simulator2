'use strict';
/* Sync V3 apply (Release B): visible units -> the app's own progress record, patched in place by QID. */
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/sync3-core.js');
const B = require('../js/sync3-bridge.js');
const { K } = C;

const NOW = Date.parse('2026-10-26T10:00:00Z'), Q = ['q1', 'q2', 'q3', 'q4'];
const REC = { id: 'F1', formUid: 'f1', bankHash: 'H1', displayName: 'Form 1', defaultName: 'Form 1', qidSchemaVersion: 1, questionIndex: Q.map((q, i) => ({ qid: q, blockIndex: 0, questionIndex: i })) };
const blk = (o = {}) => ({ blockName: 'Block 1', configuredIndex: 0, total: 4, questionQids: Q, answers: [null, null, null, null], firstAnswers: [null, null, null, null], flagged: [false, false, false, false], struck: {}, revealed: {}, questionTime: [0, 0, 0, 0], notes: '', blockCompleted: false, answerChangeLog: [], stemHighlightAnchors: {}, explanationHighlightAnchors: {}, stemHtml: ['x', 'y', 'z', 'w'], ...o });
const att = (id, b = {}, label) => ({ attemptId: id, label: label || id, type: 'initial', createdAt: '2026-10-25T07:00:00Z', session: { bankHash: 'H1', title: 'T', blockSizeSetting: '4', secondsPerQuestion: '90', blocks: [blk(b)] } });
const prog = (...a) => ({ fileType: 'StepExamSimulatorV10ProgressBundle', formSlot: 'F1', bundle: { activeAttemptId: a[0].attemptId, attempts: a } });
const questions = n => Array.from({ length: n }, (_, i) => ({ choices: ['A', 'B', 'C', 'D'], correct: i % 2, stem: 'stem' + i, subject: 'S', explanation: 'e' }));
const buildResult = ({ session, block, blockIndex, done }) => B.buildResultFromQuestions({ session, block, blockIndex, done, questions: questions(block.total), nowIso: '2026-10-26T10:00:00.000Z' });
async function unitsOf(p, dev = 'A', min = 0) {
  const x = await B.extractForm({ formUid: 'f1', rec: REC, progress: p, dev });
  let c = 0; const st = B.localizeTm(x.units, {}, dev).map(u => ({ k: u.k, v: u.v, t: C.fmtStamp(NOW + min * 60000, c++, dev) }));
  const units = C.merge({}, [st], { now: NOW }).units;
  return { units, vis: C.view(units, { now: NOW }).units, x };
}
const apply = (progress, w, extra = {}) => B.applyUnitsToProgress({ progress, units: w.units, vis: w.vis, formUid: 'f1', formId: 'F1', rec: REC, buildResult, now: NOW, ...extra });

test('an attempt that only exists in the cloud becomes a full session the app can resume (bank hash, QID keys, blocks, label, active)', async () => {
  const src = prog(att('a1', { answers: [1, 2, null, null], firstAnswers: [1, 2, null, null], flagged: [true, false, false, false], struck: { 0: [3] }, notes: 'n', current: 2, blockRemainingSeconds: 800, resumeCapturedAt: '2026-10-25T08:00:00Z' }, '1st Attempt'));
  const w = await unitsOf(src), r = apply(null, w);
  assert.deepEqual(r.report.created, ['a1']); const s = r.progress.bundle.attempts[0].session;
  assert.equal(r.progress.formSlot, 'F1'); assert.equal(r.progress.bundle.activeAttemptId, 'a1'); assert.equal(r.progress.session, s);
  assert.equal(s.bankHash, 'H1'); assert.equal(s.libraryFormId, 'F1'); assert.equal(s.formUid, 'f1'); assert.equal(s.attemptId, 'a1'); assert.equal(s.attemptLabel, '1st Attempt');
  assert.deepEqual(s.positionQuestionKeys, [Q.map(q => 'f1::' + q)]); assert.deepEqual(s.a193QuestionKeys, Q.map(q => 'f1::' + q));
  const b0 = s.blocks[0]; assert.deepEqual(b0.answers, [1, 2, null, null]); assert.deepEqual(b0.struck, { 0: [3] }); assert.equal(b0.notes, 'n'); assert.equal(b0.current, 2); assert.equal(b0.blockRemainingSeconds, 800);
  assert.equal(b0.blockCompleted, false); assert.equal(b0.result, null);
});

test('a completed block gets a real result (texts from the form, answers from the units), and an all-completed attempt gets completedAt', async () => {
  const src = prog(att('a1', { answers: [0, 1, 2, null], firstAnswers: [0, 1, 2, null], blockCompleted: true, result: { completedAt: '2026-10-25T09:00:00Z', elapsedSeconds: 1234, sessionId: 'sid1', answers: [] } }));
  const w = await unitsOf(src), r = apply(null, w), a = r.progress.bundle.attempts[0], b0 = a.session.blocks[0];
  assert.equal(b0.blockCompleted, true); assert.equal(b0.locked, true); assert.ok(a.completedAt && a.session.completedAt);
  assert.equal(b0.result.total, 4); assert.equal(b0.result.correct, 2);                               // keys 0,1,0,1 vs answers 0,1,2,null
  assert.equal(b0.result.completedAt, '2026-10-25T09:00:00Z'); assert.equal(b0.result.elapsedSeconds, 1234); assert.equal(b0.result.sessionId, 'sid1');
  assert.equal(b0.result.answers[1].chosenText, 'B'); assert.equal(b0.result.answers[1].correctText, 'B'); assert.equal(b0.result.answers[0].stem, 'stem0'); assert.deepEqual(a.session.results[0], b0.result);
  const nores = apply(null, w, { buildResult: null }).progress.bundle.attempts[0].session.blocks[0];
  assert.equal(nores.blockCompleted, false, 'without the form the block cannot be scored yet: it stays open and is retried');
});

test('patching: answers land by QID (even when the local order differs), other local fields stay, and a second apply changes nothing', async () => {
  const remote = prog(att('a1', { answers: [1, 2, null, 3], firstAnswers: [1, 2, null, 3], flagged: [false, false, false, true] }));
  const w = await unitsOf(remote, 'B');
  const local = prog(att('a1', { answers: [null, null, null, null], stemHtml: ['keep', 'keep', 'keep', 'keep'] }));
  const r = apply(local, w), b0 = r.progress.bundle.attempts[0].session.blocks[0];
  assert.deepEqual(b0.answers, [1, 2, null, 3]); assert.deepEqual(b0.stemHtml, ['keep', 'keep', 'keep', 'keep']); assert.equal(r.changed, true);
  assert.equal(apply(r.progress, w).changed, false, 'idempotent');
  const reordered = prog(att('a1', { questionQids: ['q4', 'q3', 'q2', 'q1'], answers: [null, null, null, null] }));
  const rr = apply(reordered, w).progress.bundle.attempts[0].session.blocks[0];
  assert.deepEqual(rr.questionQids, Q, 'a block with a different question order is replaced by the unit view'); assert.deepEqual(rr.answers, [1, 2, null, 3]);
});

test('attempts: one that the units delete is removed only when the units know it; a brand-new local attempt (not stamped yet) is kept', async () => {
  const w = await unitsOf(prog(att('a1', { answers: [1, null, null, null] })));
  const dead = C.merge(w.units, [[{ k: K.attField('f1:a2', 'del'), v: { del: true }, t: C.fmtStamp(NOW + 9e6, 0, 'B') }, { k: K.att('f1:a2'), v: { formUid: 'f1', raw: 'a2', order: Q, bl: [4], bs: '4', type: 'first' }, t: C.fmtStamp(NOW - 9e6, 0, 'B') }]], { now: NOW }).units;
  const vis = C.view(dead, { now: NOW }).units;
  const local = prog(att('a1', { answers: [1, null, null, null] }), att('a2', { answers: [2, null, null, null] }), att('a3-new', { answers: [3, null, null, null] }));
  const r = apply(local, { units: dead, vis });
  assert.deepEqual(r.progress.bundle.attempts.map(a => a.attemptId).sort(), ['a1', 'a3-new']); assert.deepEqual(r.report.removed, ['a2']);
  const none = B.applyUnitsToProgress({ progress: prog(att('a2', {})), units: dead, vis: C.view(dead, { now: NOW }).units, formUid: 'f1', formId: 'F1', rec: REC, buildResult });
  assert.equal(none.progress && none.progress.bundle.attempts.some(a => a.attemptId === 'a2'), false);
});

test('active attempt, labels and form-wide explanation highlights follow the units', async () => {
  const w = await unitsOf(prog(att('a1', {}, 'One'), att('a2', {}, 'Two')));
  const k = { ...w.units }, t = C.fmtStamp(NOW + 1e6, 0, 'B');
  k[K.form('f1', 'active')] = { k: K.form('f1', 'active'), v: 'a2', t }; k[K.item('~f1', 'q2', 'he')] = { k: K.item('~f1', 'q2', 'he'), v: [{ start: 1, end: 2, quote: 'x' }], t };
  const vis = C.view(k, { now: NOW }).units, r = apply(prog(att('a1', {}, 'Old'), att('a2', {}, 'Two')), { units: k, vis });
  assert.equal(r.progress.bundle.activeAttemptId, 'a2'); assert.equal(r.progress.bundle.attempts[0].label, 'One'); assert.deepEqual(r.progress.bundle.explanationHighlightAnchorsByQuestionKey['f1::q2'], [{ start: 1, end: 2, quote: 'x' }]);
  assert.equal(r.progress.session, r.progress.bundle.attempts[1].session, 'top-level session is the active attempt');
});

test('buildResultFromQuestions: missing questions mean no result (null), never a half result', () => {
  assert.equal(B.buildResultFromQuestions({ session: {}, block: blk(), blockIndex: 0, done: {}, questions: [] }), null);
  const r = B.buildResultFromQuestions({ session: { sessionId: 's' }, block: blk({ answers: [0, 1, 0, 1] }), blockIndex: 2, done: {}, questions: questions(4) });
  assert.equal(r.correct, 4); assert.equal(r.percent, 100); assert.equal(r.blockIndex, 3); assert.equal(r.sessionId, 's');
});

test('Qbank: tests of __QBANK__ are applied as sessions (new test built from the header, existing patched, used recomputed, deleted removed)', async () => {
  const keys = ['f1::q1', 'f1::q2', 'f1::q3'];
  const mkq = (id, ans, done) => ({ qbankTestId: id, name: 'Test ' + id, mode: 'testing', status: done ? 'completed' : 'in_progress', createdAt: '2026-10-20T00:00:00Z', sourceMode: 'separate', poolType: 'unused', attemptSource: 'first', formIds: ['F1'], total: 3, session: { qbankMode: true, qbankKeys: keys, qbankTestId: id, startedAt: '2026-10-20T00:00:00Z', blocks: [{ blockName: 'Q1', total: 3, answers: ans, firstAnswers: ans, flagged: [false, false, false], struck: {}, revealed: {}, questionTime: [0, 0, 0], notes: '', blockCompleted: !!done, answerChangeLog: [], result: done ? { completedAt: '2026-10-21T00:00:00Z', answers: [] } : null }] } });
  const src = { sessions: [mkq('t1', [1, null, 2], true)], used: {} };
  const x = await B.extractForm({ formUid: C.QBANK_UID, progress: src, qbank: true, dev: 'A' });
  assert.equal(x.complete, true); assert.equal(x.units.find(u => u.k === K.att('__QBANK__:t1')).v.qb.name, 'Test t1');
  const st = x.units.map((u, i) => ({ k: u.k, v: u.v, t: C.fmtStamp(NOW, i, 'A') })), units = C.merge({}, [st], { now: NOW }).units, vis = C.view(units, { now: NOW }).units;
  const qres = ({ block }) => B.buildResultFromQuestions({ session: {}, block, blockIndex: 0, done: {}, questions: questions(block.total), nowIso: '2026-10-26T10:00:00.000Z' });
  const r = B.applyUnitsToQbank({ qbank: null, units, vis, buildResult: qres, now: NOW });
  assert.deepEqual(r.report.created, ['t1']); const e = r.qbank.sessions[0];
  assert.equal(e.status, 'completed'); assert.equal(e.session.qbankMode, true); assert.deepEqual(e.session.qbankKeys, keys); assert.deepEqual(e.session.blocks[0].answers, [1, null, 2]);
  assert.equal(e.session.blocks[0].result.total, 3); assert.deepEqual(Object.keys(r.qbank.used).sort(), keys);
  assert.equal(B.applyUnitsToQbank({ qbank: r.qbank, units, vis, buildResult: qres, now: NOW }).changed, false, 'idempotent');
  const dead = C.merge(units, [[{ k: K.attField('__QBANK__:t1', 'del'), v: { del: true }, t: C.fmtStamp(NOW + 9e6, 0, 'B') }]], { now: NOW }).units;
  const gone = B.applyUnitsToQbank({ qbank: r.qbank, units: dead, vis: C.view(dead, { now: NOW }).units, buildResult: qres, now: NOW });
  assert.deepEqual(gone.report.removed, ['t1']); assert.equal(gone.qbank.sessions.length, 0);
});

test('settings registry in the bridge: every mapped name is in the plan\'s registry with the same scope; large-only settings are not applied on phones', () => {
  const reg = new Map(C.SETTINGS.map(s => [s.name + '|' + s.scope, true]));
  for (const [name, scope] of B.SETTING_KEYS) {
    const sc = scope === 'CLASS' ? ['L', 'P'] : [scope];
    for (const x of sc) assert.ok(reg.has(name + '|' + x), name + ' ' + x + ' is in the registry');
    assert.ok(![...C.SETTINGS].some(s => s.name === name && s.scope === 'd'), name + ' is not device-only');
  }
  assert.equal(B.settingApplies('L', 'phone'), false); assert.equal(B.settingApplies('L', 'large'), true); assert.equal(B.settingApplies('g', 'phone'), true); assert.equal(B.settingScope('CLASS', 'phone'), 'P');
});

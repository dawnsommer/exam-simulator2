'use strict';
/* Sync V3 bridge: extract / rebuild round trip against V2's own counting rules, QID gating, per-device time, and the
   regression for the current V2 failure (changes on both devices ask the user and one side's work is dropped; V3 keeps both). */
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/sync3-core.js');
const Bridge = require('../js/sync3-bridge.js');
const { MockDriveBackend, buildDevice, progressRevision, seedCloud } = require('./support/autonomous-harness.cjs');
const { K, merge, view } = C;

const NOW = Date.parse('2026-10-25T12:00:00Z');
const QIDS = ['n-11-b001-q001', 'n-11-b001-q002', 'n-11-b001-q003', 'n-11-b002-q001'];

function session(over = {}) {
  const b1 = {
    blockName: 'Block 1', total: 3, current: 0, questionQids: QIDS.slice(0, 3),
    answers: [1, null, 2], firstAnswers: [0, null, 2], flagged: [true, false, false], struck: { 0: [3], 2: [0, 1] }, revealed: {},
    questionTime: [30, 0, 12], notes: 'block note', blockCompleted: true,
    answerChangeLog: [{ item: 1, from: 0, to: 1, at: '2026-10-25T10:00:00Z' }],
    stemHighlightAnchors: { 0: [{ start: 1, end: 4, quote: 'abc' }] }, explanationHighlightAnchors: { 2: [{ start: 0, end: 2, quote: 'xy' }, { start: 5, end: 6, quote: 'z' }] },
    result: { answers: [{ item: 1, correct: 1 }, { item: 2, correct: 0 }, { item: 3, correct: 2 }] }
  };
  const b2 = { blockName: 'Block 2', total: 1, current: 0, questionQids: QIDS.slice(3), answers: [null], firstAnswers: [null], flagged: [false], struck: {}, revealed: {}, questionTime: [0], notes: '', blockCompleted: false, answerChangeLog: [], stemHighlightAnchors: {}, explanationHighlightAnchors: {} };
  return { blocks: [b1, b2], blockSizeSetting: '3', ...over };
}
function bundle(extra = {}) {
  return {
    fileType: 'StepExamSimulatorV10ProgressBundle', formSlot: 'N-11',
    bundle: {
      activeAttemptId: 'att-1',
      attempts: [
        { attemptId: 'att-1', label: '1st Attempt', type: 'initial', createdAt: '2026-10-25T09:00:00Z', session: session() },
        { attemptId: 'att-2', label: 'New Attempt 2', type: 'new_attempt', createdAt: '2026-10-25T11:00:00Z', session: session({ blocks: [{ ...session().blocks[1], answers: [3], questionQids: [QIDS[3]], total: 1 }] }) }
      ],
      explanationHighlightAnchorsByQuestionKey: { 'n-11::n-11-b001-q002': [{ start: 0, end: 1, quote: 'g' }] }
    }, ...extra
  };
}
const REC = { id: 'N-11', formUid: 'n-11', qidSchemaVersion: 1, bankHash: 'BANK1', displayName: 'My N-11', defaultName: 'N-11', custom: false };
const stampAll = (units, dev, min = 0) => { let c = 0; return units.map(u => ({ k: u.k, v: u.v, t: C.fmtStamp(NOW + min * 60000, c++, dev) })); };
const extract = (progress, over = {}) => Bridge.extractForm({ formUid: 'n-11', rec: REC, progress, dev: 'A', ...over });

test('extract: counts of the visible units equal V2\'s own counts for the same progress (round trip)', async () => {
  const p = bundle(), x = await extract(p);
  assert.equal(x.complete, true); assert.deepEqual(x.attempts, ['n-11:att-1', 'n-11:att-2']);
  const units = merge({}, [stampAll(Bridge.localizeTm(x.units, {}, 'A'), 'A')], { now: NOW }).units;
  const got = C.countUnits(view(units, { now: NOW }).units), want = Bridge.v2Counts(p);
  assert.deepEqual(got, want);
  assert.equal(want.attempts, 2); assert.equal(want.answered, 3); assert.equal(want.expHighlights, 3); assert.equal(want.completedBlocks, 1);
});

test('extract: keys, rules and values (QIDs not positions; first / ans / log / per-device time / global highlights)', async () => {
  const x = await extract(bundle()), by = Object.fromEntries(x.units.map(u => [u.k, u.v]));
  assert.equal(by[K.item('n-11:att-1', QIDS[0], 'ans')], 1);
  assert.equal(by[K.item('n-11:att-1', QIDS[0], 'first')], 0);
  assert.equal(by[K.item('n-11:att-1', QIDS[1], 'ans')], undefined, 'unanswered questions produce no unit');
  assert.deepEqual(by[K.item('n-11:att-1', QIDS[2], 'st')], [0, 1]);
  assert.equal(by[K.item('n-11:att-1', QIDS[0], 'fl')], true);
  assert.deepEqual(by[K.block('n-11:att-1', 1, 'done')], { done: true, ans: { [QIDS[0]]: 1, [QIDS[2]]: 2 }, at: '', el: null, sid: '' }); assert.equal(by[K.block('n-11:att-1', 1, 'nt')], 'block note');
  assert.deepEqual(by[K.att('n-11:att-1')].order, QIDS); assert.deepEqual(by[K.att('n-11:att-1')].bl, [3, 1]);
  assert.equal(by[K.attField('n-11:att-1', 'label')], '1st Attempt'); assert.equal(by[K.form('n-11', 'active')], 'att-1');
  assert.deepEqual(by[K.item('~n-11', QIDS[1], 'he')], [{ start: 0, end: 1, quote: 'g' }], 'form-wide explanation highlights live beside the attempts');
  assert.equal(by[K.lib('n-11')].on, 'installed'); assert.equal(by[K.libField('n-11', 'name')], 'My N-11');
  assert.deepEqual(x.keys['n-11:att-1|' + QIDS[0]], 1, 'answer keys come from the stored block results (for derived scores)');
  const s = C.deriveScores(view(merge({}, [stampAll(Bridge.localizeTm(x.units, {}, 'A'), 'A')], { now: NOW }).units, { now: NOW }).units, 'n-11:att-1', (uid, qid) => x.keys['n-11:att-1|' + qid]);
  assert.equal(s.answered, 2); assert.equal(s.correct, 2);
});

test('extract: blocks without QIDs (QID baseline pending) are reported and their attempt is left out, nothing throws', async () => {
  const p = bundle();
  delete p.bundle.attempts[1].session.blocks[0].questionQids;
  const x = await extract(p);
  assert.equal(x.complete, false); assert.deepEqual(x.attempts, ['n-11:att-1']);
  assert.deepEqual(x.problems, [{ code: 'no-qids', block: 1, att: 'n-11:att-2' }]);
  assert.ok(!x.units.some(u => u.k.includes('att-2')));
});

test('extract: an attempt without an id gets sha256(formUid + startedAt + label), the same on every device', async () => {
  const p = bundle(); p.bundle.attempts.forEach(a => { delete a.attemptId; delete a.session.attemptId; });
  const a = await extract(p), b = await extract(JSON.parse(JSON.stringify(p)), { dev: 'B' });
  assert.equal(a.attempts.length, 2); assert.match(a.attempts[0], /^n-11:[0-9a-f]{64}$/); assert.match(a.attemptsRaw[0], /^[0-9a-f]{64}$/);
  assert.deepEqual(a.attempts, b.attempts);
});

test('per-device time: own time = total minus what the other devices hold; merged display = sum', async () => {
  const k = K.item('n-11:att-1', QIDS[0], 'tm');
  const known = { [k]: { v: { B: 10 }, t: C.fmtStamp(NOW, 0, 'B') } };
  const x = await extract(bundle()), mine = Bridge.localizeTm(x.units.filter(u => u.k === k), known, 'A');
  assert.deepEqual(mine[0].v, { A: 20 });                   // the app shows 30 s in total, B already accounts for 10
  const merged = merge(known, [stampAll(mine, 'A', 1)], { now: NOW }).units[k].v;
  assert.equal(Bridge.tmTotal(merged), 30);
});

test('rebuild: positional arrays come back from QIDs (answers, first, flags, struck, log, notes, completion)', async () => {
  const x = await extract(bundle());
  const vis = view(merge({}, [stampAll(Bridge.localizeTm(x.units, {}, 'A'), 'A')], { now: NOW }).units, { now: NOW }).units;
  const a1 = Bridge.rebuildAttempts(vis).find(a => a.attemptId === 'att-1').session.blocks[0];
  assert.deepEqual(a1.answers, [1, null, 2]); assert.deepEqual(a1.firstAnswers, [0, null, 2]); assert.deepEqual(a1.flagged, [true, false, false]);
  assert.deepEqual(a1.struck, { 0: [3], 2: [0, 1] }); assert.deepEqual(a1.questionTime, [30, 0, 12]);
  assert.equal(a1.notes, 'block note'); assert.equal(a1.blockCompleted, true); assert.equal(a1.answerChangeLog[0].item, 1);
  assert.deepEqual(a1.questionQids, QIDS.slice(0, 3));
});

test('Qbank tests extract as attempts of __QBANK__ keyed by their question keys', async () => {
  const q = { sessions: [{ attemptId: 'qt-1', startedAt: '2026-10-25T08:00:00Z', session: { qbankMode: true, qbankKeys: ['f::q1', 'f::q2'], blocks: [{ total: 2, answers: [1, null], firstAnswers: [1, null], flagged: [false, true], struck: {}, revealed: {}, questionTime: [5, 0], notes: '', blockCompleted: true }] } }] };
  const x = await Bridge.extractForm({ formUid: C.QBANK_UID, progress: q, qbank: true, dev: 'A' });
  assert.equal(x.complete, true); assert.deepEqual(x.attempts, ['__QBANK__:qt-1']);
  assert.equal(x.units.find(u => u.k === K.item('__QBANK__:qt-1', 'f::q1', 'ans')).v, 1);
  assert.equal(x.units.find(u => u.k === K.att('__QBANK__:qt-1')).v.type, 'qbank');
});

/* ---------- regression: the current V2 failure ---------- */
test('REGRESSION (V2 failure): work on two devices at once ends in DIVERGED, the user must drop one side; V3 keeps both', async () => {
  // V2: both devices change the same form offline -> DIVERGED; "Keep this device" / "Use cloud" each lose the other device's answers.
  for (const choice of ['local', 'cloud']) {
    const drive = new MockDriveBackend();
    const a = await buildDevice({ drive, deviceId: 'A' });
    const { key } = await seedCloud(a, progressRevision(1));
    await a.runtime.sync.checkCloud({});
    const b = await buildDevice({ drive, deviceId: 'B' }); await b.runtime.sync.checkCloud({});
    b.state.progress = progressRevision(3); await b.runtime.sync.backupNow({ interactive: true });
    await a.meta.set('syncEnabled', false); a.state.progress = progressRevision(2);
    a.events.dispatchWindow({ type: 'stepsim:progress-write', detail: { filename: 'N-11_progress_save.json', operation: 'write' } });
    await a.meta.set('syncEnabled', true);
    const after = await a.runtime.sync.checkCloud({});
    assert.deepEqual(Array.from(after.summary.rows, r => r.state), ['DIVERGED'], 'V2 still asks the user');
    if (choice === 'local') await a.runtime.sync.keepLocal(key); else await a.runtime.sync.useCloud(key);
    const lost = JSON.stringify(a.state.progress) === JSON.stringify(progressRevision(choice === 'local' ? 2 : 3));
    assert.ok(lost, 'V2 keeps exactly one side (' + choice + ')');
  }
  // V3: the same situation as units (device A answered q1, device B answered q2 of the same attempt, offline) merges without asking.
  const mkp = (qi, ans) => { const p = bundle(); p.bundle.attempts = [p.bundle.attempts[0]]; const bl = p.bundle.attempts[0].session.blocks[0]; bl.answers = [null, null, null]; bl.firstAnswers = [null, null, null]; bl.answers[qi] = ans; bl.firstAnswers[qi] = ans; bl.struck = {}; bl.flagged = [false, false, false]; bl.stemHighlightAnchors = {}; bl.explanationHighlightAnchors = {}; bl.answerChangeLog = []; bl.blockCompleted = false; bl.questionTime = [0, 0, 0]; bl.notes = ''; p.bundle.explanationHighlightAnchorsByQuestionKey = {}; return p; };
  const xa = await extract(mkp(0, 2), { dev: 'A' }), xb = await extract(mkp(1, 4), { dev: 'B' });
  const ua = stampAll(xa.units, 'A', 1), ub = stampAll(xb.units, 'B', 2);
  for (const order of [[ua, ub], [ub, ua]]) {
    const out = merge({}, order, { now: NOW }), vis = view(out.units, { now: NOW }).units;
    assert.equal(vis[K.item('n-11:att-1', QIDS[0], 'ans')].v, 2); assert.equal(vis[K.item('n-11:att-1', QIDS[1], 'ans')].v, 4);
    assert.equal(C.countUnits(vis).answered, 2, 'both devices\' answers survive, no dialog');
  }
});

test('QIDs of new sessions come from positionQuestionKeys (formUid::qid or legacy id:block:question via the question index); QID schema 0 is pending', async () => {
  const rec = { ...REC, qidSchemaVersion: 1, questionIndex: QIDS.map((q, i) => ({ qid: q, blockIndex: 0, questionIndex: i })) };
  const noQ = bundle(); noQ.bundle.attempts = [noQ.bundle.attempts[0]]; delete noQ.bundle.attempts[0].session.blocks[0].questionQids; noQ.bundle.attempts[0].session.blocks = [noQ.bundle.attempts[0].session.blocks[0]];
  const s = noQ.bundle.attempts[0].session;
  s.positionQuestionKeys = [['n-11::n-11-b001-q001', 'n-11::n-11-b001-q002', 'n-11::n-11-b001-q003']];
  const a = await Bridge.extractForm({ formUid: 'n-11', rec: { ...rec, questionIndex: [] }, progress: noQ, dev: 'A' });
  assert.equal(a.complete, true); assert.deepEqual(C.parseKey(a.units.find(u => u.k.startsWith('I.n-11:att-1.') && u.k.endsWith('.ans')).k).qid, 'n-11-b001-q001');
  s.positionQuestionKeys = [['N-11:0:0', 'N-11:0:1', 'N-11:0:2']];
  const b = await Bridge.extractForm({ formUid: 'n-11', rec, progress: noQ, dev: 'A' });
  assert.equal(b.complete, true); assert.deepEqual(b.units.find(u => u.k === K.att('n-11:att-1')).v.order.slice(0, 3), QIDS.slice(0, 3));
  s.positionQuestionKeys = [['N-11:0:0', 'N-11:0:1', 'N-11:0:9']];
  assert.equal((await Bridge.extractForm({ formUid: 'n-11', rec, progress: noQ, dev: 'A' })).complete, false, 'a key that does not resolve is pending');
  const c = await Bridge.extractForm({ formUid: 'n-11', rec: { ...rec, qidSchemaVersion: 0 }, progress: bundle(), dev: 'A' });
  assert.equal(c.complete, false); assert.equal(c.problems[0].code, 'qid-schema'); assert.deepEqual(c.attempts, []);
  const d = await Bridge.extractForm({ formUid: 'n-11', rec, progress: noQ, dev: 'A', resolveRefs: () => [[{ blockIndex: 0, questionIndex: 0 }, { blockIndex: 0, questionIndex: 1 }, { blockIndex: 0, questionIndex: 2 }]] });
  assert.equal(d.complete, true, 'the browser resolver (StepQidMigration refs over the question index) can prove what the keys cannot');
});

test('form source and content: update-service forms are catalog, the user\'s own files are custom / imported; asset references are found in the form text', () => {
  assert.equal(Bridge.srcOf({ formUpdateRevision: 'r3', custom: false }), 'catalog');
  assert.equal(Bridge.srcOf({ custom: true }), 'custom');
  assert.equal(Bridge.srcOf({ id: 'N-9', custom: false }), 'imported');
  const text = JSON.stringify({ blocks: [{ questions: [{ stem: '<img src="DATA/assets/CUST-1/a b.png">', image: 'assets/CUST-1/x.jpg', exhibits: ['DATA/assets/CUST-1/x.jpg', 'assets/../etc/passwd', 'assets/short', 'https://e.com/assets/CUST-1/r.png?x=1'] }] }] });
  assert.deepEqual(Bridge.assetPathsOf(text).sort(), ['assets/CUST-1/a', 'assets/CUST-1/a b.png', 'assets/CUST-1/r.png', 'assets/CUST-1/x.jpg'].sort());
});

'use strict';
/* Revision book adapter (_draft_pappen_book/pbook-sim.js -> revision-book.js): pure helpers + how it is shipped.
   Behaviour in both apps: tools/headless/v3-probe-revision-book.js. Synthetic data only.
   Shared by both apps: byte-identical in the Local tests/ and the iPad tests/ folder. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const find = (...c) => c.map((p) => path.join(__dirname, p)).find((p) => fs.existsSync(p));
const root = path.dirname(find('../revision-book.js', '../../revision-book.js'));
const ipadDir = find('../Step Simulator IPAD', '..');
const localHtml = find('../Step_Exam_Simulator_v22.14.html', '../../Step_Exam_Simulator_v22.14.html');
const ipadHtml = find('../Step Simulator IPAD/index.html', '../index.html');
const S = require(find('../_draft_pappen_book/pbook-sim.js', '../../_draft_pappen_book/pbook-sim.js', '../revision-book-sim-helpers.js') || path.join(root, '_draft_pappen_book/pbook-sim.js'));

test('slotOf: library forms only', () => {
  assert.equal(S.slotOf({ librarySlotId: 'N-11' }, { libraryFormId: 'N-11' }), 'N-11');
  assert.equal(S.slotOf(null, { libraryFormId: 'C-EM-01' }), 'C-EM-01');
  assert.equal(S.slotOf({ librarySlotId: 'QBANK_MODE' }, { libraryFormId: 'QBANK_MODE', qbankMode: true }), '');
  assert.equal(S.slotOf({ librarySlotId: 'N-11' }, { libraryFormId: 'N-11', qbankMode: true }), '');
  assert.equal(S.slotOf({ title: 'pasted' }, {}), '');
  assert.equal(S.slotOf({ librarySlotId: 'N-11' }, null), '');
});

test('attemptOf / keyOf: same form + attempt + completion = same key', () => {
  const s = { attemptId: 'attempt_1', completedAt: '2026-11-20T10:00:00Z' };
  assert.equal(S.attemptOf(s), 'attempt_1');
  assert.equal(S.attemptOf({ sessionId: 'x' }), 'x');
  assert.equal(S.keyOf('N-11', s), S.keyOf('N-11', Object.assign({}, s, { updatedAt: 'later' })));
  assert.notEqual(S.keyOf('N-11', s), S.keyOf('N-12', s));
  assert.notEqual(S.keyOf('N-11', s), S.keyOf('N-11', Object.assign({}, s, { attemptId: 'attempt_2' })));
  assert.notEqual(S.keyOf('N-11', s), S.keyOf('N-11', Object.assign({}, s, { completedAt: 'z' })));
});

test('shadowFor: only this form buckets, in the log-file shape; null when none', () => {
  const db = { forms: { 'N-11::a1': { formId: 'N-11', entries: { '1.01': {} } }, 'N-11::a2': { formId: 'N-11', entries: {} }, 'N-12::a1': { formId: 'N-12', entries: {} }, 'QBANK_MODE::1': { formId: 'QBANK_MODE', entries: {} } } };
  const f = S.shadowFor(db, 'N-11');
  assert.deepEqual(Object.keys(f.buckets).sort(), ['N-11::a1', 'N-11::a2']);
  assert.equal(f.id, 'N-11'); assert.equal(f.type, 'ThunderShadowLog');
  assert.equal(S.shadowFor(db, 'C-EM-01'), null);
  assert.equal(S.shadowFor(null, 'N-11'), null);
  assert.equal(S.shadowFor({ forms: {} }, 'N-11'), null);
});

test('imageOf: the app already turned paths into blob URLs; fallback imageFile; none = empty', () => {
  assert.equal(S.imageOf({ image: 'blob:http://x/1', imageFile: 'b' }), 'blob:http://x/1');
  assert.equal(S.imageOf({ imageFile: 'blob:http://x/2' }), 'blob:http://x/2');
  assert.equal(S.imageOf({}), ''); assert.equal(S.imageOf(null), '');
});

test('isoOf: ISO string or empty', () => {
  assert.equal(S.isoOf('2026-11-20T10:00:00Z'), '2026-11-20T10:00:00.000Z');
  assert.equal(S.isoOf(''), ''); assert.equal(S.isoOf('nope'), '');
});

test('snap from a session in memory: every question, wrong/flagged counts, blob image kept (PBookPrep + adapter inputs)', () => {
  const P = require(find('../_draft_pappen_book/pbook-prep.js', '../../_draft_pappen_book/pbook-prep.js'));
  const q = (n, extra) => Object.assign({ qid: 'q' + n, stem: 'stem ' + n, choices: ['a', 'b', 'c', 'd'], correct: 0, topic: 'topic ' + n, subject: 'Cardiology' }, extra || {});
  const form = { title: 'Synthetic', blocks: [{ questions: [q(1), q(2, { image: 'blob:http://x/img' }), q(3)] }] };
  const session = { attemptId: 'a1', libraryFormId: 'N-99', completedAt: '2026-11-20T10:00:00Z', blocks: [{ questionQids: ['q1', 'q2', 'q3'], answers: [0, 1, 2], firstAnswers: [0, 1, 2], questionTime: [10, 20, 30], flagged: [3], struck: {}, stemHighlightAnchors: {}, rapidHighlights: {}, explanationHighlightAnchors: {} }] };
  const snap = P.snap({ slot: 'N-99', form, session, rr: null, shadowLog: S.shadowFor(null, 'N-99'), attemptId: S.attemptOf(session), savedAt: S.isoOf(session.completedAt), now: '2026-11-21T00:00:00Z', imageOf: S.imageOf });
  assert.equal(snap.items.length, 3);
  assert.equal(snap.items.filter((it) => it.pick != null && it.pick !== it.correct).length, 2);
  assert.equal(snap.items.find((it) => it.qid === 'q2').image, 'blob:http://x/img');
  assert.ok(snap.toc && snap.summary && snap.prettyTitle);
});

test('shipping: bundle copies are byte-identical, loaded once after library-simple.js in both apps, iPad shell lists it', () => {
  const a = fs.readFileSync(path.join(root, 'revision-book.js'), 'utf8'), b = fs.readFileSync(path.join(ipadDir, 'revision-book.js'), 'utf8');
  assert.equal(a, b);
  assert.ok(a.includes('pbook-sim.js') && a.includes('PBookPrep') && a.includes('id = "revision-book-css"'));
  const l = fs.readFileSync(localHtml, 'utf8'), i = fs.readFileSync(ipadHtml, 'utf8');
  assert.equal((l.match(/revision-book\.js/g) || []).length, 1); assert.equal((i.match(/revision-book\.js/g) || []).length, 1);
  assert.ok(l.indexOf('<script src="./revision-book.js"></script>') > l.indexOf('<script src="./library-simple.js"></script>'));
  assert.ok(/<script src="\.\/revision-book\.js\?v=\d+"><\/script>/.test(i) && i.indexOf('revision-book.js') > i.indexOf('library-simple.js'));
  for (const f of ['sw.js', 'app-update.js']) assert.ok(fs.readFileSync(path.join(ipadDir, f), 'utf8').includes('"./revision-book.js?v='), f);
  assert.ok(fs.readFileSync(path.join(ipadDir, 'tools', 'publish.mjs'), 'utf8').includes("'revision-book.js'"), 'publish.mjs ships it');
});

test('bundle: no @page rule at load (added only while the sheet is open), re-entrant mount api present', () => {
  const a = fs.readFileSync(path.join(root, 'revision-book.js'), 'utf8');
  const css = a.slice(a.indexOf('s.textContent = ') + 16, a.indexOf('; (document.head'));
  assert.ok(!/@page/.test(JSON.parse(css.replace(/<\\\//g, '</'))), 'CSS has no global @page');
  assert.ok(a.includes('PBookUI = {mount, current'));
});

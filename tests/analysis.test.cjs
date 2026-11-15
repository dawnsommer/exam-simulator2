// Analysis tab compute (analysis.js, shared Local/iPad). Synthetic data only (no DATA/ reads).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const A = require('../analysis.js');

const ans = (item, ok, subject, extra) => Object.assign({ block: 1, item, isCorrect: ok, chosen: 0, flagged: false, t: 60, subject, topic: 'T' + item }, extra);
function form(id, qs, results, extraAttempts, changes) {
  return {
    cat: { id, displayName: id, totalQuestions: qs.length, questionIndex: qs.map((s, i) => ({ qid: 'q' + i, subject: s, topic: 'Topic ' + i })) },
    doc: { attempts: [{ type: 'initial', completedAt: '2026-10-01T10:00:00Z', session: {
      blocks: [{ questionQids: qs.map((_, i) => 'q' + i), changes: changes || [] }],
      results: [{ blockIndex: 1, total: results.length, completedAt: '2026-10-01T10:00:00Z', answers: results }] } }, ...(extraAttempts || [])] },
  };
}

test('systems map from subject strings', () => {
  assert.equal(A.systemOf('Cardiology'), 'cardio');
  assert.equal(A.systemOf('Geriatrics/Neurology'), 'neuro');
  assert.equal(A.systemOf('Obstetrics/Gynecology'), 'repro');
  assert.equal(A.systemOf('Pharmacology'), 'other');
  assert.equal(A.systemOf('Generated/inferred'), null);
});

test('subject comes from the catalog by QID, not the saved result', () => {
  const f = form('N-10', ['Cardiology', 'Psychiatry'], [ans(1, true, 'Generated/inferred'), ans(2, false, 'Generated/inferred')]);
  const m = A.compute({ catalog: { forms: [f.cat] }, progress: { 'N-10': f.doc }, now: '2026-11-15' });
  assert.deepEqual(m.systems.map((s) => [s.id, s.n, s.c]).sort(), [['cardio', 1, 1], ['psych', 1, 0]]);
  assert.equal(m.unclassified, 0);
  assert.equal(m.forms[0].status, 'done');
  assert.equal(m.forms[0].score, 299); // NBMEScore nbme-10: 300.18 − 1.1 × 1 wrong
  assert.equal(m.forms[0].scoreEst, true);
});

test('retests are left out unless scope is all', () => {
  const retake = { type: 'retest', session: { blocks: [{ questionQids: ['q0'] }], results: [{ blockIndex: 1, total: 1, completedAt: '2026-10-05T10:00:00Z', answers: [ans(1, true, 'x')] }] } };
  const f = form('C-IM-03', ['Cardiology'], [ans(1, false, 'Cardiology')], [retake]);
  const first = A.compute({ catalog: { forms: [f.cat] }, progress: { 'C-IM-03': f.doc } });
  const all = A.compute({ catalog: { forms: [f.cat] }, progress: { 'C-IM-03': f.doc }, prefs: { scope: 'all' } });
  assert.equal(first.totals.graded, 1);
  assert.equal(all.totals.graded, 2);
  assert.equal(first.forms[0].retakes.length, 1);
});

test('answer changes come from the change log (first from vs last to)', () => {
  const log = [
    { item: 1, from: 0, to: 1, correct: 1, at: 'a' },              // wrong → right
    { item: 2, from: 1, to: 0, correct: 1, at: 'a' },              // right → wrong
    { item: 3, from: 0, to: 2, correct: 1, at: 'a' }, { item: 3, from: 2, to: 3, correct: 1, at: 'b' }, // wrong → wrong
    { item: 4, from: 0, to: 2, correct: 1, at: 'a' }, { item: 4, from: 2, to: 0, correct: 1, at: 'b' }, // back to start: not a change
  ];
  const f = form('C-Peds-05', ['Pediatrics', 'Pediatrics', 'Pediatrics', 'Pediatrics'], [1, 2, 3, 4].map((i) => ans(i, i === 1, 'Pediatrics', { changed: true, firstRight: false })), [], log);
  const m = A.compute({ catalog: { forms: [f.cat] }, progress: { 'C-Peds-05': f.doc } });
  assert.deepEqual(m.behaviour.changes, { n: 3, wr: 1, rw: 1, ww: 1, forms: 1, net: 0 });
});

test('empty result slots and unanswered items', () => {
  const f = form('C-Neuro-04', ['Neurology', 'Neurology', 'Neurology'], [ans(1, true, 'Neurology', { chosen: 1 }), ans(2, false, 'Neurology', { chosen: null }), ans(3, false, 'Neurology', { chosen: null })]);
  f.doc.attempts[0].completedAt = null;
  f.doc.attempts[0].session.blocks.push({ questionQids: [], answers: [] });
  f.doc.attempts[0].session.results.push(null);
  const m = A.compute({ catalog: { forms: [f.cat] }, progress: { 'C-Neuro-04': f.doc } });
  assert.equal(m.forms[0].status, 'progress'); // 1 of 2 blocks finished
  assert.equal(m.totals.graded, 1); // unanswered items are left out of the analysis
  assert.equal(m.forms[0].answered, 1);
});

test('Local and iPad copies are byte-identical', (t) => {
  const here = path.join(__dirname, '..', 'analysis.js');
  const other = [path.join(__dirname, '..', 'Step Simulator IPAD', 'analysis.js'), path.join(__dirname, '..', '..', 'analysis.js')].find((p) => p !== here && fs.existsSync(p));
  if (!other) { t.skip('other app not next to this one'); return; }
  assert.equal(fs.readFileSync(here, 'utf8'), fs.readFileSync(other, 'utf8'));
});

test('a saved 3-digit score wins over the estimate and is marked saved', () => {
  const f = form('N-10', ['Cardiology', 'Psychiatry'], [ans(1, true, 'Cardiology'), ans(2, false, 'Psychiatry')]);
  f.cat.threeDigitScore = '247';
  const m = A.compute({ catalog: { forms: [f.cat] }, progress: { 'N-10': f.doc } });
  assert.equal(m.forms[0].score, 247);
  assert.equal(m.forms[0].scoreSaved, 247);
  assert.equal(m.forms[0].scoreEst, false);
  f.cat.threeDigitScore = '';
  const e = A.compute({ catalog: { forms: [f.cat] }, progress: { 'N-10': f.doc } });
  assert.equal(e.forms[0].scoreSaved, null);
  assert.equal(e.forms[0].scoreEst, true);
});

test('score converter: forms, % → 3-digit, out of range, input rule', () => {
  const keys = A.convertible().map((c) => c.key);
  assert.ok(keys.includes('nbme-13') && keys.includes('uwsa-2') && keys.includes('f120-2023'));
  assert.equal(A.convertible().find((c) => c.key === 'f120-2023').name, 'Free 120 (2023)');
  assert.equal(A.convert('nbme-13', 78).score, 252); // 298.8 − 1.07 × 44 wrong
  assert.deepEqual(A.convert('nbme-16', 40), { error: 'range', range: [50, 90] });
  assert.equal(A.convert('uwsa-3', 70), null); // no conversion
  assert.equal(A.convert('nbme-13', NaN), null);
  for (const ok of ['', '245', '300']) assert.equal(A.scoreOk(ok), true, ok);
  for (const bad of ['24', '2450', '301', '24a']) assert.equal(A.scoreOk(bad), false, bad);
});

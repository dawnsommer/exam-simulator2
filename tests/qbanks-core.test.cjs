// Qbanks core (qbanks-core.js, shared Local/iPad). Synthetic data only.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const Q = require('../qbanks-core.js');

test('normSystem: simple, compound, passthrough', () => {
  assert.equal(Q.SYSTEMS.length, 23);
  assert.equal(Q.normSystem('Cardiology'), 'Cardiovascular');
  assert.equal(Q.normSystem('Nephrology/Urology'), 'Renal & Urinary');
  assert.equal(Q.normSystem('Obstetrics/Gynecology'), 'Female Reproductive & Breast');
  assert.equal(Q.normSystem('Obstetrics'), 'Pregnancy & Childbirth');
  assert.equal(Q.normSystem('Gynecology'), 'Female Reproductive & Breast');
  assert.equal(Q.normSystem('Neurology/Psychiatry'), 'Nervous System');
  assert.equal(Q.normSystem('Generated/inferred'), 'Unassigned');
  assert.equal(Q.normSystem(''), 'Unassigned');
  assert.equal(Q.normSystem(null), 'Unassigned');
  assert.equal(Q.normSystem('  Weird Label '), 'Weird Label');
  assert.equal(Q.normSystem('Pediatrics'), 'Multisystem');
});

test('systemOf: system wins over subject, provenance', () => {
  assert.deepEqual(Q.systemOf({ system: 'Cardiology', subject: 'Psychiatry' }), { system: 'Cardiovascular', from: 'system' });
  assert.deepEqual(Q.systemOf({ subject: 'Psychiatry' }), { system: 'Psychiatric & Behavioral', from: 'subject' });
  assert.deepEqual(Q.systemOf({ subject: 'Generated/inferred' }), { system: 'Unassigned', from: 'missing' });
  assert.deepEqual(Q.systemOf({}), { system: 'Unassigned', from: 'missing' });
});

test('subjectOf provenance: question, CMS form, inferred', () => {
  assert.deepEqual(Q.subjectOf({ discipline: 'Pathology' }, {}), { subject: 'Pathology', from: 'question' });
  assert.deepEqual(Q.subjectOf({ subject: 'x' }, { type: 'C', filter: 'Surg' }), { subject: 'Surgery', from: 'form' });
  assert.deepEqual(Q.subjectOf({}, { id: 'C-IM1', filter: 'IM' }), { subject: 'Internal Medicine', from: 'form' });
  assert.deepEqual(Q.subjectOf({ subject: 'Psychiatry' }, { type: 'N' }), { subject: 'Psychiatry', from: 'inferred' });
  assert.deepEqual(Q.subjectOf({ system: 'Obstetrics/Gynecology' }, null), { subject: 'Obstetrics & Gynecology', from: 'inferred' });
  assert.deepEqual(Q.subjectOf({ subject: 'Cardiology' }, { type: 'N' }), { subject: 'Internal Medicine', from: 'inferred' });
});

test('suggestFromTopic', () => {
  assert.equal(Q.suggestFromTopic('Acute myocardial infarction'), 'Cardiovascular');
  assert.equal(Q.suggestFromTopic('Otitis media in a child'), 'Ear, Nose & Throat');
  assert.equal(Q.suggestFromTopic('Ear pain'), 'Ear, Nose & Throat');
  assert.equal(Q.suggestFromTopic('Last year review'), null);
  assert.equal(Q.suggestFromTopic(''), null);
  assert.equal(Q.suggestFromTopic(undefined), null);
});

test('bankOf: every rule and imported id', () => {
  assert.equal(Q.bankOf({ id: 'N-10', type: 'N' }), 'nbme');
  assert.equal(Q.bankOf({ id: 'F-120', filter: 'F120' }), 'nbme');
  assert.equal(Q.bankOf({ id: 'C-IM1', type: 'C' }), 'cms');
  assert.equal(Q.bankOf({ id: 'C-X' }), 'cms');
  assert.equal(Q.bankOf({ id: 'U1', filter: 'UWSA' }), 'uwsa');
  assert.equal(Q.bankOf({ id: 'Z', type: 'X' }), 'other');
  assert.equal(Q.bankOf({ id: 'QB-x-01', qbank: { id: 'myimport' } }), 'myimport');
  assert.equal(Q.bankOf({ id: 'C-1', qbank: { id: 'imp' } }), 'imp');
  assert.deepEqual(Q.BUILTIN_BANKS.map(b => b.id), ['nbme', 'cms', 'uwsa', 'other']);
});

test('statusOf', () => {
  assert.deepEqual(Q.statusOf({ used: false, answered: true, correct: true }), { status: 'unused', marked: false });
  assert.deepEqual(Q.statusOf({ used: true, answered: true, correct: true, marked: true }), { status: 'correct', marked: true });
  assert.deepEqual(Q.statusOf({ used: true, answered: true, correct: false }), { status: 'incorrect', marked: false });
  assert.deepEqual(Q.statusOf({ used: true, answered: false }), { status: 'omitted', marked: false });
});

const R = (key, subject, system, status, marked) => ({ key, subject, system, status, marked: !!marked });
const rows = [
  R('a', 'Internal Medicine', 'Cardiovascular', 'unused'), R('b', 'Internal Medicine', 'Renal & Urinary', 'correct'),
  R('c', 'Surgery', 'Cardiovascular', 'incorrect', true), R('d', 'Surgery', 'Unassigned', 'unused'),
  R('e', 'Pediatrics', 'Renal & Urinary', 'omitted'), R('f', 'Pediatrics', 'Cardiovascular', 'unused', true)];

test('matches: status, marked, subject, system', () => {
  assert.ok(Q.matches(rows[0], { statuses: ['unused'] }));
  assert.ok(!Q.matches(rows[1], { statuses: ['unused'] }));
  assert.ok(Q.matches(rows[2], { statuses: ['marked'] }));
  assert.ok(Q.matches(rows[5], { statuses: new Set(['marked']) }));
  assert.ok(!Q.matches(rows[0], { statuses: ['marked'] }));
  assert.ok(!Q.matches(rows[0], { statuses: ['unused'], subjects: ['Surgery'] }));
  assert.ok(!Q.matches(rows[0], { statuses: ['unused'], systems: new Set(['Renal & Urinary']) }));
  assert.ok(Q.matches(rows[0], { subjects: null, systems: null }));
});

test('facets: counts, cross-filter, perf, disabled when zero', () => {
  const f = Q.facets(rows, { statuses: ['unused'], subjects: ['Surgery', 'Pediatrics'], systems: null });
  assert.deepEqual(f.subjects, ['Internal Medicine', 'Pediatrics', 'Surgery']);
  assert.deepEqual(f.systems, ['Cardiovascular', 'Renal & Urinary', 'Unassigned']);
  assert.deepEqual(f.subCount, { 'Internal Medicine': 1, Pediatrics: 1, Surgery: 1 });
  // system counts only within ticked subjects: IM's unused Cardiovascular row is excluded
  assert.deepEqual(f.sysCount, { Cardiovascular: 1, 'Renal & Urinary': 0, Unassigned: 1 });
  assert.equal(f.avail, 2);
  assert.deepEqual(f.keys.sort(), ['d', 'f']);
  // system ticks narrow avail further
  const g = Q.facets(rows, { statuses: ['unused'], subjects: null, systems: ['Cardiovascular'] });
  assert.equal(g.avail, 2);
  assert.deepEqual(g.keys.sort(), ['a', 'f']);
  // perf is over all rows, not just the pool
  assert.deepEqual(f.sysPerf.Cardiovascular, { n: 3, c: 0, w: 1, u: 2 });
  assert.deepEqual(f.subPerf.Pediatrics, { n: 2, c: 0, w: 1, u: 1 });
  assert.deepEqual(f.poolCount, { unused: 3, incorrect: 1, marked: 2, omitted: 1, correct: 1 });
  // null selection = everything
  assert.equal(Q.facets(rows, { statuses: null }).avail, 6);
  assert.equal(Q.facets([], {}).avail, 0);
});

const perfRows = [];
for (let i = 0; i < 12; i++) perfRows.push(R('x' + i, 'IM', 'Cardiovascular', i < 3 ? 'correct' : 'incorrect'));
for (let i = 0; i < 12; i++) perfRows.push(R('y' + i, 'IM', 'Renal & Urinary', i < 8 ? 'correct' : 'incorrect'));
for (let i = 0; i < 12; i++) perfRows.push(R('z' + i, 'IM', 'Dermatology', i < 11 ? 'correct' : 'incorrect'));
for (let i = 0; i < 12; i++) perfRows.push(R('w' + i, 'IM', 'Genetics', i < 6 ? 'correct' : 'incorrect'));
for (let i = 0; i < 12; i++) perfRows.push(R('u' + i, 'IM', 'Unassigned', 'incorrect'));
for (let i = 0; i < 9; i++) perfRows.push(R('v' + i, 'IM', 'Ophthalmology', 'incorrect')); // < 10 answered

test('presets: weak spots needs >=10 answered, picks 3 weakest', () => {
  const m = Q.facets(perfRows, { statuses: null });
  const p = Q.presets(m);
  assert.deepEqual(p.map(x => x.id), ['fresh', 'weak', 'redo', 'sim']);
  const weak = p.find(x => x.id === 'weak');
  assert.equal(weak.disabled, false);
  assert.deepEqual(weak.apply.systems, ['Cardiovascular', 'Genetics', 'Renal & Urinary']);
  assert.deepEqual(weak.apply.statuses, ['unused', 'incorrect']);
  assert.equal(p.find(x => x.id === 'sim').apply.mode, 'timed');
  assert.equal(p.find(x => x.id === 'sim').apply.secs, 90);
  const none = Q.presets(Q.facets(rows, { statuses: null })).find(x => x.id === 'weak');
  assert.equal(none.disabled, true);
  assert.equal(none.detail, 'needs answered questions');
  assert.equal(Q.presets(m).find(x => x.id === 'redo').detail, 'Incorrect + marked \u00b7 ' + (m.poolCount.incorrect + m.poolCount.marked));
});

test('mergeTags: newest wins, tombstones, inputs untouched', () => {
  const a = { fileType: 'ThunderQbankTags', v: 1, tags: { k1: { system: 'Cardiovascular', at: '2026-11-01T00:00:00Z' }, k2: { system: 'Dermatology', at: '2026-11-03T00:00:00Z' }, k4: { system: 'Genetics', at: '2026-11-01T00:00:00Z' } } };
  const b = { fileType: 'ThunderQbankTags', v: 1, tags: { k1: { system: 'Renal & Urinary', at: '2026-11-02T00:00:00Z' }, k2: { system: null, at: '2026-11-02T00:00:00Z' }, k3: { system: null, at: '2026-11-05T00:00:00Z' }, k4: { system: null, at: '2026-11-09T00:00:00Z' } } };
  const snap = JSON.stringify([a, b]);
  const m = Q.mergeTags(a, b);
  assert.equal(m.fileType, 'ThunderQbankTags'); assert.equal(m.v, 1);
  assert.equal(m.tags.k1.system, 'Renal & Urinary');
  assert.equal(m.tags.k2.system, 'Dermatology');
  assert.deepEqual(m.tags.k3, { system: null, at: '2026-11-05T00:00:00Z' });
  assert.equal(m.tags.k4.system, null); // tombstone kept so the delete syncs
  assert.deepEqual(Q.mergeTags(m, a), m);
  assert.deepEqual(Q.mergeTags(null, a).tags, a.tags);
  assert.deepEqual(Q.mergeTags(undefined, undefined).tags, {});
  assert.equal(JSON.stringify([a, b]), snap);
});

test('fmtDuration', () => {
  assert.equal(Q.fmtDuration(2700), '45 min');
  assert.equal(Q.fmtDuration(3600), '1 h 00 min');
  assert.equal(Q.fmtDuration(3600 * 3 + 60 * 5), '3 h 05 min');
  assert.equal(Q.fmtDuration(0), '0 min');
  assert.equal(Q.fmtDuration(3590), '1 h 00 min');
});

// ---- Exam mix: blueprint, clinical sciences, planners ----
const BP = Q.BLUEPRINT_STEP2;
function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const rowOfId = id => BP.rows.find(r => r.id === id);
const capOfRow = (id, len) => Math.max(1, Math.floor(rowOfId(id).max * len / 100 + 1e-9));
function mkPool(perRow, opts) {
  opts = opts || {}; const units = []; let c = 0;
  Object.keys(perRow).forEach(id => {
    for (let i = 0; i < perRow[id]; i++) {
      const k = 'k' + (c++), sci = id === 'social' || id === 'biostat' ? [] : [['medicine'], ['pediatrics'], ['obgyn'], ['psychiatry', 'medicine'], ['surgery', 'medicine']][i % 5];
      units.push({ keys: [k], row: id === 'none' ? null : id, sci });
    }
  });
  return units;
}
const fullPool = n => { const o = {}; BP.rows.forEach(r => { o[r.id] = n; }); return o; };
const unitsInPlan = p => { const out = []; let i = 0; p.sizes.forEach(sz => { out.push(p.keys.slice(i, i + sz)); i += sz; }); return out; };

test('BLUEPRINT_STEP2: sums, mapping covers every SYSTEMS name once', () => {
  assert.equal(BP.rows.length, 14);
  assert.equal(BP.rows.reduce((a, r) => a + (r.min + r.max) / 2, 0), 101);
  const seen = {}; BP.rows.forEach(r => r.systems.forEach(s => { seen[s] = (seen[s] || 0) + 1; }));
  Q.SYSTEMS.forEach(s => assert.equal(seen[s], 1, s));
  assert.equal(seen[Q.UNASSIGNED], undefined);
  Object.keys(seen).forEach(s => assert.equal(seen[s], 1));
  assert.deepEqual(BP.sciences.map(c => c.id), ['medicine', 'pediatrics', 'obgyn', 'psychiatry', 'surgery']);
  assert.equal(Q.blueprintRow('Cardiovascular'), 'cardio');
  assert.equal(Q.blueprintRow('Male Reproductive'), 'renal');
  assert.equal(Q.blueprintRow('Infectious Diseases'), 'multi');
  assert.equal(Q.blueprintRow('Ophthalmology'), 'neuro');
  assert.equal(Q.blueprintRow('Genetics'), 'humdev');
  assert.equal(Q.blueprintRow('Unassigned'), null);
  assert.equal(Q.blueprintRow('Nonsense'), null);
  assert.equal(Q.blueprintRow(null), null);
});

test('clinicalSciencesOf: explicit, CMS shelf, rules', () => {
  const cs = Q.clinicalSciencesOf;
  ['IM', 'Internal Medicine', 'Family Medicine', 'FM', 'Emergency Medicine', 'EM', 'Neurology', 'Neuro'].forEach(d => assert.deepEqual(cs({ discipline: d }, null), ['medicine'], d));
  assert.deepEqual(cs({ discipline: 'Peds' }), ['pediatrics']);
  assert.deepEqual(cs({ clinicalScience: 'OB/GYN' }), ['obgyn']);
  assert.deepEqual(cs({ discipline: 'Psych' }), ['psychiatry']);
  assert.deepEqual(cs({ discipline: 'General Surgery' }), ['surgery']);
  assert.deepEqual(cs({ discipline: 'Pathology', system: 'Cardiology' }), ['medicine']);
  const shelves = { IM: 'medicine', FM: 'medicine', EM: 'medicine', Neuro: 'medicine', Peds: 'pediatrics', OBGyn: 'obgyn', Psych: 'psychiatry', Surg: 'surgery' };
  Object.keys(shelves).forEach(f => assert.deepEqual(cs({ stem: 'A 4-year-old boy' }, { type: 'C', id: 'C-X', filter: f }), [shelves[f]], f));
  assert.deepEqual(cs({ system: 'Cardiology', recognizer: 'A 4-year-old boy with a murmur' }, { type: 'N' }), ['pediatrics']);
  assert.deepEqual(cs({ stem: 'A 3-week-old infant' }), ['pediatrics']);
  assert.deepEqual(cs({ stem: 'A 45-year-old man' , system: 'Cardiology' }), ['medicine']);
  assert.deepEqual(cs({ stem: 'A 17-year-old girl', system: 'Cardiology' }), ['pediatrics']);
  assert.deepEqual(cs({ stem: 'A 18-year-old girl', system: 'Cardiology' }), ['medicine']);
  assert.deepEqual(cs({ stem: 'A 30-year-old pregnant woman', system: 'Cardiology' }), ['obgyn']);
  assert.deepEqual(cs({ system: 'Obstetrics/Gynecology', stem: 'x' }), ['obgyn']);
  assert.deepEqual(cs({ system: 'Psychiatry', stem: 'x' }), ['psychiatry']);
  assert.deepEqual(cs({ system: 'General Surgery', stem: 'A 50-year-old man' }), ['medicine', 'surgery']);
  assert.deepEqual(cs({ system: 'Cardiology', stem: 'A 50-year-old man', answerText: 'Laparotomy' }), ['medicine', 'surgery']);
  assert.deepEqual(cs({ system: 'Ethics', stem: 'A 50-year-old man' }), []);
  assert.deepEqual(cs({ system: 'Biostatistics', stem: 'A study' }), []);
  assert.deepEqual(cs({ system: 'General Surgery', stem: 'A 6-year-old boy' }), ['pediatrics', 'surgery']);
  assert.deepEqual(cs({ system: 'Cardiology', stem: 'A 6-month-old', answerText: 'Surgical repair' }), ['pediatrics', 'surgery']);
  assert.deepEqual(cs({}), ['medicine']);
  assert.deepEqual(cs(null), ['medicine']);
});

test('subjectOf fallback uses clinical science instead of always Internal Medicine', () => {
  assert.deepEqual(Q.subjectOf({ subject: 'Cardiology', recognizer: 'A 4-year-old boy with a murmur' }, { type: 'N' }), { subject: 'Pediatrics', from: 'inferred' });
  assert.deepEqual(Q.subjectOf({ subject: 'Cardiology', recognizer: 'A 30-year-old pregnant woman' }, { type: 'N' }), { subject: 'Obstetrics & Gynecology', from: 'inferred' });
  assert.deepEqual(Q.subjectOf({ subject: 'Cardiology', recognizer: 'A 45-year-old man' }, { type: 'N' }), { subject: 'Internal Medicine', from: 'inferred' });
  assert.deepEqual(Q.subjectOf({ subject: 'Neurology', recognizer: 'A 4-year-old boy' }, { type: 'N' }), { subject: 'Neurology', from: 'inferred' });
  assert.deepEqual(Q.subjectOf({ subject: 'Cardiology', recognizer: 'A 4-year-old boy' }, { type: 'C', filter: 'IM' }), { subject: 'Internal Medicine', from: 'form' });
});

test('planMix: quotas sum to N for N=1..200, never above N', () => {
  const pool = mkPool(fullPool(60));
  for (let n = 1; n <= 200; n++) {
    const p = Q.planMix(pool, n, 40, { rand: seeded(n) });
    assert.equal(p.keys.length, n, 'n=' + n);
    assert.equal(p.sizes.reduce((a, b) => a + b, 0), n);
    assert.equal(new Set(p.keys).size, n);
  }
});

test('planMix: per-block counts inside official range, blocks sum, caps hold', () => {
  const pool = mkPool(fullPool(80));
  [40, 120, 280].forEach(n => {
    for (let seed = 1; seed <= 3; seed++) {
      const p = Q.planMix(pool, n, 40, { rand: seeded(seed * 7 + n) });
      assert.equal(p.keys.length, n);
      assert.equal(p.blocks.length, n / 40);
      assert.equal(p.perBlock.length, p.blocks.length);
      p.blocks.forEach((b, i) => {
        const len = b[1] - b[0];
        assert.equal(len, 40);
        assert.equal(Object.values(p.perBlock[i]).reduce((a, x) => a + x, 0), len);
        BP.rows.forEach(r => {
          const c = p.perBlock[i][r.id] || 0;
          assert.ok(c >= Math.floor(r.min * len / 100) - 1, n + ' ' + r.id + ' low ' + c);
          assert.ok(c <= Math.ceil(r.max * len / 100), n + ' ' + r.id + ' high ' + c);
          assert.ok(c <= capOfRow(r.id, len), n + ' ' + r.id + ' cap ' + c);
        });
      });
      assert.deepEqual(p.notes, []);
    }
  });
});

test('planMix: short row spills to other rows with a note, total correct', () => {
  const per = fullPool(60); per.social = 2;
  const p = Q.planMix(mkPool(per), 40, 40, { rand: seeded(5) });
  assert.equal(p.keys.length, 40);
  assert.equal(p.perBlock[0].social, 2);
  assert.ok(p.notes.some(t => /^Short on .*Ethics.* → filled from other systems$/.test(t)), p.notes.join('|'));
  BP.rows.forEach(r => assert.ok((p.perBlock[0][r.id] || 0) <= capOfRow(r.id, 40), r.id));
  assert.ok(!p.notes.some(t => /Cap raised/.test(t)));
});

test('planMix: unassigned top up, then cap break with note', () => {
  const per = fullPool(0); per.cardio = 30; per.none = 5;
  const p = Q.planMix(mkPool(per), 40, 40, { rand: seeded(2) });
  assert.equal(p.keys.length, 35);
  assert.ok(p.notes.some(t => /unassigned/.test(t)));
  assert.ok(p.notes.some(t => /Cap raised for Cardio/.test(t)));
  assert.equal(p.perBlock[0].none, 5);
  const big = Q.planMix(mkPool({ cardio: 50 }), 40, 40, { rand: seeded(2) });
  assert.equal(big.keys.length, 40);
  assert.ok(big.notes.some(t => /Cap raised for Cardio/.test(t)));
});

test('planMix: opts.rows re-normalises over the rows in use', () => {
  const pool = mkPool(fullPool(80));
  const p = Q.planMix(pool, 40, 40, { rand: seeded(3), rows: ['cardio', 'resp'] });
  assert.equal(p.keys.length, 40);
  assert.deepEqual(Object.keys(p.perBlock[0]).sort(), ['cardio', 'resp']);
  assert.ok(Math.abs(p.perBlock[0].cardio - 20) <= 3, JSON.stringify(p.perBlock[0]));
  assert.deepEqual(p.notes, []);
});

test('planMix: linked sets stay adjacent, in order and inside one block', () => {
  const units = []; let c = 0;
  BP.rows.forEach(r => { for (let i = 0; i < 40; i++) { const sz = i % 4 === 0 ? 3 : 1, keys = []; for (let j = 0; j < sz; j++) keys.push('k' + (c++)); units.push({ keys, row: r.id, sci: ['medicine'] }); } });
  const p = Q.planMix(units, 120, 40, { rand: seeded(11) });
  assert.ok(p.keys.length <= 120 && p.keys.length >= 110, String(p.keys.length));
  const byFirst = {}; units.forEach(u => { byFirst[u.keys[0]] = u.keys; });
  let i = 0;
  p.sizes.forEach(sz => { const seg = p.keys.slice(i, i + sz); assert.deepEqual(seg, byFirst[seg[0]]); i += sz; });
  p.blocks.forEach(([a, b]) => { let pos = a; p.sizes.reduce((acc, sz) => { if (acc >= a && acc < b) assert.ok(acc + sz <= b); return acc + sz; }, 0); assert.ok(pos <= b); });
  assert.equal(p.blocks[p.blocks.length - 1][1], p.keys.length);
});

test('planMix: same row never adjacent in a block when the pool allows', () => {
  const pool = mkPool(fullPool(80)), rowOfKey = {}; pool.forEach(u => { rowOfKey[u.keys[0]] = u.row; });
  for (let seed = 1; seed <= 10; seed++) {
    const p = Q.planMix(pool, 120, 40, { rand: seeded(seed) });
    p.blocks.forEach(([a, b]) => { for (let i = a + 1; i < b; i++) assert.notEqual(rowOfKey[p.keys[i]], rowOfKey[p.keys[i - 1]], 'seed ' + seed); });
  }
});

test('planMix: same seeded rand gives identical output; different seed differs', () => {
  const pool = mkPool(fullPool(60));
  const a = Q.planMix(pool, 80, 40, { rand: seeded(42) }), b = Q.planMix(pool, 80, 40, { rand: seeded(42) }), c = Q.planMix(pool, 80, 40, { rand: seeded(43) });
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.keys, c.keys);
  const ra = Q.planRandomCapped(pool, 80, 40, { rand: seeded(1) }), rb = Q.planRandomCapped(pool, 80, 40, { rand: seeded(1) });
  assert.deepEqual(ra, rb);
});

test('planMix: sciences preference keeps Medicine from taking over', () => {
  const pool = mkPool(fullPool(80));
  const sciOf = {}; pool.forEach(u => { sciOf[u.keys[0]] = u.sci; });
  const p = Q.planMix(pool, 120, 40, { rand: seeded(9) });
  const cnt = {}; p.keys.forEach(k => sciOf[k].forEach(s => { cnt[s] = (cnt[s] || 0) + 1; }));
  assert.ok(cnt.pediatrics > 0 && cnt.obgyn > 0 && cnt.surgery > 0);
});

test('planMix: empty, tiny and over-sized requests', () => {
  assert.deepEqual(Q.planMix([], 40, 40), { keys: [], sizes: [], blocks: [], perBlock: [], notes: [] });
  assert.equal(Q.planMix(mkPool(fullPool(1)), 0, 40).keys.length, 0);
  const p = Q.planMix(mkPool(fullPool(1)), 500, 40, { rand: seeded(1) });
  assert.equal(p.keys.length, 14);
  assert.equal(p.blocks.length, 1);
});

test('planRandomCapped: caps hold per block with a skewed pool', () => {
  const per = fullPool(50); per.neuro = 400;
  const pool = mkPool(per);
  const p = Q.planRandomCapped(pool, 80, 40, { rand: seeded(4) });
  assert.equal(p.keys.length, 80);
  assert.deepEqual(p.notes, []);
  p.blocks.forEach((b, i) => {
    assert.equal(b[1] - b[0], 40);
    BP.rows.forEach(r => assert.ok((p.perBlock[i][r.id] || 0) <= capOfRow(r.id, 40), r.id));
  });
  assert.equal(p.perBlock[0].neuro, 4);
});

test('planRandomCapped: second pass fills with a note, big n returns everything', () => {
  const pool = mkPool({ neuro: 60 });
  const p = Q.planRandomCapped(pool, 40, 40, { rand: seeded(8) });
  assert.equal(p.keys.length, 40);
  assert.ok(p.notes.some(t => /Cap raised for Neuro/.test(t)), p.notes.join('|'));
  const all = Q.planRandomCapped(mkPool(fullPool(2)), 500, 40, { rand: seeded(8) });
  assert.equal(all.keys.length, 28);
  assert.equal(new Set(all.keys).size, 28);
  const linked = Q.planRandomCapped([{ keys: ['a', 'b', 'c'], row: 'cardio', sci: [] }, { keys: ['d'], row: 'gi', sci: [] }], 4, 40, { rand: seeded(1) });
  assert.equal(linked.keys.length, 4);
  const i = linked.keys.indexOf('a'); assert.deepEqual(linked.keys.slice(i, i + 3), ['a', 'b', 'c']);
});

test('planners: a linked set bigger than the count is taken whole (legacy rule), never an empty test', () => {
  const set = { keys: ['a', 'b', 'c', 'd', 'e'], row: null, sci: [] };
  for (const f of ['planMix', 'planRandomCapped']) {
    const p = Q[f]([set], 2, 40, {});
    assert.deepEqual(p.keys, ['a', 'b', 'c', 'd', 'e'], f); assert.deepEqual(p.blocks, [[0, 5]], f); assert.match(p.notes[0], /Linked set kept whole/);
    assert.equal(Q[f]([], 2, 40, {}).keys.length, 0, f + ' empty pool stays empty');
  }
});

test('facets scopeBanks (facetRules.systemsBySubject): systems follow the selected subjects, hidden not zero', () => {
  const B = (key, bank, subject, system) => ({ key, bank, subject, system, status: 'unused', marked: false });
  const hy = [B('h1', 'qb-hy', 'HY Ethics', 'Ethics  - Block 1'), B('h2', 'qb-hy', 'HY Ethics', 'Ethics  - Block 2'),
    B('h3', 'qb-hy', 'Concepts', 'Cardiology'), B('h4', 'qb-hy', 'Concepts', 'Unassigned'), B('h5', 'qb-hy', 'Days', 'Day 1 - Cardio')];
  const all = Q.facets(hy, { statuses: null, subjects: null, scopeBanks: ['qb-hy'] });
  assert.equal(all.scoped, false, 'no subject selection: nothing hidden');
  assert.equal(all.systems.length, 5);
  const eth = Q.facets(hy, { statuses: null, subjects: ['HY Ethics'], scopeBanks: ['qb-hy'] });
  assert.equal(eth.scoped, true);
  assert.deepEqual(eth.systems, ['Ethics  - Block 1', 'Ethics  - Block 2']);
  assert.deepEqual(eth.sysCount, { 'Ethics  - Block 1': 1, 'Ethics  - Block 2': 1 }, 'hidden systems have no count entry');
  assert.equal(eth.avail, 2);
  const two = Q.facets(hy, { statuses: null, subjects: new Set(['Concepts', 'Days']), scopeBanks: new Set(['qb-hy']) });
  assert.deepEqual(two.systems, ['Cardiology', 'Day 1 - Cardio', 'Unassigned'], 'Unassigned stays last');
  // a stale selected system that is hidden never adds to the pool
  assert.equal(Q.facets(hy, { statuses: null, subjects: ['HY Ethics'], systems: ['Cardiology', 'Ethics  - Block 1'], scopeBanks: ['qb-hy'] }).avail, 1);
  // empty subject selection: no scoping (the list does not vanish), pool is empty as before
  const none = Q.facets(hy, { statuses: null, subjects: [], scopeBanks: ['qb-hy'] });
  assert.equal(none.scoped, false); assert.equal(none.systems.length, 5); assert.equal(none.avail, 0);
  // without scopeBanks the result is exactly today's
  const plain = Q.facets(hy, { statuses: null, subjects: ['HY Ethics'] });
  assert.equal(plain.scoped, false); assert.equal(plain.systems.length, 5); assert.equal(plain.sysCount.Cardiology, 0);
  const { scoped: _a, ...p1 } = plain, { scoped: _b, ...p2 } = Q.facets(hy, { statuses: null, subjects: ['HY Ethics'], scopeBanks: ['other'] });
  assert.deepEqual(p1, p2, 'a scope bank with no rows changes nothing');
  // mixed: rows of an unflagged bank keep all their systems; only the flagged bank's rows are scoped
  const mixed = hy.concat([B('n1', 'nbme', 'Internal Medicine', 'Renal & Urinary'), B('n2', 'nbme', 'Surgery', 'Cardiology')]);
  const mx = Q.facets(mixed, { statuses: null, subjects: ['HY Ethics'], scopeBanks: ['qb-hy'] });
  assert.deepEqual(mx.systems, ['Cardiology', 'Ethics  - Block 1', 'Ethics  - Block 2', 'Renal & Urinary']);
  assert.deepEqual(mx.sysCount, { Cardiology: 0, 'Ethics  - Block 1': 1, 'Ethics  - Block 2': 1, 'Renal & Urinary': 0 });
});

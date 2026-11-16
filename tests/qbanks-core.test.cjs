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

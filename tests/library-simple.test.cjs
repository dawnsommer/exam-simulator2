'use strict';
/* Simple Library (library-simple.js): the pure core (status, rows, natural order, up next, filters, signature) and the wiring.
   Behaviour in the app: tools/headless/v3-probe-library-simple.js (Local + iPad). Synthetic data only (no DATA/ reads).
   Shared by both apps: byte-identical in the Local tests/ and the iPad tests/ folder. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const find = (...c) => c.map((p) => path.join(__dirname, p)).find((p) => fs.existsSync(p));
const L = require(find('../library-simple.js'));
const local = find('../Step_Exam_Simulator_v22.14.html', '../../Step_Exam_Simulator_v22.14.html');
const ipad = find('../Step Simulator IPAD/index.html', '../index.html');

const TABS = [{ internal: 'N-Forms', label: 'NBME', color: '#3B6FE0' }, { internal: 'IM', label: 'IM', color: '#0F8B8D' }, { internal: 'UWSA', label: 'UWSA', color: '#0E7490' }];
const rec = (id, tab, summary, extra) => Object.assign({ id, displayName: id, totalQuestions: 40, _tab: tab, progressSummary: summary || {} }, extra || {});
const build = (recs, chip) => L.buildRows(recs, { tabs: TABS, tabOf: (r) => r._tab, chipOf: () => chip !== false });
const ids = (rows) => rows.map((r) => r.id);
const NOW = new Date(2026, 10, 18, 12).getTime(); // local noon

test('statusOf: done, progress (resumable, answered or flagged), new', () => {
  assert.equal(L.statusOf(rec('a', 'IM', { completed: true })), 'done');
  assert.equal(L.statusOf(rec('a', 'IM', { canResume: true })), 'progress');
  assert.equal(L.statusOf(rec('a', 'IM', { answered: 3 })), 'progress');
  assert.equal(L.statusOf(rec('a', 'IM', { inProgress: true })), 'progress');
  assert.equal(L.statusOf(rec('a', 'IM', {})), 'new');
  assert.equal(L.statusOf({ id: 'x' }), 'new');
  assert.equal(L.statusOf(rec('a', 'IM', { completed: true, canResume: true })), 'done'); // finished, with a retake under way: still done
});

test('natural order: NBME 9 before NBME 10, case and padding ignored', () => {
  assert.deepEqual(['NBME 10', 'NBME 9', 'nbme 11', 'NBME 2'].sort(L.natCmp), ['NBME 2', 'NBME 9', 'NBME 10', 'nbme 11']);
  assert.ok(L.natCmp('C-IM-03', 'C-IM-10') < 0);
});

test('buildRows: the user\u2019s tab order first, natural name order inside a tab, unknown tabs last', () => {
  const rows = build([rec('IM 2', 'IM'), rec('NBME 10', 'N-Forms'), rec('Odd', 'Weird'), rec('NBME 9', 'N-Forms'), rec('UWSA 1', 'UWSA'), rec('IM 10', 'IM')]);
  assert.deepEqual(ids(rows), ['NBME 9', 'NBME 10', 'IM 2', 'IM 10', 'UWSA 1', 'Odd']);
  assert.equal(rows[0].tabLabel, 'NBME');
  assert.equal(rows[5].tabLabel, 'Weird');
});

test('toRow: progress, block, score, 3-digit chip and the one action per status', () => {
  const p = L.toRow(rec('A', 'IM', { canResume: true, answered: 10, total: 40, progressPct: 25, currentBlockPointer: 1, blockCount: 4, updatedAt: '2026-11-17T10:00:00Z' }), { tab: 'IM', chip: true });
  assert.deepEqual([p.st, p.action, p.pct, p.blockNow, p.blockCount, p.suspended], ['progress', 'resume', 25, 2, 4, false]);
  const sus = L.toRow(rec('A', 'IM', { canResume: true, suspended: true, answered: 5, total: 40 }), {});
  assert.deepEqual([sus.suspended, sus.pct, sus.blockNow, sus.blockCount], [true, 13, 1, 1]); // % from answered/total when the summary has none
  const d = L.toRow(rec('B', 'N-Forms', { completed: true, scorePct: 78, scoreCorrect: 31, scoreTotal: 40, completedAt: '2026-11-10T09:00:00Z', answered: 40 }, { threeDigitScore: '245' }), { chip: true });
  assert.deepEqual([d.st, d.action, d.scorePct, d.three, d.date], ['done', 'review', 78, '245', '2026-11-10T09:00:00Z']);
  const noChip = L.toRow(rec('B', 'IM', { completed: true, scorePct: 78 }, { threeDigitScore: '245' }), { chip: false });
  assert.equal(noChip.three, '', 'the score chip follows the tab\u2019s chip setting');
  const n = L.toRow(rec('C', 'IM', {}), {});
  assert.deepEqual([n.st, n.action, n.date, n.pct, n.scorePct], ['new', 'start', '', 0, null]);
  const over = L.toRow(rec('D', 'IM', { canResume: true, currentBlockPointer: 9, blockCount: 4 }), {});
  assert.equal(over.blockNow, 4, 'block never past the last one');
  assert.equal(L.toRow(rec('E', 'IM', { canResume: true, answered: 3 }, { questionIndex: [{ blockIndex: 0 }, { blockIndex: 2 }] }), {}).blockCount, 3, 'block count from the question index when the summary has none');
  assert.equal(L.toRow({ id: 'F', displayName: '', progressSummary: null }, {}).title, 'F');
});

test('pickUpNext: latest resumable attempt, else the first not-started form in list order, else review latest, else nothing', () => {
  const rows = build([
    rec('NBME 9', 'N-Forms', { completed: true, scorePct: 70, completedAt: '2026-11-01T00:00:00Z' }),
    rec('NBME 10', 'N-Forms', {}),
    rec('IM 1', 'IM', { canResume: true, answered: 4, updatedAt: '2026-11-15T00:00:00Z' }),
    rec('IM 2', 'IM', { canResume: true, answered: 4, updatedAt: '2026-11-17T00:00:00Z' }),
    rec('UWSA 1', 'UWSA', { completed: true, scorePct: 80, completedAt: '2026-11-09T00:00:00Z' })
  ]);
  const a = L.pickUpNext(rows); assert.deepEqual([a.kind, a.row.id, a.more], ['resume', 'IM 2', 1]);
  const b = L.pickUpNext(rows.filter((r) => !r.canResume)); assert.deepEqual([b.kind, b.row.id], ['start', 'NBME 10']);
  const c = L.pickUpNext(rows.filter((r) => r.st === 'done')); assert.deepEqual([c.kind, c.row.id], ['review', 'UWSA 1']); // latest finished
  assert.equal(L.pickUpNext([]), null);
  // a suspended attempt counts, and a finished form with a retake under way is resumed
  const r2 = build([rec('X', 'IM', { completed: true, canResume: true, updatedAt: '2026-11-17T00:00:00Z' })]);
  assert.equal(L.pickUpNext(r2).kind, 'resume');
});

test('summarize / statusLine: done of total, in progress, weighted average', () => {
  const rows = build([
    rec('A', 'IM', { completed: true, scorePct: 50, scoreCorrect: 10, scoreTotal: 20 }),
    rec('B', 'IM', { completed: true, scorePct: 90, scoreCorrect: 36, scoreTotal: 40 }),
    rec('C', 'IM', { canResume: true, answered: 2 }), rec('D', 'IM', {})
  ]);
  const s = L.summarize(rows);
  assert.deepEqual([s.total, s.done, s.progress, s.fresh, s.avg], [4, 2, 1, 1, 77]); // 46 of 60
  assert.equal(L.statusLine(s), '2 of 4 forms done · 1 in progress · avg 77%');
  assert.equal(L.statusLine(L.summarize(build([rec('A', 'IM', {})]))), '0 of 1 form done');
  assert.equal(L.statusLine(L.summarize([])), 'No forms yet');
  assert.equal(L.summarize(build([rec('A', 'IM', { completed: true, scorePct: 61 }), rec('B', 'IM', { completed: true, scorePct: 70 })])).avg, 66); // no counts: mean of the %
  assert.equal(L.summarize(build([rec('A', 'IM', {})])).avg, null);
});

test('filters: tab, status and search combine; counts ignore only the status', () => {
  const rows = build([
    rec('NBME 9', 'N-Forms', { completed: true, scorePct: 70 }), rec('NBME 10', 'N-Forms', {}), rec('NBME 11', 'N-Forms', { canResume: true, answered: 1 }),
    rec('IM 1', 'IM', { completed: true, scorePct: 80 }), rec('IM 2', 'IM', {}), rec('UWSA 1', 'UWSA', {}, { displayName: 'UWSA Form One' })
  ]);
  assert.equal(L.filterRows(rows, {}).length, 6);
  assert.equal(L.filterRows(rows, { tab: 'All', status: 'all', q: '' }).length, 6);
  assert.deepEqual(ids(L.filterRows(rows, { tab: 'N-Forms' })), ['NBME 9', 'NBME 10', 'NBME 11']);
  assert.deepEqual(ids(L.filterRows(rows, { tab: 'N-Forms', status: 'new' })), ['NBME 10']);
  assert.deepEqual(ids(L.filterRows(rows, { status: 'done' })), ['NBME 9', 'IM 1']);
  assert.deepEqual(ids(L.filterRows(rows, { q: 'nbme 1' })), ['NBME 10', 'NBME 11']);
  assert.deepEqual(ids(L.filterRows(rows, { q: 'form one' })), ['UWSA 1'], 'every word must match');
  assert.deepEqual(ids(L.filterRows(rows, { q: 'im' })), ['IM 1', 'IM 2'], 'matches the tab name too');
  assert.deepEqual(ids(L.filterRows(rows, { q: 'uwsa' })), ['UWSA 1']);
  assert.deepEqual(L.filterRows(rows, { q: 'zzz' }), []);
  assert.deepEqual(L.statusCounts(rows, { tab: 'All' }), { all: 6, new: 3, progress: 1, done: 2 });
  assert.deepEqual(L.statusCounts(rows, { tab: 'N-Forms' }), { all: 3, new: 1, progress: 1, done: 1 });
  assert.deepEqual(L.statusCounts(rows, { tab: 'All', q: 'im' }), { all: 2, new: 1, progress: 0, done: 1 });
  assert.deepEqual(L.tabCounts(rows), { All: 6, 'N-Forms': 3, IM: 2, UWSA: 1 });
});

test('groupRows: one group per tab in row order', () => {
  const g = L.groupRows(build([rec('IM 2', 'IM'), rec('NBME 9', 'N-Forms'), rec('IM 1', 'IM')]));
  assert.deepEqual(g.map((x) => [x.tab, x.label, ids(x.rows)]), [['N-Forms', 'NBME', ['NBME 9']], ['IM', 'IM', ['IM 1', 'IM 2']]]);
  assert.deepEqual(L.groupRows([]), []);
});

test('relDate: Today, Yesterday, N days ago, then a date (year only when it differs)', () => {
  assert.equal(L.relDate('2026-11-18T01:00:00', NOW), 'Today');
  assert.equal(L.relDate('2026-11-17T23:00:00', NOW), 'Yesterday');
  assert.equal(L.relDate('2026-11-15T08:00:00', NOW), '3 days ago');
  assert.equal(L.relDate('2026-11-05T08:00:00', NOW), 'Nov 5');
  assert.equal(L.relDate('2025-03-09T08:00:00', NOW), 'Mar 9, 2025');
  assert.equal(L.relDate('', NOW), '');
  assert.equal(L.relDate('not a date', NOW), '');
});

test('signature: same data = same string; any drawn field, filter or the day changes it', () => {
  const mk = (over) => ({ rows: build([rec('A', 'IM', Object.assign({ canResume: true, answered: 3, total: 40, blockCount: 2 }, over || {}))]), tabs: TABS });
  const st = { tab: 'All', status: 'all', q: '' };
  const base = L.signature(mk(), st, 'Wed Nov 18 2026');
  assert.equal(L.signature(mk(), Object.assign({}, st), 'Wed Nov 18 2026'), base);
  assert.notEqual(L.signature(mk({ progressPct: 90 }), st, 'Wed Nov 18 2026'), base, 'progress');
  assert.notEqual(L.signature(mk({ currentBlockPointer: 1 }), st, 'Wed Nov 18 2026'), base, 'block');
  assert.notEqual(L.signature(mk({ suspended: true }), st, 'Wed Nov 18 2026'), base, 'suspended');
  assert.notEqual(L.signature(mk({ updatedAt: '2026-11-17T00:00:00Z' }), st, 'Wed Nov 18 2026'), base, 'date');
  assert.notEqual(L.signature(mk(), Object.assign({}, st, { status: 'done' }), 'Wed Nov 18 2026'), base, 'status filter');
  assert.notEqual(L.signature(mk(), Object.assign({}, st, { tab: 'IM' }), 'Wed Nov 18 2026'), base, 'tab filter');
  assert.notEqual(L.signature(mk(), Object.assign({}, st, { q: 'a' }), 'Wed Nov 18 2026'), base, 'search');
  assert.notEqual(L.signature(mk(), st, 'Thu Nov 19 2026'), base, 'midnight rolls "Today" over');
  assert.notEqual(L.signature({ rows: mk().rows, tabs: [{ internal: 'IM', label: 'IM', color: '#000' }] }, st, 'Wed Nov 18 2026'), base, 'tab colour');
});

test('wiring: Classic is the default, the module only toggles a class on the library panel, window API is exposed', () => {
  const src = fs.readFileSync(find('../library-simple.js'), 'utf8');
  assert.match(src, /localStorage\['thunderLibrary\.style'\]|STYLE_KEY = 'thunderLibrary\.style'/);
  assert.match(src, /getStyle = \(\) => \(ls\.get\(STYLE_KEY\) === 'simple' \? 'simple' : 'classic'\)/);
  assert.match(src, /tu-lib-simple/);
  assert.match(src, /window\.ThunderLibrarySimple = \{ version: 1, mountSetting, setStyle, getStyle, refresh/);
  assert.match(src, /data-tu-mount="libstyle"/);
  // read-only: it never calls a bridge write and never prints question text
  assert.doesNotMatch(src, /StepLibraryBridge\.(set|save|write|delete)|B\.(set|save|write|delete)\w*\(/);
  assert.doesNotMatch(src, /\.stem|questionText|explanation/i);
  assert.doesNotMatch(src, /\bconst (CSS|Image|URL|Node|Event)\b/, 'a constant must not shadow a browser global');
});

test('both apps load library-simple.js last; the iPad shell lists it; Local/iPad copies are byte-identical', () => {
  const l = fs.readFileSync(local, 'utf8'), i = fs.readFileSync(ipad, 'utf8');
  assert.ok(l.indexOf('<script src="./library-simple.js"></script>') > l.indexOf('<script src="./thunder-ui.js"></script>'));
  assert.equal((l.match(/library-simple\.js/g) || []).length, 1);
  const at = (f) => i.search(new RegExp('<script src="\\./' + f.replace('.', '\\.') + '\\?v=\\d+"></script>'));
  assert.ok(at('library-simple.js') > at('thunder-ui.js') && at('thunder-ui.js') > 0);
  assert.equal((i.match(/library-simple\.js/g) || []).length, 1);
  const root = path.dirname(ipad);
  for (const f of ['sw.js', 'app-update.js']) assert.ok(fs.readFileSync(path.join(root, f), 'utf8').includes('"./library-simple.js?v='), f);
  assert.ok(fs.readFileSync(path.join(root, 'tools', 'publish.mjs'), 'utf8').includes("'library-simple.js'"), 'publish.mjs ships it');
  assert.equal(fs.readFileSync(path.join(root, 'library-simple.js'), 'utf8'), fs.readFileSync(path.join(path.dirname(local), 'library-simple.js'), 'utf8'));
});

test('tabs with 0 forms are hidden; a remembered empty tab falls back to All', () => {
  const rows = [{ tab: 'IM' }, { tab: 'IM' }, { tab: 'UWSA' }];
  const tabs = [{ internal: 'N-Forms' }, { internal: 'IM' }, { internal: 'Surg' }, { internal: 'UWSA' }];
  assert.deepEqual(L.visibleTabs(tabs, rows).map((t) => t.internal), ['IM', 'UWSA']);
  assert.equal(L.effectiveTab('Surg', tabs, rows), 'All');
  assert.equal(L.effectiveTab('IM', tabs, rows), 'IM');
  assert.equal(L.effectiveTab('All', tabs, rows), 'All');
});

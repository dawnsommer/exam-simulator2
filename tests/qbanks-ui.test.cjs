'use strict';
/* Qbanks UI (qbanks.js) wiring checks that do not need a browser. Behaviour is covered by tools/headless/v3-probe-qbanks-ui.js (both apps).
   Shared by both apps: byte-identical in the Local tests/ and the iPad tests/ folder. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const find = (...c) => c.map((p) => path.join(__dirname, p)).find((p) => fs.existsSync(p));
const read = (p) => fs.readFileSync(p, 'utf8');
const UI = find('../qbanks.js'), THUNDER = find('../thunder-ui.js');
const ui = read(UI), thunder = read(THUNDER);
const htmls = [find('../Step_Exam_Simulator_v22.14.html', '../../Step_Exam_Simulator_v22.14.html'), find('../Step Simulator IPAD/index.html', '../index.html')].filter(Boolean).map(read);

test('qbanks.js drives the legacy Qbank controls (start, history actions, inputs) and keeps their ids', () => {
  for (const id of ['qbankRunMode', 'qbankSourceMode', 'qbankAttemptSource', 'qbankBlockSize', 'qbankShuffle', 'qbankTestName', 'qbankQuestionCount', 'qTestFilter', 'qTestSearch', 'qbankTab', 'qbankTestsTab', 'qbankModePanel', 'qbankTestsPanel'])
    assert.ok(ui.includes("'" + id + "'"), 'drives #' + id);
  assert.ok(ui.includes('#qbankModePanel [data-v9="qbank-start"]'), 'Generate clicks the legacy Generate & Start');
  assert.ok(ui.includes('[data-v9="qbank-${act}"]'), 'history actions click the legacy card buttons');
  assert.ok(ui.includes('#qbankFormList input[data-qbank-form]'), 'bank/form limit drives the legacy form checkboxes');
  assert.ok(ui.includes('qbanksSetFilter(sel)'), 'start hands the filter to the bridge');
  for (const id of ['qbankFormList', 'qbankQuestionMode', 'qbankTestsGrid', 'qbankStats'])
    assert.doesNotMatch(ui, new RegExp('id="' + id + '"'), '#' + id + ' stays the legacy control');
});

test('thunder-ui.js stands down when ThunderQbanksUI exists and the nav says Qbanks', () => {
  assert.match(thunder, /if\(window\.ThunderQbanksUI\) return;/);
  assert.match(thunder, /qbankTab:\['Qbanks','qbank'\]/);
  assert.match(thunder, /qbankTab:'Qbanks'/);
});

test('the Qbanks view refetches when the menu comes back from an exam (numbers change after every test)', () => {
  assert.match(ui, /menu\._tqWatched/);
  assert.match(ui, /attributeFilter: \['class'\]/);
});

test('both HTMLs load qbanks-core.js before and qbanks.js after analysis.js', () => {
  for (const h of htmls) {
    const c = h.search(/<script src="\.\/qbanks-core\.js/), a = h.search(/<script src="\.\/analysis\.js/), u = h.search(/<script src="\.\/qbanks\.js/);
    assert.ok(c > 0 && a > c && u > a, 'script order core < analysis < qbanks');
  }
});

test('the Re-tag chip row is the only exam-screen addition and is guarded by the switch + untagged check', () => {
  assert.match(ui, /!S\.reviewTag\) \{ drop\(\); return; \}/);
  assert.match(ui, /qbanksExamQuestion/);
  assert.match(ui, /q\.untagged/);
});

test('Settings > Qbanks: thunder-ui supplies #tuSetQbanks, calls mountSettings after paint, label is Qbanks, defaults rows stay (inline, no Edit)', () => {
  assert.match(thunder, /\['qbank', 'Qbanks'\]/);
  assert.match(thunder, /SET_LEGACY = \{library:'library', qbank:'qbank'/);
  assert.match(thunder, /id="tuSetQbanks"/);
  assert.match(thunder, /ThunderQbanksUI\.mountSettings\(h\)/);
  for (const hook of ['data-tu-setsw="setLinkQbank"', 'data-tu-defmode', 'data-tu-step="${id}"', "step('setDefaultSpq'", "step('setDefaultBlock'", 'data-tu-reset', 'Qbank reads form attempts but never changes them.']) assert.ok(thunder.includes(hook), 'defaults row kept: ' + hook);
  assert.match(thunder, /openSettings:openSettingsSection/);
});

test('mountSettings is idempotent: paints from cache, fetches banks once, never asks Settings to repaint', () => {
  assert.match(ui, /function mountSettings\(host\)/);
  assert.match(ui, /host\._tq/);                       // one listener per host element
  assert.match(ui, /!setFetching/);                    // one banks read at a time
  assert.match(ui, /ST\.det\[id\] \|\| ST\.load\[id\]/); // details cached per bank id
  assert.match(ui, /function invalDet/);
  const body = ui.slice(ui.indexOf('function mountSettings'), ui.indexOf('function onSetHostClick'));
  assert.doesNotMatch(body, /scheduleSettings|ThunderUI\.refresh/, 'no repaint request back to thunder-ui');
  for (const f of ['finishImport', 'bankAct']) assert.ok(ui.slice(ui.indexOf('function ' + f)).slice(0, 1800).includes('invalDet('), f + ' drops cached details');
});

test('bank rows and details: Built-in / Imported chip, tiles, files, Choice %, actions, feature-detected bridge calls', () => {
  for (const s of ["'Imported' : 'Built-in'", 'qbanksBankDetails', 'qbanksExportBank', 'Choice %', 'Export ZIP', 'Add files', 'data-a="rename"', 'data-a="delbank"', 'data-a="retag"', 'Questions\')', 'Untagged\')', 'Storage\')'])
    assert.ok(ui.includes(s), 'has ' + s);
  assert.match(ui, /typeof B\.qbanksBankDetails === 'function'/);
  assert.match(ui, /typeof bridge\(\)\.qbanksExportBank === 'function'/);
  assert.match(ui, /a\.download = name/);   // same a[download] save the iPad Progress ZIP export uses
});

test('Qbanks tab v2: three view tabs, no Import/Manage entry points in the tab, a Manage in Settings link, import sheet kept for Settings', () => {
  const head = ui.slice(ui.indexOf('function headHtml'), ui.indexOf('function rowHtml'));
  assert.match(head, /\['create', 'Create test'/); assert.match(head, /\['history', 'Previous tests'/); assert.match(head, /\['performance', 'Performance'/);
  assert.doesNotMatch(head, /Manage banks|data-a="import"|tq-imp|<b>Import a Qbank<\/b>/, 'no Import button / card / Manage tab in the tab');
  assert.doesNotMatch(ui, /function manageHtml|Manage banks in Settings → Qbanks/);
  assert.match(head, /data-a="opensettings"[^>]*>.*Manage in Settings/);
  assert.match(head, /typeof T\.openSettings === 'function'/, 'link is feature-detected');
  assert.match(ui, /T\.openSettings\('qbank'\)/);
  assert.match(ui, /if \(S\.tab !== 'history' && S\.tab !== 'performance'\) S\.tab = 'create'/, 'a saved banks tab falls back to create');
  assert.match(ui, /function openImport/); assert.match(ui, /data-a="import" data-into=/, 'Settings still imports');
});

test('Create builder v2: bank cards, quick start row, facet columns/switch, +N more, count stepper (no range slider), collapsed name', () => {
  for (const s of ['role="${S.combine ? \'checkbox\' : \'radio\'}" aria-checked="${on}" data-a="bank"', 'data-a="combine"', 'Pick a Qbank', 'banks combined', 'class="tq-meter"', 'function progressHtml', 'data-r="progress"', "'new'", 'class="tq-qs">Quick start', 'data-a="preset"', 'data-a="facet"', "data-a=\"more\"", 'data-a="cdec"', 'data-a="cinc"', 'data-a="cmax"', 'data-a="countn"', 'data-a="nameopen"', 'data-a="name"', 'data-a="allsub"', 'data-a="allsys"', '@container tqb'])
    assert.ok(ui.includes(s), 'has ' + s);
  assert.doesNotMatch(ui, /data-a="count"|type="range"/, 'range slider is gone');
  assert.match(ui, /facet: P\.facet === 'sys'/); assert.match(ui, /facet: S\.facet/, 'facet is saved in prefs');
  assert.doesNotMatch(ui.slice(ui.indexOf('function savePrefs'), ui.indexOf('let D = null')), /more|nameOpen/, 'expand state is not saved');
});

test('Previous tests shows every test (bank filter chip row, not S.sel); Performance uses the shared bank cards and selection', () => {
  const hist = ui.slice(ui.indexOf('function testsFiltered'), ui.indexOf('function historyHtml'));
  assert.doesNotMatch(hist, /S\.sel/, 'history ignores the Create bank selection');
  assert.match(hist, /S\.hb/);
  assert.match(ui, /data-a="hb"|bankChips\('hb'/); assert.doesNotMatch(ui, /bankChips\('pb'|S\.pb\b/, 'old Performance filter chips are gone');
  const perf = ui.slice(ui.indexOf('function perfModel'), ui.indexOf('function perfHtml'));
  assert.match(perf, /core\(\)\.facets\(/); assert.match(ui, /function perfIds\(\) \{ return \[\.\.\.S\.sel\]; \}/, 'Performance follows the shared selection');
  assert.match(ui, /else if \(S\.tab === 'performance'\) \{ banks = banksHtml\(\);/, 'Performance draws the same cards + Combine switch + progress card');
});

test('import sheet v2: step 1 summary, values from pv.values, manifest prefill, no local ZIP re-read or 80 MB cap', () => {
  for (const s of ['tqPvOk', 'tqPvManifest', 'tqPvFiles', 'tqPvMissing', 'missingImages', 'pv.manifest', 'mf.name', 'mf.code', 'mf.color', 'pv.values', 'go2', 'tq-badfiles'])
    assert.ok(ui.includes(s), 'has ' + s);
  assert.doesNotMatch(ui, /localQuestions|80 \* 1024 \* 1024|JSZip\.loadAsync/);
});

test('bank cards: single select by default, Combine toggles, last bank stays, order numbers, no tick marks; progress card follows the status source', () => {
  const card = ui.slice(ui.indexOf('function bankCard'), ui.indexOf('function banksHtml'));
  assert.doesNotMatch(card, /tick/, 'cards have no tick marks');
  assert.match(card, /tq-ord/, 'combined cards show an order number');
  assert.match(ui, /combine: P\.combine === true \|\| \(Array\.isArray\(P\.sel\) && P\.sel\.length > 1\)/, 'saved multi-bank selection turns Combine on');
  assert.match(ui, /JSON\.stringify\(\{ sel: S\.savedSel, hidden: \[\.\.\.S\.hidden\], combine: S\.combine/, 'selection, hidden banks and combine are saved');
  const click = ui.slice(ui.indexOf("case 'bank': {"), ui.indexOf("case 'mode':"));
  assert.match(click, /if \(!S\.combine\) \{ S\.sel = new Set\(\[v\]\)/, 'single click selects only that bank');
  assert.match(click, /S\.sel\.size > 1\) S\.sel\.delete/, 'cannot deselect the last bank');
  assert.match(click, /S\.lastBank/, 'Combine off keeps the last clicked bank');
  assert.doesNotMatch(ui.slice(ui.indexOf('function pick('), ui.indexOf('function goTab')), /S\.sel =/, 'perf pick keeps the selection');
  const prog = ui.slice(ui.indexOf('function progressHtml'), ui.indexOf('function rowHtml'));
  assert.match(prog, /r\.status === 'correct'/); assert.match(prog, /D\.tests\.filter/); assert.match(prog, /when\(last\)/);
});

/* remembered selection: run the real reconcileSel/savePrefs in a sandbox */
test('saved bank pick survives an empty or partial bank list at start-up and hidden banks', () => {
  const vm = require('node:vm');
  const src = ui.slice(ui.indexOf('const selKey'), ui.indexOf('let D = null;')) + ui.slice(ui.indexOf('function visBanks'), ui.indexOf('function markStale'));
  const mk = (sel, hidden) => { const store = { 'k': JSON.stringify({ sel, hidden }) };
    const ctx = { KEY: 'k', root: { localStorage: { getItem: k => store[k], setItem: (k, v) => { store[k] = v; } } }, store, D: null };
    ctx.S = { sel: new Set(sel), savedSel: sel.slice(), selFallback: '', hidden: new Set(hidden || []), combine: sel.length > 1, statuses: new Set(), sort: 'az', facet: 'sub', reviewTag: true, mode: 'tutor', secs: 90, track: '', attempt: '', pull: 'mix' };
    vm.createContext(ctx); vm.runInContext(src + ';this.reconcileSel=reconcileSel;this.savePrefs=savePrefs;this.setD=d=>{D=d};', ctx); return ctx; };
  const banks = ids => ({ banks: ids.map(id => ({ id })) });
  const c = mk(['MEH']);
  c.setD(banks([])); c.reconcileSel(); assert.deepEqual([...c.S.sel], [], 'empty list keeps nothing shown');
  c.setD(banks(['NBME', 'CMS'])); c.reconcileSel(); assert.deepEqual([...c.S.sel], ['NBME'], 'partial list shows the first bank');
  c.savePrefs(); assert.deepEqual(JSON.parse(c.store.k).sel, ['MEH'], 'an unrelated save keeps the saved pick');
  c.setD(banks(['NBME', 'CMS', 'MEH'])); c.reconcileSel(); assert.deepEqual([...c.S.sel], ['MEH'], 'saved pick comes back when the bank appears');
  const h = mk(['CMS', 'MEH'], ['MEH']); h.setD(banks(['NBME', 'CMS', 'MEH'])); h.reconcileSel(); assert.deepEqual([...h.S.sel], ['CMS'], 'hidden bank leaves the pick');
  h.S.hidden.delete('MEH'); h.reconcileSel(); assert.deepEqual([...h.S.sel].sort(), ['CMS', 'MEH'], 'shown again: it returns');
  const all = mk(['CMS'], ['NBME', 'CMS']); all.setD(banks(['NBME', 'CMS'])); all.reconcileSel(); assert.deepEqual([...all.S.sel], ['CMS'], 'everything hidden falls back to showing all');
});

/* ---- Exam mix: "Question order" control (pull = mix | random | order) ---- */
const vm = require('node:vm');
function loadUi(saved) {
  const root = { document: { readyState: 'loading', addEventListener() {}, getElementById: () => null }, localStorage: { getItem: () => (saved == null ? null : JSON.stringify(saved)), setItem() {} } };
  root.window = root; root.setTimeout = () => 0; root.console = console;
  root.ThunderQbanksCore = { BLUEPRINT_STEP2: { rows: [{ id: 'social', short: 'Ethics' }, { id: 'renal', short: 'Renal/Repro' }, { id: 'cardio', short: 'Cardio' }, { id: 'msk', short: 'MSK/Skin' }, { id: 'behav', short: 'Behavioral' }, { id: 'blood', short: 'Blood/Immune' }, { id: 'gi', short: 'GI' }, { id: 'neuro', short: 'Neuro' }] } };
  vm.runInNewContext(ui.replace('_state: S', '_state: S, _t: { pvInner, pullSub, PV, PULL_OPTS, PULL_LABEL }'), root);
  return root.ThunderQbanksUI;
}

test('S.pull migration: saved pull wins, else saved shuffle true to Random / false to Form order, nothing saved to Exam mix', () => {
  for (const [saved, want] of [[null, 'mix'], [{}, 'mix'], [{ sel: ['x'] }, 'random'], [{ pull: 'order' }, 'order'], [{ pull: 'random', shuffle: false }, 'random'], [{ shuffle: true }, 'random'], [{ shuffle: false }, 'order'], [{ pull: 'bogus', shuffle: false }, 'order'], [{ pull: 'bogus' }, 'random']])
    assert.equal(loadUi(saved)._state.pull, want, JSON.stringify(saved));
  assert.match(ui.slice(ui.indexOf('function savePrefs'), ui.indexOf('let D = null')), /pull: S\.pull/, 'pull is saved');
});

test('Question order segment: 3 radios with data-a="pull" and data-v, phone short labels, aria-checked follows S.pull, sub-line per mode', () => {
  const U = loadUi({ pull: 'random' }), T = U._t;
  assert.deepEqual(Array.from(T.PULL_OPTS, (o) => o.join('|')), ['mix|Exam mix|Mix', 'random|Random|Random', 'order|Form order|Order']);
  assert.ok(ui.includes('role="radiogroup" aria-labelledby="tqPullL"') && ui.includes('aria-checked="${S.pull === k}"') && ui.includes('data-a="pull" data-v="${k}"'));
  assert.ok(ui.includes('<span class="tq-wl">${l}</span><span class="tq-wn">${w}</span>'), 'long + short label spans (swap at max-width 640)');
  assert.doesNotMatch(ui, /<b>Shuffle<\/b>/, 'Shuffle switch is gone');
  U._state.perBlock = 40; U._state.pull = 'mix'; assert.equal(T.pullSub(), 'USMLE Step 2 CK spread · 40 per block');
  U._state.pull = 'random'; assert.equal(T.pullSub(), 'Random, no system over its USMLE max');
  U._state.pull = 'order'; assert.equal(T.pullSub(), 'In form order');
});

test('start() hands pull to the filter and keeps the legacy qbankShuffle; legacy shuffle case toggles Random / Form order; sim preset is Exam mix', () => {
  const start = ui.slice(ui.indexOf('async function start()'), ui.indexOf('/* ---------- events'));
  assert.match(start, /setLegacy\('qbankShuffle', S\.pull !== 'order'\)/);
  assert.ok(start.indexOf('sel.pull = S.pull') > 0 && start.indexOf('sel.pull = S.pull') < start.indexOf('B.qbanksSetFilter(sel)'), 'pull is on sel before qbanksSetFilter');
  assert.match(ui, /case 'pull':/); assert.match(ui, /case 'shuffle': S\.pull = S\.pull === 'order' \? 'random' : 'order'/);
  assert.match(ui.slice(ui.indexOf('function applyPreset'), ui.indexOf('function toggleIn')), /PULLS\.includes\(a\.pull\)[^;]*;[^;]*p\.id === 'sim'\) S\.pull = 'mix'/);
});

test('"This block" preview: stacked bar, up to 6 items + "+N more", notes as .tq-hint; empty for Form order or no plan; qbanksPlan is guarded and debounced', () => {
  const U = loadUi(null), T = U._t, S = U._state;
  assert.equal(T.pvInner(), '', 'no plan yet: nothing');
  T.PV.res = { pull: 'mix', perBlock: { social: 5, renal: 4, cardio: 4, msk: 4, behav: 3, blood: 3, gi: 3, neuro: 3, zero: 0 }, notes: ['Only 2 Neuro questions left <b>'], available: 100 };
  const h = T.pvInner();
  assert.match(h, /This block/); assert.match(h, /class="tq-pvbar"/);
  assert.equal((h.match(/<span><b>/g) || []).length, 6, 'max 6 items'); assert.match(h, /<b>Ethics<\/b> 5/); assert.match(h, /\+2 more/);
  assert.equal((h.match(/<i style=/g) || []).length, 8, 'bar has a segment per non-empty row');
  assert.match(h, /<div class="tq-hint">[\s\S]*Only 2 Neuro questions left &lt;b&gt;/, 'notes escaped, warning style');
  S.pull = 'order'; assert.equal(T.pvInner(), '');
  const sp = ui.slice(ui.indexOf('function schedulePlan'), ui.indexOf('/* ---------- small helpers'));
  assert.match(sp, /typeof B\.qbanksPlan !== 'function'/); assert.match(sp, /setTimeout/); assert.match(sp, /n !== PV\.seq\) return/, 'stale answers ignored');
  assert.match(sp, /await B\.qbanksPlan\(sel, Math\.max\(1, m\.count\), Math\.max\(1, S\.perBlock\)\)/);
  assert.match(ui, /schedulePlan\(S\.tab === 'create'/, 'render schedules, never awaits');
});

test('Previous tests chip from test.qbankPullMode (Exam mix / Random / Form order) and token-only styling', () => {
  const hist = ui.slice(ui.indexOf('function historyHtml'), ui.indexOf('/* performance */'));
  assert.match(hist, /PULL_LABEL\[t\.qbankPullMode\]/); assert.match(hist, /class="tq-pchip"/);
  assert.equal(JSON.stringify(loadUi(null)._t.PULL_LABEL), JSON.stringify({ mix: 'Exam mix', random: 'Random', order: 'Form order' }));
  const css = ui.split('\n').filter((l) => /tq-pull|tq-pv|tq-pchip/.test(l) && /^\$\{R\}/.test(l)).join('\n');
  assert.ok(css.length > 200); assert.doesNotMatch(css, /#[0-9a-fA-F]{3,6}\b/, 'no raw colours: --q-* tokens only');
});

test('Settings show/hide: switch per bank row (outside the expand button), Show all, last shown bank stays, cards use visBanks()', () => {
  const row = ui.slice(ui.indexOf('function setBankHtml'), ui.indexOf('function settingsHtml'));
  assert.match(row, /role="switch" aria-checked="\$\{shown\}"[^>]*data-a="svis"/);
  assert.ok(row.indexOf('data-a="svis"') > row.indexOf('</button>'), 'switch is not nested in the row button');
  assert.match(ui, /data-a="sviall"/);
  const sv = ui.slice(ui.indexOf('function setVisible'), ui.indexOf('function saveBlob'));
  assert.match(sv, /<= 1\) \{ toast\('Keep at least one bank shown'\)/);
  assert.match(sv, /reconcileSel\(\); resetFacets\(\); savePrefs\(\); render\(\)/);
  assert.match(ui.slice(ui.indexOf('function banksHtml'), ui.indexOf('function progressHtml')), /visBanks\(\)\.map\(b => bankCard/);
});

test('System facet follows the subjects for banks with facetRules.systemsBySubject (and only those)', () => {
  assert.ok(ui.includes("b.facetRules && b.facetRules.systemsBySubject === true"), 'scope banks come from the bank record');
  assert.ok(ui.includes('scopeBanks: scope'), 'model() passes the scope to facets()');
  assert.ok(/if \(scope\.length && S\.syss\) \{/.test(ui), 'filter sync runs only when a flagged bank is selected');
});

/* ---- Systems follow subjects (Settings switch) ---- */
const rowsOf = (bank, list) => list.map(([subject, system], i) => ({ bank, formId: 'f', qid: bank + i, subject, system, status: 'unused' }));
const settingsCtx = (banks, rows) => {
  const T = mkRoot({}).ThunderQbanksUI._test;
  T.setD({ banks, forms: [], rows, prov: {}, tests: [] }); return T;
};
test('scopeFit: subjects, systems, single-subject systems; Unassigned ignored; one-subject bank', () => {
  const T = loadUi(null)._test;
  const rows = rowsOf('B', [['Medicine', 'Cardio'], ['Medicine', 'Cardio'], ['Medicine', 'Renal'], ['Surgery', 'Renal'], ['Surgery', 'Ortho'], ['Pediatrics', 'Peds only']]).concat(rowsOf('X', [['Other', 'Zzz']]));
  assert.deepEqual({ ...T.scopeFit(rows, 'B', false) }, { subjects: 3, systems: 4, single: 3, suggested: true }, 'Renal spans two subjects; other bank ignored');
  const un = rows.concat(rowsOf('B', [['Unassigned', 'Cardio'], ['Medicine', 'Unassigned'], ['Unassigned', 'Unassigned']]));
  assert.deepEqual({ ...T.scopeFit(un, 'B', false) }, { subjects: 3, systems: 4, single: 3, suggested: true }, 'Unassigned adds nothing on either side');
  const one = T.scopeFit(rowsOf('B', [['Medicine', 'A'], ['Medicine', 'B'], ['Medicine', 'C']]), 'B', false);
  assert.equal(one.subjects, 1); assert.equal(T.scopeHint(one), 'This bank has one subject, so there is nothing to scope.');
  assert.equal(T.scopeHint(T.scopeFit(rows, 'B', false)), '3 of 4 systems here belong to one subject.');
  const oneSys = T.scopeFit(rowsOf('B', [['M', 'A'], ['S', 'A']]), 'B', false); assert.equal(oneSys.suggested, false); assert.match(T.scopeHint(oneSys), /nothing to scope/);
  assert.deepEqual({ ...T.scopeFit([], 'B', false) }, { subjects: 0, systems: 0, single: 0, suggested: false });
});
test('Suggested rule: at least 60% of systems in one subject, only while the switch is off', () => {
  const T = loadUi(null)._test;
  const mk = (n, of) => { const l = []; for (let i = 0; i < of; i++) { l.push(['S' + (i < n ? i % 2 : 0), 'sys' + i]); if (i >= n) l.push(['S1', 'sys' + i]); } return rowsOf('B', l); };
  assert.equal(T.scopeFit(mk(3, 5), 'B', false).suggested, true, '3 of 5 = 60%');
  assert.equal(T.scopeFit(mk(2, 5), 'B', false).suggested, false, '2 of 5 = 40%');
  assert.equal(T.scopeFit(mk(3, 5), 'B', true).suggested, false, 'already on: not suggested');
});
test('Settings card: the switch renders for imported banks only, with the contract markup, suffix and Suggested pill', () => {
  const rows = rowsOf('IMP', [['Medicine', 'Cardio'], ['Surgery', 'Ortho'], ['Pediatrics', 'Growth']]).concat(rowsOf('LIB', [['Medicine', 'Cardio'], ['Surgery', 'Ortho']]));
  const banks = [{ id: 'IMP', kind: 'imported', name: 'My Bank', code: 'MB', color: '#123456' }, { id: 'LIB', kind: 'builtin', name: 'Built', code: 'BI', color: '#654321' }];
  const T = settingsCtx(banks, rows);
  T.ST.open = 'IMP'; const imp = T.setBankHtml(banks[0]);
  assert.match(imp, /<div class="tq-sw tq-bordered tq-sscope"><div><b>Systems follow subjects <span class="tq-spill">Suggested<\/span><\/b>/);
  assert.match(imp, /role="switch" aria-checked="false" aria-label="Systems follow subjects for My Bank" data-a="sscope" data-v="IMP"/);
  assert.match(imp, /3 of 3 systems here belong to one subject\./); assert.doesNotMatch(imp, /systems by subject<\/small>|aria-busy/);
  T.ST.open = 'LIB'; assert.doesNotMatch(T.setBankHtml(banks[1]), /sscope|Systems follow subjects/, 'built-in banks have no switch');
  banks[0].facetRules = { systemsBySubject: true }; T.ST.open = '';
  assert.match(T.setBankHtml(banks[0]), /· systems by subject<\/small>/, 'collapsed suffix when on');
  T.ST.open = 'IMP'; const on = T.setBankHtml(banks[0]);
  assert.match(on, /aria-checked="true"[^>]*data-a="sscope"/); assert.doesNotMatch(on, /tq-spill/, 'no pill while on');
  T.ST.sbusy = 'IMP'; assert.match(T.setBankHtml(banks[0]), /data-v="IMP" disabled aria-busy="true"/);
  T.ST.sbusy = ''; T.ST.serr.IMP = 'nope <b>'; assert.match(T.setBankHtml(banks[0]), /class="tq-hint" role="alert">.*Could not save: nope &lt;b&gt;/s);
});
const mkRoot = (bridgeObj, saved) => { const root = { document: { readyState: 'loading', addEventListener() {}, getElementById: () => null }, localStorage: { getItem: () => (saved == null ? null : JSON.stringify(saved)), setItem() {} } };
  root.window = root; root.setTimeout = () => 0; root.console = { log() {}, warn() {}, error() {} }; root.ThunderQbanksCore = {}; if (bridgeObj) root.StepLibraryBridge = bridgeObj; vm.runInNewContext(ui, root); return root; };
test('toggleScope: saves through qbanksUpdateBank, refetches; on failure shows the error and keeps the old state', async () => {
  const rows = rowsOf('IMP', [['M', 'A'], ['S', 'B']]), calls = []; let fail = false;
  const bank = { id: 'IMP', kind: 'imported', name: 'My Bank', code: 'MB', color: '#123456' };
  const B = { qbanks: async () => ({ banks: [{ ...bank, ...(calls.length && !fail ? { facetRules: { systemsBySubject: calls[calls.length - 1].on } } : {}) }], forms: [], rows, prov: {}, tests: [] }), settings: async () => ({ qbank: {} }),
    qbanksUpdateBank: async (id, patch) => { if (fail) throw new Error('disk full'); calls.push({ id, patch, on: !!(patch.facetRules && patch.facetRules.systemsBySubject) }); } };
  const r = mkRoot(B), T = r.ThunderQbanksUI._test;
  T.setD({ banks: [{ ...bank }], forms: [], rows, prov: {}, tests: [] });
  await T.toggleScope('IMP'); assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), { id: 'IMP', patch: { facetRules: { systemsBySubject: true } }, on: true });
  assert.equal(T.ST.sbusy, ''); assert.match((T.ST.open = 'IMP', T.setBankHtml({ ...bank, facetRules: { systemsBySubject: true } })), /aria-checked="true"/);
  await T.toggleScope('IMP'); assert.equal(calls[1].patch.facetRules, null, 'off sends null');
  fail = true; T.setD({ banks: [{ ...bank, facetRules: { systemsBySubject: true } }], forms: [], rows, prov: {}, tests: [] });
  await T.toggleScope('IMP'); assert.equal(T.ST.serr.IMP, 'disk full'); assert.equal(T.ST.sbusy, '');
  assert.match(T.setBankHtml({ ...bank, facetRules: { systemsBySubject: true } }), /role="alert">.*Could not save: disk full/s);
});
test('click handler: data-a="sscope" is handled in onSetHostClick and the save path refetches, invalidates and repaints', () => {
  const h = ui.slice(ui.indexOf('function onSetHostClick'), ui.indexOf('function setVisible'));
  assert.match(h, /a === 'sscope'\) \{ toggleScope\(v\)/);
  const f = ui.slice(ui.indexOf('async function toggleScope'), ui.indexOf('function settingsHtml'));
  assert.match(f, /qbanksUpdateBank\(id, \{ facetRules: on \? \{ systemsBySubject: true \} : null \}\)/);
  assert.match(f, /await fetchData\(\)/); assert.match(f, /invalDet\(id\)/); assert.match(f, /paintSet\(\); render\(\)/); assert.match(f, /ST\.serr\[id\] =/);
});

/* ---- Defaults follow Settings ---- */
test('mapDefaults: Settings New test defaults to the tab (testing = timed, link = forms, attempt valid for the track)', () => {
  const T = loadUi(null)._test, m = q => ({ ...T.mapDefaults(q) });
  assert.deepEqual(m({ defaultMode: 'testing', defaultSecondsPerQuestion: 60, defaultBlockSize: 20, linkToLibrary: false, defaultAttemptSource: 'latest_qbank' }), { mode: 'timed', secs: 60, perBlock: 20, track: 'qbank', attempt: 'latest_qbank' });
  assert.deepEqual(m({ defaultMode: 'tutor', defaultSecondsPerQuestion: 5, defaultBlockSize: 500, linkToLibrary: true, defaultAttemptSource: 'latest_completed' }), { mode: 'tutor', secs: 15, perBlock: 80, track: 'forms', attempt: 'latest_completed' });
  assert.equal(m({ defaultAttemptSource: 'first' }).attempt, 'completed_qbank', 'a form attempt is not valid for the Qbank track: track default');
  assert.equal(m({ linkToLibrary: true, defaultAttemptSource: 'all_qbank' }).attempt, 'active', 'a Qbank attempt is not valid for forms: track default');
  assert.equal(m({ linkToLibrary: true, defaultAttemptSource: 'first' }).attempt, 'first');
  assert.deepEqual(m({}), { mode: 'timed', secs: 90, perBlock: 40, track: 'qbank', attempt: 'completed_qbank' });
  assert.equal(T.mapDefaults(null), null); assert.equal(T.mapDefaults(undefined), null);
});
test('loadDefaults: applied on first load, again only when the Settings values change; a bridge without settings is tolerated', async () => {
  const U = loadUi({ mode: 'timed', secs: 200, track: 'forms', attempt: 'first', pull: 'order' }), T = U._test, S = U._state;
  assert.deepEqual([S.mode, S.secs, S.track, S.attempt], ['tutor', 90, '', ''], 'old saved mode/secs/track/attempt are ignored');
  const mk = (q) => { const root = mkRoot(q === 'none' ? {} : { settings: async () => ({ qbank: root.Q }) }); root.Q = q === 'none' ? null : q; return root; };
  const r = mk({ defaultMode: 'testing', defaultSecondsPerQuestion: 45, defaultBlockSize: 10, linkToLibrary: true, defaultAttemptSource: 'first' });
  const t = r.ThunderQbanksUI._test, s = r.ThunderQbanksUI._state;
  await t.loadDefaults();
  assert.deepEqual([s.mode, s.secs, s.perBlock, s.want, s.track, s.attempt], ['timed', 45, 10, 10, 'forms', 'first']);
  s.mode = 'tutor'; s.want = 7; await t.loadDefaults(); assert.deepEqual([s.mode, s.want], ['tutor', 7], 'unchanged Settings: tab edits stay');
  r.Q = { ...r.Q, defaultBlockSize: 25 }; await t.loadDefaults(); assert.deepEqual([s.mode, s.want, s.perBlock], ['timed', 25, 25], 'changed Settings: applied again');
  assert.deepEqual({ ...t.presetDefs() }, { perBlock: 25, secs: 45 });
  const n = mk('none'); await n.ThunderQbanksUI._test.loadDefaults(); assert.equal(n.ThunderQbanksUI._state.track, 'qbank'); assert.equal(n.ThunderQbanksUI._test.presetDefs(), undefined);
});
test('savePrefs no longer stores mode, secs, track or attempt', () => {
  const store = {}, root = { document: { readyState: 'loading', addEventListener() {}, getElementById: () => null }, localStorage: { getItem: () => null, setItem: (k, v) => { store[k] = v; } } };
  root.window = root; root.setTimeout = () => 0; root.console = console; root.ThunderQbanksCore = {};
  vm.runInNewContext(ui, root); const U = root.ThunderQbanksUI; U._state.mode = 'timed'; U._state.secs = 33; U._state.track = 'forms'; U._state.attempt = 'active'; U._test.savePrefs();
  const saved = JSON.parse(Object.values(store)[0]);
  for (const k of ['mode', 'secs', 'track', 'attempt']) assert.ok(!(k in saved), k + ' not saved');
  assert.equal(saved.pull, 'mix'); assert.ok('sel' in saved && 'facet' in saved);
});
test('summary card has the Defaults from Settings line with the opensettings link; init no longer reads the legacy source input', () => {
  assert.match(ui, /Defaults from Settings<\/span>[^`]*data-a="opensettings"/);
  assert.doesNotMatch(ui.slice(ui.indexOf('function init()'), ui.indexOf('const api')), /qbankSourceMode/);
  assert.match(ui, /core\(\)\.presets\(m\(\), presetDefs\(\)\)/); assert.match(ui, /C\.presets\(m, presetDefs\(\)\)/);
});

/* ---- Previous tests redesign + performance card (pure helpers and markup) ---- */
const NOW = new Date(2026, 10, 18, 15, 0, 0).getTime(), DAY = 864e5;
const ago = (d, h = 0) => new Date(NOW - d * DAY - h * 36e5).toISOString();
const mkTest = (id, o = {}) => ({ id, name: 'T ' + id, mode: 'tutor', done: true, total: 40, blocks: 1, percent: 70, banks: ['A'], formIds: [], createdAt: ago(0), updatedAt: ago(0), completedAt: ago(0), ...o });
test('dateBucket: Today, Yesterday, This week, This month, Earlier (and bad input)', () => {
  const T = loadUi(null)._test, b = (d) => T.dateBucket(NOW - d * DAY, NOW);
  assert.equal(b(0), 'Today'); assert.equal(b(-1), 'Today', 'future counts as today'); assert.equal(b(1), 'Yesterday');
  assert.equal(b(2), 'This week'); assert.equal(b(6), 'This week'); assert.equal(b(7), 'This month'); assert.equal(b(17), 'This month');
  assert.equal(b(18), 'Earlier', '1 Nov 2026 minus one day is October'); assert.equal(b(400), 'Earlier');
  assert.equal(T.dateBucket(0, NOW), 'Earlier'); assert.equal(T.dateBucket('nope', NOW), 'Earlier');
});
test('sortTests: newest, oldest, best, worst (in-progress last); groupTests follows the sort', () => {
  const T = loadUi(null)._test;
  const a = mkTest('a', { percent: 90, completedAt: ago(3) }), b = mkTest('b', { percent: 55, completedAt: ago(1) }), c = mkTest('c', { done: false, percent: null, completedAt: null, updatedAt: ago(0) }), d = mkTest('d', { percent: 72, completedAt: ago(20) });
  const ids = (l) => l.map(t => t.id).join('');
  assert.equal(ids(T.sortTests([a, b, c, d], 'new')), 'cbad'); assert.equal(ids(T.sortTests([a, b, c, d], 'old')), 'dabc');
  assert.equal(ids(T.sortTests([a, b, c, d], 'best')), 'adbc'); assert.equal(ids(T.sortTests([a, b, c, d], 'worst')), 'bdac');
  const g = [...T.groupTests(T.sortTests([a, b, c, d], 'new'), 'new', NOW).map(x => x.label + ':' + ids(x.items))];
  assert.deepEqual(g, ['Today:c', 'Yesterday:b', 'This week:a', 'Earlier:d']);
  assert.deepEqual([...T.groupTests(T.sortTests([a, b, c, d], 'old'), 'old', NOW).map(x => x.label)], ['Earlier', 'This week', 'Yesterday', 'Today']);
  assert.deepEqual([...T.groupTests([a, b], 'best', NOW).map(x => x.label)], ['Highest scores']); assert.equal(T.groupTests([], 'new', NOW).length, 0);
});
test('histStats: average is over completed tests only; trend = last 12 completed, oldest first', () => {
  const T = loadUi(null)._test;
  const l = [mkTest('a', { percent: 80, completedAt: ago(5) }), mkTest('b', { percent: 60, completedAt: ago(2) }), mkTest('p', { done: false, percent: 10, completedAt: null, total: 99 })];
  const s = T.histStats(l); assert.equal(s.total, 3); assert.equal(s.completed, 2); assert.equal(s.avg, 70); assert.equal(s.qs, 179, 'questions in tests = every test'); assert.deepEqual([...s.pts], [80, 60]);
  assert.equal(T.histStats([mkTest('p', { done: false, percent: null })]).avg, null); assert.equal(T.histStats([]).avg, null);
  const many = Array.from({ length: 15 }, (_, i) => mkTest('t' + i, { percent: i, completedAt: ago(20 - i) }));
  assert.deepEqual([...T.trendPoints(many, 12)], [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
});
test('Previous tests markup: stat strip respects the bank filter; continue card only with an in-progress test', () => {
  const tests = [mkTest('a', { percent: 90, banks: ['A'] }), mkTest('b', { percent: 50, banks: ['B'] }), mkTest('c', { done: false, percent: null, banks: ['B'], name: 'Half way', updatedAt: ago(0), completedAt: null })];
  const st = loadUi(null);
  const U = st._test; U.setD({ banks: [{ id: 'A', name: 'Bank A', code: 'AA', color: '#123456' }, { id: 'B', name: 'Bank B', code: 'BB', color: '#654321' }], forms: [], rows: [], prov: {}, tests });
  let h = U.historyHtml();
  assert.match(h, /class="tq-cont"/); assert.match(h, /aria-label="Resume Half way"/); assert.match(h, /<span>Avg score<\/span><b[^>]*>70%<\/b>/); assert.match(h, /<span>Tests<\/span><b>3<\/b>/);
  assert.match(h, /<span>Completed<\/span><b>2<\/b>/); assert.match(h, /<span>Questions in tests<\/span><b>120<\/b>/);
  st._state.hb = 'A'; h = U.historyHtml();
  assert.doesNotMatch(h, /class="tq-cont"/, 'no in-progress test in bank A'); assert.match(h, /<span>Avg score<\/span><b[^>]*>90%<\/b>/); assert.match(h, /<span>Tests<\/span><b>1<\/b>/);
  st._state.hb = ''; st._state.hf = 'done'; h = U.historyHtml(); assert.doesNotMatch(h, /class="tq-cont"/, 'filtered to completed: no continue card'); assert.match(h, /<span>Tests<\/span><b>3<\/b>/, 'strip ignores the status filter');
  st._state.hf = 'all';
  h = U.historyHtml();
  for (const [act, label] of [['review', 'Review T a'], ['rename', 'Rename T a'], ['export', 'Export T a'], ['delete', 'Delete T a']]) assert.ok(h.includes(`data-a="tact" data-act="${act}" data-v="a"`) && h.includes(`aria-label="${label}"`), act); for (const k of ['all', 'prog', 'done']) assert.ok(h.includes(`data-a="hf" data-v="${k}"`), 'hf ' + k); for (const k of ['tutor', 'timed']) assert.ok(h.includes(`data-a="hm" data-v="${k}"`), 'hm ' + k);
  assert.match(h, /data-a="hs"/); assert.match(h, /data-a="hq"/); assert.match(h, /data-a="trefresh"/); assert.match(h, /class="tq-gh"/);
});
test('Previous tests empty states and sparkline with 0, 1 and n points', () => {
  const st = loadUi(null), U = st._test; U.setD({ banks: [], forms: [], rows: [], prov: {}, tests: [] });
  let h = U.historyHtml(); assert.match(h, /class="tq-empty"/); assert.match(h, /data-a="tab" data-v="create"/); assert.match(h, /Create a test/); assert.doesNotMatch(h, /tq-hstats/);
  U.setD({ banks: [], forms: [], rows: [], prov: {}, tests: [mkTest('a')] }); st._state.hq = 'zzz'; h = U.historyHtml(); assert.match(h, /No tests match this filter/); assert.match(h, /data-a="hclear"/); st._state.hq = '';
  assert.equal(U.sparkSvg([]), ''); const one = U.sparkSvg([80]); assert.match(one, /<circle/); assert.doesNotMatch(one, /<polyline/);
  const n = U.sparkSvg([50, 60, 80]); assert.match(n, /<polyline points="[^"]+"/); assert.equal((n.match(/<circle/g) || []).length, 1); assert.match(n, /aria-label="Score trend: 50, 60, 80"/);
  assert.doesNotMatch(U.sparkSvg([50, 50, 50]), /NaN/, 'flat series is fine');
});
test('Performance card: answered, correct %, tests, last, trend; follows the selected banks', () => {
  const st = loadUi(null), U = st._test, mk = (bank, status, n) => Array.from({ length: n }, () => ({ bank, subject: 'S', system: 'X', status }));
  const rows = [...mk('A', 'correct', 6), ...mk('A', 'incorrect', 2), ...mk('A', 'omitted', 2), ...mk('A', 'unused', 10), ...mk('B', 'correct', 5)];
  const tests = [mkTest('a', { percent: 60, completedAt: ago(4) }), mkTest('b', { percent: 80, completedAt: ago(1) }), mkTest('x', { banks: ['B'], percent: 99 })];
  U.setD({ banks: [{ id: 'A', name: 'Bank A', code: 'AA', color: '#123456' }, { id: 'B', name: 'Bank B', code: 'BB', color: '#654321' }], forms: [], rows, prov: {}, tests });
  let h = U.progressHtml(['A']);
  assert.match(h, /data-r="progress"/); assert.match(h, /class="tq-pans">10 of 20 used/); assert.match(h, /<b>50%<\/b><small>used<\/small>/);
  assert.match(h, /<b[^>]*>60%<\/b> <small>correct<\/small>/); assert.match(h, /<b>2<\/b> <small>tests<\/small>/); assert.match(h, /<small>last<\/small> <b>/);
  assert.doesNotMatch(h, /tq-ptrend/, 'fewer than 3 points: no sparkline');
  U.setD({ banks: [{ id: 'A', name: 'Bank A', code: 'AA', color: '#123456' }], forms: [], rows, prov: {}, tests: [...tests, mkTest('c', { percent: 70, completedAt: ago(2) })] });
  assert.match(U.progressHtml(['A']), /class="tq-ptrend"[^>]*><svg class="tq-spark"[^>]*aria-label="Score trend: 60, 70, 80"/);
  U.setD({ banks: [{ id: 'A', name: 'Bank A', code: 'AA', color: '#123456' }, { id: 'B', name: 'Bank B', code: 'BB', color: '#654321' }], forms: [], rows, prov: {}, tests });
  for (const c of ['tq-lc', 'tq-lw', 'tq-lo', 'tq-lu']) assert.ok(h.includes(`class="${c}"`), c);
  h = U.progressHtml(['A', 'B']); assert.match(h, /15 of 25 used/); assert.match(h, /<b[^>]*>73%<\/b> <small>correct<\/small>/); assert.match(h, /<b>3<\/b> <small>tests<\/small>/);
  U.setD({ banks: [{ id: 'A', name: 'Bank A', code: 'AA', color: '#123456' }], forms: [], rows: mk('A', 'unused', 4), prov: {}, tests: [] });
  h = U.progressHtml(['A']); assert.doesNotMatch(h, /\d tests?<\/small>/, 'no tests, no test count'); assert.doesNotMatch(h, /tq-ptrend|correct<\/small>/);
});
test('perfSummary: strongest and weakest system need at least 10 answered each, and two systems to compare', () => {
  const U = loadUi(null)._test, m = (o) => ({ systems: Object.keys(o), sysPerf: Object.fromEntries(Object.entries(o).map(([k, [c, w]]) => [k, { n: c + w + 5, c, w }])) });
  const s = U.perfSummary(m({ Cardio: [18, 2], Renal: [6, 9], Neuro: [4, 1], Derm: [9, 1] }));
  assert.equal(s.best.name, 'Cardio'); assert.equal(s.best.pct, 90); assert.equal(s.worst.name, 'Renal'); assert.equal(s.worst.pct, 40);
  assert.equal(U.perfSummary(m({ Cardio: [18, 2], Neuro: [4, 1] })), null, 'only one system with 10 answered'); assert.equal(U.perfSummary(m({})), null);
  assert.equal(U.perfSummary(m({ A: [5, 5], B: [9, 1] })).worst.name, 'A', 'exactly 10 answered counts');
  const st = loadUi(null), V = st._test; V.setD({ banks: [], forms: [], rows: [], prov: {}, tests: [] });
  const html = V.perfHtml({ subjects: ['S'], systems: ['Cardio', 'Renal'], subPerf: { S: { n: 40, c: 24, w: 6 } }, sysPerf: { Cardio: { n: 20, c: 18, w: 2 }, Renal: { n: 20, c: 6, w: 9 } } });
  assert.match(html, /Strongest system<\/span><b>Cardio/); assert.match(html, /Weakest system<\/span><b>Renal/); assert.match(html, /data-a="pick" data-v="sys\|Renal"/);
  assert.equal((html.match(/<tr data-a="pick"/g) || []).length, 3); assert.match(html, /data-v="sub\|S"/); assert.ok(html.indexOf('data-v="sys|Renal"') < html.indexOf('data-v="sys|Cardio"'), 'weakest first');
});

test('Previous tests: status and mode filters combine; Continue test is not listed twice; ring marks; filterLine uses the test banks', () => {
  const st = loadUi(null), U = st._test;
  const rows = ['S1', 'S2', 'S3'].flatMap(sub => ['X', 'Y'].map(sys => ({ bank: 'A', formId: 'f', subject: sub, system: sys, status: 'unused' }))).concat([{ bank: 'B', formId: 'g', subject: 'Z', system: 'W', status: 'unused' }]);
  const tests = [mkTest('a', { mode: 'tutor', percent: 90 }), mkTest('b', { mode: 'testing', percent: 50 }), mkTest('c', { mode: 'tutor', done: false, percent: null, completedAt: null, name: 'Half way' }), mkTest('d', { mode: 'testing', percent: null })];
  U.setD({ banks: [{ id: 'A', name: 'Bank A', code: 'AA', color: '#123456' }, { id: 'B', name: 'Bank B', code: 'BB', color: '#654321' }], forms: [], rows, prov: {}, tests });
  const S = st._state;
  assert.equal(U.testsFiltered().length, 4);
  S.hf = 'done'; S.hm = 'tutor'; assert.deepEqual(U.testsFiltered().map(t => t.id), ['a']);
  S.hm = 'timed'; assert.deepEqual(U.testsFiltered().map(t => t.id).sort(), ['b', 'd']);
  S.hf = 'all'; S.hm = '';
  const h = U.historyHtml();
  assert.equal((h.match(/Resume Half way/g) || []).length, 1, 'Continue card only, not repeated in the list');
  assert.equal((h.match(/class="tq-test"/g) || []).length, 3);
  assert.match(h, /class="tq-cacts"/);
  for (const k of ['Rename', 'Export', 'Delete']) assert.match(h, new RegExp('data-act="' + k.toLowerCase() + '" data-v="[^"]*" title="' + k + '" aria-label="' + k + ' Half way"'), 'Continue card has ' + k);
  assert.match(h, /aria-label="No score"><span>\u2014<\/span>/);
  assert.equal((h.match(/tq-ring-p/g) || []).length, 1, 'in-progress ring only on the Continue card');
  const fl = f => U.filterLine({ banks: ['A'], filter: f });
  assert.equal(fl({ statuses: ['unused'], subjects: ['S1', 'S2', 'S3'], systems: ['X', 'Y'] }), 'Unused \u00b7 all subjects');
  assert.equal(fl({ statuses: ['unused'], subjects: null, systems: null }), 'Unused \u00b7 all subjects');
  assert.equal(fl({ statuses: ['unused'], subjects: ['S1'], systems: ['X'] }), 'Unused \u00b7 1 subject \u00b7 1 system');
  assert.equal(U.filterLine({ banks: ['B'], filter: { statuses: ['unused'], subjects: ['Z'], systems: ['W'] } }), 'Unused \u00b7 all subjects');
});

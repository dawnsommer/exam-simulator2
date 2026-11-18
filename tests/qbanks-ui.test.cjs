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

test('Settings > Qbanks: thunder-ui supplies #tuSetQbanks, calls mountSettings after paint, label is Qbanks, defaults rows stay', () => {
  assert.match(thunder, /\['qbank', 'Qbanks'\]/);
  assert.match(thunder, /SET_LEGACY = \{tabs:'library', qbank:'qbank'/);
  assert.match(thunder, /id="tuSetQbanks"/);
  assert.match(thunder, /ThunderQbanksUI\.mountSettings\(h\)/);
  for (const hook of ['data-tu-setsw="setLinkQbank"', 'data-tu-defaults', 'data-tu-reset', 'Library is read-only for Qbank']) assert.ok(thunder.includes(hook), 'defaults row kept: ' + hook);
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

test('Previous tests shows every test (bank filter chip row, not S.sel); Performance has its own bank filter and model', () => {
  const hist = ui.slice(ui.indexOf('function testsFiltered'), ui.indexOf('function historyHtml'));
  assert.doesNotMatch(hist, /S\.sel/, 'history ignores the Create bank selection');
  assert.match(hist, /S\.hb/);
  assert.match(ui, /data-a="hb"|bankChips\('hb'/); assert.match(ui, /bankChips\('pb'/);
  const perf = ui.slice(ui.indexOf('function perfModel'), ui.indexOf('function perfHtml'));
  assert.match(perf, /core\(\)\.facets\(/); assert.doesNotMatch(perf, /S\.sel/);
  assert.match(ui, /S\.sel = new Set\(perfIds\(\)\)/, 'tap a row selects that bank set for Create');
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
  assert.match(ui, /JSON\.stringify\(\{ sel: \[\.\.\.S\.sel\], combine: S\.combine/, 'combine is saved');
  const click = ui.slice(ui.indexOf("case 'bank': {"), ui.indexOf("case 'mode':"));
  assert.match(click, /if \(!S\.combine\) \{ S\.sel = new Set\(\[v\]\)/, 'single click selects only that bank');
  assert.match(click, /S\.sel\.size > 1\) S\.sel\.delete/, 'cannot deselect the last bank');
  assert.match(click, /S\.lastBank/, 'Combine off keeps the last clicked bank');
  assert.match(ui.slice(ui.indexOf('function pick('), ui.indexOf('function goTab')), /S\.combine = true/, 'perf pick over several banks turns Combine on');
  const prog = ui.slice(ui.indexOf('function progressHtml'), ui.indexOf('function rowHtml'));
  assert.match(prog, /r\.status === 'correct'/); assert.match(prog, /D\.tests\.filter/); assert.match(prog, /when\(last\)/);
  assert.match(ui.slice(ui.indexOf('function perfHtml')), /progressHtml\(perfIds\(\)\)/, 'Performance progress follows S.pb');
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

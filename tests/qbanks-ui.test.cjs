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

test('Manage banks tab is a signpost card to Settings; the Create-tab Import card stays', () => {
  assert.match(ui, /Manage banks in Settings → Qbanks/);
  assert.match(ui, /data-a="opensettings"/);
  assert.match(ui, /T\.openSettings\('qbank'\)/);
  assert.match(ui, /<b>Import a Qbank<\/b>/);
  assert.doesNotMatch(ui, /data-a="delbank" data-v="\$\{esc\(b\.id\)\}" title="Delete"/, 'old Manage row actions are gone');
});

test('import sheet v2: step 1 summary, values from pv.values, manifest prefill, no local ZIP re-read or 80 MB cap', () => {
  for (const s of ['tqPvOk', 'tqPvManifest', 'tqPvFiles', 'tqPvMissing', 'missingImages', 'pv.manifest', 'mf.name', 'mf.code', 'mf.color', 'pv.values', 'go2', 'tq-badfiles'])
    assert.ok(ui.includes(s), 'has ' + s);
  assert.doesNotMatch(ui, /localQuestions|80 \* 1024 \* 1024|JSZip\.loadAsync/);
});

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

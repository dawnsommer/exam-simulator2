'use strict';
/* Choice % (choice-epc.js, question field choicesEPC). Behaviour in the app: tools/headless/v3-probe-epc.js (both apps).
   Shared by both apps: byte-identical in the Local tests/ and the iPad tests/ folder. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const find = (...c) => c.map((p) => path.join(__dirname, p)).find((p) => fs.existsSync(p));
const E = require(find('../choice-epc.js'));
const local = find('../Step_Exam_Simulator_v22.14.html', '../../Step_Exam_Simulator_v22.14.html');
const ipad = find('../Step Simulator IPAD/index.html', '../index.html');

test('values: array in choice order, numbers and "62%" strings, other values blank', () => {
  assert.deepEqual(E.values({ choicesEPC: [3, '90%', 'not shown', null, ' 4 '] }, 5), [3, 90, null, null, 4]);
  assert.deepEqual(E.values({ choicesEPC: [10, 90] }, 3), [10, 90, null]);
  assert.deepEqual(E.values({ choicesEPC: [12.5, 87.5] }, 2), [12.5, 87.5]);
});
test('values: object keyed by letter (either case) or index', () => {
  assert.deepEqual(E.values({ choicesEPC: { A: 20, B: '80%' } }, 3), [20, 80, null]);
  assert.deepEqual(E.values({ choicesEPC: { a: 5, c: 95 } }, 3), [5, null, 95]);
  assert.deepEqual(E.values({ choicesEPC: { 0: 40, 1: 60 } }, 2), [40, 60]);
});
test('values: nothing to show when every value is 0 or missing', () => {
  for (const v of [undefined, null, [], [0, 0, 0], [null, 'none', ''], { A: 0, B: '0%' }, 'abc', [-5, 0]]) assert.equal(E.values({ choicesEPC: v }, 3), null, JSON.stringify(v));
  assert.equal(E.values({}, 4), null);
  assert.equal(E.values(null, 4), null);
});
test('label rounds to one decimal', () => {
  assert.equal(E.label(62), '(62%)');
  assert.equal(E.label(33.333), '(33.3%)');
});
test('both apps load choice-epc.js after qbanks.js; Local/iPad copies are byte-identical', () => {
  const l = fs.readFileSync(local, 'utf8'), i = fs.readFileSync(ipad, 'utf8');
  assert.ok(l.indexOf('<script src="./choice-epc.js"></script>') > l.indexOf('<script src="./qbanks.js"></script>'));
  const at = (f) => i.search(new RegExp('<script src="\\./' + f.replace('.', '\\.') + '\\?v=\\d+"></script>'));
  assert.ok(at('choice-epc.js') > at('qbanks.js') && at('qbanks.js') > 0);
  const root = path.dirname(ipad);
  for (const f of ['sw.js', 'app-update.js']) assert.ok(fs.readFileSync(path.join(root, f), 'utf8').includes('"./choice-epc.js?v='), f);
  assert.equal(fs.readFileSync(path.join(root, 'choice-epc.js'), 'utf8'), fs.readFileSync(path.join(path.dirname(local), 'choice-epc.js'), 'utf8'));
});

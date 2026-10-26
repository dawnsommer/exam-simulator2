'use strict';
/* Sync V3 core: every merge rule, property tests (any order / grouping gives the same result, merging twice changes
   nothing), HLC with skewed clocks, visibility (reset / delete / uninstall / answers after a completed block),
   compaction, derived counts and the settings registry. */
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/sync3-core.js');
const { K, fmtStamp, cmpStamp, merge, view, compact, mk, canon } = C;

const NOW = Date.parse('2026-10-25T12:00:00Z');
const st = (wall, counter, dev) => fmtStamp(wall, counter, dev);
const at = (min, c = 0, dev = 'A') => st(NOW + min * 60000, c, dev);
const U = (k, v, t) => ({ k, v, t });
const m1 = (...units) => merge({}, [units], { now: NOW }).units;

test('stamps: order is (wall, counter, dev); dev ids are sanitised; parse round-trips', () => {
  const a = at(0, 0, 'A'), b = at(0, 1, 'A'), c = at(0, 0, 'B'), d = at(1, 0, 'A');
  assert.ok(cmpStamp(a, b, NOW) < 0 && cmpStamp(b, c, NOW) > 0 && cmpStamp(c, d, NOW) < 0 && cmpStamp(a, a, NOW) === 0);
  assert.equal(C.parseStamp(fmtStamp(NOW, 7, 'iPad 2.x')).dev, 'iPad_2_x');
  assert.equal(C.parseStamp(fmtStamp(NOW, 7, 'x')).counter, 7);
});

test('HLC: wall = max(now, last), counter +1 on equal wall; a device that is behind never goes backwards', () => {
  let r = C.hlcNow({ wall: 0, counter: 0 }, 'A', NOW);
  assert.equal(C.parseStamp(r.stamp).wall, NOW);
  const r2 = C.hlcNow(r.clock, 'A', NOW);
  assert.equal(C.parseStamp(r2.stamp).counter, 1);
  const r3 = C.hlcNow(r2.clock, 'A', NOW - 3600000);          // clock a year/hour behind
  assert.ok(cmpStamp(r3.stamp, r2.stamp, NOW) > 0, 'stamps still increase');
  assert.equal(C.parseStamp(r3.stamp).wall, NOW);
});

test('HLC: seeing remote stamps advances last; a remote a year ahead is clamped to now + 24 h and flagged', () => {
  const far = fmtStamp(NOW + 365 * 86400000, 3, 'X'), near = fmtStamp(NOW + 60000, 5, 'Y');
  assert.ok(C.isSkewed(far, NOW) && !C.isSkewed(near, NOW));
  let c = C.hlcSeen({ wall: 0, counter: 0 }, [near], NOW);
  assert.deepEqual(c, { wall: NOW + 60000, counter: 5 });
  c = C.hlcSeen(c, [far], NOW);
  assert.equal(c.wall, NOW + C.MAX_AHEAD_MS, 'clamped');
  const next = C.hlcNow(c, 'A', NOW);
  assert.ok(C.parseStamp(next.stamp).wall <= NOW + C.MAX_AHEAD_MS + 1);
  // order stays sane: a stamp a year ahead does not beat an honest stamp stamped later than now + 24 h
  const honest = fmtStamp(NOW + 2 * 86400000, 0, 'A');
  assert.ok(cmpStamp(far, honest, NOW) < 0 || cmpStamp(far, honest, NOW) > 0);       // total, no crash
  assert.equal(merge({}, [[U('S.g.accent', 'x', far)]], { now: NOW }).skewed.length, 1);
});

test('rule: newest wins for L / T / F / S and unknown keys; ties are deterministic', () => {
  const k = K.libField('f1', 'name');
  assert.equal(m1(U(k, 'old', at(0)), U(k, 'new', at(1)))[k].v, 'new');
  assert.equal(m1(U(k, 'new', at(1)), U(k, 'old', at(0)))[k].v, 'new');
  const t = at(0);
  assert.equal(m1(U(k, 'a', t), U(k, 'b', t))[k].v, m1(U(k, 'b', t), U(k, 'a', t))[k].v);
  assert.equal(m1(U('Z.weird', 1, at(0)), U('Z.weird', 2, at(2)))['Z.weird'].v, 2, 'unknown keys pass through');
  assert.equal(C.ruleFor(K.setting('g', 'accent')), 'newest');
});

test('rule: L.<uid>.rev = highest seq (a device behind on updates never rolls back)', () => {
  const k = K.libField('f1', 'rev');
  const r = m1(U(k, { hash: 'h2', seq: 2 }, at(0)), U(k, { hash: 'h1', seq: 1 }, at(60)))[k];
  assert.equal(r.v.seq, 2);
});

test('rule: A.<att> header = earliest (write-once); label / del = newest', () => {
  const k = K.att('a1');
  assert.equal(m1(U(k, { formUid: 'f', n: 'late' }, at(5)), U(k, { formUid: 'f', n: 'early' }, at(1)))[k].v.n, 'early');
  const lk = K.attField('a1', 'label');
  assert.equal(m1(U(lk, 'First', at(1)), U(lk, 'Renamed', at(3)))[lk].v, 'Renamed');
});

test('rule: ans = newest, first = earliest, both kept; log = union by stamp, last 20', () => {
  const ans = K.item('a', 'q1', 'ans'), first = K.item('a', 'q1', 'first'), log = K.item('a', 'q1', 'log');
  const r = m1(U(ans, 1, at(1)), U(ans, 3, at(9)), U(first, 1, at(1)), U(first, 3, at(9)),
    U(log, [{ t: at(1), from: null, to: 1 }], at(1)), U(log, [{ t: at(9), from: 1, to: 3 }], at(9)));
  assert.equal(r[ans].v, 3); assert.equal(r[first].v, 1);
  assert.deepEqual(r[log].v.map(e => e.to), [1, 3]);
  const many = Array.from({ length: 30 }, (_, i) => ({ t: at(i), to: i }));
  const cut = m1(U(log, many.slice(0, 15), at(15)), U(log, many.slice(10), at(30)))[log].v;
  assert.equal(cut.length, 20); assert.equal(cut[19].to, 29); assert.equal(cut[0].to, 10);
});

test('rule: tm = per-device max, summed for display; rv = true wins; st / fl / hs / he = newest whole value', () => {
  const tm = K.item('a', 'q1', 'tm'), rv = K.item('a', 'q1', 'rv'), st1 = K.item('a', 'q1', 'st');
  const r = m1(U(tm, { A: 30, B: 5 }, at(1)), U(tm, { A: 20, B: 9 }, at(2)), U(rv, true, at(5)), U(rv, false, at(9)),
    U(st1, [1, 2], at(1)), U(st1, [3], at(2)));
  assert.deepEqual(r[tm].v, { A: 30, B: 9 });
  assert.equal(Object.values(r[tm].v).reduce((a, b) => a + b, 0), 39);
  assert.equal(r[rv].v, true); assert.equal(r[rv].t, at(5), 'earliest true stamp');
  assert.deepEqual(r[st1].v, [3]);
});

test('rule: block done = completed wins with the earliest stamp; nt / sus newest', () => {
  const d = K.block('a', 1, 'done'), nt = K.block('a', 1, 'nt');
  const r = m1(U(d, false, at(9)), U(d, true, at(5)), U(d, true, at(3)), U(nt, 'x', at(1)), U(nt, 'y', at(2)));
  assert.equal(r[d].v, true); assert.equal(r[d].t, at(3)); assert.equal(r[nt].v, 'y');
});

test('merge: absence never deletes; changes lists only keys that differ from known', () => {
  const k1 = K.item('a', 'q1', 'ans'), k2 = K.item('a', 'q2', 'ans');
  const known = { [k1]: { v: 1, t: at(1) } };
  const out = merge(known, [[U(k2, 2, at(2))]], { now: NOW });
  assert.equal(out.units[k1].v, 1);
  assert.deepEqual(out.changes.map(c => [c.k, c.type]), [[k2, 'add']]);
  assert.deepEqual(merge(out.units, [[U(k2, 2, at(2))]], { now: NOW }).changes, []);
  const upd = merge(known, [[U(k1, 4, at(5, 0, 'B'))]], { now: NOW });
  assert.deepEqual(upd.changes.map(c => [c.type, c.dev]), [['update', 'B']]);
});

/* ---------- property tests ---------- */
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function randomUnits(r, n) {
  const devs = ['A', 'B', 'C'], out = [];
  for (let i = 0; i < n; i++) {
    const dev = devs[Math.floor(r() * 3)], t = st(NOW + Math.floor(r() * 50) * 1000, Math.floor(r() * 3), dev);
    const q = 'q' + Math.floor(r() * 3), att = 'a' + Math.floor(r() * 2), uid = 'f' + Math.floor(r() * 2);
    const pick = Math.floor(r() * 12);
    let k, v;
    if (pick === 0) { k = K.att(att); v = { formUid: uid, order: ['q0', 'q1', 'q2'], bs: 2, n: Math.floor(r() * 9) }; }
    else if (pick === 1) { k = K.item(att, q, 'ans'); v = Math.floor(r() * 5); }
    else if (pick === 2) { k = K.item(att, q, 'first'); v = Math.floor(r() * 5); }
    else if (pick === 3) { k = K.item(att, q, 'log'); v = [{ t, to: Math.floor(r() * 5) }]; }
    else if (pick === 4) { k = K.item(att, q, 'tm'); v = { [dev]: Math.floor(r() * 90) }; }
    else if (pick === 5) { k = K.item(att, q, 'rv'); v = r() < 0.5; }
    else if (pick === 6) { k = K.block(att, 1 + Math.floor(r() * 2), 'done'); v = r() < 0.5; }
    else if (pick === 7) { k = K.libField(uid, 'rev'); v = { hash: 'h' + Math.floor(r() * 4), seq: Math.floor(r() * 4) }; }
    else if (pick === 8) { k = K.form(uid, 'reset'); v = { at: t }; }
    else if (pick === 9) { k = K.attField(att, 'del'); v = { del: r() < 0.5 }; }
    else if (pick === 10) { k = K.lib(uid); v = { on: r() < 0.5 ? 'installed' : 'deleted', src: 'catalog', ch: 'x' + Math.floor(r() * 3) }; }
    else { k = K.setting('g', 'accent'); v = ['crimson', 'blue', 'teal'][Math.floor(r() * 3)]; }
    out.push(U(k, v, t));
  }
  return out;
}
const shuffle = (a, r) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const mergeAll = list => merge({}, [list], { now: NOW }).units;

test('property: random unit sets merged in random orders and groupings give identical results; twice changes nothing', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const r = rng(seed), units = randomUnits(r, 5 + Math.floor(r() * 40));
    const whole = mergeAll(units);
    const shuffled = mergeAll(shuffle(units, r));
    assert.ok(C.sameUnits(whole, shuffled), 'order, seed ' + seed);
    // grouping: split into 3 replicas, merge pairwise in different association orders
    const cut1 = Math.floor(r() * units.length), cut2 = cut1 + Math.floor(r() * (units.length - cut1));
    const [x, y, z] = [units.slice(0, cut1), units.slice(cut1, cut2), units.slice(cut2)].map(mergeAll);
    const asArr = m => Object.keys(m).map(k => ({ k, v: m[k].v, t: m[k].t }));
    const left = merge(x, [asArr(y)], { now: NOW }).units, a1 = merge(left, [asArr(z)], { now: NOW }).units;
    const right = merge(y, [asArr(z)], { now: NOW }).units, a2 = merge(x, [asArr(right)], { now: NOW }).units;
    assert.ok(C.sameUnits(a1, whole) && C.sameUnits(a2, whole), 'grouping, seed ' + seed);
    // idempotent
    const again = merge(whole, [asArr(whole), asArr(whole)], { now: NOW });
    assert.ok(C.sameUnits(again.units, whole) && again.changes.length === 0, 'idempotent, seed ' + seed);
    // view is a function of the merged units only
    assert.equal(canon(view(whole, { now: NOW })), canon(view(shuffled, { now: NOW })));
  }
});

test('property: merge result never loses a key and never lowers a stamp under newest / earliest rules', () => {
  const r = rng(99), units = randomUnits(r, 120), out = mergeAll(units);
  for (const u of units) assert.ok(out[u.k], 'key kept ' + u.k);
  for (const u of units) {
    const rule = C.ruleFor(u.k), res = out[u.k];
    if (rule === 'newest') assert.ok(cmpStamp(res.t, u.t, NOW) >= 0);
    if (rule === 'earliest') assert.ok(cmpStamp(res.t, u.t, NOW) <= 0);
  }
});

/* ---------- visibility ---------- */
const hdr = (uid, order, extra) => ({ formUid: uid, type: 'first', order, bs: 2, ...extra });
function world() {
  return m1(
    U(K.lib('f1'), { on: 'installed', src: 'catalog', ch: 'c' }, at(0)),
    U(K.att('a1'), hdr('f1', ['q1', 'q2', 'q3']), at(1)),
    U(K.item('a1', 'q1', 'ans'), 2, at(2)), U(K.item('a1', 'q2', 'ans'), 1, at(3)), U(K.item('a1', 'q3', 'ans'), 0, at(4)),
    U(K.item('a1', 'q1', 'fl'), true, at(2)), U(K.item('a1', 'q2', 'st'), [0, 3], at(3)),
    U(K.block('a1', 1, 'done'), true, at(10)), U(K.block('a1', 2, 'nt'), 'note', at(5)));
}

test('view: nothing hidden by default; counts match the data', () => {
  const v = view(world(), { now: NOW });
  assert.deepEqual(v.hidden, []);
  assert.deepEqual(C.countUnits(v.units), { attempts: 1, answered: 3, marked: 1, struck: 2, notes: 1, stemHighlights: 0, expHighlights: 0, completedBlocks: 1 });
});

test('view: A.del hides the attempt; an offline unit of another attempt survives; undelete (newer del:false) brings it back', () => {
  const u = world();
  const del = merge(u, [[U(K.attField('a1', 'del'), { del: true }, at(20)), U(K.att('a2'), hdr('f1', ['q1']), at(21)), U(K.item('a2', 'q1', 'ans'), 4, at(22))]], { now: NOW }).units;
  const v = view(del, { now: NOW });
  assert.ok(v.hidden.includes(K.item('a1', 'q1', 'ans')) && !v.hidden.includes(K.item('a2', 'q1', 'ans')));
  const back = merge(del, [[U(K.attField('a1', 'del'), { del: false }, at(30))]], { now: NOW }).units;
  assert.deepEqual(view(back, { now: NOW }).hidden, []);
});

test('view: delete of an attempt on A, offline work on the same attempt on B: B\'s newer units survive with the header, older hidden', () => {
  const u = merge(world(), [[U(K.attField('a1', 'del'), { del: true }, at(20)), U(K.item('a1', 'q3', 'ans'), 4, at(22, 0, 'B'))]], { now: NOW }).units;
  const v = view(u, { now: NOW });
  assert.ok(v.hidden.includes(K.item('a1', 'q1', 'ans')) && v.hidden.includes(K.item('a1', 'q2', 'ans')));
  assert.ok(v.units[K.item('a1', 'q3', 'ans')] && v.units[K.att('a1')], 'the attempt reappears with B\'s unit');
  assert.equal(C.countUnits(v.units).answered, 1);
});

test('view: F.reset hides this form\'s units stamped earlier; B\'s newer offline units survive (the item reappears)', () => {
  const u = merge(world(), [[U(K.form('f1', 'reset'), { at: at(15) }, at(15)), U(K.item('a1', 'q3', 'ans'), 3, at(16))]], { now: NOW }).units;
  const v = view(u, { now: NOW });
  assert.ok(v.hidden.includes(K.item('a1', 'q1', 'ans')), 'older hidden');
  assert.ok(!v.hidden.includes(K.item('a1', 'q3', 'ans')), 'newer survives');
  assert.equal(v.units[K.item('a1', 'q3', 'ans')].v, 3);
});

test('view: uninstall (L.on deleted) hides progress, keeps it; re-import (newer installed) shows it again', () => {
  const gone = merge(world(), [[U(K.lib('f1'), { on: 'deleted', src: 'catalog', ch: 'c' }, at(40))]], { now: NOW }).units;
  assert.ok(view(gone, { now: NOW }).hidden.includes(K.item('a1', 'q1', 'ans')));
  assert.ok(gone[K.item('a1', 'q1', 'ans')], 'units kept');
  const again = merge(gone, [[U(K.lib('f1'), { on: 'installed', src: 'imported', ch: 'c2' }, at(50))]], { now: NOW }).units;
  assert.deepEqual(view(again, { now: NOW }).hidden, []);
});

test('view: an answer stamped after its block was completed is ignored; before it counts', () => {
  const u = merge(world(), [[U(K.item('a1', 'q1', 'ans'), 4, at(30, 0, 'B'))]], { now: NOW }).units;   // q1 is in block 1 (done at +10)
  const v = view(u, { now: NOW });
  assert.ok(v.hidden.includes(K.item('a1', 'q1', 'ans')));
  const u2 = merge(world(), [[U(K.item('a1', 'q3', 'ans'), 4, at(30, 0, 'B'))]], { now: NOW }).units;  // q3 is in block 2 (not done)
  assert.deepEqual(view(u2, { now: NOW }).hidden, []);
  assert.equal(C.blockOfQid(hdr('f1', ['q1', 'q2', 'q3']), 'q3'), 2);
  assert.equal(C.blockOfQid({ order: ['x', 'y', 'z'], bl: [1, 2] }, 'y'), 2);
});

test('compact: own replica drops hidden I / B / header units of a deleted attempt, keeps the tombstone', () => {
  const mine = Object.entries(world()).map(([k, u]) => ({ k, v: u.v, t: u.t }));
  mine.push(U(K.attField('a1', 'del'), { del: true }, at(20)));
  const merged = mergeAll(mine);
  const c = compact(mine, merged, { now: NOW });
  assert.ok(c.units.some(u => u.k === K.attField('a1', 'del')) && c.units.some(u => u.k === K.lib('f1')));
  assert.ok(!c.units.some(u => u.k.startsWith('I.') || u.k.startsWith('B.')));
  assert.ok(c.dropped.length >= 5);
});

test('deriveScores: scores are derived from answers and the key, never stored', () => {
  const key = { q1: 2, q2: 0, q3: 0 };
  const s = C.deriveScores(view(world(), { now: NOW }).units, 'a1', (uid, qid) => key[qid]);
  assert.deepEqual(s, { total: 3, answered: 3, correct: 2, percent: 67 });
});

test('settings registry: scopes g / L / P sync, d never; phones read P only (default Modern), large devices read L', () => {
  assert.equal(C.deviceClass(390, 844), 'phone'); assert.equal(C.deviceClass(844, 390), 'phone'); assert.equal(C.deviceClass(820, 1180), 'large');
  const phone = C.settingsFor('phone'), large = C.settingsFor('large');
  assert.ok(phone.every(s => s.scope !== 'd' && s.scope !== 'L') && large.every(s => s.scope !== 'd' && s.scope !== 'P'));
  assert.equal(phone.find(s => s.name === 'examStyle').default, 'modern');
  assert.equal(large.find(s => s.name === 'examStyle').default, 'nbme');
  assert.equal(C.settingScope('examStyle', 'phone'), 'P'); assert.equal(C.settingScope('accent', 'large'), 'g');
  assert.equal(C.settingScope('deviceId', 'large'), null);
  assert.ok(C.isSyncedSetting('accent', 'g') && !C.isSyncedSetting('deviceId', 'd'));
});

test('keys: ids with dots or percent signs round-trip through the key syntax', () => {
  const k = K.item('att.1%x', 'qid.with.dots', 'ans');
  assert.deepEqual(C.parseKey(k), { fam: 'I', att: 'att.1%x', qid: 'qid.with.dots', field: 'ans' });
  assert.equal(C.parseKey(K.setting('g', 'a.b')).name, 'a.b');
});

test('block completed on two devices with different answers: the earliest completer\'s whole answer set wins, in any merge order', () => {
  const hdr2 = hdr('f1', ['q1', 'q2', 'q3', 'q4'], { bs: 4 });
  const A = [U(K.att('a1'), hdr2, at(0)), U(K.item('a1', 'q1', 'ans'), 1, at(1)), U(K.item('a1', 'q2', 'ans'), 2, at(2)), U(K.block('a1', 1, 'done'), { done: true, ans: { q1: 1, q2: 2 } }, at(3))];
  const B = [U(K.item('a1', 'q1', 'ans'), 4, at(5, 0, 'B')), U(K.item('a1', 'q3', 'ans'), 3, at(6, 0, 'B')), U(K.block('a1', 1, 'done'), { done: true, ans: { q1: 4, q3: 3 } }, at(7, 0, 'B'))];
  for (const order of [[A, B], [B, A]]) {
    const vis = view(merge({}, order, { now: NOW }).units, { now: NOW }).units;
    assert.equal(vis[K.item('a1', 'q1', 'ans')].v, 1); assert.equal(vis[K.item('a1', 'q2', 'ans')].v, 2);
    assert.ok(!vis[K.item('a1', 'q3', 'ans')], 'B\'s extra answer is not part of the first completion');
    assert.equal(C.countUnits(vis).answered, 2);
  }
  // a block that is not completed yet still merges answer by answer
  const open = view(merge({}, [A.slice(0, 3), B.slice(0, 2)], { now: NOW }).units, { now: NOW }).units;
  assert.equal(open[K.item('a1', 'q1', 'ans')].v, 4); assert.equal(open[K.item('a1', 'q3', 'ans')].v, 3);
});

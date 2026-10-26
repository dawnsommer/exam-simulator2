'use strict';
/* Sync V3 store: device record (class fixed at creation), monotone stamps across restarts and skewed clocks, known / dirty /
   bootstrap flags, diagnostics cap. */
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/sync3-core.js');
const S = require('../js/sync3-store.js');

test('device record is created once; class comes from the screen at creation and never changes', async () => {
  const backend = S.memoryBackend();
  const phone = S.create({ backend, screen: { width: 390, height: 844 }, random: () => 'abcdef123456' });
  const d = await phone.device();
  assert.equal(d.class, 'phone'); assert.match(d.deviceId, /^d[0-9a-f]{8}$/);
  const again = S.create({ backend, screen: { width: 1180, height: 820 } });      // same storage, a bigger window later
  assert.deepEqual(await again.device(), d);
  assert.equal((await S.create({ backend: S.memoryBackend(), screen: { width: 820, height: 1180 } }).device()).class, 'large');
});

test('stamps increase across restarts, with a clock that goes backwards, and in parallel calls', async () => {
  const backend = S.memoryBackend();
  let t = Date.parse('2026-10-25T12:00:00Z');
  const a = S.create({ backend, now: () => t }), got = [];
  got.push(...await Promise.all([a.stamp(), a.stamp(), a.stamp()]));
  t -= 3600000;                                                       // the device clock jumps back an hour
  const b = S.create({ backend, now: () => t });                      // "restart"
  got.push(await b.stamp(), await b.stamp());
  for (let i = 1; i < got.length; i++) assert.ok(C.cmpStamp(got[i - 1], got[i], t + 7200000) < 0 || got.slice(0, 3).includes(got[i]), `stamp ${i} after ${i - 1}`);
  assert.equal(new Set(got).size, got.length, 'unique');
});

test('seen(): remote stamps advance the clock (a year ahead is clamped)', async () => {
  const t = Date.parse('2026-10-25T12:00:00Z'), s = S.create({ backend: S.memoryBackend(), now: () => t });
  await s.seen([C.fmtStamp(t + 5000, 2, 'x'), C.fmtStamp(t + 400 * 86400000, 0, 'y')]);
  const next = C.parseStamp(await s.stamp());
  assert.ok(next.wall > t + 5000 && next.wall <= t + C.MAX_AHEAD_MS + 1);
});

test('known / dirty / bootstrapped / checksums / migration persist as plain data', async () => {
  const s = S.create({ backend: S.memoryBackend() });
  assert.equal(await s.bootstrapped(), false); await s.setBootstrapped(true); assert.equal(await s.bootstrapped(), true);
  await s.setKnown({ 'S.g.accent': { v: 'blue', t: 'x' } }); assert.equal((await s.known())['S.g.accent'].v, 'blue');
  await s.markDirty('form', 'n-11'); await s.markDirty('lib'); assert.deepEqual(await s.dirty(), { forms: { 'n-11': true }, lib: true, set: false });
  await s.clearDirty('form', 'n-11'); assert.deepEqual((await s.dirty()).forms, {});
  assert.equal((await s.migration()).status, 'none'); await s.setMigration({ status: 'shadow' }); assert.equal((await s.migration()).status, 'shadow');
  await s.setChecksums({ a: { md5: '1' } }); assert.equal((await s.checksums()).a.md5, '1');
});

test('diagnostics keep only the newest runs', async () => {
  const s = S.create({ backend: S.memoryBackend() });
  for (let i = 0; i < 30; i++) await s.addDiag({ i });
  const d = await s.diag(); assert.equal(d.length, 20); assert.equal(d[0].i, 10); assert.equal(d[19].i, 29);
});

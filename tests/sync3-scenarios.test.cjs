'use strict';
/* Sync V3 scenarios (SYNC_HYBRID_PLAN.md section 10): two or three simulated devices, real core / bridge / store / engine /
   drive modules, one in-memory Drive. The cycle is a test model of Release B (pull -> merge -> apply -> push). */
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/sync3-core.js');
const D = require('../js/sync3-drive.js');
const { World, SimDevice, sha256 } = require('./support/sync3-sim.cjs');
const { K } = C;

const Q = ['q1', 'q2', 'q3', 'q4'];
const blk = (o = {}) => ({ blockName: 'B1', total: 4, questionQids: Q, answers: [null, null, null, null], firstAnswers: [null, null, null, null], flagged: [false, false, false, false], struck: {}, revealed: {}, questionTime: [0, 0, 0, 0], notes: '', blockCompleted: false, answerChangeLog: [], stemHighlightAnchors: {}, explanationHighlightAnchors: {}, ...o });
const att = (id, b = {}, label) => ({ attemptId: id, label: label || id, type: 'initial', createdAt: '2026-10-25T07:00:00Z', session: { blocks: [blk(b)] } });
const prog = (...a) => ({ fileType: 'StepExamSimulatorV10ProgressBundle', bundle: { activeAttemptId: a[0].attemptId, attempts: a } });
const REC = { questionIndex: Q.map((q, i) => ({ qid: q, blockIndex: 0, questionIndex: i })) };
const ans = (dev, uid, a, qi) => { const f = dev.app.forms[uid]; const at = f && f.progress && f.progress.bundle.attempts.find(x => x.attemptId === a); return at ? at.session.blocks[0].answers[qi] : undefined; };
const atts = (dev, uid) => (dev.app.forms[uid] && dev.app.forms[uid].progress ? dev.app.forms[uid].progress.bundle.attempts.map(a => a.attemptId) : []);
const mkWorld = () => { const w = new World(); w.catalog.f1 = { questions: Q }; w.catalog.f2 = { questions: Q }; return w; };
async function pair({ skewB = 0, clsB = 'large' } = {}) {
  const w = mkWorld(), A = new SimDevice(w, 'devA'), B = new SimDevice(w, 'devB', { cls: clsB, skewMs: skewB });
  for (const d of [A, B]) d.install('f1', REC);
  A.setProgress('f1', prog(att('a1')));
  await A.scan(); await A.sync(); w.advance(1); await B.scan(); await B.sync(); await A.sync();
  assert.deepEqual(atts(B, 'f1'), ['a1'], 'B received the starting attempt');
  return { w, A, B };
}
const echoFree = async (...devs) => { for (const d of devs) { const r = await d.scan(); assert.equal(r.totals.changed, 0, d.name + ' re-stamped something it only received (echo)'); } };

test('offline on both: different forms, and the same attempt with different questions: everything is kept, no echo', async () => {
  const w = mkWorld(), A = new SimDevice(w, 'devA'), B = new SimDevice(w, 'devB');
  A.install('f1', REC, prog(att('a1', { answers: [1, null, null, null], firstAnswers: [1, null, null, null] })));
  B.install('f2', REC, prog(att('b1', { answers: [null, 2, null, null], firstAnswers: [null, 2, null, null] })));
  A.online = false; B.online = false; await A.scan(); await B.scan();
  A.online = true; B.online = true; await A.sync(); await B.sync(); await A.sync();
  assert.equal(ans(A, 'f2', 'b1', 1), 2); assert.equal(ans(B, 'f1', 'a1', 0), 1);
  const { A: A2, B: B2 } = await pair();
  A2.online = false; B2.online = false;
  A2.app.forms.f1.progress.bundle.attempts[0].session.blocks[0].answers[0] = 3; B2.app.forms.f1.progress.bundle.attempts[0].session.blocks[0].answers[1] = 1;
  await A2.scan(); A2.world.advance(1); await B2.scan();
  A2.online = true; B2.online = true; await A2.sync(); await B2.sync(); await A2.sync();
  for (const d of [A2, B2]) { assert.equal(ans(d, 'f1', 'a1', 0), 3); assert.equal(ans(d, 'f1', 'a1', 1), 1); }
  await echoFree(A, B, A2, B2);
});

test('same question changed on both: the newer answer wins, the first answer is the earlier one, both are in the log', async () => {
  const { w, A, B } = await pair();
  A.online = false; B.online = false;
  const a = A.app.forms.f1.progress.bundle.attempts[0].session.blocks[0], b = B.app.forms.f1.progress.bundle.attempts[0].session.blocks[0];
  a.answers[0] = 2; a.firstAnswers[0] = 2; a.answerChangeLog = [{ item: 1, from: null, to: 2 }]; await A.scan();
  w.advance(5);
  b.answers[0] = 3; b.firstAnswers[0] = 3; b.answerChangeLog = [{ item: 1, from: null, to: 3 }]; await B.scan();
  A.online = true; B.online = true; await B.sync(); await A.sync(); await B.sync();
  for (const d of [A, B]) {
    assert.equal(ans(d, 'f1', 'a1', 0), 3);
    const blk0 = d.app.forms.f1.progress.bundle.attempts[0].session.blocks[0];
    assert.equal(blk0.firstAnswers[0], 2, 'first answer = the earlier one');
    assert.deepEqual(blk0.answerChangeLog.map(e => e.to).sort(), [2, 3], 'both changes are in the log');
  }
  await echoFree(A, B);
});

test('a new or wiped device online gets everything back and deletes nothing', async () => {
  const { w, A } = await pair();
  A.app.forms.f1.progress.bundle.attempts[0].session.blocks[0].answers[2] = 1; await A.scan(); await A.sync();
  const W = new SimDevice(w, 'devW');                                    // wiped: no forms, no progress, never synced
  await W.scan(); const r = await W.sync(); assert.ok(r.changes.length > 0);
  assert.equal(ans(W, 'f1', 'a1', 2), 1, 'progress restored'); assert.ok(W.app.forms.f1, 'form installed from the catalog');
  await A.sync(); assert.equal(ans(A, 'f1', 'a1', 2), 1, 'nothing deleted on the other device');
  const known = await W.store.known(); assert.ok(!Object.keys(known).some(k => k.endsWith('.del') || k.endsWith('.reset')), 'the wiped device wrote no tombstone');
  await echoFree(W, A);
});

test('wiped device offline works one form: other forms untouched, that form gets a second attempt that opens, the old one is kept', async () => {
  const w = mkWorld(), A = new SimDevice(w, 'devA');
  A.install('f1', REC, prog(att('a1', { answers: [1, 1, null, null], firstAnswers: [1, 1, null, null] }))); A.install('f2', REC, prog(att('c1', { answers: [2, null, null, null], firstAnswers: [2, null, null, null] })));
  await A.scan(); await A.sync();
  const B = new SimDevice(w, 'devB'); B.online = false;
  B.install('f1', REC, prog(att('b1', { answers: [null, null, 3, null], firstAnswers: [null, null, 3, null] })));   // fresh start on the wiped device
  await w.advance(10); await B.scan(); B.online = true; await B.sync(); await A.sync();
  for (const d of [A, B]) {
    assert.deepEqual(atts(d, 'f1').sort(), ['a1', 'b1'], 'both attempts of f1 survive'); assert.equal(ans(d, 'f1', 'a1', 0), 1); assert.equal(ans(d, 'f1', 'b1', 2), 3);
    assert.equal(d.app.forms.f1.progress.bundle.activeAttemptId, 'b1', 'the newest active stamp decides which attempt opens');
    assert.equal(ans(d, 'f2', 'c1', 0), 2, 'f2 untouched');
  }
  await echoFree(A, B);
});

test('delete an attempt on A, offline work on B: B\'s newer unit survives (the attempt reappears), older ones stay hidden', async () => {
  const w = mkWorld(), A = new SimDevice(w, 'devA'), B = new SimDevice(w, 'devB');
  A.install('f1', REC, prog(att('a1', { answers: [1, 1, null, null], firstAnswers: [1, 1, null, null] }), att('a2', { answers: [2, null, null, null], firstAnswers: [2, null, null, null] })));
  B.install('f1', REC);
  await A.scan(); await A.sync(); await B.sync();
  assert.deepEqual(atts(B, 'f1').sort(), ['a1', 'a2']);
  B.online = false; w.advance(5);
  A.setProgress('f1', prog(att('a2', { answers: [2, null, null, null], firstAnswers: [2, null, null, null] })));          // a1 deleted on A
  await A.scan(); await A.sync(); w.advance(5);
  B.app.forms.f1.progress.bundle.attempts.find(a => a.attemptId === 'a1').session.blocks[0].answers[3] = 0; await B.scan();   // B works on a1 offline, later
  B.online = true; await B.sync(); await A.sync();
  for (const d of [A, B]) { assert.deepEqual(atts(d, 'f1').sort(), ['a1', 'a2']); assert.equal(ans(d, 'f1', 'a1', 3), 0); assert.equal(ans(d, 'f1', 'a1', 0), null, 'older answers of the deleted attempt stay hidden'); }
});

test('reset all progress on A, offline work on B: newer units survive, older hidden; reset alone deletes everywhere', async () => {
  const { w, A, B } = await pair();
  A.app.forms.f1.progress.bundle.attempts[0].session.blocks[0].answers[0] = 1; await A.scan(); await A.sync(); await B.sync();
  B.online = false; w.advance(5);
  A.setProgress('f1', null); await A.scan(); await A.sync(); w.advance(5);                                                  // A: delete progress -> F.reset
  B.app.forms.f1.progress.bundle.attempts[0].session.blocks[0].answers[2] = 3; await B.scan();
  B.online = true; await B.sync(); await A.sync();
  for (const d of [A, B]) { assert.equal(ans(d, 'f1', 'a1', 2), 3, 'B\'s newer answer survived'); assert.equal(ans(d, 'f1', 'a1', 0), null, 'older answer hidden'); }
  const { A: A3, B: B3 } = await pair();
  A3.setProgress('f1', null); await A3.scan(); await A3.sync(); await B3.sync();
  assert.deepEqual(atts(B3, 'f1'), [], 'a plain reset removes the progress on the other device too');
});

test('uninstall on A, offline work on B: the form leaves both, B\'s newer progress is kept (visible once re-installed), older hidden', async () => {
  const { w, A, B } = await pair();
  A.app.forms.f1.progress.bundle.attempts[0].session.blocks[0].answers[0] = 1; await A.scan(); await A.sync(); await B.sync();
  B.online = false; w.advance(5);
  A.uninstall('f1'); await A.scan(); await A.sync(); w.advance(5);
  B.app.forms.f1.progress.bundle.attempts[0].session.blocks[0].answers[3] = 2; await B.scan();
  B.online = true; await B.sync(); await A.sync();
  assert.ok(!A.app.forms.f1 && !B.app.forms.f1, 'uninstalled on both');
  const known = await A.store.known(), vis = C.view(known, { now: A.now() }).units;
  assert.equal(vis[K.item('f1:a1', 'q4', 'ans')].v, 2); assert.ok(!vis[K.item('f1:a1', 'q1', 'ans')], 'older progress stays hidden while the form is uninstalled');
});

test('delete then re-import: installed again everywhere, old progress still there', async () => {
  const { w, A, B } = await pair();
  A.app.forms.f1.progress.bundle.attempts[0].session.blocks[0].answers[0] = 1; await A.scan(); await A.sync(); await B.sync();
  A.uninstall('f1'); await A.scan(); await A.sync(); await B.sync(); assert.ok(!B.app.forms.f1);
  w.advance(5); A.install('f1', { ...REC, bankHash: 'H2' }); await A.scan(); await A.sync(); await B.sync();
  assert.ok(B.app.forms.f1, 'installed again'); assert.equal(ans(B, 'f1', 'a1', 0), 1);
});

test('form update on one device: the highest revision everywhere, progress kept by QID', async () => {
  const { w, A, B } = await pair();
  B.app.forms.f1.progress.bundle.attempts[0].session.blocks[0].answers[1] = 3; await B.scan(); await B.sync(); await A.sync();
  A.app.forms.f1.rec.bankHash = 'H2'; A.app.forms.f1.rec.revisionSeq = 2; await A.scan(); await A.sync();
  B.app.forms.f1.rec.bankHash = 'H1'; B.app.forms.f1.rec.revisionSeq = 1; w.advance(5); await B.scan(); await B.sync(); await A.sync(); await B.sync();   // B (behind) writes later
  for (const d of [A, B]) { assert.equal(d.app.forms.f1.rec.revisionSeq, 2); assert.equal(d.app.forms.f1.rec.bankHash, 'H2'); assert.equal(ans(d, 'f1', 'a1', 1), 3); }
});

test('rename / colour on both: the newest value per field', async () => {
  const { w, A, B } = await pair();
  A.online = B.online = false;
  A.app.forms.f1.rec.displayName = 'Alpha'; A.app.forms.f1.rec.color = 'red'; await A.scan(); w.advance(5);
  B.app.forms.f1.rec.displayName = 'Beta'; B.app.forms.f1.rec.color = 'blue'; await B.scan(); w.advance(5);
  A.app.forms.f1.rec.color = 'green'; await A.scan();                                                    // A's colour is the newest of all
  A.online = B.online = true; await A.sync(); await B.sync(); await A.sync();
  for (const d of [A, B]) assert.equal(d.app.forms.f1.rec.displayName, 'Beta');
  const k = await B.store.known(); assert.equal(k[K.libField('f1', 'color')].v, 'green');
});

test('custom form imported on A: B downloads the content by hash, verifies it, installs it, then shows the progress (no echo)', async () => {
  const w = mkWorld(), A = new SimDevice(w, 'devA'), B = new SimDevice(w, 'devB');
  const text = JSON.stringify({ title: 'Custom', blocks: [{ questions: Q.map(q => ({ qid: q })) }] }, null, 2), sha = sha256(text);
  A.install('fc', { custom: true, ...REC }, prog(att('a1', { answers: [1, null, null, null], firstAnswers: [1, null, null, null] })), text);
  A.app.forms.fc.assets = [{ path: 'assets/fc/img1.png', b64: Buffer.from('PNGDATA').toString('base64') }];
  await A.scan(); const ra = await A.sync();
  assert.deepEqual(ra.content.uploaded, ['fc']);
  const names = w.drive.names(), man = w.drive.json(D.N.content(sha));
  assert.ok(names.includes(D.N.content(sha, 0)) && man.type === 'step-sync3-content' && man.parts === 1 && man.assets.length === 1, 'manifest + text part + asset part');
  assert.ok(names.includes(D.N.content(sha256(Buffer.from('PNGDATA')), 0)));
  const rb = await B.sync();
  assert.deepEqual(rb.installed, ['fc']); assert.equal(B.app.forms.fc.text, text); assert.equal(B.app.forms.fc.assets[0].b64, Buffer.from('PNGDATA').toString('base64'));
  assert.equal(ans(B, 'fc', 'a1', 0), 1, 'progress applied right after the install');
  await echoFree(A, B);
  const before = A.reads; await A.sync(); await B.sync(); assert.equal(A.reads, before, 'write-once: content is not read or uploaded again');
  assert.equal(w.drive.names().filter(n => n === D.N.content(sha)).length, 1);
});

test('form content: waits until the manifest exists, V2 library file is copied on the server, imported slots travel too, catalog forms wait', async () => {
  const w = mkWorld(), A = new SimDevice(w, 'devA'), B = new SimDevice(w, 'devB');
  const text = JSON.stringify({ title: 'N-9', blocks: [{ questions: Q.map(q => ({ qid: q })) }] }), sha = sha256(text);
  A.install('N-9', { imported: true, ...REC }, prog(att('a1', { answers: [2, null, null, null], firstAnswers: [2, null, null, null] })), text);
  A.install('upd', { ...REC }, prog(att('u1')));                                                        // from the update service
  w.v2Library = [{ path: 'forms/N-9.json', fileId: w.drive.put('LIB_forms_N-9.json', text), contentHash: sha, size: text.length }];
  await A.scan();
  // A pushes units but crashes before the manifest: B sees units and waits
  const up = A.driveApi.upload; let n = 0; A.driveApi.upload = async (name, body) => { if (name === D.N.content(sha)) throw new Error('offline'); n++; return up(name, body); };
  const r1 = await A.sync(); assert.ok(r1.content.errors['N-9']); assert.ok(w.drive.names().includes(D.N.content(sha, 0)), 'part 0 copied from the V2 library file');
  const rb = await B.sync(); assert.equal(rb.waitReasons['N-9'], 'content'); assert.equal(rb.waitReasons.upd, 'catalog'); assert.ok(!B.app.forms['N-9']);
  A.driveApi.upload = up; const r2 = await A.sync(); assert.deepEqual(r2.content.uploaded, ['N-9']);
  const p0 = w.drive.byName(D.N.content(sha, 0)).id; assert.ok(!w.drive.log.some(l => l === 'PATCH /upload/drive/v3/files/' + p0), 'part 0 was copied on the server, never uploaded from the device');
  const rb2 = await B.sync(); assert.deepEqual(rb2.installed, ['N-9']); assert.equal(ans(B, 'N-9', 'a1', 0), 2);
  assert.equal(B.app.forms['N-9'].rec.imported, true);
});

test('form content: a corrupt part, an id already used by another form and an install that is busy all leave the form waiting', async () => {
  const w = mkWorld(), A = new SimDevice(w, 'devA'), B = new SimDevice(w, 'devB');
  const text = JSON.stringify({ blocks: [{ questions: Q.map(q => ({ qid: q })) }] }), sha = sha256(text);
  A.install('fx', { custom: true, ...REC }, prog(att('a1', { answers: [3, null, null, null], firstAnswers: [3, null, null, null] })), text);
  await A.scan(); await A.sync();
  const part = w.drive.byName(D.N.content(sha, 0)), good = part.body; part.body = good.replace('q1', 'qX');
  let r = await B.sync(); assert.equal(r.waitReasons.fx, 'content-error'); assert.match(r.contentErrors.fx, /does not match its hash/); assert.ok(!B.app.forms.fx);
  assert.equal(r.failed.fx, undefined, 'a content problem does not fail the cycle (no backoff)');
  part.body = good;
  B.install('other', { custom: true, id: 'fx', ...REC }, null, 'different');                          // same file id, different form
  r = await B.sync(); assert.equal(r.waitReasons.fx, 'id-taken');
  delete B.app.forms.other; B.busy = true; r = await B.sync(); assert.equal(r.waitReasons.fx, 'busy');
  B.busy = false; r = await B.sync(); assert.deepEqual(r.installed, ['fx']); assert.equal(ans(B, 'fx', 'a1', 0), 3);
});

test('form content: uploads stop at the per-cycle budget and continue on the next cycle', async () => {
  const Sync = require('../js/sync3-sync.js'), w = mkWorld(), A = new SimDevice(w, 'devA');
  for (const id of ['c1', 'c2', 'c3']) A.install(id, { custom: true, ...REC }, null, JSON.stringify({ id, pad: 'x'.repeat(50) }));
  await A.scan(); A.getCycle(); const known = await A.store.known();
  const r = await Sync.pushContent({ files: [], drive: A.driveApi, Drive: D, content: A.content, store: A.store, known, budget: 10 });
  assert.equal(r.uploaded.length, 1); assert.equal(r.deferred, 2);
  const r2 = await Sync.pushContent({ files: await A.driveApi.listV3(), drive: A.driveApi, Drive: D, content: A.content, store: A.store, known, budget: 10 });
  assert.equal(r2.uploaded.length, 1); assert.equal(r2.deferred, 1);
  const r3 = await A.sync(); assert.equal(r3.content.uploaded.length, 1, 'the normal budget takes the rest'); assert.equal(r3.content.deferred, 0);
});

test('same block open on two devices: online = prompt and takeover; the holder is told on its next cycle', () => {
  const now = Date.parse('2026-10-25T10:00:00Z');
  const leases = { devA: C.leaseTake({}, 'a1', 1, now - 2 * 60000) };
  const c = C.leaseConflict(leases, 'devB', 'a1', 1, now);
  assert.equal(c.dev, 'devA'); assert.equal(c.minutesAgo, 2);
  assert.equal(C.leaseConflict(leases, 'devB', 'a1', 2, now), null, 'another block');
  assert.equal(C.leaseConflict(leases, 'devA', 'a1', 1, now), null, 'my own lease');
  assert.equal(C.leaseConflict(leases, 'devB', 'a1', 1, now + 7 * 60000).dev, 'devA', 'heartbeat younger than 10 min');
  assert.equal(C.leaseConflict(leases, 'devB', 'a1', 1, now + 20 * 60000), null, 'stale heartbeat: no prompt');
  const both = { ...leases, devB: C.leaseTake({}, 'a1', 1, now) };                                          // Continue here = take over
  assert.deepEqual(C.leaseLost(both, 'devA', 'a1', 1), { dev: 'devB' }); assert.equal(C.leaseLost(both, 'devB', 'a1', 1), null);
  const beat = C.leaseBeat(both.devA, 'a1', now + 60000); assert.equal(beat.a1.heartbeat, new Date(now + 60000).toISOString()); assert.equal(beat.a1.since, both.devA.a1.since);
  assert.deepEqual(C.leaseDrop(both.devA, 'a1'), {});
});

test('same block open on two devices: offline on both: answers merge by the rules, the newer suspended state wins', async () => {
  const { w, A, B } = await pair();
  A.online = B.online = false;
  const a = A.app.forms.f1.progress.bundle.attempts[0].session.blocks[0], b = B.app.forms.f1.progress.bundle.attempts[0].session.blocks[0];
  a.answers[0] = 1; a.firstAnswers[0] = 1; a.current = 3; a.blockRemainingSeconds = 900; await A.scan(); w.advance(3);
  b.answers[1] = 2; b.firstAnswers[1] = 2; b.current = 5; b.blockRemainingSeconds = 700; await B.scan();
  A.online = B.online = true; await A.sync(); await B.sync(); await A.sync();
  for (const d of [A, B]) { const bl = d.app.forms.f1.progress.bundle.attempts[0].session.blocks[0]; assert.equal(bl.answers[0], 1); assert.equal(bl.answers[1], 2); assert.equal(bl.current, 5); assert.equal(bl.blockRemainingSeconds, 700); }
  await echoFree(A, B);
});

test('an open block is never re-rendered under the user: merged units wait until the block is left', async () => {
  const { w, A, B } = await pair();
  B.open = { uid: 'f1', att: 'a1', block: 1 };
  A.app.forms.f1.progress.bundle.attempts[0].session.blocks[0].answers[0] = 2; await A.scan(); await A.sync();
  const r = await B.sync(); assert.deepEqual(r.deferred, ['f1']); assert.equal(ans(B, 'f1', 'a1', 0), null, 'not applied while open');
  B.open = null; await B.sync(); assert.equal(ans(B, 'f1', 'a1', 0), 2, 'applied once the block is left');
});

test('suspend on iPad, resume on phone: the suspended state arrives and the phone resumes in Modern', async () => {
  const { w, A, B } = await pair({ clsB: 'phone' });
  const a = A.app.forms.f1.progress.bundle.attempts[0].session.blocks[0];
  a.answers[0] = 1; a.firstAnswers[0] = 1; a.current = 2; a.blockRemainingSeconds = 1200; a.dayRemainingSeconds = 5000; a.resumeCapturedAt = '2026-10-25T09:00:00Z';
  await A.scan(); await A.sync(); await B.sync();
  const bl = B.app.forms.f1.progress.bundle.attempts[0].session.blocks[0];
  assert.equal(bl.current, 2); assert.equal(bl.blockRemainingSeconds, 1200); assert.equal(bl.answers[0], 1);
  assert.equal(B.getSetting('examStyle'), 'modern');
});

test('settings: NBME chosen on iPad is followed by large devices; a phone stays Modern; shared settings reach everyone', async () => {
  const w = mkWorld(), A = new SimDevice(w, 'devA'), L2 = new SimDevice(w, 'devD'), P = new SimDevice(w, 'devP', { cls: 'phone' });
  assert.equal(A.getSetting('examStyle'), 'nbme'); assert.equal(P.getSetting('examStyle'), 'modern');
  A.setSetting('examStyle', 'modern'); A.setSetting('accent', 'teal'); await A.scan(); await A.sync();
  A.setSetting('examStyle', 'nbme'); await A.scan(); await A.sync();
  await L2.sync(); await P.sync();
  assert.equal(L2.getSetting('examStyle'), 'nbme', 'desktop follows the iPad'); assert.equal(P.getSetting('examStyle'), 'modern', 'the phone reads its own scope only');
  assert.equal(P.getSetting('accent'), 'teal'); assert.equal(L2.getSetting('accent'), 'teal');
  P.setSetting('examStyle', 'nbme'); await P.scan(); await P.sync(); await A.sync(); await L2.sync();
  assert.equal(A.getSetting('examStyle'), 'nbme'); assert.throws(() => A.setSetting('deviceId', 'x'), /not a synced setting/);
  const known = await P.store.known(); assert.ok(!Object.keys(known).some(k => /deviceId|fullScreen|zoom|qidMigration/.test(k)), 'device-only settings never sync');
});

test('clock a year ahead / behind: the skew is flagged, both devices end with the same result, and a behind clock that has synced does not lose', async () => {
  const w = mkWorld(), A = new SimDevice(w, 'devA'), B = new SimDevice(w, 'devB', { skewMs: 365 * 86400000 });
  A.setSetting('accent', 'blue'); await A.scan(); await A.sync(); w.advance(60);
  await B.sync(); B.setSetting('accent', 'teal'); await B.scan(); const rb = await B.sync(); const ra = await A.sync();      // B has synced once, so its change is a real (year-ahead) edit
  assert.ok(ra.skewed.length >= 1, 'a stamp a year ahead is flagged'); assert.equal(A.getSetting('accent'), B.getSetting('accent'), 'same result on both');
  const behind = new SimDevice(w, 'devC', { skewMs: -365 * 86400000 });
  await behind.sync();                                                                                         // sees the others' stamps first
  behind.setSetting('accent', 'crimson'); await behind.scan(); await behind.sync(); await A.sync(); await B.sync();
  assert.equal(A.getSetting('accent'), B.getSetting('accent'));
  assert.equal(behind.getSetting('accent'), 'crimson', 'its stamp follows the clock it has seen, so the late write is not ordered before older ones');
  void rb;
});

test('settings found before a device\'s first pull only fill gaps: the cloud value wins, a setting the cloud does not have is kept and shared', async () => {
  const w = mkWorld(), A = new SimDevice(w, 'devA'); A.setSetting('accent', 'blue'); await A.scan(); await A.sync(); w.advance(60);
  const B = new SimDevice(w, 'devB'); B.setSetting('accent', 'teal'); B.setSetting('libFilters', 'progress'); await B.scan();
  await B.sync(); await A.sync();
  assert.equal(B.getSetting('accent'), 'blue', 'the joining device takes the cloud setting'); assert.equal(A.getSetting('libFilters'), 'progress', 'its own extra setting reaches the others');
  B.setSetting('accent', 'teal'); await B.scan(); await B.sync(); await A.sync(); assert.equal(A.getSetting('accent'), 'teal', 'after the first pull its edits win as usual');
  await echoFree(A, B);
});

test('crash mid-upload, quota full, auth expired: the old replica file stays intact, work continues locally, dirty is kept and retried', async () => {
  const { w, A, B } = await pair();
  const me = await A.id(), name = D.N.form(me, 'f1'), before = w.drive.byName(name).body;
  A.app.forms.f1.progress.bundle.attempts[0].session.blocks[0].answers[0] = 1; await A.scan();
  for (const fault of ['crashMidUpload', 'quotaFull', 'authExpired']) {
    w.drive.faults[fault] = true;
    const r = await A.sync().catch(e => ({ thrown: String(e.message) }));
    assert.ok(r.pushError || r.thrown, fault + ' surfaced'); assert.equal(w.drive.byName(name).body, before, 'old file intact after ' + fault);
    delete w.drive.faults[fault];
    assert.equal(ans(A, 'f1', 'a1', 0), 1, 'local work continues'); assert.equal((await A.store.dirty()).forms.f1, true, 'dirty kept for the retry');
  }
  w.advance(2); await A.sync(); await B.sync(); assert.equal(ans(B, 'f1', 'a1', 0), 1, 'the retry went through');
  assert.equal((await A.store.dirty()).forms.f1 === true, false);
});

test('a corrupt remote file is skipped, never merged, and the other replicas still merge', async () => {
  const { w, A, B } = await pair();
  const C3 = new SimDevice(w, 'devC'); A.app.forms.f1.progress.bundle.attempts[0].session.blocks[0].answers[0] = 2; await A.scan(); await A.sync();
  w.drive.set(D.N.form('devBad', 'f1'), '{not json');
  await C3.sync(); assert.equal(ans(C3, 'f1', 'a1', 0), 2);
});

test('three devices in any sync order converge to the same units', async () => {
  const orders = [['A', 'B', 'C', 'A', 'B', 'C'], ['C', 'B', 'A', 'C', 'B', 'A'], ['B', 'A', 'C', 'B', 'C', 'A']];
  const finals = [];
  for (const order of orders) {
    const w = mkWorld(), d = { A: new SimDevice(w, 'devA'), B: new SimDevice(w, 'devB'), C: new SimDevice(w, 'devC') };
    for (const x of Object.values(d)) x.install('f1', REC);
    d.A.setProgress('f1', prog(att('a1')));
    await d.A.scan(); await d.A.sync(); for (const x of [d.B, d.C]) await x.sync();
    const mods = { A: [0, 1], B: [1, 2], C: [3, 0] };
    for (const [n, [qi, v]] of Object.entries(mods)) { w.advance(1); d[n].app.forms.f1.progress.bundle.attempts[0].session.blocks[0].answers[qi] = v + 1; d[n].app.forms.f1.progress.bundle.attempts[0].session.blocks[0].firstAnswers[qi] = v + 1; await d[n].scan(); }
    for (const n of order) await d[n].sync();
    for (const n of ['A', 'B', 'C']) await d[n].sync();
    const k = await d.A.store.known(); finals.push(JSON.stringify(Object.keys(k).sort().map(x => [x, k[x].v, k[x].t])));
    const flat = m => JSON.stringify(Object.keys(m).sort().map(x => [x, m[x].v]));
    for (const n of ['B', 'C']) { const other = await d[n].store.known(); assert.equal(flat(other), flat(k), 'devices agree'); }
  }
  assert.equal(new Set(finals).size, 1, 'the sync order does not change the result');
});

test('block completed on both devices offline with different answers: the earliest completer\'s whole answer set wins on both, no echo', async () => {
  const { w, A, B } = await pair();
  A.online = B.online = false;
  const a = A.app.forms.f1.progress.bundle.attempts[0].session.blocks[0], b = B.app.forms.f1.progress.bundle.attempts[0].session.blocks[0];
  a.answers = [1, 2, null, null]; a.firstAnswers = [1, 2, null, null]; a.blockCompleted = true; await A.scan(); w.advance(30);
  b.answers = [3, null, 1, 0]; b.firstAnswers = [3, null, 1, 0]; b.blockCompleted = true; await B.scan();
  A.online = B.online = true; await B.sync(); await A.sync(); await B.sync();
  for (const d of [A, B]) { const bl = d.app.forms.f1.progress.bundle.attempts[0].session.blocks[0]; assert.deepEqual(bl.answers, [1, 2, null, null]); assert.equal(bl.blockCompleted, true); }
  await echoFree(A, B);
});

test('form content uploads in the background in the app: the sync returns at once and the content lands afterwards', async () => {
  const Sync = require('../js/sync3-sync.js'), w = mkWorld(), A = new SimDevice(w, 'devA');
  const text = JSON.stringify({ blocks: [{ questions: Q.map(q => ({ qid: q })) }] }), sha = sha256(text);
  A.install('fbg', { custom: true, ...REC }, null, text); A.getCycle();
  const cyc = Sync.createCycle({ store: A.store, drive: A.driveApi, engine: A.engine, applier: A.applier, Drive: D, content: A.content, contentInBackground: true, now: A.now });
  await A.scan(); const r = await cyc.run({ reason: 'test' });
  assert.equal(r.content.background, true);
  await cyc.contentDone(); assert.ok(w.drive.names().includes(D.N.content(sha)), 'content uploaded after the cycle returned');
  assert.equal((await A.store.getRaw('lastContent')).uploaded, 1);
  const r2 = await cyc.run({ reason: 'test', content: false }); assert.equal(r2.content, null, 'the upgrade cycles skip content');
});

test('"Delete progress" for a form this device does not have: every device that has the form loses that progress; no echo', async () => {
  const Sync = require('../js/sync3-sync.js'), w = mkWorld(), A = new SimDevice(w, 'devA'), B = new SimDevice(w, 'devB');
  A.install('fz', REC, prog(att('a1', { answers: [1, 2, null, null], firstAnswers: [1, 2, null, null] })));      // fz is not available to B
  await A.scan(); await A.sync(); w.advance(1); const rb = await B.sync();
  assert.ok(!B.app.forms.fz && rb.waitReasons.fz, 'B lacks fz: its progress waits');
  const k0 = await B.store.known(); assert.ok(Sync.attemptIdsOf(C.view(k0).units, 'fz').length, 'B knows the waiting progress');
  w.advance(1); await Sync.resetFormProgress({ store: B.store, uid: 'fz' }); await B.sync(); w.advance(1); await A.sync();
  assert.equal(A.app.forms.fz.progress, null, 'deleted on the device that has the form');
  assert.equal(Sync.attemptIdsOf(C.view(await B.store.known()).units, 'fz').length, 0, 'nothing waits on B any more');
  await echoFree(A, B);
});

test('the user\'s own Delete progress resets the form even when this device has no "seen" record of its attempts (it used to come back with the next sync)', async () => {
  const { w, A, B } = await pair();
  await A.store.setRaw('seenLocal', {});                       // e.g. attempts that arrived from the V2 legacy copy / an older install: never marked as shown here
  A.setProgress('f1', null); await A.scan(); await A.sync(); await B.sync();
  assert.deepEqual(atts(A, 'f1'), ['a1'], 'a missing file alone (no delete event) still never deletes what this device has not shown: the attempt is applied back');
  A.setProgress('f1', null); await A.store.setRaw('explicitReset', { f1: 1 }); await A.scan(); await A.sync(); w.advance(5); await B.sync(); await A.sync();
  assert.deepEqual(atts(A, 'f1'), [], 'explicit delete: gone here');
  assert.deepEqual(atts(B, 'f1'), [], 'and on the other device');
  assert.deepEqual(await A.store.getRaw('explicitReset', {}), {}, 'the mark is used up by one scan');
});

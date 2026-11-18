'use strict';
/* Qbanks data layer (both HTMLs + Sync v3 adapter). The pure helpers sit between QBDATA-PURE markers inside the HTML
   (the Qbanks `QB` block before StepLibraryBridge); this file evaluates exactly that text, so it tests the shipped code.
   Browser behaviour (bridge, import, delete, tags, filter pool) is covered by tools/headless/v3-probe-qbanks-data.js.
   Shared by both apps: this file is byte-identical in the Local tests/ and the iPad tests/ folder. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const find = (...c) => c.map((p) => path.join(__dirname, p)).find((p) => fs.existsSync(p));
const LOCAL = find('../Step_Exam_Simulator_v22.14.html', '../../Step_Exam_Simulator_v22.14.html');
const IPAD = find('../Step Simulator IPAD/index.html', '../index.html');
const CORE_PATH = find('../qbanks-core.js');
const BRIDGE_PATH = find('../Step Simulator IPAD/js/sync3-bridge.js', '../js/sync3-bridge.js');
const SYNC_PATH = find('../Step Simulator IPAD/js/sync3-sync.js', '../js/sync3-sync.js');
const html = {}; if (LOCAL) html.local = fs.readFileSync(LOCAL, 'utf8'); if (IPAD) html.ipad = fs.readFileSync(IPAD, 'utf8');
const any = html.local || html.ipad;
const Core = require(CORE_PATH);

const region = (h) => { const a = h.indexOf('/* QBDATA-PURE-BEGIN */'), b = h.indexOf('/* QBDATA-PURE-END */'); assert.ok(a > 0 && b > a, 'pure region markers present'); return h.slice(a, b); };
const QBP = new Function(region(any) + ';return QBP;')();
const line = (h, startsWith) => { const a = h.indexOf(startsWith); assert.ok(a >= 0, startsWith); const b = h.indexOf('\n', a); return h.slice(a, b < 0 ? undefined : b); };

test('both apps carry the identical Qbanks data block and bridge spread', () => {
  const blocks = Object.values(html).map((h) => { const a = h.indexOf('const QB=(function(){'), b = h.indexOf('QB.install();'); assert.ok(a > 0 && b > a); return h.slice(a, b); });
  if (blocks.length === 2) assert.equal(blocks[0], blocks[1], 'Local and iPad QB blocks are byte-identical');
  for (const h of Object.values(html)) {
    assert.ok(h.includes('...QB.bridge'), 'bridge spreads the Qbanks members');
    ['qbanks', 'qbanksSetFilter', 'qbanksAvailable', 'qbanksImportPreview', 'qbanksImport', 'qbanksUpdateBank', 'qbanksDeleteBank', 'qbanksAcceptSuggestions', 'qbanksSetTag', 'qbanksExamQuestion'].forEach((k) => assert.ok(new RegExp('\\b' + k + ':').test(h.slice(h.indexOf('const bridge={'))), k));
  }
});

test('script tags: core after qid-migration, qbanks.js after analysis.js (iPad with the release ?v=)', () => {
  if (html.local) {
    const h = html.local, q = h.indexOf('<script src="./qid-migration.js"></script>');
    assert.ok(q > 0 && h.indexOf('<script src="./qbanks-core.js"></script>') === q + '<script src="./qid-migration.js"></script>\n'.length);
    assert.ok(h.indexOf('<script src="./qbanks.js"></script>') > h.indexOf('<script src="./analysis.js"></script>'));
  }
  if (html.ipad) {
    const h = html.ipad, v = (h.match(/analysis\.js\?v=(\d+)/) || [])[1], at = f => h.indexOf('<script src="./' + f + '?v=' + v + '"></script>');
    assert.ok(v && at('qbanks-core.js') > at('js/qid-migration.js') && at('js/qid-migration.js') > 0);
    assert.ok(at('qbanks.js') > at('analysis.js') && at('analysis.js') > 0);
    const root = path.dirname(IPAD);
    for (const f of ['sw.js', 'app-update.js']) { const t = fs.readFileSync(path.join(root, f), 'utf8'); assert.ok(t.includes('"./qbanks-core.js?v=') && t.includes('"./qbanks.js?v='), f); }
    assert.ok(/'qbanks-core\.js','qbanks\.js'/.test(fs.readFileSync(path.join(root, 'tools', 'publish.mjs'), 'utf8')));
  }
});

test('questionIndex rows gain system + discipline in both builders', () => {
  for (const h of Object.values(html)) assert.ok(/discipline:String\(q\.discipline==null\?'':q\.discipline\)\.trim\(\),recognizer:/.test(h) && /system:String\(q\.system==null\?'':q\.system\)\.trim\(\)/.test(h));
});

test('slug, bank id and form id rules', () => {
  assert.equal(QBP.slugOf('AMBOSS Step 1 / 2'), 'AMBOSS-STEP', 'cut at 12 characters, no trailing dash');
  assert.equal(QBP.slugOf('  !!  '), 'BANK');
  assert.equal(QBP.slugOf('abcdefghijklmnopqrstuvwxyz'), 'ABCDEFGHIJKL');
  assert.equal(QBP.bankIdOfSlug('STEP-1'), 'qb-step-1');
  assert.equal(QBP.nextFormId('AB', []), 'QB-AB-01');
  assert.equal(QBP.nextFormId('AB', ['QB-AB-01', 'QB-AB-02']), 'QB-AB-03');
  assert.equal(QBP.slugFromFormId('QB-STEP-1-02'), 'STEP-1');
  assert.equal(QBP.slugFromFormId('N-11'), '');
  assert.equal(QBP.freeSlug('AB', ['N-11'], []), 'AB');
  assert.equal(QBP.freeSlug('AB', ['QB-AB-01'], ['qb-ab']), 'AB2');
  assert.equal(QBP.freeSlug('AB', ['QB-AB2-01'], ['qb-ab']), 'AB3');
  assert.ok(/^[A-Za-z0-9_-]+$/.test(QBP.nextFormId(QBP.slugOf('Step 2 CK!'), [])), 'ids stay valid for file names and sync names');
});

test('file readers: zip junk, json choice, question extraction, depth order', () => {
  assert.equal(QBP.isJunk('__MACOSX/a.json'), true); assert.equal(QBP.isJunk('x/._a.json'), true); assert.equal(QBP.isJunk('x/a.json'), false);
  assert.equal(QBP.skipJson('x/catalog.json'), true); assert.equal(QBP.skipJson('x/bank.json'), false);
  assert.deepEqual(QBP.extractQuestions([{ a: 1 }]), [{ a: 1 }]);
  assert.equal(QBP.extractQuestions({ questions: [1, 2] }).length, 2);
  assert.equal(QBP.extractQuestions({ blocks: [{ questions: [1] }, { items: [2, 3] }, [4]] }).length, 4);
  assert.equal(QBP.extractQuestions({ x: 1 }).length, 0);
});

test('field detection: dotted paths, counts, exclusions, guesses', () => {
  const qs = [
    { id: 'a1', stem: 'S', system: 'Cardiology', discipline: 'Medicine', topic: 'T1', meta: { cat: 'C1' } },
    { id: 'a2', stem: 'S', system: 'Cardiology', discipline: 'Surgery', topic: 'T2', meta: { cat: 'C2' } },
    { id: 'a3', stem: 'S', topic: 'T3' }];
  const f = QBP.detectFields(qs);
  assert.deepEqual(f.map((x) => x.k), ['topic', 'discipline', 'meta.cat', 'system']);
  assert.deepEqual(f.find((x) => x.k === 'system'), { k: 'system', n: 2, distinct: 1 });
  assert.ok(!f.some((x) => x.k === 'id' || x.k === 'stem'));
  assert.deepEqual(QBP.guess(f), { system: 'system', subject: 'discipline', topic: 'topic' });
  assert.deepEqual(QBP.guess([{ k: 'meta.specialty' }]), { system: '', subject: 'meta.specialty', topic: '' });
  assert.deepEqual(QBP.valueCounts(qs, 'system'), [['Cardiology', 2]]);
  assert.equal(QBP.getPath(qs[0], 'meta.cat'), 'C1'); assert.equal(QBP.getPath(qs[2], 'meta.cat'), undefined);
});

test('source ids for duplicate skip: qid, id, stored qbSrc, stem hash', () => {
  assert.equal(QBP.srcId({ qid: 'Q9', id: 'x' }), 'Q9');
  assert.equal(QBP.srcId({ id: 'x' }), 'x');
  assert.equal(QBP.srcId({ qbSrc: 'orig', qid: 'generated-b001-q001', id: 'x' }), 'orig', 'an imported question keeps its source id');
  const a = QBP.srcId({ stem: 'Hello   World' }), b = QBP.srcId({ question: ' hello world ' });
  assert.ok(a.startsWith('h:')); assert.equal(a, b); assert.notEqual(a, QBP.srcId({ stem: 'Other' }));
});

test('tag map: mapped fields into index rows, normalize flag, no subject fallback for imported banks', () => {
  const q = { sys: 'Cardio', meta: { d: 'Medicine' }, top: 'AF' };
  const row = { system: '', discipline: '', topic: 'old', subject: 'Uncategorized' };
  QBP.applyTagMap(row, q, { system: 'sys', subject: 'meta.d', topic: 'top' });
  assert.deepEqual(row, { system: 'Cardio', discipline: 'Medicine', topic: 'AF', subject: 'Cardio' });
  const row2 = { system: 'x', discipline: 'd', topic: 't', subject: 's' }; QBP.applyTagMap(row2, {}, { system: 'missing' });
  assert.deepEqual(row2, { system: 'x', discipline: 'd', topic: 't', subject: 's' }, 'a field the question lacks changes nothing');
  assert.equal(QBP.systemFor({ system: 'Cardio', subject: 'z' }, { qbank: { tagMap: { normalize: true } } }, Core).system, 'Cardiovascular');
  assert.equal(QBP.systemFor({ system: 'Cardio' }, { qbank: { tagMap: { normalize: false } } }, Core).system, 'Cardio');
  assert.equal(QBP.systemFor({ system: '', subject: 'Cardiology' }, { qbank: { tagMap: {} } }, Core).system, 'Unassigned', 'imported: only the mapped system field');
  assert.equal(QBP.systemFor({ system: '', subject: 'Cardiology' }, { id: 'N-11' }, Core).system, 'Cardiovascular', 'built-in forms keep the core subject fallback');
});

/* ---- Qbank history: the shipped copy must behave exactly like the legacy qHist / qbankUsedFromSessions ---- */
function legacyFns(h) {
  const sessionDone = (s) => !!(s && (s.completedAt || (Array.isArray(s.blocks) && s.blocks.length && s.blocks.every((b) => b && b.blockCompleted))));
  const qHist = new Function('sessionDone', line(h, 'function qHist(qp, mode){') + ';return qHist;')(sessionDone);
  const used = new Function(line(h, 'function qbankUsedFromSessions(qp){') + ';return qbankUsedFromSessions;')();
  return { sessionDone, qHist, used };
}
function rnd(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
function fakeQp(seed) {
  const r = rnd(seed), sessions = [];
  for (let t = 0; t < 1 + Math.floor(r() * 4); t++) {
    const blocks = [], keys = []; let kn = 0;
    for (let b = 0; b < 1 + Math.floor(r() * 3); b++) {
      const n = 1 + Math.floor(r() * 5), answers = [], flagged = [], res = [];
      for (let i = 0; i < n; i++) { const k = 'f::q' + Math.floor(r() * 12); keys.push(k); kn++; const a = r() < .7 ? Math.floor(r() * 4) : null; answers.push(a); flagged.push(r() < .2); if (r() < .8) res.push({ item: i + 1, chosen: a, correct: 1, isCorrect: a === 1 && r() < .9, flagged: r() < .1 }); }
      blocks.push({ total: n, answers, flagged, result: r() < .8 ? { answers: res } : null, blockCompleted: r() < .7 });
    }
    sessions.push({ qbankTestId: 't' + t, status: r() < .6 ? 'completed' : 'in_progress', session: { qbankKeys: keys, blocks, completedAt: r() < .5 ? 'x' : null } });
  }
  return { sessions };
}
test('history helpers match the legacy qHist / used map on 300 random Qbank histories (same keys, used, marked; answers follow the latest attempt)', () => {
  for (const h of Object.values(html)) {
    const L = legacyFns(h);
    for (let seed = 1; seed <= 300; seed++) {
      const qp = fakeQp(seed);
      assert.deepEqual(QBP.usedFromSessions(qp), L.used(qp), 'used ' + seed);
      for (const mode of ['completed_qbank', 'all_qbank', 'latest_qbank']) {
        const a = QBP.histFromSessions(qp, mode, L.sessionDone), b = L.qHist(qp, mode), pick = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, [v.used, v.marked]]));
        assert.deepEqual(pick(a), pick(b), mode + ' ' + seed);
      }
    }
  }
  assert.equal(QBP.histMode('first'), 'completed_qbank'); assert.equal(QBP.histMode('all_qbank'), 'all_qbank'); assert.equal(QBP.histMode(null), 'completed_qbank');
});

test('statuses from Qbank history map through the core', () => {
  const st = (u, h) => Core.statusOf(QBP.qbankStatus(u, h));
  assert.deepEqual(st(false, undefined), { status: 'unused', marked: false });
  assert.deepEqual(st(true, { used: true, answered: true, wrong: false, marked: true }), { status: 'correct', marked: true });
  assert.deepEqual(st(true, { used: true, answered: true, wrong: true, marked: false }), { status: 'incorrect', marked: false });
  assert.deepEqual(st(true, { used: true, answered: false, wrong: false, marked: false }), { status: 'omitted', marked: false });
  assert.deepEqual(st(true, undefined), { status: 'omitted', marked: false }, 'used in a test that is not completed yet');
});

test('form attempts: keys by QID or by index position, graded and ungraded blocks', () => {
  const session = { blocks: [
    { total: 4, answers: [0, 1, null, 2], flagged: [false, true, false, false], questionQids: ['a', 'b', 'c', 'd'],
      result: { answers: [{ item: 1, chosen: 0, isCorrect: true }, { item: 2, chosen: 1, isCorrect: false, flagged: true }, { item: 3, chosen: null, isCorrect: false }, { item: 4, chosen: 2, isCorrect: true }] }, blockCompleted: true },
    { total: 3, answers: [3, null, null], flagged: [false, false, true] }] };
  const posMap = { '1:0': 'u::x0', '1:1': 'u::x1', '1:2': 'u::x2' };
  const r = QBP.attemptMap(session, { formId: 'F', formUid: 'u', posMap });
  assert.deepEqual(Object.keys(r.map).sort(), ['u::a', 'u::b', 'u::c', 'u::d', 'u::x0', 'u::x2']);
  assert.deepEqual([r.map['u::a'].ok, r.map['u::b'].ok, r.map['u::c'].answered, r.map['u::c'].used, r.map['u::d'].ok], [true, false, false, true, true], 'graded block: unanswered = omitted');
  assert.equal(r.map['u::b'].marked, true);
  assert.deepEqual(r.unknown, ['u::x0'], 'answered in an ungraded block: correctness comes from the form');
  assert.equal(r.map['u::x2'].used, false); assert.equal(r.map['u::x2'].marked, true);
  const noPos = QBP.attemptMap({ blocks: [{ total: 1, answers: [0] }] }, { formId: 'F', formUid: 'u' });
  assert.deepEqual(Object.keys(noPos.map), ['F:0:0'], 'no QIDs, no index: legacy positional key');
});

test('form-source status: attempt first, then Qbank history; marks combine', () => {
  const s = (fa, u, qh) => Core.statusOf(QBP.mergeStatus(fa, u, qh));
  assert.deepEqual(s({ used: true, answered: true, ok: true, marked: false }, false, undefined), { status: 'correct', marked: false });
  assert.deepEqual(s({ used: true, answered: true, ok: false, marked: false }, true, { used: true, answered: true, wrong: false, marked: true }), { status: 'incorrect', marked: true }, 'the form attempt wins; Qbank marks add');
  assert.deepEqual(s({ used: true, answered: false, ok: null, marked: false }, false, undefined), { status: 'omitted', marked: false });
  assert.deepEqual(s(undefined, true, { used: true, answered: true, wrong: true, marked: false }), { status: 'incorrect', marked: false }, 'only a Qbank test saw it');
  assert.deepEqual(s(undefined, false, undefined), { status: 'unused', marked: false });
  assert.deepEqual(s({ used: false, answered: false, ok: null, marked: true }, false, undefined), { status: 'unused', marked: true });
  const pick = QBP.pickAttempt, done = (x) => !!x.completedAt, active = (b) => b.attempts.find((a) => a.attemptId === b.activeAttemptId) || b.attempts[0];
  const b = { activeAttemptId: 'b', attempts: [{ attemptId: 'a', createdAt: '2026-01-02', completedAt: '2026-01-03', session: { completedAt: '2026-01-03' } }, { attemptId: 'b', createdAt: '2026-01-04', session: {} }, { attemptId: 'c', createdAt: '2026-01-01', completedAt: '2026-01-09', session: { completedAt: '2026-01-09' } }] };
  assert.equal(pick(b, 'first', (x) => done(x), active).attemptId, 'c');
  assert.equal(pick(b, 'latest_completed', (x) => done(x), active).attemptId, 'c');
  assert.equal(pick(b, 'active', done, active).attemptId, 'b');
  assert.equal(pick({ attempts: [] }, 'active', done, active), null);
});

test('asset references: one pass, suffix keys, ambiguity skipped', () => {
  const map = {}; QBP.addAssetMapKeys(map, 'bank/assets/x/pic.png', 'F/x/pic.png'); QBP.addAssetMapKeys(map, 'bank/images/a.png', 'F/a.png'); QBP.addAssetMapKeys(map, 'other/images/a.png', 'F/other/a.png');
  const out = QBP.rewriteAssetRefs({ s: '<img src="assets/x/pic.png"> <img src="images/a.png"> x/pic.png.', t: 'assets/x/pic.png', u: 'bank/images/a.png', k: 'https://e.com/assets/x/pic.png', d: 'data:image/png;base64,AAAA' }, map);
  assert.equal(out.s, '<img src="DATA/assets/F/x/pic.png"> <img src="images/a.png"> DATA/assets/F/x/pic.png.', 'no double replacement; ambiguous reference left alone');
  assert.equal(out.t, 'DATA/assets/F/x/pic.png'); assert.equal(out.u, 'DATA/assets/F/a.png'); assert.equal(out.k, 'https://e.com/assets/x/pic.png'); assert.equal(out.d, 'data:image/png;base64,AAAA');
  const m2 = {}; QBP.addAssetMapKeys(m2, 'bank/images/pic7.png', 'QB-X-02/pic7.png');
  assert.equal(QBP.rewriteAssetRefs({ s: 'New <img src="images/pic7.png">' }, m2).s, 'New <img src="DATA/assets/QB-X-02/pic7.png">');
  assert.equal(QBP.safeAssetRel('bank/assets/x/pic.png'), 'x/pic.png'); assert.equal(QBP.safeAssetRel('bank/images/a.png'), 'a.png');
});

test('catalog hiding: bridge lists, analysis, tab counts and Qbank wrappers exist in both apps', () => {
  for (const h of Object.values(html)) {
    assert.ok(h.includes('forms:()=>(catalog.forms||[]).filter(f=>!f.libraryHidden)'));
    assert.ok(h.includes('const forms=(catalog.forms||[]).filter(f=>!f.libraryHidden), progress={}, shadow={}'));
    assert.ok(h.includes('const forms=(catalog.forms||[]).filter(f=>!f.libraryHidden).map(f=>{ const idx='));
    assert.equal(h.split('r.filter===f&&!r.libraryHidden').length - 1, 2);
    const qb = h.slice(h.indexOf('function install(){'));
    assert.ok(/const prevFilterRecs=filterRecs; filterRecs=function/.test(qb) && /const prevPool=qbankPool; qbankPool=async function/.test(qb) && /const prevStart=startQbankMode;\s*startQbankMode=async function/.test(qb) && /makeCatalogRecord=function/.test(qb));
    assert.ok(h.indexOf('QB.install();') > h.indexOf('startQbankMode=async function(){ v103ClearSetupState();'), 'the Qbanks wrappers load after every older startQbankMode wrapper');
    assert.ok(h.indexOf('QB.install();') < h.indexOf('window.StepLibraryBridge=Object.freeze({'));
  }
  if (html.ipad) assert.ok(html.ipad.includes('qbank:m.qbank,libraryHidden:!!m.libraryHidden'), 'a form synced from another device keeps its Qbank flags');
});

/* ---- Sync v3: the tag file rides the ThunderShadow adapter ---- */
test('sync adapter: tags listed, written and merged next to the shadow logs; devices converge', async () => {
  if (!BRIDGE_PATH || !SYNC_PATH) return;
  const crypto = require('node:crypto'), sha = (t) => crypto.createHash('sha256').update(t).digest('hex');
  const Bridge = require(BRIDGE_PATH), Sync = require(SYNC_PATH), Drive = require(path.join(path.dirname(BRIDGE_PATH), 'sync3-drive.js'));
  const canon = (o) => { const tags = {}; Object.keys(o.tags).sort().forEach((k) => { tags[k] = { system: o.tags[k].system, at: o.tags[k].at }; }); return JSON.stringify({ fileType: 'ThunderQbankTags', v: 1, tags }); };
  const mk = (tags) => ({ fileType: 'ThunderQbankTags', v: 1, tags });
  function device(initial) {
    let text = initial ? canon(initial) : null; const logs = new Map();
    global.window = { ShadowLogger: { files: { list: async () => [...logs].map(([id, t]) => ({ id, text: t })), write: async (id, t) => { logs.set(id, t); return { written: true, text: t }; }, merge: (a, b) => (a >= b ? a : b) } } };
    const tags = { read: async () => text, write: async (t) => { const m = canon(Core.mergeTags(JSON.parse(text || canon(mk({}))), JSON.parse(t))); text = m; return { written: true, text: m }; }, merge: (a, b) => canon(Core.mergeTags(JSON.parse(a), JSON.parse(b))) };
    return { logs, tags, get text() { return text; }, shadow: () => { global.window.__stepQbankTags = tags; const a = Bridge.createShadowAdapter(); return { list: a.list, write: a.write, merge: a.merge, sha256: async (t) => sha(t) }; } };
  }
  let n = 0; const files = new Map(), fd = { async upload(name, obj) { for (const [id, f] of files) if (f.name === name) { f.obj = obj; return { id }; } const id = 'id' + ++n; files.set(id, { name, obj }); return { id }; }, async remove(id) { files.delete(id); }, async downloadJson(id) { return JSON.parse(JSON.stringify(files.get(id).obj)); } };
  const listing = () => [...files].map(([id, f]) => ({ id, name: f.name }));
  const A = device(mk({ k1: { system: 'Cardiovascular', at: '2026-11-01T10:00:00.000Z' }, k2: { system: 'Dermatology', at: '2026-11-01T10:00:00.000Z' } }));
  const B = device(mk({ k2: { system: null, at: '2026-11-02T10:00:00.000Z' }, k3: { system: 'Genetics', at: '2026-11-02T10:00:00.000Z' } }));
  const run = async (d) => { const s = d.shadow(); return Sync.syncShadow({ files: listing(), drive: fd, Drive, shadow: s }); };
  const r1 = await run(A); assert.deepEqual(r1.uploaded, ['QBANKTAGS']); assert.deepEqual(r1.errors, {});
  assert.ok(listing().every((f) => /^v3\.t\.QBANKTAGS\.[0-9a-f]{16}\.json$/.test(f.name)));
  await run(B); await run(A); await run(B);
  assert.equal(A.text, B.text, 'both devices hold the same merged tags');
  const merged = JSON.parse(A.text).tags; assert.equal(merged.k1.system, 'Cardiovascular'); assert.equal(merged.k2.system, null, 'newer delete tombstone wins'); assert.equal(merged.k3.system, 'Genetics');
  assert.equal(listing().length, 1, 'one Drive object after convergence');
  /* shadow logs next to the tags are untouched by the tag id */
  const C = device(null); C.logs.set('F1', '{"log":1}'); const s = C.shadow(); const l = await s.list(); assert.deepEqual(l.map((x) => x.id), ['F1']);
  assert.deepEqual(await s.write('F1', '{"log":2}'), { written: true, text: '{"log":2}' }); assert.equal(C.logs.get('F1'), '{"log":2}');
  assert.equal(s.merge('{"log":1}', '{"log":2}'), '{"log":2}', 'logs still use the logger merge');
  const D = device(mk({ z: { system: 'Genetics', at: '2026-11-03T00:00:00.000Z' } })); const sd = D.shadow(); assert.deepEqual((await sd.list()).map((x) => x.id), ['QBANKTAGS']);
  assert.equal(JSON.parse(sd.merge(D.text, canon(mk({ z: { system: 'Dermatology', at: '2026-11-04T00:00:00.000Z' } })))).tags.z.system, 'Dermatology');
  delete global.window;
});

test('sync content meta carries the Qbank flags (hidden imported banks move between devices)', () => {
  if (!BRIDGE_PATH) return;
  const t = fs.readFileSync(BRIDGE_PATH, 'utf8'); assert.ok(/const CONTENT_META=\[[^\]]*'libraryHidden','qbank'\]/.test(t));
  if (SYNC_PATH) assert.ok(fs.readFileSync(path.join(path.dirname(SYNC_PATH), 'sync3-boot.js'), 'utf8').includes("'stepsim:qbanktags-write'"));
});

test('Qbank history: the latest attempt decides the status (UWorld rule), marked stays', () => {
  const blk = (ans, correct, flagged) => ({ total: 1, answers: [ans], flagged: [flagged], result: { answers: [{ item: 1, chosen: ans, correct, isCorrect: ans === correct }] } });
  const t = (at, ans, flagged) => ({ status: 'completed', completedAt: at, session: { qbankKeys: ['F::1'], blocks: [blk(ans, 'B', flagged)] } });
  // stored newest first, like upsertQSession
  let h = QBP.histFromSessions({ sessions: [t('2026-11-02', 'B', false), t('2026-11-01', 'A', true)] }, 'completed_qbank');
  assert.deepEqual(h['F::1'], { used: true, wrong: false, marked: true, answered: true }, 'wrong then right -> correct, still marked');
  h = QBP.histFromSessions({ sessions: [t('2026-11-02', 'A', false), t('2026-11-01', 'B', false)] }, 'completed_qbank');
  assert.equal(h['F::1'].wrong, true, 'right then wrong -> incorrect');
  h = QBP.histFromSessions({ sessions: [t('2026-11-02', null, false), t('2026-11-01', 'A', false)] }, 'completed_qbank');
  assert.equal(h['F::1'].answered, false, 'latest attempt omitted -> omitted');
});

/* ---- import v2: question files, manifest, epc rule, shared-asset renames, export refs ---- */
test('v2 question files: junk, skip names, qbank.json excluded at any depth, natural order on the path', () => {
  const names = ['b/q10.json', 'b/q2.json', 'qbank.json', 'x/qbank.json', '__MACOSX/b/q1.json', 'a/catalog.json', 'a/._x.json', 'assets/pic.png', 'Z.JSON', 'b/q1.json'];
  assert.deepEqual(QBP.questionFiles(names), ['b/q1.json', 'b/q2.json', 'b/q10.json', 'Z.JSON']);
  assert.equal(QBP.pickManifest(['x/qbank.json', 'qbank.json', 'a.json']), 'qbank.json', 'shallowest manifest wins');
  assert.equal(QBP.pickManifest(['a.json']), null); assert.equal(QBP.pickManifest(['__MACOSX/qbank.json']), null);
  assert.equal(QBP.fileBase('dir/Part 1.json'), 'Part 1');
});

test('v2 manifest: optional fields, color and code cleaned, bad JSON ignored', () => {
  assert.equal(QBP.parseManifest('nope'), null); assert.equal(QBP.parseManifest('[1]'), null);
  assert.deepEqual(QBP.parseManifest('{}'), { name: '', code: '', color: '', tagMap: null });
  assert.deepEqual(QBP.parseManifest(JSON.stringify({ fileType: 'ThunderQbank', version: 2, name: 'My Bank', code: 'abcd', color: '#2f9e44', tagMap: { system: 'sys', normalize: false } })),
    { name: 'My Bank', code: 'ABC', color: '#2f9e44', tagMap: { system: 'sys', subject: '', topic: '', normalize: false } });
  assert.equal(QBP.parseManifest('{"color":"red"}').color, '');
});

test('v2 choice % rule matches choice-epc.js values(): numbers or "62%" strings, at least one > 0', () => {
  const EPC = require(find('../choice-epc.js')); const mk = (e, n) => ({ choices: new Array(n || 4).fill('c'), choicesEPC: e });
  const cases = [mk([10, 20, 60, 10]), mk(['62%', '10%', 0, 5]), mk({ A: 0, B: 0, C: 0, D: 0 }), mk({ a: '5', B: 0 }), mk({ 0: 1 }), mk([null, 'x', -3, 0]), mk('62'), { choices: ['a'] }, mk([0, 0], 2), mk({ A: 1, B: 2 }, 0)];
  for (const q of cases) assert.equal(QBP.epcHas(q), !!EPC.values(q, Array.isArray(q.choices) ? q.choices.length : 0), JSON.stringify(q.choicesEPC));
  assert.equal(QBP.epcCount(cases), cases.filter((q) => QBP.epcHas(q)).length); assert.equal(QBP.epcCount(null), 0);
});

test('v2 asset rename: pic.png -> pic~2.png, ~3 and so on, dotless and nested names', () => {
  assert.equal(QBP.altName('pic.png', 2), 'pic~2.png'); assert.equal(QBP.altName('a/b.c/pic', 3), 'a/b.c/pic~3'); assert.equal(QBP.altName('a/.hid', 2), 'a/.hid~2');
  assert.equal(QBP.renameFree('x/pic.png', () => false), 'x/pic.png');
  const taken = new Set(['x/pic.png', 'x/pic~2.png']); assert.equal(QBP.renameFree('x/pic.png', (r) => taken.has(r)), 'x/pic~3.png');
});

test('v2 missing images: asset-looking refs without a matching ZIP image', () => {
  const map = {}; QBP.addAssetMapKeys(map, 'bank/images/a.png', 'x/a.png');
  const qs = [{ stem: '<img src="images/a.png"> <img src="images/gone.png">', e: 'see assets/gone.png and https://e.com/z.png and DATA/assets/Q/k.png' }, { stem: 'data:image/png;base64,AAAA', x: ['images/b.jpg', 'images/a.png'] }];
  assert.equal(QBP.missingRefs(qs, map), 3, 'images/gone.png, gone.png (assets/ stripped), images/b.jpg; urls, data and DATA refs ignored');
  assert.equal(QBP.missingRefs([{ stem: 'plain text' }], {}), 0);
});

test('v2 export refs: DATA/assets/<dir>/<rel> -> assets/<rel> for the bank dir and the legacy form dir, copy not in place', () => {
  const b = { title: 'T', blocks: [{ questions: [{ stem: '<img src="DATA/assets/QB-X/a/p.png"> <img src="DATA/assets/QB-X-01/q.png">', img: 'DATA/assets/QB-X/z.png', other: 'DATA/assets/QB-Y/z.png', n: 3, ext: 'https://e.com/assets/z.png' }] }] };
  const keep = JSON.stringify(b), out = QBP.exportRewrite(b, ['QB-X', 'QB-X-01'], null);
  assert.equal(JSON.stringify(b), keep);
  const q = out.blocks[0].questions[0]; assert.equal(q.stem, '<img src="assets/a/p.png"> <img src="assets/q.png">'); assert.equal(q.img, 'assets/z.png'); assert.equal(q.other, 'DATA/assets/QB-Y/z.png', 'another bank folder left alone'); assert.equal(q.n, 3);
  assert.equal(QBP.exportRewrite({ s: 'DATA/assets/QB-X/a.png' }, ['QB-X'], (d, r) => r.replace('a', 'a~2')).s, 'assets/a~2.png');
  /* an exported ref re-imports through the same map rules */
  const m = {}; QBP.addAssetMapKeys(m, 'assets/a/p.png', 'QB-X/a/p.png'); assert.equal(QBP.rewriteAssetRefs({ s: '<img src="assets/a/p.png">' }, m).s, '<img src="DATA/assets/QB-X/a/p.png">');
});

test('v2 bridge: details and export members, shared asset folder, deleteBank removes it', () => {
  for (const h of Object.values(html)) {
    const br = h.slice(h.indexOf('const bridge={')); assert.ok(/qbanksBankDetails:async id=>/.test(br) && /qbanksExportBank:async id=>/.test(br));
    assert.ok(h.includes("makeRecovery('PRE_QBANK_DELETE',ids,true,dirs)") && h.includes('for(const dn of dirs) await removeAssetDir(dn)'));
  }
});

test('exam mix: tag precedence is user tag, then built-in tag, then the question system; built-ins are never written', () => {
  const sy = { system: 'Cardiovascular', from: 'question' };
  assert.deepEqual(QBP.resolveSystem(sy, { system: 'Renal & Urinary' }, 'Nervous System'), { system: 'Renal & Urinary', tag: 'override' });
  assert.deepEqual(QBP.resolveSystem(sy, undefined, 'Nervous System'), { system: 'Nervous System', tag: 'builtin' });
  assert.deepEqual(QBP.resolveSystem(sy, { system: null, at: 'x' }, 'Nervous System'), { system: 'Nervous System', tag: 'builtin' }, 'a cleared user tag falls through to the built-in');
  assert.deepEqual(QBP.resolveSystem(sy, undefined, null), { system: 'Cardiovascular', tag: 'question' });
  assert.deepEqual(QBP.resolveSystem({ system: Core.UNASSIGNED, from: 'missing' }, undefined, undefined), { system: Core.UNASSIGNED, tag: 'missing' });
  for (const h of Object.values(html)) {
    const qb = h.slice(h.indexOf('const QB=(function(){'), h.indexOf('QB.install();'));
    const uses = qb.split('\n').filter((l) => l.includes('builtinTag(')).map((l) => l.trim().slice(0, 40));
    assert.ok(uses.length >= 2, 'computeRows and examQuestion read built-ins');
    for (const w of ['function canonTags', 'const tagsText', 'async function writeTagsObject', 'function changeTags', 'function setTag']) assert.ok(!line(qb, w).includes('builtinTag'), w + ' never touches built-ins');
    assert.ok(!line(qb, 'async function acceptSuggestions').includes('builtin'));
  }
  const BT = require(find('../qbank-builtin-tags.js'));
  const tags = (BT.tags || (BT.ThunderQbankBuiltinTags && BT.ThunderQbankBuiltinTags.tags)); const keys = Object.keys(tags);
  assert.ok(keys.length > 0 && keys.every((k) => Core.SYSTEMS.includes(tags[k]) || (Core.BLUEPRINT_STEP2 && Core.BLUEPRINT_STEP2.rows.some((r) => r.systems.includes(tags[k])))), 'every built-in value is a system name the core or the blueprint knows');
});

test('exam mix: pull mix follows the planner (rows, sizes, blocks); no planner or no pull keeps today\'s pick', () => {
  const mk = (i, sys) => ({ key: 'F::' + i, formId: 'F', blockIndex: 0, questionIndex: i, subject: 'Internal Medicine', topic: 't', recognizer: 'r' });
  const rows = [0, 1, 2, 3, 4, 5].map((i) => mk(i)), sizes = [1, 2, 1, 2], sysOf = (k) => (Number(k.split('::')[1]) % 2 ? 'Cardiovascular' : 'Nervous System');
  const setOf = { 'F::1': { id: 'S', position: 1, total: 2 }, 'F::2': { id: 'S', position: 2, total: 2 }, 'F::5': { id: 'T', position: 2, total: 2 } };
  const seen = {};
  const C = Object.assign({}, Core, {
    blueprintRow: (s) => (s === 'Cardiovascular' ? 'cardio' : s === 'Nervous System' ? 'neuro' : null),
    clinicalSciencesOf: () => ['medicine'],
    planMix(units, n, per, opts) { seen.units = units; seen.opts = opts; const u = units.slice().reverse(); return { keys: u.flatMap((x) => x.keys), sizes: u.map((x) => x.keys.length), blocks: [[0, 3], [3, 6]], perBlock: [{ cardio: 2 }, { neuro: 1 }], notes: ['n1'] }; },
  });
  const all = { rows, sizes, setOf };
  const res = QBP.planPick(C, 'mix', all, 6, 3, { systems: null }, sysOf, () => null);
  assert.deepEqual(seen.units.map((u) => u.keys), [['F::0'], ['F::1', 'F::2'], ['F::3'], ['F::4', 'F::5']], 'linked sets stay together as one unit');
  assert.deepEqual(seen.units.map((u) => u.row), ['neuro', 'cardio', 'cardio', 'neuro']);
  assert.deepEqual(seen.units.map((u) => u.sci), [['medicine'], ['medicine'], ['medicine'], ['medicine']]);
  assert.deepEqual(res.rows.map((r) => r.key), ['F::4', 'F::5', 'F::3', 'F::1', 'F::2', 'F::0']);
  assert.deepEqual(res.sizes, [2, 1, 2, 1]);
  assert.deepEqual(res.plan.blocks, [[0, 3], [3, 6]]);
  assert.deepEqual(Object.keys(res.setOf).sort(), ['F::1', 'F::2', 'F::5'], 'set info kept for the chosen units');
  assert.equal(seen.opts.rows, undefined, 'no rows option when the systems filter is not narrowed');
  const narrow = QBP.planPick(C, 'mix', all, 6, 3, { systems: ['Cardiovascular', 'Dermatology'] }, sysOf, () => null);
  assert.ok(narrow && Array.isArray(seen.opts.rows) && seen.opts.rows.includes('cardio') && seen.opts.rows.includes('msk') && !seen.opts.rows.includes('neuro'));
  assert.equal(QBP.planPick(Object.assign({}, C, { planMix: undefined }), 'mix', all, 6, 3, {}, sysOf, () => null), null, 'planner missing -> caller keeps the old pick');
  assert.equal(QBP.planPick(Object.assign({}, C, { planRandomCapped: undefined }), 'random', all, 6, 3, {}, sysOf, () => null), null, 'random without planRandomCapped -> old pick');
  assert.equal(QBP.planPick(C, 'order', all, 6, 3, {}, sysOf, () => null), null, 'order never plans');
  assert.equal(QBP.planPick(Object.assign({}, C, { planMix() { throw new Error('x'); } }), 'mix', all, 6, 3, {}, sysOf, () => null), null, 'a failing planner falls back');
});

test('exam mix: wiring - filter pull, qbankPickUnits rebind, plan bridge, pull saved on the test record', () => {
  for (const h of Object.values(html)) {
    const qb = h.slice(h.indexOf('const QB=(function(){'), h.indexOf('QB.install();'));
    assert.ok(/pull:PULLS\.includes\(sel\.pull\)\?sel\.pull:null/.test(qb), 'filter carries pull; missing = null (today\'s behaviour)');
    assert.ok(/const prevPick=qbankPickUnits; qbankPickUnits=async function/.test(qb));
    assert.ok(/if\(!pull\) return await prevPick\.apply\(self,args\)/.test(qb), 'no pull = untouched legacy pick');
    assert.ok(/qbanksPlan:async\(sel,n,perBlock\)/.test(qb));
    assert.ok(/s\.qbankPullMode=activeRunContext\.qbankPullMode/.test(qb) && /t\.qbankPullMode=s\.qbankPullMode/.test(qb), 'pull mode and notes saved on session and test record');
    assert.ok(/qbankPullMode:t\.qbankPullMode/.test(qb), 'model tests expose it');
    assert.ok(/const prevStartTest=startTest; startTest=function/.test(qb), 'blocks follow the planner');
  }
  if (html.local) assert.ok(html.local.indexOf('<script src="./qbank-builtin-tags.js"></script>') > 0 && html.local.indexOf('qbank-builtin-tags.js') < html.local.indexOf('<script src="./qbanks-core.js"></script>'));
  if (html.ipad) { const h = html.ipad, v = (h.match(/analysis\.js\?v=(\d+)/) || [])[1]; assert.ok(h.indexOf('./qbank-builtin-tags.js?v=' + v) > 0 && h.indexOf('./qbank-builtin-tags.js?v=' + v) < h.indexOf('./qbanks-core.js?v=' + v));
    const root = path.dirname(IPAD); for (const f of ['sw.js', 'app-update.js']) assert.ok(fs.readFileSync(path.join(root, f), 'utf8').includes('"./qbank-builtin-tags.js?v='), f);
    assert.ok(fs.readFileSync(path.join(root, 'tools', 'publish.mjs'), 'utf8').includes("'qbank-builtin-tags.js'")); }
});

test('manifest facetRules: only systemsBySubject:true is kept, stored, exported and listed per bank', () => {
  const m = (o) => QBP.parseManifest(JSON.stringify(Object.assign({ name: 'B', tagMap: { system: 'system' } }, o)));
  assert.deepEqual(m({ facetRules: { systemsBySubject: true } }).facetRules, { systemsBySubject: true });
  for (const fr of [undefined, null, true, [], {}, { systemsBySubject: 'yes' }, { systemsBySubject: false }, { other: true }]) assert.ok(!('facetRules' in m({ facetRules: fr })), JSON.stringify(fr));
  assert.deepEqual(QBP.facetRulesOf({ systemsBySubject: true, extra: 1 }), { systemsBySubject: true });
  for (const h of Object.values(html)) {
    const imp = h.slice(h.indexOf('async function importBank('), h.indexOf('async function updateBank('));
    assert.ok(imp.includes('const fr=QBP.facetRulesOf(mf&&mf.facetRules); if(fr) qb.facetRules=fr;'), 'new bank takes the manifest rule');
    assert.ok(/qb=Object\.assign\(\{\},recs\[0\]\.qbank\)/.test(imp), 'Add files keeps the bank record (and its facetRules)');
    const exp = h.slice(h.indexOf('async function exportBank('), h.indexOf('async function exportBank(') + 1200);
    assert.ok(exp.includes('...(QBP.facetRulesOf(qb.facetRules)?{facetRules:QBP.facetRulesOf(qb.facetRules)}:{})'), 'export writes facetRules back');
    assert.ok(h.includes("kind:'imported',formIds:bankRecs(q.id).map(x=>x.id),...(QBP.facetRulesOf(q.facetRules)?{facetRules:QBP.facetRulesOf(q.facetRules)}:{})"), 'qbanks() lists the rule on the bank');
  }
});

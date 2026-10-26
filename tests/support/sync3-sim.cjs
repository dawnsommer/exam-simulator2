'use strict';
const assert = require('node:assert');
/* Simulated Sync V3 devices for the scenario tests (SYNC_HYBRID_PLAN.md sections 5, 6, 10). Each device has its own store,
   engine and app data; they share one in-memory Drive. The cycle here (pull -> merge -> apply -> push) is a TEST model of
   Release B: Release A ships no push. It exercises the real core / bridge / store / sync / drive modules. */
const C = require('../../js/sync3-core.js');
const Bridge = require('../../js/sync3-bridge.js');
const Store = require('../../js/sync3-store.js');
const Sync = require('../../js/sync3-sync.js');
const D = require('../../js/sync3-drive.js');
const { FakeDrive } = require('./sync3-fake-drive.cjs');
const { K } = C;
const { createHash } = require('node:crypto');
const sha256 = t => createHash('sha256').update(Buffer.from(String(t), 'utf8')).digest('hex');

const clone = v => JSON.parse(JSON.stringify(v));
class World {
  constructor() { this.t = Date.parse('2026-10-25T08:00:00Z'); this.drive = new FakeDrive(); this.catalog = {}; }
  advance(min) { this.t += min * 60000; }
}
class SimDevice {
  constructor(world, name, { cls = 'large', skewMs = 0 } = {}) {
    this.world = world; this.name = name; this.cls = cls; this.skew = skewMs; this.online = true; this.open = null; this.leases = {};
    this.now = () => world.t + this.skew;
    this.store = Store.create({ backend: Store.memoryBackend(), now: this.now, random: () => name.padEnd(8, '0'), screen: cls === 'phone' ? { width: 390, height: 844 } : { width: 1180, height: 820 }, name });
    this.app = { forms: {}, settings: {}, qbank: null, hidden: [] };
    this.driveApi = D.create({ auth: world.drive, writesEnabled: true });
    this.remote = {}; this.cache = {};
    const dev = this;
    this.source = {
      async readForms() {
        const forms = {}, id = await dev.store.deviceId();
        for (const [uid, f] of Object.entries(dev.app.forms)) forms[uid] = { modifiedAt: f.modifiedAt || 0, extract: await Bridge.extractForm({ formUid: uid, rec: f.rec, progress: f.progress, suspended: f.suspended, score: f.score, dev: id }) };
        return { forms };
      },
      async readSettings() { return clone(dev.app.settings); }
    };
    this.engine = Sync.create({ store: this.store, source: this.source, now: this.now });
  }
  async id() { return this.store.deviceId(); }
  /* forms come from the update service unless they are custom / imported (then `text` is the form file and bankHash its sha256) */
  install(uid, rec, progress = null, text = null) {
    const own = rec && (rec.custom || rec.imported);
    this.app.forms[uid] = { rec: { id: uid, formUid: uid, qidSchemaVersion: 1, bankHash: text != null ? sha256(text) : 'H1', displayName: uid, defaultName: uid, ...(own ? {} : { formUpdateRevision: 'r1' }), ...rec }, progress, suspended: null, score: '', text, assets: [] };
  }
  uninstall(uid) { delete this.app.forms[uid]; }
  setProgress(uid, progress) { this.app.forms[uid].progress = progress; }
  setSetting(name, value) { const sc = C.settingScope(name, this.cls); if (!sc) throw new Error('not a synced setting here: ' + name); this.app.settings[K.setting(sc, name)] = value; }
  getSetting(name) { const sc = C.settingScope(name, this.cls); const v = this.app.settings[K.setting(sc, name)]; const row = C.settingsFor(this.cls).find(s => s.name === name); return v === undefined ? row.default : v; }
  scan() { return this.engine.scan(); }

  getCycle() {
    const dev = this;
    if (!this.cycle) {
      this.applier = {
        async prepare() {},
        isOpenBlock: uid => !!(dev.open && dev.open.uid === uid),
        hasForm: uid => !!dev.app.forms[uid],
        hasProgress: uid => !!(dev.app.forms[uid] && dev.app.forms[uid].progress),
        recover: async () => {},
        isApplyingRemote: () => false,
        async applyForm({ uid, units, vis }) { return dev.applyForm(uid, units, vis); },
        async applyQbank() { return {}; },
        async applySettings(units, cls) { const own = C.settingsFor(cls); for (const [k, u] of Object.entries(units)) { const p = C.parseKey(k); if (p.fam === 'S' && (p.scope === 'g' || p.scope === (cls === 'phone' ? 'P' : 'L')) && own.some(x => x.name === p.name)) dev.app.settings[k] = u.v; } }
      };
      /* form content adapter (the browser one reads forms/<id>.json + assets through StepExamSyncBridge) */
      this.content = {
        async local() { return Object.entries(dev.app.forms).filter(([, f]) => f.text != null).map(([uid, f]) => ({ uid, ch: f.rec.bankHash })); },
        async read(uid) { dev.reads = (dev.reads || 0) + 1; const f = dev.app.forms[uid]; return { meta: { id: f.rec.id, defaultName: f.rec.defaultName, displayName: f.rec.displayName, custom: !!f.rec.custom, imported: !!f.rec.imported, questionIndex: f.rec.questionIndex }, text: f.text, assets: f.assets.map(a => ({ path: a.path, sha: sha256(Buffer.from(a.b64, 'base64')), b64: a.b64 })) }; },
        async install({ uid, meta, text, assets, bankHash }) {
          if (dev.busy) return { busy: true };
          if (Object.values(dev.app.forms).some(f => f.rec.id === meta.id)) return { conflict: true };
          for (const a of assets) if (sha256(Buffer.from(a.b64, 'base64')) !== a.sha) throw new Error('asset hash mismatch');
          dev.install(uid, { id: meta.id, custom: meta.custom, imported: meta.imported, displayName: meta.displayName, defaultName: meta.defaultName, questionIndex: meta.questionIndex }, null, text);
          dev.app.forms[uid].assets = assets.map(a => ({ path: a.path, b64: a.b64 }));
          assert(dev.app.forms[uid].rec.bankHash === bankHash);
          return { installed: true };
        },
        sha256: async t => sha256(t),
        v2Library: async () => dev.world.v2Library || []
      };
      this.cycle = Sync.createCycle({ store: this.store, drive: this.driveApi, engine: this.engine, applier: this.applier, Drive: D, content: this.content, now: this.now, appVersion: 'test' });
    }
    return this.cycle;
  }
  /* one real sync cycle (js/sync3-sync.js createCycle) with a simulated app as the applier; offline devices do nothing */
  async sync() {
    if (!this.online) return { offline: true };
    await this.store.setRaw('myLeases', this.leasesMine || {});
    return this.getCycle().run({ reason: 'test' });
  }
  async applyForm(uid, units, vis) {
    const lib = units[K.lib(uid)];
    if (lib && lib.v.on === 'deleted') { delete this.app.forms[uid]; return {}; }
    if (lib && lib.v.on === 'installed' && !this.app.forms[uid]) {
      if (lib.v.src !== 'catalog' || !this.world.catalog[uid]) return { waiting: true };     // custom / imported forms are installed by the cycle from their content
      this.install(uid, { bankHash: lib.v.ch, questionIndex: (this.world.catalog[uid].questions || []).map((q, i) => ({ qid: q, blockIndex: 0, questionIndex: i })) });
    }
    const f = this.app.forms[uid]; if (!f) return { waiting: true };
    const nm = units[K.libField(uid, 'name')]; if (nm) f.rec.displayName = nm.v;
    const rev = units[K.libField(uid, 'rev')]; if (rev && Number(rev.v.seq) >= Number(f.rec.revisionSeq || 0)) { f.rec.bankHash = rev.v.hash; f.rec.revisionSeq = rev.v.seq; }
    const sc = units[K.libField(uid, 'score')]; if (sc) f.score = sc.v;
    const buildResult = ({ session, block, blockIndex, done }) => Bridge.buildResultFromQuestions({ session, block, blockIndex, done, questions: (block.questionQids || []).map(() => ({ choices: ['a', 'b', 'c', 'd'], correct: 0, stem: 's' })), nowIso: new Date(this.now()).toISOString() });
    const r = Bridge.applyUnitsToProgress({ progress: f.progress, units, vis, formUid: uid, formId: f.rec.id, rec: f.rec, buildResult });
    f.progress = r.progress;
    return {};
  }
  async push() {
    const me = await this.id(), dirty = await this.store.dirty(), known = await this.store.known();
    /* a device pushes what it authored: whole units it stamped, plus its own share of multi-author units (log entries, per-device time) */
    const mineOf = test => {
      const out = [];
      for (const k of Object.keys(known)) {
        if (!test(k)) continue;
        const u = known[k], rule = C.ruleFor(k);
        if (rule === C.RULES.LOG) { const own = (u.v || []).filter(e => C.parseStamp(e.t).dev === me); if (own.length) out.push({ k, v: own, t: own[own.length - 1].t }); }
        else if (rule === C.RULES.TM) { if (u.v && u.v[me] !== undefined) out.push({ k, v: { [me]: u.v[me] }, t: C.parseStamp(u.t).dev === me ? u.t : C.fmtStamp(C.parseStamp(u.t).wall, 0, me) }); }
        else if (C.parseStamp(u.t).dev === me) out.push({ k, v: u.v, t: u.t });
      }
      return out;
    };
    const attForm = Sync.attFormOf(known), forms = new Set(Object.keys(dirty.forms));
    for (const uid of forms) {
      const units = mineOf(k => { const s = Sync.scopeOf(k, attForm); return s.scope === 'form' && s.uid === uid; });
      await this.driveApi.upload(D.N.form(me, uid), { dev: me, units }); await this.store.clearDirty('form', uid);
    }
    if (dirty.lib) { await this.driveApi.upload(D.N.lib(me), { dev: me, units: mineOf(k => Sync.scopeOf(k, attForm).scope === 'lib') }); await this.store.clearDirty('lib'); }
    if (dirty.set) { await this.driveApi.upload(D.N.set(me), { dev: me, units: mineOf(k => Sync.scopeOf(k, attForm).scope === 'set') }); await this.store.clearDirty('set'); }
    const d = await this.store.device();
    await this.driveApi.upload(D.N.dev(me), { deviceId: me, name: d.name, class: d.class, appVersion: 'test', lastSeen: new Date(this.now()).toISOString(), bootstrapped: true });
    await this.driveApi.upload(D.N.lease(me), { dev: me, leases: this.leasesMine || {} });
  }
  /* scan then sync until nothing changes any more (a real app does this on its triggers); returns the last scan to prove no echo */
  async settle(rounds = 4) {
    let last = null;
    for (let i = 0; i < rounds; i++) { last = await this.scan(); await this.sync(); }
    return last;
  }
}
module.exports = { World, SimDevice, clone, sha256 };

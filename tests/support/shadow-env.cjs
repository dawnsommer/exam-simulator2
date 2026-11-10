'use strict';
/* Loads the real shadow-logger.js in a vm with a seeded localStorage and an in-memory DATA folder (the logger's SHADOW_LOG_DIR test hook).
   A "disk" is a Map of 'progress/<name>' -> text; several loads can share one disk (two tabs) or each have their own (two devices). */
const fs = require('node:fs');
const vm = require('node:vm');

function stubEl() {
  const store = { style: { setProperty() {}, getPropertyValue() { return ''; }, removeProperty() {} }, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } } };
  const fn = function () {};
  return new Proxy(fn, {
    get(_, k) { if (k in store) return store[k]; if (k === Symbol.toPrimitive) return () => ''; if (k === 'querySelectorAll') return () => []; if (k === 'getClientRects') return () => []; if (k === 'getBoundingClientRect') return () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }); return fn; },
    set(_, k, v) { store[k] = v; return true; },
    apply() { return stubEl(); }
  });
}
const notFound = () => Object.assign(new Error('not found'), { name: 'NotFoundError' });
function dirOf(disk, prefix) {
  return {
    async getDirectoryHandle(name, o) {
      const p = prefix + name + '/';
      if (!(o && o.create) && ![...disk.keys()].some(k => k.startsWith(p))) throw notFound();
      return dirOf(disk, p);
    },
    async getFileHandle(name, o) {
      const p = prefix + name;
      if (!(o && o.create) && !disk.has(p)) throw notFound();
      return { async getFile() { return { async text() { return disk.get(p); } }; }, async createWritable() { const parts = []; return { async write(b) { parts.push(typeof b === 'string' ? b : await b.text()); }, async close() { if (disk.failWrites) throw new Error('disk full'); disk.set(p, parts.join('')); } }; } };
    },
    async *entries() { for (const k of disk.keys()) if (k.startsWith(prefix) && !k.slice(prefix.length).includes('/')) yield [k.slice(prefix.length), { kind: 'file' }]; }
  };
}
// opts: {seed (localStorage v1 object), disk (Map), noDisk, source (path of shadow-logger.js), ls (Map to reuse)}
function load(opts = {}) {
  const source = fs.readFileSync(opts.source, 'utf8');
  const ls = opts.ls || new Map();
  if (opts.seed) ls.set('ThunderShadowLog.v1', JSON.stringify(opts.seed));
  const disk = opts.disk || new Map();
  const document = { readyState: 'complete', getElementById: () => null, createElement: () => stubEl(), addEventListener() {}, querySelectorAll: () => [], activeElement: null, documentElement: { getAttribute: () => null, setAttribute() {} }, head: { appendChild() {} }, body: { appendChild() {} } };
  const events = [];
  const sandbox = { document, localStorage: { getItem: k => ls.has(k) ? ls.get(k) : null, setItem: (k, v) => { if (ls.failWrites) throw new Error('quota'); ls.set(k, String(v)); }, removeItem: k => ls.delete(k) }, addEventListener() {}, dispatchEvent(e) { events.push(e); return true; }, CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } }, MutationObserver: class { observe() {} }, navigator: {}, innerHeight: 800, innerWidth: 1200, setTimeout, clearTimeout, requestAnimationFrame: () => 0, console, URL, Blob };
  sandbox.window = Object.assign(sandbox, { window: sandbox });
  if (!opts.noDisk) sandbox.SHADOW_LOG_DIR = async () => dirOf(disk, '');
  if (opts.ipad) sandbox.__STEP_SIM_STORAGE_PROFILE = 'ipad-browser-library-primary';
  vm.runInNewContext(source, sandbox);
  return { SL: sandbox.ShadowLogger, ls, disk, events };
}
const entry = (block, item, extra) => Object.assign({ block, item, examItem: block + '.' + String(item).padStart(2, '0'), errorCode: '2', pattern: '', speedFlags: [], note: '', noteKind: 'clinical', createdAt: '2026-11-01T10:00:00.000Z', updatedAt: '2026-11-01T10:00:00.000Z' }, extra);
const bucket = (entries, over) => Object.assign({ formId: 'F1', form: 'Form One', date: '2026-11-10', entries }, over);
module.exports = { load, entry, bucket };

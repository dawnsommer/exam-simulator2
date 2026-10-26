'use strict';
/* In-memory Drive appDataFolder for Sync V3 tests: list (name = / name contains, paging, md5Checksum), media GET,
   create, PATCH upload, copy, delete, and fault injection (corrupt upload md5, quota full, auth expired, crash mid-upload). */
const { createHash } = require('node:crypto');
const md5 = t => createHash('md5').update(Buffer.from(String(t), 'utf8')).digest('hex');
class FakeDrive {
  constructor() { this.files = new Map(); this.seq = 0; this.log = []; this.faults = {}; this.clock = Date.UTC(2026, 9, 25, 8, 0, 0); this.pageSize = 1000; }
  tick() { this.clock += 1000; return new Date(this.clock).toISOString(); }
  put(name, body) { const text = typeof body === 'string' ? body : JSON.stringify(body); const id = 'f' + (++this.seq); this.files.set(id, { id, name, body: text, modifiedTime: this.tick() }); return id; }
  set(name, body) { const f = [...this.files.values()].find(x => x.name === name); if (!f) return this.put(name, body); f.body = typeof body === 'string' ? body : JSON.stringify(body); f.modifiedTime = this.tick(); return f.id; }
  byName(name) { return [...this.files.values()].find(f => f.name === name) || null; }
  json(name) { const f = this.byName(name); return f ? JSON.parse(f.body) : null; }
  names() { return [...this.files.values()].map(f => f.name).sort(); }
  meta(f) { return { id: f.id, name: f.name, md5Checksum: md5(f.body), modifiedTime: f.modifiedTime, size: String(Buffer.byteLength(f.body)) }; }
  res(status, data, text) { const body = text === undefined ? JSON.stringify(data ?? {}) : text; return { status, ok: status < 300, json: async () => JSON.parse(body), text: async () => body }; }
  async driveFetch(url, o = {}) {
    const u = new URL(url), method = String(o.method || 'GET').toUpperCase(), p = u.pathname;
    this.log.push(method + ' ' + p + (u.searchParams.get('q') ? ' ' + u.searchParams.get('q') : ''));
    if (this.faults.authExpired) { const e = new Error('Drive 401'); e.status = 401; throw e; }
    if (p === '/drive/v3/files' && method === 'GET') {
      const qs = u.searchParams.get('q') || '', eq = /name = '((?:\\.|[^'])*)'/.exec(qs), has = /name contains '((?:\\.|[^'])*)'/.exec(qs);
      let all = [...this.files.values()];
      if (eq) { const n = eq[1].replace(/\\(.)/g, '$1'); all = all.filter(f => f.name === n); }
      if (has) { const n = has[1].replace(/\\(.)/g, '$1'); all = all.filter(f => f.name.includes(n)); }
      all.sort((a, b) => a.name.localeCompare(b.name));
      const start = Number(u.searchParams.get('pageToken') || 0), page = all.slice(start, start + this.pageSize);
      return this.res(200, { files: page.map(f => this.meta(f)), nextPageToken: start + this.pageSize < all.length ? String(start + this.pageSize) : undefined });
    }
    if (p === '/drive/v3/files' && method === 'POST') { const m = JSON.parse(o.body); return this.res(200, this.meta(this.files.get(this.put(m.name, '')))); }
    let m;
    if ((m = /^\/drive\/v3\/files\/([^/]+)\/copy$/.exec(p)) && method === 'POST') {
      const s = this.files.get(decodeURIComponent(m[1])); if (!s) return this.res(404, {});
      return this.res(200, this.meta(this.files.get(this.put(JSON.parse(o.body).name, s.body))));
    }
    if ((m = /^\/upload\/drive\/v3\/files\/([^/]+)$/.exec(p)) && method === 'PATCH') {
      const f = this.files.get(decodeURIComponent(m[1])); if (!f) return this.res(404, {});
      if (this.faults.quotaFull) { const e = new Error('quota'); e.status = 403; throw e; }
      if (this.faults.crashMidUpload) { delete this.faults.crashMidUpload; throw new Error('connection lost'); }   // old content stays
      let body = o.body;
      if (this.faults.corruptNext) { delete this.faults.corruptNext; body = body.slice(0, -1) + ' '; }               // md5 will not match
      f.body = body; f.modifiedTime = this.tick();
      return this.res(200, this.meta(f));
    }
    if ((m = /^\/drive\/v3\/files\/([^/]+)$/.exec(p)) && method === 'GET') {
      const f = this.files.get(decodeURIComponent(m[1])); if (!f) return this.res(404, {});
      if (u.searchParams.get('alt') === 'media') return this.res(200, null, f.body);
      return this.res(200, this.meta(f));
    }
    if ((m = /^\/drive\/v3\/files\/([^/]+)$/.exec(p)) && method === 'DELETE') { this.files.delete(decodeURIComponent(m[1])); return this.res(204, {}); }
    return this.res(400, {});
  }
}
module.exports = { FakeDrive, md5 };

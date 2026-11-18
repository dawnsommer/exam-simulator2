/* ThunderUSMLE Simple Library — shared by Local (../library-simple.js) and iPad (library-simple.js); keep the two copies byte-identical.
   This root copy is the master: edit it, then `cp library-simple.js "Step Simulator IPAD/library-simple.js"` (tests/library-simple.test.cjs checks parity).
   An optional second look for the Library page (Settings > Appearance > Library style): Up next, one row of filters, one clean list.
   It only READS the form library through StepLibraryBridge (forms, recs, tabKey, scoreChipOn) and sends every action to thunder-ui
   (ThunderUI.formAction / ThunderUI.openForm / the Add forms button), so prompts, protections and saves still run.
   Sections: ThunderLibrarySimpleCore (pure: rows, status, filters, up next, signature; Node + browser) · view + app glue (browser only).
   Preference: localStorage['thunderLibrary.style'] = 'classic' (default) | 'simple'. Window API: ThunderLibrarySimple. */

(function (root) {
  'use strict';

  /* ---------- pure core ---------- */
  const natCmp = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
  const ts = (iso) => { const t = Date.parse(iso || ''); return isNaN(t) ? 0 : t; };
  const num = (x) => { const n = Number(x); return isFinite(n) ? n : 0; };

  function blockCountOf(rec) {
    const idx = Array.isArray(rec && rec.questionIndex) ? rec.questionIndex : [];
    return idx.reduce((n, q) => Math.max(n, (Number(q && q.blockIndex) || 0) + 1), 0) || 1;
  }

  // 'done' (completed) · 'progress' (started: resumable, answered or flagged in progress) · 'new'. Same rule as the classic Library.
  function statusOf(rec) {
    const s = (rec && rec.progressSummary) || {};
    if (s.completed) return 'done';
    if (s.canResume || s.answered || s.inProgress) return 'progress';
    return 'new';
  }

  // One list row from a catalog record. ctx = { tab, tabLabel, color, chip, tabOrder }
  function toRow(rec, ctx) {
    ctx = ctx || {};
    const s = rec.progressSummary || {};
    const st = statusOf(rec);
    const total = num(s.total) || num(rec.totalQuestions);
    const answered = num(s.answered);
    const blockCount = num(s.blockCount) || blockCountOf(rec);
    let pct = s.progressPct != null && s.progressPct !== '' ? num(s.progressPct) : (total ? answered / total * 100 : 0);
    pct = Math.max(0, Math.min(100, Math.round(pct)));
    const canResume = !!s.canResume;
    const activity = s.updatedAt || s.completedAt || rec.updatedAt || rec.importedAt || '';
    const attempts = num(s.attemptCount);
    return {
      id: rec.id, title: String(rec.displayName || rec.id || ''), tab: ctx.tab || 'Custom', tabLabel: ctx.tabLabel || ctx.tab || 'Custom', color: ctx.color || '', tabOrder: ctx.tabOrder == null ? 999 : ctx.tabOrder,
      st, canResume, suspended: canResume && !!s.suspended,
      total, answered, pct, blockCount, blockNow: Math.min(Math.max(num(s.currentBlockPointer), 0) + 1, blockCount),
      scorePct: s.completed && s.scorePct != null && s.scorePct !== '' ? num(s.scorePct) : null,
      scoreCorrect: s.completed ? num(s.scoreCorrect) : 0, scoreTotal: s.completed ? num(s.scoreTotal) : 0,
      three: ctx.chip && rec.threeDigitScore ? String(rec.threeDigitScore) : '', chip: !!ctx.chip,
      attempts, activity, completedAt: s.completed ? (s.completedAt || '') : '',
      date: st === 'done' ? (s.completedAt || activity) : st === 'progress' ? activity : '',
      action: canResume ? 'resume' : st === 'done' ? 'review' : 'start'
    };
  }

  // Rows in display order: the user's tab order, then natural order of the name ("NBME 9" before "NBME 10").
  // opts: { tabs:[{internal,label,color}], tabOf(rec) -> internal tab key, chipOf(rec, internal) -> boolean }
  function buildRows(recs, opts) {
    opts = opts || {};
    const tabs = opts.tabs || [], byKey = {};
    tabs.forEach((t, i) => { byKey[t.internal] = Object.assign({ order: i }, t); });
    const rows = (recs || []).map((rec) => {
      const key = (opts.tabOf && opts.tabOf(rec)) || 'Custom';
      const t = byKey[key] || { label: key === 'N-Forms' ? 'NBME' : key, color: '', order: 999 };
      return toRow(rec, { tab: key, tabLabel: t.label, color: t.color, tabOrder: t.order, chip: opts.chipOf ? !!opts.chipOf(rec, key) : false });
    });
    return rows.sort((a, b) => a.tabOrder - b.tabOrder || natCmp(a.tab, b.tab) || natCmp(a.title, b.title) || natCmp(a.id, b.id));
  }

  // Up next: the most recent resumable attempt, else the first not-started form in list order, else the latest finished form (review).
  function pickUpNext(rows) {
    const res = rows.filter((r) => r.canResume).sort((a, b) => ts(b.activity) - ts(a.activity));
    if (res.length) return { kind: 'resume', row: res[0], more: res.length - 1 };
    const nw = rows.find((r) => r.st === 'new');
    if (nw) return { kind: 'start', row: nw, more: 0 };
    const dn = rows.filter((r) => r.st === 'done').sort((a, b) => ts(b.completedAt || b.date) - ts(a.completedAt || a.date))[0];
    return dn ? { kind: 'review', row: dn, more: 0 } : null;
  }

  // Header numbers: forms done, in progress, weighted average of finished forms (correct / answered), falling back to the mean of the %.
  function summarize(rows) {
    const done = rows.filter((r) => r.st === 'done');
    const tot = done.reduce((n, r) => n + r.scoreTotal, 0), cor = done.reduce((n, r) => n + r.scoreCorrect, 0);
    let avg = null;
    if (tot > 0) avg = Math.round(cor / tot * 100);
    else { const ps = done.filter((r) => r.scorePct != null); if (ps.length) avg = Math.round(ps.reduce((n, r) => n + r.scorePct, 0) / ps.length); }
    return { total: rows.length, done: done.length, progress: rows.filter((r) => r.st === 'progress').length, fresh: rows.filter((r) => r.st === 'new').length, avg };
  }
  function statusLine(sm) {
    if (!sm.total) return 'No forms yet';
    const parts = [sm.done + ' of ' + sm.total + ' form' + (sm.total === 1 ? '' : 's') + ' done'];
    if (sm.progress) parts.push(sm.progress + ' in progress');
    if (sm.avg != null) parts.push('avg ' + sm.avg + '%');
    return parts.join(' · ');
  }

  // Search: every word must appear in the name, id or tab name.
  function matches(row, q) {
    const words = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return true;
    const hay = (row.title + ' ' + row.id + ' ' + row.tabLabel).toLowerCase();
    return words.every((w) => hay.includes(w));
  }
  // f = { tab: 'All' | internal tab key, status: 'all' | 'new' | 'progress' | 'done', q }
  function filterRows(rows, f) {
    f = f || {};
    return rows.filter((r) => (!f.tab || f.tab === 'All' || r.tab === f.tab) && (!f.status || f.status === 'all' || r.st === f.status) && matches(r, f.q));
  }
  // Status chip counts for the current tab and search (status itself is not applied).
  function statusCounts(rows, f) {
    const base = filterRows(rows, { tab: f && f.tab, q: f && f.q });
    return { all: base.length, new: base.filter((r) => r.st === 'new').length, progress: base.filter((r) => r.st === 'progress').length, done: base.filter((r) => r.st === 'done').length };
  }
  function tabCounts(rows) {
    const c = { All: rows.length };
    rows.forEach((r) => { c[r.tab] = (c[r.tab] || 0) + 1; });
    return c;
  }
  // Consecutive rows of one tab (rows are already in tab order).
  function groupRows(rows) {
    const out = [];
    rows.forEach((r) => {
      const g = out[out.length - 1];
      if (g && g.tab === r.tab) g.rows.push(r); else out.push({ tab: r.tab, label: r.tabLabel, color: r.color, rows: [r] });
    });
    return out;
  }

  const DAY = 86400000;
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  // "Today" · "Yesterday" · "3 days ago" · "Nov 12" (with the year when it is not this year). Empty when there is no date.
  function relDate(iso, now) {
    const t = ts(iso); if (!t) return '';
    const d = new Date(t), n = new Date(now == null ? Date.now() : now);
    const a = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()), b = Date.UTC(n.getFullYear(), n.getMonth(), n.getDate());
    const days = Math.round((b - a) / DAY);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days > 1 && days < 7) return days + ' days ago';
    return MON[d.getMonth()] + ' ' + d.getDate() + (d.getFullYear() !== n.getFullYear() ? ', ' + d.getFullYear() : '');
  }

  // Everything the view draws, as one string: re-render only when it changes. `day` makes "Today" roll over at midnight.
  function signature(model, state, day) {
    const rows = model.rows.map((r) => [r.id, r.title, r.tab, r.st, r.canResume ? 1 : 0, r.suspended ? 1 : 0, r.pct, r.blockNow, r.blockCount, r.scorePct, r.three, r.chip ? 1 : 0, r.date, r.attempts, r.total].join('~')).join('|');
    const tabs = (model.tabs || []).map((t) => [t.internal, t.label, t.color].join('~')).join('|');
    return [rows, tabs, state.tab, state.status, state.q || '', day || ''].join('#');
  }

  // Library tabs that have forms (All is added by the caller); a remembered tab with none falls back to All.
  function visibleTabs(tabs, rows) { const c = tabCounts(rows); return (tabs || []).filter((t) => c[t.internal] > 0); }
  function effectiveTab(tab, tabs, rows) { return !tab || tab === 'All' || visibleTabs(tabs, rows).some((t) => t.internal === tab) ? 'All' === tab || !tab ? 'All' : tab : 'All'; }
  const core = { visibleTabs, effectiveTab, natCmp, statusOf, toRow, buildRows, pickUpNext, summarize, statusLine, matches, filterRows, statusCounts, tabCounts, groupRows, relDate, signature, blockCountOf };
  root.ThunderLibrarySimpleCore = core;
  if (typeof module === 'object' && module.exports) module.exports = core;
  if (typeof document === 'undefined') return;

  /* ---------- view + app glue (browser) ---------- */
  const byId = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const STYLE_KEY = 'thunderLibrary.style', PREF_KEY = 'thunderLibrary.simple.v1';
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  const TAB_DOTS = { 'N-Forms': '#3B6FE0', IM: '#0F8B8D', OBGyn: '#C2417A', Surg: '#D9661F', Peds: '#7B5CD6', FM: '#3C9A4A', EM: '#D23F3F', Psych: '#5A67D8', Neuro: '#B7862A', UWSA: '#0E7490', F120: '#9A3412', Custom: '#7A8194' };
  const LEGACY_TAB_COLORS = ['#d9e3ea', '#38bdf8'];
  const STATUS_CHIPS = [['new', 'Not started'], ['progress', 'In progress'], ['done', 'Done']];
  const ACTION_LABEL = { start: 'Start', resume: 'Resume', review: 'Review' };
  const svg = (d, n) => `<svg width="${n || 18}" height="${n || 18}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const IC = {
    plus: '<path d="M12 5v14M5 12h14"/>', search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/>', chev: '<path d="m9 6 6 6-6 6"/>',
    play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/>', list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>'
  };

  const getStyle = () => (ls.get(STYLE_KEY) === 'simple' ? 'simple' : 'classic');
  const state = { tab: 'All', status: 'all', q: '' };
  try { const p = JSON.parse(ls.get(PREF_KEY) || '{}'); if (typeof p.tab === 'string') state.tab = p.tab; if (['all', 'new', 'progress', 'done'].includes(p.status)) state.status = p.status; } catch (e) {}
  const savePrefs = () => ls.set(PREF_KEY, JSON.stringify({ tab: state.tab, status: state.status }));

  /* --- data: StepLibraryBridge, read-only --- */
  const bridge = () => window.StepLibraryBridge || null;
  const tabInternal = (k) => (k === 'NBME' ? 'N-Forms' : k);
  // the user's library tabs in order, from the legacy filter pills (the same source as the classic Library)
  function readTabs() {
    return Array.from(document.querySelectorAll('#libraryFilters .filter-pill[data-filter]')).filter((p) => p.dataset.filter !== 'Overview' && p.dataset.filter !== 'All').map((p) => {
      const key = p.dataset.filter, internal = tabInternal(key);
      let color = (p.style.getPropertyValue('--tab-accent') || '').trim().toLowerCase();
      if (!color || LEGACY_TAB_COLORS.includes(color)) color = TAB_DOTS[internal] || TAB_DOTS.Custom;
      const raw = (p.querySelector('.v214-tab-label') && p.querySelector('.v214-tab-label').textContent || key).trim();
      return { key, internal, label: internal === 'N-Forms' ? 'NBME' : raw, color };
    });
  }
  function readModel() {
    const B = bridge(); if (!B || typeof B.forms !== 'function') return null;
    const tabs = readTabs(), member = new Map();
    tabs.forEach((t) => { try { B.recs(t.internal).forEach((r) => { if (!member.has(r.id)) member.set(r.id, t.internal); }); } catch (e) {} });
    const chips = {}, chipOn = (k) => { if (!(k in chips)) { try { chips[k] = !!B.scoreChipOn(k); } catch (e) { chips[k] = null; } } return chips[k]; };
    const recs = B.forms();
    const rows = buildRows(recs, {
      tabs,
      tabOf: (rec) => member.get(rec.id) || (function () { try { return B.tabKey(rec); } catch (e) { return 'Custom'; } })(),
      chipOf: (rec, k) => { const v = chipOn(k); return v == null ? (rec.type === 'N' || /^UWSA/i.test(String(rec.id || '')) || rec.filter === 'UWSA') : v; }
    });
    // a tab with no forms is still a filter; a form in an unlisted tab adds its own
    const seen = new Set(tabs.map((t) => t.internal)), extra = [];
    rows.forEach((r) => { if (!seen.has(r.tab)) { seen.add(r.tab); extra.push({ key: r.tab, internal: r.tab, label: r.tabLabel, color: r.color || TAB_DOTS[r.tab] || TAB_DOTS.Custom }); } });
    const allTabs = tabs.concat(extra);
    rows.forEach((r) => { if (!r.color) r.color = (allTabs.find((t) => t.internal === r.tab) || {}).color || TAB_DOTS.Custom; });
    return { rows, tabs: allTabs };
  }

  /* --- html --- */
  function rowHtml(r) {
    const meta = [r.total + ' question' + (r.total === 1 ? '' : 's'), r.blockCount + ' block' + (r.blockCount === 1 ? '' : 's')];
    if (r.attempts > 1) meta.push(r.attempts + ' attempts');
    const date = relDate(r.date);
    let stat;
    if (r.st === 'done') {
      stat = `<span class="ls-pct"><b>${r.scorePct == null ? '—' : r.scorePct + '%'}</b> correct</span>${r.three ? `<span class="ls-three" title="3-digit score">${esc(r.three)}</span>` : ''}`;
    } else if (r.st === 'progress') {
      stat = `<span class="ls-prog"><span class="ls-ptx">${r.suspended ? 'Suspended · ' : ''}Block ${r.blockNow} of ${r.blockCount}</span><span class="ls-bar" role="img" aria-label="${r.pct} percent answered"><i style="width:${r.pct}%"></i></span></span>`;
    } else stat = '<span class="ls-new">New</span>';
    const label = ACTION_LABEL[r.action];
    return `<div class="ls-row ${r.st}" role="listitem" data-ls-row="${esc(r.id)}"><div class="ls-main"><i class="ls-dot" style="background:${esc(r.color)}" aria-hidden="true"></i><div class="ls-name"><b title="${esc(r.title)}">${esc(r.title)}</b><small>${esc(meta.join(' · '))}</small></div></div>` +
      `<div class="ls-stat">${stat}${date ? `<span class="ls-sd">${esc(date)}</span>` : ''}</div><div class="ls-date">${esc(date) || '<span aria-hidden="true">—</span>'}</div>` +
      `<div class="ls-end"><button type="button" class="ls-btn ${r.action}" data-ls-act="${r.action}" data-ls-id="${esc(r.id)}" aria-label="${label} ${esc(r.title)}">${label}</button>` +
      `<button type="button" class="ls-more" data-ls-act="sheet" data-ls-id="${esc(r.id)}" aria-label="Details for ${esc(r.title)}" aria-haspopup="dialog" title="Details">${svg(IC.chev, 18)}</button></div></div>`;
  }
  function listHtml(rows, filtered, model, forms) {
    if (!forms) return `<div class="ls-empty"><span class="ls-eico">${svg(IC.list, 26)}</span><b>No forms yet</b><span>Add your first form to start practicing.</span><button type="button" class="ls-btn start" data-ls-add>${svg(IC.plus, 16)}Add forms</button></div>`;
    if (!filtered.length) return `<div class="ls-empty"><span class="ls-eico">${svg(IC.search, 26)}</span><b>No forms match</b><span>${state.q.trim() ? 'Nothing matches “' + esc(state.q.trim()) + '” with these filters.' : 'No forms with these filters.'}</span><button type="button" class="ls-btn review" data-ls-clear>Clear filters</button></div>`;
    const all = state.tab === 'All';
    const groups = groupRows(filtered);
    return groups.map((g) => {
      const total = model.rows.filter((r) => r.tab === g.tab), done = total.filter((r) => r.st === 'done').length;
      return `<section class="ls-group"${all ? ` aria-label="${esc(g.label)}"` : ''}>${all ? `<h2 class="ls-gh"><i class="ls-dot" style="background:${esc(g.color)}" aria-hidden="true"></i><b>${esc(g.label)}</b><span>${done} of ${total.length} done</span></h2>` : ''}<div class="ls-rows" role="list">${g.rows.map(rowHtml).join('')}</div></section>`;
    }).join('');
  }
  function nextHtml(up, forms) {
    if (!up) return '';
    const r = up.row, date = relDate(r.date);
    const kicker = up.kind === 'review' ? 'All caught up' : 'Up next';
    let title = r.title, meta, bar = '', btn;
    if (up.kind === 'resume') {
      meta = [r.suspended ? 'Suspended' : 'In progress', 'Block ' + r.blockNow + ' of ' + r.blockCount, r.answered + ' of ' + r.total + ' answered', date].filter(Boolean).join(' · ');
      bar = `<span class="ls-nbar" role="img" aria-label="${r.pct} percent answered"><i style="width:${r.pct}%"></i></span>`;
      btn = `<button type="button" class="ls-go" data-ls-act="resume" data-ls-id="${esc(r.id)}">${svg(IC.play, 16)}Resume</button>`;
    } else if (up.kind === 'start') {
      meta = [r.tabLabel, r.total + ' question' + (r.total === 1 ? '' : 's'), r.blockCount + ' block' + (r.blockCount === 1 ? '' : 's')].join(' · ');
      btn = `<button type="button" class="ls-go" data-ls-act="start" data-ls-id="${esc(r.id)}">${svg(IC.play, 16)}Start</button>`;
    } else {
      title = 'Every form is done';
      meta = 'Latest: ' + r.title + (r.scorePct != null ? ' · ' + r.scorePct + '%' : '') + (date ? ' · ' + date : '');
      btn = `<button type="button" class="ls-go" data-ls-act="review" data-ls-id="${esc(r.id)}">Review latest</button>`;
    }
    const more = up.more > 0 ? `<button type="button" class="ls-link" data-ls-status="progress">+${up.more} more in progress</button>` : '';
    return `<div class="ls-ntx"><span class="ls-kicker">${kicker}</span><b class="ls-ntitle" title="${esc(title)}">${esc(title)}</b><span class="ls-nmeta">${esc(meta)}${more ? ' · ' : ''}${more}</span>${bar}</div><div class="ls-nact">${btn}</div>`;
  }
  function filtersHtml(model, forms) {
    if (!forms) return '';
    const tc = tabCounts(model.rows), sc = statusCounts(model.rows, { tab: state.tab, q: state.q });
    const tabs = [['All', 'All', '']].concat(visibleTabs(model.tabs, model.rows).map((t) => [t.internal, t.label, t.color]));
    const tabHtml = tabs.map(([k, l, c]) => `<button type="button" class="ls-tab${tc[k] ? '' : ' none'}" data-ls-tab="${esc(k)}" aria-pressed="${state.tab === k}">${c ? `<i class="ls-dot" style="background:${esc(c)}" aria-hidden="true"></i>` : ''}<span>${esc(l)}</span><small>${tc[k] || 0}</small></button>`).join('');
    const chipHtml = STATUS_CHIPS.map(([k, l]) => `<button type="button" class="ls-chip" data-ls-status="${k}" aria-pressed="${state.status === k}">${l}<small>${sc[k]}</small></button>`).join('');
    return `<div class="ls-tabs" role="group" aria-label="Library tab">${tabHtml}</div><div class="ls-chips" role="group" aria-label="Status">${chipHtml}</div>`;
  }

  const SKELETON = `<header class="ls-head"><div class="ls-title"><h1>Library</h1><p class="ls-status" data-ls-r="status" aria-live="polite"></p></div>` +
    `<div class="ls-tools"><label class="ls-search">${svg(IC.search, 18)}<span class="ls-sr">Search forms</span><input type="search" class="tu-bare" id="tuLsSearch" placeholder="Search forms" autocomplete="off" enterkeyhint="search"></label>` +
    `<button type="button" class="ls-add" data-ls-add aria-haspopup="dialog">${svg(IC.plus, 18)}<span>Add forms</span></button></div></header>` +
    `<section class="ls-next" data-ls-r="next" aria-label="Up next" hidden></section><div class="ls-filters" data-ls-r="filters"></div><div class="ls-list" data-ls-r="list"></div>`;

  const cache = new Map();
  let rootEl = null, lastSig = '', lastDay = '';
  function focusSel(el) {
    if (!el || !el.dataset) return '';
    const d = el.dataset;
    if (d.lsTab != null) return `[data-ls-tab="${CSS.escape(d.lsTab)}"]`;
    if (d.lsStatus != null) return `[data-ls-status="${CSS.escape(d.lsStatus)}"]`;
    if (d.lsAct && d.lsId) return `[data-ls-act="${CSS.escape(d.lsAct)}"][data-ls-id="${CSS.escape(d.lsId)}"]`;
    if (d.lsAdd != null) return '[data-ls-add]';
    return '';
  }
  // swap a region only when its html changed; keep keyboard focus on the same control
  function setRegion(name, html) {
    const el = rootEl && rootEl.querySelector(`[data-ls-r="${name}"]`); if (!el) return;
    if (cache.get(name) === html && el.dataset.lsFilled) return;
    const a = document.activeElement, sel = a && el.contains(a) ? focusSel(a) : '';
    el.innerHTML = html; el.dataset.lsFilled = '1'; cache.set(name, html);
    if (sel) { const again = el.querySelector(sel); if (again) again.focus({ preventScroll: true }); }
  }

  function render(force) {
    if (!rootEl) return;
    const model = readModel() || { rows: [], tabs: [] };
    if (state.tab !== 'All' && effectiveTab(state.tab, model.tabs, model.rows) === 'All' && model.rows.length) { state.tab = 'All'; savePrefs(); }
    const day = new Date().toDateString(), sig = signature(model, state, day);
    if (!force && sig === lastSig && day === lastDay) return;
    lastSig = sig; lastDay = day;
    const forms = model.rows.length, filtered = filterRows(model.rows, state), up = pickUpNext(model.rows);
    setRegion('status', esc(statusLine(summarize(model.rows))));
    const nx = rootEl.querySelector('[data-ls-r="next"]'); setRegion('next', nextHtml(up, forms)); if (nx) nx.hidden = !up;
    setRegion('filters', filtersHtml(model, forms));
    const f = rootEl.querySelector('[data-ls-r="filters"]'); if (f) f.hidden = !forms;
    setRegion('list', listHtml(model.rows, filtered, model, forms));
  }

  /* --- actions --- */
  function addForms() {
    const b = byId('tuAddForms') || byId('loadNewFormBtn'); if (b) b.click();
  }
  // (buttons use data-ls-id, not data-id: thunder-ui's closeSheet would otherwise return focus to the hidden classic card)
  function onClick(e) {
    const t = e.target.closest && e.target.closest('button, [data-ls-row]'); if (!t || !rootEl.contains(t)) return;
    if (t.dataset.lsTab != null) { state.tab = t.dataset.lsTab; savePrefs(); render(true); return; }
    if (t.dataset.lsStatus != null) { state.status = state.status === t.dataset.lsStatus ? 'all' : t.dataset.lsStatus; savePrefs(); render(true); return; }
    if (t.hasAttribute('data-ls-add')) { addForms(); return; }
    if (t.hasAttribute('data-ls-clear')) { state.tab = 'All'; state.status = 'all'; state.q = ''; const i = byId('tuLsSearch'); if (i) i.value = ''; savePrefs(); render(true); return; }
    const TUI = window.ThunderUI, act = t.dataset.lsAct, id = t.dataset.lsId || t.dataset.lsRow; if (!TUI) return;
    if (t.matches('[data-ls-row]') && !act) { if (TUI.openForm && !(window.getSelection && String(window.getSelection()))) TUI.openForm(id, t.querySelector('.ls-more')); return; } // the row body opens the details
    if (!act || !id) return;
    if (act === 'sheet') { TUI.openForm && TUI.openForm(id, t); return; }
    if (TUI.formAction) Promise.resolve(TUI.formAction(id, act)).then((ok) => { if (ok === false && TUI.openForm) TUI.openForm(id, t); }, () => {});
  }
  function onInput(e) {
    if (e.target.id !== 'tuLsSearch') return;
    state.q = e.target.value; render(true);
  }
  function onKey(e) {
    if (e.target.id === 'tuLsSearch' && e.key === 'Escape' && e.target.value) { e.target.value = ''; state.q = ''; render(true); e.stopPropagation(); }
  }

  /* --- mounting --- */
  const H = ':root[data-tu] body #menu', S = H + ' #tuLibSimple';
  const CSS_TEXT = `
#libraryModePanel>#tuLibSimple{display:none}
${H} #libraryModePanel.tu-lib-simple.tu-has-home>#tuHome{display:none!important}
${H} #libraryModePanel.tu-lib-simple.tu-has-home>#tuLibSimple{position:static!important;left:auto!important;top:auto!important;width:auto!important;height:auto!important;overflow:visible!important;visibility:visible!important;pointer-events:auto!important;display:flex!important}
@media (max-width:900px){${H}:has(#libraryModePanel.tu-lib-simple.active)[data-tu-page="library"] aside.modern-sidebar #tuAddForms{display:none!important}}
/* the page padding moves inside the list so the sticky tab headers stick to the very top of the scroll area */
${H} .modern-main:has(#libraryModePanel.tu-lib-simple.tu-has-home.active){padding-top:0!important}
${S}{padding-top:22px;max-width:1000px;margin:0 auto;flex-direction:column;gap:18px;color:var(--tu-on);font-family:var(--tu-font);container:lsimple/inline-size;min-width:0}
${S} *{box-sizing:border-box}
${S} :is(h1,h2,p){margin:0!important;padding:0!important;font-family:var(--tu-font)!important;color:inherit!important;background:none!important;border:0!important}
${S} button{font-family:var(--tu-font)!important;cursor:pointer;margin:0!important;box-shadow:none;-webkit-appearance:none;appearance:none;text-transform:none!important;letter-spacing:0!important;transform:none!important;filter:none!important}
${S} .ls-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
${S} .ls-head{display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:14px 16px}
${S} .ls-title{min-width:0;display:flex;flex-direction:column;gap:3px}
${S} .ls-title h1{font-size:30px!important;font-weight:800!important;letter-spacing:-.025em!important;line-height:1.1!important}
${S} .ls-status{font-size:14px!important;font-weight:500;color:var(--tu-on3)!important;min-height:20px}
${S} :is(span,label){color:inherit!important}
${S} .ls-tools{display:flex;align-items:center;gap:10px;min-width:0}
${S} .ls-search{display:flex;align-items:center;gap:8px;height:44px;padding:0 16px;width:280px;max-width:100%;border-radius:999px;background:var(--tu-s2);color:var(--tu-on3)!important;border:1px solid transparent;transition:border-color .15s,background .15s}
${S} .ls-search:hover{background:var(--tu-s3)}
${S} .ls-search:focus-within{background:var(--tu-surface);border-color:var(--tu-p);outline:3px solid color-mix(in srgb,var(--tu-p) 28%,transparent);outline-offset:0}
${S} .ls-search input{-webkit-appearance:none!important;appearance:none!important;border:0!important;background:transparent!important;outline:none!important;flex:1!important;min-width:0!important;width:100%!important;height:40px!important;padding:0!important;margin:0!important;box-shadow:none!important;font:500 14.5px var(--tu-font)!important;color:var(--tu-on)!important}
${S} .ls-search input::placeholder{color:var(--tu-on3)}
${S} .ls-add{display:inline-flex;align-items:center;gap:8px;height:44px;padding:0 20px 0 16px;border:0!important;border-radius:999px!important;background:var(--tu-p)!important;color:var(--tu-onp)!important;font:700 14.5px var(--tu-font)!important;white-space:nowrap;flex:none;transition:filter .15s}
${S} .ls-add:hover{filter:brightness(1.08)!important}
${S} .ls-next{display:flex;align-items:center;gap:20px;padding:22px 24px;border-radius:24px;background:var(--tu-pc);color:var(--tu-onpc);position:relative;overflow:hidden}
${S} .ls-next[hidden]{display:none!important}
${S} .ls-ntx{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px}
${S} .ls-kicker{font-size:11.5px;font-weight:800;letter-spacing:.09em!important;text-transform:uppercase!important;opacity:.78}
${S} .ls-ntitle{font-size:24px;font-weight:800;letter-spacing:-.02em;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
${S} .ls-nmeta{font-size:14px;font-weight:500;opacity:.88;line-height:1.45}
${S} .ls-nbar{display:block;height:6px;max-width:380px;margin-top:8px;border-radius:999px;background:rgba(0,0,0,.14);overflow:hidden}
@supports (background:color-mix(in srgb,red 10%,blue)){${S} .ls-nbar{background:color-mix(in srgb,var(--tu-onpc) 16%,transparent)}}
${S} .ls-nbar i{display:block;height:100%;border-radius:inherit;background:var(--tu-p);min-width:6px}
${S} .ls-link{border:0!important;background:none!important;padding:0!important;color:inherit!important;font:700 14px var(--tu-font)!important;text-decoration:underline;text-underline-offset:3px;opacity:1}
${S} .ls-nact{flex:none}
${S} .ls-go{display:inline-flex;align-items:center;justify-content:center;gap:9px;height:52px;padding:0 30px;border:0!important;border-radius:999px!important;background:var(--tu-p)!important;color:var(--tu-onp)!important;font:800 16px var(--tu-font)!important;box-shadow:0 4px 14px rgba(0,0,0,.18)!important;white-space:nowrap}
${S} .ls-go:hover{filter:brightness(1.08)!important}
${S} .ls-filters{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px 16px}
${S} .ls-filters[hidden]{display:none!important}
${S} .ls-tabs{display:flex;flex-wrap:wrap;gap:2px;padding:4px;border-radius:16px;background:var(--tu-s1);min-width:0;max-width:100%}
${S} .ls-tab{display:inline-flex;align-items:center;gap:7px;height:38px;padding:0 13px!important;border:0!important;border-radius:12px!important;background:transparent!important;color:var(--tu-on2)!important;font:600 13.5px var(--tu-font)!important;white-space:nowrap;flex:none}
${S} .ls-tab small,${S} .ls-chip small{font-size:11.5px;font-weight:700;color:var(--tu-on3);font-variant-numeric:tabular-nums}
${S} .ls-tab.none{opacity:.55}
${S} .ls-tab:hover{background:var(--tu-s2)!important;color:var(--tu-on)!important}
${S} .ls-tab[aria-pressed="true"]{background:var(--tu-surface)!important;color:var(--tu-on)!important;font-weight:700!important;box-shadow:0 1px 2px rgba(0,0,0,.14),0 0 0 1px var(--tu-line2)!important}
${S} .ls-dot{display:inline-block;width:9px;height:9px;border-radius:50%;flex:none}
${S} .ls-chips{display:flex;gap:6px;flex-wrap:wrap}
${S} .ls-chip{display:inline-flex;align-items:center;gap:7px;height:38px;padding:0 14px!important;border:1px solid var(--tu-line)!important;border-radius:999px!important;background:transparent!important;color:var(--tu-on2)!important;font:600 13.5px var(--tu-font)!important;white-space:nowrap}
${S} .ls-chip:hover{background:var(--tu-s1)!important;color:var(--tu-on)!important}
${S} .ls-chip[aria-pressed="true"]{background:var(--tu-pc)!important;border-color:var(--tu-p)!important;color:var(--tu-onpc)!important}
${S} .ls-chip[aria-pressed="true"] small{color:inherit;opacity:.8}
${S} .ls-list{display:flex;flex-direction:column;gap:14px;min-width:0}
${S} .ls-group{background:var(--tu-surface);border:1px solid var(--tu-line2);border-radius:22px;overflow:clip;box-shadow:var(--tu-shadow)}
${S} .ls-gh{display:flex!important;align-items:center;gap:9px;position:sticky;top:0;z-index:2;height:42px;padding:0 20px!important;background:var(--tu-s1)!important;border-bottom:1px solid var(--tu-line2)!important;font-size:13px!important;font-weight:700!important;margin:0!important}
${S} .ls-gh b{font-weight:800}
${S} .ls-gh span{margin-left:auto;font-size:12px;font-weight:600;color:var(--tu-on3)!important}
${S} .ls-row{display:grid;grid-template-columns:minmax(0,1fr) 190px 96px auto;align-items:center;gap:14px;min-height:66px;padding:10px 12px 10px 20px;border-top:1px solid var(--tu-line2);cursor:pointer;transition:background .12s}
${S} .ls-rows>.ls-row:first-child{border-top:0}
${S} .ls-row:hover{background:var(--tu-s1)}
${S} .ls-main{display:flex;align-items:center;gap:13px;min-width:0}
${S} .ls-name{display:flex;flex-direction:column;gap:2px;min-width:0}
${S} .ls-name b{font-size:15.5px;font-weight:700;letter-spacing:-.005em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
${S} .ls-name small{font-size:12.5px;color:var(--tu-on3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
${S} .ls-stat{display:flex;align-items:center;gap:10px;min-width:0;font-size:13.5px}
${S} .ls-sd{display:none}
${S} .ls-prog{display:flex;flex-direction:column;gap:6px;min-width:0;width:100%}
${S} .ls-ptx{font-size:13px;font-weight:600;color:var(--tu-on2)!important;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
${S} .ls-bar{display:block;height:5px;border-radius:999px;background:var(--tu-s3);overflow:hidden}
${S} .ls-bar i{display:block;height:100%;border-radius:inherit;background:var(--tu-p);min-width:4px}
${S} .ls-pct{color:var(--tu-on2)!important;font-weight:500;white-space:nowrap}
${S} .ls-pct b{font-weight:800;color:var(--tu-ok);font-size:15px;font-variant-numeric:tabular-nums}
${S} .ls-three{display:inline-flex;align-items:center;height:24px;padding:0 9px;border-radius:8px;background:var(--tu-pc);color:var(--tu-onpc)!important;font-size:12.5px;font-weight:800;font-variant-numeric:tabular-nums}
${S} .ls-three.none{background:var(--tu-s2);color:var(--tu-on3)!important;font-weight:600}
${S} .ls-new{display:inline-flex;align-items:center;height:24px;padding:0 11px;border-radius:999px;background:var(--tu-s2);color:var(--tu-on2)!important;font-size:12px;font-weight:700}
${S} .ls-date{font-size:13px;color:var(--tu-on3)!important;white-space:nowrap;font-variant-numeric:tabular-nums}
${S} .ls-end{display:flex;align-items:center;gap:4px}
${S} .ls-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-width:92px;height:38px;padding:0 18px!important;border:0!important;border-radius:999px!important;font:700 13.5px var(--tu-font)!important;white-space:nowrap}
${S} .ls-btn.resume{background:var(--tu-p)!important;color:var(--tu-onp)!important}
${S} .ls-btn.start{background:var(--tu-pc)!important;color:var(--tu-onpc)!important}
${S} .ls-btn.review{background:transparent!important;color:var(--tu-on)!important;border:1px solid var(--tu-line)!important}
${S} .ls-btn:hover{filter:brightness(.95)!important}
${S} .ls-btn.review:hover{background:var(--tu-s2)!important;filter:none!important}
${S} .ls-more{width:40px;height:40px;display:inline-flex;align-items:center;justify-content:center;padding:0!important;border:0!important;border-radius:50%!important;background:transparent!important;color:var(--tu-on3)!important}
${S} .ls-more:hover{background:var(--tu-s3)!important;color:var(--tu-on)!important}
${S} .ls-empty{display:flex;flex-direction:column;align-items:center;gap:8px;padding:52px 20px;text-align:center;background:var(--tu-surface);border:1px dashed var(--tu-line);border-radius:22px;color:var(--tu-on3)}
${S} .ls-empty b{font-size:17px;color:var(--tu-on)}
${S} .ls-empty>span:not(.ls-eico){color:var(--tu-on3)!important}
${S} .ls-empty .ls-btn{margin-top:8px;height:44px}
${S} .ls-eico{display:grid;place-items:center;width:56px;height:56px;border-radius:50%;background:var(--tu-s2);color:var(--tu-on2)!important;margin-bottom:4px}
${S} button:focus-visible{outline:3px solid var(--tu-p)!important;outline-offset:2px!important}
${S} .ls-search input:focus-visible{outline:none!important}
${H}.theme-dark #tuLibSimple .ls-tab[aria-pressed="true"]{background:var(--tu-s3)!important}
@container lsimple (max-width:760px){
  ${S} .ls-row{grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"main end" "stat stat";gap:6px 10px;padding:12px 8px 12px 16px;min-height:0}
  ${S} .ls-main{grid-area:main}${S} .ls-stat{grid-area:stat;padding-left:22px;padding-right:8px}${S} .ls-end{grid-area:end}${S} .ls-date{display:none}
  ${S} .ls-sd{display:inline;color:var(--tu-on3)!important;font-size:12.5px;white-space:nowrap}
  ${S} .ls-sd::before{content:"· ";}
  ${S} .ls-prog{flex-direction:row;align-items:center;gap:10px;width:auto;flex:1}${S} .ls-ptx{flex:0 1 auto;min-width:0}${S} .ls-bar{flex:1 1 28px;min-width:28px}
  ${S} .ls-btn{min-width:84px;height:44px}${S} .ls-more{width:44px;height:44px}
}
@container lsimple (max-width:600px){
  ${S}{gap:14px}
  ${S} .ls-head{align-items:center;gap:8px 12px}
  ${S} .ls-title,${S} .ls-tools{display:contents}
  ${S} .ls-title h1{font-size:28px!important;order:1;flex:1}
  ${S} .ls-add{order:2;height:44px}
  ${S} .ls-status{order:3;flex:1 1 100%}
  ${S} .ls-search{order:4;width:100%;flex:1 1 100%;margin-top:4px}
  ${S} .ls-next{flex-direction:column;align-items:stretch;gap:16px;padding:18px;border-radius:22px}
  ${S} .ls-ntitle{font-size:21px;white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
  ${S} .ls-go{width:100%;height:52px}
  ${S} .ls-filters{flex-direction:column;align-items:stretch;gap:10px}
  ${S} .ls-tabs,${S} .ls-chips{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain}
  ${S} .ls-tabs::-webkit-scrollbar,${S} .ls-chips::-webkit-scrollbar{display:none}
  ${S} .ls-tab,${S} .ls-chip{height:44px;flex:none}
  ${S} .ls-chip{padding:0 16px!important}
  ${S} .ls-group{border-radius:18px}
  ${S} .ls-gh{padding:0 16px!important;height:44px}
  ${S} .ls-name b{font-size:15px}
  ${S} .ls-end{gap:2px}
  ${S} .ls-btn{min-width:78px;padding:0 14px!important}
}
@media (prefers-reduced-motion:reduce){${S} *{transition:none!important}}
`;

  function ensureCss() {
    if (byId('tu-libsimple-css')) return;
    const st = document.createElement('style'); st.id = 'tu-libsimple-css'; st.textContent = CSS_TEXT; document.head.appendChild(st);
  }
  function ensureRoot() {
    const panel = byId('libraryModePanel'); if (!panel) return null;
    ensureCss();
    let el = byId('tuLibSimple');
    if (!el) {
      el = document.createElement('div'); el.id = 'tuLibSimple'; el.setAttribute('aria-label', 'Library'); el.innerHTML = SKELETON;
      panel.appendChild(el);
      el.addEventListener('click', onClick); el.addEventListener('input', onInput); el.addEventListener('keydown', onKey);
      cache.clear(); lastSig = '';
    }
    rootEl = el;
    return el;
  }
  function apply() {
    const simple = getStyle() === 'simple', panel = byId('libraryModePanel'); if (!panel) return false;
    if (simple) ensureRoot();
    panel.classList.toggle('tu-lib-simple', simple);
    if (simple) render();
    return true;
  }
  function setStyle(v) {
    const next = v === 'simple' ? 'simple' : 'classic';
    if (next === getStyle() && byId('libraryModePanel') && byId('libraryModePanel').classList.contains('tu-lib-simple') === (next === 'simple')) { paintSettings(); return next; }
    ls.set(STYLE_KEY, next);
    apply();
    paintSettings();
    // the classic Library was hidden: let it re-measure its tiles
    if (next === 'classic' && window.ThunderUI && window.ThunderUI.refresh) window.ThunderUI.refresh();
    try { window.dispatchEvent(new CustomEvent('thunderlibrary:style', { detail: { style: next } })); } catch (e) {}
    return next;
  }
  function refresh() { if (getStyle() === 'simple') { if (!rootEl || !rootEl.isConnected) apply(); else render(); } }

  /* --- Settings > Appearance > Library style (the row sits in <div data-tu-mount="libstyle">) --- */
  function settingHtml() {
    const cur = getStyle();
    return `<div class="tu-setrow" data-ls-set><div><b>Library style</b><span>Classic shows category tiles, performance rings and form cards. Simple is one clean list with an Up next card.</span></div>` +
      `<div class="tu-setctl"><div class="tu-setseg" role="radiogroup" aria-label="Library style">${[['classic', 'Classic'], ['simple', 'Simple']].map(([v, l]) => `<button type="button" role="radio" aria-checked="${cur === v}" data-ls-style="${v}">${l}</button>`).join('')}</div></div></div>`;
  }
  function mountSetting(el) {
    if (!el) return;
    const h = settingHtml();
    if (el.dataset.lsSig === h && el.firstElementChild) return;
    el.innerHTML = h; el.dataset.lsSig = h;
  }
  function paintSettings() { document.querySelectorAll('[data-tu-mount="libstyle"]').forEach(mountSetting); }
  document.addEventListener('click', (e) => {
    const b = e.target && e.target.closest && e.target.closest('[data-ls-style]'); if (!b || b.closest('#tuLibSimple')) return;
    e.preventDefault(); setStyle(b.dataset.lsStyle);
  });
  window.addEventListener('storage', (e) => { if (e.key === STYLE_KEY) { apply(); paintSettings(); } });

  /* --- keep it current: no polling of the DOM, only a cheap signature check --- */
  let queued = false;
  const queue = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; try { refresh(); } catch (e) { console.warn('ThunderLibrarySimple refresh failed', e); } }); };
  let setQueued = false;
  const queueSettings = () => { if (setQueued) return; setQueued = true; setTimeout(() => { setQueued = false; paintSettings(); }, 0); };
  let watchedPanel = null, watchedSettings = null;
  function watch() {
    const panel = byId('libraryModePanel');
    if (panel && panel !== watchedPanel) {
      watchedPanel = panel;
      new MutationObserver((recs) => { if (getStyle() === 'simple' && recs.some((r) => !(r.target.closest && r.target.closest('#tuLibSimple, #tuHome')))) queue(); }).observe(panel, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    }
    const sp = byId('settingsPanel');
    if (sp && sp !== watchedSettings) { watchedSettings = sp; new MutationObserver(queueSettings).observe(sp, { childList: true, subtree: true }); queueSettings(); }
  }
  document.addEventListener('click', (e) => { if (e.target && e.target.closest && e.target.closest('#libraryTab, #tuResumeCard')) setTimeout(queue, 60); }, true);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') queue(); });
  setInterval(() => { if (getStyle() === 'simple' && document.visibilityState === 'visible') queue(); }, 2500); // late progress changes (an exam just ended, a sync merged)

  function boot() {
    apply(); watch();
    let n = 0; const t = setInterval(() => { apply(); watch(); if (++n > 40) clearInterval(t); }, 250);
  }
  window.ThunderLibrarySimple = { version: 1, mountSetting, setStyle, getStyle, refresh, core };
  // the page exists already (this script loads at the end of <body>); draw before the first paint when it is the chosen style
  if (document.readyState === 'loading') { try { apply(); } catch (e) {} document.addEventListener('DOMContentLoaded', boot); } else boot();
})(typeof self !== 'undefined' ? self : globalThis);

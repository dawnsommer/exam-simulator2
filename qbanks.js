/* ThunderUSMLE Qbanks view: Create test · Previous tests · Performance · Manage banks, the Import wizard, the Re-tag sheet
   and the Re-tag chip row on the exam screen. Shared by Local (../qbanks.js) and iPad (qbanks.js); keep the two copies byte-identical.
   Also draws Settings > Qbanks (ThunderQbanksUI.mountSettings(host), called by thunder-ui.js after each Settings paint).
   This root copy is the master: edit it, then `cp qbanks.js "Step Simulator IPAD/qbanks.js"`.
   Needs ThunderQbanksCore (qbanks-core.js) and StepLibraryBridge.qbanks* (see _draft_qbanks/CONTRACT.md). Styles itself with the
   app's --tu-* tokens (theme + accent follow the app). The legacy Qbank panels stay in the DOM, hidden; every start and history
   action drives the legacy inputs/buttons so the existing pool, save and resume code still runs. */
(function (root) {
'use strict';
if (root.ThunderQbanksUI) return;
const doc = root.document;
const KEY = 'thunderQbanks.v1';
const UNAS = 'Unassigned';
const byId = id => doc.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => Number(n || 0).toLocaleString();
const core = () => root.ThunderQbanksCore;
const bridge = () => root.StepLibraryBridge || null;
const plural = (n, w) => `${fmt(n)} ${w}${n === 1 ? '' : 's'}`;

const tick = '<svg class="tq-ico" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg>';
const chev = '<svg class="tq-ico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
const ic = (d, s, sw, fill) => `<svg class="tq-ico" width="${s || 18}" height="${s || 18}" viewBox="0 0 24 24" fill="${fill ? 'currentColor' : 'none'}" stroke="${fill ? 'none' : 'currentColor'}" stroke-width="${sw || 2}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  timer: ic('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/>'),
  tutor: ic('<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/>'),
  play: ic('<path d="M7 4v16l13-8z"/>', 18, 0, true),
  pencil: ic('<path d="M4 20h4L19 9l-4-4L4 16z"/>'),
  trash: ic('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
  dl: ic('<path d="M12 4v12M6 10l6 6 6-6M4 20h16"/>'),
  plus: ic('<path d="M12 5v14M5 12h14"/>', 20, 2.4),
  x: ic('<path d="M6 6l12 12M18 6 6 18"/>', 20, 2.2),
  search: ic('<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>', 16, 2.2),
  warn: ic('<path d="M12 3 2 20h20zM12 10v4M12 17v.5"/>'),
  file: ic('<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4M9 13h6M9 17h6"/>', 34, 1.6),
  tag: ic('<path d="M3 12V3h9l9 9-9 9z"/><circle cx="8" cy="8" r="1.5"/>'),
  refresh: ic('<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>')
};
const STATUS = [['unused', 'Unused'], ['incorrect', 'Incorrect'], ['marked', 'Marked'], ['omitted', 'Omitted'], ['correct', 'Correct']];
const STATUS_LABEL = { unused: 'Unused', incorrect: 'Incorrect', marked: 'Marked', omitted: 'Omitted', correct: 'Correct' };
const POOL_LABEL = { unused: 'Unused', used: 'Used', wrongs: 'Wrongs', marked: 'Marked', wrongs_marked: 'Wrongs + marked', all: 'All' };
const ATTEMPTS = {
  qbank: [['completed_qbank', 'Completed Qbank tests'], ['latest_qbank', 'Latest Qbank test'], ['all_qbank', 'All Qbank tests']],
  forms: [['first', '1st attempts only'], ['latest_completed', 'Latest completed'], ['active', 'Active selected']]
};
const COLORS = ['#e4572e', '#2f9e44', '#1971c2', '#ae3ec9', '#f08c00', '#0c8599', '#5c5f66'];

/* ---------- state ---------- */
function loadPrefs() { try { return JSON.parse(root.localStorage.getItem(KEY) || 'null') || {}; } catch (e) { return {}; } }
const P = loadPrefs();
const S = {
  tab: 'create', prevTab: 'create',
  sel: new Set(Array.isArray(P.sel) ? P.sel : []), selFromPrefs: Array.isArray(P.sel),
  statuses: new Set(Array.isArray(P.statuses) && P.statuses.length ? P.statuses : ['unused']),
  sort: ['az', 'count', 'weak'].includes(P.sort) ? P.sort : 'az',
  reviewTag: P.reviewTag !== false,
  mode: P.mode === 'timed' ? 'timed' : 'tutor', secs: Math.max(15, Math.min(600, Number(P.secs) || 90)),
  track: P.track === 'forms' ? 'forms' : P.track === 'qbank' ? 'qbank' : '', attempt: typeof P.attempt === 'string' ? P.attempt : '',
  subs: null, syss: null, fq: '', formsOff: new Set(), want: 40, perBlock: 40, shuffle: true, name: '', preset: '',
  hf: 'all', hq: '', open: {}, stale: true, busy: false
};
function savePrefs() {
  try { root.localStorage.setItem(KEY, JSON.stringify({ sel: [...S.sel], statuses: [...S.statuses], sort: S.sort, reviewTag: S.reviewTag, mode: S.mode, secs: S.secs, track: S.track, attempt: S.attempt })); } catch (e) {}
}
let D = null;      // bridge qbanks() result
let seq = 0;

/* ---------- small helpers ---------- */
function setHtml(el, html) {
  if (!el || el._h === html) return false;
  const a = doc.activeElement; let key = '', pos = null;
  if (a && a !== el && el.contains(a)) {
    key = Array.from(a.attributes).filter(x => /^data-/.test(x.name)).map(x => `[${x.name}="${root.CSS.escape(x.value)}"]`).join('');
    try { if (a.selectionStart != null) pos = [a.selectionStart, a.selectionEnd]; } catch (e) {}
  }
  el.innerHTML = html; el._h = html;
  if (key) { const n = el.querySelector(key); if (n) { n.focus({ preventScroll: true }); if (pos && n.setSelectionRange) try { n.setSelectionRange(pos[0], pos[1]); } catch (e) {} } }
  return true;
}
const pctOf = p => (p && p.c + p.w ? Math.round(100 * p.c / (p.c + p.w)) : null);
const pctCol = v => (v == null ? 'var(--q-on3)' : v >= 70 ? 'var(--q-ok)' : v >= 60 ? 'var(--q-warn)' : 'var(--q-bad)');
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'bank';
const defaultAttempt = track => (track === 'forms' ? 'active' : 'completed_qbank');
const trackNow = () => S.track || 'qbank';
const attemptNow = () => { const t = trackNow(); return ATTEMPTS[t].some(a => a[0] === S.attempt) ? S.attempt : defaultAttempt(t); };
function when(ts) {
  const d = new Date(ts); if (!ts || isNaN(d)) return '';
  const t = new Date(), day = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime(), n = Math.round((day(t) - day(d)) / 864e5);
  if (n === 0) return 'Today'; if (n === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, d.getFullYear() === t.getFullYear() ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
}
const bankById = id => (D && D.banks.find(b => b.id === id)) || null;
const badge = b => `<span class="tq-badge" style="background:${esc(b.color)}">${esc(b.code)}</span>`;
const mini = b => `<span class="tq-mini" style="background:${esc(b.color)}" title="${esc(b.name)}">${esc(b.code)}</span>`;

/* ---------- data ---------- */
async function fetchData() {
  const B = bridge(); if (!B || typeof B.qbanks !== 'function') return;
  const n = ++seq; S.stale = false;
  let d;
  try { d = await B.qbanks({ source: trackNow(), attempt: attemptNow() }); } catch (e) { console.warn('ThunderQbanks: qbanks() failed', e); S.err = String((e && e.message) || e); if (n === seq) render(); return; }
  if (n !== seq || !d) return;
  S.err = '';
  D = { banks: d.banks || [], forms: d.forms || [], rows: d.rows || [], prov: d.prov || {}, tests: d.tests || [], tagsUpdatedAt: d.tagsUpdatedAt };
  const ids = new Set(D.banks.map(b => b.id));
  S.sel = new Set([...S.sel].filter(id => ids.has(id)));
  if (!S.sel.size) S.sel = new Set(D.banks.map(b => b.id));
  const off = new Set(D.forms.map(f => f.id)); S.formsOff = new Set([...S.formsOff].filter(id => off.has(id)));
  render();
}
function markStale() { S.stale = true; clearTimeout(markStale.t); markStale.t = setTimeout(() => { if (activePanel()) fetchData(); }, 120); }

/* ---------- model (facets over the selected banks and forms) ---------- */
function baseRows() { return D ? D.rows.filter(r => S.sel.has(r.bank) && !S.formsOff.has(r.formId)) : []; }
function model() {
  const C = core(), base = baseRows();
  const f = C.facets(base, { statuses: [...S.statuses], subjects: S.subs, systems: S.syss });
  const count = Math.max(0, Math.min(S.want, f.avail));
  return Object.assign(f, { base, count });
}
function bankStats(id) {
  let n = 0, c = 0, w = 0;
  if (D) D.rows.forEach(r => { if (r.bank !== id) return; n++; if (r.status === 'correct') c++; else if (r.status === 'incorrect' || r.status === 'omitted') w++; });
  return { n, c, w, used: c + w, pct: c + w ? Math.round(100 * c / (c + w)) : null };
}
function sortKeys(keys, count, perf) {
  const k = keys.slice(), un = x => (x === UNAS ? 1 : 0);
  if (S.sort === 'count') k.sort((a, b) => un(a) - un(b) || (count[b] || 0) - (count[a] || 0) || a.localeCompare(b));
  else if (S.sort === 'weak') k.sort((a, b) => un(a) - un(b) || (pctOf(perf[a]) == null ? 101 : pctOf(perf[a])) - (pctOf(perf[b]) == null ? 101 : pctOf(perf[b])) || a.localeCompare(b));
  else k.sort((a, b) => un(a) - un(b) || a.localeCompare(b));
  return k;
}
function whyNot(m) { return !S.sel.size ? 'Select at least one bank' : !S.statuses.size ? 'Pick a question status' : !m.avail ? 'No questions match these filters' : ''; }
function autoName() { return `${[...S.sel].map(id => (bankById(id) || { name: id }).name).join(' + ') || 'Qbank'} · ${S.mode === 'tutor' ? 'Tutor' : 'Timed'} · ${new Date().toLocaleDateString()}`; }
function summary(m) {
  const b = Math.max(1, Math.ceil(m.count / Math.max(1, S.perBlock)));
  return `${plural(b, 'block')} · ${S.mode === 'tutor' ? 'Tutor' : `Timed, ${core().fmtDuration(m.count * S.secs)}`} · saved to Qbank history`;
}

/* ---------- views ---------- */
function headHtml() {
  const tabs = [['create', 'Create test', 'Create', ''], ['history', 'Previous tests', 'Tests', D ? String(D.tests.length) : ''], ['performance', 'Performance', 'Stats', ''], ['banks', 'Manage banks', 'Banks', D ? String(D.banks.length) : '']];
  return `<div><h1>Qbanks</h1><p>Build tests by subject and system from any bank. Each bank keeps its own history.</p></div>
    <div class="tq-headr"><div class="tq-tabs" role="tablist" aria-label="Qbanks views">${tabs.map(([k, l, s, n]) => `<button type="button" role="tab" aria-selected="${S.tab === k}" data-a="tab" data-v="${k}"><b class="tq-lg">${l}</b><b class="tq-sm">${s}</b>${n ? `<span>${n}</span>` : ''}</button>`).join('')}</div>
    <button type="button" class="tq-btn tq-tonal tq-imp" data-a="import">${ICON.dl}<span>Import</span></button></div>`;
}
function banksHtml() {
  if (!D) return '';
  return D.banks.map(b => {
    const s = bankStats(b.id), on = S.sel.has(b.id);
    return `<button type="button" class="tq-bank" role="checkbox" aria-checked="${on}" data-a="bank" data-v="${esc(b.id)}"><span class="tq-chk">${on ? tick : ''}</span>
      <span class="tq-top">${badge(b)}<span><b>${esc(b.name)}</b><small>${esc(b.sub || '')}</small></span></span>
      <span class="tq-meter" title="Correct / incorrect / unused"><i style="width:${100 * s.c / Math.max(1, s.n)}%;background:var(--q-ok)"></i><i style="width:${100 * s.w / Math.max(1, s.n)}%;background:var(--q-bad)"></i></span>
      <span class="tq-nums"><span><b>${fmt(s.n)}</b> Qs · ${Math.round(100 * s.used / Math.max(1, s.n))}% used</span><span>${s.pct == null ? '—' : `<b>${s.pct}%</b> correct`}</span></span>
      <small class="tq-tag">${b.kind === 'imported' ? 'Imported' : 'From Library'}</small></button>`;
  }).join('') + `<button type="button" class="tq-bank tq-add" data-a="import"><i>${ICON.plus}</i><b>Import a Qbank</b><small>JSON or ZIP with images</small></button>`;
}
function rowHtml(kind, name, count, perf, on, disabled) {
  const p = perf || { n: 1, c: 0, w: 0 }, pc = pctOf(p);
  return `<button type="button" class="tq-row" role="checkbox" aria-checked="${on}" aria-disabled="${!!disabled}" data-a="${kind}" data-v="${esc(name)}"><span class="tq-bx">${on ? tick : ''}</span>
    <span class="tq-nm"><b class="${name === UNAS ? 'tq-unas' : ''}">${esc(name)}</b><span class="tq-bar"><i style="width:${100 * p.c / Math.max(1, p.n)}%;background:var(--q-ok)"></i><i style="width:${100 * p.w / Math.max(1, p.n)}%;background:var(--q-bad)"></i></span></span>
    <span class="tq-pc" style="color:${pctCol(pc)}!important" title="Correct of answered">${pc == null ? '—' : pc + '%'}</span><span class="tq-ct ${count ? '' : 'tq-zero'}">${fmt(count || 0)}</span></button>`;
}
function createHtml(m) {
  const C = core();
  if (m.count !== S.want && S.want > 0 && m.avail && S.want > m.avail) { /* shown count is clamped; the wish is kept */ }
  const q = S.fq.trim().toLowerCase();
  const subs = m.subjects.filter(s => !q || s.toLowerCase().includes(q)), syss = m.systems.filter(s => !q || s.toLowerCase().includes(q));
  const subOn = s => !S.subs || S.subs.has(s), sysOn = s => !S.syss || S.syss.has(s);
  const allSub = m.subjects.every(subOn), allSys = m.systems.every(sysOn);
  const nSub = m.subjects.filter(subOn).length, nSys = m.systems.filter(sysOn).length;
  const unas = m.base.filter(r => r.system === UNAS).length;
  const unasBank = [...S.sel].find(id => m.base.some(r => r.bank === id && r.system === UNAS)) || '';
  // forms limit
  const forms = D.forms.filter(f => S.sel.has(f.bank)), groups = [];
  [...S.sel].forEach(id => { const b = bankById(id); if (!b) return; const tabs = new Map(); forms.filter(f => f.bank === id).forEach(f => { const t = f.tab || 'Imported files'; if (!tabs.has(t)) tabs.set(t, []); tabs.get(t).push(f); }); groups.push({ b, tabs }); });
  const offN = forms.filter(f => S.formsOff.has(f.id)).length;
  const sel = [...S.sel].map(bankById).filter(Boolean);
  const ps = C.presets(m);
  const sortSeg = `<div class="tq-sortseg" role="radiogroup" aria-label="Sort">${[['az', 'A–Z'], ['count', 'Most'], ['weak', 'Weakest']].map(([k, l]) => `<button type="button" role="radio" aria-checked="${S.sort === k}" data-a="sort" data-v="${k}">${l}</button>`).join('')}</div>`;
  const pv = {}; [...S.sel].forEach(id => { const p = D.prov[id] || {}; for (const k in p) pv[k] = (pv[k] || 0) + p[k]; });
  const provHtml = [['question', 'the question', 'var(--q-ok)'], ['form', 'the CMS form', 'var(--q-p)'], ['inferred', 'inferred from system', 'var(--q-warn)']].filter(([k]) => pv[k]).map(([k, l, c]) => `<i style="--c:${c}">${l} ${fmt(pv[k])}</i>`).join('');
  const why = whyNot(m), tr = trackNow(), openF = S.open.forms || offN, openA = S.open.adv;
  const attempts = ATTEMPTS[tr].map(([v, l]) => `<option value="${v}"${v === attemptNow() ? ' selected' : ''}>${l}</option>`).join('');
  return `<div class="tq-presets" role="group" aria-label="Quick start">${ps.map(p => `<button type="button" class="tq-preset" aria-pressed="${S.preset === p.id}" data-a="preset" data-v="${esc(p.id)}" ${p.disabled ? 'disabled' : ''}><b>${esc(p.title)}</b><span>${esc(p.detail)}</span></button>`).join('')}</div>
  <div class="tq-grid"><div class="tq-card">
    <section class="tq-sec"><div class="tq-sech"><h2><span class="tq-step">1</span>Test mode</h2></div>
      <div class="tq-seg" role="radiogroup" aria-label="Test mode">
        <button type="button" class="tq-opt" role="radio" aria-checked="${S.mode === 'tutor'}" data-a="mode" data-v="tutor"><span class="tq-ic">${ICON.tutor}</span><span><b>Tutor</b><span>Explanation after each question</span></span></button>
        <button type="button" class="tq-opt" role="radio" aria-checked="${S.mode === 'timed'}" data-a="mode" data-v="timed"><span class="tq-ic">${ICON.timer}</span><span><b>Timed</b><span>NBME-style blocks, answers at the end</span></span></button>
      </div></section>
    <section class="tq-sec"><div class="tq-sech"><h2><span class="tq-step">2</span>Question status</h2><span class="tq-note">Pick any mix</span></div>
      <div class="tq-pools" role="group" aria-label="Question status">${STATUS.map(([k, l]) => `<button type="button" class="tq-pool tq-p-${k}" role="checkbox" aria-checked="${S.statuses.has(k)}" data-a="pool" data-v="${k}"><span class="tq-bx">${S.statuses.has(k) ? tick : ''}</span>${l}<small>${fmt(m.poolCount[k])}</small></button>`).join('')}</div></section>
    <section class="tq-sec"><div class="tq-sech"><h2><span class="tq-step">3</span>Subjects <em>${nSub}/${m.subjects.length}</em></h2>
      <div class="tq-sectools"><label class="tq-find">${ICON.search}<span class="tq-sr">Filter subjects and systems</span><input type="search" placeholder="Filter" data-a="fq" value="${esc(S.fq)}"></label>${sortSeg}<button type="button" class="tq-link" data-a="allsub" data-v="${allSub ? 0 : 1}">${allSub ? 'Clear' : 'Select all'}</button></div></div>
      <div class="tq-list">${sortKeys(subs, m.subCount, m.subPerf).map(s => rowHtml('sub', s, m.subCount[s], m.subPerf[s], subOn(s))).join('') || '<span class="tq-note">No match</span>'}</div>
      ${provHtml ? `<div class="tq-prov"><span>Subject read from:</span>${provHtml}</div>` : ''}</section>
    <section class="tq-sec"><div class="tq-sech"><h2><span class="tq-step">4</span>Systems <em>${nSys}/${m.systems.length}</em></h2><button type="button" class="tq-link" data-a="allsys" data-v="${allSys ? 0 : 1}">${allSys ? 'Clear' : 'Select all'}</button></div>
      <div class="tq-list">${sortKeys(syss, m.sysCount, m.sysPerf).map(s => rowHtml('sys', s, m.sysCount[s], m.sysPerf[s], sysOn(s), !m.sysCount[s])).join('') || '<span class="tq-note">No match</span>'}</div>
      ${unas ? `<div class="tq-hint">${ICON.warn}<span><b>${fmt(unas)} questions have no system tag</b> and sit in “Unassigned”. <button type="button" class="tq-link tq-inline" data-a="retag" data-v="${esc(unasBank)}">Re-tag them</button></span></div>` : ''}</section>
    <details class="tq-more" data-k="forms"${openF ? ' open' : ''}><summary>Limit to specific forms<span>${offN ? `${forms.length - offN} of ${forms.length} forms` : `All ${forms.length} forms`} ${chev}</span></summary>
      ${groups.map(g => [...g.tabs.entries()].map(([t, fs]) => `<div class="tq-fgroup"><h3>${mini(g.b)}${esc(t === 'N-Forms' ? 'NBME forms' : t)}<button type="button" class="tq-link" data-a="ftab" data-v="${esc(g.b.id)}|${esc(t)}">toggle</button></h3>
        <div class="tq-fchips">${fs.map(f => `<button type="button" class="tq-fchip" aria-pressed="${!S.formsOff.has(f.id)}" data-a="form" data-v="${esc(f.id)}">${esc(f.name || f.id)}</button>`).join('')}</div></div>`).join('')).join('')}
    </details>
    <details class="tq-more" data-k="adv"${openA ? ' open' : ''}><summary>Advanced<span>${tr === 'qbank' ? 'Status from Qbank history' : 'Status from form attempts'} ${chev}</span></summary>
      <div class="tq-fgroup"><div class="tq-seg" role="radiogroup" aria-label="Where status comes from">
        <button type="button" class="tq-opt" role="radio" aria-checked="${tr === 'qbank'}" data-a="track" data-v="qbank"><span><b>Qbank history</b><span>Unused / incorrect from your Qbank tests in these banks</span></span></button>
        <button type="button" class="tq-opt" role="radio" aria-checked="${tr === 'forms'}" data-a="track" data-v="forms"><span><b>Form attempts</b><span>Also count answers from Library form attempts (built-in banks)</span></span></button></div>
        <label class="tq-field"><span>Attempts used</span><select class="tq-inp" data-a="attempt">${attempts}</select></label></div>
    </details>
  </div>
  <aside class="tq-sidecard"><div class="tq-card tq-sum">
    <div class="tq-big"><b id="tqBigN">${fmt(m.count)}</b><span>of ${fmt(m.avail)} available</span></div>
    <div class="tq-mixline">${sel.map(b => `<span class="tq-pill"><i style="background:${esc(b.color)}"></i>${esc(b.name)}</span>`).join('') || '<span class="tq-note">No bank selected</span>'}</div>
    <label class="tq-field"><span>Number of questions</span><input type="range" min="1" max="${Math.max(1, m.avail)}" value="${m.count}" data-a="count" ${m.avail ? '' : 'disabled'}></label>
    <div class="tq-nums2"><label class="tq-field"><span>Questions</span><input class="tq-inp" type="number" min="1" max="${m.avail}" value="${m.count}" inputmode="numeric" data-a="countn"></label>
      <label class="tq-field"><span>Per block</span><input class="tq-inp" type="number" min="1" max="80" value="${S.perBlock}" inputmode="numeric" data-a="perblock"></label></div>
    ${S.mode === 'timed' ? `<label class="tq-field"><span>Seconds per question</span><input class="tq-inp" type="number" min="15" max="600" value="${S.secs}" inputmode="numeric" data-a="secs"></label>` : ''}
    <div class="tq-sw"><div><b>Shuffle</b><span>Random pick and order</span></div><button type="button" class="tq-switch" role="switch" aria-checked="${S.shuffle}" aria-label="Shuffle" data-a="shuffle"><i></i></button></div>
    <label class="tq-field"><span>Test name</span><input class="tq-inp" type="text" placeholder="${esc(autoName())}" data-a="name" value="${esc(S.name)}" autocomplete="off"></label>
    <button type="button" class="tq-btn tq-fill tq-go" data-a="go" ${why || S.busy ? 'disabled' : ''}>${ICON.play}Generate test</button>
    <div class="tq-why" id="tqWhy">${esc(why || summary(m))}</div>
  </div></aside></div>`;
}

/* history */
let subjectTotal = { d: null, n: 0 };
function filterLine(t) {
  const f = t.filter;
  if (f && Array.isArray(f.statuses)) {
    if (subjectTotal.d !== D) { subjectTotal = { d: D, n: new Set(D.rows.map(r => r.subject)).size }; }
    const st = f.statuses.map(s => STATUS_LABEL[s] || s).join(' + ') || 'Any status';
    const sb = !f.subjects || !f.subjects.length || f.subjects.length >= subjectTotal.n ? 'all subjects' : plural(f.subjects.length, 'subject');
    const sy = !f.systems || !f.systems.length ? '' : ` · ${plural(f.systems.length, 'system')}`;
    return `${st} · ${sb}${sy}`;
  }
  const src = t.sourceMode === 'linked' ? 'Form attempts' : 'Qbank history';
  return `${POOL_LABEL[t.poolType] || t.poolType || ''} · ${src}`.replace(/^ · /, '');
}
function testsFiltered() {
  const q = S.hq.trim().toLowerCase(), names = {}; D.forms.forEach(f => { names[f.id] = f.name || f.id; });
  return D.tests.filter(t => {
    if (S.hf === 'prog' && t.done) return false; if (S.hf === 'done' && !t.done) return false;
    if (S.hf === 'tutor' && t.mode !== 'tutor') return false; if (S.hf === 'timed' && t.mode === 'tutor') return false;
    if (t.banks && t.banks.length && !t.banks.some(b => S.sel.has(b) || !bankById(b))) return false;
    if (q && !((t.name || '') + ' ' + (t.formIds || []).map(id => names[id] || id).join(' ')).toLowerCase().includes(q)) return false;
    return true;
  }).sort((a, b) => (Date.parse(b.updatedAt || b.completedAt || b.createdAt) || 0) - (Date.parse(a.updatedAt || a.completedAt || a.createdAt) || 0));
}
function historyHtml() {
  const list = testsFiltered();
  const ring = t => t.percent == null ? `<div class="tq-ring" style="--p:50;--c:var(--q-warn)" aria-label="In progress"><span>½</span></div>` : `<div class="tq-ring" style="--p:${Math.round(t.percent)};--c:${t.percent >= 70 ? 'var(--q-ok)' : t.percent >= 60 ? 'var(--q-warn)' : 'var(--q-bad)'}"><span>${Math.round(t.percent)}%</span></div>`;
  return `<div class="tq-htools"><div class="tq-chips" role="group" aria-label="Filter tests">${[['all', 'All'], ['prog', 'In progress'], ['done', 'Completed'], ['tutor', 'Tutor'], ['timed', 'Timed']].map(([k, l]) => `<button type="button" class="tq-chip" aria-pressed="${S.hf === k}" data-a="hf" data-v="${k}">${l}</button>`).join('')}</div>
    <div class="tq-sectools"><label class="tq-find">${ICON.search}<span class="tq-sr">Search tests</span><input type="search" placeholder="Search tests" data-a="hq" value="${esc(S.hq)}"></label><button type="button" class="tq-ib" data-a="trefresh" aria-label="Refresh the test list" title="Refresh">${ICON.refresh}</button></div></div>
    <div class="tq-card tq-tests" aria-label="Previous tests">${list.map(t => {
      const name = t.name || 'Qbank test', act = t.done ? 'review' : 'resume', blocks = t.blocks || 1;
      const bks = (t.banks || []).map(bankById).filter(Boolean).map(mini).join('');
      return `<div class="tq-test">${ring(t)}<div class="tq-nm"><b>${esc(name)}</b><small>${esc([when(t.completedAt || t.updatedAt || t.createdAt), plural(t.total || 0, 'Q'), plural(blocks, 'block'), filterLine(t)].filter(Boolean).join(' · '))}</small></div>
      <div class="tq-bk">${bks}</div><div class="tq-stc"><span class="tq-st ${t.done ? 'tq-done' : 'tq-prog'}">${t.done ? 'Completed' : 'In progress'}</span></div>
      <div class="tq-acts"><button type="button" class="tq-btn tq-small ${t.done ? '' : 'tq-fill'}" data-a="tact" data-act="${act}" data-v="${esc(t.id)}" aria-label="${t.done ? 'Review' : 'Resume'} ${esc(name)}">${t.done ? 'Review' : 'Resume'}</button>
        <button type="button" class="tq-ib" data-a="tact" data-act="rename" data-v="${esc(t.id)}" title="Rename" aria-label="Rename ${esc(name)}">${ICON.pencil}</button>
        <button type="button" class="tq-ib" data-a="tact" data-act="export" data-v="${esc(t.id)}" title="Export" aria-label="Export ${esc(name)}">${ICON.dl}</button>
        <button type="button" class="tq-ib tq-bad" data-a="tact" data-act="delete" data-v="${esc(t.id)}" title="Delete" aria-label="Delete ${esc(name)}">${ICON.trash}</button></div></div>`;
    }).join('') || `<div class="tq-empty">${D.tests.length ? 'No tests match this filter.' : 'No Qbank tests yet. Generated tests appear here.'}</div>`}</div>
    <p class="tq-foot">Only tests that use a selected bank show; the bank badges say where each test came from.</p>`;
}

/* performance */
function perfHtml(m) {
  const table = (title, keys, perf, kind, a) => `<div class="tq-card tq-ptabcard"><div class="tq-sech"><h2>${title}</h2></div><table class="tq-ptab"><thead><tr><th>${kind}</th><th>Correct</th><th class="tq-hide-s">Used</th><th style="width:40%"></th><th></th></tr></thead><tbody>
    ${keys.map(k => { const p = perf[k] || { n: 0, c: 0, w: 0 }, used = p.c + p.w, pct = pctOf(p);
      return `<tr data-a="pick" data-v="${a}|${esc(k)}" tabindex="0" role="button" aria-label="Practice ${esc(k)}" title="Practice ${esc(k)}"><td class="${k === UNAS ? 'tq-unas' : ''}">${esc(k)}</td><td style="color:${pctCol(pct)}!important;font-weight:600">${pct == null ? '—' : pct + '%'}</td><td class="tq-hide-s">${used}/${p.n}</td><td><div class="tq-pbar"><i style="width:${pct || 0}%;background:${pct == null ? 'transparent' : pctCol(pct)}"></i></div></td><td class="tq-go1">${ICON.play}</td></tr>`; }).join('')}</tbody></table></div>`;
  const bySys = m.systems.slice().sort((a, b) => { const pa = pctOf(m.sysPerf[a]), pb = pctOf(m.sysPerf[b]); return (pa == null ? 101 : pa) - (pb == null ? 101 : pb) || a.localeCompare(b); });
  return `<div class="tq-perf">${table('By subject', m.subjects.slice().sort((a, b) => a.localeCompare(b)), m.subPerf, 'Subject', 'sub')}${table('By system · weakest first', bySys, m.sysPerf, 'System', 'sys')}</div>
    <p class="tq-foot">Numbers come from your answers in the selected banks (${trackNow() === 'forms' ? 'form attempts' : 'Qbank tests'}). Tap a row to build a test on just that subject or system (unused + incorrect).</p>`;
}

/* manage banks: moved to Settings > Qbanks; this view is a signpost */
function manageHtml() {
  return `<div class="tq-card"><div class="tq-mrow"><span class="tq-badge tq-plusbadge">${ICON.tag}</span><div><b>Manage banks in Settings → Qbanks</b><small>Rename, re-tag, add files, export a ZIP or remove a bank. Built-in banks follow your Library.</small></div><span></span><div class="tq-acts"><button type="button" class="tq-btn tq-fill tq-small" data-a="opensettings">Open Settings</button></div></div></div>
    <p class="tq-foot">Imported banks never touch your form attempts.</p>`;
}

/* ---------- Settings > Qbanks (bank list with expandable details) ----------
   Drawn into the host thunder-ui gives us (#tuSetQbanks). Idempotent: mountSettings only paints from cached data; the banks
   come from the same qbanks() read as the tab (fetched once), details per bank from qbanksBankDetails (cached by bank id,
   dropped after import / rename / delete / re-tag). Nothing here asks Settings to repaint, so there is no refetch loop. */
const ST = { open: '', det: {}, load: {}, more: {}, exp: '' };
let setHost = null, setFetching = false;
const fmtBytes = n => (n == null ? '—' : n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(0) + ' KB' : n < 1073741824 ? (n / 1048576).toFixed(n < 10485760 ? 1 : 0) + ' MB' : (n / 1073741824).toFixed(1) + ' GB');
const hasDet = () => { const B = bridge(); return !!B && typeof B.qbanksBankDetails === 'function'; };
function invalDet(id) { if (id) { delete ST.det[id]; delete ST.load[id]; } else { ST.det = {}; ST.load = {}; } }
/* what we know without the details call (an older bridge, or while it loads) */
function basicDet(b) {
  const fs = D ? D.forms.filter(f => f.bank === b.id) : [];
  return { id: b.id, kind: b.kind, name: b.name, code: b.code, color: b.color, questions: bankStats(b.id).n, files: fs.map(f => ({ formId: f.id, source: f.name || f.id, questions: null })), images: null, bytes: null, epc: 0, importedAt: null, sources: [], basic: true };
}
async function loadDetails(id) {
  const B = bridge(); if (!hasDet() || ST.det[id] || ST.load[id]) return;
  ST.load[id] = true;
  try { ST.det[id] = await B.qbanksBankDetails(id); } catch (e) { ST.det[id] = { err: String((e && e.message) || e) }; }
  delete ST.load[id]; paintSet();
  if (D) { const nx = D.banks.find(b => !ST.det[b.id] && !ST.load[b.id]); if (nx && setHost && setHost.isConnected) loadDetails(nx.id); }
}
const detOf = b => { const d = ST.det[b.id]; return d && !d.err ? d : basicDet(b); };
function setBankHtml(b) {
  const d = detOf(b), open = ST.open === b.id, imp = b.kind === 'imported', s = bankStats(b.id);
  const nf = d.files.length, parts = [plural(s.n, 'question'), plural(nf, 'file')];
  if (d.images != null) parts.push(plural(d.images, 'image')); if (d.epc > 0) parts.push('choice % on');
  let det = '';
  if (open) {
    const un = D.rows.filter(r => r.bank === b.id && r.system === UNAS).length, raw = ST.det[b.id], more = ST.more[b.id];
    const fl = more ? d.files : d.files.slice(0, 3);
    const tile = (n, l) => `<div class="tq-tile"><b>${n}</b><span>${l}</span></div>`;
    const busy = ST.exp === b.id;
    det = `<div class="tq-sdet" id="tqDet-${esc(b.id)}">
      ${raw && raw.err ? `<div class="tq-hint" role="alert">${ICON.warn}<span>Could not read the details: ${esc(raw.err)} <button type="button" class="tq-link tq-inline" data-a="sretry" data-v="${esc(b.id)}">Retry</button></span></div>` : ''}
      <div class="tq-tiles">${tile(fmt(s.n), 'Questions')}${tile(fmt(s.used), 'Used')}${tile(un ? `<i class="tq-unas">${fmt(un)}</i>` : '0', 'Untagged')}${tile(d.basic ? '—' : fmtBytes(d.bytes), 'Storage')}</div>
      <p class="tq-smeta">${imp ? `${d.importedAt && when(d.importedAt) ? 'Imported ' + esc(new Date(d.importedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })) : 'Imported bank'}${d.sources && d.sources.length ? ' · from ' + esc(d.sources.slice(0, 3).join(', ')) + (d.sources.length > 3 ? ` and ${d.sources.length - 3} more` : '') : ''}` : 'Follows your Library: a form added to its tabs joins this bank.'}</p>
      ${fl.length ? `<div class="tq-sfl" role="list" aria-label="Files in ${esc(b.name)}">${fl.map(f => `<div role="listitem"><span>${esc(f.source || f.formId)}</span><em>${f.questions == null ? '' : fmt(f.questions)}</em></div>`).join('')}</div>${d.files.length > 3 ? `<button type="button" class="tq-link" data-a="smore" data-v="${esc(b.id)}">${more ? 'Show fewer' : `${d.files.length - 3} more`}</button>` : ''}` : ''}
      ${d.epc > 0 ? `<p class="tq-smeta"><b>Choice %</b> · ${fmt(d.epc)} of ${fmt(s.n)} questions</p>` : ''}
      <div class="tq-acts tq-sacts">${imp ? `<button type="button" class="tq-btn tq-small" data-a="import" data-into="${esc(b.id)}">${ICON.plus}Add files</button>` : ''}<button type="button" class="tq-btn tq-small" data-a="retag" data-v="${esc(b.id)}">${ICON.tag}Re-tag</button>${imp ? `<button type="button" class="tq-btn tq-small" data-a="rename" data-v="${esc(b.id)}">${ICON.pencil}Rename</button>${typeof bridge().qbanksExportBank === 'function' ? `<button type="button" class="tq-btn tq-small" data-a="sexport" data-v="${esc(b.id)}" ${busy ? 'disabled' : ''}>${ICON.dl}${busy ? 'Exporting…' : 'Export ZIP'}</button>` : ''}<button type="button" class="tq-btn tq-small tq-bad" data-a="delbank" data-v="${esc(b.id)}">${ICON.trash}Remove</button>` : ''}</div></div>`;
  }
  return `<div class="tq-sbk" data-bank="${esc(b.id)}"><button type="button" class="tq-srow" data-a="sbank" data-v="${esc(b.id)}" aria-expanded="${open}" ${open ? `aria-controls="tqDet-${esc(b.id)}"` : ''}>${badge(b)}<span class="tq-snm"><b>${esc(b.name)}</b><small>${esc(parts.join(' · '))}</small></span><span class="tq-schip">${imp ? 'Imported' : 'Built-in'}</span><span class="tq-chv">${chev}</span></button>${det}</div>`;
}
function settingsHtml() {
  const need = !!bridge() && !!core();
  const head = (sub, btn) => `<div class="tq-shd"><div><h2>Qbanks</h2><p>${sub}</p></div>${btn ? `<button type="button" class="tq-btn tq-fill" data-a="import">${ICON.plus}Import Qbank</button>` : ''}</div>`;
  if (!need) return head('Qbanks needs the form library. Open the Library once and try again.', false);
  if (!D) return head(S.err ? `Could not read your banks: ${esc(S.err)}` : 'Reading your banks…', false) + (S.err ? `<div class="tq-sbody0"><button type="button" class="tq-btn tq-small" data-a="sreload">Try again</button></div>` : '');
  const imgs = D.banks.reduce((a, b) => a + ((ST.det[b.id] && ST.det[b.id].images) || 0), 0), nq = D.rows.length;
  const sub = [plural(D.banks.length, 'bank'), plural(nq, 'question'), imgs ? plural(imgs, 'image') : ''].filter(Boolean).join(' · ');
  return head(sub, true) + D.banks.map(setBankHtml).join('');
}
function paintSet() { if (setHost && setHost.isConnected) setHtml(setHost, settingsHtml()); }
function mountSettings(host) {
  if (!host) return;
  if (!host.classList.contains('tq-scope')) host.classList.add('tq-scope', 'tq-setq');
  injectStyle();
  if (!host._tq) { host._tq = 1; host.addEventListener('click', onSetHostClick); }
  setHost = host;
  const B = bridge();
  if (B && core() && B.qbanks && !setFetching && (!D && !S.err || S.stale && D)) { setFetching = true; fetchData().then(() => { setFetching = false; paintSet(); }, () => { setFetching = false; }); }
  paintSet();
  if (D && ST.open) loadDetails(ST.open);
  if (D) { const nx = D.banks.find(b => !ST.det[b.id] && !ST.load[b.id]); if (nx && !Object.keys(ST.load).length) loadDetails(nx.id); }
}
function onSetHostClick(e) {
  const t = e.target.closest('[data-a]'); if (!t || t.disabled || !setHost.contains(t)) return; const a = t.dataset.a, v = t.dataset.v;
  if (a === 'sbank') { ST.open = ST.open === v ? '' : v; paintSet(); if (ST.open) loadDetails(v); return; }
  if (a === 'smore') { ST.more[v] = !ST.more[v]; paintSet(); return; }
  if (a === 'sretry') { invalDet(v); paintSet(); loadDetails(v); return; }
  if (a === 'sreload') { S.err = ''; S.stale = true; mountSettings(setHost); return; }
  if (a === 'sexport') { exportBank(v); return; }
  bankAct(a, v, t);
}
function saveBlob(blob, name) {
  const a = doc.createElement('a'); a.href = root.URL.createObjectURL(blob); a.download = name; doc.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => root.URL.revokeObjectURL(a.href), 4000);
}
async function exportBank(id) {
  const B = bridge(), b = bankById(id); if (!B || !b || typeof B.qbanksExportBank !== 'function' || ST.exp) return;
  ST.exp = id; paintSet();
  try { const r = await B.qbanksExportBank(id); saveBlob(r.blob, r.name || `${b.name}.zip`); toast(`Exported ${b.name}: ${plural(r.files || 0, 'question file')}, ${plural(r.images || 0, 'image')}`); }
  catch (err) { toast('Could not export: ' + ((err && err.message) || err)); }
  ST.exp = ''; paintSet();
}
function barHtml(m) {
  if (S.tab !== 'create' || !D) return '';
  const why = whyNot(m);
  return `<div class="tq-mbtxt"><b id="tqMbN">${plural(m.count, 'question')}</b><span id="tqMbWhy">${esc(why || summary(m))}</span></div><button type="button" class="tq-btn tq-fill" data-a="go" ${why || S.busy ? 'disabled' : ''}>${ICON.play}Generate</button>`;
}

/* ---------- paint ---------- */
let rootEl = null;
function render() {
  paintSet();
  if (!rootEl || !rootEl.isConnected) return;
  const need = !!bridge() && !!core();
  setHtml(rootEl.querySelector('[data-r="head"]'), headHtml());
  let banks = '', view = '', bar = '';
  if (!need) view = '<div class="tq-empty">Qbanks needs the form library. Open the Library once and try again.</div>';
  else if (!D) view = S.err ? `<div class="tq-empty">Could not read your banks: ${esc(S.err)}</div>` : '<div class="tq-empty">Reading your banks…</div>';
  else {
    const m = S.tab === 'history' || S.tab === 'banks' ? null : model();
    if (S.tab !== 'banks') banks = banksHtml();
    view = S.tab === 'create' ? createHtml(m) : S.tab === 'history' ? historyHtml() : S.tab === 'performance' ? perfHtml(m) : manageHtml();
    bar = barHtml(m || { count: 0, avail: 0 });
    if (S.tab === 'create') bar = barHtml(m);
  }
  const bEl = rootEl.querySelector('[data-r="banks"]'); bEl.hidden = !banks;
  setHtml(bEl, banks); setHtml(rootEl.querySelector('[data-r="view"]'), view);
  const barEl = rootEl.querySelector('[data-r="bar"]'); barEl.hidden = !bar; setHtml(barEl, bar);
}

/* ---------- sheets: import wizard, Re-tag, rename ---------- */
let layer = null, SH = null, lastFocus = null;
const IMP = { step: 1, file: null, label: '', pv: null, bad: [], more: false, map: { system: '', subject: '', topic: '' }, norm: true, name: '', code: '', color: COLORS[0], err: '', into: '', busy: false };
function ensureLayer() {
  if (layer && layer.isConnected) return layer;
  layer = doc.createElement('div'); layer.className = 'tq-scope tq-scrim'; layer.id = 'tuQbanksSheet'; layer.hidden = true;
  layer.innerHTML = '<div class="tq-sheet" role="dialog" aria-modal="true" aria-labelledby="tqSheetTitle" tabindex="-1"></div>';
  (byId('menu') || doc.body).appendChild(layer);
  layer.addEventListener('click', onSheetClick);
  layer.addEventListener('change', onSheetChange);
  layer.addEventListener('input', onSheetInput);
  layer.addEventListener('keydown', onSheetKey);
  layer.addEventListener('dragover', e => { const dz = e.target.closest && e.target.closest('.tq-drop'); if (dz) { e.preventDefault(); dz.classList.add('tq-over'); } });
  layer.addEventListener('dragleave', e => { const dz = e.target.closest && e.target.closest('.tq-drop'); if (dz) dz.classList.remove('tq-over'); });
  layer.addEventListener('drop', e => { const dz = e.target.closest && e.target.closest('.tq-drop'); if (dz) { e.preventDefault(); dz.classList.remove('tq-over'); const f = e.dataTransfer && e.dataTransfer.files[0]; if (f) readImportFile(f); } });
  return layer;
}
function openSheet(kind, extra) {
  lastFocus = doc.activeElement; SH = Object.assign({ kind }, extra || {});
  ensureLayer().hidden = false; paintSheet();
  const sh = layer.querySelector('.tq-sheet'); const f = sh.querySelector('input:not([type=file]),select,button:not(:disabled)'); (f || sh).focus({ preventScroll: true });
}
function closeSheet() {
  if (!layer || layer.hidden) return; layer.hidden = true; SH = null;
  const sh = layer.querySelector('.tq-sheet'); sh._h = ''; sh.innerHTML = '';
  if (lastFocus && lastFocus.isConnected) try { lastFocus.focus({ preventScroll: true }); } catch (e) {}
  render();
}
function onSheetKey(e) {
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeSheet(); return; }
  if (e.key !== 'Tab') return;
  const f = Array.from(layer.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled)')).filter(b => b.offsetParent !== null || b.type === 'file' && false);
  if (!f.length) return;
  if (e.shiftKey && doc.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
  else if (!e.shiftKey && doc.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
}
function paintSheet() {
  if (!SH) return; const sh = layer.querySelector('.tq-sheet');
  const html = SH.kind === 'import' ? importHtml() : SH.kind === 'retag' ? retagHtml() : renameHtml();
  setHtml(sh, html);
}
const sheetHead = (title, sub, steps) => `<div class="tq-shead"><div><h2 id="tqSheetTitle">${title}</h2><p>${sub}</p></div><button type="button" class="tq-ib" data-a="close" aria-label="Close">${ICON.x}</button></div>${steps ? `<div class="tq-steps">${[1, 2, 3].map(i => `<i class="${i <= steps ? 'tq-on' : ''}"></i>`).join('')}</div>` : ''}`;

/* import */
function valsFor(k, sys) {
  const pv = IMP.pv, raw = pv && pv.values && pv.values[k]; if (!k || !raw) return null;
  const m = new Map(); let seen = 0;
  raw.forEach(([v, n]) => { seen += n; const x = sys && IMP.norm ? core().normSystem(v) : String(v); m.set(x, (m.get(x) || 0) + n); });
  const rest = (pv.questions || 0) - seen, f = (pv.fields || []).find(x => x.k === k);
  if (rest > 0) { const lbl = f && f.distinct > raw.length ? 'Other values' : UNAS; m.set(lbl, (m.get(lbl) || 0) + rest); }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
async function readImportFile(f) {
  const B = bridge(); if (!B || !B.qbanksImportPreview) return;
  IMP.file = f; IMP.label = f.name; IMP.err = ''; IMP.bad = []; IMP.pv = null; IMP.more = false; IMP.busy = true; paintSheet();
  try {
    const r = await B.qbanksImportPreview(f, IMP.into ? { into: IMP.into } : undefined);
    if (!r || !r.ok) { IMP.bad = ((r && r.files) || []).filter(x => x.error); throw new Error((r && r.error) || 'No questions found (expected an array, {questions:[…]} or {blocks:[…]}).'); }
    IMP.pv = r; IMP.label = r.file || f.name;
    const g = r.guess || {}; IMP.map = { system: g.system || '', subject: g.subject || '', topic: g.topic || '' };
    const mf = r.manifest || null; IMP.norm = !(mf && mf.tagMap && mf.tagMap.normalize === false);
    const tgt = bankById(IMP.into);
    IMP.name = tgt ? tgt.name : String((mf && mf.name) || r.title || f.name.replace(/\.(json|zip)$/i, '')).slice(0, 40);
    IMP.code = tgt ? tgt.code : String((mf && mf.code) || IMP.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 3)).toUpperCase().slice(0, 3) || 'QB';
    IMP.color = tgt ? tgt.color : (mf && /^#[0-9a-f]{6}$/i.test(mf.color || '') ? mf.color : COLORS[0]);
    IMP.step = 1;
  } catch (e) { IMP.err = 'Could not read this file: ' + ((e && e.message) || e); }
  IMP.busy = false; paintSheet();
}
/* step 1 summary of what the file holds (ZIP v2: manifest, question files, assets, problems) */
function fileSummaryHtml() {
  const pv = IMP.pv, fl = pv.files || [], nf = fl.length, zip = /\.zip/i.test(IMP.label) || nf > 1, mf = pv.manifest;
  const bits = [esc(IMP.label)]; if (zip && nf) bits.push(plural(nf, 'question file')); bits.push(plural(pv.questions || 0, 'question')); if (pv.images) bits.push(plural(pv.images, 'image'));
  const shown = IMP.more ? fl : fl.slice(0, 3);
  return `<div class="tq-okline" id="tqPvOk">${tick}<span>${bits.join(' · ')}</span></div>
    ${mf ? `<div class="tq-pvrow" id="tqPvManifest"><b>qbank.json</b><span>${[mf.name ? esc(mf.name) : '', mf.code || mf.color ? `${mf.code ? 'badge ' + esc(mf.code) : ''}${mf.color ? ` <i class="tq-dot" style="background:${esc(mf.color)}"></i>` : ''}` : '', mf.tagMap && (mf.tagMap.system || mf.tagMap.subject) ? 'tags: ' + esc([mf.tagMap.system && 'system=' + mf.tagMap.system, mf.tagMap.subject && 'subject=' + mf.tagMap.subject].filter(Boolean).join(', ')) : ''].filter(Boolean).join(' · ')}</span></div>` : ''}
    ${nf > 1 ? `<div class="tq-pvfiles" id="tqPvFiles">${shown.map(x => `<div><span>${esc(x.path)}</span><em>${fmt(x.questions)}</em></div>`).join('')}${nf > 3 ? `<button type="button" class="tq-link" data-a="pvmore">${IMP.more ? 'Show fewer' : `${nf - 3} more`}</button>` : ''}</div>` : ''}
    ${pv.images ? `<div class="tq-pvrow"><b>assets/</b><span>${plural(pv.images, 'image')}</span></div>` : ''}
    ${pv.missingImages > 0 ? `<div class="tq-hint" id="tqPvMissing">${ICON.warn}<span><b>${plural(pv.missingImages, 'image')} not found in the ZIP.</b> Those questions import without them.</span></div>` : ''}`;
}
function importHtml() {
  const tgt = D && D.banks.find(b => b.id === IMP.into && b.kind === 'imported');
  const sub = ['Choose a file', 'Check subjects and systems', tgt ? 'Confirm' : 'Name your bank'][IMP.step - 1];
  const head = sheetHead(tgt ? 'Add questions to ' + esc(tgt.name) : 'Import a Qbank', sub, IMP.step);
  let body = '', foot = '';
  if (IMP.step === 1) {
    const has = !!IMP.pv;
    body = (has ? fileSummaryHtml() : '') + `<label class="tq-drop${has ? ' tq-compact' : ''}" id="tqDrop"><span class="tq-dropic">${ICON.file}</span><b>${IMP.busy ? 'Reading ' + esc(IMP.label) + '…' : has ? 'Choose a different file' : 'Drop a JSON or ZIP here'}</b><span>${has ? 'or drop it here' : 'or click to choose · same question format as your forms'}</span><input type="file" accept=".json,.zip,application/json,application/zip" class="tq-sr" data-a="file"></label>
      ${IMP.err ? `<div class="tq-hint" role="alert">${ICON.warn}<span>${esc(IMP.err)}${IMP.bad.length ? `<span class="tq-badfiles">${IMP.bad.slice(0, 5).map(x => `<span>${esc(x.path)}: ${esc(x.error)}</span>`).join('')}${IMP.bad.length > 5 ? `<span>and ${IMP.bad.length - 5} more</span>` : ''}</span>` : ''}</span></div>` : ''}
      ${has ? '' : `<div class="tq-fmts"><div class="tq-fmt"><b>JSON</b>Array of questions, {questions:[…]} or {blocks:[…]}</div><div class="tq-fmt"><b>ZIP</b>Question JSON files in any folders + one assets/ folder, optional qbank.json</div><div class="tq-fmt"><b>Tags</b>Any field works: subject, system, topic. You map them next</div></div>`}`;
    foot = has ? `<button type="button" class="tq-btn" data-a="close">Cancel</button><button type="button" class="tq-btn tq-fill" data-a="go2" ${IMP.busy ? 'disabled' : ''}>Continue</button>` : `<span class="tq-note">Nothing is saved until the last step.</span><button type="button" class="tq-btn" data-a="close">Cancel</button>`;
  } else if (IMP.step === 2) {
    const pv = IMP.pv, opts = sel => `<option value="">— none —</option>` + pv.fields.map(f => `<option value="${esc(f.k)}"${f.k === sel ? ' selected' : ''}>${esc(f.k)} (${f.distinct} values)</option>`).join('');
    const fdist = k => { const f = pv.fields.find(x => x.k === k); return f ? f.distinct : 0; };
    const sysV = valsFor(IMP.map.system, true), subV = valsFor(IMP.map.subject, false), un = sysV ? (sysV.find(([v]) => v === UNAS) || [0, 0])[1] : 0;
    const vals = v => v ? `<div class="tq-vals" tabindex="0" aria-label="Values found">${v.map(([x, n]) => `<div><span class="${x === UNAS ? 'tq-unas' : ''}">${esc(x)}</span><em>${n}</em></div>`).join('')}</div>` : '';
    body = `<div class="tq-map"><div class="tq-mapc"><h4>System <span class="tq-note">${sysV ? plural(sysV.length, 'group') : (IMP.map.system ? plural(fdist(IMP.map.system), 'value') : '')}</span></h4><select class="tq-inp" data-a="map" data-f="system" aria-label="Field to read systems from">${opts(IMP.map.system)}</select>
        <label class="tq-chk2"><input type="checkbox" data-a="norm" ${IMP.norm ? 'checked' : ''}> Map to the standard system list</label>${vals(sysV)}</div>
      <div class="tq-mapc"><h4>Subject <span class="tq-note">${subV ? plural(subV.length, 'group') : (IMP.map.subject ? plural(fdist(IMP.map.subject), 'value') : '')}</span></h4><select class="tq-inp" data-a="map" data-f="subject" aria-label="Field to read subjects from">${opts(IMP.map.subject)}</select>${vals(subV)}</div></div>
      <label class="tq-field"><span>Topic (optional, used for search and Re-tag suggestions)</span><select class="tq-inp" data-a="map" data-f="topic">${opts(IMP.map.topic)}</select></label>
      ${un ? `<div class="tq-hint">${ICON.warn}<span><b>${fmt(un)} questions have no system.</b> They import as “Unassigned”; you can re-tag later.</span></div>` : ''}`;
    foot = `<button type="button" class="tq-btn" data-a="back">Back</button><button type="button" class="tq-btn tq-fill" data-a="next">Continue</button>`;
  } else if (tgt) {
    const n = bankStats(tgt.id).n;
    body = `<div class="tq-mrow tq-bordered">${badge(tgt)}<div><b>${esc(tgt.name)}</b><small>${fmt(n)} questions now</small></div><span></span><span></span></div>
      <div class="tq-okline tq-gap">${tick} ${plural(IMP.pv.questions || 0, 'question')} will be checked and added</div>
      <div class="tq-hint">${ICON.warn}<span>Questions already in this bank (same question id) are skipped, so your history on them stays.</span></div>
      ${IMP.err ? `<div class="tq-hint" role="alert">${ICON.warn}<span>${esc(IMP.err)}</span></div>` : ''}`;
    foot = `<button type="button" class="tq-btn" data-a="back" ${IMP.busy ? 'disabled' : ''}>Back</button><button type="button" class="tq-btn tq-fill" data-a="finish" ${IMP.busy ? 'disabled' : ''}>${ICON.plus}${IMP.busy ? 'Adding…' : 'Add questions'}</button>`;
  } else {
    body = `<label class="tq-field"><span>Bank name</span><input class="tq-inp" data-a="impname" value="${esc(IMP.name)}" maxlength="40"></label>
      <div class="tq-nums2"><label class="tq-field"><span>Badge (max 3 letters)</span><input class="tq-inp" data-a="impcode" value="${esc(IMP.code)}" maxlength="3"></label>
      <div class="tq-field"><span>Colour</span><div class="tq-swatches" role="radiogroup" aria-label="Colour">${COLORS.concat(COLORS.includes(IMP.color) ? [] : [IMP.color]).map(c => `<button type="button" class="tq-swatch" role="radio" aria-checked="${IMP.color === c}" data-a="color" data-v="${c}" style="background:${c}" aria-label="Colour ${c}"></button>`).join('')}</div></div></div>
      <p class="tq-foot tq-gap">Imported questions are stored with your forms (hidden from the Library), so they are backed up and synced the same way.</p>
      ${IMP.err ? `<div class="tq-hint" role="alert">${ICON.warn}<span>${esc(IMP.err)}</span></div>` : ''}`;
    foot = `<button type="button" class="tq-btn" data-a="back" ${IMP.busy ? 'disabled' : ''}>Back</button><button type="button" class="tq-btn tq-fill" data-a="finish" ${IMP.busy || !IMP.name.trim() ? 'disabled' : ''}>${ICON.dl}${IMP.busy ? 'Importing…' : `Import ${plural(IMP.pv.questions || 0, 'question')}`}</button>`;
  }
  return head + `<div class="tq-sbody">${body}</div><div class="tq-sfoot">${foot}</div>`;
}
async function finishImport() {
  const B = bridge(); if (!B || !B.qbanksImport || IMP.busy) return;
  IMP.busy = true; IMP.err = ''; paintSheet();
  const tgt = D && D.banks.find(b => b.id === IMP.into && b.kind === 'imported');
  try {
    const res = await B.qbanksImport({ file: IMP.file, map: { system: IMP.map.system || '', subject: IMP.map.subject || '', topic: IMP.map.topic || '' }, normalize: !!IMP.norm, into: tgt ? tgt.id : undefined,
      name: (IMP.name || '').trim(), code: (IMP.code || '').trim().toUpperCase().slice(0, 3), color: IMP.color });
    IMP.busy = false;
    invalDet(); await fetchData();
    const id = (res && res.bankId) || (tgt && tgt.id);
    if (id && D && D.banks.some(b => b.id === id)) { S.sel = new Set([id]); S.subs = null; S.syss = null; S.formsOff = new Set(); S.want = 40; savePrefs(); }
    S.tab = 'create'; closeSheet(); render();
    toast(`${tgt ? 'Added to' : 'Imported'} ${(bankById(id) || { name: 'bank' }).name}: ${plural((res && res.added) || 0, 'question')}${res && res.files > 1 ? ` from ${fmt(res.files)} files` : ''}${res && res.images ? `, ${plural(res.images, 'image')}` : ''}${res && res.skipped ? `, ${fmt(res.skipped)} skipped` : ''}`);
  } catch (e) { IMP.busy = false; IMP.err = 'Import failed: ' + ((e && e.message) || e); paintSheet(); }
}

/* Re-tag */
function retagHtml() {
  const b = bankById(SH.bank); if (!b) return sheetHead('Re-tag', '', 0) + '<div class="tq-sbody"><div class="tq-empty">This bank is gone.</div></div>';
  const un = D.rows.filter(r => r.bank === b.id && r.system === UNAS), sug = un.filter(r => r.sug);
  const names = {}; D.forms.forEach(f => { names[f.id] = f.name || f.id; });
  const perForm = {}; un.forEach(r => { const p = perForm[r.formId] || (perForm[r.formId] = { n: 0, s: 0 }); p.n++; if (r.sug) p.s++; });
  const bySys = {}; sug.forEach(r => { bySys[r.sug] = (bySys[r.sug] || 0) + 1; });
  const body = !un.length ? `<div class="tq-okline">${tick} Every question in ${esc(b.name)} has a system.</div>` :
    `<div class="tq-rtforms">${Object.entries(perForm).map(([f, p]) => `<div><b>${esc(names[f] || f)}</b><span>${fmt(p.n)} untagged · ${p.s ? fmt(p.s) + ' with a suggestion' : 'no topic to read'}</span></div>`).join('')}</div>
    <div class="tq-mapc tq-gap"><h4>Suggest from each question's topic <span class="tq-note">${fmt(sug.length)} of ${fmt(un.length)}</span></h4>
      ${sug.length ? `<div class="tq-vals">${Object.entries(bySys).sort((a, c) => c[1] - a[1]).map(([s, n]) => `<div><span>${esc(s)}</span><em>${n}</em></div>`).join('')}</div>
      <button type="button" class="tq-btn tq-fill tq-small tq-gap" data-a="accept" ${SH.busy ? 'disabled' : ''}>${tick} ${SH.busy ? 'Saving…' : `Accept ${fmt(sug.length)} suggestions`}</button>` : '<p class="tq-note">None of these questions has a topic the app can read.</p>'}</div>`;
  const sw = `<div class="tq-sw tq-bordered"><div><b>Tag while you review</b><span>After you answer an untagged question in a Qbank test, a row of system chips appears under the explanation; one tap files it.</span></div><button type="button" class="tq-switch" role="switch" aria-checked="${S.reviewTag}" aria-label="Tag while you review" data-a="rtsw"><i></i></button></div>`;
  return sheetHead('Re-tag ' + esc(b.name), un.length ? `${fmt(un.length)} questions have no system` : 'Nothing left to tag', 0) +
    `<div class="tq-sbody">${body}${sw}<p class="tq-foot">Tags are saved by question id${b.kind !== 'imported' ? '; your form files are never changed, so form progress stays matched' : ''}.</p></div><div class="tq-sfoot"><span></span><button type="button" class="tq-btn" data-a="close">Done</button></div>`;
}
/* rename / recolour an imported bank */
function renameHtml() {
  return sheetHead('Rename bank', 'Name, badge and colour', 0) + `<div class="tq-sbody"><label class="tq-field"><span>Bank name</span><input class="tq-inp" data-a="rnname" value="${esc(SH.name)}" maxlength="40"></label>
    <div class="tq-nums2"><label class="tq-field"><span>Badge (max 3 letters)</span><input class="tq-inp" data-a="rncode" value="${esc(SH.code)}" maxlength="3"></label>
    <div class="tq-field"><span>Colour</span><div class="tq-swatches" role="radiogroup" aria-label="Colour">${COLORS.concat(COLORS.includes(SH.color) ? [] : [SH.color]).map(c => `<button type="button" class="tq-swatch" role="radio" aria-checked="${SH.color === c}" data-a="rncolor" data-v="${c}" style="background:${c}" aria-label="Colour ${c}"></button>`).join('')}</div></div></div>
    ${SH.err ? `<div class="tq-hint" role="alert">${ICON.warn}<span>${esc(SH.err)}</span></div>` : ''}</div>
    <div class="tq-sfoot"><button type="button" class="tq-btn" data-a="close">Cancel</button><button type="button" class="tq-btn tq-fill" data-a="rnsave" ${SH.busy || !SH.name.trim() ? 'disabled' : ''}>Save</button></div>`;
}
async function onSheetClick(e) {
  if (e.target === layer) { closeSheet(); return; }
  const t = e.target.closest('button'); if (!t || t.disabled) return; const a = t.dataset.a, B = bridge();
  if (a === 'close') closeSheet();
  else if (a === 'back') { if (IMP.step > 1) { IMP.step--; IMP.err = ''; paintSheet(); } }
  else if (a === 'go2') { if (IMP.pv) { IMP.step = 2; paintSheet(); } }
  else if (a === 'pvmore') { IMP.more = !IMP.more; paintSheet(); }
  else if (a === 'next') { IMP.step = 3; paintSheet(); }
  else if (a === 'color') { IMP.color = t.dataset.v; paintSheet(); }
  else if (a === 'finish') finishImport();
  else if (a === 'rtsw') { S.reviewTag = !S.reviewTag; savePrefs(); paintSheet(); examTick(); }
  else if (a === 'accept') {
    if (!B || !B.qbanksAcceptSuggestions || SH.busy) return; SH.busy = true; paintSheet();
    try { const r = await B.qbanksAcceptSuggestions(SH.bank); SH.busy = false; S.subs = null; S.syss = null; invalDet(SH.bank); await fetchData(); paintSheet(); toast(`${fmt((r && r.tagged) || 0)} questions tagged`); }
    catch (err) { SH.busy = false; paintSheet(); toast('Could not save the tags: ' + ((err && err.message) || err)); }
  }
  else if (a === 'rncolor') { SH.color = t.dataset.v; paintSheet(); }
  else if (a === 'rnsave') {
    if (!B || !B.qbanksUpdateBank) return; SH.busy = true; SH.err = ''; paintSheet();
    try { await B.qbanksUpdateBank(SH.id, { name: SH.name.trim(), code: SH.code.trim().toUpperCase().slice(0, 3), color: SH.color }); SH.busy = false; invalDet(SH.id); await fetchData(); closeSheet(); toast('Bank updated'); }
    catch (err) { SH.busy = false; SH.err = 'Could not save: ' + ((err && err.message) || err); paintSheet(); }
  }
}
function onSheetChange(e) {
  const t = e.target, a = t.dataset.a;
  if (a === 'file') { const f = t.files && t.files[0]; if (f) readImportFile(f); }
  else if (a === 'map') { IMP.map[t.dataset.f] = t.value; paintSheet(); }
  else if (a === 'norm') { IMP.norm = t.checked; paintSheet(); }
}
function onSheetInput(e) {
  const t = e.target, a = t.dataset.a;
  if (a === 'impname') { IMP.name = t.value; const b = layer.querySelector('[data-a="finish"]'); if (b) b.disabled = IMP.busy || !IMP.name.trim(); }
  else if (a === 'impcode') IMP.code = t.value;
  else if (a === 'rnname') { SH.name = t.value; const b = layer.querySelector('[data-a="rnsave"]'); if (b) b.disabled = SH.busy || !SH.name.trim(); }
  else if (a === 'rncode') SH.code = t.value;
}
function openImport(into) {
  Object.assign(IMP, { step: 1, file: null, label: '', pv: null, bad: [], more: false, map: { system: '', subject: '', topic: '' }, err: '', name: '', code: '', into: into || '', busy: false });
  if (!bridge() || !bridge().qbanksImportPreview) { toast('Import is not available in this build'); return; }
  openSheet('import');
}

/* ---------- toast + confirm ---------- */
let toastEl = null;
function toast(msg) {
  if (!toastEl || !toastEl.isConnected) { toastEl = doc.createElement('div'); toastEl.className = 'tq-scope tq-toast'; toastEl.setAttribute('role', 'status'); toastEl.setAttribute('aria-live', 'polite'); (byId('menu') || doc.body).appendChild(toastEl); }
  toastEl.textContent = msg; toastEl.style.display = 'block'; clearTimeout(toast.t); toast.t = setTimeout(() => { toastEl.style.display = 'none'; }, 3200);
}
const askOk = (text, title, okText) => (typeof root.appConfirm === 'function' ? root.appConfirm(text, { title, okText, danger: true }) : Promise.resolve(root.confirm(text)));

/* ---------- legacy bridge (inputs and buttons of the hidden Qbank panels) ---------- */
const legacyVal = id => { const el = byId(id); return el ? (el.type === 'checkbox' ? el.checked : el.value) : null; };
function setLegacy(id, value) {
  const el = byId(id); if (!el) return false;
  if (el.type === 'checkbox') { if (el.checked === !!value) return false; el.checked = !!value; }
  else { if (String(el.value) === String(value)) return false; el.value = String(value); }
  el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}
function setLegacyForms(ids) {
  const want = new Set(ids), inputs = Array.from(doc.querySelectorAll('#qbankFormList input[data-qbank-form]')); let last = null;
  inputs.forEach(i => { const on = want.has(i.dataset.qbankForm); if (i.checked !== on) { i.checked = on; last = i; } });
  (last || inputs[inputs.length - 1]) && (last || inputs[inputs.length - 1]).dispatchEvent(new Event('change', { bubbles: true }));
  return inputs.length;
}
function testLegacy(id, act) {
  const card = doc.querySelector(`#qbankTestsGrid [data-qb-id="${root.CSS.escape(id)}"]`), b = card && card.querySelector(`[data-v9="qbank-${act}"]`);
  if (!b) { console.warn('ThunderQbanks: legacy Qbank control missing', id, act); toast('That test is not ready yet. Try Refresh.'); return false; }
  b.click(); return true;
}
async function start() {
  const B = bridge(), C = core(); if (!B || !C || S.busy) return;
  const m = model(); if (whyNot(m)) return;
  S.busy = true; render();
  try {
    const formIds = D.forms.filter(f => S.sel.has(f.bank) && !S.formsOff.has(f.id)).map(f => f.id);
    const sel = { statuses: [...S.statuses], subjects: S.subs ? [...S.subs] : m.subjects.slice(), systems: S.syss ? [...S.syss] : m.systems.slice(), source: trackNow(), attempt: attemptNow(), secondsPerQuestion: S.mode === 'timed' ? S.secs : null };
    setLegacy('qbankRunMode', S.mode === 'tutor' ? 'tutor' : 'testing');
    setLegacy('qbankSourceMode', trackNow() === 'forms' ? 'linked' : 'qbank');
    setLegacy('qbankAttemptSource', attemptNow());
    setLegacy('qbankBlockSize', Math.max(1, S.perBlock));
    setLegacy('qbankShuffle', S.shuffle);
    setLegacy('qbankTestName', S.name.trim() || autoName());
    B.qbanksSetFilter(sel);
    setLegacyForms(formIds);
    let avail = m.avail; try { if (typeof B.qbanksAvailable === 'function') avail = Number(await B.qbanksAvailable()) || 0; } catch (e) {}
    const n = Math.max(1, Math.min(m.count || S.want, avail));
    setLegacy('qbankQuestionCount', n);
    const btn = doc.querySelector('#qbankModePanel [data-v9="qbank-start"]');
    if (!btn) { toast('The Qbank start control is missing'); }
    else { S.stale = true; btn.click(); }
  } catch (e) { console.warn('ThunderQbanks: start failed', e); toast('Could not start: ' + ((e && e.message) || e)); }
  S.busy = false; render();
}

/* ---------- events ---------- */
function resetFacets() { S.subs = null; S.syss = null; S.preset = ''; }
function applyPreset(p) {
  const a = p.apply || {};
  S.statuses = new Set(a.statuses || []); S.subs = a.subjects ? new Set(a.subjects) : null; S.syss = a.systems ? new Set(a.systems) : null;
  if (a.mode) S.mode = a.mode === 'timed' ? 'timed' : 'tutor'; if (a.secs) S.secs = a.secs; if (a.count) S.want = a.count; if (a.perBlock) S.perBlock = a.perBlock;
  S.preset = p.id; savePrefs();
}
function toggleIn(setName, all, v) { const cur = S[setName] ? new Set(S[setName]) : new Set(all); cur.has(v) ? cur.delete(v) : cur.add(v); S[setName] = cur; }
function pick(v) {
  const i = v.indexOf('|'), kind = v.slice(0, i), name = v.slice(i + 1);
  S.subs = kind === 'sub' ? new Set([name]) : null; S.syss = kind === 'sys' ? new Set([name]) : null;
  S.statuses = new Set(['unused', 'incorrect']); S.preset = ''; S.want = 40; S.tab = 'create'; savePrefs(); render(); root.scrollTo && root.scrollTo(0, 0); toast(`Test on ${name}: unused + incorrect`);
}
function goTab(k) {
  const tests = byId('qbankTestsPanel');
  if (k === 'history') { const b = byId('qbankTestsTab'); if (b) { S.prevTab = S.tab === 'history' ? S.prevTab : S.tab; b.click(); return; } }
  S.tab = k; S.prevTab = k;
  if (tests && tests.classList.contains('active')) { const b = byId('qbankTab'); if (b) { b.click(); return; } }
  render();
}
async function bankAct(a, v, t) {
  if (a === 'import') { openImport(t.dataset.into || ''); return; }
  if (a === 'retag') { if (v) openSheet('retag', { bank: v }); return; }
  if (a === 'rename') { const b = bankById(v); if (b) openSheet('rename', { id: b.id, name: b.name, code: b.code, color: b.color }); return; }
  if (a === 'delbank') {
    const b = bankById(v), B = bridge(); if (!b || !B || !B.qbanksDeleteBank) return;
    if (!await askOk(`Delete “${b.name}” and its ${plural(bankStats(b.id).n, 'question')}?\n\nA recovery ZIP is saved first. Your Qbank tests stay in history.`, 'Delete bank', 'Delete')) return;
    try { await B.qbanksDeleteBank(b.id); S.sel.delete(b.id); if (ST.open === b.id) ST.open = ''; invalDet(); resetFacets(); savePrefs(); await fetchData(); toast(`Deleted ${b.name}`); } catch (err) { toast('Could not delete: ' + ((err && err.message) || err)); }
  }
}
async function onClick(e) {
  const t = e.target.closest('[data-a]'); if (!t || t.disabled || !rootEl.contains(t)) return; const a = t.dataset.a, v = t.dataset.v;
  if (t.tagName === 'INPUT' || t.tagName === 'SELECT') return;
  const m = () => model();
  switch (a) {
    case 'tab': goTab(v); return;
    case 'import': bankAct(a, v, t); return;
    case 'preset': { const p = core().presets(m()).find(x => x.id === v); if (p && !p.disabled) { applyPreset(p); render(); toast(`${p.title}: filters set below. Change anything before you start`); } return; }
    case 'sort': S.sort = v; savePrefs(); render(); return;
    case 'bank': S.sel.has(v) ? S.sel.delete(v) : S.sel.add(v); resetFacets(); savePrefs(); render(); return;
    case 'mode': S.mode = v; S.preset = ''; savePrefs(); render(); return;
    case 'track': if (S.track !== v) { S.track = v; S.attempt = ''; S.preset = ''; savePrefs(); markStale(); render(); } return;
    case 'pool': S.statuses.has(v) ? S.statuses.delete(v) : S.statuses.add(v); S.preset = ''; savePrefs(); render(); return;
    case 'sub': { S.preset = ''; toggleIn('subs', m().subjects, v); render(); return; }
    case 'sys': if (t.getAttribute('aria-disabled') === 'true') return; S.preset = ''; toggleIn('syss', m().systems, v); render(); return;
    case 'allsub': S.preset = ''; S.subs = v === '1' ? null : new Set(); render(); return;
    case 'allsys': S.preset = ''; S.syss = v === '1' ? null : new Set(); render(); return;
    case 'form': S.formsOff.has(v) ? S.formsOff.delete(v) : S.formsOff.add(v); S.open.forms = true; render(); return;
    case 'ftab': { const [b, tab] = v.split('|'), ids = D.forms.filter(f => f.bank === b && (f.tab || 'Imported files') === tab).map(f => f.id), allOn = ids.every(id => !S.formsOff.has(id)); ids.forEach(id => (allOn ? S.formsOff.add(id) : S.formsOff.delete(id))); S.open.forms = true; render(); return; }
    case 'shuffle': S.shuffle = !S.shuffle; render(); return;
    case 'hf': S.hf = v; render(); return;
    case 'trefresh': { const b = doc.querySelector('#qbankTestsPanel [data-v9="qtests-refresh"]'); if (b) b.click(); markStale(); return; }
    case 'tact': {
      const act = t.dataset.act;
      if (act === 'delete' || act === 'rename' || act === 'export' || act === 'resume' || act === 'review') { if (testLegacy(v, act)) markStale(); }
      return;
    }
    case 'go': start(); return;
    case 'opensettings': { const T = root.ThunderUI; S.tab = 'create'; S.prevTab = 'create'; if (T && T.openSettings && T.openSettings('qbank')) return; render(); toast('Settings is not available in this build'); return; }
    case 'retag': case 'rename': case 'delbank': bankAct(a, v, t); return;
    case 'pick': pick(v); return;
    default:
  }
}
function setCountUi(m) {
  const n = rootEl.querySelector('#tqBigN'); if (n) n.textContent = fmt(m.count);
  const r = rootEl.querySelector('input[data-a="count"]'), c = rootEl.querySelector('input[data-a="countn"]');
  if (r && doc.activeElement !== r) r.value = m.count; if (c && doc.activeElement !== c) c.value = m.count;
  const w = rootEl.querySelector('#tqWhy'); if (w) w.textContent = whyNot(m) || summary(m);
  const mb = rootEl.querySelector('#tqMbN'); if (mb) mb.textContent = plural(m.count, 'question');
  const mw = rootEl.querySelector('#tqMbWhy'); if (mw) mw.textContent = whyNot(m) || summary(m);
}
function onInput(e) {
  const t = e.target, a = t.dataset && t.dataset.a; if (!a) return;
  if (a === 'fq') { S.fq = t.value; render(); return; }
  if (a === 'hq') { S.hq = t.value; render(); return; }
  if (a === 'name') { S.name = t.value; return; }
  if (a === 'count' || a === 'countn') { const m = model(); S.want = Math.max(1, Math.min(m.avail || 1, parseInt(t.value, 10) || 1)); S.preset = S.preset; setCountUi(model()); return; }
  if (a === 'perblock') { S.perBlock = Math.max(1, Math.min(80, parseInt(t.value, 10) || 40)); setCountUi(model()); return; }
  if (a === 'secs') { S.secs = Math.max(15, Math.min(600, parseInt(t.value, 10) || 90)); savePrefs(); setCountUi(model()); return; }
}
function onChange(e) {
  const t = e.target, a = t.dataset && t.dataset.a; if (!a) return;
  if (a === 'attempt') { S.attempt = t.value; savePrefs(); markStale(); render(); return; }
  if (a === 'count' || a === 'countn' || a === 'perblock' || a === 'secs') render();
}
function onKey(e) {
  const tr = e.target.closest && e.target.closest('tr[data-a="pick"]');
  if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); pick(tr.dataset.v); }
}

/* ---------- mounting into the legacy panels ---------- */
function activePanel() {
  const b = byId('qbankModePanel'), t = byId('qbankTestsPanel');
  if (t && t.classList.contains('active')) return t;
  if (b && b.classList.contains('active')) return b;
  return null;
}
function ensureRoot(panel) {
  if (!rootEl) {
    rootEl = doc.createElement('div'); rootEl.id = 'tuQbanks'; rootEl.className = 'tq-scope tq-root';
    rootEl.innerHTML = '<header class="tq-head" data-r="head"></header><div class="tq-banks" data-r="banks" role="group" aria-label="Banks" hidden></div><div data-r="view" class="tq-view"></div><div class="tq-mobilebar" data-r="bar" hidden></div>';
    rootEl.addEventListener('click', onClick); rootEl.addEventListener('input', onInput); rootEl.addEventListener('change', onChange); rootEl.addEventListener('keydown', onKey);
    rootEl.addEventListener('toggle', e => { const k = e.target && e.target.dataset && e.target.dataset.k; if (k) S.open[k] = e.target.open; }, true);
  }
  if (rootEl.parentNode !== panel) panel.insertBefore(rootEl, panel.firstChild);
  ['qbankModePanel', 'qbankTestsPanel'].forEach(id => { const p = byId(id); if (p) p.classList.add('tq-has'); });
}
function sync() {
  const p = activePanel(); if (!p) return;
  if (p.id === 'qbankTestsPanel') { if (S.tab !== 'history') S.prevTab = S.tab; S.tab = 'history'; setLegacy('qTestFilter', 'all'); setLegacy('qTestSearch', ''); }
  else if (S.tab === 'history') S.tab = S.prevTab === 'history' ? 'create' : S.prevTab;
  ensureRoot(p); render();
  if (S.stale || !D) fetchData();
}
const watched = new WeakSet();
function watch() {
  ['qbankModePanel', 'qbankTestsPanel'].forEach(id => {
    const p = byId(id); if (!p || watched.has(p)) return; watched.add(p);
    new MutationObserver(recs => {
      const own = n => rootEl && (n === rootEl || rootEl.contains(n));
      const outside = recs.filter(r => !own(r.target) && !(r.type === 'childList' && [...r.addedNodes, ...r.removedNodes].every(n => n === rootEl)));
      if (!outside.length) return;
      const opened = p.classList.contains('active') && outside.some(r => r.target === p && ((r.type === 'attributes' && !/(^|\s)active(\s|$)/.test(r.oldValue || '')) || r.type === 'childList'));
      if (opened || (p.classList.contains('active') && (!rootEl || rootEl.parentNode !== p))) { S.stale = true; sync(); return; }
      if (p.classList.contains('active') && outside.some(r => r.target.closest && r.target.closest('#qbankTestsGrid'))) markStale();
    }).observe(p, { childList: true, subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ['class'] });
  });
  /* coming back from an exam (menu shown again) the numbers changed: refetch, once now and once after late saves land */
  const menu = byId('menu');
  if (menu && !menu._tqWatched) {
    menu._tqWatched = true; let wasHidden = menu.classList.contains('hidden');
    new MutationObserver(() => {
      const h = menu.classList.contains('hidden');
      if (wasHidden && !h) { S.stale = true; if (activePanel()) { sync(); clearTimeout(watch.t); watch.t = setTimeout(() => { if (activePanel()) markStale(); }, 900); } }
      wasHidden = h;
    }).observe(menu, { attributes: true, attributeFilter: ['class'] });
  }
  if (activePanel() && (!rootEl || rootEl.parentNode !== activePanel())) sync();
}

/* ---------- Re-tag chip row on the exam screen (the only exam-screen addition) ----------
   Only when the switch is on, the run is a Qbank test, the question has no system and its explanation is showing.
   The row sits after the explanation body (never inside it, so explanation highlights are untouched). */
let examObs = null, examDone = null;
function examTick() {
  const B = bridge(), C = core(); const old = doc.querySelector('.tq-retag');
  const drop = () => { if (old) old.remove(); };
  if (!B || !C || typeof B.qbanksExamQuestion !== 'function' || !S.reviewTag) { drop(); return; }
  const ws = byId('workspace'), body = ws && ws.querySelector('.qbank-body[data-panel-mode="explanation"]');
  if (!body) { drop(); return; }
  let q = null; try { q = B.qbanksExamQuestion(); } catch (e) { q = null; }
  if (!q || !q.qbank || !q.key) { drop(); return; }
  const done = examDone && examDone.key === q.key ? examDone : null;
  if (!q.untagged && !done) { drop(); return; }
  const sig = q.key + '|' + (done ? done.system : '');
  if (old && old.dataset.sig === sig && old.previousElementSibling === body) return;
  drop();
  const row = doc.createElement('div'); row.className = 'tq-retag'; row.dataset.sig = sig; row.dataset.key = q.key; row.setAttribute('role', 'group');
  if (done) {
    row.setAttribute('aria-label', 'Filed under ' + done.system);
    row.innerHTML = `<b>Filed under ${esc(done.system)}</b><button type="button" data-tq-undo>Undo</button>`;
  } else {
    row.setAttribute('aria-label', 'File under system');
    row.innerHTML = `<b>File under system:</b>` + C.SYSTEMS.map(s => `<button type="button" data-tq-sys="${esc(s)}">${esc(s)}</button>`).join('');
  }
  body.insertAdjacentElement('afterend', row);
  if (examObs) examObs.takeRecords();
}
async function onRetagClick(e) {
  const t = e.target.closest && e.target.closest('.tq-retag button'); if (!t) return;
  e.preventDefault(); e.stopPropagation();
  const row = t.closest('.tq-retag'), key = row.dataset.key, B = bridge(); if (!B || !B.qbanksSetTag) return;
  try {
    if (t.hasAttribute('data-tq-undo')) { await B.qbanksSetTag(key, null); examDone = null; }
    else { const s = t.dataset.tqSys; await B.qbanksSetTag(key, s); examDone = { key, system: s }; }
    S.stale = true; examTick();
    if (examDone) { const r = doc.querySelector('.tq-retag'); if (r && r.dataset.key === key) { /* confirmation row is drawn by examTick */ } }
  } catch (err) { console.warn('ThunderQbanks: tagging failed', err); }
}
function watchExam() {
  const ws = byId('workspace'); if (!ws || ws._tqWatched) return !!ws;
  ws._tqWatched = true;
  let q = false;
  examObs = new MutationObserver(recs => {
    if (recs.every(r => r.target.closest && r.target.closest('.tq-retag'))) return;
    if (q) return; q = true; root.requestAnimationFrame(() => { q = false; examTick(); });
  });
  examObs.observe(ws, { childList: true, subtree: true });
  doc.addEventListener('click', onRetagClick, true);
  examTick();
  return true;
}

/* ---------- styles ---------- */
const R = ':root body #menu .tq-scope';
const CSS = `
${R} .tq-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap}
${R} .tq-head h1{margin:0;font-size:28px;letter-spacing:-.01em}
${R} .tq-head p{margin:2px 0 0;color:var(--q-on3)!important}
${R} .tq-btn{display:inline-flex;align-items:center;gap:8px;border-radius:999px;padding:9px 18px;border:1px solid var(--q-line);background:var(--q-sf);font-weight:600}
${R} .tq-btn.tq-fill{background:var(--q-p);border-color:var(--q-p);color:var(--q-onp)!important}
${R} .tq-btn.tq-tonal{background:var(--q-pc);border-color:transparent;color:var(--q-onpc)!important}
${R} .tq-btn.tq-small{padding:6px 12px;font-size:13px}
${R} .tq-btn:disabled{opacity:.45;cursor:not-allowed}
${R} .tq-link{border:0;background:none;color:var(--q-p)!important;font-weight:600;padding:2px 4px}
${R} .tq-tabs{display:flex;gap:4px;background:var(--q-s2);padding:4px;border-radius:999px;width:max-content;max-width:100%;overflow-x:auto}
${R} .tq-tabs button{border:0;background:none;padding:7px 16px;border-radius:999px;font-weight:600;color:var(--q-on2)!important;white-space:nowrap}
${R} .tq-tabs button[aria-selected=true]{background:var(--q-sf);color:var(--q-on)!important;box-shadow:var(--q-shadow)}
${R} .tq-tabs span{font-weight:500;color:var(--q-on3)!important;margin-left:4px}
${R} .tq-tabs b{font-weight:inherit}
${R} .tq-tabs .tq-sm{display:none}
${R} .tq-presets{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:0 0 16px}
${R} .tq-preset{border:1px solid var(--q-line2);background:var(--q-sf);border-radius:14px;padding:10px 14px;text-align:left;box-shadow:var(--q-shadow);min-width:0}
${R} .tq-preset b{display:block;font-size:14px}
${R} .tq-preset span{display:block;font-size:12px;color:var(--q-on3)!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${R} .tq-preset[aria-pressed=true]{border-color:var(--q-p);background:var(--q-pc);color:var(--q-onpc)!important}
${R} .tq-preset[aria-pressed=true] span{color:inherit!important;opacity:.8}
${R} .tq-preset:disabled{opacity:.45}
${R} .tq-sectools{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
${R} .tq-sortseg{display:flex;background:var(--q-s2);border-radius:999px;padding:3px}
${R} .tq-sortseg button{border:0;background:none;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:600;color:var(--q-on2)!important}
${R} .tq-sortseg button[aria-checked=true]{background:var(--q-sf);color:var(--q-on)!important;box-shadow:var(--q-shadow)}
${R} .tq-row .tq-pc{font-size:12px;font-weight:600;min-width:32px;text-align:right;font-variant-numeric:tabular-nums}
${R} .tq-ptab tr[data-a=pick]{cursor:pointer}
${R} .tq-ptab tr[data-a=pick]:hover td{background:var(--q-s1)}
${R} .tq-ptab .tq-go1{color:var(--q-p)!important;width:28px;opacity:0}
${R} .tq-ptab tr:hover .tq-go1,
${R} .tq-ptab tr:focus .tq-go1{opacity:1}
${R} .tq-rtforms{display:flex;flex-direction:column;gap:6px}
${R} .tq-rtforms div{display:flex;justify-content:space-between;gap:10px;background:var(--q-s1);border-radius:10px;padding:8px 12px;font-size:13px}
${R} .tq-rtforms span{color:var(--q-on3)!important}
${R} .tq-banks{display:flex;gap:12px;margin:20px 0 22px;overflow-x:auto;padding:2px 2px 6px;scroll-snap-type:x mandatory}
${R} .tq-bank{scroll-snap-align:start;flex:1 1 200px;min-width:190px;max-width:260px;position:relative;text-align:left;border:1.5px solid var(--q-line2);background:var(--q-sf);border-radius:16px;padding:14px 14px 12px;box-shadow:var(--q-shadow);display:flex;flex-direction:column;gap:8px}
${R} .tq-bank[aria-checked=true]{border-color:var(--q-p);background:linear-gradient(0deg,color-mix(in srgb,var(--q-p) 6%,var(--q-sf)),var(--q-sf))}
${R} .tq-bank .tq-top{display:flex;align-items:center;gap:10px}
${R} .tq-badge{width:36px;height:36px;border-radius:10px;display:grid;place-items:center;font-weight:800;font-size:12px;color:#fff!important;letter-spacing:.02em;flex:none}
${R} .tq-bank b{font-size:15px;display:block}
${R} .tq-bank small{color:var(--q-on3)!important;font-size:12px;display:block;line-height:1.3}
${R} .tq-bank .tq-chk{position:absolute;top:10px;right:10px;width:20px;height:20px;border-radius:6px;border:2px solid var(--q-line);display:grid;place-items:center}
${R} .tq-bank[aria-checked=true] .tq-chk{background:var(--q-p);border-color:var(--q-p);color:var(--q-onp)!important}
${R} .tq-meter{height:6px;border-radius:9px;background:var(--q-s2);display:flex;overflow:hidden}
${R} .tq-meter i{display:block;height:100%}
${R} .tq-bank .tq-nums{display:flex;flex-wrap:wrap;gap:0 8px;justify-content:space-between;font-size:12px;color:var(--q-on3)!important}
${R} .tq-bank .tq-nums b{display:inline;font-size:12px;color:var(--q-on)!important}
${R} .tq-bank.tq-add{flex:0 1 200px;border-style:dashed;background:transparent;box-shadow:none;align-items:center;justify-content:center;color:var(--q-on2)!important;min-height:132px}
${R} .tq-bank.tq-add i{width:40px;height:40px;border-radius:50%;background:var(--q-pc);color:var(--q-onpc)!important;display:grid;place-items:center}
${R} .tq-bank .tq-tag{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--q-on3)!important}
${R} .tq-grid>*{min-width:0}
${R} .tq-grid{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:18px;align-items:start}
${R} .tq-card{background:var(--q-sf);border:1px solid var(--q-line2);border-radius:18px;box-shadow:var(--q-shadow)}
${R} .tq-sec{padding:18px 20px;border-top:1px solid var(--q-line2)}
${R} .tq-sec:first-child{border-top:0}
${R} .tq-sech{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;flex-wrap:wrap}
${R} .tq-sech h2{margin:0;font-size:15px;display:flex;align-items:center;gap:8px}
${R} .tq-sech h2 em{font-style:normal;font-weight:600;font-size:12px;color:var(--q-on3)!important;background:var(--q-s2);border-radius:999px;padding:1px 8px}
${R} .tq-step{width:22px;height:22px;border-radius:50%;background:var(--q-pc);color:var(--q-onpc)!important;font-size:12px;display:grid;place-items:center}
${R} .tq-seg{display:grid;grid-template-columns:1fr 1fr;gap:10px}
${R} .tq-opt{border:1.5px solid var(--q-line2);background:var(--q-sf);border-radius:14px;padding:12px 14px;text-align:left;display:flex;gap:12px;align-items:flex-start}
${R} .tq-opt[aria-checked=true]{border-color:var(--q-p);background:color-mix(in srgb,var(--q-p) 6%,var(--q-sf))}
${R} .tq-opt b{display:block}
${R} .tq-opt span{color:var(--q-on3)!important;font-size:12.5px}
${R} .tq-opt .tq-ic{width:34px;height:34px;border-radius:10px;background:var(--q-s2);display:grid;place-items:center;color:var(--q-on2)!important}
${R} .tq-opt[aria-checked=true] .tq-ic{background:var(--q-p);color:var(--q-onp)!important}
${R} .tq-pools{display:flex;flex-wrap:wrap;gap:8px}
${R} .tq-pool{display:inline-flex;align-items:center;gap:8px;border:1.5px solid var(--q-line2);border-radius:999px;padding:6px 12px 6px 8px;background:var(--q-sf);font-weight:600}
${R} .tq-pool .tq-bx{width:18px;height:18px;border-radius:5px;border:2px solid var(--q-line);display:grid;place-items:center}
${R} .tq-pool[aria-checked=true]{border-color:var(--q-p)}
${R} .tq-pool[aria-checked=true] .tq-bx{background:var(--q-p);border-color:var(--q-p);color:var(--q-onp)!important}
${R} .tq-pool small{font-weight:600;font-size:12px;padding:1px 8px;border-radius:999px}
${R} .tq-p-unused small{background:var(--q-s2);color:var(--q-on2)!important}
${R} .tq-p-incorrect small{background:var(--q-badc);color:var(--q-bad)!important}
${R} .tq-p-marked small{background:var(--q-markc);color:var(--q-mark)!important}
${R} .tq-p-omitted small{background:var(--q-warnc);color:var(--q-warn)!important}
${R} .tq-p-correct small{background:var(--q-okc);color:var(--q-ok)!important}
${R} .tq-find{display:flex;align-items:center;gap:8px;background:var(--q-s1);border:1px solid var(--q-line2);border-radius:999px;padding:5px 12px;min-width:0}
${R} .tq-find input{border:0;background:none;outline:0;width:150px}
${R} .tq-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 18px}
${R} .tq-row{display:grid;grid-template-columns:20px minmax(0,1fr) auto auto;align-items:center;gap:10px;border:0;background:none;padding:7px 8px;border-radius:10px;text-align:left}
${R} .tq-row:hover{background:var(--q-s1)}
${R} .tq-row .tq-bx{width:18px;height:18px;border-radius:5px;border:2px solid var(--q-line);display:grid;place-items:center}
${R} .tq-row[aria-checked=true] .tq-bx{background:var(--q-p);border-color:var(--q-p);color:var(--q-onp)!important}
${R} .tq-row[aria-disabled=true]{opacity:.42}
${R} .tq-row .tq-nm{min-width:0}
${R} .tq-row .tq-nm b{font-weight:500;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${R} .tq-row .tq-bar{height:4px;border-radius:4px;background:var(--q-s2);display:flex;overflow:hidden;margin-top:4px}
${R} .tq-row .tq-bar i{display:block}
${R} .tq-row .tq-ct{font-variant-numeric:tabular-nums;font-weight:600;color:var(--q-on2)!important;font-size:13px;min-width:34px;text-align:right}
${R} .tq-row .tq-ct.tq-zero{color:var(--q-on3)!important;font-weight:500}
${R} .tq-unas{color:var(--q-warn)!important}
${R} .tq-hint{display:flex;gap:10px;align-items:flex-start;background:var(--q-warnc);color:var(--q-warn)!important;border-radius:12px;padding:10px 12px;font-size:12.5px;margin-top:10px}
${R} .tq-hint b{color:inherit!important}
${R} .tq-prov{font-size:12px;color:var(--q-on3)!important;margin-top:10px;display:flex;flex-wrap:wrap;gap:6px 14px}
${R} .tq-prov i{font-style:normal;display:inline-flex;align-items:center;gap:6px}
${R} .tq-prov i::before{content:"";width:8px;height:8px;border-radius:50%;background:var(--c)}
${R} details.tq-more{border-top:1px solid var(--q-line2)}
${R} details.tq-more summary{list-style:none;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;font-weight:600}
${R} details.tq-more summary::-webkit-details-marker{display:none}
${R} details.tq-more summary span{font-weight:500;color:var(--q-on3)!important;font-size:12.5px}
${R} details.tq-more[open] summary svg{transform:rotate(180deg)}
${R} .tq-fgroup{padding:0 20px 14px}
${R} .tq-fgroup h3{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--q-on3)!important;margin:8px 0 6px;display:flex;align-items:center;gap:8px}
${R} .tq-fchips{display:flex;flex-wrap:wrap;gap:6px}
${R} .tq-fchip{border:1.5px solid var(--q-line2);background:var(--q-sf);border-radius:8px;padding:4px 9px;font-size:12.5px;font-weight:600}
${R} .tq-fchip[aria-pressed=true]{border-color:var(--q-p);background:var(--q-pc);color:var(--q-onpc)!important}
${R} .tq-sum{padding:18px 20px}
${R} .tq-big{display:flex;align-items:baseline;gap:8px}
${R} .tq-big b{font-size:40px;line-height:1;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
${R} .tq-big span{color:var(--q-on3)!important}
${R} .tq-field{display:flex;flex-direction:column;gap:6px;margin-top:14px}
${R} .tq-field>span{font-size:12px;font-weight:600;color:var(--q-on2)!important}
${R} .tq-inp{border:1px solid var(--q-line);background:var(--q-sf);border-radius:10px;padding:9px 12px;width:100%}
${R} .tq-nums2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
${R} input[type=range]{width:100%;accent-color:var(--q-p)}
${R} .tq-sw{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:14px}
${R} .tq-sw b{display:block;font-weight:600}
${R} .tq-sw span{font-size:12px;color:var(--q-on3)!important}
${R} .tq-switch{width:44px;height:26px;border-radius:999px;border:0;background:var(--q-s3);position:relative;flex:none}
${R} .tq-switch i{position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:left .15s;box-shadow:0 1px 2px rgba(0,0,0,.25)}
${R} .tq-switch[aria-checked=true]{background:var(--q-p)}
${R} .tq-switch[aria-checked=true] i{left:21px}
${R} .tq-go{width:100%;justify-content:center;margin-top:16px;padding:12px}
${R} .tq-why{font-size:12px;color:var(--q-on3)!important;text-align:center;margin-top:8px}
${R} .tq-mixline{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
${R} .tq-pill{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;background:var(--q-s2);border-radius:999px;padding:2px 9px 2px 4px}
${R} .tq-pill i{width:16px;height:16px;border-radius:5px}
${R} .tq-mobilebar{display:none}
${R} .tq-htools{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;margin-bottom:12px}
${R} .tq-chips{display:flex;flex-wrap:wrap;gap:6px}
${R} .tq-chip{border:1px solid var(--q-line);background:var(--q-sf);border-radius:999px;padding:5px 12px;font-weight:600;font-size:13px;color:var(--q-on2)!important}
${R} .tq-chip[aria-pressed=true]{background:var(--q-pc);color:var(--q-onpc)!important;border-color:transparent}
${R} .tq-tests{display:flex;flex-direction:column}
${R} .tq-test{display:grid;grid-template-columns:52px minmax(0,1fr) 120px 150px auto;gap:14px;align-items:center;padding:14px 18px;border-top:1px solid var(--q-line2)}
${R} .tq-test:first-child{border-top:0}
${R} .tq-ring{width:48px;height:48px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(var(--c) calc(var(--p)*1%),var(--q-s2) 0);position:relative;font-weight:700;font-size:12px}
${R} .tq-ring::before{content:"";position:absolute;inset:5px;border-radius:50%;background:var(--q-sf)}
${R} .tq-ring span{position:relative}
${R} .tq-test .tq-nm b{display:block}
${R} .tq-test .tq-nm small{color:var(--q-on3)!important;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${R} .tq-test .tq-bk{display:flex;gap:4px;flex-wrap:wrap}
${R} .tq-mini{font-size:11px;font-weight:700;color:#fff!important;border-radius:6px;padding:1px 6px}
${R} .tq-st{font-size:12px;font-weight:600;border-radius:999px;padding:2px 10px;width:max-content}
${R} .tq-st.tq-done{background:var(--q-okc);color:var(--q-ok)!important}
${R} .tq-st.tq-prog{background:var(--q-warnc);color:var(--q-warn)!important}
${R} .tq-acts{display:flex;gap:4px;align-items:center}
${R} .tq-ib{width:34px;height:34px;border-radius:50%;border:0;background:none;color:var(--q-on2)!important;display:grid;place-items:center}
${R} .tq-ib:hover{background:var(--q-s2)}
${R} .tq-perf{display:grid;grid-template-columns:1fr 1fr;gap:18px}
${R} .tq-ptab{width:100%;border-collapse:collapse;font-size:13px}
${R} .tq-ptab th{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--q-on3)!important;text-align:left;padding:8px 10px;font-weight:600}
${R} .tq-ptab td{padding:9px 10px;border-top:1px solid var(--q-line2);font-variant-numeric:tabular-nums}
${R} .tq-ptab td:first-child{font-weight:500}
${R} .tq-pbar{height:8px;border-radius:8px;background:var(--q-s2);overflow:hidden;min-width:80px}
${R} .tq-pbar i{display:block;height:100%;border-radius:8px}
${R} .tq-mrow{display:grid;grid-template-columns:44px minmax(0,1fr) 140px auto;gap:14px;align-items:center;padding:14px 18px;border-top:1px solid var(--q-line2)}
${R} .tq-mrow:first-child{border-top:0}
${R} .tq-mrow small{color:var(--q-on3)!important;display:block}
${R} .tq-src{font-size:12px;color:var(--q-on2)!important}
${R} .tq-sheet{background:var(--q-sf);border-radius:22px;width:min(760px,100%);max-height:calc(100vh - 40px);display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.3)}
${R} .tq-shead{padding:18px 22px 12px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
${R} .tq-shead h2{margin:0;font-size:20px}
${R} .tq-shead p{margin:2px 0 0;color:var(--q-on3)!important}
${R} .tq-steps{display:flex;gap:6px;padding:0 22px 12px}
${R} .tq-steps i{flex:1;height:4px;border-radius:4px;background:var(--q-s2)}
${R} .tq-steps i.tq-on{background:var(--q-p)}
${R} .tq-sbody{padding:4px 22px 18px;overflow:auto}
${R} .tq-sfoot{padding:14px 22px;border-top:1px solid var(--q-line2);display:flex;justify-content:space-between;gap:10px;align-items:center}
${R} .tq-drop{border:2px dashed var(--q-line);border-radius:16px;padding:34px 20px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:8px;background:var(--q-s1)}
${R} .tq-drop.tq-over{border-color:var(--q-p);background:var(--q-pc)}
${R} .tq-drop b{font-size:16px}
${R} .tq-drop span{color:var(--q-on3)!important}
${R} .tq-fmts{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px}
${R} .tq-fmt{border:1px solid var(--q-line2);border-radius:12px;padding:10px 12px;font-size:12.5px;color:var(--q-on2)!important}
${R} .tq-fmt b{display:block;color:var(--q-on)!important;font-size:13px}
${R} .tq-map{display:grid;grid-template-columns:1fr 1fr;gap:14px}
${R} .tq-mapc{border:1px solid var(--q-line2);border-radius:14px;padding:12px}
${R} .tq-mapc h4{margin:0 0 8px;font-size:13px;display:flex;justify-content:space-between;align-items:center}
${R} .tq-mapc select{width:100%}
${R} .tq-vals{margin-top:10px;display:flex;flex-direction:column;gap:2px;max-height:210px;overflow:auto;font-size:12.5px}
${R} .tq-vals div{display:flex;justify-content:space-between;gap:8px;padding:3px 4px;border-radius:6px}
${R} .tq-vals div:nth-child(odd){background:var(--q-s1)}
${R} .tq-vals em{font-style:normal;color:var(--q-on3)!important}
${R} .tq-okline{display:flex;gap:8px;align-items:center;background:var(--q-okc);color:var(--q-ok)!important;border-radius:12px;padding:10px 12px;font-size:13px;margin-bottom:14px;font-weight:600}
${R} .tq-swatches{display:flex;gap:8px}
${R} .tq-swatch{width:30px;height:30px;border-radius:50%;border:3px solid transparent}
${R} .tq-swatch[aria-checked=true]{border-color:var(--q-on)}

${R} svg{flex:none}
${R}.tq-root{max-width:1240px;margin:0 auto;display:flex;flex-direction:column;gap:0;color:var(--q-on);font:14px/1.45 var(--q-font);-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums;text-align:left}
${R}.tq-root,${R}.tq-scrim,${R}.tq-toast,${R}.tq-setq{--q-bg:var(--tu-bg,#F6F7FB);--q-sf:var(--tu-surface,#fff);--q-s1:var(--tu-s1,#EFF1F7);--q-s2:var(--tu-s2,#E7EAF3);--q-s3:var(--tu-s3,#DCE0EC);--q-line:var(--tu-line,#D3D8E5);--q-line2:var(--tu-line2,#E4E7F0);--q-on:var(--tu-on,#161A25);--q-on2:var(--tu-on2,#474E62);--q-on3:var(--tu-on3,#5F6679);--q-ok:var(--tu-ok,#17683D);--q-okc:var(--tu-okc,#D3EFDD);--q-warn:var(--tu-warn,#7D4B00);--q-warnc:var(--tu-warnc,#FFE3B8);--q-bad:var(--tu-bad,#A8231B);--q-badc:var(--tu-badc,#FBDAD6);--q-p:var(--tu-p,#A2283A);--q-onp:var(--tu-onp,#fff);--q-pc:var(--tu-pc,#FFDADC);--q-onpc:var(--tu-onpc,#40000D);--q-shadow:var(--tu-shadow,0 1px 2px rgba(20,26,40,.06),0 3px 10px rgba(20,26,40,.06));--q-font:var(--tu-font,"Figtree",-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif);--q-mark:#2F5BD3;--q-markc:#DCE4FF}
:root body #menu.theme-dark .tq-scope{--q-mark:#B3C5FF;--q-markc:#1F2E63}
${R}.tq-root *{box-sizing:border-box}
${R} :is(span,label,p,h1,h2,h3,h4){color:inherit!important}
${R} :is(h1,h2,h3,h4,p){font-family:inherit!important;letter-spacing:0;text-transform:none}
${R} :is(button,input,select){font:inherit;color:inherit}
${R} button{cursor:pointer;font-family:inherit}
${R} :is(input,select,textarea){background:var(--q-sf)!important;color:var(--q-on)!important;border-color:var(--q-line)!important;font-family:inherit!important}
${R} :is(input[type=range],input[type=checkbox],input[type=file]){background:transparent!important}
${R} :is(button,input,select,summary):focus-visible,${R} tr:focus-visible{outline:2px solid var(--q-p);outline-offset:2px}
${R}.tq-scrim :is(button,input,select,summary):focus-visible{outline:2px solid var(--q-p);outline-offset:2px}
${R} .tq-head h1{font-size:28px!important;font-weight:800!important;letter-spacing:-.01em!important;margin:0!important;color:var(--q-on)!important}
${R} .tq-head p{margin:2px 0 0!important;color:var(--q-on3)!important;font-size:14px!important}
${R} .tq-headr{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
${R} .tq-view{min-width:0}
${R} .tq-banks[hidden],${R} .tq-mobilebar[hidden]{display:none!important}
${R} .tq-note{font-size:12px;color:var(--q-on3)!important}
${R} .tq-foot{font-size:12px;color:var(--q-on3)!important;margin:12px 0 0!important}
${R} .tq-gap{margin-top:14px}
${R} .tq-bordered{border:1px solid var(--q-line2);border-radius:14px}
${R} .tq-sw.tq-bordered{padding:12px 14px}
${R} .tq-chk2{display:flex;gap:8px;align-items:center;margin-top:8px;font-size:12.5px}
${R} .tq-empty{padding:34px 20px;text-align:center;color:var(--q-on3)!important}
${R} .tq-unas{color:var(--q-warn)!important}
${R} .tq-inline{padding:0;color:inherit!important;text-decoration:underline}
${R} .tq-inp{font-size:14px}
${R} .tq-find input{background:transparent!important;border:0!important;outline:0}
${R} .tq-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
${R} .tq-opt b,${R} .tq-opt>span{min-width:0}
${R} .tq-bank b{color:var(--q-on)!important}
${R} .tq-card{overflow:hidden}
${R} .tq-ptabcard{padding:6px 8px 10px}
${R} .tq-ptabcard .tq-sech{padding:12px 10px 0}
${R} .tq-sidecard{position:sticky;top:16px;display:flex;flex-direction:column;gap:14px}
${R} .tq-bad{color:var(--q-bad)!important}
${R} .tq-plusbadge{background:var(--q-s3)!important;color:var(--q-on2)!important}
${R} .tq-dropic{color:var(--q-p)!important}
${R} .tq-drop{cursor:pointer;position:relative}
${R} .tq-step{font-weight:700}
${R} .tq-pool{color:var(--q-on)!important}
${R} .tq-opt{color:var(--q-on)!important}
${R} .tq-tabs button,${R} .tq-sortseg button{color:var(--q-on2)!important}
${R} .tq-tabs button[aria-selected=true],${R} .tq-sortseg button[aria-checked=true]{color:var(--q-on)!important}
${R} .tq-row{color:var(--q-on)!important}
${R} .tq-btn{color:var(--q-on)!important}
${R} .tq-btn.tq-fill{color:var(--q-onp)!important}
${R} .tq-btn.tq-tonal{color:var(--q-onpc)!important}
${R} .tq-preset{color:var(--q-on)!important}
${R} .tq-preset[aria-pressed=true]{color:var(--q-onpc)!important}
${R} .tq-fchip{color:var(--q-on)!important}
${R} .tq-mapc select,${R} .tq-field select{appearance:auto}
${R} .tq-ptab td,${R} .tq-ptab th{background:transparent}
${R} .tq-ptab tr[data-a=pick]{cursor:pointer}
${R} .tq-ptab tr[data-a=pick]:hover td{background:var(--q-s1)}
${R} .tq-mbtxt{flex:1;min-width:0}
${R}.tq-scrim{position:fixed;inset:0;background:rgba(10,12,18,.5);z-index:90;display:flex;align-items:center;justify-content:center;padding:20px;font:14px/1.45 var(--q-font);color:var(--q-on);-webkit-font-smoothing:antialiased}
${R}.tq-scrim[hidden]{display:none}
${R}.tq-toast{position:fixed;bottom:112px;left:50%;transform:translateX(-50%);background:var(--q-on);color:var(--q-sf)!important;border-radius:12px;padding:10px 16px;z-index:95;font:600 14px/1.35 var(--q-font);display:none;max-width:calc(100vw - 32px);box-shadow:0 8px 24px rgba(0,0,0,.25)}
${R}.tq-root{padding-bottom:8px}
@media (min-width:901px){${R}.tq-toast{bottom:28px}}
${R} .tq-banks{margin:18px 0 20px}
${R} .tq-banks .tq-bank{color:var(--q-on)!important}
${R} .tq-tabs{width:auto}
${R} .tq-list .tq-row{width:100%}
@media (max-width:1180px){${R} .tq-grid{grid-template-columns:minmax(0,1fr)}${R} .tq-sidecard{position:static}${R} .tq-perf{grid-template-columns:minmax(0,1fr)}}
@media (max-width:900px){
${R} .tq-mobilebar{display:flex;position:sticky;bottom:calc(80px + env(safe-area-inset-bottom));z-index:40;background:var(--q-sf);border:1px solid var(--q-line2);border-radius:20px;padding:10px 12px 10px 16px;align-items:center;gap:12px;box-shadow:0 6px 22px rgba(0,0,0,.14);margin-top:16px}
${R} .tq-mobilebar[hidden]{display:none!important}
${R} .tq-mobilebar .tq-mbtxt b{display:block;font-size:15px}
${R} .tq-mobilebar .tq-mbtxt span{display:block;font-size:12px;color:var(--q-on3)!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${R} .tq-sidecard .tq-go,${R} .tq-sidecard .tq-why{display:none}
${R} .tq-root{padding-bottom:12px}
${R} button,${R} summary{min-height:44px}
${R} .tq-ib{min-width:44px;min-height:44px;width:44px;height:44px}
${R} .tq-link{min-height:44px;padding:0 8px}
${R} .tq-inline{min-height:0;padding:0}
${R} .tq-switch{min-height:26px}
${R} .tq-swatch{min-width:44px;min-height:44px;width:44px;height:44px;background-clip:content-box;padding:6px}
${R} .tq-sortseg button{min-height:44px}
${R} .tq-find{padding-top:0;padding-bottom:0}
${R} .tq-find input{min-height:44px}
${R} .tq-ptab td{height:44px}
${R} .tq-inp{min-height:44px}
${R} .tq-find{min-height:44px}
${R} .tq-fchip{padding:0 12px}
${R} .tq-chip{padding:0 14px}
${R} .tq-pool{padding:0 14px 0 10px}
${R} .tq-test{grid-template-columns:48px minmax(0,1fr);gap:8px 12px;padding:12px 14px}
${R} .tq-test .tq-bk,${R} .tq-test .tq-stc{display:none}
${R} .tq-test .tq-acts{grid-column:1/-1;justify-content:space-between}
${R} .tq-test .tq-acts .tq-btn{flex:1;justify-content:center}
${R} .tq-mrow{grid-template-columns:40px minmax(0,1fr);gap:8px 12px}
${R} .tq-mrow .tq-acts{grid-column:1/-1;flex-wrap:wrap}
${R} .tq-banks{margin:14px 0 16px}
${R} .tq-headr{width:100%}
}
@media (max-width:640px){
${R} .tq-head h1{font-size:24px!important}
${R} .tq-head>div{width:100%;min-width:0}
${R} .tq-headr{position:static}
${R} .tq-tabs{width:100%}
${R} .tq-tabs .tq-lg{display:none}
${R} .tq-tabs .tq-sm{display:inline}
${R} .tq-tabs button{flex:1;padding:7px 6px}
${R} .tq-head{position:relative}
${R} .tq-head>div:first-child{padding-right:110px}
${R} .tq-head .tq-imp{position:absolute;top:0;right:0;padding:8px 14px;min-height:44px}
${R} .tq-headr .tq-tabs{margin-top:0}
${R} .tq-presets{grid-template-columns:1fr 1fr}
${R} .tq-list{grid-template-columns:minmax(0,1fr)}
${R} .tq-bank{flex-basis:200px}
${R} .tq-opt{padding:10px;gap:8px}
${R} .tq-opt .tq-ic{display:none}
${R} .tq-sec{padding:16px 14px}
${R} details.tq-more summary{padding:0 14px}
${R} .tq-fgroup{padding:0 14px 12px}
${R} .tq-find input{width:100px}
${R} .tq-map,${R} .tq-fmts{grid-template-columns:minmax(0,1fr)}
${R}.tq-scrim{padding:0;align-items:flex-end}
${R} .tq-sheet{border-radius:22px 22px 0 0;max-height:92vh}
${R} .tq-sbody{padding:4px 16px 16px}${R} .tq-shead{padding:16px 16px 10px}${R} .tq-steps{padding:0 16px 10px}${R} .tq-sfoot{padding:12px 16px}
${R} .tq-ptab .tq-hide-s{display:none}
${R} .tq-ptab th,${R} .tq-ptab td{padding-left:6px;padding-right:6px}
${R} .tq-ptabcard{padding:4px 4px 8px}
${R} .tq-ptab .tq-go1{display:none}
${R} .tq-pbar{min-width:40px}
${R} .tq-card .tq-sech{align-items:flex-start}
}
/* Settings > Qbanks + import step 1 summary */
${R}.tq-setq{color:var(--q-on);font:14px/1.45 var(--q-font);-webkit-font-smoothing:antialiased;text-align:left}
${R}.tq-setq *{box-sizing:border-box}
${R} .tq-shd{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:10px 16px;padding:18px 22px 14px}
${R} .tq-shd h2{margin:0!important;font-size:19px!important;font-weight:800!important;color:var(--q-on)!important}
${R} .tq-shd p{margin:3px 0 0!important;font-size:13px!important;color:var(--q-on3)!important}
${R} .tq-sbody0{padding:0 22px 16px}
${R} .tq-sbk{border-top:1px solid var(--q-line2)}
${R} .tq-srow{display:grid;grid-template-columns:40px minmax(0,1fr) auto 24px;gap:12px;align-items:center;width:100%;padding:12px 22px;border:0;background:none;text-align:left;color:var(--q-on)!important}
${R} .tq-srow:hover{background:var(--q-s1)}
${R} .tq-snm{min-width:0}
${R} .tq-snm b{display:block;font-size:15px;font-weight:700;color:var(--q-on)!important}
${R} .tq-snm small{display:block;font-size:12.5px;color:var(--q-on3)!important;line-height:1.35}
${R} .tq-schip{font-size:11px;font-weight:700;border-radius:999px;padding:2px 10px;background:var(--q-s2);color:var(--q-on2)!important;white-space:nowrap}
${R} .tq-chv{display:grid;place-items:center;color:var(--q-on3)!important}
${R} .tq-srow[aria-expanded=true] .tq-chv svg{transform:rotate(180deg)}
${R} .tq-sdet{padding:2px 22px 18px 74px;display:flex;flex-direction:column;gap:10px}
${R} .tq-tiles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
${R} .tq-tile{background:var(--q-s1);border-radius:12px;padding:8px 12px;min-width:0}
${R} .tq-tile b{display:block;font-size:18px;font-weight:800;line-height:1.2;color:var(--q-on)!important}
${R} .tq-tile i{font-style:normal}
${R} .tq-tile span{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--q-on3)!important;font-weight:600}
${R} .tq-smeta{margin:0!important;font-size:13px;color:var(--q-on2)!important}
${R} .tq-smeta b{color:var(--q-on)!important}
${R} .tq-sfl{display:flex;flex-direction:column;gap:2px}
${R} .tq-sfl>div,${R} .tq-pvfiles>div{display:flex;justify-content:space-between;gap:10px;padding:4px 8px;border-radius:8px;font-size:12.5px}
${R} .tq-sfl>div:nth-child(odd),${R} .tq-pvfiles>div:nth-child(odd){background:var(--q-s1)}
${R} .tq-sfl span,${R} .tq-pvfiles span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
${R} .tq-sfl em,${R} .tq-pvfiles em{font-style:normal;color:var(--q-on3)!important;font-variant-numeric:tabular-nums}
${R} .tq-sacts{flex-wrap:wrap;gap:8px;margin-top:2px}
${R} .tq-sacts .tq-btn.tq-bad{color:var(--q-bad)!important}
${R} .tq-pvfiles{display:flex;flex-direction:column;gap:2px;margin-bottom:8px}
${R} .tq-pvrow{display:flex;gap:10px;align-items:center;font-size:13px;border:1px solid var(--q-line2);border-radius:12px;padding:8px 12px;margin-bottom:8px;min-width:0}
${R} .tq-pvrow b{flex:none}
${R} .tq-pvrow span{color:var(--q-on2)!important;min-width:0;overflow:hidden;text-overflow:ellipsis}
${R} .tq-pvrow .tq-dot{vertical-align:-1px}
${R} .tq-dot{display:inline-block;width:12px;height:12px;border-radius:50%;flex:none}
${R} .tq-drop.tq-compact{padding:14px 16px;margin-top:10px}
${R} .tq-drop.tq-compact .tq-dropic{display:none}
${R} .tq-badfiles{display:flex;flex-direction:column;gap:2px;margin-top:6px;font-weight:400;word-break:break-all}
@media (max-width:640px){
${R} .tq-shd{padding:16px 14px 12px}
${R} .tq-shd .tq-btn{width:100%;justify-content:center}
${R} .tq-srow{grid-template-columns:36px minmax(0,1fr) 20px;padding:10px 14px;gap:10px}
${R} .tq-srow .tq-schip{display:none}
${R} .tq-sdet{padding:2px 14px 16px}
${R} .tq-tiles{grid-template-columns:repeat(2,minmax(0,1fr))}
${R} .tq-sacts .tq-btn{flex:1 1 40%;justify-content:center}
${R} .tq-sbody0{padding:0 14px 14px}
}
/* Re-tag chip row on the exam screen: neutral, compact, inherits the exam's colours */
.tq-retag{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:10px 0 4px;padding:8px 0 0;font:12px/1.3 system-ui,-apple-system,"Segoe UI",Arial,sans-serif;color:inherit;border-top:1px solid rgba(128,128,128,.35)}
.tq-retag>b{font-weight:700;margin-right:2px;color:inherit}
.tq-retag button{font:600 12px/1.2 system-ui,-apple-system,"Segoe UI",Arial,sans-serif;color:inherit;background:transparent;border:1px solid rgba(128,128,128,.55);border-radius:999px;padding:5px 10px;min-height:28px;cursor:pointer}
.tq-retag button:hover{background:rgba(128,128,128,.18)}
.tq-retag button:focus-visible{outline:2px solid currentColor;outline-offset:2px}
/* the legacy panels stay in the DOM, off-screen, exactly like the old Qbank view */
:root body #menu :is(#qbankModePanel,#qbankTestsPanel).tq-has.active{display:block!important;padding:0!important;margin:0!important;background:transparent!important;border:0!important;box-shadow:none!important}
:root body #menu :is(#qbankModePanel,#qbankTestsPanel).tq-has>:not(.tq-root){position:absolute!important;left:-10000px!important;top:0!important;width:900px!important;height:1px!important;overflow:hidden!important;visibility:hidden!important;pointer-events:none!important}
:root body #menu .modern-main:has(:is(#qbankModePanel,#qbankTestsPanel).tq-has.active){padding:28px 36px 56px!important}
@media (max-width:900px){:root body #menu .modern-main:has(:is(#qbankModePanel,#qbankTestsPanel).tq-has.active){padding:24px 24px 120px!important;overflow:visible!important}}
@media (max-width:640px){:root body #menu .modern-main:has(:is(#qbankModePanel,#qbankTestsPanel).tq-has.active){padding:18px 16px 120px!important}}
`;

/* ---------- start-up ---------- */
function injectStyle() {
  if (byId('tq-qbanks-style')) return;
  const st = doc.createElement('style'); st.id = 'tq-qbanks-style'; st.textContent = CSS; doc.head.appendChild(st);
}
function init() {
  injectStyle();
  // first visit: follow the legacy default source (Settings > "Default to Form Library attempts")
  if (!S.track) { S.track = legacyVal('qbankSourceMode') === 'linked' ? 'forms' : 'qbank'; }
  watch(); watchExam();
}
const api = {
  version: 1,
  refresh() { S.stale = true; invalDet(); if (activePanel()) sync(); else paintSet(); examTick(); },
  mountSettings,
  _state: S
};
root.ThunderQbanksUI = api;
let tries = 0;
function boot() { try { init(); } catch (e) { console.warn('ThunderQbanks init failed', e); } if (++tries < 60) setTimeout(boot, tries < 20 ? 250 : 1000); }
if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot); else boot();
})(typeof window !== 'undefined' ? window : this);

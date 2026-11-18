/* ThunderUSMLE Analysis tab — shared by Local (../analysis.js) and iPad (analysis.js); keep the two copies byte-identical.
   This root copy is the master: edit it, then `cp analysis.js "Step Simulator IPAD/analysis.js"` (tests/analysis.test.cjs checks parity).
   Sections: unofficial 3-digit conversions (from ThunderTracker) · ThunderAnalysis (pure compute) · ThunderAnalysisUI (view) · app glue.
   Automatic analysis of the simulator's own progress (ThunderTracker's dashboard without manual logging). */

/* Copied from ThunderTracker js/score-models.js (unofficial 3-digit conversions), wrapped as a classic script. */
(function(root){'use strict';
// Built-in 3-digit score conversions, per form. All are unofficial: NBME and UWorld don't publish how
// raw scores map to reported scores. Sources (reviewed Oct 2026):
//   NBME 6–8    a legacy Excel calculator (score from questions wrong; nothing past 91 wrong). Forms 6 and 8
//               have 184 questions, Form 7 has 176
//   NBME 9–15   NBMEScore.com's published per-form regressions; NBME 15 also has the r/Step2 author's fits
//   NBME 16     NBMEcalc's chart, made for the equated % correct (EPC) on the NBME report
//   UWSA 1      NBMEScore.com's %→score anchors (50, 55 and 85% are the site's own extrapolations);
//               NBMECalculator.com's table, approximated as a line
//   UWSA 2      NBMEScore.com's clamp(280 − 0.85 × wrong, 140, 300); NBMECalculator.com's table (≈ 1.08 per wrong)
//   Free 120 (2023)  y = 1.165 × % + 166.17, a formula you supplied
// UWSA 3 and the other Free 120 releases have none. A model never extrapolates past its range.
//
// Types:  wrong   score = b + a × wrong (+ q × wrong²), wrong = questions × (1 − %/100)
//         pct     score = b + a × % (on the 0–100 scale)
//         chart   straight lines between [%, score] points, nothing outside them

const NBS = 'NBMEScore.com';
const nbs = (slug) => 'https://nbmescore.com/' + slug + '/';
const reg = (b, a, slug) => ({ id: 'nbmescore', src: NBS + ' regression', short: 'NBMEScore', type: 'wrong', b, a, url: nbs(slug) });
const EXCEL = 'Legacy Excel calculator';
const excel = (b, a) => ({ id: 'excel', src: EXCEL, short: 'Excel', type: 'wrong', b, a, maxWrong: 91, decimals: true,
  note: 'For the retired forms (176–184 questions); gives no score past 91 wrong.' });
const NBME16 = [[50, 181], [52, 186], [54, 191], [56, 196], [58, 201], [60, 206], [62, 211], [64, 216], [66, 221], [68, 226], [70, 231],
  [72, 236], [74, 241], [76, 246], [78, 252], [80, 257], [82, 262], [84, 267], [86, 272], [88, 277], [90, 282]];
const R15 = 'https://www.reddit.com/r/Step2/comments/1hzvyza/nbme_15_three_digit_score_calculator/';

// Keyed by form id. The first model is the default; `qs` is the form's question count.
const SCORE_MODELS = {
  'nbme-6': { qs: 184, models: [excel(293.52, -2.4295)] },
  'nbme-7': { qs: 176, models: [excel(283.7, -1.4992)] },
  'nbme-8': { qs: 184, models: [excel(295.48, -2.1601)] },
  'nbme-9': { qs: 200, models: [reg(298.45, -1.09, 'nbme-9-score-calculator-step-2')] },
  'nbme-10': { qs: 200, models: [reg(300.18, -1.1, 'nbme-10-score-conversion')] },
  'nbme-11': { qs: 200, models: [reg(299.5, -1.08, 'nbme-11-score-conversion')] },
  'nbme-12': { qs: 200, models: [reg(300.18, -1.09, 'nbme-12-score-conversion')] },
  'nbme-13': { qs: 200, models: [reg(298.8, -1.07, 'nbme-13-step-2-ck-score-conversion')] },
  'nbme-14': { qs: 200, models: [reg(299.2, -1.08, 'nbme-14-step-2-ck-score-conversion')] },
  'nbme-15': { qs: 200, models: [
    reg(300.5, -1.1, 'nbme-15-step-2-ck-score-conversion'),
    { id: 'reddit-linear', src: 'r/Step2 fit (straight line)', short: 'r/Step2 line', type: 'wrong', b: 301.1223, a: -1.1387, url: R15,
      note: 'Fitted to self-reported scores between 64% and 87% correct.' },
    { id: 'reddit-curve', src: 'r/Step2 fit (curve)', short: 'r/Step2 curve', type: 'wrong', b: 288.7849, a: -0.5766, q: -0.0059, url: R15,
      note: 'Fitted to self-reported scores between 64% and 87% correct.' },
  ] },
  'nbme-16': { qs: 200, models: [
    { id: 'nbmecalc', src: 'NBMEcalc chart', short: 'NBMEcalc', type: 'chart', points: NBME16, url: 'https://nbmecalc.com/nbme-16-score-conversion',
      note: 'Made for the equated % correct (EPC) on your NBME report. With a % you counted yourself it’s only a rough guide.' },
  ] },
  'uwsa-1': { qs: 160, models: [
    { id: 'nbmescore', src: NBS + ' anchors', short: 'NBMEScore', type: 'chart', url: nbs('uwsa1-step-2-score-conversion'),
      points: [[50, 204], [55, 210], [60, 215], [65, 225], [70, 236], [75, 246], [80, 255], [85, 263]],
      note: 'Observed between 60% and 80%; the 50, 55 and 85% points are the site’s own extrapolations.' },
    { id: 'nbmecalculator', src: 'NBMECalculator.com table', short: 'NBMECalculator', type: 'wrong', b: 292, a: -1.05, clamp: [140, 300], url: 'https://nbmecalculator.com/step-2/uwsa-1/',
      note: 'A straight line that reproduces the site’s table.' },
  ] },
  'uwsa-2': { qs: 160, models: [
    { id: 'nbmescore', src: NBS + ' formula', short: 'NBMEScore', type: 'wrong', b: 280, a: -0.85, clamp: [140, 300], url: nbs('uwsa-2-score-conversion') },
    { id: 'nbmecalculator', src: 'NBMECalculator.com table', short: 'NBMECalculator', type: 'wrong', b: 280, a: -1.08, clamp: [140, 300], url: 'https://nbmecalculator.com/step-2/uwsa-2/',
      note: 'A straight line that reproduces the site’s table.' },
  ] },
  'f120-2023': { qs: 120, models: [
    { id: 'supplied', src: 'Supplied formula', short: 'Supplied', type: 'pct', b: 166.17, a: 1.165, note: 'Only for the 2023 release.' },
  ] },
};

const modelsFor = (id) => (SCORE_MODELS[id] ? SCORE_MODELS[id].models : []);
const modelById = (id, mid) => modelsFor(id).find((m) => m.id === mid) || null;

// Nearest whole score, rounding halves up the way a spreadsheet does (256.4999… from float error counts as 256.5).
const roundScore = (v) => Math.round(Math.round(v * 1e6) / 1e6);

// Score from a model: { value, score } or { error: 'range' | 'none', range: [lo, hi] (in % correct) }.
// `x` is questions wrong for 'wrong' models and % correct otherwise; use scoreAtPct to start from %.
function runModel(m, x, qs) {
  if (!m) return { error: 'none' };
  let v;
  if (m.type === 'wrong') {
    const max = m.maxWrong != null ? m.maxWrong : qs;
    if (!(x >= -1e-9 && x <= max + 1e-9)) return { error: 'range', range: [Math.round((qs - max) / qs * 1000) / 10, 100] };
    v = m.b + m.a * x + (m.q || 0) * x * x;
  } else if (m.type === 'pct') {
    if (!(x >= 0 && x <= 100)) return { error: 'range', range: [0, 100] };
    v = m.b + m.a * x;
  } else {
    const pts = m.points, lo = pts[0][0], hi = pts[pts.length - 1][0];
    if (!(x >= lo - 1e-9 && x <= hi + 1e-9)) return { error: 'range', range: [lo, hi] };
    const i = Math.max(1, pts.findIndex((p) => p[0] >= x - 1e-9));
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    v = y0 + (y1 - y0) * (x - x0) / (x1 - x0);
  }
  if (m.clamp) v = Math.min(m.clamp[1], Math.max(m.clamp[0], v));
  return { value: v, score: roundScore(v) };
}
const wrongAt = (pct, qs) => qs * (1 - pct / 100);
const scoreAtPct = (m, pct, qs) => runModel(m, m.type === 'wrong' ? wrongAt(pct, qs) : pct, qs);

const n = (x) => +x.toFixed(4);
function describeModel(m) {
  if (m.type === 'chart') return 'chart of ' + m.points.length + ' points, ' + m.points[0][0] + '–' + m.points[m.points.length - 1][0] + '%';
  const sign = (x) => (x < 0 ? ' − ' : ' + ') + n(Math.abs(x));
  if (m.type === 'pct') return 'score = ' + n(m.a) + ' × %' + sign(m.b);
  return 'score = ' + n(m.b) + sign(m.a) + ' × wrong' + (m.q ? sign(m.q) + ' × wrong²' : '') + (m.clamp ? ', kept within ' + m.clamp.join('–') : '');
}
const api={SCORE_MODELS,modelsFor,runModel,scoreAtPct,describeModel};
root.TAScoreModels=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof self!=='undefined'?self:globalThis);

/* ThunderUSMLE Analysis — pure compute (draft).
   Input: the simulator's own catalog + progress bundles (+ optional ThunderShadow logs). Nothing is typed in by hand
   except the test date and target. Works in the browser (window.ThunderAnalysis) and in Node (module.exports).
   compute({ catalog:{forms}, progress:{ [formId]: {attempts:[...]} }, shadow:{}, prefs:{examDate,target,scope}, now }) */
(function (root) {
  'use strict';
  const SM = root.TAScoreModels || (typeof require === 'function' ? require('./score-models.js') : null);

  // ThunderTracker's 17 systems (same names), plus Pharmacology & other.
  const SYSTEMS = [
    ['cardio', 'Cardiovascular'], ['resp', 'Pulmonary & Critical Care'], ['gi', 'Gastrointestinal & Hepatology'],
    ['renal', 'Renal, Urology & Electrolytes'], ['endo', 'Endocrine & Diabetes'], ['heme', 'Hematology & Oncology'],
    ['id', 'Infectious Disease'], ['immuno', 'Immunology, Allergy & Dermatology'], ['rheum', 'Rheumatology & Musculoskeletal'],
    ['neuro', 'Neurology, Ophthalmology & ENT'], ['psych', 'Psychiatry & Behavioral'], ['repro', 'Reproductive: OB, Gyn & Male'],
    ['peds', 'Pediatrics & Genetics'], ['surg', 'Surgery & Trauma'], ['emtox', 'Emergency Medicine & Toxicology'],
    ['biostat', 'Biostatistics & Epidemiology'], ['ethics', 'Ethics, Communication & Patient Safety'], ['other', 'Pharmacology & other'],
  ].map(([id, name]) => ({ id, name }));
  const PART = {
    cardiology: 'cardio', pulmonology: 'resp', gastroenterology: 'gi', hepatology: 'gi', nephrology: 'renal', urology: 'renal',
    endocrinology: 'endo', hematology: 'heme', oncology: 'heme', 'infectious disease': 'id', immunology: 'immuno', dermatology: 'immuno',
    allergy: 'immuno', rheumatology: 'rheum', musculoskeletal: 'rheum', orthopedics: 'rheum', neurology: 'neuro', ophthalmology: 'neuro',
    otolaryngology: 'neuro', psychiatry: 'psych', obstetrics: 'repro', gynecology: 'repro', pediatrics: 'peds', neonatology: 'peds',
    genetics: 'peds', 'general surgery': 'surg', surgery: 'surg', trauma: 'surg', emergency: 'emtox', 'critical care': 'emtox',
    toxicology: 'emtox', biostatistics: 'biostat', epidemiology: 'biostat', 'preventive medicine': 'biostat', ethics: 'ethics',
    'social sciences': 'ethics', pharmacology: 'other', nutrition: 'other', 'internal medicine': 'other',
  };
  const SKIP_PART = new Set(['geriatrics']);
  function systemOf(subject) {
    const s = String(subject || '').trim().toLowerCase();
    if (!s || s === 'generated/inferred') return null; // unclassified
    for (const p of s.split('/').map((x) => x.trim())) { if (SKIP_PART.has(p)) continue; if (PART[p]) return PART[p]; }
    return 'other';
  }

  const CMS = [['IM', 'Internal Medicine'], ['Surg', 'Surgery'], ['Peds', 'Pediatrics'], ['OBGyn', 'OB/GYN'], ['Psych', 'Psychiatry'],
    ['Neuro', 'Neurology'], ['FM', 'Family Medicine'], ['EM', 'Emergency Medicine']].map(([key, name]) => ({ key, name }));
  function kindOf(id) {
    let m;
    if ((m = /^N-?0*(\d{1,2})$/i.exec(id))) return { kind: 'nbme', n: +m[1], name: 'NBME ' + +m[1], short: 'N' + +m[1], model: 'nbme-' + +m[1] };
    if ((m = /^UWSA-?0*(\d)$/i.exec(id))) return { kind: 'uwsa', n: +m[1], name: 'UWSA ' + m[1], short: 'U' + m[1], model: 'uwsa-' + m[1] };
    if ((m = /^F120-?(20\d\d)$/i.exec(id))) return { kind: 'f120', n: +m[1], name: 'Free 120 (' + m[1] + ')', short: 'F' + m[1].slice(2), model: 'f120-' + m[1] };
    if ((m = /^C-([A-Za-z]+)-0*(\d{1,2})$/.exec(id))) {
      const s = CMS.find((x) => x.key.toLowerCase() === m[1].toLowerCase());
      if (s) return { kind: 'cms', subj: s.key, n: +m[2], name: s.name + ' ' + +m[2], short: s.key + ' ' + +m[2] };
    }
    return { kind: 'other', name: id, short: id };
  }
  const ASSESS = new Set(['nbme', 'uwsa', 'f120']);

  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const avg = (a) => (a.length ? sum(a) / a.length : null);
  const pct = (c, n) => (n ? (c / n) * 100 : null);
  const dayKey = (iso) => { const d = new Date(iso); if (isNaN(d)) return ''; return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
  const dayNum = (k) => Math.round(Date.parse(k + 'T00:00:00Z') / 864e5);

  // Graded answers of one session, joined to the catalog's current subject/topic by QID.
  function gradedAnswers(ses, qmap, formId, attemptKind) {
    const out = [];
    for (const r of (ses.results || []).filter(Boolean)) {
      const b = (ses.blocks || [])[r.blockIndex - 1] || {};
      (r.answers || []).forEach((a, i) => {
        if (!a) return;
        const qid = b.questionQids ? b.questionQids[(a.item || i + 1) - 1] : null;
        const meta = (qid != null && qmap[qid]) || {};
        const subject = meta.subject || a.subject;
        out.push({ formId, attemptKind, block: r.blockIndex, item: a.item, pos: (a.item || i + 1), blockSize: r.total,
          ok: !!a.isCorrect, answered: 'answered' in a ? a.answered !== false : a.chosen != null, flagged: !!a.flagged, t: Number(a.t != null ? a.t : a.questionTimeSeconds) || 0,
          changed: !!a.changed, firstRight: a.firstRight, subject, topic: meta.topic || a.topic, sys: systemOf(subject),
          day: dayKey(r.completedAt) });
      });
    }
    return out;
  }

  function compute(input) {
    const now = input.now ? new Date(input.now) : new Date();
    const today = dayKey(now.toISOString());
    const prefs = input.prefs || {};
    const scope = prefs.scope === 'all' ? 'all' : 'first';
    const forms = [], answers = [];

    for (const f of (input.catalog && input.catalog.forms) || []) {
      const k = kindOf(f.id);
      const doc = (input.progress || {})[f.id];
      const qmap = {};
      (f.questionIndex || []).forEach((q) => { if (q.qid != null) qmap[q.qid] = q; });
      const rec = Object.assign({ id: f.id, title: f.displayName || f.id, total: f.totalQuestions || 0, status: 'new',
        answered: 0, graded: 0, correct: 0, pct: null, score: null, scoreEst: false, scoreSaved: null, date: '', retakes: [], marked: 0, secPerQ: null }, k);
      const atts = doc ? (doc.attempts || []).filter((a) => a && a.session) : [];
      const first = atts.find((a) => a.type === 'initial') || atts[0];
      if (first) {
        const ses = first.session;
        const g = gradedAnswers(ses, qmap, f.id, 'first');
        const blocks = (ses.blocks || []).filter(Boolean);
        const resN = (ses.results || []).filter(Boolean).length;
        const done = !!(first.completedAt || ses.completedAt) || (blocks.length > 0 && resN >= blocks.length);
        const open = blocks.filter((b, i) => !(ses.results || []).some((r) => r && r.blockIndex === i + 1));
        rec.answered = g.filter((a) => a.answered).length + sum(open.map((b) => (typeof b.answered === 'number' ? b.answered : (b.answers || []).filter((x) => x != null && x !== '').length)));
        rec.graded = g.length; rec.correct = g.filter((a) => a.ok).length; rec.pct = pct(rec.correct, rec.graded);
        rec.marked = g.filter((a) => a.flagged).length;
        rec.secPerQ = avg(g.map((a) => a.t).filter((t) => t > 0));
        rec.status = done && g.some((a) => a.answered) ? 'done' : rec.answered > 0 ? 'progress' : 'new';
        rec.progressPct = rec.total ? Math.min(100, (rec.answered / rec.total) * 100) : 0;
        const last = (ses.results || []).filter(Boolean).map((r) => r.completedAt).filter(Boolean).sort().pop() || ses.completedAt || first.completedAt || ses.updatedAt;
        rec.date = dayKey(last || '');
        rec.updated = ses.updatedAt || last || '';
        rec.wrong = rec.graded - rec.correct;
        g.forEach((a) => { if (a.answered) answers.push(a); }); // unanswered (block ended early) stay out of the analysis; the form % keeps them, like the app's score
        for (const a of atts) {
          if (a === first) continue;
          const rg = gradedAnswers(a.session, qmap, f.id, 'retake');
          if (!rg.length) continue;
          rec.retakes.push({ label: a.label, pct: pct(rg.filter((x) => x.ok).length, rg.length), n: rg.length, date: dayKey((a.session.results || []).filter(Boolean).map((r) => r.completedAt).filter(Boolean).sort().pop() || '') });
          if (scope === 'all') rg.forEach((x) => { if (x.answered) answers.push(x); });
        }
      }
      // 3-digit score: the one saved on the form, else an unofficial estimate (ThunderTracker's conversions) from first-attempt %.
      const saved = Number(f.threeDigitScore);
      if (saved >= 1 && saved <= 300) { rec.score = Math.round(saved); rec.scoreSaved = rec.score; }
      else if (rec.status === 'done' && k.model && rec.pct != null && SM && SM.modelsFor(k.model).length) {
        const r = SM.scoreAtPct(SM.modelsFor(k.model)[0], rec.pct, rec.graded);
        if (r && r.score) { rec.score = r.score; rec.scoreEst = true; }
      }
      forms.push(rec);
    }

    const graded = answers;
    const totals = { answered: sum(forms.map((f) => f.answered)), graded: graded.length, correct: graded.filter((a) => a.ok).length };
    totals.pct = pct(totals.correct, totals.graded);
    const cut30 = dayNum(today) - 30;
    const recent = graded.filter((a) => a.day && dayNum(a.day) > cut30);
    totals.pct30 = pct(recent.filter((a) => a.ok).length, recent.length); totals.n30 = recent.length;

    // ---- assessments + outlook (first attempts only, like ThunderTracker)
    const done = forms.filter((f) => f.status === 'done').sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.id.localeCompare(b.id, undefined, { numeric: true }));
    const trend = done.filter((f) => ASSESS.has(f.kind)).map((f) => ({ id: f.id, name: f.name, short: f.short, kind: f.kind, date: f.date, pct: f.pct, score: f.score, est: f.scoreEst }));
    const scored = trend.filter((p) => p.score != null);
    const outlook = { latest: scored[scored.length - 1] || null, best: scored.length ? Math.max(...scored.map((p) => p.score)) : null,
      recent: avg(scored.slice(-3).map((p) => p.score)), slope: null, proj: null, n: scored.length };
    const dated = scored.filter((p) => p.date);
    if (dated.length >= 3) {
      const xs = dated.map((p) => dayNum(p.date)), ys = dated.map((p) => p.score), mx = avg(xs), my = avg(ys);
      let sxx = 0, sxy = 0; xs.forEach((x, i) => { sxx += (x - mx) ** 2; sxy += (x - mx) * (ys[i] - my); });
      if (sxx > 0 && Math.max(...xs) - Math.min(...xs) >= 7) {
        outlook.slope = sxy / sxx; outlook.fit = { mx, my };
        if (prefs.examDate && dayNum(prefs.examDate) >= dayNum(today)) {
          const raw = my + outlook.slope * (dayNum(prefs.examDate) - mx);
          outlook.proj = Math.max(Math.min(...ys) - 15, Math.min(raw, outlook.best + 15, 300));
        }
      }
    }
    const daysLeft = prefs.examDate ? dayNum(prefs.examDate) - dayNum(today) : null;

    // ---- systems
    const sysAgg = {};
    SYSTEMS.forEach((s) => (sysAgg[s.id] = { id: s.id, name: s.name, n: 0, c: 0, t: [], recentN: 0, recentC: 0, topics: {} }));
    const lastForms = new Set(done.slice(-3).map((f) => f.id));
    let unclassified = 0;
    for (const a of graded) {
      if (!a.sys) { unclassified++; continue; }
      const s = sysAgg[a.sys]; s.n++; if (a.ok) s.c++; if (a.t) s.t.push(a.t);
      if (lastForms.has(a.formId)) { s.recentN++; if (a.ok) s.recentC++; }
    }
    const systems = Object.values(sysAgg).map((s) => ({ id: s.id, name: s.name, n: s.n, c: s.c, wrong: s.n - s.c, pct: pct(s.c, s.n),
      recentPct: s.recentN >= 5 ? pct(s.recentC, s.recentN) : null, secPerQ: avg(s.t) })).filter((s) => s.n > 0);

    // Weakness matrix: system × completed form (oldest → newest). Cell = % correct; compared with your own average.
    const cols = done.filter((f) => f.graded >= 20).map((f) => ({ id: f.id, short: f.short, name: f.name, date: f.date, kind: f.kind }));
    const cell = {};
    for (const a of graded) {
      if (!a.sys || a.attemptKind !== 'first') continue;
      const key = a.sys + '|' + a.formId; const c = cell[key] || (cell[key] = { n: 0, c: 0 }); c.n++; if (a.ok) c.c++;
    }
    const matrix = { cols, rows: systems.map((s) => ({ id: s.id, name: s.name, cells: cols.map((col) => cell[s.id + '|' + col.id] || null) })),
      base: totals.pct };
    matrix.rows.forEach((r) => { r.weakCount = r.cells.filter((c) => c && c.n >= 3 && pct(c.c, c.n) < matrix.base - 10).length; });

    // Weakest topics (at least 2 questions, ranked by wrong answers then accuracy)
    const tAgg = {};
    for (const a of graded) {
      if (!a.topic) continue;
      const key = String(a.topic).trim().toLowerCase(); const t = tAgg[key] || (tAgg[key] = { topic: String(a.topic).trim(), sys: a.sys, n: 0, c: 0, forms: new Set() });
      t.n++; if (a.ok) t.c++; t.forms.add(a.formId);
    }
    const topics = Object.values(tAgg).filter((t) => t.n >= 2 && t.n - t.c >= 1)
      .map((t) => ({ topic: t.topic, sys: t.sys, n: t.n, wrong: t.n - t.c, pct: pct(t.c, t.n), forms: [...t.forms] }))
      .sort((a, b) => b.wrong - a.wrong || a.pct - b.pct);

    // ---- test-taking behaviour
    const buckets = [['< 45 s', 0, 45], ['45–90 s', 45, 90], ['90–135 s', 90, 135], ['> 135 s', 135, 1e9]].map(([label, lo, hi]) => {
      const xs = graded.filter((a) => a.t > 0 && a.t >= lo && a.t < hi); return { label, n: xs.length, c: xs.filter((a) => a.ok).length, pct: pct(xs.filter((a) => a.ok).length, xs.length) };
    });
    const timed = graded.filter((a) => a.t > 0);
    const marked = graded.filter((a) => a.flagged), unmarked = graded.filter((a) => !a.flagged);
    // Answer changes come from the block change log only (the older saved "changed" flag is unreliable).
    const changes = { n: 0, wr: 0, rw: 0, ww: 0, forms: 0 };
    for (const f of forms) {
      const doc = (input.progress || {})[f.id]; const att = doc && (doc.attempts || []).find((a) => a && a.session && a.type === 'initial');
      if (!att) continue; let any = false;
      (att.session.blocks || []).forEach((b) => {
        const by = {}; ((b && (b.changes || b.answerChangeLog)) || []).forEach((e) => { (by[e.item] || (by[e.item] = [])).push(e); });
        for (const list of Object.values(by)) {
          list.sort((x, y) => String(x.at).localeCompare(String(y.at)));
          const orig = list[0].from, fin = list[list.length - 1].to, cor = list[list.length - 1].correct;
          if (orig == null || fin == null || orig === fin) continue;
          any = true; changes.n++;
          if (orig !== cor && fin === cor) changes.wr++; else if (orig === cor && fin !== cor) changes.rw++; else changes.ww++;
        }
      });
      if (any) changes.forms++;
    }
    changes.net = changes.wr - changes.rw;
    // Stamina: accuracy by block number within full assessments (first attempts)
    const stamina = [];
    for (const a of graded) {
      if (a.attemptKind !== 'first') continue;
      const f = forms.find((x) => x.id === a.formId);
      if (!f || !ASSESS.has(f.kind)) continue;
      const s = stamina[a.block - 1] || (stamina[a.block - 1] = { block: a.block, n: 0, c: 0 }); s.n++; if (a.ok) s.c++;
    }
    const behaviour = {
      secPerQ: avg(timed.map((a) => a.t)), over90: pct(timed.filter((a) => a.t > 90).length, timed.length), buckets,
      marked: { n: marked.length, pct: pct(marked.filter((a) => a.ok).length, marked.length) },
      unmarked: { n: unmarked.length, pct: pct(unmarked.filter((a) => a.ok).length, unmarked.length) },
      changes, stamina: stamina.filter(Boolean).map((s) => ({ block: s.block, n: s.n, pct: pct(s.c, s.n) })),
    };

    // ---- activity (questions per day, last 20 weeks + planned test day)
    const byDay = {};
    for (const a of graded) { if (!a.day) continue; const d = byDay[a.day] || (byDay[a.day] = { q: 0, c: 0, forms: new Set() }); d.q++; if (a.ok) d.c++; d.forms.add(a.formId); }
    const activity = Object.entries(byDay).map(([day, d]) => ({ day, q: d.q, pct: pct(d.c, d.q), forms: [...d.forms] })).sort((a, b) => a.day.localeCompare(b.day));
    const activeDays = new Set(activity.map((d) => d.day));
    let streak = 0; for (let d = dayNum(today); ; d--) { const k = new Date(d * 864e5).toISOString().slice(0, 10); if (activeDays.has(k)) streak++; else if (d === dayNum(today)) continue; else break; }
    const last7 = sum(activity.filter((d) => dayNum(d.day) > dayNum(today) - 7).map((d) => d.q));

    // ---- library coverage
    const assess = ['nbme', 'uwsa', 'f120'].map((kind) => ({ kind, forms: forms.filter((f) => f.kind === kind).sort((a, b) => a.n - b.n) }));
    const cms = CMS.map((s) => {
      const fs = forms.filter((f) => f.kind === 'cms' && f.subj === s.key).sort((a, b) => a.n - b.n);
      const d = fs.filter((f) => f.status === 'done');
      return { key: s.key, name: s.name, total: fs.length, done: d.length, progress: fs.filter((f) => f.status === 'progress').length,
        pct: pct(sum(d.map((f) => f.correct)), sum(d.map((f) => f.graded))), forms: fs };
    }).filter((s) => s.total);

    // ---- up next (all automatic)
    const next = [];
    const inProg = forms.filter((f) => f.status === 'progress').sort((a, b) => (b.updated || '').localeCompare(a.updated || ''));
    inProg.slice(0, 2).forEach((f) => next.push({ type: 'resume', formId: f.id, title: 'Resume ' + f.name, sub: Math.round(f.progressPct) + '% done · ' + f.answered + ' of ' + f.total + ' answered' }));
    const untakenN = forms.filter((f) => f.kind === 'nbme' && f.status === 'new').sort((a, b) => a.n - b.n);
    const untakenF = forms.filter((f) => f.kind === 'f120' && f.status === 'new').sort((a, b) => b.n - a.n);
    const nextA = daysLeft != null && daysLeft <= 10 && untakenF.length ? untakenF[0] : untakenN[0] || forms.find((f) => f.kind === 'uwsa' && f.status === 'new');
    if (nextA) next.push({ type: 'start', formId: nextA.id, title: 'Take ' + nextA.name, sub: untakenN.length + ' NBME' + (untakenN.length === 1 ? '' : 's') + ' left' + (daysLeft > 0 ? ' · ' + (untakenN.length / Math.max(1, daysLeft / 7)).toFixed(1) + ' per week to finish' : '') });
    const lastDone = done[done.length - 1];
    if (lastDone && lastDone.wrong > 0 && !lastDone.retakes.length) next.push({ type: 'retest', formId: lastDone.id, title: 'Retest the wrongs of ' + lastDone.name, sub: lastDone.wrong + ' wrong · ' + lastDone.marked + ' marked' });
    const weakSys = systems.filter((s) => s.n >= 15 && s.id !== 'other').sort((a, b) => a.pct - b.pct)[0];
    if (weakSys) next.push({ type: 'focus', sys: weakSys.id, title: 'Focus on ' + weakSys.name, sub: Math.round(weakSys.pct) + '% over ' + weakSys.n + ' questions · ' + Math.round(totals.pct - weakSys.pct) + ' points under your average' });
    const cmsGap = cms.filter((s) => s.total - s.done > 0).sort((a, b) => a.done / a.total - b.done / b.total)[0];
    if (cmsGap) next.push({ type: 'cms', subj: cmsGap.key, title: 'Next CMS: ' + cmsGap.name, sub: cmsGap.done + ' of ' + cmsGap.total + ' done' });

    // ---- ThunderShadow (why you miss), only when logs exist
    let shadow = null;
    const logs = Object.values(input.shadow || {});
    if (logs.length) {
      const codes = {}, pats = {}; let n = 0;
      for (const doc of logs) for (const b of Object.values(doc.buckets || {})) for (const e of Object.values((b && b.entries) || {})) {
        if (!e || !(e.errorCode || e.pattern || String(e.note || '').trim() || (e.speedFlags || []).length)) continue; n++; if (e.errorCode) codes[e.errorCode] = (codes[e.errorCode] || 0) + 1; if (e.pattern) pats[e.pattern] = (pats[e.pattern] || 0) + 1;
      }
      shadow = { n, codes, pats };
    }

    return { builtFor: today, scope, prefs, daysLeft, totals, forms, done, trend, outlook, systems, matrix, topics, unclassified,
      behaviour, activity, streak, last7, assess, cms, next, shadow };
  }

  // Score converter: the forms with a built-in conversion, and the unofficial 3-digit score for a % correct.
  function convertible() {
    return SM ? Object.keys(SM.SCORE_MODELS).map((key) => {
      const m = /^(nbme|uwsa|f120)-(\d+)$/.exec(key); if (!m) return null;
      return { key, kind: m[1], n: +m[2], name: m[1] === 'nbme' ? 'NBME ' + m[2] : m[1] === 'uwsa' ? 'UWSA ' + m[2] : 'Free 120 (' + m[2] + ')' };
    }).filter(Boolean) : [];
  }
  function convert(key, p) {
    if (!SM || !SM.modelsFor(key).length || !(p >= 0 && p <= 100)) return null;
    return SM.scoreAtPct(SM.modelsFor(key)[0], p, SM.SCORE_MODELS[key].qs); // { score } or { error, range: [lo, hi] % }
  }
  const scoreOk = (v) => v === '' || (/^\d{3}$/.test(v) && +v <= 300); // same rule as the Library's "Set 3-digit score"

  const api = { compute, systemOf, kindOf, convertible, convert, scoreOk, SYSTEMS, CMS };
  root.ThunderAnalysis = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis);

/* ThunderUSMLE Analysis — view (draft). Renders ThunderAnalysis.compute() output into #tuAnalysis.
   Hand-drawn SVG, sized to the real container width so text never scales. No libraries. */
(function (root) {
  'use strict';
  const A = root.ThunderAnalysis;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const r0 = (x) => (x == null ? '—' : String(Math.round(x)));
  const p1 = (x) => (x == null ? '—' : (Math.round(x * 10) / 10).toFixed(1) + '%');
  const p0 = (x) => (x == null ? '—' : Math.round(x) + '%');
  const k = (n) => (n >= 1000 ? n.toLocaleString('en-US') : String(n));
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmtD = (d) => { if (!d) return ''; const [y, m, dd] = d.split('-'); return MON[+m - 1] + ' ' + +dd; };
  const fmtDY = (d) => (d ? fmtD(d) + ', ' + d.slice(0, 4) : '');
  const dn = (d) => Math.round(Date.parse(d + 'T00:00:00Z') / 864e5);
  const band = (p) => (p == null ? '' : p >= 80 ? 'good' : p >= 65 ? 'warn' : 'bad');
  const KIND = { nbme: { label: 'NBME', shape: 'circle' }, uwsa: { label: 'UWSA', shape: 'square' }, f120: { label: 'Free 120', shape: 'diamond' } };
  const I = {
    bolt: '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M13.5 2 4 14h6.5L9 22l11-13h-7z"/></svg>',
    cal: '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M7 2h2v2h6V2h2v2h3a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3zm12 8H5v9h14zM5 6v2h14V6z"/></svg>',
    play: '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>',
    redo: '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 5V1L7 6l5 5V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7"/></svg>',
    target: '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2m0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8m0-14a6 6 0 1 0 6 6 6 6 0 0 0-6-6m0 10a4 4 0 1 1 4-4 4 4 0 0 1-4 4m0-6a2 2 0 1 0 2 2 2 2 0 0 0-2-2"/></svg>',
    book: '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M18 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2M6 4h5v8l-2.5-1.5L6 12z"/></svg>',
    down: '<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M7 10l5 5 5-5z"/></svg>',
    up: '<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M7 14l5-5 5 5z"/></svg>',
    weak: '<svg viewBox="0 0 24 24" width="12" height="12"><path fill="currentColor" d="M12 2 1 21h22zm1 15h-2v-2h2zm0-4h-2V9h2z"/></svg>',
    close: '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg>',
    pen: '<svg viewBox="0 0 24 24" width="13" height="13"><path fill="currentColor" d="M3 17.2V21h3.8l11-11-3.8-3.8zM20.7 7a1 1 0 0 0 0-1.4l-2.3-2.3a1 1 0 0 0-1.4 0l-1.8 1.8 3.8 3.8z"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>',
  };

  function mount(el, getInput, opts) {
    const st = { mode: 'score', sys: null, mx: 'assess', cv: null, edit: null };
    const actions = (opts && opts.onAction) || (() => {});
    let m = null, lastHtml = null, drawnW = 0;

    // draw(true) = background refresh: leaves the DOM (and the charts) alone when nothing would change
    function draw(ifChanged) {
      m = A.compute(getInput());
      const t = m.totals, o = m.outlook, b = m.behaviour, pr = m.prefs;
      const doneN = m.done.length, formsWithAny = m.forms.filter((f) => f.status !== 'new').length;
      if (!formsWithAny) { lastHtml = null; el.innerHTML = `<header class="ta-head"><div class="ta-title"><h1>Analysis</h1><p>Your scores, weak systems and habits, built automatically from your forms.</p></div></header><article class="ta-card ta-empty-card"><h2>Nothing to analyse yet</h2><p>Answer questions in any form from the Library. This page fills in by itself: no logging needed.</p></article>`; return; }
      const html = `
<header class="ta-head">
  <div class="ta-title"><h1>Analysis</h1><p>Built automatically from your forms · ${doneN} completed · ${k(t.graded)} questions graded</p></div>
  <div class="ta-tools">
    <div class="ta-seg" role="group" aria-label="Which attempts count">
      <button type="button" data-a="scope" data-v="first" aria-pressed="${m.scope === 'first'}">First attempts</button>
      <button type="button" data-a="scope" data-v="all" aria-pressed="${m.scope === 'all'}">Include retests</button>
    </div>
    <button type="button" class="ta-chip" data-a="exam">${I.cal}<span>${pr.examDate ? 'Test ' + fmtD(pr.examDate) + (pr.target ? ' · target ' + pr.target : '') : 'Set test date'}</span></button>
  </div>
</header>
<div class="ta-pop" id="taExamPop" hidden>
  <label>Test date<input type="date" id="taExamDate" value="${esc(pr.examDate || '')}"></label>
  <label>Target score<input type="number" id="taTarget" min="194" max="300" step="1" value="${esc(pr.target || '')}" placeholder="250"></label>
  <div class="ta-pop-a"><button type="button" class="ta-btn quiet" data-a="exam-cancel">Cancel</button><button type="button" class="ta-btn" data-a="exam-save">Save</button></div>
</div>

<section class="ta-kpis">
  ${tile('Score outlook', o.proj != null ? r0(o.proj) : o.recent != null ? r0(o.recent) : '—',
    o.proj != null ? 'projected for test day' : o.recent != null ? 'average of last ' + Math.min(3, o.n) : 'no scored forms yet',
    o.latest ? 'Latest ' + o.latest.score + (o.latest.est ? ' (est.)' : '') + ' · best ' + o.best + (o.slope != null ? ' · ' + (o.slope >= 0 ? '+' : '−') + Math.abs(o.slope * 7).toFixed(1) + '/week' : '') : '',
    o.proj != null && pr.target ? (o.proj >= pr.target ? 'good' : o.proj >= pr.target - 10 ? 'warn' : 'bad') : '')}
  ${tile('Test day', m.daysLeft == null ? '—' : m.daysLeft > 0 ? String(m.daysLeft) : m.daysLeft === 0 ? 'Today' : 'Done',
    m.daysLeft == null ? '' : m.daysLeft > 0 ? 'days to go' : '', pr.examDate ? fmtDY(pr.examDate) + (m.daysLeft > 13 ? ' · ' + Math.floor(m.daysLeft / 7) + ' weeks' : '') : '<button type="button" class="ta-link" data-a="exam">Set your test date</button>')}
  ${tile('Accuracy', p1(t.pct), 'correct overall', t.pct30 != null ? 'Last 30 days ' + p1(t.pct30) + ' ' + delta(t.pct30 - t.pct) : 'Nothing in the last 30 days', band(t.pct))}
  ${tile('Questions', k(t.graded), 'graded', formsWithAny + ' forms touched · ' + m.activity.length + ' study days' + (m.last7 ? ' · ' + m.last7 + ' this week' : ''))}
  ${tile('Pace', b.secPerQ != null ? r0(b.secPerQ) + ' s' : '—', 'per question', b.over90 != null ? p0(b.over90) + ' took longer than 90 s' : '', b.secPerQ != null ? (b.secPerQ <= 90 ? 'good' : 'warn') : '')}
  ${tile('Answer changes', b.changes.n ? (b.changes.net >= 0 ? '+' : '−') + Math.abs(b.changes.net) : '—', 'net points', b.changes.n ? b.changes.wr + ' wrong→right · ' + b.changes.rw + ' right→wrong' : 'Logged on new attempts', b.changes.n ? (b.changes.net >= 0 ? 'good' : 'bad') : '')}
</section>

<section class="ta-grid">
  <article class="ta-card s8" id="taTrendCard">
    <div class="ta-ch"><div><h2>Score trend</h2><p>NBME, UWSA and Free 120, first attempts${m.trend.some((p) => p.est) ? ' · ≈ = estimated from % correct (unofficial)' : ''}</p></div>
      <div class="ta-seg sm" role="group" aria-label="Trend measure"><button type="button" data-a="mode" data-v="score" aria-pressed="${st.mode === 'score'}">3-digit</button><button type="button" data-a="mode" data-v="pct" aria-pressed="${st.mode === 'pct'}">% correct</button></div></div>
    <div class="ta-legend">${['nbme', 'uwsa', 'f120'].filter((kk) => m.trend.some((p) => p.kind === kk)).map((kk) => `<span><svg width="12" height="12">${mark(KIND[kk].shape, 6, 6, 4.5, 'var(--ta-' + kk + ')')}</svg>${KIND[kk].label}</span>`).join('')}
      ${st.mode === 'score' ? '<span><i class="ta-dash pass"></i>Passing 218</span>' + (pr.target ? '<span><i class="ta-dash tgt"></i>Target ' + esc(pr.target) + '</span>' : '') + (o.proj != null ? '<span><i class="ta-dash proj"></i>Projection</span>' : '') : ''}</div>
    <div class="ta-plot" id="taTrend"></div>
  </article>

  <article class="ta-card s4">
    <div class="ta-ch"><div><h2>Up next</h2><p>Picked from your progress</p></div></div>
    <ul class="ta-next">${m.next.map((n) => `<li><button type="button" data-a="next" data-type="${n.type}" data-id="${esc(n.formId || n.sys || n.subj || '')}">
      <span class="ta-ni ${n.type}">${{ resume: I.play, start: I.bolt, retest: I.redo, focus: I.target, cms: I.book }[n.type]}</span>
      <span class="ta-nt"><b>${esc(n.title)}</b><small>${esc(n.sub)}</small></span></button></li>`).join('') || '<li class="ta-empty">Nothing waiting. Start a form from Home.</li>'}</ul>
  </article>

  <article class="ta-card s5">
    <div class="ta-ch"><div><h2>Systems</h2><p>% correct by system · line = your average (${p0(t.pct)})${m.unclassified ? ' · ' + m.unclassified + ' questions have no subject tag' : ''}</p></div></div>
    <div class="ta-sys" id="taSys"></div>
  </article>

  <article class="ta-card s7">
    <div class="ta-ch"><div><h2>Weak spots across forms</h2><p>Each square is one system in one form, compared with your average. Tap a system to see its topics.</p></div>
      <div class="ta-seg sm" role="group" aria-label="Which forms"><button type="button" data-a="mx" data-v="assess" aria-pressed="${st.mx === 'assess'}">Assessments</button><button type="button" data-a="mx" data-v="cms" aria-pressed="${st.mx === 'cms'}">CMS</button><button type="button" data-a="mx" data-v="all" aria-pressed="${st.mx === 'all'}">All</button></div></div>
    <div class="ta-mx-legend"><span>Below your average</span><i class="d-3"></i><i class="d-2"></i><i class="d-1"></i><i class="d0"></i><i class="d1"></i><i class="d2"></i><span>Above</span><span class="ta-mx-few"><i class="few"></i>fewer than 3 questions</span></div>
    <div class="ta-mx" id="taMx"></div>
  </article>

  <article class="ta-card s6">
    <div class="ta-ch"><div><h2>Self-assessments</h2><p>${m.assess.map((g) => g.forms.filter((f) => f.status === 'done').length + '/' + g.forms.length + ' ' + KIND[g.kind].label).join(' · ')}</p></div></div>
    <div class="ta-assess">${m.assess.filter((g) => g.forms.length).map((g) => `<div class="ta-ag"><h3>${KIND[g.kind].label}</h3><div class="ta-chips">${g.forms.map(formChip).join('')}</div></div>`).join('')}</div>
    ${converter()}
  </article>

  <article class="ta-card s6">
    <div class="ta-ch"><div><h2>CMS forms</h2><p>${m.cms.reduce((a, s) => a + s.done, 0)} of ${m.cms.reduce((a, s) => a + s.total, 0)} done · % correct per subject</p></div></div>
    <div class="ta-cms">${m.cms.map(cmsRow).join('')}</div>
  </article>

  <article class="ta-card s4">
    <div class="ta-ch"><div><h2>Time vs accuracy</h2><p>% correct by time spent on the question</p></div></div>
    <div class="ta-plot" id="taTime"></div>
  </article>
  <article class="ta-card s4">
    <div class="ta-ch"><div><h2>Stamina</h2><p>% correct by block number in full assessments</p></div></div>
    <div class="ta-plot" id="taStam"></div>
  </article>
  <article class="ta-card s4">
    <div class="ta-ch"><div><h2>Habits</h2><p>Marking and changing answers</p></div></div>
    <div class="ta-habits">
      ${habit('Marked questions', b.marked.pct, b.marked.n, 'Unmarked ' + p0(b.unmarked.pct))}
      ${b.changes.n ? `<div class="ta-chg"><div class="ta-chg-bar" role="img" aria-label="${b.changes.wr} wrong to right, ${b.changes.rw} right to wrong, ${b.changes.ww} wrong to wrong">
        <i class="wr" style="flex:${b.changes.wr}"></i><i class="rw" style="flex:${b.changes.rw}"></i><i class="ww" style="flex:${b.changes.ww}"></i></div>
        <div class="ta-chg-l"><span><i class="wr"></i>Wrong → right <b>${b.changes.wr}</b></span><span><i class="rw"></i>Right → wrong <b>${b.changes.rw}</b></span><span><i class="ww"></i>Wrong → wrong <b>${b.changes.ww}</b></span></div>
        <p class="ta-note">${b.changes.wr >= b.changes.rw * 2 ? 'Your changes help: keep changing when you find a real reason.' : b.changes.rw > b.changes.wr ? 'Changes cost you points: stay with your first answer unless you misread.' : 'Changes roughly break even.'} From the change log of ${b.changes.forms} forms.</p></div>` : '<p class="ta-note">Answer changes are logged on new attempts.</p>'}
    </div>
  </article>

  <article class="ta-card s6" id="taTopicsCard">
    <div class="ta-ch"><div><h2>Topics you miss${st.sys ? ' · ' + esc((m.systems.find((s) => s.id === st.sys) || {}).name || '') : ''}</h2><p>From the forms you've done, most missed first</p></div>${st.sys ? `<button type="button" class="ta-btn quiet sm" data-a="sys" data-v="">${I.close}All systems</button>` : ''}</div>
    <ol class="ta-topics">${topicRows()}</ol>
  </article>

  <article class="ta-card s6">
    <div class="ta-ch"><div><h2>Activity</h2><p>Questions per day, last 20 weeks${m.streak ? ' · ' + m.streak + '-day streak' : ''}</p></div></div>
    <div class="ta-plot" id="taCal"></div>
  </article>

  ${m.shadow ? shadowCard(m.shadow) : `<article class="ta-card s12 ta-slim"><div><h2>Why you miss</h2><p>Log misses with the ThunderShadow bar in Review and the reasons show here (error type and reasoning pattern).</p></div></article>`}
</section>`;
      if (ifChanged === true && html === lastHtml && el.firstElementChild && !el.querySelector('.ta-loading')) return false;
      lastHtml = html; el.innerHTML = html; el.style.minHeight = '';
      drawCharts();
      return true;
    }
    function drawCharts() { drawTrend(); drawSys(); drawMx(); drawTime(); drawStam(); drawCal(); drawnW = el.clientWidth; }

    // ---------- pieces
    function delta(d) { if (d == null || isNaN(d)) return ''; const up = d >= 0; return `<span class="ta-delta ${up ? 'up' : 'dn'}">${up ? I.up : I.down}${Math.abs(d).toFixed(1)}</span>`; }
    function tile(label, big, small, note, tone) {
      return `<div class="ta-tile"><span class="ta-tl">${label}</span><span class="ta-big ${tone || ''}">${big}<small>${small}</small></span><span class="ta-tn">${note || ''}</span></div>`;
    }
    // Assessment score card: tap opens the form; finished forms get "Add score" (or a pencil once saved) for the real 3-digit score.
    function formChip(f) {
      const done = f.status === 'done', id = esc(f.id);
      const v = done ? (f.score != null ? (f.scoreEst ? '≈' : '') + f.score : p0(f.pct)) : f.status === 'progress' ? Math.round(f.progressPct) + '%' : '';
      const sub = done ? (f.score != null ? p0(f.pct) : '% correct') + (f.retakes.length ? ' · ↻' : '') : f.status === 'progress' ? 'in progress' : 'not taken';
      let foot = '';
      if (done && st.edit === f.id) foot = `<form class="ta-sf" data-id="${id}"><input name="s" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="3" autocomplete="off" placeholder="245" value="${f.scoreSaved || ''}" aria-label="3-digit score for ${esc(f.name)}"><button type="submit" aria-label="Save score">${I.check}</button></form>`;
      else if (done && f.scoreSaved == null) foot = `<button type="button" class="ta-add" data-a="score" data-id="${id}">${I.plus}Add score</button>`;
      else if (done) foot = `<button type="button" class="ta-sedit" data-a="score" data-id="${id}" aria-label="Edit 3-digit score for ${esc(f.name)}" title="Edit score">${I.pen}</button>`;
      return `<div class="ta-fc ${f.status}${st.edit === f.id ? ' editing' : ''}"><button type="button" class="ta-fcm" data-a="form" data-id="${id}" title="${esc(f.name)}${f.date && done ? ' · ' + fmtDY(f.date) : ''}${f.scoreEst ? ' · ≈ estimate from % correct' : ''}"><b>${f.n}</b>${v ? `<span>${v}</span>` : ''}${sub ? `<small>${sub}</small>` : ''}</button>${foot}</div>`;
    }
    // Score converter: one row, form + % correct → unofficial 3-digit. Starts on your latest finished assessment.
    function converter() {
      const list = A.convertible ? A.convertible() : []; if (!list.length) return '';
      if (!st.cv || !list.some((c) => c.key === st.cv.key)) {
        const last = [...m.done].reverse().find((f) => f.model && f.pct != null && list.some((c) => c.key === f.model));
        st.cv = { key: last ? last.model : list[0].key, pct: last ? String(Math.round(last.pct * 10) / 10) : '' };
      }
      const opts = [['nbme', 'NBME'], ['uwsa', 'UWSA'], ['f120', 'Free 120']].map(([kd, l]) => {
        const xs = list.filter((c) => c.kind === kd);
        return xs.length ? `<optgroup label="${l}">${xs.map((c) => `<option value="${c.key}"${c.key === st.cv.key ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</optgroup>` : '';
      }).join('');
      return `<div class="ta-conv"><span class="ta-cvl">Convert</span><select id="taCvForm" aria-label="Form to convert">${opts}</select><label class="ta-cvp"><input id="taCvPct" type="number" inputmode="decimal" min="0" max="100" step="0.1" value="${esc(st.cv.pct)}" placeholder="75" aria-label="% correct"><span>%</span></label><output id="taCvOut" class="ta-cvo" for="taCvForm taCvPct">${cvOut()}</output></div>`;
    }
    function cvOut() {
      const p = parseFloat(st.cv.pct);
      if (isNaN(p)) return '<b class="mut">—</b><small>3-digit</small>';
      const r = A.convert(st.cv.key, p);
      if (!r || r.error) return `<b class="mut">—</b><small>${r && r.range ? 'only ' + r.range.map((x) => Math.round(x)).join('–') + '%' : 'no conversion'}</small>`;
      return `<b>${r.score}</b><small>3-digit</small>`;
    }
    function openScore(id) { st.edit = id; draw(); const i = el.querySelector('.ta-sf input'); if (i) { i.focus(); i.select(); } }
    function saveScore(form) {
      const i = form.querySelector('input'), v = i.value.trim();
      if (!A.scoreOk(v)) { form.classList.remove('bad'); void form.offsetWidth; form.classList.add('bad'); i.focus(); return; }
      form.classList.add('busy');
      Promise.resolve(actions({ type: 'score', id: form.dataset.id, value: v })).then(() => { st.edit = null; draw(); },
        () => { form.classList.remove('busy'); form.classList.add('bad'); i.focus(); });
    }
    function cmsRow(s) {
      const segs = s.forms.map((f) => `<i class="${f.status}" title="${esc(f.name)}${f.status === 'done' ? ' · ' + p0(f.pct) : f.status === 'progress' ? ' · ' + Math.round(f.progressPct) + '% done' : ''}"></i>`).join('');
      return `<div class="ta-cr"><span class="ta-cn">${esc(s.name)}</span><span class="ta-cs">${segs}</span><span class="ta-cv"><b>${s.done}/${s.total}</b>${s.pct != null ? `<span class="${band(s.pct)}">${p0(s.pct)}</span>` : '<span class="mut">—</span>'}</span></div>`;
    }
    function habit(label, p, n, note) {
      return `<div class="ta-hb"><div class="ta-hbt"><span>${label}</span><b>${p0(p)}</b></div><div class="ta-meter"><i style="width:${p || 0}%"></i></div><small>${n} questions · ${note}</small></div>`;
    }
    function topicRows() {
      const list = m.topics.filter((t) => !st.sys || t.sys === st.sys).slice(0, 8);
      if (!list.length) return '<li class="ta-empty">No repeated misses here yet.</li>';
      const sysName = (id) => (A.SYSTEMS.find((s) => s.id === id) || { name: 'Unclassified' }).name;
      return list.map((tp) => `<li><span class="ta-tp"><b>${esc(tp.topic)}</b><small>${esc(sysName(tp.sys))} · ${tp.forms.length} form${tp.forms.length === 1 ? '' : 's'}</small></span><span class="ta-tw"><b>${tp.wrong}</b> of ${tp.n} wrong</span></li>`).join('');
    }
    function shadowCard(sh) {
      const ERR = { 1: 'Careless', 2: 'Knowledge gap', 3: 'Misapplied', 4: 'Differential', 5: 'Between two', 6: 'Lucky', 7: 'Shaky' };
      const rows = Object.entries(sh.codes).sort((a, b) => b[1] - a[1]);
      const max = Math.max(1, ...rows.map((r) => r[1]));
      return `<article class="ta-card s12"><div class="ta-ch"><div><h2>Why you miss</h2><p>From ThunderShadow · ${sh.n} logged</p></div></div><div class="ta-why">${rows.map(([c, n]) => `<div class="ta-wr"><span>${esc(ERR[c] || c)}</span><span class="ta-meter"><i style="width:${(n / max) * 100}%"></i></span><b>${n}</b></div>`).join('')}</div></article>`;
    }
    function mark(shape, x, y, r, fill, extra) {
      if (shape === 'square') return `<rect x="${x - r * 0.9}" y="${y - r * 0.9}" width="${r * 1.8}" height="${r * 1.8}" rx="1.5" fill="${fill}" ${extra || ''}/>`;
      if (shape === 'diamond') return `<path d="M${x} ${y - r * 1.2}L${x + r * 1.2} ${y}L${x} ${y + r * 1.2}L${x - r * 1.2} ${y}Z" fill="${fill}" ${extra || ''}/>`;
      return `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${extra || ''}/>`;
    }
    const W = (id) => Math.max(260, Math.floor(el.querySelector('#' + id).clientWidth));

    // ---------- score trend
    function drawTrend() {
      const box = el.querySelector('#taTrend'), w = W('taTrend'), h = w < 500 ? 220 : 260, pad = { l: 40, r: 18, t: 14, b: 28 };
      const isS = st.mode === 'score', pr = m.prefs;
      const pts = m.trend.filter((p) => p.date && (isS ? p.score != null : p.pct != null)).map((p) => Object.assign({ v: isS ? p.score : p.pct }, p));
      if (!pts.length) { box.innerHTML = '<p class="ta-empty">Finish an NBME, UWSA or Free 120 to see your trend.</p>'; return; }
      const proj = isS && m.outlook.proj != null && pr.examDate ? { d: pr.examDate, v: m.outlook.proj } : null;
      let x0 = dn(pts[0].date) - 7, x1 = Math.max(dn(pts[pts.length - 1].date) + 7, proj ? dn(proj.d) + 3 : 0);
      const vals = pts.map((p) => p.v).concat(isS ? [218, Number(pr.target) || 0, proj ? proj.v : 0].filter(Boolean) : []);
      let y0 = Math.floor((Math.min(...vals) - (isS ? 8 : 5)) / (isS ? 10 : 5)) * (isS ? 10 : 5), y1 = Math.ceil((Math.max(...vals) + (isS ? 6 : 5)) / (isS ? 10 : 5)) * (isS ? 10 : 5);
      if (!isS) { y0 = Math.max(0, y0); y1 = Math.min(100, y1); }
      const X = (d) => pad.l + ((d - x0) / (x1 - x0)) * (w - pad.l - pad.r), Y = (v) => pad.t + (1 - (v - y0) / (y1 - y0)) * (h - pad.t - pad.b);
      const step = isS ? (y1 - y0 > 60 ? 20 : 10) : 10;
      let g = '';
      for (let v = Math.ceil(y0 / step) * step; v <= y1; v += step) g += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/><text x="${pad.l - 8}" y="${Y(v) + 4}" class="ax" text-anchor="end">${v}${isS ? '' : '%'}</text>`;
      // month ticks
      const sd = new Date(x0 * 864e5); let mth = new Date(Date.UTC(sd.getUTCFullYear(), sd.getUTCMonth() + 1, 1));
      const months = []; while (mth.getTime() / 864e5 <= x1) { months.push(mth.getTime() / 864e5); mth = new Date(Date.UTC(mth.getUTCFullYear(), mth.getUTCMonth() + 1, 1)); }
      const everyM = Math.ceil(months.length / Math.max(2, Math.floor((w - 60) / 70)));
      months.forEach((d, i) => { if (i % everyM) return; const dt = new Date(d * 864e5); g += `<text x="${X(d)}" y="${h - 8}" class="ax" text-anchor="middle">${MON[dt.getUTCMonth()]}</text>`; });
      if (isS) {
        g += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${Y(218)}" y2="${Y(218)}" class="ref pass"/>`;
        if (Number(pr.target)) g += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${Y(+pr.target)}" y2="${Y(+pr.target)}" class="ref tgt"/>`;
      }
      if (pr.examDate && dn(pr.examDate) <= x1) g += `<line x1="${X(dn(pr.examDate))}" x2="${X(dn(pr.examDate))}" y1="${pad.t}" y2="${h - pad.b}" class="ref day"/><text x="${X(dn(pr.examDate)) - 4}" y="${h - pad.b - 6}" class="ax" text-anchor="end">Test day</text>`;
      const line = pts.map((p, i) => (i ? 'L' : 'M') + X(dn(p.date)).toFixed(1) + ' ' + Y(p.v).toFixed(1)).join('');
      g += `<path d="${line}" class="tl"/>`;
      if (proj) { const lp = pts[pts.length - 1]; g += `<path d="M${X(dn(lp.date))} ${Y(lp.v)}L${X(dn(proj.d))} ${Y(proj.v)}" class="tl proj"/><circle cx="${X(dn(proj.d))}" cy="${Y(proj.v)}" r="5" class="projdot"/><text x="${X(dn(proj.d)) - 9}" y="${Y(proj.v) + 4}" class="lbl" text-anchor="end">${Math.round(proj.v)}</text>`; }
      pts.forEach((p, i) => {
        const x = X(dn(p.date)), y = Y(p.v);
        g += mark(KIND[p.kind].shape, x, y, 5, 'var(--ta-' + p.kind + ')', 'class="pt"');
        const above = i % 2 === 0 || y > h - pad.b - 24;
        g += `<text x="${x}" y="${above ? y - 10 : y + 18}" class="lbl" text-anchor="middle">${esc(p.short)} ${isS ? (p.est ? '≈' : '') + p.v : Math.round(p.v) + '%'}</text>`;
        g += `<rect x="${x - 14}" y="${pad.t}" width="28" height="${h - pad.t - pad.b}" fill="transparent" data-tip="${esc(p.name)}|${fmtDY(p.date)}|${p.score != null ? (p.est ? '≈' : '') + p.score + ' · ' : ''}${p1(p.pct)} correct${p.est ? '|estimate from % correct (unofficial)' : ''}"/>`;
      });
      box.innerHTML = `<svg width="${w}" height="${h}" role="img" aria-label="Score trend chart">${g}</svg>`;
    }

    // ---------- systems bars
    function drawSys() {
      const box = el.querySelector('#taSys');
      if (!m.systems.length) { box.innerHTML = '<p class="ta-empty">' + (m.unclassified ? 'Your answered questions have no subject tags, so systems can’t be worked out yet.' : 'Answer questions in any form to see your systems.') + '</p>'; return; }
      const list = m.systems.slice().sort((a, b) => (a.id === 'other') - (b.id === 'other') || a.pct - b.pct);
      const base = m.totals.pct;
      box.innerHTML = list.map((s) => {
        const weak = s.id !== 'other' && s.n >= 10 && s.pct < base - 5;
        return `<button type="button" class="ta-sr${st.sys === s.id ? ' on' : ''}${s.n < 10 ? ' few' : ''}" data-a="sys" data-v="${s.id}" data-tip="${esc(s.name)}|${s.c} of ${s.n} correct (${p1(s.pct)})${s.recentPct != null ? '|last 3 forms: ' + p0(s.recentPct) : ''}${s.secPerQ ? '|' + Math.round(s.secPerQ) + ' s per question' : ''}">
          <span class="ta-sn">${esc(s.name)}</span>
          <span class="ta-sb"><i class="${weak ? 'weak' : ''}" style="width:${s.pct}%"></i><em style="left:${base}%"></em></span>
          <span class="ta-sv">${weak ? `<span class="ta-wk" title="Below your average">${I.weak}</span>` : ''}<b>${p0(s.pct)}</b><small>${s.n}</small></span></button>`;
      }).join('');
    }

    // ---------- weakness matrix
    function drawMx() {
      const box = el.querySelector('#taMx'), full = m.matrix;
      const keep = full.cols.map((c) => (st.mx === 'all' ? true : st.mx === 'cms' ? c.kind === 'cms' : c.kind !== 'cms'));
      full.cols.forEach((c, i) => { if (!full.rows.some((r) => r.cells[i])) keep[i] = false; }); // no subject tags at all
      const untagged = full.cols.filter((c, i) => !full.rows.some((r) => r.cells[i]) && (st.mx === 'all' || (st.mx === 'cms') === (c.kind === 'cms')));
      const mx = { base: full.base, cols: full.cols.filter((c, i) => keep[i]), rows: full.rows.map((r) => ({ id: r.id, name: r.name, cells: r.cells.filter((c, i) => keep[i]) })) };
      if (!mx.cols.length) { box.innerHTML = '<p class="ta-empty">' + (untagged.length ? 'Not shown: ' + untagged.map((c) => esc(c.name)).join(', ') + ' (no subject tags in the form).' : st.mx === 'assess' ? 'Finish an NBME, UWSA or Free 120 to start the map.' : st.mx === 'cms' ? 'Finish a CMS form to start the map.' : 'Complete a form to start the map.') + '</p>'; return; }
      mx.rows.forEach((r) => { r.weakCount = r.cells.filter((c) => c && c.n >= 3 && (c.c / c.n) * 100 < mx.base - 10).length; r.any = r.cells.some(Boolean); });
      const big = mx.cols.length <= 8;
      const rows = mx.rows.filter((r) => r.any).sort((a, b) => (a.id === 'other') - (b.id === 'other') || b.weakCount - a.weakCount || a.name.localeCompare(b.name));
      const cls = (c) => {
        if (!c) return 'none'; if (c.n < 3) return 'few';
        const d = (c.c / c.n) * 100 - mx.base; return d <= -20 ? 'd-3' : d <= -10 ? 'd-2' : d <= -4 ? 'd-1' : d < 4 ? 'd0' : d < 12 ? 'd1' : 'd2';
      };
      box.innerHTML = `<div class="ta-mxw${big ? ' big' : ''}"><table><thead><tr><th></th>${mx.cols.map((c) => `<th><span class="ta-mxh ${c.kind}" title="${esc(c.name)} · ${fmtDY(c.date)}">${esc(big ? c.name : c.short)}</span></th>`).join('')}<th class="ta-mxc">Weak</th></tr></thead><tbody>
        ${rows.map((r) => `<tr class="${st.sys === r.id ? 'on' : ''}"><th><button type="button" data-a="sys" data-v="${r.id}">${esc(r.name)}</button></th>${r.cells.map((c, i) => `<td><i class="${cls(c)}" ${c ? `data-tip="${esc(r.name)}|${esc(mx.cols[i].name)}|${c.c} of ${c.n} correct (${p0((c.c / c.n) * 100)})"` : ''}>${big && c && c.n >= 3 ? Math.round((c.c / c.n) * 100) : ''}</i></td>`).join('')}<td class="ta-mxc">${r.weakCount ? `<b>${r.weakCount}</b>` : ''}</td></tr>`).join('')}
      </tbody></table></div>${untagged.length ? `<p class="ta-note">Not shown: ${untagged.map((c) => esc(c.name)).join(', ')} (no subject tags in the form).</p>` : ''}`;
    }

    // ---------- small bar charts
    function bars(id, items, label) {
      const box = el.querySelector('#' + id), w = W(id), h = 170, pad = { l: 30, r: 6, t: 18, b: 34 };
      const n = items.length; if (!n) { box.innerHTML = '<p class="ta-empty">Not enough data yet.</p>'; return; }
      const bw = Math.min(46, ((w - pad.l - pad.r) / n) * 0.62), gap = (w - pad.l - pad.r) / n;
      const Y = (v) => pad.t + (1 - v / 100) * (h - pad.t - pad.b);
      let g = '';
      [0, 50, 100].forEach((v) => (g += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/><text x="${pad.l - 6}" y="${Y(v) + 4}" class="ax" text-anchor="end">${v}</text>`));
      g += `<line x1="${pad.l}" x2="${w - pad.r}" y1="${Y(m.totals.pct)}" y2="${Y(m.totals.pct)}" class="ref avg"/>`;
      items.forEach((it, i) => {
        const x = pad.l + gap * i + (gap - bw) / 2, v = it.pct || 0, y = Y(v), bh = h - pad.b - y;
        g += `<path d="M${x} ${h - pad.b}V${y + 4}q0 -4 4 -4h${bw - 8}q4 0 4 4V${h - pad.b}Z" class="bar ${it.weak ? 'weak' : ''}"/>`;
        if (bh > 0) g += `<text x="${x + bw / 2}" y="${y - 5}" class="lbl" text-anchor="middle">${Math.round(v)}</text>`;
        g += `<text x="${x + bw / 2}" y="${h - pad.b + 15}" class="ax" text-anchor="middle">${esc(it.label)}</text>`;
        if (gap >= 40) g += `<text x="${x + bw / 2}" y="${h - pad.b + 28}" class="ax sm" text-anchor="middle">${it.n} q</text>`;
        g += `<rect x="${pad.l + gap * i}" y="${pad.t}" width="${gap}" height="${h - pad.t - pad.b}" fill="transparent" data-tip="${esc(label(it))}|${it.n} questions · ${p1(it.pct)} correct"/>`;
      });
      box.innerHTML = `<svg width="${w}" height="${h}" role="img">${g}</svg>`;
    }
    function drawTime() { bars('taTime', m.behaviour.buckets.map((b) => Object.assign({}, b, { weak: b.n >= 10 && b.pct < m.totals.pct - 5 })), (it) => it.label + ' on the question'); }
    function drawStam() { bars('taStam', m.behaviour.stamina.map((s) => ({ label: 'B' + s.block, n: s.n, pct: s.pct, weak: s.n >= 20 && s.pct < m.totals.pct - 5 })), (it) => 'Block ' + it.label.slice(1)); }

    // ---------- activity calendar
    function drawCal() {
      const box = el.querySelector('#taCal'), w = W('taCal');
      const today = dn(m.builtFor), weeks = 20, gap = 3;
      const cs = Math.max(9, Math.min(24, Math.floor((w - 28) / weeks) - gap));
      const endW = today + (6 - ((new Date(today * 864e5).getUTCDay() + 6) % 7)); // Sunday after today (Mon-first rows)
      const start = endW - weeks * 7 + 1;
      const byDay = {}; m.activity.forEach((d) => (byDay[d.day] = d));
      const max = Math.max(1, ...m.activity.map((d) => d.q));
      const lvl = (q) => (!q ? 0 : q < max * 0.2 ? 1 : q < max * 0.45 ? 2 : q < max * 0.75 ? 3 : 4);
      let g = '';
      ['M', '', 'W', '', 'F', '', ''].forEach((l, r) => l && (g += `<text x="0" y="${18 + r * (cs + gap) + cs - 2}" class="ax sm">${l}</text>`));
      let lastM = -1;
      for (let wk = 0; wk < weeks; wk++) {
        for (let r = 0; r < 7; r++) {
          const d = start + wk * 7 + r; if (d > today && !(m.prefs.examDate && d === dn(m.prefs.examDate))) continue;
          const key = new Date(d * 864e5).toISOString().slice(0, 10), a = byDay[key];
          const x = 16 + wk * (cs + gap), y = 16 + r * (cs + gap);
          if (r === 0) { const mo = new Date(d * 864e5).getUTCMonth(); if (mo !== lastM) { lastM = mo; g += `<text x="${x}" y="10" class="ax sm">${MON[mo]}</text>`; } }
          g += `<rect x="${x}" y="${y}" width="${cs}" height="${cs}" rx="3" class="cal l${a ? lvl(a.q) : 0}${d === today ? ' today' : ''}" ${a ? `data-tip="${fmtDY(key)}|${a.q} questions · ${p0(a.pct)} correct|${esc(a.forms.join(', '))}"` : `data-tip="${fmtDY(key)}|no questions"`}/>`;
        }
      }
      const h = 16 + 7 * (cs + gap) + 22;
      g += `<g transform="translate(${16},${h - 10})"><text x="0" y="0" class="ax sm">Less</text>${[0, 1, 2, 3, 4].map((l, i) => `<rect x="${30 + i * 14}" y="-9" width="10" height="10" rx="2" class="cal l${l}"/>`).join('')}<text x="${30 + 5 * 14 + 4}" y="0" class="ax sm">More</text></g>`;
      box.innerHTML = `<svg width="${Math.min(w, 16 + weeks * (cs + gap) + 4)}" height="${h}" role="img" aria-label="Activity calendar">${g}</svg>`;
    }

    // ---------- events
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-a]'); if (!b || !el.contains(b)) return;
      const a = b.dataset.a;
      if (a === 'mode') { st.mode = b.dataset.v; draw(); }
      else if (a === 'mx') { st.mx = b.dataset.v; draw(); }
      else if (a === 'scope') { actions({ type: 'prefs', prefs: { scope: b.dataset.v } }); draw(); }
      else if (a === 'sys') { st.sys = b.dataset.v && st.sys !== b.dataset.v ? b.dataset.v : null; draw(); if (st.sys) el.querySelector('#taTopicsCard').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
      else if (a === 'exam') { const p = el.querySelector('#taExamPop'); p.hidden = !p.hidden; if (!p.hidden) el.querySelector('#taExamDate').focus(); }
      else if (a === 'exam-cancel') el.querySelector('#taExamPop').hidden = true;
      else if (a === 'exam-save') { actions({ type: 'prefs', prefs: { examDate: el.querySelector('#taExamDate').value, target: Number(el.querySelector('#taTarget').value) || '' } }); draw(); }
      else if (a === 'score') openScore(b.dataset.id);
      else if (a === 'next' && b.dataset.type === 'focus') { st.sys = b.dataset.id || null; draw(); el.querySelector('#taTopicsCard').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
      else actions({ type: a, kind: b.dataset.type, id: b.dataset.id, el: b });
    });
    el.addEventListener('submit', (e) => { const f = e.target.closest('.ta-sf'); if (!f) return; e.preventDefault(); saveScore(f); });
    el.addEventListener('keydown', (e) => { if (e.key === 'Escape' && e.target.closest('.ta-sf')) { st.edit = null; draw(); } });
    el.addEventListener('input', (e) => {
      if (e.target.closest('.ta-sf')) { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 3); e.target.closest('.ta-sf').classList.remove('bad'); return; }
      if (e.target.id === 'taCvPct' || e.target.id === 'taCvForm') {
        st.cv[e.target.id === 'taCvPct' ? 'pct' : 'key'] = e.target.value;
        if (e.target.id === 'taCvForm') { const f = m.done.find((x) => x.model === e.target.value && x.pct != null); if (f) el.querySelector('#taCvPct').value = st.cv.pct = String(Math.round(f.pct * 10) / 10); }
        el.querySelector('#taCvOut').innerHTML = cvOut();
      }
    });
    // tooltip
    const tip = document.createElement('div'); tip.className = 'ta-tip'; tip.hidden = true; (el.parentNode || document.body).appendChild(tip);
    el.addEventListener('pointermove', (e) => {
      const t = e.target.closest('[data-tip]');
      if (!t) { tip.hidden = true; return; }
      const [h1, ...rest] = t.dataset.tip.split('|');
      tip.innerHTML = `<b>${h1}</b>${rest.map((x) => `<span>${x}</span>`).join('')}`; tip.hidden = false;
      const r = tip.getBoundingClientRect(); let x = e.clientX + 14, y = e.clientY + 14;
      if (x + r.width > innerWidth - 8) x = e.clientX - r.width - 14; if (y + r.height > innerHeight - 8) y = e.clientY - r.height - 14;
      tip.style.left = x + 'px'; tip.style.top = y + 'px';
    });
    el.addEventListener('pointerleave', () => (tip.hidden = true));
    let rz; new ResizeObserver(() => { clearTimeout(rz); rz = setTimeout(() => { const w = el.clientWidth; if (m && w && w !== drawnW) drawCharts(); }, 80); }).observe(el); // only a real width change (not the panel hiding/showing or the content getting taller)
    draw();
    return { redraw: (ifChanged) => draw(ifChanged) };
  }

  root.ThunderAnalysisUI = { mount };
})(typeof self !== 'undefined' ? self : globalThis);

/* ---------- App glue: Analysis sidebar tab + panel (Local and iPad, byte-identical) ----------
   Data: StepLibraryBridge.analysis() (catalog + raw progress bundles + ThunderShadow logs, read-only).
   Buttons route to existing controls: ThunderUI.formAction (legacy card Start/Resume) and ThunderUI.openForm (form sheet).
   Nothing here writes to DATA/. Test date, target and the attempts switch live in localStorage (this device only). */
(function () {
  'use strict';
  if (typeof document === 'undefined' || window.ThunderAnalysisApp) return;
  const PREFS = 'thunderAnalysis.v1';
  const byId = (id) => document.getElementById(id);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const store = { get() { try { return JSON.parse(localStorage.getItem(PREFS)) || {}; } catch (e) { return {}; } }, set(v) { try { localStorage.setItem(PREFS, JSON.stringify(v)); } catch (e) {} } };
  const ICON = '<svg class="tu-ico" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h16"/><path d="M7 16v-5"/><path d="M12 16V6"/><path d="M17 16v-8"/></svg>';
  let prefs = store.get(), data = null, ui = null, loading = null, seq = 0, lastLoad = 0;

  const A = ':root body #menu #tuAnalysis';
  const STYLE = `
:root[data-tu] body #menu[data-tu-page="tuAnalysis"] .modern-hero{display:none!important}
:root[data-tu] body #menu aside.modern-sidebar #tuAnalysisTab{order:4}
#analysisPanel.mode-panel.active{display:block}
${A}{--a-bg:var(--tu-bg,#F6F7FB);--a-surface:var(--tu-surface,#fff);--a-s1:var(--tu-s1,#EFF1F7);--a-s2:var(--tu-s2,#E7EAF3);--a-s3:var(--tu-s3,#DCE0EC);--a-line:var(--tu-line,#D3D8E5);--a-line2:var(--tu-line2,#E4E7F0);--a-on:var(--tu-on,#161A25);--a-on2:var(--tu-on2,#474E62);--a-on3:var(--tu-on3,#5F6679);--a-ok:var(--tu-ok,#17683D);--a-warn:var(--tu-warn,#7D4B00);--a-bad:var(--tu-bad,#A8231B);--a-p:var(--tu-p,#A2283A);--a-onp:var(--tu-onp,#fff);--a-pc:var(--tu-pc,#FFDADC);--a-onpc:var(--tu-onpc,#40000D);--a-shadow:var(--tu-shadow,0 3px 10px rgba(20,26,40,.06));--a-font:var(--tu-font,"Figtree",-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif);
  --ta-nbme:#2a78d6;--ta-uwsa:#eb6834;--ta-f120:#1baf7a;--ta-bar:#2a78d6;--ta-weak:#d03b3b;--ta-good:#0ca30c;--ta-grid:var(--a-line2);--ta-axis:var(--a-on3);
  --mx-3:#c22f31;--mx-2:#e87878;--mx-1:#f6c4c2;--mx0:#ECEDF1;--mx1:#b7d3f6;--mx2:#5598e7;--cal0:var(--a-s1);--cal1:#cde2fb;--cal2:#86b6ef;--cal3:#3987e5;--cal4:#1c5cab;
  max-width:1240px;margin:0 auto;display:flex;flex-direction:column;gap:16px;color:var(--a-on);font:14px/1.4 var(--a-font);-webkit-font-smoothing:antialiased}
:root body #menu.theme-dark #tuAnalysis{--ta-nbme:#3987e5;--ta-uwsa:#d95926;--ta-f120:#199e70;--ta-bar:#3987e5;--ta-weak:#e66767;--mx-3:#e05555;--mx-2:#9c3b3d;--mx-1:#5a2b30;--mx0:#2B3242;--mx1:#1f3f68;--mx2:#2f6fc2;--cal0:#1c212c;--cal1:#173a63;--cal2:#1c5cab;--cal3:#2a78d6;--cal4:#6da7ec}
${A} *{box-sizing:border-box}
${A} :is(h1,h2,h3){margin:0!important;padding:0!important;color:var(--a-on)!important;font-family:var(--a-font)!important;letter-spacing:0;text-transform:none;background:none!important;border:0!important}
${A} p{margin:0}
${A} button{font:inherit!important;color:inherit;cursor:pointer;margin:0!important;box-shadow:none!important;min-height:0!important;text-transform:none!important;letter-spacing:0!important}
${A} svg{flex:none}
${A} .ta-head{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:12px}
${A} .ta-title h1{font-size:28px!important;font-weight:800!important;letter-spacing:-.02em!important;line-height:1.15!important}
${A} .ta-title p{margin:4px 0 0;color:var(--a-on3)}
${A} .ta-tools{display:flex;gap:8px;flex-wrap:wrap}
${A} .ta-seg{display:inline-flex;border:1px solid var(--a-line);border-radius:999px;overflow:hidden;background:var(--a-surface)}
${A} .ta-seg button{border:0!important;border-radius:0!important;background:transparent!important;height:38px!important;padding:0 14px!important;font-weight:600!important;color:var(--a-on2)!important;white-space:nowrap}
${A} .ta-seg button+button{border-left:1px solid var(--a-line)!important}
${A} .ta-seg button[aria-pressed="true"]{background:var(--a-pc)!important;color:var(--a-onpc)!important}
${A} .ta-seg.sm button{height:32px!important;padding:0 12px!important;font-size:13px!important}
${A} .ta-chip{white-space:nowrap;display:inline-flex;align-items:center;gap:8px;height:38px!important;padding:0 14px!important;border-radius:999px!important;border:0!important;background:var(--a-s2)!important;color:var(--a-on)!important;font-weight:600!important}
${A} .ta-chip:hover{background:var(--a-s3)!important}
${A} .ta-pop{align-self:flex-end;display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;padding:14px;border-radius:16px;background:var(--a-surface);border:1px solid var(--a-line);box-shadow:var(--a-shadow)}
${A} .ta-pop[hidden]{display:none}
${A} .ta-pop label{display:flex;flex-direction:column;gap:4px;font-size:12px!important;font-weight:600!important;color:var(--a-on3)!important;margin:0!important}
${A} .ta-pop input{height:38px!important;border-radius:10px!important;border:1px solid var(--a-line)!important;background:var(--a-s1)!important;color:var(--a-on)!important;padding:0 10px!important;margin:0!important;font:14px var(--a-font)!important;color-scheme:light dark;box-shadow:none!important;width:auto}
${A} .ta-pop-a{display:flex;gap:8px}
${A} .ta-btn{height:38px!important;padding:0 16px!important;border-radius:999px!important;border:0!important;background:var(--a-p)!important;color:var(--a-onp)!important;font-weight:700!important;display:inline-flex;align-items:center;gap:6px}
${A} .ta-btn.quiet{background:var(--a-s2)!important;color:var(--a-on)!important}${A} .ta-btn.sm{height:32px!important;padding:0 12px!important;font-size:13px!important}
${A} .ta-link{border:0!important;background:none!important;padding:0!important;color:var(--a-p)!important;font-weight:700!important;height:auto!important}
${A} .ta-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}
${A} .ta-tile{display:flex;flex-direction:column;gap:4px;padding:14px 16px;border-radius:18px;background:var(--a-surface);border:1px solid var(--a-line2);min-width:0}
${A} .ta-tl{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--a-on3)}
${A} .ta-big{font-size:30px;font-weight:800;letter-spacing:-.02em;line-height:1.1;display:flex;align-items:baseline;gap:6px;flex-wrap:wrap}
${A} .ta-big small{font-size:13px;font-weight:600;letter-spacing:0;color:var(--a-on3)}
${A} .ta-big.good{color:var(--a-ok)}${A} .ta-big.warn{color:var(--a-warn)}${A} .ta-big.bad{color:var(--a-bad)}
${A} .ta-tn{font-size:12.5px;color:var(--a-on2);line-height:1.35}
${A} .ta-delta{display:inline-flex;align-items:center;font-weight:700}${A} .ta-delta.up{color:var(--a-ok)}${A} .ta-delta.dn{color:var(--a-bad)}
${A} .ta-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:16px}
${A} .ta-card{grid-column:span 12;background:var(--a-surface);border:1px solid var(--a-line2);border-radius:20px;padding:16px 18px;min-width:0;display:flex;flex-direction:column;gap:12px}
${A} .s4{grid-column:span 4}${A} .s5{grid-column:span 5}${A} .s6{grid-column:span 6}${A} .s7{grid-column:span 7}${A} .s8{grid-column:span 8}${A} .s12{grid-column:span 12}
${A} .ta-ch{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-start;gap:10px}
${A} :is(.ta-ch,.ta-slim,.ta-empty-card) h2{font-size:16px!important;font-weight:800!important}
${A} :is(.ta-ch,.ta-slim,.ta-empty-card) p{margin:2px 0 0;font-size:12.5px;color:var(--a-on3)}
${A} .ta-empty-card{padding:28px 22px;gap:6px}${A} .ta-empty-card p{font-size:14px}
${A} .ta-slim{flex-direction:row;align-items:center;padding:12px 18px;background:var(--a-s1);border-style:dashed}
${A} .ta-empty{color:var(--a-on3);font-size:13px;margin:8px 0;list-style:none}
${A} .ta-plot{min-width:0}${A} .ta-plot svg{display:block}
${A} svg .grid{stroke:var(--ta-grid);stroke-width:1}
${A} svg .ax{fill:var(--ta-axis);font:11px var(--a-font)}${A} svg .ax.sm{font-size:10px}
${A} svg .lbl{fill:var(--a-on);font:600 11px var(--a-font)}
${A} svg .ref{stroke-width:1.5;stroke-dasharray:4 4}
${A} svg .ref.pass{stroke:var(--a-on3)}${A} svg .ref.tgt{stroke:var(--a-p)}${A} svg .ref.day{stroke:var(--a-line);stroke-dasharray:2 3}${A} svg .ref.avg{stroke:var(--a-on3);stroke-dasharray:3 3;stroke-width:1}
${A} svg .tl{fill:none;stroke:var(--a-on3);stroke-width:2;stroke-linejoin:round;opacity:.55}
${A} svg .tl.proj{stroke:var(--a-p);stroke-dasharray:5 5;opacity:1}
${A} svg .projdot{fill:var(--a-surface);stroke:var(--a-p);stroke-width:2}
${A} svg .pt{stroke:var(--a-surface);stroke-width:2}
${A} svg .bar{fill:var(--ta-bar)}${A} svg .bar.weak{fill:var(--ta-weak)}
${A} svg .cal{fill:var(--cal0)}${A} svg .cal.l1{fill:var(--cal1)}${A} svg .cal.l2{fill:var(--cal2)}${A} svg .cal.l3{fill:var(--cal3)}${A} svg .cal.l4{fill:var(--cal4)}
${A} svg .cal.today{stroke:var(--a-on);stroke-width:1.5}
${A} .ta-legend{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:12px;color:var(--a-on2);margin-top:-4px}
${A} .ta-legend span{display:inline-flex;align-items:center;gap:6px}
${A} .ta-dash{display:inline-block;width:18px;border-top:2px dashed var(--a-on3)}${A} .ta-dash:is(.tgt,.proj){border-color:var(--a-p)}
${A} .ta-next{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px}
${A} .ta-next button{width:100%;display:flex;align-items:center;gap:12px;padding:10px!important;border:0!important;border-radius:14px!important;background:transparent!important;color:var(--a-on)!important;text-align:left;height:auto!important}
${A} .ta-next button:hover{background:var(--a-s1)!important}
${A} .ta-ni{width:36px;height:36px;flex:none;border-radius:12px;display:grid;place-items:center;background:var(--a-s2);color:var(--a-on2)}
${A} .ta-ni:is(.resume,.start){background:var(--a-pc);color:var(--a-onpc)}
${A} .ta-nt{display:flex;flex-direction:column;min-width:0}${A} .ta-nt b{font-weight:700}${A} .ta-nt small{color:var(--a-on3);font-size:12.5px}
${A} .ta-sys{display:flex;flex-direction:column;gap:2px}
${A} .ta-sr{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr) 70px;align-items:center;gap:10px;padding:5px 8px!important;border:0!important;border-radius:10px!important;background:transparent!important;color:var(--a-on)!important;text-align:left;height:auto!important;width:100%}
${A} .ta-sr:hover{background:var(--a-s1)!important}${A} .ta-sr.on{background:var(--a-pc)!important;color:var(--a-onpc)!important}
${A} .ta-sr.few .ta-sb i{opacity:.45}
${A} .ta-sn{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${A} .ta-sb{position:relative;height:10px;border-radius:5px;background:var(--a-s2)}
${A} .ta-sb i{position:absolute;left:0;top:0;bottom:0;border-radius:5px;background:var(--ta-bar)}${A} .ta-sb i.weak{background:var(--ta-weak)}
${A} .ta-sb em{position:absolute;top:-4px;bottom:-4px;width:2px;margin-left:-1px;background:var(--a-on);opacity:.6;border-radius:1px}
${A} .ta-sv{display:flex;align-items:baseline;justify-content:flex-end;gap:6px;font-variant-numeric:tabular-nums}${A} .ta-sv small{color:var(--a-on3);font-size:11px;min-width:24px;text-align:right}
${A} .ta-sr.on .ta-sv small{color:inherit}
${A} .ta-wk{color:var(--ta-weak);align-self:center;display:inline-flex}
${A} .ta-mx-legend{display:flex;align-items:center;gap:4px;font-size:11.5px;color:var(--a-on3);flex-wrap:wrap}
${A} .ta-mx-legend span{margin:0 4px}${A} .ta-mx-legend i{width:14px;height:14px;border-radius:4px;display:inline-block}
${A} .ta-mx-few{display:inline-flex;align-items:center;gap:4px;margin-left:12px!important}
${A} .d-3{background:var(--mx-3)}${A} .d-2{background:var(--mx-2)}${A} .d-1{background:var(--mx-1)}${A} .d0{background:var(--mx0)}${A} .d1{background:var(--mx1)}${A} .d2{background:var(--mx2)}
${A} i.few{background:transparent;box-shadow:inset 0 0 0 1.5px var(--a-line)}
${A} .ta-mxw{overflow-x:auto;margin:0 -6px;padding:0 6px 4px}
${A} .ta-mx table{border-collapse:separate;border-spacing:3px;font-size:12px;width:auto;margin:0;background:none;border:0}
${A} .ta-mx :is(th,td){border:0!important;background:none!important}
${A} .ta-mx thead th{font-weight:600;color:var(--a-on3);padding:0 0 4px;vertical-align:bottom}
${A} .ta-mxh{display:block;writing-mode:vertical-rl;transform:rotate(180deg);white-space:nowrap;font-size:11px;line-height:1;padding-bottom:2px}
${A} .ta-mxh:is(.nbme,.uwsa,.f120){color:var(--a-on);font-weight:800}
${A} .ta-mx tbody th{text-align:left;font-weight:500;padding:0 8px 0 0;white-space:nowrap}
${A} .ta-mx tbody th button{border:0!important;background:none!important;padding:2px 6px!important;border-radius:6px!important;max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px!important;color:var(--a-on2)!important;height:auto!important}
${A} .ta-mx tbody th button:hover{background:var(--a-s2)!important}
${A} .ta-mx tr.on th button{background:var(--a-pc)!important;color:var(--a-onpc)!important}
${A} .ta-mx td{padding:0}${A} .ta-mx td i{display:block;width:18px;height:18px;border-radius:4px}
${A} .ta-mx td i.none{background:transparent}
${A} .ta-mxw.big td i{width:auto;min-width:56px;height:26px;border-radius:6px;font:700 11.5px/26px var(--a-font);font-style:normal;text-align:center;color:var(--a-on)}
${A} .ta-mxw.big .ta-mxh{writing-mode:horizontal-tb;transform:none;font-size:12px;padding:0 2px 4px}
${A} .ta-mxw.big td i:is(.d-3,.d2){color:#fff}
${A} .ta-mxc{text-align:center;font-variant-numeric:tabular-nums;min-width:34px;color:var(--ta-weak)}
${A} .ta-note{font-size:12px;color:var(--a-on3);margin:0}
${A} .ta-assess{display:flex;flex-direction:column;gap:12px}
${A} .ta-ag h3{margin:0 0 6px!important;font-size:12px!important;text-transform:uppercase!important;letter-spacing:.06em!important;color:var(--a-on3)!important;font-weight:700!important}
${A} .ta-chips{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:6px}
${A} .ta-fc{position:relative;display:flex;flex-direction:column;border-radius:12px;border:1px solid var(--a-line2);background:var(--a-s1);color:var(--a-on);overflow:hidden}
${A} .ta-fcm{display:flex;flex-direction:column;align-items:flex-start;gap:0;width:100%;padding:7px 9px!important;border:0!important;border-radius:0!important;background:transparent!important;color:inherit!important;text-align:left;min-height:56px!important;height:auto!important}
${A} .ta-fc b{font-size:12px;color:var(--a-on3);font-weight:700}
${A} .ta-fc span{font-size:17px;font-weight:800;letter-spacing:-.01em}
${A} .ta-fc small{font-size:11px;color:var(--a-on3)}
${A} .ta-fc.done{background:var(--a-surface);border-color:var(--a-line)}
${A} .ta-fc.progress{border-style:dashed;border-color:var(--a-p)}${A} .ta-fc.progress span{color:var(--a-p)}
${A} .ta-fc.new{opacity:.7}${A} .ta-fc:hover,${A} .ta-fc.editing{border-color:var(--a-p)}
${A} .ta-add{display:flex;align-items:center;justify-content:center;gap:3px;height:28px!important;margin:0 6px 6px!important;padding:0 6px!important;border:0!important;border-radius:999px!important;background:var(--a-p)!important;color:var(--a-onp)!important;font-size:12px!important;font-weight:700!important;white-space:nowrap}
${A} .ta-add:hover{filter:brightness(1.08)}
${A} .ta-sedit{position:absolute;top:4px;right:4px;width:24px;height:24px!important;display:grid;place-items:center;padding:0!important;border:0!important;border-radius:999px!important;background:transparent!important;color:var(--a-on3)!important}
${A} .ta-sedit:hover{background:var(--a-s2)!important;color:var(--a-on)!important}
${A} .ta-sf{display:flex;gap:4px;margin:0 6px 6px;padding:0}
${A} .ta-sf input{flex:1;min-width:0;width:100%;height:30px;padding:0 6px;border-radius:8px;border:1.5px solid var(--a-p);background:var(--a-surface);color:var(--a-on);font:700 15px var(--a-font);text-align:center;letter-spacing:.04em}
${A} .ta-sf input:focus{outline:2px solid var(--a-pc);outline-offset:0}
${A} .ta-sf button{flex:none;width:30px;height:30px!important;display:grid;place-items:center;padding:0!important;border:0!important;border-radius:8px!important;background:var(--a-p)!important;color:var(--a-onp)!important}
${A} .ta-sf.bad input{border-color:var(--a-bad);animation:ta-shake .3s}${A} .ta-sf.busy{opacity:.6;pointer-events:none}
@keyframes ta-shake{25%{transform:translateX(-3px)}75%{transform:translateX(3px)}}
${A} .ta-conv{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:14px;padding:10px 12px;border-radius:14px;background:var(--a-s1)}
${A} .ta-cvl{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--a-on3);font-weight:700;margin-right:2px}
${A} .ta-conv select,${A} .ta-cvp input{height:36px;border-radius:10px;border:1px solid var(--a-line);background:var(--a-surface);color:var(--a-on);font:600 14px var(--a-font);padding:0 10px;color-scheme:light dark}
${A} .ta-cvp{display:inline-flex;align-items:center;gap:4px;color:var(--a-on3);font-weight:600}
${A} .ta-cvp input{width:76px;text-align:right}
${A} .ta-cvo{margin-left:auto;display:inline-flex;align-items:baseline;gap:6px}
${A} .ta-cvo b{font-size:26px;font-weight:800;letter-spacing:-.02em;line-height:1}${A} .ta-cvo b.mut{color:var(--a-on3)}
${A} .ta-cvo small{font-size:12px;color:var(--a-on3)}
${A} .ta-cms{display:flex;flex-direction:column;gap:8px}
${A} .ta-cr{display:grid;grid-template-columns:140px minmax(0,1fr) 92px;gap:10px;align-items:center}
${A} .ta-cn{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
${A} .ta-cs{display:flex;gap:2px;height:14px}
${A} .ta-cs i{flex:1;border-radius:3px;background:var(--a-s2)}${A} .ta-cs i.done{background:var(--ta-bar)}${A} .ta-cs i.progress{background:repeating-linear-gradient(135deg,var(--ta-bar) 0 2px,var(--a-s2) 2px 5px)}
${A} .ta-cv{display:flex;justify-content:flex-end;gap:8px;font-variant-numeric:tabular-nums;font-size:13px}
${A} .ta-cv .good{color:var(--a-ok);font-weight:700}${A} .ta-cv .warn{color:var(--a-warn);font-weight:700}${A} .ta-cv .bad{color:var(--a-bad);font-weight:700}${A} .ta-cv .mut{color:var(--a-on3)}
${A} .ta-habits{display:flex;flex-direction:column;gap:16px}
${A} .ta-hbt{display:flex;justify-content:space-between;font-size:13px}${A} .ta-hbt b{font-size:15px}
${A} .ta-meter{display:block;height:8px;border-radius:4px;background:var(--a-s2);overflow:hidden;margin:6px 0 4px}${A} .ta-meter i{display:block;height:100%;background:var(--ta-bar);border-radius:4px}
${A} .ta-hb small{font-size:12px;color:var(--a-on3)}
${A} .ta-chg-bar{display:flex;gap:2px;height:12px;border-radius:6px;overflow:hidden}
${A} .ta-chg-bar i{display:block}${A} .wr{background:var(--ta-good)}${A} .rw{background:var(--ta-weak)}${A} .ww{background:var(--a-on3)}
${A} .ta-chg-l{display:flex;flex-direction:column;gap:3px;margin:8px 0 6px;font-size:12.5px}
${A} .ta-chg-l span{display:flex;align-items:center;gap:6px}${A} .ta-chg-l b{margin-left:auto;font-variant-numeric:tabular-nums}
${A} .ta-chg-l i{width:10px;height:10px;border-radius:3px;display:inline-block}
${A} .ta-topics{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;counter-reset:t}
${A} .ta-topics li{display:flex;align-items:center;gap:12px;padding:8px 2px;border-top:1px solid var(--a-line2);counter-increment:t;margin:0}
${A} .ta-topics li:first-child{border-top:0}
${A} .ta-topics li::before{content:counter(t);width:22px;height:22px;flex:none;border-radius:50%;background:var(--a-s2);display:grid;place-items:center;font-size:11px;font-weight:700;color:var(--a-on2)}
${A} .ta-topics li.ta-empty::before{display:none}
${A} .ta-tp{display:flex;flex-direction:column;min-width:0;flex:1}${A} .ta-tp b{font-weight:600;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}${A} .ta-tp small{color:var(--a-on3);font-size:11.5px}
${A} .ta-tw{font-size:12px;color:var(--a-on3);white-space:nowrap}${A} .ta-tw b{color:var(--ta-weak);font-size:14px}
${A} .ta-why{display:flex;flex-direction:column;gap:6px}${A} .ta-wr{display:grid;grid-template-columns:140px 1fr 40px;gap:10px;align-items:center}
${A} .ta-loading{color:var(--a-on3);padding:40px 0;text-align:center}
${A}.ta-pending{min-height:101vh}
#analysisPanel .ta-tip{position:fixed;z-index:80;pointer-events:none;max-width:280px;padding:8px 10px;border-radius:10px;background:var(--tu-on,#161A25);color:var(--tu-bg,#fff);font:12px/1.35 var(--tu-font,system-ui);display:flex;flex-direction:column;box-shadow:0 6px 20px rgba(0,0,0,.25)}
#analysisPanel .ta-tip b{font-size:12.5px}#analysisPanel .ta-tip[hidden]{display:none}
@media (max-width:1180px){${A} .ta-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}${A} :is(.s5,.s7,.s8){grid-column:span 12}${A} .ta-grid>.s4:nth-of-type(2){grid-column:span 12}}
@media (max-width:900px){${A} :is(.s4,.s6){grid-column:span 12}}
@media (max-width:600px){${A} .ta-kpis{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}${A} .ta-tile{padding:12px}${A} .ta-big{font-size:24px}
  ${A} .ta-title h1{font-size:26px!important}${A} .ta-tools{width:100%}${A} .ta-tools .ta-seg{flex:1 1 100%}${A} .ta-tools .ta-seg button{flex:1;padding:0 8px!important}${A} .ta-chip{flex:1;justify-content:center}
  ${A} .ta-card{padding:14px;border-radius:18px}${A} .ta-cr{grid-template-columns:96px minmax(0,1fr) 78px}${A} .ta-sr{grid-template-columns:minmax(0,1.1fr) minmax(0,1fr) 62px}}
`;

  function ensure() {
    const side = document.querySelector('#menu aside.modern-sidebar'), lib = byId('libraryModePanel');
    if (!side || !lib) return false;
    if (!byId('tu-analysis-css')) { const st = document.createElement('style'); st.id = 'tu-analysis-css'; st.textContent = STYLE; document.head.appendChild(st); }
    if (!byId('tuAnalysisTab')) {
      const b = document.createElement('button'); b.type = 'button'; b.id = 'tuAnalysisTab'; b.className = 'menu-tab';
      b.innerHTML = ICON + '<span class="tu-tab-label">Analysis</span>';
      b.addEventListener('click', (e) => { e.preventDefault(); open(); });
      const after = byId('qbankTestsTab') || byId('qbankTab') || byId('libraryTab');
      if (after && after.parentNode === side) after.after(b); else side.appendChild(b);
    }
    if (!byId('analysisPanel')) {
      const p = document.createElement('section'); p.id = 'analysisPanel'; p.className = 'mode-panel';
      p.innerHTML = '<div id="tuAnalysis" aria-live="polite"></div>';
      const panels = lib.parentNode.querySelectorAll(':scope > .mode-panel');
      panels[panels.length - 1].after(p);
    }
    return true;
  }
  const isOpen = () => !!(byId('analysisPanel') && byId('analysisPanel').classList.contains('active'));
  function close() {
    byId('analysisPanel')?.classList.remove('active');
    byId('tuAnalysisTab')?.classList.remove('active');
  }
  function open() {
    if (!ensure()) return;
    wrapMode();
    document.querySelectorAll('#menu .mode-panel.active').forEach((p) => p.classList.remove('active'));
    document.querySelectorAll('#menu aside.modern-sidebar .menu-tab.active').forEach((t) => t.classList.remove('active'));
    byId('analysisPanel').classList.add('active'); byId('tuAnalysisTab').classList.add('active');
    window.scrollTo(0, 0); document.querySelector('#menu .modern-main')?.scrollTo?.(0, 0);
    load();
  }
  async function load() {
    const el = byId('tuAnalysis'), B = window.StepLibraryBridge, my = ++seq;
    if (!el) return;
    if (!B || typeof B.analysis !== 'function') { el.innerHTML = '<p class="ta-loading">Analysis needs the form library. Open the Library once and try again.</p>'; return; }
    // First open: keep the space reserved (no scrollbar pop, no collapse) and only show the text if the read is slow.
    // Re-open: keep the content already on screen and swap it in place only if the numbers changed.
    let slow = null;
    if (!ui) { el.innerHTML = ''; el.classList.add('ta-pending'); slow = setTimeout(() => { if (my === seq && !ui) el.innerHTML = '<p class="ta-loading">Reading your forms…</p>'; }, 350); }
    try {
      const d = await (loading || (loading = B.analysis()));
      loading = null; clearTimeout(slow); if (my !== seq) return;
      data = d; lastLoad = Date.now();
      el.classList.remove('ta-pending');
      if (!ui) ui = window.ThunderAnalysisUI.mount(el, () => ({ catalog: data.catalog, progress: data.progress, shadow: data.shadow, prefs, now: new Date() }), { onAction });
      else ui.redraw(true);
    } catch (e) {
      loading = null; clearTimeout(slow); console.warn('ThunderAnalysis: load failed', e);
      if (my === seq) el.classList.remove('ta-pending'), el.innerHTML = '<p class="ta-loading">Couldn’t read your progress files. Reconnect the DATA folder from the Library and try again.</p>';
    }
  }
  async function toLibrary() {
    close(); byId('libraryTab')?.click();
    for (let i = 0; i < 40 && !(byId('libraryModePanel') && byId('libraryModePanel').classList.contains('active')); i++) await wait(50);
  }
  async function onAction(a) {
    if (a.type === 'prefs') { prefs = Object.assign({}, prefs, a.prefs); store.set(prefs); return; }
    if (a.type === 'score') { // same record the Library's "Set 3-digit score" writes (catalog threeDigitScore)
      const B = window.StepLibraryBridge;
      if (!B || typeof B.setThreeDigitScore !== 'function') throw new Error('no bridge');
      await B.setThreeDigitScore(a.id, a.value);
      const f = data && data.catalog.forms.find((x) => x.id === a.id); if (f) f.threeDigitScore = a.value;
      return;
    }
    const TUI = window.ThunderUI;
    if (a.type === 'form') { await toLibrary(); if (TUI && TUI.openForm) TUI.openForm(a.id, byId('tuAnalysisTab')); return; }
    if (a.type === 'next') {
      if (a.kind === 'cms') {
        await toLibrary();
        const pill = () => document.querySelector(`#libraryFilters .filter-pill[data-filter="${CSS.escape(a.id)}"]`);
        // opening the Library can reset its tab (Overview, then All) a moment later: pick the subject once it settles, and check
        const B = window.StepLibraryBridge, cur = () => (B ? B.filter() : '');
        for (let i = 0, last = null, same = 0; i < 15 && same < 3; i++) { await wait(150); const f = cur(); same = f === last ? same + 1 : 0; last = f; }
        for (let i = 0; i < 4 && cur() !== a.id; i++) { pill()?.click(); await wait(400); }
        return;
      }
      const act = a.kind === 'resume' ? 'resume' : 'start'; // start opens the start dialog; it has the Wrongs pool for a retest
      await toLibrary();
      if (TUI && TUI.formAction) {
        const ok = await TUI.formAction(a.id, act);
        if (!ok && TUI.openForm) { TUI.openForm(a.id, byId('tuAnalysisTab')); return; }
        if (ok && a.kind === 'retest') { // preselect the Wrongs pool in the start dialog
          for (let i = 0; i < 100; i++) { const w = document.querySelector('#tuStart [data-tu-pool="wrongs"]'); if (w && !w.disabled) { if (w.getAttribute('aria-pressed') !== 'true') w.click(); break; } await wait(100); } // the counts load a moment after the dialog opens
        }
      }
    }
  }

  // Other sidebar tabs and the legacy setMenuMode switch panels without knowing about this one.
  document.addEventListener('click', (e) => {
    const t = e.target && e.target.closest && e.target.closest('#menu aside.modern-sidebar .menu-tab');
    if (t && t.id !== 'tuAnalysisTab' && t.id !== 'themeToggle' && isOpen()) close();
  }, true);
  // The legacy setMenuMode is not global, so watch for another panel becoming active (exam closed, Resume card, …).
  const panelObs = new MutationObserver((recs) => {
    if (isOpen() && recs.some((r) => r.target.id !== 'analysisPanel' && r.target.classList.contains('active'))) close();
  });
  const seen = new WeakSet();
  function wrapMode() {
    document.querySelectorAll('#menu .mode-panel').forEach((p) => { if (p.id === 'analysisPanel' || seen.has(p)) return; seen.add(p); panelObs.observe(p, { attributes: true, attributeFilter: ['class'] }); });
  }
  // Results change after an exam: refresh the next time the tab opens (and now, if it is open).
  window.addEventListener('focus', () => { if (isOpen() && Date.now() - lastLoad > 3000) load(); });
  function boot() {
    let n = 0; const t = setInterval(() => { const ok = ensure(); wrapMode(); if ((ok && n > 4) || ++n > 60) clearInterval(t); }, 250);
    ensure(); wrapMode();
  }
  window.ThunderAnalysisApp = { open, close, refresh: () => { if (isOpen()) load(); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();

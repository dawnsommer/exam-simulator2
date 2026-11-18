// Qbanks core (pure, no DOM): shared Local/iPad. Mapping rules, bank/status logic, facets, presets, tag merge.
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.ThunderQbanksCore = factory(); })(this, function () {
  'use strict';
  const UNASSIGNED = 'Unassigned';
  const SYSTEMS = ['Cardiovascular', 'Pulmonary & Critical Care', 'Gastrointestinal & Nutrition', 'Renal & Urinary', 'Endocrine & Metabolic',
    'Hematology & Oncology', 'Infectious Diseases', 'Nervous System', 'Psychiatric & Behavioral', 'Female Reproductive & Breast', 'Pregnancy & Childbirth',
    'Musculoskeletal & Rheumatology', 'Dermatology', 'Ear, Nose & Throat', 'Ophthalmology', 'Social Sciences & Ethics', 'Biostatistics & Epidemiology',
    'Genetics', 'Allergy & Immunology', 'Pharmacology & Toxicology', 'Trauma & Emergencies', 'Preventive Care & Screening', 'Male Reproductive'];
  // First match wins; tried on the whole label, then on the part before "/".
  const SYS_RULES = [
    [/^cardio/i, 'Cardiovascular'], [/^pulmon|^respir/i, 'Pulmonary & Critical Care'], [/^gastro|^hepat|^gi\b/i, 'Gastrointestinal & Nutrition'],
    [/^nephro|^urolog|^renal/i, 'Renal & Urinary'], [/^endocr/i, 'Endocrine & Metabolic'], [/^hemat|^oncol/i, 'Hematology & Oncology'],
    [/^infect/i, 'Infectious Diseases'], [/^neuro|^nervous/i, 'Nervous System'], [/^psych|^behav/i, 'Psychiatric & Behavioral'],
    [/^obstetrics\/gyn|^gynec|^female|^breast/i, 'Female Reproductive & Breast'], [/^obstet|^pregnan/i, 'Pregnancy & Childbirth'],
    [/^musculo|^ortho|^rheumat/i, 'Musculoskeletal & Rheumatology'], [/^dermat|^skin/i, 'Dermatology'], [/^otolar|^ent\b|^ear/i, 'Ear, Nose & Throat'],
    [/^ophthal|^eye/i, 'Ophthalmology'], [/^ethic|^social|^palliat|^geriatrics\/ethics/i, 'Social Sciences & Ethics'],
    [/^biostat|^epidem|^preventive medicine\/epi/i, 'Biostatistics & Epidemiology'], [/^genetic/i, 'Genetics'], [/^immun|^allerg/i, 'Allergy & Immunology'],
    [/^pharmac|^toxic|^poison/i, 'Pharmacology & Toxicology'], [/^emergency|^general surgery|^trauma/i, 'Trauma & Emergencies'],
    [/^preventive|^nutrition/i, 'Preventive Care & Screening'], [/^male/i, 'Male Reproductive'],
    [/^pediatrics|^geriatr|^internal/i, 'Multisystem']];
  const SUBJ_BY_FILTER = { IM: 'Internal Medicine', Surg: 'Surgery', Peds: 'Pediatrics', OBGyn: 'Obstetrics & Gynecology', Psych: 'Psychiatry', Neuro: 'Neurology', FM: 'Family Medicine', EM: 'Emergency Medicine' };
  const SUBJ_BY_SYS_LABEL = [[/^obstet|^gynec/i, 'Obstetrics & Gynecology'], [/^pediatrics/i, 'Pediatrics'], [/^psychiat/i, 'Psychiatry'], [/^neurol/i, 'Neurology'],
    [/^general surgery|^musculoskeletal\/ortho|^trauma/i, 'Surgery'], [/^ethic/i, 'Ethics & Communication'], [/^biostat/i, 'Biostatistics & Epidemiology'], [/^emergency/i, 'Emergency Medicine']];
  const TOPIC_KW = [
    ['Cardiovascular', /cardi|heart|coronar|myocard|arrhythm|atrial|ventric|valv|aort|hypertens|endocardit|pericard|angina|murmur|vascular|aneurysm|syncope|stemi/i],
    ['Pulmonary & Critical Care', /pulmon|lung|asthma|copd|pneum|pleur|respir|bronch|embol|sarcoid|apnea|hypox|ards|ventilat/i],
    ['Gastrointestinal & Nutrition', /gastr|bowel|colon|liver|hepat|pancrea|biliar|cholecyst|esophag|crohn|colitis|celiac|cirrho|append|diverticul|gi |rectal|anal|dysphag|nutri|vitamin/i],
    ['Renal & Urinary', /renal|kidney|nephr|urin|bladder|prostat|hyponat|hyperkal|electrolyte|acid|alkalosis|glomer|dialysis|stone/i],
    ['Endocrine & Metabolic', /thyro|diabet|insulin|adrenal|cushing|addison|pituit|parathyr|calcium|glucose|hypoglyc|endocr|prolactin|osteopor/i],
    ['Hematology & Oncology', /anemi|hemat|leuk|lymphom|myelom|platelet|coagul|thromb|bleed|sickle|transfus|cancer|tumou?r|carcinom|oncol|metasta|neutropen/i],
    ['Infectious Diseases', /infect|hiv|sepsis|tubercul|syphil|malaria|lyme|viral|bacter|fung|vaccin|immuniz|mening(itis)?|cellulit|abscess|fever/i],
    ['Nervous System', /neuro|stroke|seizure|epilep|dementia|parkinson|sclerosis|headache|migraine|neuropath|spinal|brain|cerebr|myasthen|guillain|vertigo/i],
    ['Psychiatric & Behavioral', /depress|anxiety|schizo|bipolar|psych|suicid|substance|alcohol|opioid|withdraw|personality|adhd|autis|eating|anorex|bulim|ptsd|ocd|panic|delirium|insomnia/i],
    ['Pregnancy & Childbirth', /pregnan|obstet|labor|delivery|postpartum|preeclamp|eclamp|gestat|placent|prenatal|fetal|ectopic|miscarr|abortion/i],
    ['Female Reproductive & Breast', /breast|ovari|uter|cervi|menstru|menopaus|amenorr|vagin|endometri|pcos|contracept|gyn|infertil/i],
    ['Musculoskeletal & Rheumatology', /fractur|bone|joint|arthrit|lupus|gout|rheumat|tendon|ligament|back pain|osteo|muscle|orthop|vasculit|spondyl/i],
    ['Dermatology', /skin|derm|rash|melanom|psoria|eczema|acne|lesion|urticar|burn/i],
    ['Ear, Nose & Throat', /\bears?\b|otitis|sinus|throat|pharyn|laryn|hearing|nasal|epistax|tonsil/i],
    ['Ophthalmology', /eye|vision|visual|retin|glaucom|ocular|conjunct|cataract/i],
    ['Social Sciences & Ethics', /ethic|consent|confidential|capacity|autonomy|disclos|communicat|advance directive|malpractice|legal/i],
    ['Biostatistics & Epidemiology', /statist|sensitiv|specific|bias|study|trial|risk ratio|odds|predictive|incidence|prevalence|epidem/i],
    ['Preventive Care & Screening', /screen|prevent|counsel|immunization schedule|well[- ]child/i],
    ['Pharmacology & Toxicology', /toxic|overdose|poison|adverse effect|drug interaction|side effect/i],
    ['Genetics', /genetic|chromosom|trisomy|syndrome.*inherit|inherit/i]];
  const BUILTIN_BANKS = [
    { id: 'nbme', name: 'NBME', code: 'NB', color: '#7b5cff', sub: 'NBME forms + Free 120' },
    { id: 'cms', name: 'CMS', code: 'CMS', color: '#c48a00', sub: 'Clinical Mastery shelf forms' },
    { id: 'uwsa', name: 'UWSA', code: 'UW', color: '#00a6a6', sub: 'UWorld self-assessments' },
    { id: 'other', name: 'Other forms', code: 'OT', color: '#5c5f66', sub: 'Other Library forms' }];
  const STATUSES = ['unused', 'incorrect', 'marked', 'omitted', 'correct'];

  const pick = (rules, s) => { for (const r of rules) if (r[0].test(s)) return r[1]; return null; };
  const str = v => (v == null ? '' : String(v)).trim();
  function normSystem(raw) {
    const s = str(raw);
    if (!s || /generated|inferred/i.test(s) || /^(uncategori[sz]ed|unknown|n\/?a|none|other)$/i.test(s)) return UNASSIGNED;
    return pick(SYS_RULES, s) || pick(SYS_RULES, s.split('/')[0].trim()) || s;
  }
  function systemOf(q) {
    q = q || {};
    const sys = str(q.system), raw = sys || str(q.subject);
    const system = normSystem(raw);
    return { system, from: system === UNASSIGNED ? 'missing' : sys ? 'system' : 'subject' };
  }
  const isCms = rec => !!rec && (rec.type === 'C' || /^C-/.test(String(rec.id || '')));
  function subjectOf(q, rec) {
    q = q || {};
    if (str(q.discipline)) return { subject: str(q.discipline), from: 'question' };
    if (isCms(rec) && SUBJ_BY_FILTER[rec.filter]) return { subject: SUBJ_BY_FILTER[rec.filter], from: 'form' };
    let sub = pick(SUBJ_BY_SYS_LABEL, str(q.system || q.subject));
    if (!sub) {
      const sc = clinicalSciencesOf(q, rec);
      sub = sc.includes('pediatrics') ? 'Pediatrics' : sc.includes('obgyn') ? 'Obstetrics & Gynecology' : sc.includes('psychiatry') ? 'Psychiatry'
        : sc.includes('surgery') && !sc.includes('medicine') ? 'Surgery' : 'Internal Medicine';
    }
    return { subject: sub, from: 'inferred' };
  }
  // USMLE Step 2 CK content outline (percent ranges). Row order = display order. Systems not in SYSTEMS ('Multisystem') are allowed.
  const BLUEPRINT_STEP2 = {
    source: 'usmle.org Step 2 CK content outline, read 2026-11-18',
    rows: [
      { id: 'social', label: 'Social Sciences & Ethics', short: 'Ethics', min: 10, max: 15, systems: ['Social Sciences & Ethics'] },
      { id: 'renal', label: 'Renal, Urinary & Reproductive', short: 'Renal/Repro', min: 7, max: 13, systems: ['Renal & Urinary', 'Female Reproductive & Breast', 'Male Reproductive'] },
      { id: 'cardio', label: 'Cardiovascular', short: 'Cardio', min: 6, max: 12, systems: ['Cardiovascular'] },
      { id: 'msk', label: 'Musculoskeletal & Skin', short: 'MSK/Skin', min: 6, max: 12, systems: ['Musculoskeletal & Rheumatology', 'Dermatology'] },
      { id: 'behav', label: 'Behavioral Health', short: 'Behavioral', min: 5, max: 10, systems: ['Psychiatric & Behavioral'] },
      { id: 'blood', label: 'Blood & Immune', short: 'Blood/Immune', min: 5, max: 10, systems: ['Hematology & Oncology', 'Allergy & Immunology'] },
      { id: 'gi', label: 'Gastrointestinal', short: 'GI', min: 5, max: 10, systems: ['Gastrointestinal & Nutrition'] },
      { id: 'neuro', label: 'Nervous System & Special Senses', short: 'Neuro', min: 5, max: 10, systems: ['Nervous System', 'Ophthalmology', 'Ear, Nose & Throat'] },
      { id: 'resp', label: 'Respiratory', short: 'Respiratory', min: 5, max: 10, systems: ['Pulmonary & Critical Care'] },
      { id: 'multi', label: 'Multisystem', short: 'Multisystem', min: 4, max: 8, systems: ['Multisystem', 'Infectious Diseases', 'Trauma & Emergencies', 'Pharmacology & Toxicology'] },
      { id: 'endo', label: 'Endocrine', short: 'Endocrine', min: 3, max: 7, systems: ['Endocrine & Metabolic'] },
      { id: 'preg', label: 'Pregnancy & Childbirth', short: 'Pregnancy', min: 3, max: 7, systems: ['Pregnancy & Childbirth'] },
      { id: 'biostat', label: 'Biostatistics & Epidemiology', short: 'Biostat', min: 3, max: 5, systems: ['Biostatistics & Epidemiology'] },
      { id: 'humdev', label: 'Human Development', short: 'Human Dev', min: 2, max: 4, systems: ['Preventive Care & Screening', 'Genetics'] }],
    sciences: [
      { id: 'medicine', label: 'Medicine', min: 55, max: 65 }, { id: 'pediatrics', label: 'Pediatrics', min: 17, max: 27 },
      { id: 'obgyn', label: 'OB/GYN', min: 10, max: 20 }, { id: 'psychiatry', label: 'Psychiatry', min: 10, max: 15 }, { id: 'surgery', label: 'Surgery', min: 5, max: 15 }] };
  const BP_ROW = {}, BP_SYS = {}, BP_SCI = {};
  BLUEPRINT_STEP2.rows.forEach(r => { BP_ROW[r.id] = r; r.systems.forEach(s => { BP_SYS[s] = r.id; }); });
  BLUEPRINT_STEP2.sciences.forEach(c => { BP_SCI[c.id] = c; });
  const mid = r => (r.min + r.max) / 2;
  function blueprintRow(systemName) {
    const s = str(systemName); if (!s || s === UNASSIGNED) return null;
    return BP_SYS[s] || BP_SYS[normSystem(s)] || null;
  }

  // Clinical sciences (USMLE overlaps allowed). [] = neutral (ethics / biostatistics).
  const SCI_BY_NAME = [[/^(im|internal medicine|family medicine|fm|emergency medicine|em|neurology|neuro|medicine)$/i, 'medicine'], [/^(pediatrics|peds|paediatrics)$/i, 'pediatrics'],
    [/^(ob\/?gyn|obgyn|obstetrics( ?(&|and|\/) ?gynecology)?|gynecology|ob)$/i, 'obgyn'], [/^(psychiatry|psych)$/i, 'psychiatry'], [/^(surgery|general surgery|surg)$/i, 'surgery']];
  const SCI_BY_FILTER = { IM: 'medicine', FM: 'medicine', EM: 'medicine', Neuro: 'medicine', Peds: 'pediatrics', OBGyn: 'obgyn', Psych: 'psychiatry', Surg: 'surgery' };
  const AGE_RE = /(\d+(?:\.\d+)?)[\s-]*(years?|yrs?|months?|mos?|weeks?|wks?|days?)[\s-]*old/i;
  const SURG_ANS_RE = /ectomy|otomy|ostomy|plasty|pexy|laparoscop|repair|drainage|resection|anastomos|fixation|amputat|debridement|chest tube|bypass graft/i;
  function clinicalSciencesOf(q, rec) {
    q = q || {};
    const exp = str(q.discipline) || str(q.clinicalScience);
    if (exp) { const h = pick(SCI_BY_NAME, exp); if (h) return [h]; }
    if (isCms(rec) && SCI_BY_FILTER[rec.filter]) return [SCI_BY_FILTER[rec.filter]];
    const text = str(q.stem || q.recognizer || q.question), label = str(q.system) + ' ' + str(q.subject), lab = str(q.system) || str(q.subject);
    const set = new Set(), age = AGE_RE.exec(text);
    if (age ? (/^y/i.test(age[2]) ? Number(age[1]) < 18 : true) : /newborn|neonat|infant|toddler/i.test(text)) set.add('pediatrics');
    if (/^obstet|^gynec/i.test(lab) || /pregnan|gestation|postpartum/i.test(text + ' ' + label)) set.add('obgyn');
    if (/^psychiat/i.test(lab)) set.add('psychiatry');
    if (/^general surgery|^trauma/i.test(lab) || (str(q.answerText) && SURG_ANS_RE.test(str(q.answerText)))) set.add('surgery');
    const neutral = /^ethic|^social|^biostat/i.test(lab);
    if (!set.size && neutral) return [];
    if (!set.has('pediatrics') && !set.has('obgyn') && !set.has('psychiatry') && !neutral) set.add('medicine');
    return BLUEPRINT_STEP2.sciences.map(c => c.id).filter(id => set.has(id));
  }
  function suggestFromTopic(topic) {
    const t = str(topic); if (!t) return null;
    const hit = TOPIC_KW.find(x => x[1].test(t)); return hit ? hit[0] : null;
  }
  function bankOf(rec) {
    rec = rec || {};
    if (rec.qbank && rec.qbank.id) return rec.qbank.id;
    if (isCms(rec)) return 'cms';
    if (rec.filter === 'UWSA') return 'uwsa';
    if (rec.type === 'N' || rec.filter === 'F120') return 'nbme';
    return 'other';
  }
  function statusOf(x) {
    x = x || {};
    const status = !x.used ? 'unused' : !x.answered ? 'omitted' : x.correct ? 'correct' : 'incorrect';
    return { status, marked: !!x.marked };
  }

  const toSet = v => (v == null ? null : v instanceof Set ? v : new Set(v));
  function inStatuses(row, statuses) {
    if (!statuses) return true;
    const set = toSet(statuses);
    return set.has(row.status) || (!!row.marked && set.has('marked'));
  }
  function matches(row, sel) {
    sel = sel || {};
    const subs = toSet(sel.subjects), syss = toSet(sel.systems);
    return inStatuses(row, sel.statuses) && (!subs || subs.has(row.subject)) && (!syss || syss.has(row.system));
  }
  const pctOf = p => (p && p.c + p.w ? Math.round(100 * p.c / (p.c + p.w)) : null);
  // sel.scopeBanks: ids of banks whose manifest asks for facetRules.systemsBySubject. While a subject selection
  // exists (non-empty), a system is listed only if it has a row from an unscoped bank or a scoped-bank row in a
  // selected subject; the others are hidden (not shown with 0). scoped = that rule hid or could hide something.
  function facets(rows, sel) {
    rows = rows || []; sel = sel || {};
    const subjects = [...new Set(rows.map(r => r.subject))].sort();
    const scope = toSet(sel.scopeBanks), pick = toSet(sel.subjects);
    const scoped = !!(scope && scope.size && pick && pick.size && rows.some(r => scope.has(r.bank)));
    const sysRows = scoped ? rows.filter(r => !scope.has(r.bank) || pick.has(r.subject)) : rows;
    const systems = [...new Set(sysRows.map(r => r.system))].sort((a, b) => (a === UNASSIGNED) - (b === UNASSIGNED) || a.localeCompare(b));
    const subs = toSet(sel.subjects) || new Set(subjects), syss = toSet(sel.systems) || new Set(systems);
    const subCount = {}, sysCount = {}, subPerf = {}, sysPerf = {}, poolCount = {}, keys = [];
    subjects.forEach(s => { subCount[s] = 0; }); systems.forEach(s => { sysCount[s] = 0; });
    STATUSES.forEach(k => { poolCount[k] = 0; });
    let avail = 0, misses = 0;
    rows.forEach(r => {
      if (inStatuses(r, sel.statuses)) {
        subCount[r.subject]++;
        if (subs.has(r.subject) && sysCount[r.system] != null) { sysCount[r.system]++; if (syss.has(r.system)) { avail++; keys.push(r.key); } }
      }
      [[r.subject, subPerf], [r.system, sysPerf]].forEach(([k, map]) => {
        const p = map[k] || (map[k] = { n: 0, c: 0, w: 0, u: 0 }); p.n++;
        if (r.status === 'correct') p.c++; else if (r.status === 'incorrect' || r.status === 'omitted') p.w++; else p.u++;
      });
      if (poolCount[r.status] != null) poolCount[r.status]++;
      if (r.marked) poolCount.marked++;
      if (r.marked || r.status === 'incorrect' || r.status === 'omitted') misses++;
    });
    return { subjects, systems, subCount, sysCount, subPerf, sysPerf, poolCount, misses, avail, keys, scoped };
  }

  // model = facets() result computed with all statuses ticked (needs systems, sysPerf, poolCount).
  // apply.subjects/systems: null = everything available.
  // defs (optional, from Settings → New test defaults): { perBlock, secs }. Without it the numbers are 40 / 90 s as before.
  function presets(m, defs) {
    m = m || {};
    const clamp = (v, lo, hi, d) => { v = Math.round(Number(v)); return Number.isFinite(v) && v > 0 ? Math.max(lo, Math.min(hi, v)) : d; };
    const n = clamp(defs && defs.perBlock, 1, 80, 40), secs = clamp(defs && defs.secs, 15, 600, 90);
    const sp = m.sysPerf || {}, pc = m.poolCount || {}, cnt = k => Math.max(0, Number(pc[k]) || 0);
    const weak = (m.systems || []).filter(s => s !== UNASSIGNED && pctOf(sp[s]) != null && sp[s].c + sp[s].w >= 10)
      .sort((a, b) => pctOf(sp[a]) - pctOf(sp[b])).slice(0, 3);
    return [
      { id: 'fresh', title: 'Fresh ' + n, detail: 'Unused · everything', disabled: false, apply: { statuses: ['unused'], subjects: null, systems: null, count: n } },
      { id: 'weak', title: 'Weak spots', detail: weak.length ? weak.join(', ') : 'needs answered questions', disabled: !weak.length, apply: { statuses: ['unused', 'incorrect'], subjects: null, systems: weak, count: n } },
      { id: 'redo', title: 'Redo misses', detail: 'Incorrect + marked + omitted · ' + (Number.isFinite(m.misses) ? m.misses : cnt('incorrect') + cnt('marked') + cnt('omitted')), disabled: false, apply: { statuses: ['incorrect', 'marked', 'omitted'], subjects: null, systems: null, count: n } },
      { id: 'sim', title: 'Exam block', detail: Math.min(n, cnt('unused')) + ' unused · Timed ' + secs + ' s', disabled: false, apply: { statuses: ['unused'], subjects: null, systems: null, mode: 'timed', secs: secs, count: n, perBlock: n } }];
  }

  // ---- Exam mix planners (pure; all randomness via opts.rand) ----
  const EPS = 1e-9;
  function shuffled(a, rand) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  // Largest-remainder split of `total` over weights, optional per-slot caps (overflow is redistributed), random tie-break.
  function apportion(w, total, caps, rand) {
    const out = w.map(() => 0); let left = total, act = [];
    w.forEach((x, i) => { if (x > 0 && (!caps || caps[i] > 0)) act.push(i); });
    while (left > 0 && act.length) {
      const sw = act.reduce((a, i) => a + w[i], 0), ex = act.map(i => w[i] * left / sw), add = ex.map(Math.floor), tb = act.map(() => rand());
      let extra = left - add.reduce((a, b) => a + b, 0);
      act.map((_, k) => k).sort((a, b) => { const d = (ex[b] - add[b]) - (ex[a] - add[a]); return Math.abs(d) > EPS ? d : tb[a] - tb[b]; })
        .forEach(k => { if (extra > 0) { add[k]++; extra--; } });
      let trunc = false; const next = [];
      act.forEach((i, k) => {
        let x = add[k];
        if (caps && out[i] + x > caps[i]) { x = caps[i] - out[i]; trunc = true; }
        out[i] += x; left -= x;
        if (!(caps && out[i] >= caps[i])) next.push(i);
      });
      act = next;
      if (!trunc) break;
    }
    return out;
  }
  const capFor = (r, scale, len) => Math.max(1, Math.floor(r.max * scale * len / 100 + EPS));
  function setup(units, n, perBlock, opts, onlyUse) {
    opts = opts || {};
    const rand = opts.rand || Math.random;
    const ids = Array.isArray(opts.rows) && opts.rows.length ? opts.rows.filter(id => BP_ROW[id]) : BLUEPRINT_STEP2.rows.map(r => r.id);
    const rows = BLUEPRINT_STEP2.rows.filter(r => ids.includes(r.id));
    const sumMid = rows.reduce((a, r) => a + mid(r), 0) || 100, scale = Math.max(1, 100 / sumMid);
    const inUse = new Set(rows.map(r => r.id));
    let us = (units || []).filter(u => u && u.keys && u.keys.length && (!onlyUse || u.row == null || inUse.has(u.row)));
    const pool = us.reduce((a, u) => a + u.keys.length, 0);
    const N = Math.min(Math.max(0, Math.floor(Number(n) || 0)), pool);
    const pb = Math.floor(Number(perBlock)) > 0 ? Math.floor(Number(perBlock)) : N, lens = [];
    for (let l = N; l > 0; l -= pb) lens.push(Math.min(pb, l));
    return { rand, rows, scale, us, N, lens };
  }
  const emptyPlan = () => ({ keys: [], sizes: [], blocks: [], perBlock: [], notes: [] });
  function finish(blockUnits, notes) {
    const keys = [], sizes = [], blocks = [], perBlock = [];
    blockUnits.forEach(list => {
      if (!list.length) return;
      const start = keys.length, cnt = {};
      list.forEach(u => { u.keys.forEach(k => keys.push(k)); sizes.push(u.keys.length); const r = u.row == null ? 'none' : u.row; cnt[r] = (cnt[r] || 0) + u.keys.length; });
      blocks.push([start, keys.length]); perBlock.push(cnt);
    });
    return { keys, sizes, blocks, perBlock, notes };
  }
  function interleave(list, rand) {
    const g = {}; list.forEach(u => { const r = u.row == null ? 'none' : u.row; (g[r] = g[r] || []).push(u); });
    const ids = Object.keys(g), out = []; let rem = list.length, last = null;
    while (rem) {
      const c = ids.filter(id => g[id].length && id !== last), forced = c.filter(id => g[id].length * 2 > rem);
      let id;
      if (forced.length) id = forced[0];
      else if (c.length) { let t = rand() * c.reduce((a, x) => a + g[x].length, 0); id = c[c.length - 1]; for (const x of c) { t -= g[x].length; if (t < 0) { id = x; break; } } }
      else id = last;
      out.push(g[id].shift()); last = id; rem--;
    }
    return out;
  }

  function planMix(units, n, perBlock, opts) {
    const S = setup(units, n, perBlock, opts, true), rand = S.rand, rows = S.rows, N = S.N, lens = S.lens, notes = [];
    if (!N) return emptyPlan();
    const list = {}, nullList = shuffled(S.us.filter(u => u.row == null), rand);
    rows.forEach(r => { list[r.id] = shuffled(S.us.filter(u => u.row === r.id), rand); });
    const capTotal = {}; rows.forEach(r => { capTotal[r.id] = lens.reduce((a, l) => a + capFor(r, S.scale, l), 0); });
    const taken = {}, picked = { none: [] }, sci = {}; let total = 0; rows.forEach(r => { taken[r.id] = 0; picked[r.id] = []; });
    const take = (id, lst, i) => { const u = lst.splice(i, 1)[0]; if (id) { picked[id].push(u); taken[id] += u.keys.length; } else picked.none.push(u); total += u.keys.length; u.sci && u.sci.forEach(c => { sci[c] = (sci[c] || 0) + u.keys.length; }); return u.keys.length; };
    const score = u => {
      let best = 0, first = true; const sz = u.keys.length;
      (u.sci || []).forEach(c => {
        const sc = BP_SCI[c]; if (!sc) return;
        let v = mid(sc) - 100 * (sci[c] || 0) / Math.max(1, total);
        if (100 * ((sci[c] || 0) + sz) / (total + sz) > sc.max) v -= 100;
        if (first || v > best) { best = v; first = false; }
      });
      return best;
    };
    const fill = (id, lst, want) => {
      let got = 0;
      while (want - got > 0) {
        let bi = -1, bs = -Infinity;
        for (let i = 0; i < lst.length; i++) { if (lst[i].keys.length > want - got) continue; const s = score(lst[i]); if (s > bs) { bs = s; bi = i; } }
        if (bi < 0) break;
        got += take(id, lst, bi);
      }
      return got;
    };
    // 1) quotas over the whole test, capped at the row's total per-block caps
    const quota = apportion(rows.map(mid), N, rows.map(r => capTotal[r.id]), rand);
    const shortBy = {}; let short = N - quota.reduce((a, b) => a + b, 0);
    rows.forEach((r, i) => { if (quota[i] > 0) { const got = fill(r.id, list[r.id], quota[i]); if (got < quota[i]) { shortBy[r.id] = quota[i] - got; short += quota[i] - got; } } });
    // one line, and none when the pool has no tagged questions at all (e.g. an Unassigned-only filter)
    const shortIds = rows.map(r => r.id).filter(id => shortBy[id]);
    if (shortIds.length && rows.some(r => list[r.id].length || taken[r.id])) notes.push('Short on ' + (shortIds.length > 3 ? shortIds.length + ' systems (' + shortIds.slice(0, 3).map(id => BP_ROW[id].short).join(', ') + ' …)' : shortIds.map(id => BP_ROW[id].short + ' (' + shortBy[id] + ')').join(', ')) + ' → filled from other systems');
    // 2) spill to rows still under their caps, in target proportion
    while (short > 0) {
      const el = rows.filter(r => capTotal[r.id] - taken[r.id] > 0 && list[r.id].length);
      if (!el.length) break;
      const al = apportion(el.map(mid), short, el.map(r => capTotal[r.id] - taken[r.id]), rand);
      let prog = 0; el.forEach((r, i) => { if (al[i] > 0) prog += fill(r.id, list[r.id], al[i]); });
      if (!prog) break; short -= prog;
    }
    // 3) unassigned units
    if (short > 0 && nullList.length) {
      const before = total; short -= fill(null, nullList, short);
      if (total > before && rows.some(r => taken[r.id])) notes.push((total - before) + ' unassigned question' + (total - before > 1 ? 's' : '') + ' used to top up');
    }
    // 4) caps may break
    while (short > 0) {
      const el = rows.filter(r => list[r.id].length);
      if (!el.length) break;
      const al = apportion(el.map(mid), short, el.map(r => list[r.id].reduce((a, u) => a + u.keys.length, 0)), rand);
      let prog = 0; el.forEach((r, i) => { if (al[i] > 0) prog += fill(r.id, list[r.id], al[i]); });
      if (!prog) break; short -= prog;
    }
    const broke = new Set(); rows.forEach(r => { if (taken[r.id] > capTotal[r.id]) broke.add(r.id); });
    // 5) deal into blocks (row by row, weights = remaining room), then order inside each block
    const room = lens.slice(), bu = lens.map(() => []), cnt = lens.map(() => ({}));
    const dealRows = rows.map(r => r.id).filter(id => picked[id].length).sort((a, b) => taken[b] - taken[a]);
    if (picked.none.length) dealRows.push('none');
    dealRows.forEach(id => {
      const r = BP_ROW[id], P = id === 'none' ? picked.none : picked[id], tot = P.reduce((a, u) => a + u.keys.length, 0);
      const cap = lens.map((l, b) => r ? capFor(r, S.scale, l) : l), cnt0 = lens.map(() => 0);
      const tg = apportion(room, tot, room.map((x, b) => Math.min(cap[b], x)), rand);
      const rest = tot - tg.reduce((a, b) => a + b, 0);
      if (rest > 0) apportion(room.map((x, b) => x - tg[b]), rest, null, rand).forEach((x, b) => { tg[b] += x; });
      P.forEach(u => {
        const sz = u.keys.length; let b = -1, bd = -Infinity;
        for (let k = 0; k < lens.length; k++) { if (room[k] >= sz && cnt0[k] + sz <= cap[k] && tg[k] - cnt0[k] > bd) { bd = tg[k] - cnt0[k]; b = k; } }
        if (b < 0) { for (let k = 0; k < lens.length; k++) { if (room[k] >= sz && tg[k] - cnt0[k] > bd) { bd = tg[k] - cnt0[k]; b = k; } } if (b >= 0 && r) broke.add(id); }
        if (b < 0) return;
        bu[b].push(u); room[b] -= sz; cnt0[b] += sz;
      });
    });
    if (broke.size) notes.push('Cap raised for ' + [...broke].map(id => BP_ROW[id].short).join(', ') + ' (pool too small)');
    return finish(bu.map(l => interleave(l, rand)), notes);
  }

  function planRandomCapped(units, n, perBlock, opts) {
    const S = setup(units, n, perBlock, opts, false), rand = S.rand, N = S.N, lens = S.lens, notes = [];
    if (!N) return emptyPlan();
    const rowBy = {}; S.rows.forEach(r => { rowBy[r.id] = r; });
    BLUEPRINT_STEP2.rows.forEach(r => { if (!rowBy[r.id]) rowBy[r.id] = r; });
    let rest = shuffled(S.us, rand); const bu = lens.map(() => []), left = lens.slice();
    const capOf = (u, l) => (u.row != null && rowBy[u.row]) ? capFor(rowBy[u.row], S.scale, l) : Infinity;
    lens.forEach((l, b) => {
      const cnt = {}, keep = [];
      rest.forEach(u => {
        const sz = u.keys.length;
        if (sz <= left[b] && (cnt[u.row] || 0) + sz <= capOf(u, l)) { bu[b].push(u); left[b] -= sz; cnt[u.row] = (cnt[u.row] || 0) + sz; } else keep.push(u);
      });
      rest = keep;
    });
    lens.forEach((l, b) => { if (left[b] > 0) rest = rest.filter(u => { const sz = u.keys.length; if (sz <= left[b]) { bu[b].push(u); left[b] -= sz; return false; } return true; }); });
    const real = new Set();
    bu.forEach((list, b) => { const c = {}; list.forEach(u => { if (u.row != null) c[u.row] = (c[u.row] || 0) + u.keys.length; }); Object.keys(c).forEach(id => { if (rowBy[id] && c[id] > capFor(rowBy[id], S.scale, lens[b])) real.add(id); }); });
    const rl = BLUEPRINT_STEP2.rows.filter(r => real.has(r.id)).map(r => r.short); if (rl.length) notes.push('Cap raised for ' + rl.join(', ') + ' (pool too small)');
    return finish(bu, notes);
  }

  const atOf = t => { const v = t && t.at; const n = typeof v === 'number' ? v : Date.parse(v); return isFinite(n) ? n : -Infinity; };
  function mergeTags(a, b) {
    const out = { fileType: 'ThunderQbankTags', v: 1, tags: {} };
    [a, b].forEach(f => {
      const tags = (f && f.tags) || {};
      Object.keys(tags).forEach(k => {
        const t = tags[k]; if (!t || typeof t !== 'object') return;
        const cur = out.tags[k];
        if (!cur || atOf(t) >= atOf(cur)) out.tags[k] = { system: t.system == null ? null : t.system, at: t.at };
      });
    });
    return out;
  }
  function fmtDuration(seconds) {
    const m = Math.round((Number(seconds) || 0) / 60), h = Math.floor(m / 60), mi = m % 60;
    return h ? h + ' h ' + String(mi).padStart(2, '0') + ' min' : mi + ' min';
  }

  // Same rule as the legacy picker: when nothing fits because every linked set is bigger than the count
  // (or the block), the first set is still taken whole rather than starting an empty test.
  function wholeSetFallback(plan, units, n, opts) {
    if (plan.keys.length || !(Number(n) > 0)) return plan;
    const us = (units || []).filter(u => u && u.keys && u.keys.length); if (!us.length) return plan;
    const rand = (opts && opts.rand) || Math.random, u = us[Math.floor(rand() * us.length)], c = {}; c[u.row == null ? 'none' : u.row] = u.keys.length;
    return { keys: u.keys.slice(), sizes: [u.keys.length], blocks: [[0, u.keys.length]], perBlock: [c], notes: ['Linked set kept whole: ' + u.keys.length + ' questions'] };
  }
  const planMixSafe = (units, n, perBlock, opts) => wholeSetFallback(planMix(units, n, perBlock, opts), units, n, opts);
  const planRandomCappedSafe = (units, n, perBlock, opts) => wholeSetFallback(planRandomCapped(units, n, perBlock, opts), units, n, opts);
  return { BLUEPRINT_STEP2, blueprintRow, clinicalSciencesOf, planMix: planMixSafe, planRandomCapped: planRandomCappedSafe, SYSTEMS, UNASSIGNED, BUILTIN_BANKS, normSystem, systemOf, subjectOf, suggestFromTopic, bankOf, statusOf, facets, matches, presets, mergeTags, fmtDuration };
});

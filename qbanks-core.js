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
    if (!s || /generated|inferred/i.test(s)) return UNASSIGNED;
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
    return { subject: pick(SUBJ_BY_SYS_LABEL, str(q.system || q.subject)) || 'Internal Medicine', from: 'inferred' };
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
  function facets(rows, sel) {
    rows = rows || []; sel = sel || {};
    const subjects = [...new Set(rows.map(r => r.subject))].sort();
    const systems = [...new Set(rows.map(r => r.system))].sort((a, b) => (a === UNASSIGNED) - (b === UNASSIGNED) || a.localeCompare(b));
    const subs = toSet(sel.subjects) || new Set(subjects), syss = toSet(sel.systems) || new Set(systems);
    const subCount = {}, sysCount = {}, subPerf = {}, sysPerf = {}, poolCount = {}, keys = [];
    subjects.forEach(s => { subCount[s] = 0; }); systems.forEach(s => { sysCount[s] = 0; });
    STATUSES.forEach(k => { poolCount[k] = 0; });
    let avail = 0;
    rows.forEach(r => {
      if (inStatuses(r, sel.statuses)) {
        subCount[r.subject]++;
        if (subs.has(r.subject)) { sysCount[r.system]++; if (syss.has(r.system)) { avail++; keys.push(r.key); } }
      }
      [[r.subject, subPerf], [r.system, sysPerf]].forEach(([k, map]) => {
        const p = map[k] || (map[k] = { n: 0, c: 0, w: 0, u: 0 }); p.n++;
        if (r.status === 'correct') p.c++; else if (r.status === 'incorrect' || r.status === 'omitted') p.w++; else p.u++;
      });
      if (poolCount[r.status] != null) poolCount[r.status]++;
      if (r.marked) poolCount.marked++;
    });
    return { subjects, systems, subCount, sysCount, subPerf, sysPerf, poolCount, avail, keys };
  }

  // model = facets() result computed with all statuses ticked (needs systems, sysPerf, poolCount).
  // apply.subjects/systems: null = everything available.
  function presets(m) {
    m = m || {};
    const sp = m.sysPerf || {}, pc = m.poolCount || {};
    const weak = (m.systems || []).filter(s => s !== UNASSIGNED && pctOf(sp[s]) != null && sp[s].c + sp[s].w >= 10)
      .sort((a, b) => pctOf(sp[a]) - pctOf(sp[b])).slice(0, 3);
    return [
      { id: 'fresh', title: 'Fresh 40', detail: 'Unused · everything', disabled: false, apply: { statuses: ['unused'], subjects: null, systems: null, count: 40 } },
      { id: 'weak', title: 'Weak spots', detail: weak.length ? weak.join(', ') : 'needs answered questions', disabled: !weak.length, apply: { statuses: ['unused', 'incorrect'], subjects: null, systems: weak, count: 40 } },
      { id: 'redo', title: 'Redo misses', detail: 'Incorrect + marked · ' + ((pc.incorrect || 0) + (pc.marked || 0)), disabled: false, apply: { statuses: ['incorrect', 'marked', 'omitted'], subjects: null, systems: null, count: 40 } },
      { id: 'sim', title: 'Exam block', detail: '40 unused · Timed 90 s', disabled: false, apply: { statuses: ['unused'], subjects: null, systems: null, mode: 'timed', secs: 90, count: 40, perBlock: 40 } }];
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

  return { SYSTEMS, UNASSIGNED, BUILTIN_BANKS, normSystem, systemOf, subjectOf, suggestFromTopic, bankOf, statusOf, facets, matches, presets, mergeTags, fmtDuration };
});

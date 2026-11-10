/* ThunderShadow logger for the Review screen (one file, meant to be identical in the Local and iPad apps).
   A floating bar between the question area and the exam's bottom bar. It takes its own space (the question area gets
   shorter by the strip's height), so it never covers the question, the explanation or the exhibit.
   One tap on an error code logs the question; the reasoning pattern chips then take its place in the same bar (second tap).
   The study note opens a small editor above the bar only while you write (Enter, Done or a tap outside closes it); speed flags sit beside it.
   Exam Settings menu: "ThunderShadow" switch (ShadowLogger.settingHtml(), key ThunderShadowLog.off).
   The form, date and simulator item (block.item) are filled in from the attempt.
   Export: the 13 columns of ThunderShadow's own "Form log TSV" (js/browser-api.js formToTsv), so one importer reads both.
   Storage: progress/<id>_shadow_log.json beside the attempt (Local: DATA/progress, iPad: the library, synced by Sync v3 as v3.t.* files),
   with localStorage "ThunderShadowLog.v1" as the instant cache and first-run source. See the storage section below. */
(function(){
  'use strict';
  const STORE = 'ThunderShadowLog.v1', OFF = 'ThunderShadowLog.off';
  // value, short label, shorter label (narrow strip), full ThunderShadow label, definition
  const ERR = [
    ['1', 'Careless', 'Careless', 'Careless / misread', 'Missed wording, negation, task, units, or a visible clue.'],
    ['2', 'Knowledge gap', 'Gap', 'Knowledge gap', 'Required fact, diagnosis, or management step was not known.'],
    ['3', 'Misapplied', 'Trapped', 'Misapplied / trapped', 'Concept was known, but applied incorrectly or a distractor won.'],
    ['4', 'Differential', 'Diff.', 'Differential confusion', 'Could not separate two clinically close choices.'],
    ['5', 'Between two', 'Between 2', 'Correct but between two', 'Correct answer with unresolved differential uncertainty.'],
    ['6', 'Lucky', 'Lucky', 'Lucky correct / no idea', 'Correct answer without a reliable reasoning pathway.'],
    ['7', 'Shaky', 'Shaky', 'Shaky / trap-prone', 'Correct, but the reasoning was unstable or vulnerable to a trap.']
  ];
  // value, code, label (ThunderShadow writes "code — label" in Rule_Pattern and Speed_Flags), colour, definition, note prompt
  const PAT = [
    ['task_target', 'P1', 'TASK', '#3B82F6', 'Solved a different question from the one NBME asked.', 'What did the question ask, and what did you answer instead?'],
    ['stability_urgency', 'P2', 'STABILITY', '#E11D48', 'Failed to classify instability, acuity, or an immediate threat before choosing the pathway.', 'Which instability or emergency clue did you miss?'],
    ['sequence_nbs', 'P3', 'SEQUENCE', '#F59E0B', 'Recognized the clinical problem but selected the wrong stage of diagnosis or management.', 'Which step did you choose, and which step was actually required?'],
    ['frame_assumption', 'P4', 'FRAME', '#8B5CF6', 'Built the wrong illness script or added an unsupported assumption before comparing choices.', 'What illness script or unsupported assumption changed the case?'],
    ['hinge_discriminator', 'P5', 'HINGE', '#14B8A6', 'The candidate answers were reasonable, but the decisive discriminator was missed or underweighted.', 'Which option won, and what clue should have separated it?'],
    ['timeline_course', 'P6', 'TIMELINE', '#6366F1', 'The timing, onset, duration, progression, event order, or treatment exposure determined the answer.', 'Which timing relationship did you overlook?'],
    ['modifier_constraint', 'P7', 'MODIFIER', '#22C55E', 'Knew the usual rule but failed to adjust it for a patient-specific constraint or context.', 'Which patient-specific factor changed the usual pathway?']
  ];
  const SPD = [['rushed', 'S1', 'RUSHED'], ['overthought', 'S2', 'OVERTHOUGHT'], ['reread_loop', 'S3', 'RE-READ LOOP'], ['changed_answer', 'S4', 'CHANGED ANSWER'], ['slow_recall', 'S5', 'SLOW RECALL'], ['fatigue_attention', 'S6', 'FATIGUE/ATTENTION']];
  const HEADERS = ['ThunderShadowID', 'Form', 'Date', 'Entry_Number', 'Error_Code', 'Rule_Pattern', 'Speed_Flags', 'Reasoning_Note', 'Note_Type', 'Form_ID', 'Note_ID', 'Rule_Text', 'Exam_Item'];

  const ls = {get: k => { try{ return localStorage.getItem(k); }catch(e){ return null; } }, set: (k, v) => { try{ localStorage.setItem(k, v); return true; }catch(e){ return false; } }};
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  const byId = id => document.getElementById(id);
  const I = {
    bolt: '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><path d="M13.5 2 4 13.5h6L9.5 22 20 9.5h-6.2L13.5 2z"/></svg>',
    tick: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    pen: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3z"/><path d="M14.5 7.5l3 3"/></svg>',
    up: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>',
    down: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11"/><path d="M7 11l5 5 5-5"/><path d="M5 20h14"/></svg>',
    list: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11"/><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" stroke-width="3"/></svg>',
    x: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    go: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h13"/><path d="M13 6l6 6-6 6"/></svg>',
    bin: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/></svg>'
  };

  /* ---------- storage ----------
     Truth = one file per form: progress/<id>_shadow_log.json (Local: DATA/progress; iPad: the same path in the browser library, which Sync v3
     carries through the Drive). localStorage "ThunderShadowLog.v1" stays as the instant write-through cache and the first-run source:
     every start merges it into the files, so older logs migrate without loss and without duplicates (merge is keyed per form/attempt/question).
     Merge rule: per question the newer updatedAt wins; deleting writes a tombstone ({deleted:true, updatedAt}) so a delete is not undone by another device. */
  let db = {forms: {}}, sheetDraw = null; // sheetDraw: redraws the open log sheet
  try{ const v = JSON.parse(ls.get(STORE)); if(v && v.forms && typeof v.forms === 'object') db = v; }catch(e){}
  const dirty = new Set(), fileDirty = new Set();
  let lsOk = true, fileOk = null; // fileOk: null = not tried yet
  const isIpad = () => window.__STEP_SIM_STORAGE_PROFILE === 'ipad-browser-library-primary';
  let lastStamp = '';
  const stampAfter = prev => { let t = new Date().toISOString(); if(t <= lastStamp) t = new Date(Date.parse(lastStamp) + 1).toISOString(); if(prev && t <= prev) t = new Date(Date.parse(prev) + 1).toISOString(); return lastStamp = t; };
  const sortKeys = v => Array.isArray(v) ? v.map(sortKeys) : v && typeof v === 'object' ? Object.keys(v).sort().reduce((o, k) => { o[k] = sortKeys(v[k]); return o; }, {}) : v;
  const canon = v => JSON.stringify(sortKeys(v));
  const isLogged = e => !!(e && (e.errorCode || e.pattern || (e.note || '').trim() || (e.speedFlags || []).length));
  const mergeEntry = (a, b) => { if(!a) return b; if(!b) return a; const x = a.updatedAt || '', y = b.updatedAt || ''; return x !== y ? (x > y ? a : b) : (canon(a) >= canon(b) ? a : b); };
  const stampOf = b => Object.values(b.entries || {}).reduce((m, e) => (e && e.updatedAt && e.updatedAt > m ? e.updatedAt : m), '');
  function mergeBucket(a, b){
    if(!a) return b; if(!b) return a;
    const entries = {};
    new Set(Object.keys(a.entries || {}).concat(Object.keys(b.entries || {}))).forEach(k => { entries[k] = mergeEntry((a.entries || {})[k], (b.entries || {})[k]); });
    const sa = stampOf(a), sb = stampOf(b), meta = x => canon({formId: x.formId, form: x.form, date: x.date});
    const m = sa !== sb ? (sa > sb ? a : b) : (meta(a) >= meta(b) ? a : b);
    return {formId: m.formId, form: m.form, date: m.date, entries};
  }
  function mergeForms(x, y){ const out = {}; new Set(Object.keys(x || {}).concat(Object.keys(y || {}))).forEach(k => { out[k] = mergeBucket((x || {})[k], (y || {})[k]); }); return out; }
  // file layer: one file per formId; names stay [A-Za-z0-9_-] so they are safe on both platforms and in Drive file names
  const hash8 = s => { let h = 0x811c9dc5; for(let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); };
  const fileIdOf = formId => { const s = String(formId == null ? '' : formId), safe = s.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'log'; return safe === s ? s : safe + '-' + hash8(s); };
  const fileText = (id, buckets) => canon({type: 'ThunderShadowLog', v: 2, id, buckets});
  const MAXB = 2 * 1024 * 1024;
  function parseFile(text, id){
    const d = JSON.parse(text);
    if(!d || d.type !== 'ThunderShadowLog' || String(d.id) !== id || !d.buckets || typeof d.buckets !== 'object' || Array.isArray(d.buckets)) throw new Error('not a ThunderShadow log file for ' + id);
    const out = {};
    Object.keys(d.buckets).forEach(k => { const b = d.buckets[k]; if(b && typeof b === 'object' && b.entries && typeof b.entries === 'object' && !Array.isArray(b.entries)) out[k] = {formId: String(b.formId == null ? '' : b.formId), form: String(b.form == null ? '' : b.form), date: String(b.date == null ? '' : b.date), entries: b.entries}; });
    return out;
  }
  const fileIdOfBucket = (k, b) => b && b.formId === 'QBANK_MODE' ? 'QBANK_MODE-' + hash8(String(k)) : fileIdOf(b && b.formId); // one file per Qbank session keeps files small
  const groupsOfDb = () => { const g = new Map(); Object.keys(db.forms).forEach(k => { const id = fileIdOfBucket(k, db.forms[k]); if(!g.has(id)) g.set(id, {}); g.get(id)[k] = db.forms[k]; }); return g; };
  const idbOpen = (name, store, opt) => new Promise((ok, no) => {
    const r = indexedDB.open(name, 1); r.onupgradeneeded = () => { if(!r.result.objectStoreNames.contains(store)) r.result.createObjectStore(store, opt); };
    r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
  });
  const EPOCH = '__stepsim_internal__/epoch', FDIR = 'progress', fpath = id => FDIR + '/' + id + '_shadow_log.json', FRE = /^(.+)_shadow_log\.json$/;
  const ipadTx = (mode, fn) => idbOpen('StepExamSimulatorV784_A4_iPadBrowserLibrary_DB', 'files', {keyPath: 'path'}).then(d => new Promise((ok, no) => {
    const t = d.transaction('files', mode); let out;
    try{ out = fn(t.objectStore('files')); }catch(e){ t.abort(); d.close(); no(e); return; }
    t.oncomplete = () => { d.close(); ok(typeof out === 'function' ? out() : out); }; t.onabort = t.onerror = () => { d.close(); no(t.error); };
  }));
  let rootH = null;
  async function localRoot(){
    const hook = window.SHADOW_LOG_DIR || window.RAPID_REVIEW_DIR; // tests
    if(typeof hook === 'function') return await hook();
    if(rootH) return rootH;
    const d = await idbOpen('StepExamSimulatorV75_DATA_Handle_DB', 'handles'), h = await new Promise((ok, no) => { const q = d.transaction('handles', 'readonly').objectStore('handles').get('lastDataFolder'); q.onsuccess = () => ok(q.result || null); q.onerror = () => no(q.error); });
    d.close();
    if(!h || !h.queryPermission) throw new Error('DATA folder is not connected.');
    if(await h.queryPermission({mode: 'readwrite'}) !== 'granted') throw new Error('DATA folder permission is not granted.');
    return rootH = h;
  }
  const missing = e => e && e.name === 'NotFoundError';
  const fstore = {
    async ids(){
      if(isIpad()) return await ipadTx('readonly', s => { const q = s.getAllKeys(); return () => q.result.map(k => /^progress\/([^/]+_shadow_log\.json)$/.exec(String(k))).filter(Boolean).map(m => FRE.exec(m[1])[1]); });
      const out = []; try{ for await (const [name] of (await (await localRoot()).getDirectoryHandle(FDIR)).entries()){ const m = FRE.exec(name); if(m) out.push(m[1]); } }catch(e){ if(!missing(e)) throw e; }
      return out;
    },
    async read(id){
      if(isIpad()){ const b = await ipadTx('readonly', s => { const q = s.get(fpath(id)); return () => q.result && q.result.blob ? q.result.blob : null; }); return b ? await b.text() : null; }
      try{ return await (await (await (await (await localRoot()).getDirectoryHandle(FDIR)).getFileHandle(id + '_shadow_log.json')).getFile()).text(); }catch(e){ if(missing(e)) return null; throw e; }
    },
    async write(id, text){
      const blob = new Blob([text], {type: 'application/json'});
      if(isIpad()){
        if(window.__STEP_FORM_UPDATE_WRITING || window.__STEP_FORM_UPDATE_COMMITTING) throw new Error('form installation is running');
        return await ipadTx('readwrite', s => { s.put({path: fpath(id), blob, updatedAt: Date.now(), type: 'application/json'}); const e = s.get(EPOCH); e.onsuccess = () => s.put({path: EPOCH, value: (e.result && e.result.value || 0) + 1}); });
      }
      const w = await (await (await (await localRoot()).getDirectoryHandle(FDIR, {create: true})).getFileHandle(id + '_shadow_log.json', {create: true})).createWritable();
      await w.write(blob); await w.close();
    }
  };
  const fileTexts = new Map(); // what each file held when we last read or wrote it
  let syncing = null, again = null, retry = false;
  // Merge the files (all, or just `only`) with what this page holds, adopt what is new, write back what differs. Returns a promise.
  function syncFiles(only, quiet){
    if(syncing){ again = {only: again ? (again.only && only ? again.only.concat(only) : null) : only, quiet: !!quiet && (!again || again.quiet)}; return syncing; }
    syncing = (async () => {
      let wrote = false, adopted = false, failed = false;
      try{
        const ids = only ? new Set(only) : new Set((await fstore.ids()).concat(Array.from(groupsOfDb().keys())));
        for(const id of ids){
          fileTexts.delete(id); // set again only when this pass really read/wrote the file
          let text = null, fileBuckets = {};
          try{ text = await fstore.read(id); fileBuckets = text ? parseFile(text, id) : {}; }
          catch(e){ failed = true; continue; } // one unreadable file never blocks the others (it is left untouched)
          // from here to the write nothing awaits before the merge, so a tap during the write is caught by the next pass (fileDirty)
          const mine = groupsOfDb().get(id) || {}, merged = mergeForms(fileBuckets, mine);
          Object.keys(merged).forEach(k => { if(!db.forms[k] || canon(db.forms[k]) !== canon(merged[k])){ db.forms[k] = merged[k]; adopted = true; } });
          const next = fileText(id, merged);
          fileDirty.delete(id);
          if(next !== text){ try{ await fstore.write(id, next); wrote = true; }catch(e){ failed = true; fileDirty.add(id); retry = true; continue; } }
          fileTexts.set(id, next);
        }
      }catch(e){ failed = true; }
      fileOk = !failed;
      if(retry){ retry = false; setTimeout(scheduleFlush, 5000); }
      if(adopted){ lsOk = ls.set(STORE, JSON.stringify({forms: mergeForms(readStore().forms, db.forms)})); curKey = ''; }
      showSaveState(); if(adopted) schedule();
      if(wrote && !quiet) try{ window.dispatchEvent(new CustomEvent('stepsim:shadowlog-write', {detail: {kind: 'shadowlog'}})); }catch(e){}
    })().finally(() => { syncing = null; if(again){ const a = again; again = null; syncFiles(a.only, a.quiet); } });
    return syncing;
  }
  const settled = async p => { await p; while(syncing) await syncing; };
  let flushTimer = 0;
  const scheduleFlush = () => { clearTimeout(flushTimer); flushTimer = setTimeout(() => { flushTimer = 0; const ids = Array.from(fileDirty); syncFiles(ids.length ? ids : null); }, 500); };
  const readStore = () => { const raw = ls.get(STORE); if(raw == null) return {forms: {}}; try{ const v = JSON.parse(raw); if(v && v.forms && typeof v.forms === 'object') return v; }catch(e){} return {forms: {}}; };
  // Every change: merge it into the cache (keeps another tab's changes), then queue the file write.
  function persist(key){
    if(key){ dirty.add(key); const b = db.forms[key]; if(b) fileDirty.add(fileIdOfBucket(key, b)); }
    const stored = readStore();
    dirty.forEach(k => { if(db.forms[k]) db.forms[k] = mergeBucket(stored.forms[k], db.forms[k]); });
    lsOk = ls.set(STORE, JSON.stringify({forms: mergeForms(stored.forms, db.forms)}));
    if(lsOk) dirty.clear();
    showSaveState(); scheduleFlush();
    return lsOk;
  }
  const saveOk = () => lsOk || fileOk === true;
  function showSaveState(){ const w = byId('tslWarn'); if(w) w.hidden = saveOk(); if(sheet && sheetDraw) sheetDraw(); }
  const whereText = () => isIpad() ? (fileOk === false ? 'saved in this browser' : 'saved on this device and synced through Google Drive') : fileOk ? 'saved in DATA/progress as you tap' : fileOk === false ? 'saved in this browser; connect the DATA folder to save it in DATA/progress' : 'saved on this device as you tap';
  const blank = c => ({examItem: c.code, block: c.block, item: c.item, qid: c.qid, errorCode: '', pattern: '', speedFlags: [], note: '', noteKind: 'clinical', isCorrect: c.isCorrect, createdAt: null, updatedAt: null});
  const tomb = (e, prev) => ({examItem: e.examItem, block: e.block, item: e.item, entryNumber: e.entryNumber, deleted: true, updatedAt: stampAfter(prev && prev.updatedAt)});

  /* ---------- what is on screen ---------- */
  const localDay = iso => { const d = iso ? new Date(iso) : new Date(); const t = isNaN(d) ? new Date() : d; return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); };
  // null unless a question is open in Review mode. Reads the same globals item-code.js and rapid-review.js read.
  function ctx(){
    try{
      if(ls.get(OFF) === '1' || !reviewMode) return null;
      const scr = byId('examScreen'), ws = byId('workspace');
      if(!scr || !ws || scr.classList.contains('hidden') || !ws.querySelector('.question-stack')) return null;
      const block = Number(blockPointer) + 1, item = Number(state.current) + 1;
      if(!(block >= 1) || !(item >= 1)) return null;
      const q = (questions || [])[state.current] || {}, s = activeSession || {};
      const res = (Array.isArray(state.results) ? state.results : []).find(r => r && Number(r.blockIndex) === block);
      const a = res && Array.isArray(res.answers) ? res.answers.find(x => x && Number(x.item) === item) : null;
      const chosen = a ? a.chosen : (state.answers ? state.answers[state.current] : null);
      const answered = chosen != null && chosen !== '';
      const isCorrect = a ? !!a.isCorrect : (answered && Number(chosen) === Number(q.correct));
      let form = String(s.libraryFormName || s.libraryFormId || (typeof importedBank === 'object' && importedBank && (importedBank.librarySlotId || importedBank.title)) || s.title || 'Simulator').trim();
      const label = String(s.attemptLabel || '').trim();
      if(label && s.attemptType && s.attemptType !== 'initial') form += ' (' + label + ')';
      let formId = String(s.libraryFormId || form), key = formId + '::' + String(s.attemptId || s.sessionId || 'session');
      // Qbank review sessions mix forms: one log per session (keyed on its start time), named "<session title> <date>"
      const qbank = !!s.qbankMode;
      if(qbank){ formId = 'QBANK_MODE'; form = String(s.qbankTestName || s.title || 'Qbank Mode').trim() + ' ' + localDay(s.startedAt); key = 'QBANK_MODE::' + String(s.startedAt || s.sessionId || 'session'); }
      let before = 0; try{ for(let i = 0; i < block - 1; i++) before += ((activeBlocks[i] || {}).questions || []).length; }catch(e){}
      return {
        key, formId, form: form.slice(0, 80), date: localDay(qbank ? s.startedAt : (s.completedAt || s.startedAt)), qbank, entryNumber: before + item,
        block, item, code: block + '.' + String(item).padStart(2, '0'), qid: q.qid == null ? '' : String(q.qid),
        answered, isCorrect, changed: !!(a && a.changed), seconds: a && Number(a.questionTimeSeconds) >= 0 ? Number(a.questionTimeSeconds) : null
      };
    }catch(e){ return null; }
  }

  /* ---------- styles ---------- */
  const css = `
#tslDock{--bg:#fff;--line:#dfe4ec;--fg:#131a26;--sub:#667085;--chip:#f0f2f7;--hover:#e3e7f0;--sel:#1d4f91;--selfg:#fff;--ok:#1a7f4b;--field:#f5f6fa;--shadow:0 1px 2px rgba(16,24,40,.06),0 8px 24px rgba(16,24,40,.12);--h:36px;
  position:fixed;right:0;z-index:6;box-sizing:border-box;margin:0;padding:6px 10px 8px;background:transparent;color:var(--fg);font:13px/1.25 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,Arial,sans-serif;-webkit-text-size-adjust:100%;text-align:left;pointer-events:none}
#tslDock > *{pointer-events:auto}
#tslDock[hidden],#tslDock [hidden]{display:none!important}
#tslDock *{box-sizing:border-box}
#examScreen:is(.reverse,.exam-dark) #tslDock{--bg:#121a21;--line:#2c3c48;--fg:#e9f2f6;--sub:#9db2bf;--chip:#1d2933;--hover:#283845;--sel:#7fd4f1;--selfg:#04222c;--ok:#5fd08f;--field:#1d2933;--shadow:0 1px 2px rgba(0,0,0,.4),0 8px 24px rgba(0,0,0,.5)}
:root[data-tu-exam="modern"] #tslDock{--bg:var(--tu-surface,#fff);--line:var(--tu-line2,#e4e7f0);--fg:var(--tu-on,#161a25);--sub:var(--tu-on3,#5f6679);--chip:var(--tu-s1,#eff1f7);--hover:var(--tu-s3,#dce0ec);--sel:var(--tu-p,#9a2a3a);--selfg:var(--tu-onp,#fff);--ok:var(--tu-ok,#17683d);--field:var(--tu-s1,#eff1f7);font-family:var(--tu-font,inherit)}
@media (pointer:coarse){#tslDock{--h:42px}}
#tslDock button{all:unset;box-sizing:border-box;cursor:pointer;font:inherit;color:inherit;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}
#tslDock button:focus-visible,#tslDock textarea:focus-visible{outline:2px solid var(--sel);outline-offset:1px}
#tslDock .tsl-bar,#tslDock .tsl-tray{background:var(--bg);border:1px solid var(--line);border-radius:18px;box-shadow:var(--shadow)}
#tslDock .tsl-bar{display:flex;align-items:center;gap:8px;padding:6px;min-width:0}
#tslDock .tsl-id{flex:none;display:inline-flex;align-items:center;gap:6px;height:var(--h);padding:0 6px 0 8px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}
#tslDock .tsl-id > svg{color:var(--sel)}
#tslDock .tsl-tick{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;background:var(--ok);color:var(--bg)}
#tslDock .tsl-flow{flex:0 1 auto;min-width:0;display:flex;align-items:center;gap:6px;padding:2px;overflow-x:auto;overscroll-behavior-x:contain;scrollbar-width:none;-webkit-overflow-scrolling:touch}
#tslDock .tsl-flow::-webkit-scrollbar{display:none}
#tslDock .tsl-flow[data-more="1"]{-webkit-mask-image:linear-gradient(90deg,#000 calc(100% - 34px),transparent);mask-image:linear-gradient(90deg,#000 calc(100% - 34px),transparent)}
#tslDock .tsl-group{display:flex;align-items:center;gap:6px;flex:none}
#tslDock .tsl-lbl{flex:none;padding:0 2px 0 4px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--sub);white-space:nowrap}
#tslDock .tsl-chip{flex:none;display:inline-flex;align-items:center;gap:7px;height:var(--h);padding:0 14px 0 7px;border-radius:999px;background:var(--chip);color:var(--fg);white-space:nowrap;font-weight:600;transition:background .12s,box-shadow .12s,transform .08s}
#tslDock .tsl-chip:hover{background:var(--hover)}
#tslDock .tsl-chip:active{transform:scale(.96)}
#tslDock .tsl-chip > b{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;padding:0 5px;border-radius:999px;background:var(--bg);font-size:12px;font-weight:800;font-variant-numeric:tabular-nums}
#tslDock .tsl-chip[aria-checked="true"],#tslDock .tsl-chip[aria-pressed="true"],#tslDock .tsl-sum.tsl-err{background:var(--sel);color:var(--selfg)}
#tslDock .tsl-chip[aria-checked="true"] > b,#tslDock .tsl-chip[aria-pressed="true"] > b,#tslDock .tsl-sum.tsl-err > b{background:color-mix(in srgb,var(--selfg) 22%,transparent)}
#tslDock .tsl-chip .l-short{display:none}
#tslDock[data-tight="1"] .tsl-flow .tsl-lbl{display:none}
#tslDock[data-tight="1"] .tsl-flow{gap:5px}
#tslDock[data-tight="1"] .tsl-group{gap:5px}
#tslDock[data-tight="1"] .tsl-group .tsl-chip{padding-right:11px}
#tslDock .tsl-chip.tsl-ghost{padding:0 12px;background:transparent;box-shadow:inset 0 0 0 1px var(--line);color:var(--sub)}
#tslDock .tsl-chip.tsl-ghost:hover{background:var(--chip)}
#tslDock .tsl-pat{padding:0 14px 0 11px;background:color-mix(in srgb,var(--c) 12%,var(--bg))}
#tslDock .tsl-pat:hover{background:color-mix(in srgb,var(--c) 22%,var(--bg))}
#tslDock .tsl-pat > i{flex:none;width:9px;height:9px;border-radius:50%;background:var(--c)}
#tslDock .tsl-pat[aria-checked="true"],#tslDock .tsl-sum.tsl-pat{background:color-mix(in srgb,var(--c) 24%,var(--bg));color:var(--fg);box-shadow:inset 0 0 0 2px var(--c)}
#tslDock .tsl-spd.tsl-hint:not([aria-pressed="true"]){box-shadow:inset 0 0 0 1.5px var(--sel)}
#tslDock .tsl-spd.tsl-hint:not([aria-pressed="true"])::after{content:"from your attempt";font-weight:400;font-size:11px;color:var(--sub)}
#tslDock .tsl-notebtn{flex:1 0 170px;min-width:0;display:flex;align-items:center;gap:8px;height:var(--h);padding:0 12px;border-radius:999px;background:var(--field);color:var(--sub);cursor:text;box-shadow:inset 0 0 0 1px transparent;transition:box-shadow .12s}
#tslDock .tsl-notebtn:hover,#tslDock .tsl-notebtn[aria-expanded="true"]{box-shadow:inset 0 0 0 1.5px var(--sel)}
#tslDock .tsl-notebtn svg{flex:none}
#tslDock .tsl-notebtn .tsl-prev{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#tslDock .tsl-notebtn.has .tsl-prev{color:var(--fg)}
#tslDock .tsl-badges{flex:none;display:flex;gap:4px}
#tslDock .tsl-badges span{padding:2px 7px;border-radius:999px;background:var(--bg);color:var(--fg);font-size:11px;font-weight:700;white-space:nowrap}
#tslDock .tsl-log{flex:none;display:inline-flex;align-items:center;justify-content:center;gap:6px;height:var(--h);min-width:var(--h);padding:0 12px;border-radius:999px;background:var(--chip);font-weight:600;white-space:nowrap}
#tslDock .tsl-warn{flex:none;padding:3px 8px;border-radius:999px;background:#b42318;color:#fff;font-size:11px;font-weight:700;white-space:nowrap}
#tslDock .tsl-log:hover{background:var(--hover)}
#tslDock .tsl-log b{font-weight:800;font-variant-numeric:tabular-nums}
#tslDock .tsl-tray{display:flex;flex-direction:column;gap:8px;margin:0 0 6px;padding:8px;max-height:min(max(140px,calc(var(--tsl-vvh,100vh) - var(--tsl-dh,60px) - 40px)),320px);overflow:auto;-webkit-overflow-scrolling:touch;border-color:color-mix(in srgb,var(--sel) 45%,var(--line))}
#tslDock textarea{flex:none;display:block;width:100%;height:48px;min-height:48px;max-height:140px;margin:0;padding:10px 12px;border:0;border-radius:12px;background:var(--field);color:var(--fg);font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,Arial,sans-serif;resize:none;-webkit-appearance:none;appearance:none;outline:none}
:root[data-tu-exam="modern"] #tslDock textarea{font-family:var(--tu-font,inherit)}
@media (pointer:coarse){#tslDock textarea{font-size:16px}}
#tslDock textarea::placeholder{color:var(--sub);opacity:.85}
#tslDock .tsl-opts{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px}
#tslDock .tsl-speed{flex:1 1 auto;min-width:0;display:flex;flex-wrap:wrap;align-items:center;gap:6px}
#tslDock .tsl-tray .tsl-chip{height:calc(var(--h) - 6px);padding:0 12px;font-size:12px}
#tslDock .tsl-kind{flex:none;display:inline-flex;padding:3px;border-radius:999px;background:var(--chip)}
#tslDock .tsl-kind button{padding:4px 12px;border-radius:999px;font-size:12px;font-weight:600;color:var(--sub)}
#tslDock .tsl-kind button[aria-checked="true"]{background:var(--bg);color:var(--fg);box-shadow:0 1px 3px rgba(16,24,40,.18)}
#tslDock .tsl-done{flex:none;margin-left:auto;display:inline-flex;align-items:center;gap:7px;height:calc(var(--h) - 4px);padding:0 14px;border-radius:999px;background:var(--sel);color:var(--selfg);font-weight:700}
#tslDock .tsl-done:hover{filter:brightness(1.08)}
#tslDock .tsl-done kbd{font:inherit;font-weight:400;opacity:.75}
@media (pointer:coarse){#tslDock .tsl-done kbd{display:none}}
/* mid: iPad portrait and narrow side-by-side windows */
#tslDock[data-size="mid"] .tsl-notebtn{flex:1 0 120px}
#tslDock[data-size="mid"] .tsl-badges,#tslDock[data-size="mid"] .tsl-log .tsl-word,#tslDock[data-size="narrow"] .tsl-log .tsl-word{display:none}
/* narrow: phones. The chips scroll sideways; the note is an icon. */
#tslDock[data-size="narrow"]{padding:4px 6px 6px}
#tslDock[data-size="narrow"] .tsl-bar{gap:5px;padding:5px}
#tslDock[data-size="narrow"] #tslItem,#tslDock[data-size="narrow"] .tsl-flow .tsl-lbl,#tslDock[data-size="narrow"] .tsl-badges{display:none}
#tslDock[data-size="narrow"] .tsl-id{padding:0 2px 0 6px}
#tslDock[data-size="narrow"] .tsl-flow,#tslDock:not([data-stage="done"]) .tsl-flow{flex:1 1 auto}
/* while the chips are showing, the note shrinks to its icon so every chip fits */
#tslDock[data-size="narrow"] .tsl-notebtn,#tslDock:not([data-stage="done"]) .tsl-notebtn{flex:none;width:var(--h);padding:0;justify-content:center;cursor:pointer;position:relative}
#tslDock[data-size="narrow"] .tsl-notebtn .tsl-prev,#tslDock:not([data-stage="done"]) .tsl-notebtn .tsl-prev,#tslDock:not([data-stage="done"]) .tsl-badges{display:none}
#tslDock[data-size="narrow"] .tsl-notebtn.has::after,#tslDock:not([data-stage="done"]) .tsl-notebtn.has::after{content:"";position:absolute;top:7px;right:7px;width:8px;height:8px;border-radius:50%;background:var(--sel)}
#tslDock[data-size="narrow"] .tsl-log{padding:0 10px}
#tslDock .tsl-chip > b{flex:none}
#tslDock .tsl-sum{flex:0 1 auto;min-width:0;max-width:100%}
#tslDock .tsl-sum .tsl-nm{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#tslDock .tsl-sum.tsl-err{padding-right:12px}
#tslDock[data-size="narrow"] .tsl-sum.tsl-err{padding:0 9px 0 6px}
#tslDock[data-size="narrow"] .tsl-sum.tsl-err .l-full{display:none}
#tslDock[data-size="narrow"] .tsl-sum.tsl-err .l-short{display:inline}
#tslDock[data-size="narrow"] .tsl-sum.tsl-pat{padding:0 9px 0 10px}
/* done on phones: the pills share the row and shrink with an ellipsis; the note icon never overlaps them (it wraps to its own row if the row is too tight) */
#tslDock[data-size="narrow"][data-stage="done"] .tsl-bar{flex-wrap:wrap}
#tslDock[data-size="narrow"][data-stage="done"] .tsl-flow{flex:1 1 170px;min-width:0;overflow:hidden;-webkit-mask-image:none;mask-image:none}
#tslDock[data-size="narrow"][data-stage="done"] .tsl-notebtn{margin-left:auto}
/* optional hint on the pattern step */
#tslDock .tsl-lbl .o{display:none}
#tslDock[data-stage="pattern"] .tsl-lbl .o{display:inline;margin-left:4px;font-weight:500;letter-spacing:.02em;text-transform:none;opacity:.9}
#tslDock[data-stage="pattern"] .tsl-lbl .o::before{content:"· "}
#tslDock[data-size="narrow"][data-stage="pattern"] .tsl-flow .tsl-lbl{display:inline-block;padding:0 4px}
#tslDock[data-size="narrow"][data-stage="pattern"] .tsl-lbl .w{display:none}
#tslDock[data-size="narrow"][data-stage="pattern"] .tsl-lbl .o{margin:0;font-size:12px}
#tslDock[data-size="narrow"][data-stage="pattern"] .tsl-lbl .o::before{content:""}
/* phones: the note editor never takes more than ~40% of the visible screen; it scrolls inside */
#tslDock[data-size="narrow"] .tsl-tray{max-height:max(120px,calc(var(--tsl-vvh,100vh) * .4))}#tslDock[data-size="narrow"] textarea{max-height:min(140px,max(120px,calc(var(--tsl-vvh,100vh) * .4)))}
/* phones: the chips of the current step wrap onto their own rows under the bar's first row, so none is off-screen */
#tslDock[data-size="narrow"]:not([data-stage="done"]) .tsl-bar{flex-wrap:wrap}
#tslDock[data-size="narrow"]:not([data-stage="done"]) .tsl-flow{display:contents}
#tslDock[data-size="narrow"]:not([data-stage="done"]) .tsl-notebtn{margin-left:auto}
#tslDock[data-size="narrow"]:not([data-stage="done"]) .tsl-group{order:5;flex:1 0 100%;flex-wrap:wrap;gap:5px;padding:1px 1px 2px}
#tslDock[data-size="narrow"]:not([data-stage="done"]) .tsl-group .tsl-chip{height:36px;padding-right:11px}
#tslSheet{position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(10,18,28,.45);font:14px/1.35 -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;color:#17202b}
#tslSheet *{box-sizing:border-box}
#tslSheet .tsl-card{display:flex;flex-direction:column;width:min(860px,100%);max-height:min(86vh,720px);max-height:min(88dvh,720px);background:#fff;border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.3);overflow:hidden}
#tslSheet header{display:flex;align-items:flex-start;gap:12px;padding:16px 18px 12px;border-bottom:1px solid #e3e8ee}
#tslSheet header div{flex:1;min-width:0}
#tslSheet h3{margin:0 0 2px;font-size:17px;font-weight:700}
#tslSheet header p{margin:0;color:#56646f;font-size:13px}
#tslSheet button{all:unset;box-sizing:border-box;cursor:pointer;font:inherit}
#tslSheet button:focus-visible{outline:2px solid #004976;outline-offset:2px}
#tslSheet .tsl-close{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;color:#56646f}
#tslSheet .tsl-close:hover{background:#eef2f6}
#tslSheet .tsl-list{flex:1;overflow:auto;padding:4px 18px}
#tslSheet table{width:100%;border-collapse:collapse;font-size:13px}
#tslSheet th{position:sticky;top:0;background:#fff;text-align:left;padding:8px 8px 6px 0;font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:#56646f;border-bottom:1px solid #e3e8ee;white-space:nowrap}
#tslSheet td{padding:8px 8px 8px 0;border-bottom:1px solid #eef1f5;vertical-align:top}
#tslSheet td.n{font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}
#tslSheet td.note{white-space:pre-wrap;overflow-wrap:anywhere;min-width:140px}
#tslSheet td.act{white-space:nowrap;text-align:right;padding-right:0}
#tslSheet .tsl-ib{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:8px;color:#56646f}
#tslSheet .tsl-ib:hover{background:#eef2f6;color:#17202b}
#tslSheet .tsl-cards{display:none;list-style:none;margin:0;padding:0}
#tslSheet .tsl-cards li{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 6px;padding:10px 0;border-bottom:1px solid #eef1f5}
#tslSheet .tsl-cards .h{display:flex;flex-wrap:wrap;align-items:baseline;gap:1px 8px;min-width:0}
#tslSheet .tsl-cards .n{font-weight:700;font-variant-numeric:tabular-nums}
#tslSheet .tsl-cards .s{color:#56646f;font-size:12px}
#tslSheet .tsl-cards .a{display:flex;align-items:flex-start}
#tslSheet .tsl-cards .t{grid-column:1/-1;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere;color:#2b3640}
#tslSheet .tsl-undo{display:inline;padding:0 2px;color:#004976;font-weight:700;text-decoration:underline}
#tslSheet .tsl-btn.danger{color:#b42318;border-color:#e3a8a2}
#tslSheet .tsl-btn.danger.pri{background:#b42318;border-color:#b42318;color:#fff}
#tslSheet .tsl-empty{padding:28px 0;text-align:center;color:#56646f}
#tslSheet footer{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:12px 18px;border-top:1px solid #e3e8ee;background:#f7f9fb}
#tslSheet footer .tsl-msg{flex:1;min-width:120px;color:#56646f;font-size:12.5px}
#tslSheet .tsl-btn{display:inline-flex;align-items:center;gap:7px;height:38px;padding:0 14px;border-radius:9px;border:1px solid #b3c2cf;background:#fff;font-weight:600;color:#17202b;white-space:nowrap}
#tslSheet .tsl-btn:hover{background:#eef2f6}
#tslSheet .tsl-btn.pri{background:#004976;border-color:#004976;color:#fff}
#tslSheet .tsl-btn.pri:hover{background:#0a5a8c}
#tslSheet .tsl-btn[aria-disabled="true"]{opacity:.45;pointer-events:none}
@media (max-width:640px){#tslSheet{padding:0;align-items:flex-end}#tslSheet .tsl-card{border-radius:14px 14px 0 0;max-height:88vh;max-height:88dvh}#tslSheet table{display:none}#tslSheet .tsl-cards{display:block}#tslSheet .tsl-list{padding:2px 14px}#tslSheet footer{gap:6px;padding:8px 14px}#tslSheet footer .tsl-msg{flex:1 0 100%}#tslSheet .tsl-btn{height:34px;padding:0 11px;font-size:13px}#tslSheet header{padding:12px 14px 10px}}
`;
  const st = document.createElement('style'); st.id = 'shadow-logger-css'; st.textContent = css; document.head.appendChild(st);

  /* ---------- the strip ----------
     One row that walks through the log: error code chips, then (as soon as a code is picked) the reasoning pattern chips
     in the same place, then two small pills showing what was picked. Nothing has to be opened for code or pattern.
     Only the study note and the speed flags live in the tray above the strip. */
  const title = s => s.charAt(0) + s.slice(1).toLowerCase();
  const errChip = e => `<button type="button" class="tsl-chip tsl-err" role="radio" aria-checked="false" data-code="${e[0]}" title="${esc(e[0] + ' ' + e[3] + '. ' + e[4])}" aria-label="${esc('Error code ' + e[0] + ': ' + e[3])}"><b>${e[0]}</b><span>${esc(e[1])}</span></button>`;
  const patChip = p => `<button type="button" class="tsl-chip tsl-pat" role="radio" aria-checked="false" data-pat="${p[0]}" style="--c:${p[3]}" title="${esc(p[1] + ' ' + p[2] + '. ' + p[4])}" aria-label="${esc('Reasoning pattern ' + p[1] + ': ' + p[2])}"><i></i><span>${esc(title(p[2]))}</span></button>`;
  const dock = document.createElement('section');
  dock.id = 'tslDock'; dock.hidden = true; dock.setAttribute('aria-label', 'ThunderShadow logger'); dock.dataset.size = 'wide'; dock.dataset.open = '0';
  dock.innerHTML = `
<div class="tsl-tray" id="tslPanel" hidden>
  <textarea id="tslNote" rows="2" maxlength="12000" spellcheck="true" autocapitalize="sentences" aria-label="Study note"></textarea>
  <div class="tsl-opts">
    <div class="tsl-kind" role="radiogroup" aria-label="Note type"><button type="button" role="radio" data-kind="clinical" aria-checked="true" title="A clinical rule for this topic">Clinical</button><button type="button" role="radio" data-kind="reasoning" aria-checked="false" title="A broad reasoning habit, not tied to one topic">Broad</button></div>
    <div class="tsl-speed" role="group" aria-label="Speed flags"><span class="tsl-lbl">Speed</span>${SPD.map(s => `<button type="button" class="tsl-chip tsl-spd" aria-pressed="false" data-spd="${s[0]}" title="${esc(s[1] + ' ' + s[2])}">${esc(title(s[2]))}</button>`).join('')}</div>
    <button type="button" class="tsl-done" data-act="done" title="Save the note and close (Enter). Shift+Enter adds a line. Cmd/Ctrl+Enter goes to the next question.">Done<kbd>↵</kbd></button>
  </div>
</div>
<div class="tsl-bar">
  <div class="tsl-id" title="ThunderShadow log · simulator item. Keys: 1–7 error code, Shift+1–7 reasoning, Alt+1–6 speed, N note.">${I.bolt}<span id="tslItem"></span><span class="tsl-tick" id="tslTick" role="img" hidden title="Logged" aria-label="Logged">${I.tick}</span></div>
  <div class="tsl-flow" id="tslFlow">
    <button type="button" class="tsl-chip tsl-sum tsl-err" id="tslSumCode" data-act="editcode" hidden></button>
    <button type="button" class="tsl-chip tsl-sum tsl-pat" id="tslSumPat" data-act="editpat" hidden></button>
    <span class="tsl-lbl" id="tslLbl"></span>
    <div class="tsl-group" id="tslCodes" role="radiogroup" aria-label="Error code">${ERR.map(errChip).join('')}<button type="button" class="tsl-chip tsl-ghost" data-act="allcodes" id="tslAll"></button></div>
    <div class="tsl-group" id="tslPats" role="radiogroup" aria-label="Reasoning pattern (optional)" title="Optional. Skip it with Next or Cmd/Ctrl+Enter." hidden>${PAT.map(patChip).join('')}</div>
  </div>
  <button type="button" class="tsl-notebtn" data-act="note" id="tslNoteBtn" aria-expanded="false" aria-controls="tslPanel" aria-label="Study note and speed flags" title="Study note and speed flags (N)">${I.pen}<span class="tsl-prev" id="tslPrev"></span><span class="tsl-badges" id="tslBadges"></span></button>
  <span class="tsl-warn" id="tslWarn" role="status" hidden>Not saved</span>
<button type="button" class="tsl-log" data-act="log" id="tslLog" title="Logged questions" aria-label="Logged questions">${I.list}<span><b id="tslCount">0</b><span class="tsl-word"> logged</span></span></button>
</div>`;

  let cur = null, lastC = null, curKey = '', showAll = false, view = '', raf = 0, sheet = null, noteTimer = 0;
  const $ = sel => dock.querySelector(sel), $$ = sel => Array.from(dock.querySelectorAll(sel));
  const setText = (el, t) => { if(el && el.textContent !== t) el.textContent = t; };
  const setHtml = (el, h) => { if(el && el.__h !== h){ el.__h = h; el.innerHTML = h; } };
  const setAttr = (el, k, v) => { if(el && el.getAttribute(k) !== v) el.setAttribute(k, v); };
  const setHidden = (el, h) => { if(el && el.hidden !== h) el.hidden = h; };
  const note = () => byId('tslNote');
  const bucketOf = c => db.forms[c.key];
  const countOf = c => { const b = bucketOf(c); return b ? Object.values(b.entries).filter(isLogged).length : 0; };

  function commit(c, quiet){
    if(!c || !cur || cur.__k !== c.key + '|' + c.code) return; // the working entry belongs to another question
    const now = new Date().toISOString();
    if(isLogged(cur)){
      const b = db.forms[c.key] || (db.forms[c.key] = {formId: c.formId, form: c.form, date: c.date, entries: {}});
      b.form = c.form; b.date = c.date;
      const prev = b.entries[c.code];
      delete cur.deleted; // an entry that carries content is live, whatever an older build left on it
      cur.createdAt = cur.createdAt || now; cur.updatedAt = stampAfter(prev && prev.updatedAt);
      if(!(cur.entryNumber > 0)) cur.entryNumber = c.entryNumber;
      b.entries[c.code] = cur;
    }else{
      const b = db.forms[c.key], prev = b && b.entries[c.code];
      if(prev && (isLogged(prev) || !prev.deleted)) b.entries[c.code] = tomb(prev, prev); // a removed answer stays as a tombstone so other devices do not bring it back
    }
    persist(c.key); if(!quiet) paint(c);
  }

  function paint(c){
    if(!c) return;
    const k = c.key + '|' + c.code;
    if(k !== curKey){
      // a note typed in the last moments belongs to the question being left
      if(noteTimer){ clearTimeout(noteTimer); noteTimer = 0; if(lastC) commit(lastC, true); }
      curKey = k; showAll = false; view = '';
      dock.dataset.open = '0'; // a new question starts with the thin strip, so the explanation gets the room back
      const b = bucketOf(c), saved = b && b.entries[c.code];
      cur = saved && (isLogged(saved) || !saved.deleted) ? saved : blank(c);
      try{ Object.defineProperty(cur, '__k', {value: k, writable: true, enumerable: false, configurable: true}); }catch(e){ cur.__k = k; }
      cur.speedFlags = Array.isArray(cur.speedFlags) ? cur.speedFlags : [];
      const t = note(); if(t && t.value !== cur.note) t.value = cur.note || '';
    }
    setText(byId('tslItem'), c.code);
    setHidden(byId('tslTick'), !isLogged(cur));
    // which step the strip shows: the code chips, then the reasoning chips, then just the two picks
    const stage = view || (!cur.errorCode ? 'code' : !cur.pattern ? 'pattern' : 'done');
    if(dock.dataset.stage !== stage){ dock.dataset.stage = stage; byId('tslFlow').scrollLeft = 0; }
    const er = ERR.find(x => x[0] === cur.errorCode), p = PAT.find(x => x[0] === cur.pattern), txt = (cur.note || '').trim();
    const sc = byId('tslSumCode'), sp = byId('tslSumPat');
    setHidden(sc, !er || stage === 'code'); setHidden(sp, !p || stage === 'pattern');
    if(er){ setHtml(sc, '<b>' + er[0] + '</b><span class="tsl-nm"><span class="l-full">' + esc(er[1]) + '</span><span class="l-short">' + esc(er[2]) + '</span></span>'); setAttr(sc, 'title', er[3] + '. Tap to change the error code.'); setAttr(sc, 'aria-label', 'Error code ' + er[0] + ': ' + er[3] + '. Change'); }
    if(p){ setHtml(sp, '<i></i><span class="tsl-nm">' + esc(title(p[2])) + '</span>'); if(sp.style.getPropertyValue('--c') !== p[3]) sp.style.setProperty('--c', p[3]); setAttr(sp, 'title', p[1] + ' ' + p[2] + '. Tap to change the reasoning pattern.'); setAttr(sp, 'aria-label', 'Reasoning pattern ' + p[1] + ': ' + p[2] + '. Change'); }
    setHidden(byId('tslCodes'), stage !== 'code'); setHidden(byId('tslPats'), stage !== 'pattern');
    setHtml(byId('tslLbl'), stage === 'code' ? '<span class="w">Error</span>' : stage === 'pattern' ? '<span class="w">Reasoning</span><span class="o">optional</span>' : ''); setAttr(byId('tslLbl'), 'title', stage === 'pattern' ? 'Optional. Skip it with Next or Cmd/Ctrl+Enter.' : ''); setHidden(byId('tslLbl'), stage === 'done');
    // incorrect or unanswered: codes 1–4 first; correct: 5–7 first. The outlined chip shows the rest.
    const primary = c.isCorrect ? ['5', '6', '7'] : ['1', '2', '3', '4'];
    const all = showAll || (cur.errorCode && primary.indexOf(cur.errorCode) < 0);
    $$('#tslCodes .tsl-err').forEach(b => setHidden(b, !all && primary.indexOf(b.dataset.code) < 0));
    setText(byId('tslAll'), all ? 'Fewer' : (c.isCorrect ? '1–4' : '5–7'));
    setAttr(byId('tslAll'), 'title', all ? 'Show only the codes for a' + (c.isCorrect ? ' correct' : 'n incorrect') + ' answer' : 'Show all seven error codes');
    setHidden(byId('tslAll'), !!(cur.errorCode && primary.indexOf(cur.errorCode) < 0));
    $$('#tslCodes .tsl-err').forEach(b => setAttr(b, 'aria-checked', String(b.dataset.code === cur.errorCode)));
    $$('#tslPats .tsl-pat').forEach(b => setAttr(b, 'aria-checked', String(b.dataset.pat === cur.pattern)));
    $$('.tsl-spd').forEach(b => { setAttr(b, 'aria-pressed', String(cur.speedFlags.indexOf(b.dataset.spd) >= 0)); b.classList.toggle('tsl-hint', b.dataset.spd === 'changed_answer' && c.changed); });
    $$('.tsl-kind button').forEach(b => setAttr(b, 'aria-checked', String(b.dataset.kind === (cur.noteKind === 'reasoning' ? 'reasoning' : 'clinical'))));
    const t = note(); if(t){ const ph = p ? p[5] : 'What will you do differently next time?'; if(t.placeholder !== ph) t.placeholder = ph; }
    setText(byId('tslPrev'), txt ? txt.replace(/\s+/g, ' ') : 'Add a note…');
    byId('tslNoteBtn').classList.toggle('has', !!(txt || cur.speedFlags.length));
    setHtml(byId('tslBadges'), (cur.speedFlags.length ? '<span>' + cur.speedFlags.map(v => (SPD.find(s => s[0] === v) || [])[1]).filter(Boolean).join(' ') + '</span>' : '') + (txt && cur.noteKind === 'reasoning' ? '<span>Broad</span>' : ''));
    setText(byId('tslCount'), String(countOf(c)));
    setAttr(byId('tslLog'), 'aria-label', countOf(c) + ' logged. Open the list'); setAttr(byId('tslLog'), 'title', 'Logged questions (' + countOf(c) + ')');
    lastC = c;
    const open = dock.dataset.open === '1';
    setHidden(byId('tslPanel'), !open);
    setAttr(byId('tslNoteBtn'), 'aria-expanded', String(open));
  }

  /* ---------- placement: the strip sits on top of the bottom bar and the question area ends above it ---------- */
  // on-screen keyboard present? (cached by place(); also read live for Enter handling)
  function kbNow(){ const vv = window.visualViewport; return !!(vv && ((vv.scale || 1) <= 1.01 || document.activeElement === note()) && innerHeight - (vv.height + vv.offsetTop) > 120); }
  const reserved = new Set();
  function reserve(el, prop, px){ if(!el) return; const v = px + 'px'; if(el.style.getPropertyValue(prop) !== v || el.style.getPropertyPriority(prop) !== 'important') el.style.setProperty(prop, v, 'important'); el.__tslProp = prop; reserved.add(el); }
  function release(keep){ reserved.forEach(el => { if(keep && keep.has(el)) return; try{ el.style.removeProperty(el.__tslProp); }catch(e){} reserved.delete(el); }); }
  function place(c){
    const scr = byId('examScreen'), ws = byId('workspace');
    if(dock.parentNode !== scr) scr.appendChild(dock);
    const modern = document.documentElement.getAttribute('data-tu-exam') === 'modern';
    const foot = modern ? scr.querySelector(':scope > .tux-foot') : scr.querySelector(':scope > .bottombar');
    const fr = foot && foot.getClientRects().length ? foot.getBoundingClientRect() : null;
    // under 1024×680 the NBME exam zooms the page (--tun-k): rectangles are in screen px, CSS lengths are not. z converts.
    const oh0 = dock.offsetHeight, zr = oh0 ? dock.getBoundingClientRect().height / oh0 : 1, z = zr > 0.2 && Math.abs(zr - 1) > 0.01 ? zr : 1;
    const base = fr && fr.top > innerHeight / 2 ? Math.max(0, innerHeight - fr.top) / z : 0;
    let bottom = base;
    // on-screen keyboard: keep the note above it
    const vv = window.visualViewport;
    if(vv && kbNow() && document.activeElement === note()) bottom = (innerHeight - (vv.height + vv.offsetTop)) / z;
    const vvh = Math.round((vv ? vv.height : innerHeight) / z) + 'px';
    if(dock.style.getPropertyValue('--tsl-vvh') !== vvh) dock.style.setProperty('--tsl-vvh', vvh);
    // the question area is measured without our own reservation (left edge and width do not depend on it)
    const wr = ws.getBoundingClientRect();
    const left = Math.max(0, Math.round(wr.left / z));
    if(dock.style.left !== left + 'px') dock.style.left = left + 'px';
    if(dock.style.bottom !== bottom + 'px') dock.style.bottom = bottom + 'px';
    const w = innerWidth / z - left, size = w >= 940 ? 'wide' : w >= 600 ? 'mid' : 'narrow';
    if(dock.dataset.size !== size) dock.dataset.size = size;
    const fl = byId('tslFlow');
    if(dock.dataset.tight === '1') dock.dataset.tight = '0';
    if(fl.scrollWidth - fl.clientWidth > 2) dock.dataset.tight = '1'; // drop the label and tighten before making the chips scroll
    const more = fl.scrollWidth - fl.clientWidth - fl.scrollLeft > 4 ? '1' : '0';
    if(fl.dataset.more !== more) fl.dataset.more = more;
    const h = dock.offsetHeight; // CSS px
    const bh = (dock.querySelector('.tsl-bar') || dock).offsetHeight + 'px';
    if(dock.style.getPropertyValue('--tsl-dh') !== bh) dock.style.setProperty('--tsl-dh', bh);
    const keep = new Set();
    if(modern){
      reserve(ws, 'bottom', base + h); keep.add(ws);
      ws.querySelectorAll('.right-panel-wrap').forEach(p => { if(getComputedStyle(p).position === 'fixed'){ reserve(p, 'bottom', base + h); keep.add(p); } });
    }else{
      reserve(ws, 'margin-bottom', h); keep.add(ws);
      // the explanation panel and the exhibit are capped to the window height by the exam's CSS; take the strip off that cap
      // so they end above the strip and keep their own scroll, instead of running under it
      ws.querySelectorAll('.question-flex .qbank-panel, .question-flex .exhibit-img').forEach(el => {
        const had = reserved.has(el) ? el.style.getPropertyValue('max-height') : '';
        if(had) el.style.removeProperty('max-height');
        const cap = parseFloat(getComputedStyle(el).maxHeight);
        if(isFinite(cap)){ reserve(el, 'max-height', Math.max(150, Math.round(cap - h))); keep.add(el); }
      });
    }
    release(keep);
  }

  function tick(){
    if(raf) cancelAnimationFrame(raf);
    clearTimeout(lag); raf = 0;
    const c = ctx();
    if(!c){ if(!dock.hidden){ dock.hidden = true; } release(); curKey = ''; return; }
    if(dock.hidden) dock.hidden = false;
    paint(c); place(c);
  }
  // the timer covers a window that is not painting (background tab), where requestAnimationFrame waits
  let lag = 0;
  const schedule = () => { if(!raf){ raf = requestAnimationFrame(tick); lag = setTimeout(tick, 150); } };

  /* ---------- actions ---------- */
  function setOpen(open, focus){
    const t0 = note();
    if(!open && t0 && document.activeElement === t0) t0.blur(); // the blur saves the note
    dock.dataset.open = open ? '1' : '0';
    tick();
    if(open) fit();
    if(open && focus){ const t = note(); if(t){ try{ t.focus({preventScroll: true}); const n = t.value.length; t.setSelectionRange(n, n); }catch(e){ t.focus(); } } }
  }
  // the note box is as tall as its text, from two lines up to about six
  function fit(){ const t = note(); if(!t || !t.getClientRects().length) return; t.style.height = 'auto'; t.style.height = Math.min(140, Math.max(48, t.scrollHeight)) + 'px'; schedule(); }
  function act(c, kind, value){
    if(!c || !cur) return;
    if(kind === 'code') cur.errorCode = cur.errorCode === value ? '' : value;
    else if(kind === 'pat') cur.pattern = cur.pattern === value ? '' : value;
    else if(kind === 'spd'){ const i = cur.speedFlags.indexOf(value); if(i >= 0) cur.speedFlags.splice(i, 1); else cur.speedFlags.push(value); cur.speedFlags.sort((a, b) => SPD.findIndex(s => s[0] === a) - SPD.findIndex(s => s[0] === b)); }
    else if(kind === 'kind') cur.noteKind = value === 'reasoning' ? 'reasoning' : 'clinical';
    if(kind === 'code' || kind === 'pat') view = ''; // move on to the next step
    commit(c);
  }
  dock.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('button'); if(!b || !dock.contains(b)) return;
    e.stopPropagation();
    const c = ctx(); if(!c) return;
    if(b.dataset.code) act(c, 'code', b.dataset.code);
    else if(b.dataset.pat) act(c, 'pat', b.dataset.pat);
    else if(b.dataset.spd) act(c, 'spd', b.dataset.spd);
    else if(b.dataset.kind) act(c, 'kind', b.dataset.kind);
    else if(b.dataset.act === 'allcodes'){ showAll = !showAll; tick(); }
    else if(b.dataset.act === 'editcode'){ view = 'code'; tick(); }
    else if(b.dataset.act === 'editpat'){ view = 'pattern'; tick(); }
    else if(b.dataset.act === 'done') setOpen(false, false);
    else if(b.dataset.act === 'note'){ if(dock.dataset.open === '1') setOpen(false, false); else setOpen(true, true); }
    else if(b.dataset.act === 'log') openSheet();
  });
  dock.addEventListener('input', e => {
    if(e.target !== note() || !cur) return;
    cur.note = e.target.value; fit();
    clearTimeout(noteTimer); noteTimer = setTimeout(() => { noteTimer = 0; if(lastC) commit(lastC); }, 250);
  });
  dock.addEventListener('focusout', e => { if(e.relatedTarget && !dock.contains(e.relatedTarget) && dock.dataset.open === '1') setTimeout(() => setOpen(false, false), 0);
    if(e.target === note()){ clearTimeout(noteTimer); noteTimer = 0; if(lastC && cur && cur.__k === lastC.key + '|' + lastC.code) commit(lastC); schedule(); } });
  dock.addEventListener('focusin', e => { if(e.target === note()) schedule(); });
  // keep the on-screen keyboard open while the note has focus: taps on the tray's buttons must not steal focus
  ['pointerdown', 'mousedown'].forEach(t => dock.addEventListener(t, e => { const b = e.target.closest && e.target.closest('.tsl-tray button'); if(b && document.activeElement === note()) e.preventDefault(); }));
  // the exam listens for selections and clicks in the question; nothing from the strip should reach it
  ['mousedown', 'mouseup', 'touchstart', 'touchend', 'pointerdown', 'pointerup', 'dblclick', 'contextmenu'].forEach(t => dock.addEventListener(t, e => e.stopPropagation()));

  // the note editor is only there while you write: a tap anywhere outside the logger saves and closes it
  document.addEventListener('pointerdown', e => { if(dock.dataset.open === '1' && !dock.hidden && !dock.contains(e.target) && !(sheet && sheet.contains(e.target))) setOpen(false, false); }, true);
  // same keys as ThunderShadow: 1–7 code, Shift+1–7 pattern, Alt+1–6 speed. N opens the note. Only in Review, never while typing.
  document.addEventListener('keydown', e => {
    const c = ctx(); if(!c || sheet) return;
    const t = e.target, typing = t && (t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable || (t.tagName === 'INPUT' && !/^(radio|checkbox|button|submit|reset|range|image|file|color)$/i.test(t.type || 'text')));
    if(t === note()){
      if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); setOpen(false, false); }
      else if(e.key === 'Enter' && (e.metaKey || e.ctrlKey)){ e.preventDefault(); e.stopPropagation(); setOpen(false, false); try{ const nb = byId('nextNav'); if(nb) nb.click(); else if(typeof goNext === 'function') goNext(); }catch(err){} }
      else if(e.key === 'Enter' && !e.shiftKey && !e.altKey && !e.isComposing && !kbNow()){ e.preventDefault(); e.stopPropagation(); setOpen(false, false); } // Enter = done; Shift+Enter = new line (on-screen keyboard showing: Enter is a new line, Done closes)
      else e.stopPropagation();
      return;
    }
    if(typing || e.metaKey || e.ctrlKey || e.repeat) return;
    if(Array.from(document.querySelectorAll('.app-dialog-layer, #tunAlert, #referenceSettingsDropdown')).some(el => el.getClientRects().length) || ['imagePreview', 'pauseOverlay', 'overviewRoot'].some(id => { const el = byId(id); return el && el.getClientRects().length; })) return; // an open dialog or menu owns the keys
    const m = /^(?:Digit|Numpad)([1-7])$/.exec(e.code || '');
    if(m){
      const n = Number(m[1]);
      if(e.shiftKey && !e.altKey) act(c, 'pat', PAT[n - 1][0]);
      else if(e.altKey && !e.shiftKey){ if(n > 6) return; act(c, 'spd', SPD[n - 1][0]); }
      else if(!e.shiftKey && !e.altKey) act(c, 'code', String(n));
      else return;
      e.preventDefault(); return;
    }
    if((e.key === 'n' || e.key === 'N') && !e.altKey){ e.preventDefault(); setOpen(true, true); }
  });

  /* ---------- export ---------- */
  const tsvEscape = (v, keepLines) => { const clean = String(v == null ? '' : v).replace(/\t/g, ' '); return (keepLines ? clean.replace(/\r\n?|\n/g, '<br>') : clean.replace(/\r?\n/g, ' ')).trim(); };
  const tsvCell = v => { const t = String(v == null ? '' : v); return /["\t\r\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
  // stable number of the question within the whole form: stored on the entry; older entries are computed from the item code
  // (block sizes are known only while that form is open; otherwise null and the caller falls back to the position in the list)
  function entryOf(e, key){
    if(e.entryNumber > 0) return e.entryNumber;
    try{ if(lastC && lastC.key === key && e.block >= 1 && e.item >= 1){ let n = 0; for(let i = 0; i < e.block - 1; i++) n += activeBlocks[i].questions.length; return n + e.item; } }catch(err){}
    return null;
  }
  const sorted = (b, key) => Object.values(b.entries).filter(isLogged).sort((x, y) => { const nx = entryOf(x, key), ny = entryOf(y, key); return nx != null && ny != null && nx !== ny ? nx - ny : (x.block - y.block) || (x.item - y.item); });
  const keyOfBucket = b => Object.keys(db.forms).find(k => db.forms[k] === b);
  function rowsOf(b){
    const key = keyOfBucket(b);
    let prev = 0;
    return sorted(b, key).map((e, i) => { const n = entryOf(e, key) || (e.block === 1 ? e.item : Math.max(i + 1, prev + 1)); prev = n; return ['', b.form, b.date, n, e.errorCode || '', (pp => pp ? pp[1] + ' — ' + pp[2] : '')(PAT.find(p => p[0] === e.pattern)),
      (e.speedFlags || []).map(v => (f => f ? f[1] + ' — ' + f[2] : v)(SPD.find(s => s[0] === v))).join(' | '), tsvEscape(e.note, true), e.noteKind === 'reasoning' ? 'Broad Pattern' : 'Clinical Pattern', '', '', '', e.examItem || '']
      .map((v, idx) => idx === 7 ? v : tsvEscape(v)).map(tsvCell).join('\t'); });
  }
  function tsv(key){
    const list = key ? [db.forms[key]].filter(Boolean) : Object.values(db.forms);
    return [HEADERS.join('\t')].concat(...list.map(rowsOf)).join('\n');
  }
  const safeName = v => String(v || 'ThunderShadow').normalize('NFKD').replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '') || 'ThunderShadow';
  function download(name, text){
    const url = URL.createObjectURL(new Blob([text], {type: 'text/tab-separated-values;charset=utf-8'}));
    const a = document.createElement('a'); a.href = url; a.download = name; a.style.display = 'none';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  async function copyText(text){
    try{ if(navigator.clipboard && navigator.clipboard.writeText){ await navigator.clipboard.writeText(text); return true; } }catch(e){}
    const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0'; document.body.appendChild(ta);
    let ok = false; try{ ta.select(); ok = document.execCommand('copy') === true; }catch(e){} ta.remove(); return ok;
  }

  /* ---------- the list of logged questions (opened from the strip; the only part that covers the screen) ---------- */
  let sheetKeys = null;
  function closeSheet(){ if(sheetKeys){ document.removeEventListener('keydown', sheetKeys, true); sheetKeys = null; } if(sheet){ sheet.remove(); sheet = null; sheetDraw = null; schedule(); } }
  function jump(block, item){
    closeSheet();
    try{
      // same as goNext: save the time on this question and the block's progress before moving
      if(typeof commitQuestionTime === 'function') commitQuestionTime();
      if(typeof persistBlockProgress === 'function') persistBlockProgress();
      if(Number(blockPointer) + 1 !== block){ reviewMode = true; if(activeSession) activeSession.currentBlockPointer = block - 1; startBlock(block - 1); }
      goToQuestionIndex(item - 1);
    }catch(e){}
  }
  function openSheet(){
    const c = ctx(); if(!c) return;
    closeSheet();
    sheet = document.createElement('div'); sheet.id = 'tslSheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); sheet.setAttribute('aria-label', 'ThunderShadow log');
    let undo = null, confirmDel = false; // undo: {label, items:[[code, entry]]}
    const draw = (msg, focus) => {
      const hadFocus = !!(sheet.contains(document.activeElement) && document.activeElement !== sheet);
      const b = db.forms[c.key], list = b ? sorted(b, c.key) : [], forms = Object.values(db.forms).filter(f => f.entries && Object.values(f.entries).some(isLogged)).length;
      const undoBtn = undo ? ' · <button type="button" class="tsl-undo" data-s="undo">Undo</button>' : '';
      sheet.innerHTML = `<div class="tsl-card"><header><div><h3>ThunderShadow log · ${esc(c.form)}</h3><p>${c.qbank ? 'Qbank review session (mixed forms; items numbered within this session) · ' : ''}${list.length} logged question${list.length === 1 ? '' : 's'} · ${esc(c.date)} · ${esc(whereText())}</p></div><button type="button" class="tsl-close" data-s="close" aria-label="Close" title="Close">${I.x}</button></header>
<div class="tsl-list">${list.length ? `<table><thead><tr><th>Item</th><th>Code</th><th>Pattern</th><th class="c-s">Speed</th><th>Study note</th><th></th></tr></thead><tbody>${list.map(e => { const er = ERR.find(x => x[0] === e.errorCode), p = PAT.find(x => x[0] === e.pattern); return `<tr><td class="n">${esc(e.examItem)}</td><td>${er ? esc(er[0] + ' ' + er[1]) : ''}</td><td>${p ? esc(p[1] + ' ' + p[2]) : ''}</td><td class="c-s">${esc((e.speedFlags || []).map(v => (SPD.find(s => s[0] === v) || [])[1]).filter(Boolean).join(' '))}</td><td class="note">${esc(e.note || '')}${e.note && e.noteKind === 'reasoning' ? ' <em>(Broad)</em>' : ''}</td><td class="act"><button type="button" class="tsl-ib" data-s="go" data-b="${Number(e.block)}" data-i="${Number(e.item)}" title="Open question ${esc(e.examItem)}" aria-label="Open question ${esc(e.examItem)}">${I.go}</button><button type="button" class="tsl-ib" data-s="del" data-k="${esc(e.examItem)}" title="Remove this entry" aria-label="Remove entry ${esc(e.examItem)}">${I.bin}</button></td></tr>`; }).join('')}</tbody></table><ul class="tsl-cards">${list.map(e => { const er = ERR.find(x => x[0] === e.errorCode), p = PAT.find(x => x[0] === e.pattern), sp = (e.speedFlags || []).map(v => (SPD.find(s => s[0] === v) || [])[1]).filter(Boolean).join(' '); return `<li><div class="h"><span class="n">${esc(e.examItem)}</span>${er ? `<span>${esc(er[0] + ' ' + er[1])}</span>` : ''}${p ? `<span>${esc(p[1] + ' ' + p[2])}</span>` : ''}${sp ? `<span class="s">${esc(sp)}</span>` : ''}</div><div class="a"><button type="button" class="tsl-ib" data-s="go" data-b="${Number(e.block)}" data-i="${Number(e.item)}" title="Open question ${esc(e.examItem)}" aria-label="Open question ${esc(e.examItem)}">${I.go}</button><button type="button" class="tsl-ib" data-s="del" data-k="${esc(e.examItem)}" title="Remove this entry" aria-label="Remove entry ${esc(e.examItem)}">${I.bin}</button></div>${e.note ? `<div class="t">${esc(e.note)}${e.noteKind === 'reasoning' ? ' (Broad)' : ''}</div>` : ''}</li>`; }).join('')}</ul>` : '<p class="tsl-empty">Nothing logged for this form yet. Tap an error code under a question to log it.</p>'}</div>
<footer><span class="tsl-msg" role="status">${!saveOk() ? esc('Not saved: this browser refused the write (storage full or blocked). Download the TSV now.') + undoBtn : confirmDel ? esc('Delete all ' + list.length + ' logged question' + (list.length === 1 ? '' : 's') + ' of this form?') : esc(msg || 'Same 13 columns as ThunderShadow’s Form log TSV.') + undoBtn}</span>${list.length ? (confirmDel ? `<button type="button" class="tsl-btn danger pri" data-s="delyes">Yes, delete</button><button type="button" class="tsl-btn" data-s="delno">Cancel</button>` : `<button type="button" class="tsl-btn danger" data-s="delform">Delete this form's log</button>`) : ''}${forms > 1 ? `<button type="button" class="tsl-btn" data-s="all">All ${forms} forms</button>` : ''}<button type="button" class="tsl-btn" data-s="copy" aria-disabled="${!list.length}">Copy TSV</button><button type="button" class="tsl-btn pri" data-s="dl" aria-disabled="${!list.length}">${I.down}Download TSV</button></footer></div>`;
      if(focus || hadFocus){ const t = (focus && sheet.querySelector('[data-s="' + focus + '"]')) || sheet.querySelector('.tsl-close'); if(t){ try{ t.focus(); }catch(e){} } }
    };
    sheetDraw = draw; draw();
    sheet.addEventListener('click', async e => {
      if(e.target === sheet){ closeSheet(); return; }
      const b = e.target.closest && e.target.closest('button[data-s]'); if(!b) return;
      const s = b.dataset.s;
      if(s !== 'undo' && s !== 'del' && s !== 'delyes') undo = null; // the undo offer lasts until the next action
      if(s !== 'delform') confirmDel = false;
      const takeOut = (label, codes) => { if(noteTimer){ clearTimeout(noteTimer); noteTimer = 0; if(lastC) commit(lastC, true); }
      const f = db.forms[c.key]; if(!f) return; const live = codes.filter(k => isLogged(f.entries[k])); undo = {label, items: live.map(k => [k, f.entries[k]])}; live.forEach(k => { f.entries[k] = tomb(f.entries[k], f.entries[k]); }); persist(c.key); curKey = ''; draw(label, 'undo'); schedule(); };
      if(s === 'close') closeSheet();
      else if(s === 'go') jump(Number(b.dataset.b), Number(b.dataset.i));
      else if(s === 'del') takeOut('Removed ' + b.dataset.k, [b.dataset.k]);
      else if(s === 'delform'){ confirmDel = true; draw('', 'delno'); }
      else if(s === 'delno') draw('', 'delform');
      else if(s === 'delyes'){ const f = db.forms[c.key]; takeOut('Deleted this form\'s log (' + (f ? Object.values(f.entries).filter(isLogged).length : 0) + ')', f ? Object.keys(f.entries).filter(k => isLogged(f.entries[k])) : []); }
      else if(s === 'undo'){
        if(undo){ const u = undo; undo = null; const f = db.forms[c.key] || (db.forms[c.key] = {formId: c.formId, form: c.form, date: c.date, entries: {}}); u.items.forEach(([k, en]) => { const at = f.entries[k]; f.entries[k] = Object.assign({}, en, {updatedAt: stampAfter(at && at.updatedAt)}); }); persist(c.key); curKey = ''; draw('Restored ' + (u.items.length === 1 ? u.items[0][0] : u.items.length + ' entries'), 'close'); schedule(); }
      }
      else if(s === 'dl'){ download(safeName(c.form) + '_ThunderShadow_Log.tsv', tsv(c.key)); draw('Downloaded ' + safeName(c.form) + '_ThunderShadow_Log.tsv', 'dl'); }
      else if(s === 'all'){ download('ThunderShadow_Log_all_forms.tsv', tsv()); draw('Downloaded ThunderShadow_Log_all_forms.tsv', 'all'); }
      else if(s === 'copy'){ const ok = await copyText(tsv(c.key)); draw(ok ? 'Copied the TSV.' : 'Copy was blocked by the browser. Use Download.', 'copy'); }
    });
    sheetKeys = e => {
      if(!sheet) return;
      if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); closeSheet(); return; }
      if(e.key !== 'Tab') return;
      const f = Array.from(sheet.querySelectorAll('button')).filter(x => !x.disabled && x.offsetParent !== null);
      if(!f.length){ e.preventDefault(); return; }
      const a = document.activeElement, i = f.indexOf(a);
      if(i < 0){ e.preventDefault(); f[e.shiftKey ? f.length - 1 : 0].focus(); }
      else if(e.shiftKey && i === 0){ e.preventDefault(); f[f.length - 1].focus(); }
      else if(!e.shiftKey && i === f.length - 1){ e.preventDefault(); f[0].focus(); }
    };
    document.addEventListener('keydown', sheetKeys, true);
    document.body.appendChild(sheet);
    const x = sheet.querySelector('.tsl-close'); if(x){ x.tabIndex = 0; try{ x.focus(); }catch(e){} }
  }

  /* ---------- wiring ---------- */
  function start(){
    const scr = byId('examScreen'); if(!scr) return;
    scr.appendChild(dock);
    byId('tslFlow').addEventListener('scroll', schedule, {passive: true});
    new MutationObserver(recs => { if(recs.every(r => dock.contains(r.target))) return; schedule(); }).observe(scr, {childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden', 'data-tux-view']});
    new MutationObserver(schedule).observe(document.documentElement, {attributes: true, attributeFilter: ['data-tu-exam', 'data-tun']});
    addEventListener('resize', schedule);
    if(window.visualViewport){ visualViewport.addEventListener('resize', schedule); visualViewport.addEventListener('scroll', schedule); }
    if(typeof ResizeObserver === 'function') new ResizeObserver(schedule).observe(dock);
    schedule();
  }
  // another tab/window wrote the log: take its forms, keep ours that have unsaved changes
  addEventListener('storage', e => {
    if(e.key !== STORE && e.key !== null) return;
    db = {forms: mergeForms(readStore().forms, db.forms)}; curKey = ''; if(sheet && sheetDraw) sheetDraw(); schedule(); scheduleFlush();
  });
  // pick up the files when the page comes back (another device's changes arrive through Sync, a DATA folder may have been connected since)
  document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible' && fileOk !== null) syncFiles(); });
  setTimeout(() => syncFiles(), 100); // first run: merges the cache into the files (migration of logs kept only in localStorage)
  /* Settings page (Settings > Appearance): a ThunderShadow switch next to the Review screen group. Same key as the exam Settings menu row. */
  function paintSetting(){
    const panel = byId('settingsPanel'); if(!panel) return;
    const on = ls.get(OFF) !== '1';
    panel.querySelectorAll('section.tu-setbody').forEach(sec => {
      const h = sec.querySelector('.tu-sechead h2'); if(!h || h.textContent.trim() !== 'Appearance') return;
      let box = sec.querySelector('[data-tsl-set]');
      if(!box){
        box = document.createElement('div'); box.className = 'tsl-set'; box.setAttribute('data-tsl-set', ''); box.style.cssText = 'border-top:1px solid var(--tu-line2,#e4e7f0);margin-top:6px';
        box.innerHTML = '<div class="tu-sechead"><h2>ThunderShadow</h2><p>Log each question with the error code and reasoning pattern while you review a form. Export the log as a TSV for ThunderShadow.</p><div class="tu-setrow"><div><b>ThunderShadow logger</b><span>Show the logging bar on the Review screen. The exam’s Settings menu has the same switch.</span></div><div class="tu-setctl"><button type="button" class="tu-switch" id="tslSetSwitch" role="switch" aria-checked="' + on + '" aria-label="ThunderShadow logger"><i></i></button></div></div></div>';
        sec.appendChild(box);
      }
      const sw = box.querySelector('#tslSetSwitch'); if(sw && sw.getAttribute('aria-checked') !== String(on)) sw.setAttribute('aria-checked', String(on));
    });
    const t = byId('shadowLoggerToggle'); if(t && t.checked !== on) t.checked = on;
  }
  document.addEventListener('click', e => {
    const b = e.target && e.target.closest && e.target.closest('#tslSetSwitch'); if(!b) return;
    e.preventDefault(); if(ls.get(OFF) === '1') window.ShadowLogger.enable(); else window.ShadowLogger.disable();
  });
  let setQueued = false;
  const queueSetting = () => { if(setQueued) return; setQueued = true; setTimeout(() => { setQueued = false; paintSetting(); }, 0); };
  function watchSettings(){ const p = byId('settingsPanel'); if(p){ new MutationObserver(queueSetting).observe(p, {childList: true, subtree: true}); queueSetting(); } }
  window.ShadowLogger = {
    version: '2.0', tsv, data: () => JSON.parse(JSON.stringify(db)), refresh: schedule,
    get on(){ return ls.get(OFF) !== '1'; },
    enable(){ ls.set(OFF, '0'); schedule(); paintSetting(); }, disable(){ ls.set(OFF, '1'); schedule(); paintSetting(); },
    clear(){ clearTimeout(noteTimer); noteTimer = 0; const n = note(); if(n && document.activeElement === n) n.blur(); noteTimer && clearTimeout(noteTimer); noteTimer = 0; dirty.clear(); Object.keys(db.forms).forEach(k => { const f = db.forms[k]; Object.keys(f.entries).forEach(c => { if(!f.entries[c].deleted) f.entries[c] = tomb(f.entries[c], f.entries[c]); }); dirty.add(k); fileDirty.add(fileIdOfBucket(k, f)); }); persist(); curKey = ''; if(sheet && sheetDraw) sheetDraw(); schedule(); },
    // Sync v3 (js/sync3-sync.js syncShadow) reads and writes the log files through these. write() merges, it never replaces.
    files: {
      merge: (a, b) => { const x = JSON.parse(a), y = JSON.parse(b); if(x.id !== y.id) throw new Error('different log files'); return fileText(x.id, mergeForms(parseFile(a, x.id), parseFile(b, y.id))); },
      async list(){ await settled(syncFiles()); const out = []; for(const id of await fstore.ids()){ try{ const t = await fstore.read(id); if(t && t.length <= MAXB){ parseFile(t, id); out.push({id, text: t}); } }catch(e){} } return out; },
      async write(id, text){
        if(!/^[A-Za-z0-9_-]+$/.test(id) || typeof text !== 'string' || text.length > MAXB) return {written: false};
        const remote = parseFile(text, id);
        db = {forms: mergeForms(db.forms, remote)}; Object.keys(remote).forEach(k => dirty.add(k)); fileDirty.add(id);
        persist();
        await settled(syncFiles([id], true));
        return fileTexts.has(id) ? {written: true, text: fileTexts.get(id)} : {written: false};
      }
    },
    // Exam Settings menu row, same markup as the item-code row (thunder-ui.js styles every .notes-preference row)
    settingHtml(){ return '<label class="notes-preference shadow-logger-preference" title="ThunderShadow logger in Review mode"><span>ThunderShadow</span><input id="shadowLoggerToggle" type="checkbox" role="switch" ' + (ls.get(OFF) !== '1' ? 'checked' : '') + '></label>'; }
  };
  document.addEventListener('change', e => { if(e.target && e.target.id === 'shadowLoggerToggle'){ if(e.target.checked) window.ShadowLogger.enable(); else window.ShadowLogger.disable(); } });
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { start(); watchSettings(); }); else { start(); watchSettings(); }
})();

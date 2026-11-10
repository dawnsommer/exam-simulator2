/* ThunderShadow logger for the Review screen (one file, meant to be identical in the Local and iPad apps).
   A floating bar between the question area and the exam's bottom bar. It takes its own space (the question area gets
   shorter by the strip's height), so it never covers the question, the explanation or the exhibit.
   One tap on an error code logs the question; the reasoning pattern chips then take its place in the same bar (second tap).
   The study note opens a small editor above the bar only while you write (Enter, Done or a tap outside closes it); speed flags sit beside it.
   Exam Settings menu: "ThunderShadow" switch (ShadowLogger.settingHtml(), key ThunderShadowLog.off).
   The form, date and simulator item (block.item) are filled in from the attempt.
   Export: the 13 columns of ThunderShadow's own "Form log TSV" (js/browser-api.js formToTsv), so one importer reads both.
   Draft storage: localStorage "ThunderShadowLog.v1" on this device only. Nothing is written to DATA or to progress files. */
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

  /* ---------- storage ---------- */
  let db = {forms: {}}, sheetDraw = null; // sheetDraw: redraws the open log sheet
  try{ const v = JSON.parse(ls.get(STORE)); if(v && v.forms && typeof v.forms === 'object') db = v; }catch(e){}
  // Writes are per form bucket: re-read the stored copy, put our changed buckets on top of it, then write. Another tab's other forms survive.
  const dirty = new Set();
  let saveOk = true;
  const readStore = () => { const raw = ls.get(STORE); if(raw == null) return {forms: {}}; try{ const v = JSON.parse(raw); if(v && v.forms && typeof v.forms === 'object') return v; }catch(e){} return Object.keys(db.forms).length ? db : {forms: {}}; }; // unreadable store: fall back to what we hold so other forms are not wiped
  function persist(key){
    if(key) dirty.add(key);
    const stored = readStore(), forms = Object.assign({}, stored.forms);
    dirty.forEach(k => { if(db.forms[k]) forms[k] = db.forms[k]; else delete forms[k]; });
    const next = Object.assign({}, stored, {forms});
    const ok = ls.set(STORE, JSON.stringify(next));
    if(ok){ db = next; dirty.clear(); }
    saveOk = ok; showSaveState();
    return ok;
  }
  function showSaveState(){ const w = byId('tslWarn'); if(w) w.hidden = saveOk; if(sheet && sheetDraw) sheetDraw(); }
  const isLogged = e => !!(e && (e.errorCode || e.pattern || (e.note || '').trim() || (e.speedFlags || []).length));
  const blank = c => ({examItem: c.code, block: c.block, item: c.item, qid: c.qid, errorCode: '', pattern: '', speedFlags: [], note: '', noteKind: 'clinical', isCorrect: c.isCorrect, createdAt: null, updatedAt: null});

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
      cur.createdAt = cur.createdAt || now; cur.updatedAt = now;
      if(!(cur.entryNumber > 0)) cur.entryNumber = c.entryNumber;
      b.entries[c.code] = cur;
    }else{
      const b = db.forms[c.key];
      if(b){ delete b.entries[c.code]; if(!Object.keys(b.entries).length) delete db.forms[c.key]; }
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
      cur = saved ? saved : blank(c);
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
      sheet.innerHTML = `<div class="tsl-card"><header><div><h3>ThunderShadow log · ${esc(c.form)}</h3><p>${c.qbank ? 'Qbank review session (mixed forms; items numbered within this session) · ' : ''}${list.length} logged question${list.length === 1 ? '' : 's'} · ${esc(c.date)} · saved on this device as you tap</p></div><button type="button" class="tsl-close" data-s="close" aria-label="Close" title="Close">${I.x}</button></header>
<div class="tsl-list">${list.length ? `<table><thead><tr><th>Item</th><th>Code</th><th>Pattern</th><th class="c-s">Speed</th><th>Study note</th><th></th></tr></thead><tbody>${list.map(e => { const er = ERR.find(x => x[0] === e.errorCode), p = PAT.find(x => x[0] === e.pattern); return `<tr><td class="n">${esc(e.examItem)}</td><td>${er ? esc(er[0] + ' ' + er[1]) : ''}</td><td>${p ? esc(p[1] + ' ' + p[2]) : ''}</td><td class="c-s">${esc((e.speedFlags || []).map(v => (SPD.find(s => s[0] === v) || [])[1]).filter(Boolean).join(' '))}</td><td class="note">${esc(e.note || '')}${e.note && e.noteKind === 'reasoning' ? ' <em>(Broad)</em>' : ''}</td><td class="act"><button type="button" class="tsl-ib" data-s="go" data-b="${Number(e.block)}" data-i="${Number(e.item)}" title="Open question ${esc(e.examItem)}" aria-label="Open question ${esc(e.examItem)}">${I.go}</button><button type="button" class="tsl-ib" data-s="del" data-k="${esc(e.examItem)}" title="Remove this entry" aria-label="Remove entry ${esc(e.examItem)}">${I.bin}</button></td></tr>`; }).join('')}</tbody></table><ul class="tsl-cards">${list.map(e => { const er = ERR.find(x => x[0] === e.errorCode), p = PAT.find(x => x[0] === e.pattern), sp = (e.speedFlags || []).map(v => (SPD.find(s => s[0] === v) || [])[1]).filter(Boolean).join(' '); return `<li><div class="h"><span class="n">${esc(e.examItem)}</span>${er ? `<span>${esc(er[0] + ' ' + er[1])}</span>` : ''}${p ? `<span>${esc(p[1] + ' ' + p[2])}</span>` : ''}${sp ? `<span class="s">${esc(sp)}</span>` : ''}</div><div class="a"><button type="button" class="tsl-ib" data-s="go" data-b="${Number(e.block)}" data-i="${Number(e.item)}" title="Open question ${esc(e.examItem)}" aria-label="Open question ${esc(e.examItem)}">${I.go}</button><button type="button" class="tsl-ib" data-s="del" data-k="${esc(e.examItem)}" title="Remove this entry" aria-label="Remove entry ${esc(e.examItem)}">${I.bin}</button></div>${e.note ? `<div class="t">${esc(e.note)}${e.noteKind === 'reasoning' ? ' (Broad)' : ''}</div>` : ''}</li>`; }).join('')}</ul>` : '<p class="tsl-empty">Nothing logged for this form yet. Tap an error code under a question to log it.</p>'}</div>
<footer><span class="tsl-msg" role="status">${!saveOk ? esc('Not saved: this browser refused the write (storage full or blocked). Download the TSV now.') + undoBtn : confirmDel ? esc('Delete all ' + list.length + ' logged question' + (list.length === 1 ? '' : 's') + ' of this form?') : esc(msg || 'Same 13 columns as ThunderShadow’s Form log TSV.') + undoBtn}</span>${list.length ? (confirmDel ? `<button type="button" class="tsl-btn danger pri" data-s="delyes">Yes, delete</button><button type="button" class="tsl-btn" data-s="delno">Cancel</button>` : `<button type="button" class="tsl-btn danger" data-s="delform">Delete this form's log</button>`) : ''}${forms > 1 ? `<button type="button" class="tsl-btn" data-s="all">All ${forms} forms</button>` : ''}<button type="button" class="tsl-btn" data-s="copy" aria-disabled="${!list.length}">Copy TSV</button><button type="button" class="tsl-btn pri" data-s="dl" aria-disabled="${!list.length}">${I.down}Download TSV</button></footer></div>`;
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
      const f = db.forms[c.key]; if(!f) return; undo = {label, items: codes.filter(k => f.entries[k]).map(k => [k, f.entries[k]])}; codes.forEach(k => delete f.entries[k]); if(!Object.keys(f.entries).length) delete db.forms[c.key]; persist(c.key); curKey = ''; draw(label, 'undo'); schedule(); };
      if(s === 'close') closeSheet();
      else if(s === 'go') jump(Number(b.dataset.b), Number(b.dataset.i));
      else if(s === 'del') takeOut('Removed ' + b.dataset.k, [b.dataset.k]);
      else if(s === 'delform'){ confirmDel = true; draw('', 'delno'); }
      else if(s === 'delno') draw('', 'delform');
      else if(s === 'delyes'){ const f = db.forms[c.key]; takeOut('Deleted this form\'s log (' + (f ? Object.values(f.entries).filter(isLogged).length : 0) + ')', f ? Object.keys(f.entries) : []); }
      else if(s === 'undo'){
        if(undo){ const u = undo; undo = null; const f = db.forms[c.key] || (db.forms[c.key] = {formId: c.formId, form: c.form, date: c.date, entries: {}}); u.items.forEach(([k, en]) => { f.entries[k] = en; }); persist(c.key); curKey = ''; draw('Restored ' + (u.items.length === 1 ? u.items[0][0] : u.items.length + ' entries'), 'close'); schedule(); }
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
    const stored = readStore();
    dirty.forEach(k => { if(db.forms[k]) stored.forms[k] = db.forms[k]; else delete stored.forms[k]; });
    db = stored; if(sheet && sheetDraw) sheetDraw(); schedule();
  });
  window.ShadowLogger = {
    version: '1.0', tsv, data: () => JSON.parse(JSON.stringify(db)), refresh: schedule,
    get on(){ return ls.get(OFF) !== '1'; },
    enable(){ ls.set(OFF, '0'); schedule(); }, disable(){ ls.set(OFF, '1'); schedule(); },
    clear(){ clearTimeout(noteTimer); noteTimer = 0; const n = note(); if(n && document.activeElement === n) n.blur(); noteTimer && clearTimeout(noteTimer); noteTimer = 0; dirty.clear(); db = {forms: {}}; saveOk = ls.set(STORE, JSON.stringify({forms: {}})); showSaveState(); curKey = ''; if(sheet && sheetDraw) sheetDraw(); schedule(); },
    // Exam Settings menu row, same markup as the item-code row (thunder-ui.js styles every .notes-preference row)
    settingHtml(){ return '<label class="notes-preference shadow-logger-preference" title="ThunderShadow logger in Review mode"><span>ThunderShadow</span><input id="shadowLoggerToggle" type="checkbox" role="switch" ' + (ls.get(OFF) !== '1' ? 'checked' : '') + '></label>'; }
  };
  document.addEventListener('change', e => { if(e.target && e.target.id === 'shadowLoggerToggle'){ if(e.target.checked) window.ShadowLogger.enable(); else window.ShadowLogger.disable(); } });
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

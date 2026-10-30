/* Rapid Review tab for the Review screen. Adds a tab beside Explanation / Exhibit and renders pre-generated
   data (explanations/<ID>.json in the app's library storage, items keyed by qid). Read-only; the only live input is the learner's recorded answer.
   Also places the tabs for the Below layout, adds a "Review screen" group to Settings -> Appearance, and keeps the files current
   from the published form-updates-manifest.json (silent; never deletes). One file, identical in the Local and iPad apps. */
(function(){
  'use strict';
  const LT = 'ABCDEFGHIJKLMNOP';
  const PREF = 'stepReviewTabDefault', PLACE = 'stepReviewPlacement', LAYOUT = 'StepExamReviewExplanationLayout', ZOOM = 'stepRapidZoom';
  let rrOn = false, sideTab = 'exp', raf = 0, autoKey = null, sub = 'over', setHint = '', wantTopic = false;
  const ls = {get: k => { try{ return localStorage.getItem(k); }catch(e){ return null; } }, set: (k, v) => { try{ localStorage.setItem(k, v); }catch(e){} }};
  const getPref = () => ls.get(PREF) === 'rapid' ? 'rapid' : 'explanation';
  const getLayout = () => { try{ return getReviewExplanationLayout(); }catch(e){ return ls.get(LAYOUT) === 'below' ? 'below' : 'split'; } };
  // Below layout: where Explanation and Rapid Review go. One of them always stays under the question.
  const getPlace = () => {
    let p = null; try{ p = JSON.parse(ls.get(PLACE)); }catch(e){}
    const exp = p && p.exp === 'side' ? 'side' : 'below';
    return {exp, rr: exp === 'side' || (p && p.rr === 'below') ? 'below' : 'side'};
  };
  const isPhone = () => innerWidth < 760 || innerHeight <= 520;
  const getZ = () => { const v = parseFloat(ls.get(ZOOM)); return v >= 0.8 && v <= 1.3 ? v : 1; };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const cap = s => { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); };
  // inline !important: the NBME review styles force .qbank-body visible over stylesheet rules
  const hide = (el, yes) => {
    if(!el) return;
    if(yes && !el.hasAttribute('data-rr-hid')){ el.setAttribute('data-rr-hid', ''); el.style.setProperty('display', 'none', 'important'); }
    else if(!yes && el.hasAttribute('data-rr-hid')){ el.removeAttribute('data-rr-hid'); el.style.removeProperty('display'); }
  };

  const css = `
.rr-pane{--rr-bg:#fff;--rr-s:#f5f5f4;--rr-b:#dcdcd8;--rr-b2:#ebebe8;--rr-t:#1b1b1a;--rr-m:#6b6b68;--rr-sub:#434b57;
--rr-okbg:#eef6e4;--rr-okb:#97c459;--rr-okt:#27500a;--rr-okf:#3b6d11;--rr-badbg:#fdf0f0;--rr-badb:#f09595;--rr-badt:#791f1f;--rr-badf:#a32d2d;
--rr-wbg:#fbf1df;--rr-wb:#d98a14;--rr-wt:#633806;--rr-abg:#eef5fc;--rr-ab:#85b7eb;--rr-at:#0c447c;--rr-segbg:#efefec;--rr-segon:#fff;
background:var(--rr-bg);color:var(--rr-t);font-family:var(--rr-ff,Arial,Helvetica,sans-serif);font-size:calc(var(--rr-fs,16px) * var(--rr-z,1));line-height:var(--rr-lh,1.45);padding:0 14px 16px;overflow:auto;flex:1 1 auto;min-height:0;text-align:left;container-type:inline-size}
.rr-pane.rr-dark{--rr-bg:#000;--rr-t:#f0f0ee;--rr-m:#b4b4ae;--rr-sub:#d6dde6;--rr-b:#44454b;--rr-b2:#34353a;--rr-s:rgba(255,255,255,.05);
--rr-okbg:rgba(110,180,60,.16);--rr-okb:#6fa83a;--rr-okt:#c8e6a0;--rr-okf:#5f9a25;--rr-badbg:rgba(230,80,80,.16);--rr-badb:#d05a5a;--rr-badt:#ffc9c9;--rr-badf:#e05555;
--rr-wbg:rgba(230,160,40,.14);--rr-wb:#d39a3a;--rr-wt:#ffd38a;--rr-abg:transparent;--rr-ab:#5aa0e6;--rr-at:#a9d0f7;--rr-segbg:rgba(255,255,255,.07);--rr-segon:rgba(255,255,255,.16)}
.rr-pane *{box-sizing:border-box;transition:none!important;animation:none!important}
.rr-pane :is(.rr-nm,.rr-ans,.rr-tag,.rr-ht .k,.rr-lab,.rr-task,.rr-sub.on,.rr-l,.rr-arrow,.rr-fit .g,.rr-lure i,.rr-mx .k,.rr-colh,.rr-pw-n,.rr-pw-t,.rr-pw-k,.rr-pw-if,.rr-pw-tag){font-family:var(--rr-ffb,inherit)}
.rr-pane .rr-bar{position:sticky;top:0;z-index:2;display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;background:var(--rr-bg);border-bottom:1px solid var(--rr-b);margin:0 -14px 4px;padding:10px 14px 9px}
.rr-pane .rr-seg{display:inline-flex;background:var(--rr-segbg);border-radius:9px;padding:3px;gap:2px}
.rr-pane .rr-sub{font:inherit;font-size:.875em;font-weight:600;border:0;border-radius:7px;background:none;color:var(--rr-m);padding:5px 14px;margin:0;cursor:pointer;box-shadow:none;height:auto}
.rr-pane .rr-sub.on{background:var(--rr-segon);color:var(--rr-t);box-shadow:0 1px 2px rgba(0,0,0,.18)}
.rr-pane :is(.rr-sub,.rr-zoom button,.rr-more):focus-visible{outline:2px solid var(--rr-at);outline-offset:2px}
.rr-pane .rr-time{font-size:.8em;color:var(--rr-m);white-space:nowrap}.rr-pane .rr-time b{color:var(--rr-t)}
.rr-pane .rr-zoom{margin-left:auto;display:flex;gap:3px}
.rr-pane .rr-zoom button{font:inherit;font-size:.75em;border:1px solid var(--rr-b);background:transparent;color:var(--rr-m);border-radius:6px;width:28px;height:24px;cursor:pointer;padding:0;margin:0}
.rr-pane .rr-zoom button.rr-zr{width:auto;padding:0 7px}
.rr-lab{font-size:.72em;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--rr-m);margin:12px 0 4px}
.rr-call{margin-top:10px;background:var(--rr-abg);border-left:3px solid var(--rr-ab);border-radius:0 6px 6px 0;padding:6px 10px 7px}
.rr-task{display:block;font-size:.72em;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--rr-at);margin-bottom:3px}
.rr-flow{display:flex;flex-wrap:wrap;gap:4px 5px;align-items:center}
.rr-cl{background:var(--rr-bg);border:1px solid var(--rr-ab);border-radius:4px;padding:0 5px}
.rr-plus{color:var(--rr-m)}
.rr-arrow{color:var(--rr-at);font-weight:700}
.rr-ans{background:var(--rr-okf);color:#fff;border-radius:4px;padding:0 6px;font-weight:700}
.rr-ht{margin:8px 0 0;padding:1px 0 1px 9px;border-left:3px solid}
.rr-ht+.rr-ht{margin-top:6px}
.rr-ht .k{font-size:.72em;font-weight:700;letter-spacing:.07em;text-transform:uppercase;margin-right:6px}
.rr-ht.h{border-color:var(--rr-okb)}.rr-ht.h .k{color:var(--rr-okt)}
.rr-ht.t{border-color:var(--rr-wb)}.rr-ht.t .k{color:var(--rr-wt)}
.rr-o{display:grid;grid-template-columns:1.55em minmax(0,1fr);gap:0 9px;padding:6px 8px;border-radius:6px;align-items:start;border-left:3px solid transparent}
.rr-tbl .rr-o{grid-template-columns:1.55em minmax(0,1fr) minmax(0,30%);border-radius:0;border-top:1px solid var(--rr-b2)}
.rr-tbl .rr-o:first-of-type{border-top:0}
.rr-o.ok{background:var(--rr-okbg);border-left-color:var(--rr-okb)}.rr-o.me{background:var(--rr-badbg);border-left-color:var(--rr-badb)}
.rr-tbl .rr-o.ok,.rr-tbl .rr-o.me{border-radius:6px;border-top-color:transparent}
.rr-tbl .rr-o.ok{border-left-color:var(--rr-okb)}.rr-tbl .rr-o.me{border-left-color:var(--rr-badb)}
.rr-tbl .rr-o.ok+.rr-o,.rr-tbl .rr-o.me+.rr-o{border-top-color:transparent}
.rr-l{width:1.55em;height:1.55em;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.85em;font-weight:700;background:var(--rr-s);color:var(--rr-m);border:1px solid var(--rr-b);margin-top:.08em}
.rr-o.ok .rr-l{background:var(--rr-okf);color:#fff;border-color:var(--rr-okf)}
.rr-o.me .rr-l{background:var(--rr-badf);color:#fff;border-color:var(--rr-badf)}
.rr-nm{font-weight:700}
.rr-tag{font-size:.66em;font-weight:700;border-radius:20px;padding:1px 7px;margin-left:6px;vertical-align:.15em;color:#fff;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap}
.rr-tag.ok{background:var(--rr-okf)}.rr-tag.me{background:var(--rr-badf)}
.rr-sup{color:var(--rr-sub)}
.rr-fit .g{font-weight:700;margin-right:4px}
.rr-fit.y .g{color:var(--rr-okf)}.rr-fit.n .g{color:var(--rr-badf)}
.rr-lure{color:var(--rr-sub)}
.rr-lure i,.rr-mx .k{font-style:normal;font-weight:700;font-size:.72em;letter-spacing:.06em;text-transform:uppercase;margin-right:5px}
.rr-lure i{color:var(--rr-wt)}
.rr-mx .k{color:var(--rr-m)}
.rr-tbl .rr-mx .k{display:none}
.rr-mx .none{color:var(--rr-m)}
.rr-colh{display:grid;grid-template-columns:1.55em minmax(0,1fr) minmax(0,30%);gap:0 9px;padding:8px 8px 4px;font-size:.72em;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--rr-m)}
.rr-pane .rr-more{font:inherit;border:0;background:none;color:var(--rr-at);padding:4px 8px 0;margin:0;cursor:pointer;text-align:left;box-shadow:none;height:auto}
.rr-pane .rr-more:hover{text-decoration:underline}
.rr-stem{background:var(--rr-s);border-radius:6px;padding:8px 10px;white-space:pre-wrap}
.rr-dark .rr-stem{background:none;padding:0}
.rr-stem .rr-mk{background:var(--rr-wbg);border-radius:2px;padding:0 1px;box-shadow:inset 0 -2px 0 var(--rr-wb)}
.rr-stem .rr-mk.t{background:var(--rr-badbg);box-shadow:inset 0 -2px 0 var(--rr-badf)}
.rr-leg{font-size:.8em;color:var(--rr-m);margin-top:4px}
.rr-foot{margin-top:12px;font-size:.8em;color:var(--rr-m)}
.rr-sec{margin-top:12px}
.rr-pw-head{margin:10px 0 8px}
.rr-pw-k{display:block;font-size:.72em;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--rr-at)}
.rr-pw-t{font-weight:700}
.rr-pw-s{position:relative;padding:3px 6px 5px 2.05em;border-radius:6px}
.rr-pw-s+.rr-pw-s{margin-top:1px}
.rr-pw-n{position:absolute;left:.15em;top:.28em;width:1.45em;height:1.45em;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.8em;font-weight:700;background:var(--rr-s);color:var(--rr-m);border:1px solid var(--rr-b);z-index:1}
/* rail from this badge to the next step */
.rr-pw-s:not(:last-child)::before{content:"";position:absolute;left:calc(.15em + .58em);top:1.5em;bottom:-.45em;width:2px;background:var(--rr-b2)}
.rr-pw-s.nbs{background:var(--rr-wbg)}
.rr-pw-s.nbs .rr-pw-n{background:var(--rr-wb);border-color:var(--rr-wb);color:#fff}
.rr-pw-tag{font-size:.66em;font-weight:700;border-radius:20px;padding:1px 7px;margin-left:6px;vertical-align:.15em;color:#fff;background:var(--rr-wb);letter-spacing:.04em;text-transform:uppercase;white-space:nowrap}
.rr-pane.rr-dark .rr-pw-tag{color:#2a1c05}
.rr-pw-b{position:relative;padding-left:1.15em;margin-top:2px;color:var(--rr-t)}
.rr-pw-b::before{content:"";position:absolute;left:.1em;top:-.1em;width:.65em;height:.8em;border-left:1.5px solid var(--rr-b);border-bottom:1.5px solid var(--rr-b);border-bottom-left-radius:4px}
.rr-pw-b .rr-pw-b{margin-left:.2em}
.rr-pw-if{font-weight:700;color:var(--rr-at)}
.rr-pw-ar{color:var(--rr-m);margin:0 .3em}
.rr-pane :is(.rr-tp-k,.rr-tp-t,.rr-tp-row>.k,.rr-tp-tbl .cap,.rr-tp-tbl th,.rr-tp-tbl td:first-child,.rr-tp-row b,.rr-tp-core b,.rr-tp-tbl b){font-family:var(--rr-ffb,inherit)}
.rr-tp-head{margin:10px 0 6px}
.rr-tp-k{display:flex;align-items:center;gap:6px;font-size:.72em;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--rr-at)}
.rr-tp-kind{font-size:.95em;letter-spacing:.04em;border:1px solid var(--rr-ab);border-radius:20px;padding:0 7px}
.rr-tp-t{font-weight:700;font-size:1.1em;margin-top:1px}
.rr-tp-scope{font-size:.82em;color:var(--rr-m)}
.rr-tp-core{margin:8px 0 6px;background:var(--rr-abg);border-left:3px solid var(--rr-ab);border-radius:0 6px 6px 0;padding:6px 10px 7px}
.rr-tp-row{display:grid;grid-template-columns:7.2em minmax(0,1fr);gap:0 10px;border-top:1px solid var(--rr-b2);padding:6px 0}
.rr-tp-row>.k{font-size:.72em;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--rr-m);padding-top:.28em}
.rr-tp-row ul{margin:0;padding:0;list-style:none}
.rr-tp-row li{position:relative;padding-left:.9em;margin:1px 0}
.rr-tp-row li::before{content:"";position:absolute;left:.1em;top:.62em;width:.32em;height:.32em;border-radius:50%;background:var(--rr-m)}
.rr-tp-row li.st{background:var(--rr-wbg);border-radius:5px;padding:1px 6px 1px 1.35em;margin:2px 0}
.rr-tp-row li.st::before{content:"★";background:none;width:auto;height:auto;left:.35em;top:.08em;font-size:.85em;color:var(--rr-wb)}
.rr-tp-tbl{margin-top:10px}
.rr-tp-tbl .cap{font-size:.72em;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--rr-m);margin-bottom:4px}
.rr-tp-tbl table{border-collapse:collapse;width:100%;font-size:.88em}
.rr-tp-tbl th{text-align:left;font-size:.82em;font-weight:700;color:var(--rr-m);border-bottom:1px solid var(--rr-b);padding:3px 6px}
.rr-tp-tbl td{border-top:1px solid var(--rr-b2);padding:4px 6px;vertical-align:top}
.rr-tp-tbl td:first-child{font-weight:700}
.rr-tp-ev{margin-top:12px;font-size:.78em;color:var(--rr-m)}
.rr-tp-ev a{color:inherit}
@container (max-width:480px){
  .rr-tp-row{grid-template-columns:1fr}
  .rr-tp-row>.k{padding:0 0 2px}
  .rr-tp-tbl :is(table,tbody,tr,td){display:block;width:100%}
  .rr-tp-tbl thead{display:none}
  .rr-tp-tbl tr{border-top:1px solid var(--rr-b2);padding:5px 0}
  .rr-tp-tbl td{border:0;padding:0 6px}
  .rr-tp-tbl td:not(:first-child)::before{content:attr(data-h) ": ";font-size:.82em;font-weight:700;color:var(--rr-m)}
}
@container (max-width:480px){
  .rr-tbl .rr-o{grid-template-columns:1.55em minmax(0,1fr)}
  .rr-tbl .rr-mx{grid-column:2;margin-top:2px}
  .rr-tbl .rr-mx .k{display:inline}
  .rr-tbl .rr-mx.empty,.rr-colh{display:none}
  .rr-pane .rr-sub{padding:5px 10px}
}
.rr-pane .rr-hl-root{user-select:text;-webkit-user-select:text;-webkit-touch-callout:default}
.rr-pane .rr-hl{background:#ffe27a;color:#111;border-radius:2px;cursor:pointer}
.rr-pane.rr-dark .rr-hl{background:#d9b300;color:#000}
.qbank-panel[data-rr-on]{display:flex;flex-direction:column}
.qbank-panel[data-rr-on]>:is(.qbank-body,.tun-rvexhead,.tun-rvfoot):not(.rr-pane){display:none!important}
.qbank-tabs>.tux-layout{order:10!important}
.below-exp-panel>.rr-pane{overflow:visible}
@media (max-width:759.98px),(max-height:520px){.explanation-below .below-exp-wrap{max-width:none!important;width:auto!important}}
${setCss()}`;
  const st = document.createElement('style'); st.id = 'rapid-review-css'; st.textContent = css; document.head.appendChild(st);

  /* ---------- data: explanations/<ID>.json, one cached object per form ---------- */
  const FILES = 'explanations', MAXB = 2 * 1024 * 1024, GAP = 3600e3, CHK = 'stepRapidChecked';
  const GH = 'https://dawnsommer.github.io/exam-simulator2/form-updates-manifest.json';
  const cache = new Map(), RS = {count: 0, checkedAt: Number(ls.get(CHK)) || 0, offline: false, busy: false};
  let manual = null, running = null, lastRun = 0;
  // Storage: the apps keep their library inside closures, so this file opens the same stores itself.
  // iPad = the Browser Library IndexedDB (files/explanations/<ID>.json, written like the app does, epoch included).
  // Local = the DATA folder handle the app saved in IndexedDB (read/write permission must already be granted; "Check now" may ask).
  const installed = () => { try{ return StepLibraryBridge.forms().map(f => String(f.id)); }catch(e){ return []; } };
  const isIpad = () => window.__STEP_SIM_STORAGE_PROFILE === 'ipad-browser-library-primary';
  const missing = e => e && e.name === 'NotFoundError';
  const idbOpen = (name, store, opt) => new Promise((ok, no) => {
    const r = indexedDB.open(name, 1); r.onupgradeneeded = () => { if(!r.result.objectStoreNames.contains(store)) r.result.createObjectStore(store, opt); };
    r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
  });
  const EPOCH = '__stepsim_internal__/epoch', pathOf = id => FILES + '/' + id + '.json';
  const ipadTx = (mode, fn) => idbOpen('StepExamSimulatorV784_A4_iPadBrowserLibrary_DB', 'files', {keyPath: 'path'}).then(db => new Promise((ok, no) => {
    const t = db.transaction('files', mode); let out;
    try{ out = fn(t.objectStore('files')); }catch(e){ t.abort(); db.close(); no(e); return; }
    t.oncomplete = () => { db.close(); ok(typeof out === 'function' ? out() : out); }; t.onabort = t.onerror = () => { db.close(); no(t.error); };
  }));
  let rootH = null;
  async function localRoot(ask){
    if(typeof window.RAPID_REVIEW_DIR === 'function') return await window.RAPID_REVIEW_DIR(); // tests
    if(rootH) return rootH;
    const db = await idbOpen('StepExamSimulatorV75_DATA_Handle_DB', 'handles'), h = await new Promise((ok, no) => { const q = db.transaction('handles', 'readonly').objectStore('handles').get('lastDataFolder'); q.onsuccess = () => ok(q.result || null); q.onerror = () => no(q.error); });
    db.close();
    if(!h || !h.queryPermission) throw new Error('DATA folder is not connected.');
    const o = {mode: 'readwrite'};
    if(await h.queryPermission(o) !== 'granted' && !(ask && await h.requestPermission(o) === 'granted')) throw new Error('DATA folder permission is not granted.');
    return rootH = h;
  }
  const store = {
    // read: Blob or null when there is no file; write: replaces the file (the old one stays if it throws); count: number of stored files
    async read(id){
      if(isIpad()) return await ipadTx('readonly', s => { const q = s.get(pathOf(id)); return () => q.result ? q.result.blob : null; });
      try{ return await (await (await (await localRoot()).getDirectoryHandle(FILES)).getFileHandle(id + '.json')).getFile(); }catch(e){ if(missing(e)) return null; throw e; }
    },
    async write(id, blob, ask){
      if(isIpad()){
        if(window.__STEP_FORM_UPDATE_WRITING || window.__STEP_FORM_UPDATE_COMMITTING) throw new Error('form installation is running');
        return await ipadTx('readwrite', s => { s.put({path: pathOf(id), blob, updatedAt: Date.now(), type: blob.type || ''}); const e = s.get(EPOCH); e.onsuccess = () => s.put({path: EPOCH, value: (e.result && e.result.value || 0) + 1}); });
      }
      const w = await (await (await (await localRoot(ask)).getDirectoryHandle(FILES, {create: true})).getFileHandle(id + '.json', {create: true})).createWritable();
      await w.write(blob); await w.close();
    },
    async count(){
      if(isIpad()) return await ipadTx('readonly', s => { const q = s.getAllKeys(); return () => q.result.filter(k => /^explanations\/[^/]+\.json$/.test(String(k))).length; });
      let n = 0; try{ for await (const [name] of (await (await localRoot()).getDirectoryHandle(FILES)).entries()) if(/\.json$/i.test(name)) n++; }catch(e){ if(!missing(e)) throw e; }
      return n;
    }
  };
  function parseFile(text, id){
    const d = JSON.parse(text);
    if(!d || d.type !== 'StepRapidReview' || String(d.formId) !== id || !d.items || typeof d.items !== 'object' || Array.isArray(d.items)) throw new Error('not a StepRapidReview file for ' + id);
    return d;
  }
  const sha256 = async buf => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buf)), b => b.toString(16).padStart(2, '0')).join('');
  async function loadForm(id){
    let d = null;
    try{ const f = await store.read(id); if(f){ if(f.size > MAXB) throw new Error('over 2 MB'); d = parseFile(await f.text(), id); } }
    catch(e){ console.warn('Rapid Review: could not read ' + id, e); }
    cache.set(id, d); schedule();
  }
  // null until the stored file has been read (the tab appears once it finishes)
  function formData(id){
    if(!id) return null;
    if(cache.has(id)) return cache.get(id);
    cache.set(id, null); loadForm(id); return null;
  }
  // the form a question belongs to: Qbank questions carry sourceFormId; library runs load the form into importedBank (librarySlotId)
  function formIdOf(q){
    const ok = v => v && v !== 'QBANK_MODE' ? String(v) : '';
    try{ return ok(q.sourceFormId) || ok(importedBank && importedBank.librarySlotId) || ok(activeSession && activeSession.libraryFormId); }catch(e){ return ''; }
  }
  function curItem(){
    let q; try{ q = questions[state.current]; }catch(e){ return null; }
    if(!q || q.qid == null || q.qid === '') return null;
    const k = String(q.qid), d = manual && manual.items && manual.items[k] ? manual : formData(formIdOf(q)), it = d && d.items && d.items[k];
    return it ? {q, it, d} : null;
  }
  async function countFiles(){
    try{ const n = await store.count(); if(n !== RS.count){ RS.count = n; schedule(); } }catch(e){}
  }

  /* ---------- sync from the published manifest ---------- */
  async function get(url, ms){
    const c = new AbortController(), t = setTimeout(() => c.abort(), ms || 20000);
    try{ const r = await fetch(url, {cache: 'no-store', credentials: 'omit', signal: c.signal}); if(!r.ok) throw new Error('HTTP ' + r.status); return r; }
    finally{ clearTimeout(t); }
  }
  function entries(m){
    if(!m || m.schemaVersion !== 1 || !/^[a-f0-9]{40}$/.test(m.sourceCommit || '') || !/^[\w.-]+\/[\w.-]+$/.test(m.repository || '')) throw new Error('invalid manifest');
    return (Array.isArray(m.explanations) ? m.explanations : []).filter(x => x && /^[A-Za-z0-9_-]+$/.test(x.formId || '') && x.path === FILES + '/' + x.formId + '.json' && Number.isSafeInteger(x.size) && x.size >= 0 && x.size <= MAXB && /^[a-f0-9]{64}$/.test(x.sha256 || ''));
  }
  async function fetchOne(m, x, ask){
    const base = window.RAPID_REVIEW_FILE_BASE || 'https://raw.githubusercontent.com/' + m.repository + '/' + m.sourceCommit + '/update';
    const buf = await (await get(base + '/' + x.path.split('/').map(encodeURIComponent).join('/'), 30000)).arrayBuffer();
    if(buf.byteLength > MAXB || buf.byteLength !== x.size || await sha256(buf) !== x.sha256) throw new Error('size or sha256 mismatch');
    const d = parseFile(new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(buf), x.formId);
    await store.write(x.formId, new Blob([buf], {type: 'application/json'}), ask);
    cache.set(x.formId, d);
  }
  function sync(ask){
    if(running) return running;
    return running = (async () => {
      lastRun = Date.now(); RS.busy = true; rootH = null; schedule();
      try{
        await null;
        if(!(window.crypto && crypto.subtle)) return;
        if(!isIpad()){ try{ await localRoot(ask); }catch(e){ console.warn('Rapid Review: library storage is not available', e); return; } }
        let m;
        try{ m = await (await get(window.RAPID_REVIEW_MANIFEST_URL || (isIpad() ? new URL('form-updates-manifest.json', new URL('./', location.href)).href : GH))).json(); }
        catch(e){ RS.offline = true; console.warn('Rapid Review: manifest unavailable', e); return; }
        RS.offline = false;
        const list = entries(m), have = new Set(installed());
        RS.checkedAt = Date.now(); ls.set(CHK, String(RS.checkedAt));
        for(const x of list){
          if(!have.has(x.formId)) continue;
          if(window.__STEP_FORM_UPDATE_WRITING || window.__STEP_FORM_UPDATE_COMMITTING) break;
          try{
            const f = await store.read(x.formId);
            if(f && await sha256(await f.arrayBuffer()) === x.sha256) continue;
            await fetchOne(m, x, ask);
          }catch(e){ console.warn('Rapid Review: kept the saved ' + x.formId + ' file', e); }
        }
      }catch(e){ console.warn('Rapid Review: sync failed', e); }
      finally{ RS.busy = false; running = null; cache.forEach((v, k) => { if(!v) cache.delete(k); }); countFiles(); schedule(); }
    })();
  }

  // first non-transparent background up the tree (what the page really shows behind el); null when there is none
  function bgOf(el){
    for(let n = el; n; n = n.parentElement){
      const cs = getComputedStyle(n).backgroundColor, m = cs.match(/[\d.]+/g);
      if(m && (m.length < 4 || Number(m[3]) > 0.5)) return {c: cs, dark: (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) < 110};
    }
    return null;
  }
  // the learner's pick for the current question. The app marks it as .selected on the choice list (the same source as the
  // review's "Your answer"), which is rendered from state.answers; a stored value that is not a number is tolerated
  function pickOf(){
    let a = null; try{ a = state.answers && state.answers[state.current]; }catch(e){}
    if(a != null && a !== '' && Number.isInteger(Number(a))) return Number(a);
    const el = document.querySelector('#workspace .answers .answer.selected[data-choice]'), v = el ? Number(el.getAttribute('data-choice')) : NaN;
    return Number.isInteger(v) ? v : null;
  }
  // level-0 = numbered step; level 1-2 = branch rows inside the step above; "**cond:** action" -> cond → action
  function pwBranch(t){
    const m = String(t).match(/^\*\*(.+?):?\*\*:?\s*(.*)$/);
    return m ? `<span class="rr-pw-if">${esc(m[1].replace(/:$/, ''))}</span>${m[2] ? `<span class="rr-pw-ar">→</span>${esc(m[2])}` : ''}` : esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  }
  function pathHtml(alg){
    let out = '', n = 0, open = false, depth = 0;
    const tag = '<span class="rr-pw-tag">Next step</span>';
    (alg.nodes || []).forEach(nd => {
      const lv = Math.min(2, nd.level || 0);
      if(lv === 0 || !open){
        while(depth > 0){ out += '</div>'; depth--; }
        if(open) out += '</div>';
        out += `<div class="rr-pw-s${nd.nbs ? ' nbs' : ''}"><span class="rr-pw-n">${++n}</span>${pwBranch(nd.text)}${nd.nbs ? tag : ''}`;
        open = true;
      }else{
        while(depth >= lv){ out += '</div>'; depth--; }
        out += `<div class="rr-pw-b">${pwBranch(nd.text)}${nd.nbs ? tag : ''}`; depth++;
      }
    });
    while(depth > 0){ out += '</div>'; depth--; }
    if(open) out += '</div>';
    return `<div class="rr-pw-head"><span class="rr-pw-k">Pathway</span><span class="rr-pw-t">${esc(alg.title)}</span></div>${out}`;
  }
  // mark trigger phrases inside the plain stem; longer phrases win over overlaps, first match only.
  // Spans, not <mark>: the app styles and handles every mark as a learner highlight.
  function stemHtml(stem, trig){
    const hits = [];
    (trig || []).slice().sort((a, b) => b.text.length - a.text.length).forEach(t => {
      const i = stem.indexOf(t.text); if(i < 0) return;
      if(hits.some(h => i < h.e && i + t.text.length > h.s)) return;
      hits.push({s: i, e: i + t.text.length, t: !!t.trap});
    });
    hits.sort((a, b) => a.s - b.s);
    let out = '', pos = 0;
    hits.forEach(h => { out += esc(stem.slice(pos, h.s)) + `<span class="rr-mk${h.t ? ' t' : ''}">${esc(stem.slice(h.s, h.e))}</span>`; pos = h.e; });
    return out + esc(stem.slice(pos));
  }
  // "clue, clue + clue -> answer": one chip per clue (", " or " + "; "20,000" stays whole)
  function callHtml(it){
    const parts = String(it.boardCall || '').replace(/\.\s*$/, '').split(/\s*(?:->|→)\s*/), ans = parts.length > 1 ? parts.pop() : '';
    const left = parts.join(' → ').split(/,\s+|\s+\+\s+/).map(x => `<span class="rr-cl">${esc(x)}</span>`).join('<span class="rr-plus">+</span>');
    return `<div class="rr-call">${it.task ? `<span class="rr-task">${esc(it.task)}</span>` : ''}<div class="rr-flow">${left}${ans ? `<span class="rr-arrow">→</span><span class="rr-ans">${esc(ans)}</span>` : ''}</div></div>`;
  }
  // one option; table = Options tab (lure line + Management column), otherwise the Overview row
  function optRow(q, it, i, pick, cor, table){
    const L = LT[i], o = (it.options || {})[L] || {}, good = i === cor, mine = pick != null && pick !== cor && i === pick;
    const text = (q.choices[i] && (q.choices[i].text || q.choices[i])) || '';
    const clue = o.clue ? esc(o.clue) + (o.support ? ` <span class="rr-sup">· ${esc(o.support)}</span>` : '') : o.support ? `<span class="rr-sup">${esc(o.support)}</span>` : '';
    const mx = table ? `<div class="rr-mx${o.tx ? '' : ' empty'}"><span class="k">Mx</span>${o.tx ? esc(o.tx) : '<span class="none">—</span>'}</div>` : '';
    return `<div class="rr-o ${good ? 'ok' : mine ? 'me' : ''}"><span class="rr-l">${L}</span><div>
      <div class="rr-nm">${esc(text)}${good ? '<span class="rr-tag ok">Correct</span>' : ''}${mine ? '<span class="rr-tag me">Your pick</span>' : ''}</div>
      ${clue ? `<div>${clue}</div>` : ''}${o.fit ? `<div class="rr-fit ${good ? 'y' : 'n'}"><span class="g">${good ? '✓' : '✗'}</span>${esc(o.fit)}</div>` : ''}
      ${table && !good && o.tempting ? `<div class="rr-lure"><i>Lure</i>${esc(cap(o.tempting))}</div>` : ''}${!table && o.tx ? `<div class="rr-mx"><span class="k">Mx</span>${esc(o.tx)}</div>` : ''}</div>${mx}</div>`;
  }
  // the explanation's own "Time spent" value (the app draws it in its answer panel, which stays in the page while this tab is open)
  const spent = () => { const e = document.querySelector('#workspace .time-spent-value'); return e ? e.textContent.trim() : ''; };
  const hlSig = () => { try{ return JSON.stringify(hlList()); }catch(e){ return ''; } };
  // Topic sub-tab: the card for the item's topic id, carried in the same file's "topics" block (null when absent or malformed)
  function topicOf(c){
    const tp = c.d && c.d.topics, id = c.it && c.it.topic, card = tp && typeof tp === 'object' && id && tp[id];
    return card && typeof card === 'object' && Array.isArray(card.rows) ? card : null;
  }
  const mdb = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  function topicHtml(card){
    const str = v => typeof v === 'string' ? v : '';
    const rows = card.rows.filter(r => r && Array.isArray(r.items)).map(r => `<div class="rr-tp-row"><span class="k">${esc(str(r.label))}</span><ul>${r.items.map(str).filter(Boolean).map(x => x.startsWith('\u2605 ') ? `<li class="st">${mdb(x.slice(2))}</li>` : `<li>${mdb(x)}</li>`).join('')}</ul></div>`).join('');
    const tb = card.table, cols = tb && Array.isArray(tb.cols) ? tb.cols.map(str) : [];
    const table = cols.length && Array.isArray(tb.rows) ? `<div class="rr-tp-tbl"><div class="cap">${esc(str(tb.title))}</div><table><thead><tr>${cols.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${tb.rows.filter(Array.isArray).map(r => `<tr>${r.map((x, i) => `<td data-h="${esc(cols[i] || '')}">${mdb(str(x))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '';
    // markdown links in the evidence line: only http(s) targets become links
    const ev = esc(str(card.evidence)).replace(/\[([^\]]+)\]\((https?:\/\/[^\s)"]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    return `<div class="rr-tp-head"><div class="rr-tp-k">Topic${card.kind ? ` <span class="rr-tp-kind">${esc(str(card.kind))}</span>` : ''}</div><div class="rr-tp-t">${esc(str(card.name))}</div>${card.scope ? `<div class="rr-tp-scope">${esc(str(card.scope))}</div>` : ''}</div>`
      + (card.core ? `<div class="rr-tp-core">${mdb(str(card.core))}</div>` : '') + rows + table + (ev ? `<div class="rr-tp-ev">${ev}</div>` : '');
  }
  function render(c){
    const {q, it} = c, n = (q.choices || []).length;
    const pick = pickOf();
    const cor = Number(q.correct), wrong = pick != null && pick !== cor;
    const tempt = wrong && it.options && it.options[LT[pick]] && it.options[LT[pick]].tempting;
    const alg = it.algorithm, trig = it.triggers || [];
    const card = topicOf(c);
    // Topic stays the chosen sub-tab while paging; a question without a card shows Overview, the next card question returns to Topic
    if(wantTopic && card) sub = 'topic';
    if(sub === 'path' || (sub === 'topic' && !card)) sub = 'over';
    const bar = `<div class="rr-bar"><div class="rr-seg" role="tablist" aria-label="Rapid review sections">${[['over', 'Overview'], ['opt', 'Options'], ['stem', 'Stem']].concat(card ? [['topic', 'Topic']] : []).map(([k, l]) => `<button type="button" role="tab" aria-selected="${sub === k}" class="rr-sub ${sub === k ? 'on' : ''}" data-rr-sub="${k}">${l}</button>`).join('')}</div>${spent() ? `<span class="rr-time"><b>Time spent:</b> ${esc(spent())}</span>` : ''}<span class="rr-zoom"><button type="button" data-rr-z="-1" aria-label="Smaller text">A−</button><button type="button" class="rr-zr" data-rr-z="0" aria-label="Reset text size">${Math.round(getZ() * 100)}%</button><button type="button" data-rr-z="1" aria-label="Larger text">A+</button></span></div>`;
    let body;
    if(sub === 'opt'){
      const all = []; for(let i = 0; i < n; i++) all.push(i);
      body = `<div class="rr-tbl"><div class="rr-colh"><span></span><span>Choice · clue · fit</span><span>Management</span></div>${all.map(i => optRow(q, it, i, pick, cor, true)).join('')}</div>`;
    }else if(sub === 'topic'){
      body = topicHtml(card);
    }else if(sub === 'stem'){
      const stem = stemHtml(String(q.stem || ''), trig);
      body = `<div class="rr-lab">Stem${trig.length ? ' · clues marked' : ''}</div><div class="rr-stem">${stem}</div>${/rr-mk t/.test(stem) ? '<div class="rr-leg">Red mark = the phrase that pulls toward the trap.</div>' : ''}`;
    }else{
      const shown = wrong ? [cor, pick] : [cor], rest = [];
      for(let i = 0; i < n; i++) if(!shown.includes(i)) rest.push(LT[i]);
      body = callHtml(it)
        + (it.hinge ? `<div class="rr-ht h"><span class="k">Hinge</span>${esc(it.hinge)}</div>` : '')
        + `<div class="rr-ht t"><span class="k">${tempt ? 'Why ' + LT[pick] + ' pulled you' : 'Trap'}</span>${esc(tempt ? cap(tempt) + '.' : it.trap)}</div>`
        + `<div class="rr-lab">${wrong ? 'Answer vs your pick' : 'Answer'}</div>${shown.map(i => optRow(q, it, i, pick, cor, false)).join('')}`
        + (rest.length ? `<button type="button" class="rr-more" data-rr-sub="opt">${rest.join(', ')}: compare on the Options tab →</button>` : '')
        + (alg ? `<div class="rr-sec">${pathHtml(alg)}</div>` : '');
    }
    return bar + `<div class="rr-hl-root">` + body + `</div>` + `<div class="rr-foot">The explanation text wins if they conflict</div>`;
  }

  /* ---------- highlighting (the learner's own; kept on this device, per question and sub-tab) ---------- */
  // stored on the block's progress record (bp.rapidHighlights[itemIndex] = [{u: sub-tab, s, e, t}]), a section of its own beside the
  // stem/explanation anchors, so it saves and syncs with the attempt; without a session (console preview) it is kept in memory only
  const hlMem = {};
  const bpNow = () => { try{ return activeSession && activeSession.blocks && activeSession.blocks[blockPointer] || null; }catch(e){ return null; } };
  const hlList = () => { const bp = bpNow(), i = state.current; const a = bp ? (bp.rapidHighlights && bp.rapidHighlights[i]) : hlMem[i]; return Array.isArray(a) ? a : []; };
  const hlGet = () => hlList().filter(r => r && r.u === sub && r.e > r.s);
  function hlSet(list){
    const i = state.current, keep = hlList().filter(r => r && r.u !== sub), all = keep.concat(list.map(r => ({u: sub, s: r.s, e: r.e, t: r.t}))), bp = bpNow();
    if(bp){
      if(!bp.rapidHighlights || typeof bp.rapidHighlights !== 'object' || Array.isArray(bp.rapidHighlights)) bp.rapidHighlights = {};
      bp.rapidHighlights[i] = all;
      try{ persistBlockProgress(); }catch(e){}
    }else hlMem[i] = all;
  }
  function hlNodes(root){
    const out = [], w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {acceptNode: n => n.nodeValue && !(n.parentElement && n.parentElement.closest('button')) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT});
    let n, pos = 0; while((n = w.nextNode())){ out.push({n, s: pos, e: pos + n.nodeValue.length}); pos += n.nodeValue.length; }
    return out;
  }
  function applyHL(pane){
    const root = pane.querySelector('.rr-hl-root'); if(!root) return;
    const list = hlGet(); if(!list.length) return;
    const text = hlNodes(root).map(x => x.n.nodeValue).join('');
    list.forEach(r => {
      const nodes = hlNodes(root);
      let s = r.s, e = r.e;
      if(r.t && text.slice(s, e) !== r.t){ const i = text.indexOf(r.t); if(i < 0) return; s = i; e = i + r.t.length; }
      nodes.forEach(x => {
        const a = Math.max(s, x.s), b = Math.min(e, x.e); if(b <= a || !x.n.parentNode) return;
        let t = x.n; const o = a - x.s, l = b - a;
        if(o > 0) t = t.splitText(o);
        if(l < t.nodeValue.length) t.splitText(l);
        const m = document.createElement('span'); m.className = 'rr-hl'; t.parentNode.insertBefore(m, t); m.appendChild(t);
      });
    });
  }
  // a finished text selection inside the pane's content becomes a highlight (overlaps merge); click a highlight to remove it
  function hlFromSelection(){
    const sel = window.getSelection(); if(!sel || sel.isCollapsed || !sel.rangeCount) return;
    const rg = sel.getRangeAt(0), a = rg.commonAncestorContainer, el = a.nodeType === 1 ? a : a.parentElement, root = el && el.closest && el.closest('.rr-pane .rr-hl-root');
    const pane = root && root.closest('.rr-pane'), c = pane && curItem(); if(!c) return;
    const nodes = hlNodes(root), text = nodes.map(x => x.n.nodeValue).join('');
    const at = (node, off) => { const x = nodes.find(y => y.n === node); if(x) return x.s + off; if(node.nodeType === 1){ const ch = node.childNodes[off], y = ch && nodes.find(z => ch.contains(z.n)); return y ? y.s : (nodes.length ? nodes[nodes.length - 1].e : 0); } return null; };
    let s = at(rg.startContainer, rg.startOffset), e = at(rg.endContainer, rg.endOffset);
    if(s == null || e == null) return; if(e < s){ const t = s; s = e; e = t; }
    while(s < e && /\s/.test(text[s])) s++; while(e > s && /\s/.test(text[e - 1])) e--;
    if(e <= s) return;
    const merged = [];
    hlGet().concat([{s, e}]).sort((x, y) => x.s - y.s).forEach(r => { const l = merged[merged.length - 1]; if(l && r.s <= l.e) l.e = Math.max(l.e, r.e); else merged.push({s: r.s, e: r.e}); });
    merged.forEach(r => { r.t = text.slice(r.s, r.e); });
    hlSet(merged); sel.removeAllRanges(); pane.dataset.sig = ''; schedule();
  }
  function hlRemove(span){
    const root = span.closest('.rr-hl-root'), pane = root && root.closest('.rr-pane'), c = pane && curItem(); if(!c) return;
    const x = hlNodes(root).find(y => span.contains(y.n)); if(!x) return;
    hlSet(hlGet().filter(r => !(x.s >= r.s && x.s < r.e))); pane.dataset.sig = ''; schedule();
  }
  let hlTimer = 0;
  const hlSoon = () => { clearTimeout(hlTimer); hlTimer = setTimeout(hlFromSelection, 200); };
  document.addEventListener('mouseup', hlSoon); document.addEventListener('touchend', hlSoon); document.addEventListener('keyup', e => { if(e.shiftKey) hlSoon(); });

  /* ---------- placing the tabs ---------- */
  function paint(pane, c, panel){
    const pick = pickOf(), sig = c.q.qid + '|' + pick + '|' + sub + '|' + getZ() + '|' + spent() + '|' + hlSig();
    pane.style.setProperty('--rr-z', getZ());
    if(pane.dataset.sig !== sig){ const keep = pane.scrollTop; pane.innerHTML = render(c); pane.dataset.sig = sig; applyHL(pane); pane.scrollTop = keep; }
    const stem = document.getElementById('stem');
    if(stem){ const cs = getComputedStyle(stem);
      // size + line height follow the explanation text (hidden is fine: computed style still works); family stays the stem's
      const eb = document.querySelector('#workspace .qbank-body[data-panel-mode="explanation"]'), ee = eb && (eb.querySelector('p, li') || eb), ec = ee && getComputedStyle(ee);
      const fs = ec ? ec.fontSize : cs.fontSize, fpx = parseFloat(fs), lpx = ec && /px$/.test(ec.lineHeight) ? parseFloat(ec.lineHeight) : 0, lh = String(lpx > 0 && fpx > 0 ? +(lpx / fpx).toFixed(3) : 1.45);
      if(pane.style.getPropertyValue('--rr-fs') !== fs) pane.style.setProperty('--rr-fs', fs);
      if(pane.style.getPropertyValue('--rr-lh') !== lh) pane.style.setProperty('--rr-lh', lh);
      if(cs.fontFamily && pane.style.getPropertyValue('--rr-ff') !== cs.fontFamily){
      // the NBME stem font starts with "Arial Unicode MS", which has no bold face: bold text uses the rest of the list (Arial)
      pane.style.setProperty('--rr-ff', cs.fontFamily);
      pane.style.setProperty('--rr-ffb', cs.fontFamily.replace(/"?Arial Unicode MS"?\s*,\s*/i, '')); } }
    // dark: the pane has no colour of its own; it takes exactly what the page shows behind the explanation
    const eb = document.querySelector('#workspace .qbank-body[data-panel-mode="explanation"]'), bg = bgOf(eb || panel) || bgOf(panel), d = !!bg && bg.dark;
    if(pane.classList.contains('rr-dark') !== d) pane.classList.toggle('rr-dark', d);
    if(d && bg){ if(pane.style.getPropertyValue('--rr-bg') !== bg.c) pane.style.setProperty('--rr-bg', bg.c); }
    else if(pane.style.getPropertyValue('--rr-bg')) pane.style.removeProperty('--rr-bg');
  }
  // what a panel shows under its tabs (the body, plus the NBME review's "Your answer" header)
  const content = panel => Array.from(panel.children).filter(n => !n.matches('.qbank-tabs, .rr-pane, [data-rr-ph], style, script'));
  // put the Rapid review tab in this panel; on = it is the active tab (the panel's own tabs are restored when off)
  function mount(panel, c, on){
    const tabs = panel && panel.querySelector(':scope > .qbank-tabs'); if(!tabs) return;
    let btn = tabs.querySelector(':scope > [data-rr-tab]'), pane = panel.querySelector(':scope > .rr-pane');
    if(!btn){ btn = document.createElement('button'); btn.type = 'button'; btn.className = 'qbank-tab'; btn.setAttribute('data-rr-tab', ''); btn.style.setProperty('order', '9', 'important'); btn.textContent = 'Rapid review'; tabs.insertBefore(btn, tabs.querySelector(':scope > .tux-layout')); }
    panel.toggleAttribute('data-rr-on', on);
    tabs.querySelectorAll(':scope > .qbank-tab:not([data-rr-tab])').forEach(b => {
      if(on && b.classList.contains('active')){ b.classList.remove('active'); b.setAttribute('data-rr-was', ''); }
      else if(!on && b.hasAttribute('data-rr-was')){ b.classList.add('active'); b.removeAttribute('data-rr-was'); }
    });
    btn.classList.toggle('active', on);
    content(panel).forEach(b => hide(b, on));
    if(!on){ if(pane) pane.remove(); return; }
    if(!pane){
      pane = document.createElement('div'); pane.className = 'rr-pane';
      const bodies = panel.querySelectorAll(':scope > .qbank-body');
      (bodies.length ? bodies[bodies.length - 1] : tabs).insertAdjacentElement('afterend', pane);
    }
    paint(pane, c, panel);
  }
  function unmount(panel){
    if(!panel) return;
    const btn = panel.querySelector(':scope > .qbank-tabs > [data-rr-tab]'), pane = panel.querySelector(':scope > .rr-pane');
    if(btn) btn.remove(); if(pane) pane.remove();
    if(panel.hasAttribute('data-rr-on')) panel.removeAttribute('data-rr-on');
    if(!panel.querySelector(':scope > [data-rr-moved]')) content(panel).forEach(b => hide(b, false));
    panel.querySelectorAll(':scope > .qbank-tabs > [data-rr-was]').forEach(b => { b.classList.add('active'); b.removeAttribute('data-rr-was'); });
  }
  // a side panel for questions without an exhibit (the app only builds one for the exhibit in the Below layout)
  function makeSide(flex){
    const w = document.createElement('section'); w.className = 'right-panel-wrap'; w.setAttribute('data-rr-side', '');
    w.innerHTML = '<div class="qbank-panel"><div class="qbank-tabs"></div><div class="qbank-body" data-rr-ph></div></div>';
    w.querySelector('[data-rr-ph]').style.setProperty('display', 'none', 'important');
    flex.appendChild(w);
    const main = flex.querySelector(':scope > .question-main');
    if(main && main.classList.contains('no-image')){ main.classList.remove('no-image'); main.setAttribute('data-rr-noimg', ''); }
    return w;
  }
  function dropSide(flex, w){
    w.remove();
    const main = flex.querySelector(':scope > .question-main');
    if(main && main.hasAttribute('data-rr-noimg')){ main.removeAttribute('data-rr-noimg'); main.classList.add('no-image'); }
  }
  // Explanation beside the question: move the app's explanation body (highlights find it by data-panel-mode) into the side panel
  function moveExp(below, side){
    hide(below.querySelector(':scope > .qbank-tabs > .qbank-tab:not([data-rr-tab])'), true);
    content(below).forEach(n => { n.setAttribute('data-rr-moved', ''); side.appendChild(n); });
    if(!side.querySelector(':scope > [data-rr-moved]')) return;
    const tabs = side.querySelector(':scope > .qbank-tabs');
    let et = tabs.querySelector(':scope > [data-rr-exptab]');
    if(!et){ et = document.createElement('button'); et.type = 'button'; et.className = 'qbank-tab'; et.setAttribute('data-rr-exptab', ''); et.textContent = 'Explanation'; tabs.insertBefore(et, tabs.querySelector(':scope > .tux-layout')); }
    const items = content(side), showExp = sideTab === 'exp' || items.every(n => n.hasAttribute('data-rr-moved'));
    items.forEach(n => hide(n, n.hasAttribute('data-rr-moved') ? !showExp : showExp));
    tabs.querySelectorAll(':scope > .qbank-tab').forEach(b => b.classList.toggle('active', b === et ? showExp : !showExp));
  }
  function restoreExp(below){
    const moved = document.querySelectorAll('#workspace [data-rr-moved]');
    if(moved.length){
      const side = moved[0].parentElement;
      let ref = below && below.querySelector(':scope > .qbank-tabs');
      moved.forEach(n => { n.removeAttribute('data-rr-moved'); hide(n, false); if(ref){ ref.insertAdjacentElement('afterend', n); ref = n; } else n.remove(); });
      const et = side.querySelector(':scope > .qbank-tabs > [data-rr-exptab]'); if(et) et.remove();
      content(side).forEach(n => hide(n, false));
      const tabs = side.querySelectorAll(':scope > .qbank-tabs > .qbank-tab');
      if(tabs.length && !side.querySelector(':scope > .qbank-tabs > .qbank-tab.active')) tabs[0].classList.add('active');
    }
    if(below) below.querySelectorAll(':scope > .qbank-tabs > .qbank-tab[data-rr-hid]').forEach(b => hide(b, false));
  }
  function ensure(){
    raf = 0; addSettings();
    const ws = document.getElementById('workspace'); if(!ws) return;
    // phones always use the Below layout (set in memory only; the saved choice is untouched)
    try{
      const want = isPhone() ? 'below' : (ls.get(LAYOUT) === 'below' ? 'below' : 'split');
      if(reviewExplanationLayout !== want){
        reviewExplanationLayout = want;
        if(ws.querySelector('.below-exp-panel, .qbank-tab[data-panel-tab="explanation"]') && typeof renderQuestion === 'function' && Array.isArray(questions) && questions.length){ renderQuestion(); return; }
      }
    }catch(e){}
    const c = curItem(), flex = ws.querySelector('.question-flex'), belowPanel = ws.querySelector('.below-exp-panel');
    const below = !!ws.querySelector('.question-stack.explanation-below');
    const reveal = below ? !!belowPanel : !!ws.querySelector('.right-panel-wrap .qbank-tab[data-panel-tab="explanation"]');
    const P = getPlace();
    // split: one side panel; rrSide: explanation under, Rapid Review beside; both: both under; expSide: explanation beside, Rapid Review under
    const mode = !c || !reveal || !flex ? null : isPhone() ? 'both' : !below ? 'split' : P.exp === 'side' ? 'expSide' : P.rr === 'below' ? 'both' : 'rrSide';
    const key = mode && c.q.qid + '|' + mode;
    if(key !== autoKey){ autoKey = key; rrOn = mode === 'rrSide' || getPref() === 'rapid'; sideTab = 'exp'; }
    let made = flex && flex.querySelector(':scope > .right-panel-wrap[data-rr-side]');
    const appSide = flex && flex.querySelector(':scope > .right-panel-wrap:not([data-rr-side]) > .qbank-panel');
    const wantMade = (mode === 'rrSide' || mode === 'expSide') && !appSide;
    if(wantMade && !made) made = makeSide(flex);
    else if(!wantMade && made){ dropSide(flex, made); made = null; }
    const side = appSide || (made && made.querySelector(':scope > .qbank-panel'));
    if(mode !== 'expSide') restoreExp(belowPanel);
    if(mode === 'split'){ mount(side, c, rrOn); }
    else if(mode === 'rrSide'){ mount(side, c, !!made || rrOn); unmount(belowPanel); }
    else if(mode === 'both'){ unmount(side); mount(belowPanel, c, rrOn); }
    else if(mode === 'expSide'){ unmount(side); moveExp(belowPanel, side); mount(belowPanel, c, true); }
    else{ unmount(side); unmount(belowPanel); }
  }

  /* ---------- Settings -> Appearance: "Review screen" group (thunder-ui.js builds Settings and stays untouched) ---------- */
  function setCss(){
    const S = ':root[data-tu] body #menu .rr-set';
    return `
.rr-set{border-top:1px solid var(--tu-line2,#e4e7f0);margin-top:6px;container-type:inline-size}
${S} .rr-setgrid{display:grid;grid-template-columns:minmax(0,1fr) 250px;border-top:1px solid var(--tu-line2)}
${S} .rr-setgrid>.rr-rows>.tu-setrow:first-child{border-top:0}
${S} .rr-prev{border-left:1px solid var(--tu-line2);padding:14px 16px;display:flex;flex-direction:column;gap:8px;background:var(--tu-s1)}
${S} .rr-cap{font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--tu-on3)}
${S} .rr-prev p{margin:0;font-size:12.5px;line-height:1.45;color:var(--tu-on2)}
${S} .rr-dim{opacity:.55}
${S} .rr-lay{display:flex;gap:10px;flex-wrap:wrap}
${S} .rr-lay>button{all:unset;box-sizing:border-box;font-family:inherit;display:flex;flex-direction:column;align-items:flex-start;gap:7px;width:150px;padding:9px 10px 10px;border:1.5px solid var(--tu-line);border-radius:14px;background:var(--tu-surface);color:var(--tu-on);cursor:pointer;text-align:left}
${S} .rr-lay>button[aria-checked="true"]{border-color:var(--tu-p);background:color-mix(in srgb,var(--tu-pc) 45%,var(--tu-surface));box-shadow:0 0 0 1px var(--tu-p) inset}
${S} .rr-lay>button:focus-visible,${S} .rr-chip:focus-visible{outline:2px solid var(--tu-p);outline-offset:2px}
${S} .rr-lay b{font-size:14px;font-weight:700;display:flex;align-items:center;gap:6px}
${S} .rr-lay small{font-size:12px;line-height:1.35;color:var(--tu-on2)}
${S} .rr-dot{width:14px;height:14px;border-radius:50%;border:2px solid var(--tu-on3);box-sizing:border-box;flex:none}
${S} [aria-checked="true"] .rr-dot{border:4px solid var(--tu-p)}
${S} .rr-wf{display:grid;gap:3px;background:var(--tu-s2);border-radius:7px;padding:4px;width:100%;aspect-ratio:16/10;box-sizing:border-box}
${S} .rr-wf>div{border-radius:4px;background:var(--tu-surface);display:flex;flex-direction:column;gap:2px;padding:3px;min-height:0;overflow:hidden}
${S} .rr-wf i{display:block;height:3px;border-radius:2px;background:var(--tu-s3)}
${S} .rr-wf .tb-row{display:flex;gap:2px;flex-wrap:wrap}
${S} .rr-wf .tb{font-size:7.5px;line-height:1;padding:2px 3px;border-radius:2px;background:var(--tu-s2);color:var(--tu-on3);font-weight:700;white-space:nowrap}
${S} .rr-wf .tb.on{background:var(--tu-p);color:var(--tu-onp)}
${S} .rr-wf .lb{font-size:9.5px;color:var(--tu-on3);font-weight:700;letter-spacing:.04em;text-transform:uppercase}
${S} .rr-wf.big{aspect-ratio:auto;height:190px;padding:6px;gap:5px}
${S} .rr-wf.big>div{padding:6px;gap:4px}
${S} .rr-wf.big i{height:5px}
${S} .rr-wf.big .tb{font-size:10.5px;padding:3px 6px;border-radius:4px}
${S} .rr-placerow>.rr-place{flex:1 1 100%;display:grid;grid-template-columns:1fr 1fr;gap:10px}
${S} .rr-zone{border:1.5px dashed var(--tu-line);border-radius:14px;padding:9px 10px 10px;min-height:84px;background:var(--tu-s1)}
${S} .rr-zone.off{opacity:.45}
${S} .rr-zone h4{margin:0 0 7px;font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--tu-on3)}
${S} .rr-zone>div{display:flex;flex-wrap:wrap;gap:6px}
${S} .rr-zone em{font-style:normal;font-size:12.5px;color:var(--tu-on3)}
${S} .rr-chip{all:unset;box-sizing:border-box;font-family:inherit;display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 12px;border-radius:999px;border:1px solid var(--tu-line);background:var(--tu-surface);color:var(--tu-on);font-weight:700;font-size:13.5px;white-space:nowrap;cursor:pointer}
${S} button.rr-chip:not(:disabled):hover{border-color:var(--tu-on3)}
${S} .rr-chip:disabled{cursor:default}
${S} .rr-chip.lock{cursor:default;color:var(--tu-on2)}
${S} .rr-chip.first{border-color:var(--tu-p)}
${S} .rr-chip.first::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--tu-p)}
${S} .rr-chip small{font-size:12px;font-weight:600;color:var(--tu-on3)}
${S} .rr-hint{flex:1 1 100%;font-size:12.5px;color:var(--tu-warn,#7d4b00);margin-top:-4px}
${S} .rr-hint:empty{display:none}
${S} .tu-setseg button:disabled{cursor:default}
${S} .rr-st{font-size:13.5px;color:var(--tu-on2);white-space:nowrap}
${S} .rr-link{all:unset;box-sizing:border-box;font:inherit;color:var(--tu-p);text-decoration:underline;cursor:pointer}
${S} .rr-link:disabled{cursor:default;opacity:.55}
${S} .rr-link:focus-visible{outline:2px solid var(--tu-p);outline-offset:2px}
@container (max-width:640px){${S} .rr-setgrid{grid-template-columns:1fr}${S} .rr-prev{border-left:0;border-top:1px solid var(--tu-line2)}${S} .rr-placerow>.rr-place{grid-template-columns:1fr}${S} .rr-lay>button{width:calc(50% - 5px)}}`;
  }
  const NAME = {exp: 'Explanation', rr: 'Rapid review', ex: 'Exhibit'};
  function setState(){
    const layout = getLayout(), P = getPlace(), first = getPref() === 'rapid' ? 'rr' : 'exp';
    const zoneOf = (k, lay) => k === 'ex' || (lay || layout) === 'split' ? 'side' : P[k];
    return {layout, P, first, zoneOf, together: zoneOf('exp') === zoneOf('rr')};
  }
  // small picture of a layout; the filled tab is the one that opens first in its panel
  function wfHtml(s, lay, big){
    const lines = '<i></i><i style="width:80%"></i><i></i><i style="width:60%"></i>';
    const tabs = zone => {
      const ks = ['exp', 'rr', 'ex'].filter(k => s.zoneOf(k, lay) === zone), both = ks.includes('exp') && ks.includes('rr');
      const on = both ? s.first : ks.find(k => k !== 'ex') || ks[0];
      return `<div class="tb-row">${ks.map(k => `<span class="tb ${k === on ? 'on' : ''}">${big ? NAME[k] : {exp: 'Expl.', rr: 'Rapid', ex: 'Exhibit'}[k]}</span>`).join('')}</div>`;
    };
    const lb = t => big ? `<span class="lb">${t}</span>` : '';
    return lay === 'split'
      ? `<div class="rr-wf${big ? ' big' : ''}" style="grid-template-columns:1fr 1fr"><div>${lb('Question')}${lines}${lines}</div><div>${tabs('side')}</div></div>`
      : `<div class="rr-wf${big ? ' big' : ''}" style="grid-template-columns:1.25fr 1fr;grid-template-rows:auto 1fr"><div>${lb('Question')}${lines}</div><div style="grid-row:span 2">${lb('Beside')}${tabs('side')}</div><div>${lb('Under')}${tabs('below')}</div></div>`;
  }
  function statusText(){
    if(RS.busy) return 'Checking…';
    const n = RS.count, f = n ? n + ' form' + (n === 1 ? '' : 's') : 'None yet', z = v => String(v).padStart(2, '0'), d = new Date(RS.checkedAt);
    return RS.offline ? (n ? f + ' · offline, using saved files' : f + ' · offline') : RS.checkedAt ? f + ' · checked ' + z(d.getHours()) + ':' + z(d.getMinutes()) : f;
  }
  function setHtml(){
    const s = setState(), split = s.layout === 'split';
    const chip = k => {
      if(k === 'ex') return '<span class="rr-chip lock" title="The exhibit stays beside the question">🔒 Exhibit</span>';
      const z = s.zoneOf(k);
      return `<button type="button" class="rr-chip ${s.together && s.first === k ? 'first' : ''}" data-rr-mv="${k}"${split ? ' disabled' : ''}>${NAME[k]}${split ? '' : `<small>${z === 'side' ? 'move under ↓' : 'move beside ↑'}</small>`}</button>`;
    };
    const zone = (z, title) => `<div class="rr-zone ${split && z === 'below' ? 'off' : ''}"><h4>${title}</h4><div>${['exp', 'rr', 'ex'].filter(k => s.zoneOf(k) === z).map(chip).join('') || '<em>Nothing here</em>'}</div></div>`;
    const firstDesc = !s.together ? 'Explanation and Rapid review are in different places, so both show at once.'
      : split ? 'Both share the side panel. Pick the tab that opens when you review a question.' : 'Both are under the question. Pick the tab that opens first.';
    const prev = split ? 'Question on the left; Explanation, Rapid review and Exhibit as tabs in the side panel.'
      : `Explanation ${s.zoneOf('exp') === 'side' ? 'beside' : 'under'} the question, Rapid review ${s.zoneOf('rr') === 'side' ? 'beside' : 'under'}. Exhibit beside.`;
    const lay = (v, l, d) => `<button type="button" role="radio" aria-checked="${s.layout === v}" data-rr-lay="${v}">${wfHtml(s, v)}<b><span class="rr-dot"></span>${l}</b><small>${d}</small></button>`;
    const first = (v, l) => `<button type="button" role="radio" aria-checked="${s.first === v}" data-rr-first="${v}"${s.together ? '' : ' disabled'}>${l}</button>`;
    return `<div class="tu-sechead"><h2>Review screen</h2><p>Where the explanation and Rapid Review appear when you review a question. The Split/Below switch in the exam’s Settings menu changes the same setting. On phones, Explanation and Rapid Review always sit under the question as tabs, since side by side doesn’t fit.</p></div>
      <div class="rr-setgrid"><div class="rr-rows">
        <div class="tu-setrow"><div><b>Layout</b><span>Side by side with the question, or stacked under it.</span></div><div class="tu-setctl"><div class="rr-lay" role="radiogroup" aria-label="Review layout">${lay('split', 'Split', 'All tabs beside the question')}${lay('below', 'Below', 'Reading space under the question')}</div></div></div>
        <div class="tu-setrow rr-placerow"><div><b>Tab placement</b><span>${split ? 'Split keeps every tab in the side panel. Choose Below to place tabs under the question.' : 'Click a tab to move it. Keep at least one under the question.'}</span></div><div class="rr-place">${zone('side', 'Beside the question')}${zone('below', 'Under the question')}</div><div class="rr-hint">${esc(setHint)}</div></div>
        <div class="tu-setrow${s.together ? '' : ' rr-dim'}"><div><b>Opens first</b><span>${firstDesc}</span></div><div class="tu-setctl"><div class="tu-setseg" role="radiogroup" aria-label="Opens first">${first('exp', 'Explanation')}${first('rr', 'Rapid Review')}</div></div></div>
      </div><aside class="rr-prev"><span class="rr-cap">Preview</span>${wfHtml(s, s.layout, true)}<p>${prev}</p></aside></div>
      <div class="tu-setrow rr-data"><div><b>Rapid Review data</b></div><div class="tu-setctl rr-st">${esc(statusText())} · <button type="button" class="rr-link" data-rr-check${RS.busy ? ' disabled' : ''}>Check now</button></div></div>`;
  }
  function addSettings(){
    document.querySelectorAll('section.tu-setbody').forEach(sec => {
      const h = sec.querySelector('.tu-sechead h2');
      if(!h || h.textContent.trim() !== 'Appearance') return;
      const sig = [getLayout(), ls.get(PLACE), getPref(), setHint, statusText()].join('|');
      let box = sec.querySelector('[data-rr-set]');
      if(box && box.dataset.sig === sig) return;
      if(!box){ box = document.createElement('div'); box.className = 'rr-set'; box.setAttribute('data-rr-set', ''); sec.appendChild(box); }
      box.innerHTML = setHtml(); box.dataset.sig = sig;
    });
  }
  // the review re-renders only when it is on screen; otherwise the next render picks the new setting up
  function rerender(){
    const ex = document.getElementById('examScreen');
    try{ if(ex && ex.getClientRects().length && typeof renderQuestion === 'function' && Array.isArray(questions) && questions.length) renderQuestion(); }catch(e){}
  }
  function setLayout(v){
    ls.set(LAYOUT, v);
    try{ reviewExplanationLayout = v; }catch(e){}
    rerender();
  }
  function moveTab(k){
    const P = getPlace(), other = k === 'exp' ? 'rr' : 'exp';
    if(P[k] === 'below' && P[other] === 'side'){ setHint = 'Keep at least one tab under the question, or choose Split.'; return; }
    P[k] = P[k] === 'side' ? 'below' : 'side'; setHint = '';
    ls.set(PLACE, JSON.stringify(P));
  }

  // run before the next paint (microtask), then once more after the frame: the NBME review adds its own header/footer in its frames
  let mt = false;
  const schedule = () => {
    if(!mt){ mt = true; queueMicrotask(() => { mt = false; ensure(); }); }
    if(!raf) raf = requestAnimationFrame(ensure);
  };
  document.addEventListener('click', e => {
    const t = e.target; if(!t || !t.closest) return;
    const hs = t.closest('.rr-pane .rr-hl'); if(hs){ const sl = window.getSelection(); if(!sl || sl.isCollapsed){ hlRemove(hs); return; } }
    if(t.closest('[data-rr-check]')){ sync(true); return; }
    const sb = t.closest('[data-rr-sub]');
    if(sb){ sub = sb.getAttribute('data-rr-sub'); if(sub === 'path') sub = 'over'; wantTopic = sub === 'topic'; schedule(); return; }
    const zb = t.closest('[data-rr-z]');
    if(zb){ const dz = Number(zb.getAttribute('data-rr-z')); ls.set(ZOOM, String(dz === 0 ? 1 : Math.max(0.8, Math.min(1.3, +(getZ() + 0.05 * dz).toFixed(2))))); schedule(); return; }
    const lb = t.closest('[data-rr-lay]');
    if(lb){ setHint = ''; setLayout(lb.getAttribute('data-rr-lay')); schedule(); return; }
    const mv = t.closest('[data-rr-mv]');
    if(mv){ if(!mv.disabled) moveTab(mv.getAttribute('data-rr-mv')); schedule(); return; }
    const fb = t.closest('[data-rr-first]');
    if(fb){ if(!fb.disabled){ ls.set(PREF, fb.getAttribute('data-rr-first') === 'rr' ? 'rapid' : 'explanation'); setHint = ''; } schedule(); return; }
    if(t.closest('[data-rr-tab]')){ e.preventDefault(); e.stopImmediatePropagation(); rrOn = true; schedule(); return; }
    if(t.closest('[data-rr-exptab]')){ e.preventDefault(); e.stopImmediatePropagation(); sideTab = 'exp'; schedule(); return; }
    const tab = t.closest('.qbank-panel > .qbank-tabs > .qbank-tab');
    if(!tab) return;
    const panel = tab.closest('.qbank-panel');
    // the Exhibit tab beside a moved explanation switches here; the app's re-render would drop the moved body
    if(panel.querySelector(':scope > [data-rr-moved]')){ e.preventDefault(); e.stopImmediatePropagation(); sideTab = 'ex'; schedule(); return; }
    if(rrOn && panel.hasAttribute('data-rr-on')){ rrOn = false; schedule(); }
  }, true);
  new MutationObserver(schedule).observe(document.body, {childList: true, subtree: true});
  addEventListener('resize', schedule);
  // a theme switch (exam dark mode, Dark Theme) changes classes on the page and the exam screen without re-rendering the question
  { const wt = new MutationObserver(schedule); wt.observe(document.documentElement, {attributes: true, attributeFilter: ['class']}); wt.observe(document.body, {attributes: true, attributeFilter: ['class']}); const es = document.getElementById('examScreen'); if(es) wt.observe(es, {attributes: true, attributeFilter: ['class']}); }
  schedule();
  // start: wait until the library storage and catalog are ready (up to 60 s), then check once
  (function boot(n){
    n = n || 0;
    if(installed().length || n >= 120){ countFiles(); sync(); return; }
    if(n < 120) setTimeout(() => boot(n + 1), 500);
  })();
  document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible' && lastRun && Date.now() - lastRun >= GAP) sync(); });
  // setData: console preview (any question whose qid is in d.items); sync: manual check (returns a promise)
  window.RapidReview = {setData: d => { manual = d || null; schedule(); }, sync: () => sync(true), formData};
})();

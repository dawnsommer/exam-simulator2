/* Shared LOCAL/iPad "Realistic NBME navigation delay" (optional, off by default).
   Like the NBME test driver, moving to another question hides the question area, freezes the clocks while the
   item "loads" (280–360 ms, or 500–800 ms one time in ten), navigates, resumes the clocks, and shows the question
   about 300 ms later. Lenient keeps the clocks frozen until the question shows. Live blocks only: review, tutor,
   a paused exam and a block's first question are never delayed.
   Hooks in each app (and nothing else): goToQuestionIndex() asks intercept() first, examClockNow() reads frozenAt,
   and the exam Settings menu adds settingHtml(). Off, the cost is one property check per navigation.
   Turn it off from the exam Settings menu, or with NavDelay.disable(). */
(function(){
  'use strict';
  const KEY = 'ThunderUSMLE.navDelay', MODE_KEY = 'ThunderUSMLE.navDelayMode';
  const NAV = '#nextNav,#prevNav,#proceedBtn,#statusRows .status-row,.goq,#tuxNav [data-tux-go],.tux [data-tux="prev"],.tux [data-tux="next"]';
  const CONTROL = 'button,[role="button"],a,input,select,textarea,label,.tool,#timeBox,#itemBox,#lockBtn,#endBlockBtn,#markQuestion,[data-ref-action]';
  const read = k => { try { return localStorage.getItem(k); } catch(_) { return null; } };
  const write = (k, v) => { try { localStorage.setItem(k, v); } catch(_) {} };
  const rand = (lo, hi) => lo + Math.random() * (hi - lo);
  const serverDelay = () => Math.random() < 0.1 ? rand(500, 800) : rand(280, 360);
  let lenient = read(MODE_KEY) === 'lenient';
  let busy = false, pending = null, loadTimer = 0, showTimer = 0, cover = null;

  const api = {
    on: read(KEY) === '1',
    frozenAt: null, // set while the clocks are frozen; examClockNow() returns it instead of Date.now()
    get frozen(){ return api.frozenAt != null; },
    get busy(){ return busy; },
    get mode(){ return lenient ? 'lenient' : 'real'; },
    intercept,
    finishNow,
    enable(){ api.on = true; write(KEY, '1'); paintSetting(); },
    disable(){ api.on = false; write(KEY, '0'); finishNow(); paintSetting(); },
    setMode(mode){ lenient = mode === 'lenient'; write(MODE_KEY, lenient ? 'lenient' : 'real'); paintSetting(); },
    settingHtml
  };

  // Called first thing in goToQuestionIndex(). true = handled here (delayed or swallowed); false = run as usual.
  function intercept(index){
    if(pending && pending.running) return false;
    if(busy) return true;
    if(!api.on || exempt(index)) return false;
    start(index);
    return true;
  }
  function exempt(index){
    try {
      if(!activeSession || activeSession.tutorMode || isLocked() || timer.paused || !questions.length) return true;
      const next = Math.min(Math.max(0, Number(index) || 0), questions.length - 1);
      // From the Review Screen, opening any item is a move, even the item it was opened from.
      return next === state.current && !document.querySelector('#workspace .review-panel');
    } catch(_) { return true; }
  }

  function start(index){
    busy = true;
    pending = {index, questions, state, running:false};
    showCover();
    api.frozenAt = Date.now();
    loadTimer = setTimeout(() => {
      loadTimer = 0;
      navigate();
      if(!lenient) unfreeze();
      showTimer = setTimeout(done, rand(290, 360));
    }, serverDelay());
  }
  function done(){ showTimer = 0; unfreeze(); hideCover(); busy = false; }
  // Ends a transition at once: navigates if it has not yet, resumes the clocks and shows the question.
  function finishNow(){
    if(!busy) return;
    if(loadTimer){ clearTimeout(loadTimer); loadTimer = 0; navigate(); }
    if(showTimer){ clearTimeout(showTimer); }
    done();
  }
  // The original navigation, unchanged. Skipped if the block changed meanwhile (ended, review, menu).
  function navigate(){
    const p = pending; pending = null;
    if(!p || p.questions !== questions || p.state !== state || !activeSession || isLocked()) return;
    excludeFrozenFromQuestion();
    p.running = true; pending = p;
    try { goToQuestionIndex(p.index); } finally { pending = null; }
  }
  // Per-question time: the frozen span counts toward no question.
  function excludeFrozenFromQuestion(){
    const enter = state.currentQuestionEnterAt;
    if(enter == null || api.frozenAt == null) return;
    state.currentQuestionEnterAt = enter + Date.now() - Math.max(enter, api.frozenAt);
  }
  // Resume the clocks the way Resume does after Pause: push the deadlines past the frozen span.
  function unfreeze(){
    const at = api.frozenAt; if(at == null) return;
    excludeFrozenFromQuestion();
    api.frozenAt = null;
    if(timer.paused){ if(timer.pauseStartedAt != null && timer.pauseStartedAt > at) timer.pauseStartedAt = at; return; }
    const delta = Math.max(0, Date.now() - at);
    if(timer.blockDeadline != null) timer.blockDeadline += delta;
    if(timer.dayDeadline != null) timer.dayDeadline += delta;
    if(state.blockStartedAt){
      state.blockStartedAt += delta;
      const bp = activeSession && activeSession.blocks && activeSession.blocks[blockPointer];
      if(bp) bp.blockStartedAt = state.blockStartedAt;
    }
  }

  // The cover hides the question area only, in the area's own background color (white, or dark in exam dark mode).
  function showCover(){
    const ws = document.getElementById('workspace'); if(!ws) return;
    if(!cover){
      cover = document.createElement('div');
      cover.id = 'navDelayCover';
      cover.setAttribute('aria-hidden', 'true');
      cover.style.cssText = 'position:fixed;z-index:30;display:none;pointer-events:auto';
      document.body.appendChild(cover);
    }
    const r = ws.getBoundingClientRect();
    const top = Math.max(0, r.top), left = Math.max(0, r.left);
    const s = cover.style;
    s.top = top + 'px'; s.left = left + 'px';
    s.width = Math.max(0, Math.min(r.right, innerWidth) - left) + 'px';
    s.height = Math.max(0, Math.min(r.bottom, innerHeight) - top) + 'px';
    s.background = areaColor(ws);
    s.display = 'block';
  }
  function hideCover(){ if(cover) cover.style.display = 'none'; }
  function areaColor(el){
    for(; el && el.nodeType === 1; el = el.parentElement){
      const c = getComputedStyle(el).backgroundColor;
      if(c && c !== 'transparent' && !/rgba\(.*,\s*0\)$/.test(c)) return c;
    }
    return '#fff';
  }

  // Exam Settings menu row, styled like "Keep notes open".
  function settingHtml(){
    return '<label class="notes-preference nav-delay-preference" title="Hide the question for about 0.6 s when you change questions, like the NBME test driver.">' +
      '<span>Realistic NBME navigation delay</span><input id="navDelayToggle" type="checkbox" role="switch" ' + (api.on ? 'checked' : '') + '></label>' +
      '<div class="review-layout-toggle nav-delay-mode"' + (api.on ? '' : ' style="display:none"') + '><div class="review-layout-title">Clock during the delay</div><div class="segmented-toggle">' +
      '<button type="button" class="' + (lenient ? '' : 'active') + '" data-nav-delay-mode="real" title="The clock stops only while the item loads (about 0.3 s), like test day.">Real NBME</button>' +
      '<button type="button" class="' + (lenient ? 'active' : '') + '" data-nav-delay-mode="lenient" title="The clock stays stopped until the question shows.">Lenient</button></div></div>';
  }
  function paintSetting(){
    const box = document.getElementById('referenceSettingsDropdown'); if(!box) return;
    const input = box.querySelector('#navDelayToggle'); if(input) input.checked = api.on;
    const row = box.querySelector('.nav-delay-mode'); if(row) row.style.display = api.on ? '' : 'none';
    box.querySelectorAll('[data-nav-delay-mode]').forEach(b => b.classList.toggle('active', b.dataset.navDelayMode === api.mode));
  }

  document.addEventListener('change', e => {
    if(e.target.id !== 'navDelayToggle') return;
    if(e.target.checked) api.enable(); else api.disable();
  });
  // Attached once. During a transition: navigation clicks and keys are ignored (no double skips); any other control
  // (End Block, Pause, Labs, Notes, Calculator, Settings…) first finishes the transition, then works as usual.
  window.addEventListener('click', e => {
    const t = e.target, mode = t && t.closest && t.closest('[data-nav-delay-mode]');
    if(mode){ e.preventDefault(); api.setMode(mode.dataset.navDelayMode); return; }
    if(!busy || !t || !t.closest) return;
    if(t === cover || t.closest(NAV)){ e.preventDefault(); e.stopImmediatePropagation(); return; }
    if(t.closest(CONTROL)) finishNow();
  }, true);
  window.addEventListener('keydown', e => {
    if(!busy || (e.key !== 'Enter' && e.key !== ' ')) return;
    const t = e.target; if(t && t.closest && t.closest(NAV)){ e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);

  window.NavDelay = api;
})();

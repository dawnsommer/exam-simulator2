/* Choice % (choicesEPC): shows "(62%)" after each answer choice once the question is revealed (review, Tutor after
   Submit, Show Explanation). Data: question field `choicesEPC` = % of other users who picked each choice, either an
   array in choice order ([3, 90, null, 3, 4]) or an object keyed by letter ({A:3, B:90}). Values may be numbers or
   strings ("62%", "62"); anything else (null, "not shown") shows nothing for that choice. If no choice has a value
   above 0, nothing is shown for the question. Display only: never writes progress. Byte-identical in Local and iPad
   (root copy is the master, then cp to the iPad folder). */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else { root.ThunderChoiceEPC = api; api.install(); }
})(this, function () {
  const LET = 'ABCDEFGHIJKLMNO';
  function num(v) {
    if (typeof v === 'number') return isFinite(v) && v >= 0 ? v : null;
    if (typeof v === 'string') { const m = v.trim().match(/^(\d+(?:\.\d+)?)\s*%?$/); return m ? Number(m[1]) : null; }
    return null;
  }
  /* -> array of numbers/null in choice order, or null when the question has nothing to show */
  function values(q, n) {
    const src = q && q.choicesEPC; if (!src || typeof src !== 'object') return null;
    const count = Math.max(0, Number(n) || 0) || (Array.isArray(src) ? src.length : Object.keys(src).length);
    const out = [];
    for (let i = 0; i < count; i++) {
      let v;
      if (Array.isArray(src)) v = src[i];
      else v = src[LET[i]] !== undefined ? src[LET[i]] : (src[LET[i].toLowerCase()] !== undefined ? src[LET[i].toLowerCase()] : src[String(i)]);
      out.push(num(v));
    }
    return out.some(v => v != null && v > 0) ? out : null;
  }
  function label(v) { return '(' + (Math.round(v * 10) / 10) + '%)'; }

  function decorate() {
    const ws = document.getElementById('workspace'); if (!ws) return;
    const answers = [...ws.querySelectorAll('.answers .answer[data-choice]')];
    let vals = null;
    try {
      const q = questions[state.current];
      // only after the answer is shown: the app adds correctChoice exactly when the item is revealed or locked
      if (q && answers.length && ws.querySelector('.answers .answer.correctChoice')) vals = values(q, Array.isArray(q.choices) ? q.choices.length : answers.length);
    } catch (e) { vals = null; }
    const want = a => { const v = vals ? vals[Number(a.dataset.choice)] : null; return v == null ? '' : '\u00a0' + label(v); };
    // idempotent: leave the DOM alone when it already matches (the observer below sees our own writes)
    const stray = [...ws.querySelectorAll('.epc-pct')].filter(s => !answers.some(a => a.contains(s)));
    if (!stray.length && answers.every(a => { const s = a.querySelectorAll('.epc-pct'); return want(a) ? (s.length === 1 && s[0].textContent === want(a)) : !s.length; })) return;
    stray.forEach(s => s.remove());
    answers.forEach(a => {
      a.querySelectorAll('.epc-pct').forEach(s => s.remove());
      const t = want(a); if (!t) return;
      const host = a.querySelector('.choice-text') || [...a.querySelectorAll('.choice-cell')].pop(); if (!host) return;
      const s = document.createElement('span'); s.className = 'epc-pct'; s.textContent = t;
      s.setAttribute('aria-label', vals[Number(a.dataset.choice)] + ' percent of users chose this');
      host.appendChild(s);
    });
  }
  let queued = false;
  function soon() { if (queued) return; queued = true; Promise.resolve().then(() => { queued = false; try { decorate(); } catch (e) {} }); }
  function install() {
    if (typeof document === 'undefined') return;
    if (!document.getElementById('epc-style')) {
      const st = document.createElement('style'); st.id = 'epc-style';
      st.textContent = '.answers .answer .epc-pct{font-weight:400!important;opacity:.72;white-space:nowrap;text-decoration:none!important;display:inline!important;float:none!important}';
      (document.head || document.documentElement).appendChild(st);
    }
    // later layers keep re-wrapping renderQuestion, so watch the question area instead of wrapping it
    const start = () => { const ws = document.getElementById('workspace'); if (!ws) return false; new MutationObserver(soon).observe(ws, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] }); soon(); return true; };
    if (!start()) document.addEventListener('DOMContentLoaded', start, { once: true });
  }
  return { values, label, decorate, install };
});

/* Shared LOCAL/iPad "item code" pill in the exam header, right of the Item / Block box.
   code = `${block}.${String(item).padStart(2, '0')}` (block 3 item 12 -> "3.12", block 4 item 1 -> "4.01"): the same 1-based
   block and item the exam-results JSON writes for that question (buildBlockResult: block:blockPointer+1, item:i+1).
   The internal question id is never shown or copied. One click on the icon copies the code (clipboard API, then a hidden
   textarea + execCommand, then the text is selected so Cmd/Ctrl+C works). Exam Settings menu: "Show item code" (default on). */
(function(){
  'use strict';
  const KEY = 'ThunderUSMLE.itemCode';
  const read = k => { try { return localStorage.getItem(k); } catch(_) { return null; } };
  const write = (k, v) => { try { localStorage.setItem(k, v); } catch(_) {} };
  const ICON_COPY = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>';
  const ICON_OK = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  function format(block, item){ return block + '.' + String(item).padStart(2, '0'); }

  // The 1-based block and item of the question on screen: the same values buildBlockResult() exports. Falls back to the
  // header's own "N of M" text if the engine globals are not there.
  function current(){
    let block = NaN, item = NaN;
    try { block = Number(blockPointer) + 1; item = Number(state.current) + 1; } catch(_) {}
    if(!(block >= 1) || !(item >= 1)){
      const num = id => parseInt(((document.getElementById(id) || {}).textContent || '').trim(), 10);
      block = num('blockText'); item = num('itemText');
    }
    return block >= 1 && item >= 1 ? {block, item} : null;
  }
  function code(){ const c = current(); return c ? format(c.block, c.item) : ''; }

  const api = {
    on: read(KEY) !== '0',
    format, code, current, settingHtml,
    enable(){ api.on = true; write(KEY, '1'); paint(); },
    disable(){ api.on = false; write(KEY, '0'); paint(); },
    copy: copyCode
  };
  window.ItemCode = api;

  const style = document.createElement('style');
  style.textContent = `
    .item-code{position:relative;--ic-bd:#fff;--ic-fg:#fff;--ic-hover:#325b77;box-sizing:border-box;flex:0 0 auto;align-self:center;display:inline-flex;align-items:center;height:32px;margin:0 8px 0 0;padding:0 3px 0 10px;border:1px solid var(--ic-bd);box-shadow:0 1px 1px #000;background:transparent;color:var(--ic-fg);font:700 16px/1 "Open Sans",Verdana,sans-serif;font-variant-numeric:tabular-nums;white-space:nowrap;-webkit-user-select:text;user-select:text}
    .item-code[hidden]{display:none!important}
    .item-code .item-code-text{-webkit-user-select:text;user-select:text;padding-right:4px}
    .item-code .item-code-copy{all:unset;box-sizing:border-box;width:24px;height:24px;display:flex;align-items:center;justify-content:center;color:inherit;cursor:pointer}
    .item-code .item-code-copy:hover{background:var(--ic-hover)}
    .item-code .item-code-copy:focus-visible{outline:2px dotted currentColor;outline-offset:-2px}
    .item-code .item-code-live{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0}
    #examScreen.exam-dark .item-code{--ic-bd:#7fc5df;--ic-fg:#f5fbff}
    :root[data-tun] #examScreen:is(.reverse,.exam-dark) .item-code{--ic-bd:#94eaff;--ic-fg:#94eaff;--ic-hover:rgba(148,234,255,.22)}
    @media (pointer:coarse){.item-code{height:38px}.item-code .item-code-copy{width:32px;height:32px}}
    @media (max-width:767px){.item-code:not(.tux-code){display:none}}
    .item-code.tux-code{--ic-hover:var(--tu-line2);position:relative;height:36px;margin:0;padding:0 3px 0 10px;border:0;border-radius:12px;box-shadow:none;background:var(--tu-s1);color:var(--tu-on);font:700 14px ui-monospace,SFMono-Regular,Menlo,monospace}
    .item-code.tux-code[hidden]{display:none!important}
    .item-code.tux-code .item-code-copy{width:28px!important;height:28px!important;border-radius:8px!important;background:none;color:var(--tu-on3)}
    .item-code.tux-code .item-code-copy:hover{background:var(--tu-line2)!important;color:var(--tu-on)}
    @media (max-width:759px),(max-height:520px){.item-code.tux-code{height:40px;font-size:12px;padding:0 0 0 7px}.item-code.tux-code .item-code-text{padding-right:2px}.item-code.tux-code .item-code-copy{width:24px!important}}
  `;
  document.head.appendChild(style);

  const screen = document.getElementById('examScreen');
  const box = document.getElementById('itemBox');
  if(!screen || !box) return;
  let okTimer = 0, flashing = '';
  // One pill in the NBME header; the Modern header (rebuilt on every change) asks for its own through pillHtml().
  function pillHtml(modern){
    const c = code(), msg = flashing ? 'Copied ' + flashing : '';
    return '<div class="item-code' + (modern ? ' tux-code' : '') + '" role="group" aria-label="Item code"' + (api.on ? '' : ' hidden') + '><span class="item-code-text">' + c + '</span><button type="button" class="item-code-copy" title="Copy item code" aria-label="' + (c ? 'Copy item code ' + c : 'Copy item code') + '">' + (flashing ? ICON_OK : ICON_COPY) + '</button><span class="item-code-live" role="status" aria-live="polite">' + msg + '</span></div>';
  }
  api.pillHtml = pillHtml;
  box.insertAdjacentHTML('afterend', pillHtml(false));
  const pill = box.nextElementSibling;
  pill.id = 'itemCodePill'; pill.querySelector('.item-code-text').id = 'itemCodeText'; pill.querySelector('.item-code-copy').id = 'itemCodeCopy'; pill.querySelector('.item-code-live').id = 'itemCodeLive';

  function paint(){
    const c = code();
    document.querySelectorAll('.item-code').forEach(p => {
      p.hidden = !api.on;
      const t = p.querySelector('.item-code-text'); if(t && t.textContent !== c) t.textContent = c;
      const b = p.querySelector('.item-code-copy'); if(b) b.setAttribute('aria-label', c ? 'Copy item code ' + c : 'Copy item code');
    });
  }
  function selectText(){
    const t = [...document.querySelectorAll('.item-code-text')].find(x => x.offsetParent);
    try { const r = document.createRange(); r.selectNodeContents(t); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } catch(_) {}
  }
  function legacyCopy(text){
    const ta = document.createElement('textarea'), prev = document.activeElement;
    ta.value = text; ta.setAttribute('readonly', ''); ta.setAttribute('aria-hidden', 'true'); ta.tabIndex = -1;
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
    document.body.appendChild(ta);
    let ok = false;
    try { ta.focus(); ta.select(); ta.setSelectionRange(0, text.length); ok = document.execCommand('copy') === true; } catch(_) { ok = false; }
    ta.remove();
    try { if(prev && prev.focus) prev.focus(); } catch(_) {}
    return ok;
  }
  const setLive = msg => document.querySelectorAll('.item-code-live').forEach(l => { l.textContent = ''; if(msg) requestAnimationFrame(() => { l.textContent = msg; }); });
  async function copyCode(){
    const text = code(); if(!text) return false;
    let ok = false;
    try { if(navigator.clipboard && navigator.clipboard.writeText){ await navigator.clipboard.writeText(text); ok = true; } } catch(_) { ok = false; }
    if(!ok) ok = legacyCopy(text);
    if(ok){
      flashing = text;
      document.querySelectorAll('.item-code-copy').forEach(b => { b.innerHTML = ICON_OK; });
      setLive('Copied ' + text);
      clearTimeout(okTimer);
      okTimer = setTimeout(() => { flashing = ''; document.querySelectorAll('.item-code-copy').forEach(b => { b.innerHTML = ICON_COPY; }); setLive(''); }, 1200);
    } else {
      selectText();
      setLive('Press Cmd or Ctrl and C to copy ' + text);
    }
    return ok;
  }

  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('.item-code-copy'); if(!b) return;
    e.preventDefault(); e.stopPropagation(); copyCode();
  }, true);
  // Every navigation (Next/Previous, Review jumps, block changes) rewrites the header's Item / Block text.
  new MutationObserver(paint).observe(box, {childList: true, subtree: true, characterData: true});
  document.addEventListener('change', e => {
    if(e.target.id !== 'itemCodeToggle') return;
    if(e.target.checked) api.enable(); else api.disable();
  });
  paint();

  // Exam Settings menu row, styled like "Keep notes open".
  function settingHtml(){
    return '<label class="notes-preference item-code-preference" title="Show item code (copy for ThunderShadow)"><span>Show item code</span><input id="itemCodeToggle" type="checkbox" role="switch" ' + (api.on ? 'checked' : '') + '></label>';
  }
})();

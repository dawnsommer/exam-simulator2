/* Shared LOCAL/iPad non-modal, block-saved Notes. */
(function(){
  'use strict';
  const prefKey = location.pathname.includes('Step_Exam_') ? 'StepExamLocalKeepNotesOpen' : 'exam-simulator2:keepNotesOpen';
  let keepOpen = false;
  try { keepOpen = localStorage.getItem(prefKey) === '1'; } catch(_) {}
  let context = '';
  const style = document.createElement('style');
  style.textContent = `
    #examNotesPanel{position:fixed;right:12px;bottom:78px;width:clamp(300px,24vw,450px);max-width:calc(100vw - 30px);box-sizing:border-box;padding:10px 12px;background:#d6dceb;color:#111;border:2px solid #075078;border-radius:4px;box-shadow:0 2px 6px #0007;z-index:90;font-family:Arial,Helvetica,sans-serif}
    #examNotesPanel[hidden]{display:none!important}#examNotesPanel .notes-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;font-size:13px;font-weight:700}
    #examNotesPanel button{border:1px solid #446c86;border-radius:4px;background:#f4f4f4;color:#111;box-shadow:none;padding:6px 11px;font-size:13px;font-weight:700;cursor:pointer}
    #examNotesPanel .notes-close{padding:0;width:27px;height:27px;font-size:21px;color:#075078;background:#fff}
    #examNotesPanel textarea{display:block;width:100%;height:130px;max-height:40vh;box-sizing:border-box;resize:vertical;border:2px solid #637e90;border-radius:0;background:#fff;color:#111;font:16px/1.4 Arial,Helvetica,sans-serif;padding:6px;outline-offset:2px}
    #examNotesPanel .notes-actions{display:flex;justify-content:space-between;gap:8px;margin-top:8px}
    #referenceSettingsDropdown .notes-preference{display:flex;align-items:center;justify-content:space-between;gap:15px;padding:10px 12px;font:13px Arial,Helvetica,sans-serif;color:inherit;cursor:pointer}
    .notes-preference input{appearance:none;-webkit-appearance:none;position:relative;flex:0 0 34px;width:34px;height:20px;border:0;border-radius:20px;background:#95a2ad;transition:background .15s;cursor:pointer}
    .notes-preference input:checked{background:#147eae}.notes-preference input:after{content:'';position:absolute;left:3px;top:3px;width:14px;height:14px;border-radius:50%;background:#fff;box-shadow:0 1px 3px #0004;transition:transform .15s}.notes-preference input:checked:after{transform:translateX(14px)}
    .exam-dark-active #examNotesPanel{background:#243b50;color:#edf5ff;border-color:#7ebedc}.exam-dark-active #examNotesPanel textarea{background:#122333;color:#edf5ff;border-color:#708ca3}.exam-dark-active #examNotesPanel button{background:#dce8f2;color:#122333}
    @media(max-width:600px){#examNotesPanel{right:8px;bottom:76px;width:310px}#examNotesPanel textarea{height:110px}}
  `;
  document.head.appendChild(style);
  const panel = document.createElement('aside');
  panel.id='examNotesPanel'; panel.hidden=true;
  panel.setAttribute('aria-label','Notes');
  panel.innerHTML='<div class="notes-head"><span>Notes</span><button type="button" class="notes-close" aria-label="Close notes">×</button></div><textarea id="examNoteText" aria-label="Block notes" placeholder="Type notes here…"></textarea><div class="notes-actions"><button type="button" data-notes="save">Save and Close</button><button type="button" data-notes="delete">Delete Note</button></div>';
  document.getElementById('examScreen').appendChild(panel);
  const text = panel.querySelector('textarea');
  function position(){
    const bar=document.querySelector('#examScreen .bottombar');
    if(bar) panel.style.bottom=Math.max(8,window.innerHeight-bar.getBoundingClientRect().top+8)+'px';
  }
  function save(){
    if(state.notes===text.value) return;
    state.notes=text.value;
    const prior=window.__stepReviewMutationWrite; window.__stepReviewMutationWrite=true;
    try { persistBlockProgress(); } finally { window.__stepReviewMutationWrite=prior; }
  }
  function close(){ save(); panel.hidden=true; document.getElementById('notesBtn')?.setAttribute('aria-expanded','false'); }
  function sync(){
    const next=[activeSession?.sessionId || activeSession?.startedAt,blockPointer,state.current].join(':');
    if(next!==context){
      if(!keepOpen) panel.hidden=true;
      context=next;
    }
    // Same-item answer renders must preserve the caret and keyboard focus.
    if(text.value!==(state.notes||'')) text.value=state.notes||'';
    position();
    document.getElementById('notesBtn')?.setAttribute('aria-expanded',String(!panel.hidden));
  }
  text.addEventListener('input',save);
  panel.querySelector('.notes-close').addEventListener('click',close);
  panel.querySelector('[data-notes="save"]').addEventListener('click',close);
  panel.querySelector('[data-notes="delete"]').addEventListener('click',()=>{text.value='';save();text.focus();});
  panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();close();}});
  document.addEventListener('change',e=>{
    if(e.target.id!=='keepNotesOpen') return;
    keepOpen=e.target.checked;
    try { localStorage.setItem(prefKey,keepOpen?'1':'0'); } catch(_) {}
  });
  window.addEventListener('resize',position);
  const render=renderQuestion;
  renderQuestion=function(){const out=render.apply(this,arguments);sync();return out;};
  const menu=returnToMenu;
  returnToMenu=function(){close();return menu.apply(this,arguments);};
  // Each block has its own note; flush the old panel before switching state.
  const block=startBlock;
  startBlock=function(){if(!panel.hidden)save();const out=block.apply(this,arguments);sync();return out;};
  window.StepExamNotes={
    toggle(){if(!panel.hidden){close();return;}sync();panel.hidden=false;position();document.getElementById('notesBtn')?.setAttribute('aria-expanded','true');text.focus();},
    flush:save,
    settingHtml(){return '<label class="notes-preference" title="Turn off to close Notes when you change questions."><span>Keep notes open</span><input id="keepNotesOpen" type="checkbox" role="switch" '+(keepOpen?'checked':'')+'></label>';}
  };
})();

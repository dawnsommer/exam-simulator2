/* Folder ZIP planner and shared bulk-import Settings UI. No progress files are imported. */
(function(root){
  'use strict';
  function safePath(value){
    const p=String(value).replace(/\\/g,'/');
    if(p.startsWith('/') || /^[a-z]:/i.test(p) || p.includes('\0') || p.split('/').some(x=>x==='..')) throw new Error('Unsafe ZIP path: '+value);
    return p.replace(/^\.\//,'').replace(/\/{2,}/g,'/');
  }
  function metadata(p){return p.split('/').some(x=>x==='__MACOSX'||x==='.DS_Store'||x.startsWith('._'));}
  function formId(name){const id=name.replace(/[^a-z0-9_-]+/gi,'_').replace(/^_+|_+$/g,'');if(!id)throw new Error('Empty form folder name.');if(id.toUpperCase()==='QBANK_MODE')throw new Error('QBANK_MODE is reserved for Qbank history.');return id;}
  async function prepare(zip,validate){
    const entries=Object.values(zip.files).filter(e=>!e.dir).map(e=>{
      safePath(e.unsafeOriginalName || e.name);
      return {path:e.name,readText:()=>e.async('text'),readBlob:()=>e.async('blob')};
    });
    return prepareEntries(entries,validate);
  }
  async function prepareEntries(input,validate){
    const seen=new Set();
    const entries=input.map(e=>{
      const path=safePath(e.path);
      if(!path || seen.has(path.toLowerCase()))throw new Error('Duplicate or empty entry path: '+path);
      seen.add(path.toLowerCase());
      return {entry:{async:type=>type==='text'?e.readText():e.readBlob()},path};
    }).filter(x=>!metadata(x.path));
    const forms=[], groups=new Map(), ids=new Set();
    for(const {entry,path} of entries){
      if(!/\.json$/i.test(path) || /(^|\/)(assets|progress|backups)\//i.test(path)) continue;
      if(/(^|\/)(catalog|manifest|package(?:-lock)?|answer_key|audit_report|progress_metadata)\.json$/i.test(path))continue;
      let bank;
      try { bank=JSON.parse(await entry.async('text')); } catch(_) {throw new Error('Invalid JSON: '+path);}
      // Unrelated JSON metadata may coexist with forms; recognizable banks must validate.
      if(!Array.isArray(bank) && !Array.isArray(bank?.blocks) && !Array.isArray(bank?.questions))continue;
      const normalized=validate(bank);
      const folder=path.includes('/')?path.slice(0,path.lastIndexOf('/')):'';
      if(groups.has(folder))throw new Error('Keep one question-bank JSON per form folder: '+(folder||'ZIP root'));
      groups.set(folder,true);
      const name=folder.split('/').pop() || path.replace(/\.json$/i,'');
      const id=formId(name);
      if(ids.has(id.toLowerCase()))throw new Error('Duplicate form folder ID: '+id);
      ids.add(id.toLowerCase());
      if(Array.isArray(bank))bank={title:name,questions:bank};
      const assets=[], refs=new Map();
      const assetPrefix=(folder?folder+'/':'')+'assets/';
      for(const item of entries.filter(x=>x.path.startsWith(assetPrefix))){
        const rel=item.path.slice(assetPrefix.length), dest='assets/'+id+'/'+rel;
        assets.push({path:dest,blob:await item.entry.async('blob')});
        for(const key of [item.path,'./'+item.path,'assets/'+rel,'./assets/'+rel,name+'/assets/'+rel,'DATA/assets/'+id+'/'+rel,'DATA/assets/'+rel])refs.set(key,'DATA/'+dest);
      }
      function reference(v){return refs.get(v) || refs.get(v.replace(/^\.\//,'')) || v;}
      function rewrite(v){
        if(Array.isArray(v))return v.map(rewrite);
        if(v && typeof v==='object'){for(const k of Object.keys(v))v[k]=rewrite(v[k]);return v;}
        if(typeof v!=='string' || /^(data:|blob:|https?:)/i.test(v))return v;
        if(refs.has(v))return reference(v);
        return v.replace(/((?:src|href|poster)\s*=\s*["'])([^"']+)(["'])/gi,(_,a,b,c)=>a+reference(b)+c);
      }
      bank=rewrite(bank);bank.title=bank.title||name;bank.librarySlotId=id;
      forms.push({id,name:bank.title,bank,text:JSON.stringify(bank,null,2),assets,source:path,total:normalized.blocks.reduce((n,b)=>n+b.questions.length,0)});
    }
    if(!forms.length)throw new Error('No forms found. ZIP folders such as UWSA2/UWSA2.json and UWSA2/assets/.');
    return {forms};
  }
  const api={prepare,prepareEntries,safePath};
  if(typeof module==='object' && module.exports){module.exports=api;return;}
  let plan=null,busy=false,message='';
  const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function installed(){return new Set((root.StepBulkImportStore?.installedIds()||[]).map(x=>x.toLowerCase()));}
  function preview(){
    const ids=installed();
    return plan?'<table class="bulk-preview"><thead><tr><th>Form</th><th>Questions</th><th>Assets</th><th>Status</th></tr></thead><tbody>'+plan.forms.map(f=>'<tr><td>'+esc(f.id)+'<small>'+esc(f.name)+'</small></td><td>'+f.total+'</td><td>'+f.assets.length+'</td><td>'+(ids.has(f.id.toLowerCase())?'Installed · skipped':'Ready')+'</td></tr>').join('')+'</tbody></table>':'';
  }
  api.panelHtml=()=>'<section class="settings-panel-v195"><h3>Bulk import</h3><p>Add several forms from one ZIP. Put each form’s JSON and assets folder inside its own named folder. Installed form IDs are skipped.</p><pre class="bulk-example">Forms.zip\n  UWSA2/UWSA2.json\n  UWSA2/assets/…\n  NBME14/NBME14.json\n  NBME14/assets/…</pre><label class="bulk-file">Choose ZIP<input id="bulkFormZip" type="file" accept=".zip,application/zip" '+(busy?'disabled':'')+'></label><div id="bulkPreview">'+preview()+'</div><p id="bulkImportStatus" role="status">'+esc(message)+'</p><button id="bulkImportCommit" type="button" class="primary" '+(!plan||busy||!plan.forms.some(f=>!installed().has(f.id.toLowerCase()))?'disabled':'')+'>'+(busy?'Importing…':'Import forms')+'</button></section>';
  function refresh(){const el=document.querySelector('#settingsPanel .settings-content-v195');if(el?.querySelector('#bulkPreview'))el.innerHTML=api.panelHtml();document.dispatchEvent(new CustomEvent('stepbulk:change'));}
  // Read-only state for other views (the Add forms dialog draws its own markup around the same #bulk* controls).
  api.state=()=>{const ids=installed();const forms=plan?plan.forms.map(f=>({id:f.id,name:f.name,total:f.total,assets:f.assets.length,installed:ids.has(f.id.toLowerCase())})):[];return {busy,message,forms,ready:forms.filter(f=>!f.installed).length};};
  document.addEventListener('change',async e=>{
    if(e.target.id!=='bulkFormZip' || !e.target.files[0] || busy)return;
    const file=e.target.files[0];busy=true;plan=null;message='Reading ZIP…';refresh();
    try{plan=await prepare(await JSZip.loadAsync(file),normalizeBank);message=plan.forms.length+' form(s) found. Review the list, then import.';}catch(err){message=err.message;}
    finally{busy=false;refresh();}
  });
  document.addEventListener('click',async e=>{
    if(!e.target.closest('#bulkImportCommit') || !plan || busy)return;
    busy=true;message='Importing forms…';refresh();
    try{const result=await root.StepBulkImportStore.importNewForms(plan);message='Imported '+result.count+' form(s). '+result.skipped+' installed form(s) skipped.';plan=null;}catch(err){message=err.message;}
    finally{busy=false;refresh();}
  });
  const style=document.createElement('style');style.textContent='.bulk-preview{width:100%;border-collapse:collapse;margin:18px 0;font-size:13px}.bulk-preview th,.bulk-preview td{text-align:left;padding:10px;border-bottom:1px solid #8b9aaa55}.bulk-preview small{display:block;opacity:.7;margin-top:3px}.bulk-example{background:#8b9aaa15;border:1px solid #8b9aaa44;border-radius:12px;padding:14px;font-size:13px;line-height:1.5;white-space:pre-wrap}.bulk-file{display:flex;align-items:center;gap:12px;font-weight:700;font-size:13px;margin:18px 0}.bulk-file input{max-width:100%}#bulkImportStatus{margin:12px 0}';document.head.appendChild(style);
  root.StepBulkImport=api;
})(typeof window==='object'?window:globalThis);

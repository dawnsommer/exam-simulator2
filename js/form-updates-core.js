/* Pure update contracts, also used by the publisher and regression tests. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.StepFormUpdateCore=api;})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const clone=v=>JSON.parse(JSON.stringify(v));
  const stable=v=>JSON.stringify((function sort(x){if(Array.isArray(x))return x.map(sort);if(x&&typeof x==='object')return Object.fromEntries(Object.keys(x).sort().map(k=>[k,sort(x[k])]));return x;})(v));
  function safePath(value){
    const p=String(value||'');
    if(!p||p.startsWith('/')||p.includes('\\')||p.includes('\0')||/[?#:%]/.test(p)||p.split('/').some(x=>!x||x==='.'||x==='..'))throw new Error('Unsafe update path: '+p);
    return p;
  }
  function parseInstructions(text,folders){
    const out=new Map(),seen=new Set();
    String(text).split(/\r?\n/).forEach((raw,i)=>{
      const line=raw.trim();if(!line||line.startsWith('#'))return;
      const parts=line.split('|').map(x=>x.trim()),[id,tab,action]=parts;
      if(parts.length!==3||!id||!tab||!['update','skip'].includes(action?.toLowerCase()))throw new Error('instructions.txt line '+(i+1)+': use Folder | Tab | update or skip.');
      if(!/^[A-Za-z0-9_-]+$/.test(id)||id.toUpperCase()==='QBANK_MODE'||id.toLowerCase()==='explanations')throw new Error('instructions.txt line '+(i+1)+': invalid form folder '+id+'.');
      if(tab.length>80||/[\x00-\x1f]/.test(tab)||['Overview','All','Completed','All Loaded'].some(x=>x.toLowerCase()===tab.toLowerCase()))throw new Error('instructions.txt line '+(i+1)+': choose a form tab, not '+tab+'.');
      if(seen.has(id.toLowerCase()))throw new Error('instructions.txt line '+(i+1)+': duplicate folder '+id+'.');
      seen.add(id.toLowerCase());out.set(id,{id,tab,onExisting:action.toLowerCase()});
    });
    if(folders){for(const id of folders)if(!out.has(id))throw new Error('Missing instructions for folder '+id+'.');for(const id of out.keys())if(!folders.includes(id))throw new Error('instructions.txt names missing folder '+id+'.');}
    return out;
  }
  // Rapid Review explanation files: update/explanations/<ID>.json, published as manifest.explanations. Folder name `explanations` is reserved.
  const EXPL_MAX=2*1024*1024;
  function validateExplanations(list){
    if(!Array.isArray(list))throw new Error('Invalid explanations list.');
    const ids=new Set();
    for(const x of list){
      if(!x||!/^[A-Za-z0-9_-]+$/.test(x.formId||'')||x.path!=='explanations/'+x.formId+'.json'||ids.has(x.formId.toLowerCase())||!Number.isSafeInteger(x.size)||x.size<0||x.size>EXPL_MAX||!/^[a-f0-9]{64}$/.test(x.sha256||''))throw new Error('Invalid explanation file '+(x&&x.path)+'.');
      ids.add(x.formId.toLowerCase());
    }
    return list;
  }
  // bytes: Uint8Array/Buffer of explanations/<id>.json; qids: optional Set of the form's qids (when the form is in update/)
  function validateExplanationFile(id,bytes,qids){
    if(!/^[A-Za-z0-9_-]+$/.test(id))throw new Error('Invalid explanation file name '+id+'.json.');
    if(bytes.length>EXPL_MAX)throw new Error(id+'.json is over 2 MB.');
    let d;try{d=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch(e){throw new Error(id+'.json is not valid JSON.');}
    if(!d||d.type!=='StepRapidReview')throw new Error(id+'.json: type must be "StepRapidReview".');
    if(d.formId!==id)throw new Error(id+'.json: formId "'+d.formId+'" does not match the file name.');
    if(!d.items||typeof d.items!=='object'||Array.isArray(d.items))throw new Error(id+'.json: items must be an object keyed by qid.');
    for(const [k,v] of Object.entries(d.items)){
      if(!/^[A-Za-z0-9_.:-]+$/.test(k)||!v||typeof v!=='object'||Array.isArray(v))throw new Error(id+'.json: bad item "'+k+'".');
      if(qids&&!qids.has(k))throw new Error(id+'.json: qid '+k+' is not in update/'+id+'/'+id+'.json.');
    }
    return d;
  }
  function validateManifest(m){
    if(m?.schemaVersion!==1||!Array.isArray(m.forms)||!/^[a-f0-9]{40}$/.test(m.sourceCommit||'')||!/^dawnsommer\/exam-simulator2$/.test(m.repository||''))throw new Error('Invalid form-update manifest.');
    const ids=new Set();
    for(const f of m.forms){
      parseInstructions(f.id+' | '+f.tab+' | '+f.onExisting,[f.id]);
      if(ids.has(f.id.toLowerCase())||!/^[a-f0-9]{64}$/.test(f.revision||'')||!Array.isArray(f.files)||!f.files.length)throw new Error('Invalid or duplicate update '+f.id+'.');ids.add(f.id.toLowerCase());
      const paths=new Set();let jsons=0;
      for(const x of f.files){safePath(x.path);if(!x.path.startsWith(f.id+'/')||paths.has(x.path.toLowerCase())||!Number.isSafeInteger(x.size)||x.size<0||!/^[a-f0-9]{64}$/.test(x.sha256||''))throw new Error('Invalid update file '+x.path+'.');paths.add(x.path.toLowerCase());const rel=x.path.slice(f.id.length+1);if(rel===f.id+'.json')jsons++;else if(!rel.startsWith('assets/'))throw new Error('Unexpected update file '+x.path+'.');}
      if(jsons!==1)throw new Error('Missing '+f.id+'/'+f.id+'.json.');
    }
    if(m.explanations!==undefined)validateExplanations(m.explanations);
    return m;
  }
  // Preserve installed block/question order so positional legacy/retest/shuffle views remain valid.
  function compatibleBank(oldRaw,nextRaw,normalize,hasProgress){
    const next=clone(nextRaw),a=normalize(oldRaw),b=normalize(nextRaw);
    if(Number(a.qidSchemaVersion)===1){
      if(Number(b.qidSchemaVersion)!==1||a.formUid!==b.formUid)throw new Error('A permanent form identity cannot be removed or changed.');
      if(!hasProgress){const known=new Map(a.blocks.flatMap(x=>x.questions).map(q=>[q.qid,q]));for(const q of b.blocks.flatMap(x=>x.questions)){const old=known.get(q.qid);if(old&&(stable(old.choices)!==stable(q.choices)||old.correct!==q.correct))throw new Error('Choices or correct answer changed for permanent question '+q.qid+'.');}return next;}
    }
    if(!hasProgress)return next;
    if(Number(a.qidSchemaVersion)!==1||Number(b.qidSchemaVersion)!==1){
      const blocks=x=>Array.isArray(x.blocks)?x.blocks:[{questions:Array.isArray(x)?x:x.questions}];
      if(stable(blocks(oldRaw))!==stable(blocks(nextRaw)))throw new Error('Saved progress requires identical question blocks for this legacy form.');
      return next;
    }
    if(!a.formUid||a.formUid!==b.formUid)throw new Error('The revised form has a different permanent form identity.');
    const qa=a.blocks.flatMap(x=>x.questions),qb=b.blocks.flatMap(x=>x.questions),map=new Map();
    for(const q of qb){if(!q.qid||map.has(q.qid))throw new Error('Missing or duplicate permanent question ID.');map.set(q.qid,q);}
    if(qa.length!==qb.length||new Set(qa.map(q=>q.qid)).size!==qa.length)throw new Error('The revised question set differs from saved progress.');
    for(const q of qa){const n=map.get(q.qid);if(!n||stable(q.choices)!==stable(n.choices)||q.correct!==n.correct)throw new Error('Question '+(q.qid||'?')+' changed its identity, choices, or correct answer.');}
    const rawQuestions=(next.blocks||[{questions:next.questions}]).flatMap(x=>Array.isArray(x)?x:(x.questions||x.items||[])),rawMap=new Map(rawQuestions.map(q=>[q.qid,q]));
    next.blocks=(oldRaw.blocks||a.blocks).map(block=>({...(!Array.isArray(block)?clone(block):{}),questions:(Array.isArray(block)?block:(block.questions||block.items||[])).map(q=>clone(rawMap.get(q.qid)||map.get(q.qid)))}));
    delete next.questions;return next;
  }
  function rewriteHash(value,from,to){
    const out=clone(value);function visit(v){if(!v||typeof v!=='object')return;for(const k of Object.keys(v)){if(k==='bankHash'&&v[k]===from)v[k]=to;else visit(v[k]);}}visit(out);return out;
  }
  return {parseInstructions,validateManifest,validateExplanations,validateExplanationFile,safePath,compatibleBank,rewriteHash,stable};
});

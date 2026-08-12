(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.StepQidMigration=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const QID_SCHEMA_VERSION=1;
  const QID_MAPPING_VERSION=1;
  const QID_RX=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/;
  const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
  const safePart=value=>String(value==null?'':value).trim().toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,96);
  const validQid=value=>typeof value==='string'&&QID_RX.test(value);
  function resolveFormUid(bank,fallback='form'){
    const existing=String(bank?.formUid||'').trim();
    if(validQid(existing))return existing;
    const seeded=safePart(bank?.librarySlotId||bank?.id||fallback);
    if(!seeded)throw new Error('A stable form identity is required before QIDs can be assigned.');
    return seeded;
  }
  function questionsOf(bank){
    const out=[];(bank?.blocks||[]).forEach((block,blockIndex)=>(block?.questions||[]).forEach((question,questionIndex)=>out.push({block,question,blockIndex,questionIndex})));
    return out;
  }
  function qidFromExistingId(formUid,id){
    const part=safePart(id);if(!part)return'';
    return part===formUid||part.startsWith(formUid+'-')?part:`${formUid}-${part}`;
  }
  function generatedQid(formUid,blockIndex,questionIndex){return `${formUid}-b${String(blockIndex+1).padStart(3,'0')}-q${String(questionIndex+1).padStart(3,'0')}`;}
  function planForm(bank,fallbackFormUid='form'){
    if(!bank||typeof bank!=='object')throw new Error('Form JSON must be an object.');
    const formUid=resolveFormUid(bank,fallbackFormUid),rows=questionsOf(bank),seen=new Map(),assignments=[],duplicateQids=[];
    for(const row of rows){
      const raw=String(row.question?.qid||'').trim();
      if(!raw||!validQid(raw))continue;
      if(seen.has(raw))duplicateQids.push({qid:raw,first:seen.get(raw),duplicate:{blockIndex:row.blockIndex,questionIndex:row.questionIndex}});
      else seen.set(raw,{blockIndex:row.blockIndex,questionIndex:row.questionIndex});
    }
    if(duplicateQids.length){const e=new Error(`Duplicate QID ${duplicateQids[0].qid} was found. Resolve duplicates before migration.`);e.code='DUPLICATE_QID';e.duplicates=duplicateQids;throw e;}
    for(const row of rows){
      let qid=String(row.question?.qid||'').trim(),source='existing-qid';
      if(!validQid(qid)){
        qid=qidFromExistingId(formUid,row.question?.id);source=qid?'existing-id':'generated';
        if(!qid)qid=generatedQid(formUid,row.blockIndex,row.questionIndex);
        if(seen.has(qid)){const e=new Error(`Generated QID ${qid} collides with another question. Migration was not committed.`);e.code='QID_COLLISION';throw e;}
        seen.set(qid,{blockIndex:row.blockIndex,questionIndex:row.questionIndex});
      }
      assignments.push({blockIndex:row.blockIndex,questionIndex:row.questionIndex,qid,source});
    }
    return {formUid,questionCount:rows.length,assignments,missing:assignments.filter(x=>x.source!=='existing-qid').length,existing:assignments.filter(x=>x.source==='existing-qid').length};
  }
  function migrateForm(bank,fallbackFormUid='form'){
    const plan=planForm(bank,fallbackFormUid),out=clone(bank);out.formUid=plan.formUid;out.qidSchemaVersion=QID_SCHEMA_VERSION;
    for(const a of plan.assignments)out.blocks[a.blockIndex].questions[a.questionIndex].qid=a.qid;
    validateForm(out,plan.formUid);return {bank:out,plan};
  }
  function validateForm(bank,fallbackFormUid='form'){
    const formUid=resolveFormUid(bank,fallbackFormUid),rows=questionsOf(bank),seen=new Set(),duplicates=[],missing=[];
    for(const row of rows){const qid=String(row.question?.qid||'').trim();if(!validQid(qid))missing.push({blockIndex:row.blockIndex,questionIndex:row.questionIndex});else if(seen.has(qid))duplicates.push(qid);else seen.add(qid);}
    return {ok:missing.length===0&&duplicates.length===0&&Number(bank?.qidSchemaVersion)===QID_SCHEMA_VERSION,formUid,questionCount:rows.length,validQids:seen.size,missing,duplicates:Array.from(new Set(duplicates)),qidSchemaVersion:Number(bank?.qidSchemaVersion||0)};
  }
  function questionQidBlocks(bank){return (bank?.blocks||[]).map(block=>(block?.questions||[]).map(q=>String(q?.qid||'')));}
  function sessionsFromProgress(progress){
    const out=[];if(!progress||typeof progress!=='object')return out;
    if(Array.isArray(progress?.bundle?.attempts))progress.bundle.attempts.forEach(a=>{if(a?.session)out.push(a.session)});
    if(progress.session&&!out.includes(progress.session))out.push(progress.session);
    if(Array.isArray(progress.blocks)&&!out.includes(progress))out.push(progress);
    return out;
  }
  function applyProgressMapping(progress,bank,legacyBankHash=''){
    if(!progress)return progress;const out=clone(progress),formUid=resolveFormUid(bank),maps=questionQidBlocks(bank),legacy=new Set();
    const addHash=v=>{const s=String(v||'');if(s&&s!==String(legacyBankHash||''))legacy.add(s)};
    sessionsFromProgress(out).forEach(session=>{
      addHash(session.bankHash);session.formUid=formUid;session.qidMappingVersion=QID_MAPPING_VERSION;
      const legacyToQid=key=>{const p=legacyPosition(key);if(p){const qid=maps[p.blockIndex]?.[p.questionIndex];return qid||'';}const s=String(key||''),i=s.indexOf('::');return i>=0?s.slice(i+2):'';};
      const keyList=['a193QuestionKeys','libraryQuestionKeys','qbankKeys'].map(n=>Array.isArray(session[n])?session[n]:null).find(Boolean),translated=keyList?keyList.map(legacyToQid):null;
      for(const name of['a193QuestionKeys','libraryQuestionKeys','qbankKeys'])if(Array.isArray(session[name]))session[name]=session[name].map((key,i)=>translated?.[i]?keyFor(formUid,translated[i]):key);
      let flatOffset=0,configured=null;if(!translated){const flat=maps.flat(),setting=session.blockSizeSetting;if(setting==='original')configured=maps.map(x=>x.slice());else if(setting==='all'||!setting)configured=[flat];else{const n=Math.max(1,parseInt(setting,10)||flat.length||1);configured=[];for(let i=0;i<flat.length;i+=n)configured.push(flat.slice(i,i+n));}}
      (session.blocks||[]).forEach((block,i)=>{const count=Math.max(Number(block?.total)||0,block?.answers?.length||0),active=Array.isArray(session.activeBlockIndexes)?Number(session.activeBlockIndexes[i]):i,qids=translated?translated.slice(flatOffset,flatOffset+count):(configured?.[Number.isFinite(active)?active:i]||maps[i]||[]).slice(0,count||undefined);flatOffset+=count;if(count&&qids.length<count)throw new Error(`Progress block ${i+1} could not be mapped to permanent QIDs.`);block.questionQids=qids;block.qidMappingVersion=QID_MAPPING_VERSION;});
    });
    out.formUid=formUid;out.qidMappingVersion=QID_MAPPING_VERSION;
    if(out.bundle){out.bundle.formUid=formUid;out.bundle.qidMappingVersion=QID_MAPPING_VERSION;}
    const current=String(legacyBankHash||bank?.bankHash||'');if(current)legacy.delete(current);
    const prior=Array.isArray(out.legacyBankHashes)?out.legacyBankHashes:[];out.legacyBankHashes=Array.from(new Set(prior.concat([...legacy])));
    return out;
  }
  function legacyPosition(key){const m=String(key||'').match(/^(.+?):(\d+):(\d+)$/);return m?{formId:m[1],blockIndex:Number(m[2]),questionIndex:Number(m[3])}:null;}
  function keyFor(formUid,qid){return `${formUid}::${qid}`;}
  function mergeValue(a,b){
    if(a===undefined)return clone(b);if(b===undefined)return clone(a);if(typeof a==='boolean'||typeof b==='boolean')return !!a||!!b;
    if(Array.isArray(a)&&Array.isArray(b))return Array.from(new Set(a.concat(b).map(x=>JSON.stringify(x)))).map(x=>JSON.parse(x));
    if(a&&b&&typeof a==='object'&&typeof b==='object'){const out=clone(a);Object.keys(b).forEach(k=>out[k]=mergeValue(out[k],b[k]));return out;}
    return clone(b);
  }
  function migrateKey(key,forms){
    if(String(key).includes('::'))return String(key);const pos=legacyPosition(key);if(!pos)return String(key);
    const form=forms[String(pos.formId)],qid=form?.qids?.[pos.blockIndex]?.[pos.questionIndex];if(!qid)throw new Error(`Legacy Qbank key ${String(key)} could not be mapped to a loaded form question.`);return keyFor(form.formUid,qid);
  }
  function qbankQuestionKeys(qbank){const out=[];if(!qbank||typeof qbank!=='object')return out;for(const name of['used','history','questionHistory','stats','marked','wrong','correct'])if(qbank[name]&&typeof qbank[name]==='object'&&!Array.isArray(qbank[name]))out.push(...Object.keys(qbank[name]));const add=list=>{if(Array.isArray(list))out.push(...list.map(String));};add(qbank.qbankKeys);add(qbank.activeSession?.qbankKeys);(qbank.sessions||[]).forEach(s=>{add(s?.qbankKeys);add(s?.session?.qbankKeys);});return Array.from(new Set(out));}
  function auditQbank(qbank,formMap){const refs=qbankQuestionKeys(qbank),known=new Set();Object.entries(formMap||{}).forEach(([id,bank])=>{const uid=resolveFormUid(bank,id);questionQidBlocks(bank).forEach(row=>row.forEach(qid=>known.add(keyFor(uid,qid))));});const legacy=refs.filter(k=>!!legacyPosition(k)),ambiguous=refs.filter(k=>!legacyPosition(k)&&(!String(k).includes('::')||!known.has(String(k))));return {references:refs.length,legacy,ambiguous,qidMappingVersion:Number(qbank?.qidMappingVersion||0),compatible:legacy.length===0&&ambiguous.length===0&&(!refs.length||Number(qbank?.qidMappingVersion)===QID_MAPPING_VERSION)};}
  function migrateQbank(qbank,formMap){
    if(!qbank)return qbank;const out=clone(qbank),forms={};
    Object.entries(formMap||{}).forEach(([id,bank])=>forms[String(id)]={formUid:resolveFormUid(bank,id),qids:questionQidBlocks(bank)});
    const migrateObjectKeys=obj=>{const next={};for(const [oldKey,value] of Object.entries(obj||{})){const newKey=migrateKey(oldKey,forms);next[newKey]=mergeValue(next[newKey],value);}return next;};
    if(out.used&&typeof out.used==='object')out.used=migrateObjectKeys(out.used);
    for(const name of['history','questionHistory','stats','marked','wrong','correct'])if(out[name]&&typeof out[name]==='object'&&!Array.isArray(out[name]))out[name]=migrateObjectKeys(out[name]);
    const rewriteList=list=>Array.isArray(list)?Array.from(new Set(list.map(k=>migrateKey(k,forms)))):list;
    if(Array.isArray(out.qbankKeys))out.qbankKeys=rewriteList(out.qbankKeys);
    if(out.activeSession?.qbankKeys)out.activeSession.qbankKeys=rewriteList(out.activeSession.qbankKeys);
    (out.sessions||[]).forEach(s=>{if(s.qbankKeys)s.qbankKeys=rewriteList(s.qbankKeys);if(s.session?.qbankKeys)s.session.qbankKeys=rewriteList(s.session.qbankKeys);});
    out.qidMappingVersion=QID_MAPPING_VERSION;return out;
  }
  function rewriteBankHash(value,oldHash,newHash){
    const out=clone(value),from=String(oldHash||''),to=String(newHash||'');
    const walk=v=>{if(Array.isArray(v)){v.forEach(walk);return;}if(v&&typeof v==='object')for(const [key,item] of Object.entries(v)){if(key==='bankHash'&&String(item||'')===from)v[key]=to;else walk(item);}};
    walk(out);return out;
  }
  function invariantValue(value){
    const out=clone(value),metadata=new Set(['formUid','qidSchemaVersion','qidMappingVersion','questionQids','legacyBankHashes','bankHash','a193QuestionKeys','libraryQuestionKeys','qbankKeys']);
    const walk=v=>{if(Array.isArray(v)){v.forEach(walk);return;}if(v&&typeof v==='object')for(const key of Object.keys(v)){if(metadata.has(key))delete v[key];else walk(v[key]);}};
    walk(out);return JSON.stringify(out);
  }
  function auditForm(bank,fallbackFormUid='form',progress=null){
    let validation;try{validation=validateForm(bank,fallbackFormUid);}catch(error){return {formUid:fallbackFormUid,questions:questionsOf(bank).length,validQids:0,duplicateQids:0,qidSchemaVersion:0,status:'ERROR',error:error.message};}
    const hasProgress=sessionsFromProgress(progress).length>0,progressMapped=!hasProgress||sessionsFromProgress(progress).every(s=>Number(s.qidMappingVersion)===QID_MAPPING_VERSION&&(s.blocks||[]).every(b=>Array.isArray(b.questionQids)));
    let status='MIGRATED';if(validation.duplicates.length)status='DUPLICATE QIDs';else if(validation.missing.length===validation.questionCount&&validation.questionCount)status='NEEDS QIDs';else if(validation.missing.length)status='PARTIAL';else if(!progressMapped)status='LEGACY PROGRESS';else if(!validation.ok)status='READY';
    return {formUid:validation.formUid,questions:validation.questionCount,validQids:validation.validQids,duplicateQids:validation.duplicates.length,qidSchemaVersion:validation.qidSchemaVersion,progressMapped,status};
  }
  return {QID_SCHEMA_VERSION,QID_MAPPING_VERSION,validQid,safePart,resolveFormUid,questionsOf,generatedQid,planForm,migrateForm,validateForm,questionQidBlocks,sessionsFromProgress,applyProgressMapping,legacyPosition,keyFor,qbankQuestionKeys,auditQbank,migrateQbank,rewriteBankHash,invariantValue,auditForm};
});

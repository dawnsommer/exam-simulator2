(function(){
  'use strict';
  const R=window.StepProgressSync,U=R.util,B=R.backupModel;
  function bridge(){if(!window.StepExamSyncBridge)throw new Error('Simulator backup bridge is not available. Reload the app.');return window.StepExamSyncBridge;}
  function parseMaybe(text,label){return text==null?null:U.parseJson(text,label);}
  const yieldNow=()=>new Promise(res=>setTimeout(res,0));
  function deriveModified(progress,suspended,rec){
    const v=[];try{v.push(progress?.bundle?.updatedAt,progress?.exportedAt,progress?.session?.updatedAt,progress?.session?.completedAt,progress?.updatedAt);(progress?.bundle?.attempts||[]).forEach(a=>v.push(a?.completedAt,a?.createdAt,a?.session?.updatedAt,a?.session?.completedAt));}catch(e){}
    try{v.push(suspended?.updatedAt,suspended?.resumeCapturedAt,rec?.updatedAt);}catch(e){}
    const ms=Math.max(0,...v.map(U.validDate));return ms?new Date(ms).toISOString():U.iso();
  }
  async function readLocal({flush=true,yieldBetween=false}={}){
    const b=bridge();await b.ensureReady();if(flush)await b.flushActive();
    const cat=await b.catalog(),deviceId=await R.meta.deviceId(),forms={};let i=0;
    for(const rec of (cat.forms||[])){
      const progress=parseMaybe(await b.readFormProgressText(rec.id),`${rec.id} progress`);
      const suspended=parseMaybe(await b.readFormSuspendedText(rec.id),`${rec.id} suspended progress`);
      const score=String(rec.threeDigitScore||'');
      if(progress||suspended||score){const formUid=String(rec.formUid||rec.id),key=B.entityKey(formUid);forms[key]={key,kind:'form',formId:String(rec.id),formUid,bankHash:String(rec.bankHash||''),qidSchemaVersion:Number(rec.qidSchemaVersion||0),questionCount:Number(rec.totalQuestions||rec.questionIndex?.length||0),legacyBankHashes:Array.isArray(rec.legacyBankHashes)?rec.legacyBankHashes.slice():[],progress:progress||null,suspended:suspended||null,threeDigitScore:score,modifiedAt:deriveModified(progress,suspended,rec),deviceId};}
      if(yieldBetween&&++i%2===0)await yieldNow();
    }
    const qtxt=await b.readQbankText();let qbank=null;
    if(qtxt){const q=parseMaybe(qtxt,'Qbank progress');if(q){delete q.settings;delete q.lastSelectedFormIds;qbank={key:B.qbankKey,kind:'qbank',progress:q,modifiedAt:deriveModified(q,null,null),deviceId};}}
    return {forms,qbank,deviceId,catalog:cat,runtime:b.runtime(),capturedAt:U.iso()};
  }
  function serializeForCloud(entity){if(!entity)return null;if(entity.kind==='qbank')return U.clone({progress:entity.progress||null});return U.clone({progress:entity.progress||null,suspended:entity.suspended||null,threeDigitScore:String(entity.threeDigitScore||'')});}
  function payloadOf(entity){return serializeForCloud(entity);}
  function restoreFromCloud(payload){return U.clone(payload||{});}
  async function hashEntity(entity){return entity?await U.sha256Text(U.stable(payloadOf(entity))):'';}
  async function localIndex(opts={}){const local=await readLocal(opts),index={};let i=0;for(const [key,e] of Object.entries(local.forms)){index[key]={...e,contentHash:await hashEntity(e)};if(opts.yieldBetween&&++i%2===0)await yieldNow();}if(local.qbank)index[B.qbankKey]={...local.qbank,contentHash:await hashEntity(local.qbank)};return {...local,index};}

  function makeFormBackup(entity,meta){return {type:R.config.FORM_BACKUP_TYPE,schemaVersion:R.config.SCHEMA_VERSION,appId:R.config.CLOUD.appId,progressRevisionId:meta.versionId,parentProgressRevisionId:meta.parentProgressRevisionId||null,versionId:meta.versionId,createdAt:meta.updatedAt,deviceId:meta.deviceId,build:R.config.BUILD,formUid:entity.formUid||entity.formId,formId:entity.formId,formRevision:{bankHash:entity.bankHash,qidSchemaVersion:Number(entity.qidSchemaVersion||0),questionCount:Number(entity.questionCount||0)},bankHash:entity.bankHash,qidSchemaVersion:Number(entity.qidSchemaVersion||0),questionCount:Number(entity.questionCount||0),contentHash:meta.contentHash,payload:payloadOf(entity)};}
  function makeQbankBackup(entity,meta){return {type:R.config.QBANK_BACKUP_TYPE,schemaVersion:R.config.SCHEMA_VERSION,appId:R.config.CLOUD.appId,versionId:meta.versionId,createdAt:meta.updatedAt,deviceId:meta.deviceId,build:R.config.BUILD,contentHash:meta.contentHash,payload:payloadOf(entity)};}
  function validateBackup(obj,entry){
    if(!obj||typeof obj!=='object')throw new Error('Cloud backup is invalid.');
    const schema=Number(obj.schemaVersion||0);if(schema!==R.config.SCHEMA_VERSION&&schema!==1)throw new Error(`Unsupported cloud backup schema ${String(obj.schemaVersion)}.`);if(obj.appId&&obj.appId!==R.config.CLOUD.appId)throw new Error('Cloud backup belongs to a different application.');
    if(entry.kind==='form'){if(obj.type!==R.config.FORM_BACKUP_TYPE)throw new Error(`Cloud backup type is invalid for ${entry.formId}.`);const uid=String(obj.formUid||obj.formId||''),expected=String(entry.formUid||entry.formId||'');if(uid!==expected)throw new Error(`Cloud backup identity mismatch for ${entry.formId}.`);}else if(obj.type!==R.config.QBANK_BACKUP_TYPE)throw new Error('Cloud Qbank backup type is invalid.');
    return obj;
  }
  function qidsFromProgress(progress){
    const out=new Set(),sessions=window.StepQidMigration?.sessionsFromProgress?StepQidMigration.sessionsFromProgress(progress):[];
    for(const session of sessions){
      for(const block of(session?.blocks||[]))for(const qid of(block?.questionQids||[]))if(qid)out.add(String(qid));
      for(const name of['a193QuestionKeys','libraryQuestionKeys','qbankKeys'])for(const key of(session?.[name]||[])){const i=String(key).indexOf('::');if(i>=0)out.add(String(key).slice(i+2));}
    }
    return out;
  }
  function assertCompatibleQids(rec,payload,entry,sameHash){
    if(sameHash||Number(rec?.qidSchemaVersion||0)<1||Number(entry?.qidSchemaVersion||0)<1)return;
    const installed=new Set((rec?.questionIndex||[]).map(row=>String(row?.qid||(String(row?.key||'').includes('::')?String(row.key).split('::').slice(1).join('::'):''))).filter(Boolean));
    const incoming=new Set([...qidsFromProgress(payload?.progress),...qidsFromProgress(payload?.suspended)]);
    if(payload?.progress&&!incoming.size)throw new Error(`Form QID compatibility could not be verified for ${rec?.id||entry?.formId||'this form'}; cloud progress was not applied.`);
    for(const qid of incoming)if(!installed.has(qid))throw new Error(`Form QID incompatibility for ${rec?.id||entry?.formId||'this form'}; cloud question identity ${qid} is not installed locally.`);
  }

  async function createLocalRecovery(key,reason='Saved before cloud restore'){
    const local=await localIndex({flush:true,yieldBetween:true}),e=local.index[key];if(!e)return null;
    const map=await R.meta.get('localRecoveryV2',{})||{};
    map[key]={key,kind:e.kind,formId:e.formId||'',formUid:e.formUid||e.formId||'',bankHash:e.bankHash||'',payload:payloadOf(e),createdAt:U.iso(),reason,contentHash:e.contentHash};
    await R.meta.set('localRecoveryV2',map);return map[key];
  }
  async function createLocalRecoveries(keys,reason='Saved before cloud restore'){const wanted=new Set(keys||[]),local=await localIndex({flush:true,yieldBetween:true}),map=await R.meta.get('localRecoveryV2',{})||{};for(const [key,e] of Object.entries(local.index)){if(wanted.size&&!wanted.has(key))continue;map[key]={key,kind:e.kind,formId:e.formId||'',formUid:e.formUid||e.formId||'',bankHash:e.bankHash||'',payload:payloadOf(e),createdAt:U.iso(),reason,contentHash:e.contentHash};}await R.meta.set('localRecoveryV2',map);return map;}
  async function listLocalRecoveries(){return await R.meta.get('localRecoveryV2',{})||{};}
  async function deleteLocalRecovery(key){const map=await listLocalRecoveries();delete map[key];await R.meta.set('localRecoveryV2',map);}
  async function applyRecoveryRecord(rec){
    if(!rec)throw new Error('Local recovery point was not found.');const b=bridge();window.__STEP_SYNC_APPLYING_REMOTE=true;
    try{if(rec.kind==='qbank'){await b.writeQbankText(rec.payload?.progress?JSON.stringify(rec.payload.progress):null);}else{const cat=await b.catalog(),form=(cat.forms||[]).find(x=>String(x.id)===String(rec.formId));if(!form)throw new Error(`${rec.formId} is not loaded locally.`);if(String(form.bankHash||'')!==String(rec.bankHash||''))throw new Error(`Form version mismatch for ${rec.formId}.`);if(rec.payload?.progress)await b.writeFormProgressText(rec.formId,JSON.stringify(rec.payload.progress),rec.bankHash);else await b.deleteFormProgress(rec.formId);await b.writeFormSuspendedText(rec.formId,rec.payload?.suspended?JSON.stringify(rec.payload.suspended):null,rec.bankHash);await b.setThreeDigitScore(rec.formId,rec.payload?.threeDigitScore||'');}await b.refresh();}finally{window.__STEP_SYNC_APPLYING_REMOTE=false;}
  }

  /* Compatibility checkpoint used by old UI/tests; V2 uses per-entity localRecoveryV2. */
  async function checkpoint(){const local=await readLocal({flush:true,yieldBetween:true});await R.meta.set('preBackupRecoverySnapshot',U.clone(local));await R.meta.set('preBackupRecoveryAt',U.iso());return local;}
  async function restoreCheckpoint(){const cp=await R.meta.get('preBackupRecoverySnapshot',null);if(!cp)throw new Error('No pre-backup recovery checkpoint is available.');const b=bridge();window.__STEP_SYNC_APPLYING_REMOTE=true;try{for(const rec of(cp.catalog?.forms||[])){const key=B.entityKey(rec.formUid||rec.id),e=cp.forms?.[key];if(e){if(e.progress)await b.writeFormProgressText(rec.id,JSON.stringify(e.progress),rec.bankHash);else await b.deleteFormProgress(rec.id);await b.writeFormSuspendedText(rec.id,e.suspended?JSON.stringify(e.suspended):null,rec.bankHash);await b.setThreeDigitScore(rec.id,e.threeDigitScore||'');}}if(cp.qbank?.progress)await b.writeQbankText(JSON.stringify(cp.qbank.progress));else await b.writeQbankText(null);await b.refresh();}finally{window.__STEP_SYNC_APPLYING_REMOTE=false;}return true;}

  async function applyBackup(entry,backup){validateBackup(backup,entry);const b=bridge(),payload=restoreFromCloud(backup.payload);window.__STEP_SYNC_APPLYING_REMOTE=true;try{if(entry.kind==='qbank'){await b.writeQbankText(JSON.stringify(payload?.progress||{}));}else{const cat=await b.catalog(),uid=String(entry.formUid||entry.formId||''),rec=(cat.forms||[]).find(x=>String(x.formUid||x.id)===uid);if(!rec)throw new Error(`${entry.formId||uid} is not loaded locally. Import the matching form first.`);const sameHash=String(rec.bankHash||'')===String(entry.bankHash||''),qidCompatible=Number(rec.qidSchemaVersion||0)>=1&&Number(entry.qidSchemaVersion||backup.qidSchemaVersion||backup.formRevision?.qidSchemaVersion||0)>=1&&(!entry.questionCount||Number(rec.totalQuestions||0)===Number(entry.questionCount));if(!sameHash&&!qidCompatible)throw new Error(`Form revision mismatch for ${entry.formId||uid}; cloud backup was not applied.`);assertCompatibleQids(rec,payload,entry,sameHash);let progress=payload?.progress||null,suspended=payload?.suspended||null;if(!sameHash&&window.StepQidMigration){if(progress)progress=StepQidMigration.rewriteBankHash(progress,entry.bankHash,rec.bankHash);if(suspended)suspended=StepQidMigration.rewriteBankHash(suspended,entry.bankHash,rec.bankHash);}if(progress)await b.writeFormProgressText(rec.id,JSON.stringify(progress),rec.bankHash);else await b.deleteFormProgress(rec.id);await b.writeFormSuspendedText(rec.id,suspended?JSON.stringify(suspended):null,rec.bankHash);await b.setThreeDigitScore(rec.id,payload?.threeDigitScore||'');}await b.refresh();}finally{window.__STEP_SYNC_APPLYING_REMOTE=false;}}
  async function applyDeletion(entry){const b=bridge();window.__STEP_SYNC_APPLYING_REMOTE=true;try{if(entry.kind==='qbank')await b.writeQbankText(null);else{const cat=await b.catalog(),uid=String(entry.formUid||entry.formId||''),rec=(cat.forms||[]).find(x=>String(x.formUid||x.id)===uid);if(!rec)throw new Error(`${entry.formId||uid} is not loaded locally. Import/restore the matching form library first.`);await b.deleteFormProgress(rec.id);await b.writeFormSuspendedText(rec.id,null,rec.bankHash);await b.setThreeDigitScore(rec.id,'');}await b.refresh();}finally{window.__STEP_SYNC_APPLYING_REMOTE=false;}}
  function sessionsFromProgress(p){if(!p)return[];if(Array.isArray(p?.bundle?.attempts))return p.bundle.attempts.map(a=>a&&a.session).filter(Boolean);if(p.session)return[p.session];if(Array.isArray(p.blocks))return[p];return[];}
  function stats(local){let attempts=0,questions=0,answered=0,marked=0,stemHighlights=0,expHighlights=0,struck=0,notes=0;for(const e of Object.values(local.forms||{})){for(const s of sessionsFromProgress(e.progress)){attempts++;for(const bp of(s.blocks||[])){const n=Math.max(Number(bp?.total)||0,Array.isArray(bp?.answers)?bp.answers.length:0);questions+=n;if(Array.isArray(bp?.answers))answered+=bp.answers.filter(x=>x!==null&&x!==undefined).length;if(Array.isArray(bp?.flagged))marked+=bp.flagged.filter(Boolean).length;if(bp?.struck&&typeof bp.struck==='object')Object.values(bp.struck).forEach(a=>{if(Array.isArray(a))struck+=a.length;});if(bp?.stemHighlightAnchors&&typeof bp.stemHighlightAnchors==='object')Object.values(bp.stemHighlightAnchors).forEach(a=>{if(Array.isArray(a))stemHighlights+=a.length;});if(bp?.explanationHighlightAnchors&&typeof bp.explanationHighlightAnchors==='object')Object.values(bp.explanationHighlightAnchors).forEach(a=>{if(Array.isArray(a))expHighlights+=a.length;});if(String(bp?.notes||'').trim())notes++;}}const gs=e?.progress?.bundle?.explanationHighlightAnchorsByQuestionKey;if(gs&&typeof gs==='object')Object.values(gs).forEach(a=>{if(Array.isArray(a))expHighlights+=a.length;});}return {forms:Object.keys(local.forms||{}).length,attempts,questions,answered,marked,stemHighlights,expHighlights,struck,notes,qbankTests:Array.isArray(local.qbank?.progress?.sessions)?local.qbank.progress.sessions.length:0};}
  async function validateLocal(){const local=await localIndex({flush:true,yieldBetween:true});for(const [key,e] of Object.entries(local.forms)){if(!e.formId||!e.bankHash)throw new Error(`Progress entity ${key} lacks a stable form ID or bank hash.`);const meta={versionId:'TEST',updatedAt:U.iso(),deviceId:local.deviceId,contentHash:e.contentHash};const b=makeFormBackup(e,meta);validateBackup(JSON.parse(JSON.stringify(b)),{kind:'form',formId:e.formId,bankHash:e.bankHash});}return {ok:true,stats:stats(local),loadedForms:(local.catalog.forms||[]).length,deviceId:local.deviceId,entities:Object.keys(local.index).length,estimatedBytes:new Blob([U.stable(Object.values(local.index).map(payloadOf))]).size};}

  R.storage={readLocal,localIndex,serializeForCloud,restoreFromCloud,payloadOf,hashEntity,makeFormBackup,makeQbankBackup,validateBackup,checkpoint,restoreCheckpoint,applyBackup,applyDeletion,stats,validateLocal,createLocalRecovery,createLocalRecoveries,listLocalRecoveries,deleteLocalRecovery,applyRecoveryRecord};
})();

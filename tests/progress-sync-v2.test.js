const fs=require('fs'),vm=require('vm'),{webcrypto}=require('crypto');
global.crypto=webcrypto;
global.window=global;
global.addEventListener=()=>{};
global.navigator={onLine:true,serviceWorker:null};
global.location={hash:'',pathname:'/',search:'',assign(){}};
global.history={state:null,replaceState(){}};
global.CustomEvent=function(name,opts){this.type=name;this.detail=opts?.detail};
global.confirm=()=>true; global.prompt=()=>'';
global.document={readyState:'loading',addEventListener(){},querySelector(){return null},querySelectorAll(){return[]},getElementById(){return null},head:{appendChild(){}},body:{appendChild(){}}};
global.MutationObserver=function(){this.observe=()=>{}};
const metaMap=new Map();
const meta={async get(k,d=null){return metaMap.has(k)?structuredClone(metaMap.get(k)):d},async set(k,v){metaMap.set(k,structuredClone(v));return v},async del(k){metaMap.delete(k)},async deviceId(){if(!metaMap.has('deviceId'))metaMap.set('deviceId','dev1');return metaMap.get('deviceId')}};
const U={clone:v=>structuredClone(v),iso:()=>new Date().toISOString(),parseJson:(t,l)=>JSON.parse(t),sha256Text:async t=>require('crypto').createHash('sha256').update(String(t)).digest('hex'),stable:v=>JSON.stringify(v,Object.keys(v||{}).sort()),validDate:v=>Date.parse(v)||0,safeName:v=>String(v).replace(/[^a-z0-9._-]+/gi,'_'),uuid:()=>webcrypto.randomUUID()};
const config={CLOUD:{appId:'exam-simulator2',driveFilePrefix:'exam-simulator2'},BUILD:'TEST-V2',MANIFEST_FILE:'exam-simulator2.manifest.json',MANIFEST_TYPE:'exam-simulator2-progress-manifest',MANIFEST_SCHEMA_VERSION:2,PROGRESS_SYNC_MODEL:'lineage-v2',HISTORY_FILE:'exam-simulator2.progress-history.json',HISTORY_TYPE:'exam-simulator2-progress-history',HISTORY_SCHEMA_VERSION:1,DAILY_SNAPSHOT_RETENTION:7,FORM_BACKUP_TYPE:'exam-simulator2-form-progress-backup',QBANK_BACKUP_TYPE:'exam-simulator2-qbank-progress-backup',SCHEMA_VERSION:1};
window.StepProgressSync={config,util:U,meta};
vm.runInThisContext(fs.readFileSync('js/sync-merge.js','utf8'),{filename:'sync-merge.js'});
const B=window.StepProgressSync.backupModel;
let local={deviceId:'dev1',catalog:{forms:[{id:'N-11',bankHash:'hash11'}]},index:{},forms:{},qbank:null,runtime:{examVisible:false}};
function ent(hash='L1',modifiedAt='2026-08-08T01:00:00Z'){return {key:B.entityKey('N-11','hash11'),kind:'form',formId:'N-11',bankHash:'hash11',contentHash:hash,modifiedAt,progress:{x:hash},suspended:null,threeDigitScore:'250'}}
function setLocal(e){local.index={};local.forms={};if(e){local.index[e.key]=e;local.forms[e.key]=e}}
const storage={
 async localIndex(){return structuredClone(local)},
 makeFormBackup(e,m){return {type:config.FORM_BACKUP_TYPE,schemaVersion:1,appId:config.CLOUD.appId,backupId:m.backupId,revision:m.revision,createdAt:m.updatedAt,deviceId:m.deviceId,formId:e.formId,bankHash:e.bankHash,contentHash:m.contentHash,payload:{progress:e.progress,suspended:e.suspended,threeDigitScore:e.threeDigitScore}}},
 makeQbankBackup(){throw new Error('not used')},
 async applyBackup(entry,b){const e={key:entry.key||B.entityKey(entry.formId,entry.bankHash),kind:'form',formId:entry.formId,bankHash:entry.bankHash,contentHash:b.contentHash,modifiedAt:b.createdAt,progress:b.payload.progress,suspended:b.payload.suspended,threeDigitScore:b.payload.threeDigitScore};setLocal(e)},
 async applyDeletion(){setLocal(null)},
 async checkpoint(){await meta.set('preBackupRecoverySnapshot',{marker:'cp'});await meta.set('preBackupRecoveryAt',U.iso())},
 async restoreCheckpoint(){},async validateLocal(){return{loadedForms:1,stats:{forms:Object.keys(local.index).length,attempts:0,answered:0,stemHighlights:0,expHighlights:0,qbankTests:0},entities:Object.keys(local.index).length,estimatedBytes:100}}
};
window.StepProgressSync.storage=storage;
window.StepExamSyncBridge={runtime:()=>({examVisible:false}),refresh:async()=>{},catalog:async()=>local.catalog};
window.dispatchEvent=()=>{};
// Drive mock
let seq=1; const files=new Map();
function responseJson(obj,status=200,headers={}){return new Response(JSON.stringify(obj),{status,headers:{'Content-Type':'application/json',...headers}})}
function responseText(text,status=200){return new Response(text,{status})}
const auth={initialize:async()=>{},getState:()=>({authorized:true}),validate:async()=>({emailAddress:'x@test'}),connect:async()=>{},disconnect:async()=>({}),driveFetch:async(url,opts={})=>{
 const method=opts.method||'GET'; const u=new URL(url); const path=u.pathname;
 if(method==='GET'&&path.endsWith('/drive/v3/files')){const q=u.searchParams.get('q')||'';const m=q.match(/name = '([^']+)'/);const name=m?m[1].replace(/\\'/g,"'"):'';const arr=[...files.values()].filter(f=>!name||f.name===name).map(({id,name,modifiedTime,size})=>({id,name,modifiedTime,size}));return responseJson({files:arr});}
 if(method==='POST'&&path.endsWith('/drive/v3/files')){const body=JSON.parse(opts.body||'{}'),id='f'+(seq++),f={id,name:body.name||'',modifiedTime:new Date().toISOString(),size:'0',content:''};files.set(id,f);return responseJson({id,name:f.name,modifiedTime:f.modifiedTime,size:f.size});}
 let m=path.match(/\/upload\/drive\/v3\/files\/([^/]+)$/);if(m&&method==='PATCH'){const id=decodeURIComponent(m[1]),f=files.get(id);if(!f)return responseJson({error:{message:'missing'}},404);f.content=opts.body||'';f.size=String(Buffer.byteLength(f.content));f.modifiedTime=new Date().toISOString();return responseJson({id,name:f.name,modifiedTime:f.modifiedTime,size:f.size});}
 m=path.match(/\/drive\/v3\/files\/([^/]+)\/copy$/);if(m&&method==='POST'){const src=files.get(decodeURIComponent(m[1]));const body=JSON.parse(opts.body||'{}'),id='f'+(seq++),f={id,name:body.name||src.name,modifiedTime:new Date().toISOString(),size:src.size,content:src.content};files.set(id,f);return responseJson({id,name:f.name,modifiedTime:f.modifiedTime,size:f.size});}
 m=path.match(/\/drive\/v3\/files\/([^/]+)$/);if(m&&method==='GET'&&u.searchParams.get('alt')==='media'){const f=files.get(decodeURIComponent(m[1]));return responseText(f?.content||'',f?200:404)}
 if(m&&method==='DELETE'){files.delete(decodeURIComponent(m[1]));return new Response(null,{status:204})}
 throw new Error('unhandled '+method+' '+url);
 }};
window.StepProgressSync.auth=auth;
vm.runInThisContext(fs.readFileSync('js/progress-sync.js','utf8'),{filename:'progress-sync.js'});
const sync=window.StepProgressSync.sync;
async function assert(cond,msg){if(!cond)throw new Error(msg)}
(async()=>{
 await meta.set('syncEnabled',true); await meta.set('progressDailySnapshotsEnabled',false);
 // Device1 first local-only backup
 setLocal(ent('A','2026-08-08T01:00:00Z'));
 let r=await sync.backupNow();
 let a=await sync._test.analyze({flush:false});
 await assert(a.rows[0].state==='ALIGNED','first backup should align');
 const v1=a.rows[0].current.versionId;
 console.log('PASS device1 first backup aligned',v1);
 // Local change descends from same current -> automatic safe backup + previous recovery
 setLocal(ent('B','2026-08-08T02:00:00Z'));
 await sync.backupNow(); a=await sync._test.analyze({flush:false});
 await assert(a.rows[0].state==='ALIGNED','second backup should align');
 await assert(a.rows[0].remote.previous?.versionId===v1,'previous cloud recovery should be retained');
 const v2=a.rows[0].current.versionId;
 console.log('PASS local->cloud version advance and previous recovery',v2);
 // Restore previous cloud copy locally: cloud current must remain unchanged and V2 must demand a decision before re-upload
 await sync._test.restorePreviousCloud(B.entityKey('N-11','hash11'));let prevRestored=await sync._test.analyze({flush:false});await assert(prevRestored.rows[0].state==='DIVERGED','restoring previous cloud recovery should create an explicit branch decision');await assert(prevRestored.rows[0].current.versionId===v2,'restoring previous cloud recovery must not change current cloud');await assert(await meta.get('preBackupRecoverySnapshot',null),'cloud->local recovery must save a local undo point');console.log('PASS previous cloud recovery -> local branch + local undo point');
 await sync.checkCloud({interactive:false});await sync.resolveConflictUseCloud();

 // Old device: base v1, local A, cloud v2 B -> cloud ahead decision, no upload
 await meta.set('progressSyncV2Entities',{[B.entityKey('N-11','hash11')]:{baseCloudVersionId:v1,baseContentHash:'A'}}); setLocal(ent('A','2026-08-07T01:00:00Z'));
 a=await sync._test.analyze({flush:false});await assert(a.rows[0].state==='CLOUD_AHEAD','old device should detect cloud ahead');console.log('PASS old device cloud ahead');
 // Both changed -> diverged
 setLocal(ent('C','2026-08-08T03:00:00Z'));a=await sync._test.analyze({flush:false});await assert(a.rows[0].state==='DIVERGED','both changed should diverge');console.log('PASS divergent edits');
 // New device / data loss: no local state and no progress -> cloud only, never deletion
 await meta.set('progressSyncV2Entities',{});setLocal(null);a=await sync._test.analyze({flush:false});await assert(a.rows[0].state==='CLOUD_ONLY','empty new device should see cloud only');console.log('PASS new device recovery classification');
 // Use cloud should restore and align
 // set decision via check
 await sync.checkCloud({interactive:false}); await sync.resolveConflictUseCloud();a=await sync._test.analyze({flush:false});await assert(a.rows[0].state==='ALIGNED'&&local.index[a.rows[0].key],'cloud restore should align local');console.log('PASS cloud->local restore + base adoption');
 // Manual snapshot copies cloud current server-side
 const snap=await sync._test.createSnapshot('manual','test');const hs=await sync._test.readHistory();await assert(hs.history.snapshots.some(s=>s.snapshotId===snap.snapshotId),'manual snapshot should be recorded');console.log('PASS manual dated snapshot');
 // Legacy manifest migration stable
 const legacy={type:config.MANIFEST_TYPE,schemaVersion:1,appId:config.CLOUD.appId,entries:{k:{kind:'form',formId:'X',bankHash:'h',fileId:'abc',contentHash:'z'}}};const n1=sync._test.normalizeManifest(structuredClone(legacy)),n2=sync._test.normalizeManifest(structuredClone(legacy));await assert(n1.entries.k.current.versionId===n2.entries.k.current.versionId,'legacy version id should be stable');console.log('PASS legacy manifest migration stable');
 // Manual Back Up Now must not overwrite newer cloud before a decision
 const currentBefore=(await sync._test.analyze({flush:false})).rows[0].current.versionId;
 const prevMeta=(await meta.get('progressSyncV2Entities',{}));
 prevMeta[B.entityKey('N-11','hash11')]={baseCloudVersionId:v1,baseContentHash:'A'};await meta.set('progressSyncV2Entities',prevMeta);setLocal(ent('C','2026-08-08T04:00:00Z'));
 await sync.backupNow();const afterDecision=await sync._test.analyze({flush:false});await assert(afterDecision.rows[0].current.versionId===currentBefore,'manual backup must not overwrite cloud before decision');await assert(afterDecision.rows[0].state==='DIVERGED','manual backup should leave diverged decision');console.log('PASS manual backup stops before divergent overwrite');
 // Explicit Keep This Device decision overwrites only after choice and preserves the old cloud current as recovery
 await sync.checkCloud({interactive:false});await sync.resolveConflictKeepLocal();let kept=await sync._test.analyze({flush:false});await assert(kept.rows[0].state==='ALIGNED','keep-local resolution should settle aligned');await assert(kept.rows[0].local.contentHash==='C'&&kept.rows[0].current.contentHash==='C','keep-local should make cloud equal local');await assert(kept.rows[0].remote.previous?.versionId===currentBefore,'keep-local should preserve old cloud current as previous recovery');console.log('PASS explicit Keep This Device resolution + recovery');
 // Missing local on a fresh device must not upload deletion or change cloud
 await meta.set('progressSyncV2Entities',{});setLocal(null);const cloudVerBefore=(await sync._test.analyze({flush:false})).rows[0].current.versionId;await sync._test.syncCheckpoint('fresh-device-test');const freshAfter=await sync._test.analyze({flush:false});await assert(freshAfter.rows[0].state==='CLOUD_ONLY','fresh device remains cloud-only until user restores');await assert(freshAfter.rows[0].current.versionId===cloudVerBefore,'fresh device must not alter cloud');console.log('PASS fresh-device checkpoint never wipes cloud');
 // Explicit local deletion descending from current cloud auto-propagates and preserves previous cloud recovery
 await sync.checkCloud({interactive:false});await sync.resolveConflictUseCloud();let aligned=await sync._test.analyze({flush:false});const baseNow=aligned.rows[0].current.versionId;setLocal(null);await meta.set('progressSyncV2Entities',{[B.entityKey('N-11','hash11')]:{baseCloudVersionId:baseNow,baseContentHash:aligned.rows[0].current.contentHash,explicitDeleted:true,deleteAt:new Date().toISOString()}});await sync._test.syncCheckpoint('explicit-delete');let delA=await sync._test.analyze({flush:false});await assert(delA.rows[0].current.deletedAt,'explicit safe deletion should create cloud tombstone');await assert(delA.rows[0].remote.previous?.versionId===baseNow,'deletion should retain previous cloud recovery');await assert(delA.rows[0].state==='ALIGNED','deletion should settle aligned');console.log('PASS explicit deletion lineage + previous recovery');
 // Restoring an older dated snapshot must restore locally but NEVER auto-overwrite the newer current cloud tombstone
 await sync._test.restoreSnapshot(snap.snapshotId);let snapRestored=await sync._test.analyze({flush:false});await assert(snapRestored.rows[0].state==='DIVERGED','old snapshot restore should require explicit direction before cloud overwrite');await assert(snapRestored.rows[0].current.deletedAt,'dated snapshot restore must leave current cloud untouched');await assert(local.index[B.entityKey('N-11','hash11')],'dated snapshot should restore local progress');console.log('PASS dated snapshot restore creates explicit branch without cloud overwrite');
 // Daily snapshot retention keeps only the configured last 7 daily recovery points
 const manForDaily=(await sync._test.analyze({flush:false})).manifest;for(let i=0;i<8;i++)await sync._test.commitSnapshotFromManifest(manForDaily,'daily','d'+i);const dailyHist=(await sync._test.readHistory()).history;await assert(dailyHist.snapshots.filter(s=>s.kind==='daily').length===7,'daily snapshot retention should cap at 7');console.log('PASS daily snapshot retention = 7');
 // Clear CURRENT cloud must preserve dated snapshots and unrelated library files
 const historyBefore=(await sync._test.readHistory()).history.snapshots.length;
 files.set('lib1',{id:'lib1',name:'exam-simulator2.library.manifest.json',modifiedTime:new Date().toISOString(),size:'10',content:'{}'});
 await sync.clearCloudProgressBackup();const histAfter=(await sync._test.readHistory()).history.snapshots.length;await assert(histAfter===historyBefore,'clear current cloud must preserve dated snapshots');await assert(files.has('lib1'),'clear current cloud must not touch library backup');console.log('PASS clear current sync preserves snapshots + library backup');
 console.log('ALL PROGRESS SYNC V2 INTEGRATION TESTS PASSED');
})().catch(e=>{console.error(e);process.exit(1)});

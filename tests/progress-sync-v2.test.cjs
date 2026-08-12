const fs=require('fs');
const vm=require('vm');
const path=require('path');
const assert=require('assert/strict');
const {webcrypto,randomUUID}=require('crypto');

const ROOT=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
const tick=()=>new Promise(r=>setTimeout(r,0));

class MockDrive{
  constructor(){this.files=new Map();this.seq=0;}
  now(){return new Date(Date.UTC(2026,7,8,5,0,0)+this.seq*1000).toISOString();}
  addJson(name,obj){const id='f'+(++this.seq);const body=JSON.stringify(obj);this.files.set(id,{id,name,body,modifiedTime:this.now(),size:String(Buffer.byteLength(body)),mimeType:'application/json'});return this.files.get(id);}
  byName(name){return [...this.files.values()].filter(f=>f.name===name).sort((a,b)=>String(b.modifiedTime).localeCompare(String(a.modifiedTime)));}
  jsonByName(name){const f=this.byName(name)[0];return f?JSON.parse(f.body):null;}
  resp(status,data,text){return {status,ok:status>=200&&status<300,headers:new Headers(),json:async()=>clone(data),text:async()=>text!==undefined?String(text):JSON.stringify(data??{}),blob:async()=>new Blob([text!==undefined?String(text):JSON.stringify(data??{})])};}
  async fetch(url,opts={}){
    const u=new URL(url);const method=String(opts.method||'GET').toUpperCase();
    if(u.pathname.endsWith('/about')) return this.resp(200,{user:{emailAddress:'test@example.com',displayName:'Test'}});
    if(u.pathname==='/drive/v3/files'&&method==='GET'){
      const q=u.searchParams.get('q')||'';const m=q.match(/name = '((?:\\'|[^'])*)'/);const name=m?m[1].replace(/\\'/g,"'").replace(/\\\\/g,'\\'):'';
      return this.resp(200,{files:this.byName(name).map(({body,...f})=>f)});
    }
    if(u.pathname==='/drive/v3/files'&&method==='POST'){
      const meta=typeof opts.body==='string'?JSON.parse(opts.body):opts.body||{};const f=this.addJson(meta.name||'unnamed',{});f.body='';f.size='0';f.mimeType=meta.mimeType||'application/json';return this.resp(200,clone(f));
    }
    const copy=u.pathname.match(/^\/drive\/v3\/files\/([^/]+)\/copy$/);
    if(copy&&method==='POST'){
      const src=this.files.get(decodeURIComponent(copy[1]));if(!src)return this.resp(404,{error:{message:'missing'}});
      const meta=JSON.parse(opts.body||'{}'),id='f'+(++this.seq),f={...clone(src),id,name:meta.name||src.name,modifiedTime:this.now()};this.files.set(id,f);return this.resp(200,clone(f));
    }
    const upload=u.pathname.match(/^\/upload\/drive\/v3\/files\/([^/]+)$/);
    if(upload&&method==='PATCH'){
      const id=decodeURIComponent(upload[1]),f=this.files.get(id);if(!f)return this.resp(404,{error:{message:'missing'}});
      f.body=String(opts.body||'');f.size=String(Buffer.byteLength(f.body));f.modifiedTime=this.now();return this.resp(200,{id:f.id,name:f.name,modifiedTime:f.modifiedTime,size:f.size});
    }
    const file=u.pathname.match(/^\/drive\/v3\/files\/([^/]+)$/);
    if(file){const id=decodeURIComponent(file[1]);if(method==='DELETE'){this.files.delete(id);return this.resp(204,{},'');}if(method==='GET'&&u.searchParams.get('alt')==='media'){const f=this.files.get(id);return f?this.resp(200,null,f.body):this.resp(404,{error:{message:'missing'}});}}
    throw new Error(`Unhandled mock Drive request ${method} ${url}`);
  }
}

function memoryMeta(){
  const m=new Map();return {store:m,async get(k,d=null){return m.has(k)?clone(m.get(k)):d;},async set(k,v){m.set(k,clone(v));return v;},async del(k){m.delete(k);},async deviceId(){if(!m.has('deviceId'))m.set('deviceId','DEV-A');return m.get('deviceId');}};
}
function makeDoc(){return {readyState:'loading',addEventListener(){},getElementById(){return null;},querySelector(){return null;},querySelectorAll(){return[];},createElement(){return {style:{},classList:{add(){},remove(){},toggle(){}},appendChild(){},setAttribute(){}};}};}
function runFile(ctx,file){vm.runInContext(read(file),ctx,{filename:file});}
async function buildEnv({progress=null,score='',bankHash='BANK1'}={}){
  const drive=new MockDrive(),meta=memoryMeta();
  const state={catalog:{fileType:'StepExamSimulatorV75Catalog',forms:[{id:'N-11',formUid:'n-11',qidSchemaVersion:1,totalQuestions:1,bankHash,threeDigitScore:score,updatedAt:'2026-08-08T05:00:00.000Z'}]},progress:clone(progress),suspended:null,qbank:null};
  const sandbox={console,Blob,URL,URLSearchParams,Headers,TextEncoder,structuredClone,setTimeout,clearTimeout,crypto:{subtle:webcrypto.subtle,randomUUID},navigator:{onLine:true},document:makeDoc(),confirm:()=>true,prompt:()=>'',alert:()=>{},CustomEvent:function(type,o){this.type=type;this.detail=o?.detail;},requestIdleCallback:undefined};
  sandbox.window=sandbox;sandbox.window.addEventListener=()=>{};sandbox.window.dispatchEvent=()=>{};
  const ctx=vm.createContext(sandbox);runFile(ctx,'js/sync-config.js');ctx.StepProgressSync.meta=meta;runFile(ctx,'js/sync-merge.js');
  ctx.StepExamSyncBridge={
    async ensureReady(){return true;},async flushActive(){return true;},runtime(){return {examVisible:false};},
    async catalog(){return clone(state.catalog);},
    async readFormProgressText(id){return id==='N-11'&&state.progress?JSON.stringify(state.progress):null;},
    async readFormSuspendedText(id){return id==='N-11'&&state.suspended?JSON.stringify(state.suspended):null;},
    async readQbankText(){return state.qbank?JSON.stringify(state.qbank):null;},
    async writeFormProgressText(id,text,bh){assert.equal(id,'N-11');assert.equal(bh,bankHash);state.progress=JSON.parse(text);return true;},
    async writeFormSuspendedText(id,text,bh){assert.equal(id,'N-11');assert.equal(bh,bankHash);state.suspended=text==null?null:JSON.parse(text);return true;},
    async deleteFormProgress(id){assert.equal(id,'N-11');state.progress=null;return true;},
    async writeQbankText(text){state.qbank=text==null?null:JSON.parse(text);return true;},
    async setThreeDigitScore(id,v){const r=state.catalog.forms.find(x=>x.id===id);r.threeDigitScore=String(v||'');return true;},async refresh(){return true;}
  };
  runFile(ctx,'js/sync-storage.js');
  ctx.StepProgressSync.auth={initialize:async()=>{},getState:()=>({authorized:true}),validate:async()=>({emailAddress:'test@example.com'}),connect:async()=>{},disconnect:async()=>({}),driveFetch:(u,o)=>drive.fetch(u,o)};
  runFile(ctx,'js/progress-sync.js');
  await meta.set('syncEnabled',true);
  return {ctx,R:ctx.StepProgressSync,drive,meta,state,bankHash};
}
function prog(tag){return {fileType:'StepExamSimulatorV10ProgressBundle',saveVersion:'10.2',formSlot:'N-11',bundle:{updatedAt:`2026-08-08T05:0${tag}:00.000Z`,attempts:[{attemptId:'A1',session:{bankHash:'BANK1',updatedAt:`2026-08-08T05:0${tag}:00.000Z`,blocks:[{answers:[tag],flagged:[false]}]}}]}};}
async function localEntity(env){const l=await env.R.storage.localIndex({flush:false,yieldBetween:true});return l.index['n-11'];}
async function seedCloud(env,cloudProgress,version='v10'){
  env.state.progress=clone(cloudProgress);const e=await localEntity(env);const backup=env.R.storage.makeFormBackup(e,{versionId:version,updatedAt:'2026-08-08T05:00:00.000Z',deviceId:'DEV-CLOUD',contentHash:e.contentHash});const pf=env.drive.addJson(`seed-${version}.json`,backup);const key=e.key;
  env.drive.addJson(env.R.config.MANIFEST_FILE,{type:env.R.config.MANIFEST_TYPE,schemaVersion:2,appId:'exam-simulator2',updatedAt:'2026-08-08T05:00:00.000Z',forms:{[key]:{formId:'N-11',formUid:'n-11',bankHash:'BANK1',qidSchemaVersion:1,questionCount:1,currentVersionId:version,previousVersionId:null,driveFileId:pf.id,previousDriveFileId:null,checksum:e.contentHash,sizeBytes:+pf.size,updatedAt:'2026-08-08T05:00:00.000Z',deviceId:'DEV-CLOUD',deleted:false}},qbank:null});
  return {key,hash:e.contentHash,fileId:pf.id};
}
async function setMeta(env,key,patch){await env.meta.set('formSyncMetaV2',{[key]:{baseCloudVersionId:'',lastKnownCloudVersionId:'',localContentHash:'',updatedAt:'2026-08-08T05:00:00.000Z',dirty:false,deleted:false,...patch}});}
function currentEntry(env,key){return env.drive.jsonByName(env.R.config.MANIFEST_FILE)?.forms?.[key];}
function history(env){return env.drive.jsonByName(env.R.config.HISTORY_MANIFEST_FILE);}

const tests=[];function T(name,fn){tests.push([name,fn]);}
T('A. Device 1 normal flow',async()=>{const e=await buildEnv({progress:prog(0)}),seed=await seedCloud(e,prog(0));e.state.progress=prog(1);const lh=(await localEntity(e)).contentHash;await setMeta(e,seed.key,{baseCloudVersionId:'v10',lastKnownCloudVersionId:'v10',localContentHash:lh,dirty:true});await e.R.sync.backupNow({reason:'test'});const ce=currentEntry(e,seed.key),m=(await e.meta.get('formSyncMetaV2'))[seed.key];assert.notEqual(ce.currentVersionId,'v10');assert.equal(ce.previousVersionId,'v10');assert.equal(ce.previousDriveFileId,seed.fileId);assert.equal(m.baseCloudVersionId,ce.currentVersionId);assert.equal(m.dirty,false);assert.equal((await e.R.sync.analyze()).summary.rows.find(r=>r.key===seed.key).state,'ALIGNED');});
T('B. No-change',async()=>{const e=await buildEnv({progress:prog(0)}),seed=await seedCloud(e,prog(0));await setMeta(e,seed.key,{baseCloudVersionId:'v10',lastKnownCloudVersionId:'v10',localContentHash:seed.hash,dirty:false});const before=e.drive.files.size;const r=await e.R.sync.backupNow({reason:'no change'});assert.equal(r.uploaded,0);assert.equal(currentEntry(e,seed.key).currentVersionId,'v10');assert.equal(e.drive.files.size,before);});
T('C. Fresh Device 2 auto-restores after library availability',async()=>{const e=await buildEnv({progress:prog(0)}),seed=await seedCloud(e,prog(0));e.state.progress=null;e.state.catalog.forms[0].threeDigitScore='';await e.meta.set('formSyncMetaV2',{});const a=await e.R.sync.checkCloud({interactive:false,flush:false});const row=a.summary.rows.find(r=>r.key===seed.key);assert.equal(row.state,'ALIGNED');assert.deepEqual(clone(e.state.progress),prog(0));assert.equal(currentEntry(e,seed.key).currentVersionId,'v10');});
T('D. Old clean Device 3 auto-downloads the cloud head',async()=>{const e=await buildEnv({progress:prog(0)}),seed=await seedCloud(e,prog(1));e.state.progress=prog(0);await setMeta(e,seed.key,{baseCloudVersionId:'v5',lastKnownCloudVersionId:'v5',localContentHash:(await localEntity(e)).contentHash,dirty:false});assert.equal((await e.R.sync.analyze()).summary.rows.find(r=>r.key===seed.key).state,'CLOUD_AHEAD');const a=await e.R.sync.checkCloud({interactive:false});assert.equal(a.summary.rows.find(r=>r.key===seed.key).state,'ALIGNED');assert.deepEqual(clone(e.state.progress),prog(1));});
T('E. Diverged',async()=>{const e=await buildEnv({progress:prog(0)}),seed=await seedCloud(e,prog(1));e.state.progress=prog(0);await setMeta(e,seed.key,{baseCloudVersionId:'v5',lastKnownCloudVersionId:'v5',localContentHash:(await localEntity(e)).contentHash,dirty:true});assert.equal((await e.R.sync.analyze()).summary.rows.find(r=>r.key===seed.key).state,'DIVERGED');});
T('F. Keep This Device',async()=>{const e=await buildEnv({progress:prog(0)}),seed=await seedCloud(e,prog(1));e.state.progress=prog(2);await setMeta(e,seed.key,{baseCloudVersionId:'v5',lastKnownCloudVersionId:'v5',localContentHash:(await localEntity(e)).contentHash,dirty:true});await e.R.sync.checkCloud({interactive:false});await e.R.sync.keepLocal(seed.key);const ce=currentEntry(e,seed.key);assert.equal(ce.previousVersionId,'v10');assert.equal(ce.previousDriveFileId,seed.fileId);assert.equal((await e.R.sync.analyze()).summary.rows.find(r=>r.key===seed.key).state,'ALIGNED');});
T('G. Use Cloud',async()=>{const e=await buildEnv({progress:prog(0)}),seed=await seedCloud(e,prog(1));e.state.progress=prog(2);await setMeta(e,seed.key,{baseCloudVersionId:'v5',lastKnownCloudVersionId:'v5',localContentHash:(await localEntity(e)).contentHash,dirty:true});await e.R.sync.useCloud(seed.key);assert.deepEqual(clone(e.state.progress),prog(1));assert.ok((await e.R.storage.listLocalRecoveries())[seed.key]);assert.equal((await e.R.sync.analyze()).summary.rows.find(r=>r.key===seed.key).state,'ALIGNED');});
T('H. Explicit deletion',async()=>{const e=await buildEnv({progress:prog(0)}),seed=await seedCloud(e,prog(0));e.state.progress=null;e.state.catalog.forms[0].threeDigitScore='';await setMeta(e,seed.key,{baseCloudVersionId:'v10',lastKnownCloudVersionId:'v10',dirty:true,deleted:true});assert.equal((await e.R.sync.analyze()).summary.rows.find(r=>r.key===seed.key).state,'DELETED_LOCAL_SAFE');await setMeta(e,seed.key,{baseCloudVersionId:'v5',lastKnownCloudVersionId:'v5',dirty:true,deleted:true});assert.equal((await e.R.sync.analyze()).summary.rows.find(r=>r.key===seed.key).state,'DELETE_CONFLICT');});
T('I. Previous cloud recovery',async()=>{const e=await buildEnv({progress:prog(0)}),seed=await seedCloud(e,prog(0));e.state.progress=prog(2);await setMeta(e,seed.key,{baseCloudVersionId:'v10',lastKnownCloudVersionId:'v10',dirty:true});await e.R.sync.backupNow({reason:'make previous'});const afterUpload=currentEntry(e,seed.key),uploadedHash=afterUpload.checksum;await e.R.sync.restorePreviousCloud(seed.key);const ce=currentEntry(e,seed.key);assert.equal(ce.checksum,seed.hash);assert.equal(ce.previousVersionId,afterUpload.currentVersionId);assert.equal(ce.previousChecksum,uploadedHash);});
T('J. Local undo recovery',async()=>{const e=await buildEnv({progress:prog(2)}),seed=await seedCloud(e,prog(1));e.state.progress=prog(2);await setMeta(e,seed.key,{baseCloudVersionId:'v5',dirty:true});await e.R.sync.useCloud(seed.key);await e.R.sync.undoLocalRecovery(seed.key);assert.deepEqual(clone(e.state.progress),prog(2));const row=(await e.R.sync.analyze()).summary.rows.find(r=>r.key===seed.key);assert.equal(row.state,'UNTRACKED_BOTH');});
T('K. Manual snapshot create/list/restore/delete',async()=>{const e=await buildEnv({progress:prog(0)}),seed=await seedCloud(e,prog(0));await setMeta(e,seed.key,{baseCloudVersionId:'v10',lastKnownCloudVersionId:'v10',localContentHash:seed.hash});const snap=await e.R.sync.createManualSnapshot();assert.ok(snap?.id);assert.ok(history(e).snapshots.some(s=>s.id===snap.id&&s.type==='manual'));e.state.progress=prog(2);await setMeta(e,seed.key,{baseCloudVersionId:'v10',dirty:true});await e.R.sync.backupNow({reason:'advance'});assert.notEqual(currentEntry(e,seed.key).checksum,seed.hash);await e.R.sync.restoreSnapshot(snap.id);assert.equal(currentEntry(e,seed.key).checksum,seed.hash);await e.R.sync.deleteSnapshot(snap.id);assert.ok(!history(e).snapshots.some(s=>s.id===snap.id));});
T('L. Exactly one rolling daily snapshot; manual retention is separate',async()=>{const e=await buildEnv({progress:prog(0)}),seed=await seedCloud(e,prog(0));const old=[{id:'old1',type:'daily',createdAt:'2026-07-01T00:00:00.000Z',day:'2026-07-01',entities:{}},{id:'manual1',type:'manual',createdAt:'2026-07-02T00:00:00.000Z',entities:{}}];e.drive.addJson(e.R.config.HISTORY_MANIFEST_FILE,{type:e.R.config.HISTORY_MANIFEST_TYPE,schemaVersion:1,appId:'exam-simulator2',updatedAt:'2026-08-01T00:00:00.000Z',snapshots:old});e.state.progress=prog(1);await setMeta(e,seed.key,{baseCloudVersionId:'v10',dirty:true});await e.R.sync.backupNow({reason:'day first'});let h=history(e),daily=h.snapshots.filter(s=>s.type==='daily');assert.equal(daily.length,1);assert.equal(h.snapshots.filter(s=>s.type==='manual').length,1);const ce=currentEntry(e,seed.key);e.state.progress=prog(2);await setMeta(e,seed.key,{baseCloudVersionId:ce.currentVersionId,dirty:true});await e.R.sync.backupNow({reason:'same day second'});h=history(e);assert.equal(h.snapshots.filter(s=>s.type==='daily').length,1);assert.equal(h.snapshots.filter(s=>s.type==='manual').length,1);});
T('M. Progress export excludes cloud lineage',async()=>{const s=read('index.html'),a=s.slice(s.indexOf('async function collectPortableProgressMetadata'),s.indexOf('async function addDirectoryToZipRecursive')),b=s.slice(s.indexOf('async function exportProgressOnlyBackup'),s.indexOf('function splitBackupPath'));for(const forbidden of ['baseCloudVersionId','currentCloudVersionId','driveFileId','cloudWorkerSession','deviceId authority','sync dirty state'])assert.ok(!a.includes(forbidden),forbidden);assert.ok(b.includes('progress_metadata.json'));assert.ok(!b.includes('catalog_snapshot.json'));});
T('N. Progress import resets lineage',async()=>{const e=await buildEnv({progress:prog(0)});const key='n-11';await e.meta.set('syncEnabled',false);await setMeta(e,key,{baseCloudVersionId:'stale',lastKnownCloudVersionId:'stale',dirty:false});e.state.progress=prog(2);await e.R.sync.finishPortableProgressImport([key]);const m=(await e.meta.get('formSyncMetaV2'))[key];assert.equal(m.baseCloudVersionId,'');assert.equal(m.lastKnownCloudVersionId,'');assert.equal(m.dirty,true);});
T('O. Imported progress identical to cloud',async()=>{const e=await buildEnv({progress:prog(0)}),seed=await seedCloud(e,prog(0));await setMeta(e,seed.key,{baseCloudVersionId:'stale',dirty:false});await e.R.sync.finishPortableProgressImport([seed.key]);const m=(await e.meta.get('formSyncMetaV2'))[seed.key];assert.equal(m.baseCloudVersionId,'v10');assert.equal(m.dirty,false);assert.equal((await e.R.sync.analyze()).summary.rows.find(r=>r.key===seed.key).state,'ALIGNED');});
T('P. Imported progress differs from cloud',async()=>{const e=await buildEnv({progress:prog(0)}),seed=await seedCloud(e,prog(0));e.state.progress=prog(2);await setMeta(e,seed.key,{baseCloudVersionId:'stale',dirty:false});await e.R.sync.finishPortableProgressImport([seed.key]);assert.equal((await e.R.sync.analyze()).summary.rows.find(r=>r.key===seed.key).state,'UNTRACKED_BOTH');});
T('Q. Library export contains no progress and sanitizes catalog',async()=>{const s=read('index.html'),part=s.slice(s.indexOf('async function exportFullLibraryBackup'),s.indexOf('async function exportProgressOnlyBackup'));assert.ok(!part.includes("addDirectoryIfPresentToZip('progress'"));assert.ok(part.includes('sanitizeCatalogForLibraryBackup(catalog)'));const block=s.slice(s.indexOf('function sanitizeCatalogForLibraryBackup'),s.indexOf('function isPortableProgressFilename'));const c=vm.createContext({JSON,Object,catalog:{forms:[{id:'N-11',bankHash:'B',threeDigitScore:'245',progressSummary:{answered:10},displayName:'N11'}]}});vm.runInContext(block,c);const out=c.sanitizeCatalogForLibraryBackup(c.catalog);assert.ok(!('threeDigitScore'in out.forms[0]));assert.ok(!('progressSummary'in out.forms[0]));});
T('R. Legacy full backup progress is ignored',async()=>{const s=read('index.html'),part=s.slice(s.indexOf("async function importLibraryBackup(file, mode='full')"),s.indexOf('async function updateAppShellPreserveLibrary'));assert.ok(part.includes("/^(forms|assets)\\//i"));assert.ok(part.includes('legacyHasProgress'));assert.ok(part.includes('Library was restored without progress'));});
T('S. Library restore preserves matching progress-owned catalog values',async()=>{const s=read('index.html'),block=s.slice(s.indexOf('function sanitizeCatalogForLibraryBackup'),s.indexOf('function isPortableProgressFilename'));const c=vm.createContext({JSON,Object,catalog:{forms:[{id:'N-11',bankHash:'B',threeDigitScore:'245',progressSummary:{answered:10},displayName:'old'}]}});vm.runInContext(block,c);const out=c.mergeLibraryCatalogPreserveProgress({forms:[{id:'N-11',bankHash:'B',displayName:'new',threeDigitScore:'111',progressSummary:{answered:0}}]});assert.equal(out.forms[0].displayName,'new');assert.equal(out.forms[0].threeDigitScore,'245');assert.deepEqual(clone(out.forms[0].progressSummary),{answered:10});});
T('T. Full cloud library backup is library-only',async()=>{const idx=read('index.html'),lib=read('js/library-backup.js');assert.ok(idx.includes("if(path==='progress' || path.startsWith('progress/')) continue"));assert.ok(idx.includes("if(path==='catalog.json') return new Blob([JSON.stringify(sanitizeCatalogForLibraryBackup(catalog)"));assert.ok(lib.includes("catalog.json + forms + assets"));assert.ok(!lib.includes('progress/**'));});
T('U. Startup stability safeguards',async()=>{const p=read('js/progress-sync.js'),l=read('js/library-backup.js'),st=read('js/sync-storage.js');assert.ok(!p.includes('new MutationObserver'));assert.ok(!l.includes('new MutationObserver'));const boot=p.slice(p.indexOf('async function boot()'),p.indexOf('R.sync={'));assert.ok(boot.indexOf('ensureSurface()')<boot.indexOf('A.initialize()'));assert.ok(p.includes('requestIdleCallback'));assert.ok(st.includes('yieldBetween'));assert.ok(!st.slice(st.indexOf('async function readLocal'),st.indexOf('function serializeForCloud')).includes('Promise.all'));});
T('V. Worker auth callback/token/401/403/disconnect',async()=>{
  const meta=memoryMeta();let driveCalls=0,tokenCalls=0,phase='retry';
  const resp=(status,body)=>({status,ok:status>=200&&status<300,text:async()=>JSON.stringify(body||{}),json:async()=>clone(body||{})});
  const sandbox={console,URLSearchParams,Headers,TextEncoder,structuredClone,setTimeout,clearTimeout,crypto:{subtle:webcrypto.subtle,randomUUID},CustomEvent:function(){},sessionStorage:{removeItem(){}},location:{hash:'#cloud-auth=session123',pathname:'/exam-simulator2/',search:'',assign(){}},history:{state:null,replaceState(){}},fetch:async(url)=>{if(String(url).endsWith('/token')){tokenCalls++;return resp(200,{accessToken:'tok'+tokenCalls,expiresIn:3600,email:'test@example.com',appId:'exam-simulator2'});}if(String(url).endsWith('/disconnect'))return resp(200,{});if(String(url).includes('googleapis.com')){driveCalls++;if(phase==='retry'&&driveCalls===1)return resp(401,{error:{message:'expired'}});if(phase==='forbid')return resp(403,{error:{message:'forbidden'}});return resp(200,{ok:true});}throw new Error('unexpected fetch '+url);}};sandbox.window=sandbox;sandbox.window.dispatchEvent=()=>{};
  const c=vm.createContext(sandbox);runFile(c,'js/sync-config.js');c.StepProgressSync.meta=meta;runFile(c,'js/google-auth.js');await c.StepProgressSync.auth.initialize();assert.equal(await meta.get(c.StepProgressSync.config.WORKER_SESSION_META_KEY,''),'session123');await c.StepProgressSync.auth.driveFetch('https://www.googleapis.com/drive/v3/test');assert.equal(driveCalls,2);assert.equal(tokenCalls,2);phase='forbid';c.StepProgressSync.auth.clearAccessToken();await assert.rejects(()=>c.StepProgressSync.auth.driveFetch('https://www.googleapis.com/drive/v3/test403'),e=>e.status===403);assert.equal(await meta.get(c.StepProgressSync.config.WORKER_SESSION_META_KEY,''),'session123');assert.equal(c.StepProgressSync.auth.getState().authorized,true);await c.StepProgressSync.auth.disconnect();assert.equal(await meta.get(c.StepProgressSync.config.WORKER_SESSION_META_KEY,''),'');
});

T('Extra. Concurrent manifest advancement aborts staged upload',async()=>{
  const e=await buildEnv({progress:prog(0)}),seed=await seedCloud(e,prog(0));e.state.progress=prog(2);await setMeta(e,seed.key,{baseCloudVersionId:'v10',lastKnownCloudVersionId:'v10',dirty:true});
  const originalFetch=e.drive.fetch.bind(e.drive);let injected=false;
  e.R.auth.driveFetch=async(url,opts={})=>{const r=await originalFetch(url,opts);const u=new URL(url);if(!injected&&String(opts.method||'GET').toUpperCase()==='PATCH'&&u.pathname.startsWith('/upload/drive/v3/files/')){const id=decodeURIComponent(u.pathname.split('/').pop()),f=e.drive.files.get(id);if(f&&f.name!==e.R.config.MANIFEST_FILE){injected=true;const other=e.drive.addJson('other-device.json',{type:e.R.config.FORM_BACKUP_TYPE,schemaVersion:2,appId:'exam-simulator2',versionId:'v99',formId:'N-11',bankHash:'BANK1',contentHash:'OTHER',payload:{progress:prog(1),suspended:null,threeDigitScore:''}});const mf=e.drive.byName(e.R.config.MANIFEST_FILE)[0],m=JSON.parse(mf.body);m.forms[seed.key]={...m.forms[seed.key],currentVersionId:'v99',driveFileId:other.id,checksum:'OTHER',updatedAt:'2026-08-08T06:00:00.000Z'};mf.body=JSON.stringify(m);mf.size=String(Buffer.byteLength(mf.body));mf.modifiedTime=e.drive.now();}}return r;};
  await assert.rejects(()=>e.R.sync.backupNow({reason:'race'}),/changed while this device was uploading/);assert.equal(currentEntry(e,seed.key).currentVersionId,'v99');const meta=(await e.meta.get('formSyncMetaV2'))[seed.key];assert.equal(meta.baseCloudVersionId,'v10');assert.equal(meta.dirty,true);
});
T('Extra. Same-form mutation during upload sets dirtyAgain and performs one follow-up upload',async()=>{
  const e=await buildEnv({progress:prog(0)}),seed=await seedCloud(e,prog(0));e.state.progress=prog(1);await setMeta(e,seed.key,{baseCloudVersionId:'v10',lastKnownCloudVersionId:'v10',dirty:true});
  const originalFetch=e.drive.fetch.bind(e.drive);let changed=false;
  e.R.auth.driveFetch=async(url,opts={})=>{const r=await originalFetch(url,opts),u=new URL(url);if(!changed&&String(opts.method||'GET').toUpperCase()==='PATCH'&&u.pathname.startsWith('/upload/drive/v3/files/')){const id=decodeURIComponent(u.pathname.split('/').pop()),f=e.drive.files.get(id);if(f&&f.name!==e.R.config.MANIFEST_FILE){changed=true;e.state.progress=prog(2);await e.R.sync.markDirtyKey(seed.key,'changed in flight');}}return r;};
  await e.R.sync.backupNow({reason:'dirtyAgain'});assert.equal((await e.meta.get('formSyncMetaV2'))[seed.key].dirty,true);await new Promise(r=>setTimeout(r,40));const a=await e.R.sync.analyze();assert.equal(a.summary.rows.find(r=>r.key===seed.key).state,'ALIGNED');assert.equal((await e.meta.get('formSyncMetaV2'))[seed.key].dirty,false);
});
T('Extra. QID migration marker blocks ordinary cloud sync until baseline',async()=>{
  const e=await buildEnv({progress:prog(0)});await e.meta.set('qidMigrationPendingBaseline',{createdAt:'2026-08-12T00:00:00Z'});const before=e.drive.files.size;assert.equal(await e.R.sync.backupNow({reason:'must block'}),null);assert.equal(await e.R.sync.checkCloud({interactive:false}),null);assert.equal(e.drive.files.size,before);assert.equal(e.R.sync.getState().status,'Baseline Required');
});
T('Extra. Failed new daily snapshot leaves the previous automatic snapshot intact',async()=>{
  const e=await buildEnv({progress:prog(0)}),seed=await seedCloud(e,prog(0)),old={id:'daily-old',type:'daily',createdAt:'2026-07-01T00:00:00Z',day:'2026-07-01',entities:{}};e.drive.addJson(e.R.config.HISTORY_MANIFEST_FILE,{type:e.R.config.HISTORY_MANIFEST_TYPE,schemaVersion:2,appId:'exam-simulator2',snapshots:[old]});e.state.progress=prog(1);await setMeta(e,seed.key,{baseCloudVersionId:'v10',dirty:true});const fetch=e.R.auth.driveFetch;e.R.auth.driveFetch=async(url,opts={})=>{if(String(url).includes('/copy?'))throw new Error('snapshot copy failed');return fetch(url,opts);};await e.R.sync.backupNow({reason:'daily copy failure'});const h=history(e);assert.equal(h.snapshots.length,1);assert.equal(h.snapshots[0].id,'daily-old');
});
T('Extra. legacy bankHash mismatch blocks an incompatible form revision',async()=>{
  const e=await buildEnv({progress:prog(2),bankHash:'BANK2'}),key='n-11';const pf=e.drive.addJson('old-bank.json',{type:e.R.config.FORM_BACKUP_TYPE,schemaVersion:2,appId:'exam-simulator2',versionId:'oldv',formId:'N-11',bankHash:'OLD',contentHash:'OLDHASH',payload:{progress:prog(0),suspended:null,threeDigitScore:''}});e.drive.addJson(e.R.config.MANIFEST_FILE,{type:e.R.config.MANIFEST_TYPE,schemaVersion:2,appId:'exam-simulator2',forms:{[key]:{formId:'N-11',formUid:'n-11',bankHash:'OLD',qidSchemaVersion:0,currentVersionId:'oldv',driveFileId:pf.id,checksum:'OLDHASH',sizeBytes:+pf.size,updatedAt:'2026-08-01T00:00:00Z',deviceId:'OLD',deleted:false}},qbank:null});const a=await e.R.sync.analyze();assert.equal(a.summary.rows.find(r=>r.key===key).state,'BANK_HASH_MISMATCH');
});
T('Extra. Google Backup UI actions cannot strand replacement buttons disabled',async()=>{
  const src=read('js/progress-sync.js');
  assert.match(src,/async function runUiAction\(button,fn\)/);
  assert.match(src,/Unknown Google Backup action/);
  assert.match(src,/handleError\(err\)/);
  assert.doesNotMatch(src,/b\.disabled=true;action\(/);
  assert.match(src,/querySelectorAll\('#progressSyncPanel \[data-step-sync-action\]/);
});
T('Extra. Sync metadata open cannot hang indefinitely',async()=>{
  const src=read('js/sync-config.js');
  assert.match(src,/req\.onblocked=/);
  assert.match(src,/Sync metadata database did not open in time/);
  assert.match(src,/META_FALLBACK_PREFIX/);
});
T('Extra. V1 manifest migrates once and legacy decision metadata is retired',async()=>{
  const e=await buildEnv({progress:prog(0)}),ent=await localEntity(e),pf=e.drive.addJson('legacy-form.json',{type:e.R.config.FORM_BACKUP_TYPE,schemaVersion:1,appId:'exam-simulator2',backupId:'legacy10',formId:'N-11',bankHash:'BANK1',contentHash:ent.contentHash,payload:{progress:prog(0),suspended:null,threeDigitScore:''}}),legacyKey='N-11@@BANK1';e.drive.addJson(e.R.config.MANIFEST_FILE,{type:e.R.config.MANIFEST_TYPE,schemaVersion:1,appId:'exam-simulator2',entries:{[legacyKey]:{key:legacyKey,kind:'form',formId:'N-11',bankHash:'BANK1',fileId:pf.id,backupId:'legacy10',contentHash:ent.contentHash,updatedAt:'2026-08-01T00:00:00Z',deviceId:'OLD'}}});await e.meta.set('knownCloud',{[legacyKey]:{backupId:'legacy10'}});await e.meta.set('dirtyKeys',{});await e.R.sync.checkCloud({interactive:false,autoApply:false});const m=e.drive.jsonByName(e.R.config.MANIFEST_FILE);assert.equal(m.schemaVersion,2);assert.equal(m.forms['N-11'].currentVersionId,'legacy10');assert.equal(await e.meta.get('v2LegacyMetaMigrated',false),true);assert.deepEqual(await e.meta.get('knownCloud',{}),{});
});

(async()=>{let pass=0;const failures=[];for(const [name,fn] of tests){try{await fn();console.log('PASS',name);pass++;}catch(e){console.error('FAIL',name,'\n ',e.stack||e);failures.push([name,e]);}}console.log(`\n${pass}/${tests.length} tests passed.`);if(failures.length)process.exit(1);})();

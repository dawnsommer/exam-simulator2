(function(){
  'use strict';
  const ROOT = window.StepProgressSync = window.StepProgressSync || {};

  /* Production migration should require changing only this block. */
  const CLOUD_CONFIG = Object.freeze({
    appId: 'exam-simulator2',
    workerBaseUrl: 'https://study-tools-auth-worker.summerofdawn20.workers.dev',
    returnUrl: 'https://dawnsommer.github.io/exam-simulator2/',
    driveFilePrefix: 'exam-simulator2',
    callbackParam: 'cloud-auth'
  });

  const C = ROOT.config = Object.freeze({
    CLOUD: CLOUD_CONFIG,
    APP_NAME: CLOUD_CONFIG.appId,
    BUILD: 'EXAM-SIMULATOR2-PROGRESS-SYNC-V2.3.0',
    DRIVE_SCOPE: 'https://www.googleapis.com/auth/drive.appdata',
    MANIFEST_FILE: `${CLOUD_CONFIG.driveFilePrefix}.manifest.json`,
    MANIFEST_TYPE: 'exam-simulator2-progress-manifest',
    HISTORY_MANIFEST_FILE: `${CLOUD_CONFIG.driveFilePrefix}.progress-history.json`,
    HISTORY_MANIFEST_TYPE: 'exam-simulator2-progress-history',
    HISTORY_SCHEMA_VERSION: 2,
    FORM_BACKUP_TYPE: 'exam-simulator2-form-progress-backup',
    QBANK_BACKUP_TYPE: 'exam-simulator2-qbank-progress-backup',
    SCHEMA_VERSION: 2,
    LIBRARY_MANIFEST_FILE: `${CLOUD_CONFIG.driveFilePrefix}.library.manifest.json`,
    LIBRARY_MANIFEST_TYPE: 'exam-simulator2-library-manifest',
    LIBRARY_SCHEMA_VERSION: 2,
    LIBRARY_TRANSFER_DB: 'ExamSimulator2_LIBRARY_TRANSFER_DB',
    LIBRARY_TRANSFER_STORE: 'chunks',
    LIBRARY_CHUNK_SIZE: 4 * 1024 * 1024,
    META_DB: 'ExamSimulator2_SYNC_META_DB',
    META_STORE: 'kv',
    WORKER_SESSION_META_KEY: 'cloudWorkerSession',
    ACCESS_TOKEN_SKEW_MS: 60 * 1000,
    CACHE_PREFIX: 'exam-simulator2-',
    PROD_WARNING: 'Production exam-simulator2 — local-first progress with optional Google Drive backup.'
  });

  const META_FALLBACK_PREFIX='ExamSimulator2_SYNC_META_FALLBACK:';
  function fallbackGet(key,fallback=null){try{const raw=localStorage.getItem(META_FALLBACK_PREFIX+key);return raw===null?fallback:JSON.parse(raw);}catch(_e){return fallback;}}
  function fallbackSet(key,val){try{localStorage.setItem(META_FALLBACK_PREFIX+key,JSON.stringify(val));}catch(_e){}return val;}
  function fallbackDel(key){try{localStorage.removeItem(META_FALLBACK_PREFIX+key);}catch(_e){}}
  function openDb(){
    return new Promise((resolve,reject)=>{
      if(!('indexedDB' in window)){reject(new Error('IndexedDB is unavailable for sync metadata.'));return;}
      let done=false;const finish=(fn,v)=>{if(done)return;done=true;clearTimeout(timer);fn(v);};
      const timer=setTimeout(()=>finish(reject,new Error('Sync metadata database did not open in time.')),3000);
      let req;try{req=indexedDB.open(C.META_DB,1);}catch(e){finish(reject,e);return;}
      req.onupgradeneeded=()=>{ if(!req.result.objectStoreNames.contains(C.META_STORE)) req.result.createObjectStore(C.META_STORE); };
      req.onsuccess=()=>finish(resolve,req.result);
      req.onerror=()=>finish(reject,req.error || new Error('Could not open sync metadata database.'));
      req.onblocked=()=>finish(reject,new Error('Sync metadata database is blocked by another open app tab. Close other exam-simulator2 tabs and try again.'));
    });
  }
  async function withDb(op,fallbackOp){try{return await op(await openDb());}catch(e){console.warn('Sync metadata IndexedDB unavailable; using local fallback for this device.',e);return fallbackOp();}}
  ROOT.meta={
    async get(key,fallback=null){return withDb(async db=>{try{return await new Promise((res,rej)=>{const tx=db.transaction(C.META_STORE,'readonly');const r=tx.objectStore(C.META_STORE).get(key);r.onsuccess=()=>res(r.result===undefined?fallback:r.result);r.onerror=()=>rej(r.error);tx.onabort=()=>rej(tx.error||new Error('Sync metadata read aborted.'));});}finally{db.close();}},()=>fallbackGet(key,fallback));},
    async set(key,val){return withDb(async db=>{try{await new Promise((res,rej)=>{const tx=db.transaction(C.META_STORE,'readwrite');tx.objectStore(C.META_STORE).put(val,key);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);tx.onabort=()=>rej(tx.error||new Error('Sync metadata write aborted.'));});return val;}finally{db.close();}},()=>fallbackSet(key,val));},
    async del(key){return withDb(async db=>{try{await new Promise((res,rej)=>{const tx=db.transaction(C.META_STORE,'readwrite');tx.objectStore(C.META_STORE).delete(key);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);tx.onabort=()=>rej(tx.error||new Error('Sync metadata delete aborted.'));});}finally{db.close();}},()=>fallbackDel(key));},
    async deviceId(){let id=await this.get('deviceId','');if(!id){id=(crypto.randomUUID?crypto.randomUUID():('dev_'+Date.now()+'_'+Math.random().toString(36).slice(2)));await this.set('deviceId',id);}return id;}
  };
  ROOT.util={
    clone(v){try{return structuredClone(v);}catch(e){try{return JSON.parse(JSON.stringify(v));}catch(_e){return v;}}},
    iso(){return new Date().toISOString();},
    parseJson(text,label='JSON'){try{return JSON.parse(text);}catch(e){throw new Error(`${label} is malformed JSON: ${e.message}`);}},
    async sha256Text(text){const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(text)));return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');},
    stable(v){const seen=new WeakSet();const sort=x=>{if(Array.isArray(x))return x.map(sort);if(x&&typeof x==='object'){if(seen.has(x))return '[Circular]';seen.add(x);const o={};Object.keys(x).sort().forEach(k=>{if(x[k]!==undefined)o[k]=sort(x[k]);});return o;}return x;};return JSON.stringify(sort(v));},
    validDate(v){const n=Date.parse(v||'');return Number.isFinite(n)?n:0;},
    safeName(v){return String(v||'FORM').replace(/[^a-z0-9._-]+/gi,'_').replace(/^_+|_+$/g,'').slice(0,80)||'FORM';},
    uuid(){return crypto.randomUUID?crypto.randomUUID():('id_'+Date.now()+'_'+Math.random().toString(36).slice(2));}
  };
  window.EXAM_SIMULATOR_BUILD=C.BUILD;
  window.STEP_SIMULATOR_PROGRESS_BUILD=C.BUILD;
})();

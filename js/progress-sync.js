(function(){
  'use strict';
  const R=window.StepProgressSync,C=R.config,U=R.util,S=R.storage,A=R.auth,B=R.backupModel,V=R.syncV2Model,CLASS=V.CLASS;
  const V2_STATE_KEY='progressSyncV2Entities';
  const V2_ENGINE_KEY='progressSyncEngineVersion';
  const DAILY_ENABLED_KEY='progressDailySnapshotsEnabled';
  const LOCAL_RECOVERY_LABEL='preBackupRecoverySnapshot';
  let running=null, checkpointTimer=null, cloudState={manifest:null,file:null,files:[]}, historyState={history:null,file:null,files:[]};
  let decisionRows=[], decisionExpected={};
  let uiState={status:'Disconnected',detail:'Progress is stored locally on this device.',lastBackup:'',lastError:'',account:'',summary:null,history:null};

  const emit=()=>{try{window.dispatchEvent(new CustomEvent('stepsync:state',{detail:{...uiState}}));}catch(_e){} renderUi();};
  function setStatus(status,detail='',extra={}){uiState={...uiState,status,detail,...extra};emit();}
  const clone=v=>U.clone(v);
  const escHtml=v=>String(v==null?'':v).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const short=v=>String(v||'').slice(0,12)||'—';
  const fmtDate=v=>{const n=Date.parse(v||'');return Number.isFinite(n)?new Date(n).toLocaleString():'—';};
  const localDay=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const getStates=async()=>await R.meta.get(V2_STATE_KEY,{})||{};
  const setStates=v=>R.meta.set(V2_STATE_KEY,v||{});
  async function patchState(key,patch){const m=await getStates();m[key]={...(m[key]||{}),...patch};await setStates(m);return m[key];}
  async function removeState(key){const m=await getStates();delete m[key];await setStates(m);}

  function connected(){return !!A.getState().authorized;}
  function tone(){const s=uiState.status;if(/Backed up|Synced/i.test(s))return'good';if(/decision|newer|restore available|pending/i.test(s))return'warn';if(/failed|error/i.test(s))return'bad';if(/Backing|Checking|Restoring|Connecting|Creating|Resolving/i.test(s))return'busy';return'';}

  function escapeQ(s){return String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'");}
  async function listByName(name){
    const q=`name = '${escapeQ(name)}' and trashed = false`,params=new URLSearchParams({spaces:'appDataFolder',q,fields:'files(id,name,modifiedTime,size)',orderBy:'modifiedTime desc',pageSize:'50'});
    const r=await A.driveFetch('https://www.googleapis.com/drive/v3/files?'+params.toString());const d=await r.json();return Array.isArray(d.files)?d.files:[];
  }
  async function downloadJson(id,label){const r=await A.driveFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`);return U.parseJson(await r.text(),label);}
  async function createFile(name,mimeType='application/json'){
    const r=await A.driveFetch('https://www.googleapis.com/drive/v3/files?fields=id,name,modifiedTime,size',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,parents:['appDataFolder'],mimeType})});return await r.json();
  }
  async function uploadJson(id,obj){const body=JSON.stringify(obj);const r=await A.driveFetch(`https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(id)}?uploadType=media&fields=id,name,modifiedTime,size`,{method:'PATCH',headers:{'Content-Type':'application/json'},body});return {...await r.json(),_bytes:new Blob([body]).size};}
  async function createJson(name,obj){let f=null;try{f=await createFile(name);const up=await uploadJson(f.id,obj);return {...f,...up};}catch(e){if(f?.id)try{await deleteDriveFile(f.id);}catch(_e){}throw e;}}
  async function copyDriveFile(fileId,name){
    const r=await A.driveFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/copy?fields=id,name,modifiedTime,size`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,parents:['appDataFolder']})});return await r.json();
  }
  async function deleteDriveFile(id){if(!id)return;await A.driveFetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}`,{method:'DELETE',acceptStatuses:[404]});}
  async function removeDuplicateFiles(files,keep){for(const f of files||[]){if(f.id===keep)continue;try{await deleteDriveFile(f.id);}catch(e){console.warn('Could not remove duplicate metadata file',e);}}}

  function emptyManifest(deviceId=''){return {type:C.MANIFEST_TYPE,schemaVersion:C.MANIFEST_SCHEMA_VERSION||2,syncModel:C.PROGRESS_SYNC_MODEL||'lineage-v2',appId:C.CLOUD.appId,updatedAt:U.iso(),build:C.BUILD,lastWriterDeviceId:deviceId,entries:{}};}
  function legacyCurrent(e,key=''){if(!e)return null;return {versionId:String(e.backupId||(`legacy-${e.fileId||e.contentHash||key||'entry'}`)),parentVersionId:'',revision:Number(e.revision||1),fileId:e.fileId||'',fileName:e.fileName||'',contentHash:e.contentHash||e.checksum||'',updatedAt:e.updatedAt||'',deviceId:e.deviceId||'',sizeBytes:Number(e.sizeBytes||e.size||0),deletedAt:e.deletedAt||null};}
  function normalizeEntry(key,e){
    if(!e)return null;
    if(e.current)return {key,kind:e.kind||'form',formId:e.formId||'',bankHash:e.bankHash||'',current:{...e.current},previous:e.previous?{...e.previous}:null};
    return {key,kind:e.kind||'form',formId:e.formId||'',bankHash:e.bankHash||'',current:legacyCurrent(e,key),previous:null};
  }
  function normalizeManifest(m){
    if(!m)return null;if(typeof m!=='object'||m.type!==C.MANIFEST_TYPE)throw new Error('Cloud progress manifest is invalid.');if(m.appId&&m.appId!==C.CLOUD.appId)throw new Error('Cloud progress manifest belongs to a different application.');
    const version=Number(m.schemaVersion||1);if(version!==1&&version!==(C.MANIFEST_SCHEMA_VERSION||2))throw new Error(`Unsupported cloud progress manifest schema ${version}.`);
    const out={...m,schemaVersion:C.MANIFEST_SCHEMA_VERSION||2,syncModel:C.PROGRESS_SYNC_MODEL||'lineage-v2',appId:C.CLOUD.appId,entries:{}};
    for(const [key,e] of Object.entries(m.entries||{})){const n=normalizeEntry(key,e);if(n)out.entries[key]=n;}
    return out;
  }
  async function readManifest(){
    const files=await listByName(C.MANIFEST_FILE);if(!files.length){cloudState={manifest:null,file:null,files:[]};return cloudState;}
    let last=null;for(const file of files){try{const manifest=normalizeManifest(await downloadJson(file.id,'Google Drive progress manifest'));cloudState={manifest,file,files};return cloudState;}catch(e){last=e;console.warn('Ignoring invalid progress manifest candidate',file.id,e);}}
    throw last||new Error('No valid cloud progress manifest was found.');
  }
  async function writeManifest(manifest){
    manifest={...manifest,schemaVersion:C.MANIFEST_SCHEMA_VERSION||2,syncModel:C.PROGRESS_SYNC_MODEL||'lineage-v2',updatedAt:U.iso(),build:C.BUILD,appId:C.CLOUD.appId,lastWriterDeviceId:await R.meta.deviceId()};
    let file=cloudState.file;if(!file)file=await createFile(C.MANIFEST_FILE);const up=await uploadJson(file.id,manifest);await removeDuplicateFiles(cloudState.files||[],file.id);cloudState={manifest,file:{...file,...up},files:[{...file,...up}]};return cloudState;
  }

  function emptyHistory(){return {type:C.HISTORY_TYPE,schemaVersion:C.HISTORY_SCHEMA_VERSION||1,appId:C.CLOUD.appId,updatedAt:U.iso(),build:C.BUILD,snapshots:[]};}
  function normalizeHistory(h){if(!h)return emptyHistory();if(h.type!==C.HISTORY_TYPE)throw new Error('Progress history manifest is invalid.');if(Number(h.schemaVersion)!==(C.HISTORY_SCHEMA_VERSION||1))throw new Error('Unsupported progress history schema.');if(h.appId&&h.appId!==C.CLOUD.appId)throw new Error('Progress history belongs to a different application.');h.snapshots=Array.isArray(h.snapshots)?h.snapshots:[];return h;}
  async function readHistory(){const files=await listByName(C.HISTORY_FILE);if(!files.length){historyState={history:emptyHistory(),file:null,files:[]};return historyState;}let last=null;for(const file of files){try{const history=normalizeHistory(await downloadJson(file.id,'Progress history manifest'));historyState={history,file,files};return historyState;}catch(e){last=e;}}throw last||new Error('No valid progress history manifest was found.');}
  async function writeHistory(history){history={...history,type:C.HISTORY_TYPE,schemaVersion:C.HISTORY_SCHEMA_VERSION||1,appId:C.CLOUD.appId,updatedAt:U.iso(),build:C.BUILD};let file=historyState.file;if(!file)file=await createFile(C.HISTORY_FILE);const up=await uploadJson(file.id,history);await removeDuplicateFiles(historyState.files||[],file.id);historyState={history,file:{...file,...up},files:[{...file,...up}]};uiState.history=history;return historyState;}

  function fileNameFor(entity,versionId){if(entity.kind==='qbank')return `${C.CLOUD.driveFilePrefix}.qbank.${versionId}.json`;return `${C.CLOUD.driveFilePrefix}.form.${U.safeName(entity.formId)}.${U.safeName(String(entity.bankHash||'').slice(0,12))}.${versionId}.json`;}
  function snapshotFileName(snapshotId,key){return `${C.CLOUD.driveFilePrefix}.snapshot.${snapshotId}.${U.safeName(key)}.json`;}
  function currentOf(entry){return entry?.current||null;}
  function remoteIdentity(entry){return {kind:entry.kind,formId:entry.formId||'',bankHash:entry.bankHash||''};}
  function storageEntry(entry,version){return {...remoteIdentity(entry),key:entry.key,current:version};}

  async function keyForProgressFilename(name,detail={}){
    if(/^QBANK_MODE_progress\.json$/i.test(name))return B.qbankKey;
    if(detail?.formId)return B.entityKey(detail.formId,detail.bankHash||'');
    const m=String(name||'').match(/^(.+?)_(?:progress_save|suspended_test)\.json$/i);if(!m)return'';
    try{const cat=await window.StepExamSyncBridge.catalog(),rec=(cat.forms||[]).find(x=>String(x.id)===m[1]);return rec?B.entityKey(rec.id,rec.bankHash):'';}catch(_e){return'';}
  }
  async function recordProgressMutation(detail){
    if(window.__STEP_SYNC_APPLYING_REMOTE||window.__STEP_LOCAL_PROGRESS_IMPORTING)return;const key=await keyForProgressFilename(detail?.filename,detail);if(!key)return;const op=String(detail?.operation||'changed');
    await patchState(key,{localUpdatedAt:U.iso(),lastMutationReason:`${detail?.filename||'progress'} ${op}`,explicitDeleted:op==='delete',deleteAt:op==='delete'?U.iso():null});
    const enabled=await R.meta.get('syncEnabled',false);
    if(enabled)setStatus(navigator.onLine===false?'Offline — saved locally':'Local backup pending',op==='delete'?'Local deletion recorded. It will only reach cloud if this device still descends from the current cloud version.':'Progress changed locally. It will remain local until a backup checkpoint.');
    else setStatus('Disconnected','Progress changed locally. Google backup is disconnected on this device.');
  }
  async function markImportedProgressBranch(detail={}){
    const local=await S.localIndex({flush:false}),states=await getStates(),keys=new Set();
    for(const f of (Array.isArray(detail.forms)?detail.forms:[])){
      const key=B.entityKey(String(f?.formId||''),String(f?.bankHash||'')); if(local.index[key])keys.add(key);
    }
    if(detail.qbank&&local.index[B.qbankKey])keys.add(B.qbankKey);
    for(const key of keys){
      states[key]={...(states[key]||{}),baseCloudVersionId:'',baseContentHash:'',lastSyncedAt:'',localUpdatedAt:U.iso(),explicitDeleted:false,deleteAt:null,forceDecision:false,lastMutationReason:`Imported local progress (${detail.source||'local backup'})`};
    }
    if(keys.size)await setStates(states);
    const enabled=await R.meta.get('syncEnabled',false);
    if(keys.size)setStatus(enabled?'Imported progress — cloud check required':'Disconnected',enabled?`${keys.size} imported progress item${keys.size===1?'':'s'} ${keys.size===1?'is':'are'} now a new local branch. V2 will compare content/version lineage before any cloud overwrite.`:'Imported progress is stored locally. Google backup is disconnected on this device.');
    return [...keys];
  }
  function scheduleCheckpoint(reason,delay=1800){clearTimeout(checkpointTimer);checkpointTimer=setTimeout(()=>syncCheckpoint(reason).catch(()=>{}),delay);}

  function rowLabel(row){if(row.remote?.kind==='qbank'||row.local?.kind==='qbank'||row.key===B.qbankKey)return'Qbank';return row.local?.formId||row.remote?.formId||row.key.split('@@')[0];}
  function matchingInfo(local,manifest){const forms=Array.isArray(local.catalog?.forms)?local.catalog.forms:[],byId=new Map(forms.map(r=>[String(r.id),r]));return entry=>{if(entry?.kind!=='form')return {matching:true,different:false};const rec=byId.get(String(entry.formId||''));if(!rec)return {matching:false,different:false};const matching=String(rec.bankHash||'')===String(entry.bankHash||'');return {matching,different:!matching};};}

  async function analyze({flush=false,adoptAligned=true}={}){
    const local=await S.localIndex({flush}),cs=await readManifest(),manifest=cs.manifest||emptyManifest(local.deviceId),states=await getStates(),match=matchingInfo(local,manifest);
    const keys=new Set([...Object.keys(local.index),...Object.keys(manifest.entries||{}),...Object.keys(states)]),rows=[];
    const counts={aligned:0,localSafe:0,cloudAhead:0,cloudOnly:0,diverged:0,deleteConflict:0,retained:0,bankMismatch:0};
    let changedStates=false;
    for(const key of [...keys].sort()){
      const l=local.index[key]||null,r=manifest.entries[key]||null,st=states[key]||{},mi=match(r);
      const state=V.classify({local:l,remote:r,state:st,matchingFormLoaded:mi.matching,differentVersionLoaded:mi.different});
      const current=currentOf(r);
      if(state===CLASS.ALIGNED){counts.aligned++;if(adoptAligned&&current){const next={...st,baseCloudVersionId:String(current.versionId||''),baseContentHash:String(current.contentHash||''),lastSyncedAt:current.updatedAt||U.iso(),explicitDeleted:false,deleteAt:null,forceDecision:false};states[key]=next;changedStates=true;}}
      else if(state===CLASS.LOCAL_AHEAD_SAFE||state===CLASS.LOCAL_ONLY_SAFE||state===CLASS.DELETED_LOCAL_SAFE)counts.localSafe++;
      else if(state===CLASS.CLOUD_AHEAD)counts.cloudAhead++;
      else if(state===CLASS.CLOUD_ONLY)counts.cloudOnly++;
      else if(state===CLASS.DELETE_CONFLICT)counts.deleteConflict++;
      else if(state===CLASS.BANK_HASH_MISMATCH)counts.bankMismatch++;
      else if(state===CLASS.CLOUD_RETAINED_UNLOADED)counts.retained++;
      else counts.diverged++;
      rows.push({key,local:l,remote:r,stateMeta:st,state,current,matchingFormLoaded:mi.matching,differentVersionLoaded:mi.different,label:rowLabel({key,local:l,remote:r})});
    }
    if(changedStates)await setStates(states);
    const activeDecision=rows.filter(isDecisionRow),summary={localCount:Object.keys(local.index).length,cloudCount:Object.values(manifest.entries||{}).filter(e=>e?.current&&!e.current.deletedAt).length,...counts,decisionCount:activeDecision.length,previousRecoveryCount:Object.values(manifest.entries||{}).filter(e=>e?.previous).length,manifestUpdatedAt:manifest.updatedAt||'',rows};
    return {local,manifest,states,rows,summary};
  }
  function isDecisionRow(row){return [CLASS.CLOUD_AHEAD,CLASS.CLOUD_ONLY,CLASS.DIVERGED,CLASS.UNTRACKED_BOTH,CLASS.DELETE_CONFLICT,CLASS.CLOUD_MISSING_CHANGED].includes(row.state);}
  function canKeepLocal(row){return !!row.local||row.stateMeta?.explicitDeleted===true;}
  function canUseCloud(row){return !!row.current;}
  function safeUploadRows(a){return a.rows.filter(r=>[CLASS.LOCAL_AHEAD_SAFE,CLASS.LOCAL_ONLY_SAFE,CLASS.DELETED_LOCAL_SAFE].includes(r.state));}
  function rememberDecision(rows){decisionRows=rows.map(r=>({key:r.key,state:r.state,label:r.label,canKeepLocal:canKeepLocal(r),canUseCloud:canUseCloud(r)}));decisionExpected={};for(const row of rows)decisionExpected[row.key]=String(row.current?.versionId||'');}
  function clearDecision(){decisionRows=[];decisionExpected={};}

  function setAnalysisStatus(a){
    uiState.summary=a.summary;const d=a.rows.filter(isDecisionRow);
    if(d.length){rememberDecision(d);const onlyCloud=d.every(r=>r.state===CLASS.CLOUD_ONLY&&!canKeepLocal(r));setStatus(onlyCloud?'Cloud restore available':'Backup decision required',onlyCloud?`${d.length} cloud progress backup${d.length===1?' is':'s are'} available for forms that have no local progress on this device.`:`${d.length} progress item${d.length===1?'':'s'} cannot be synchronized automatically because this device and cloud no longer share the same current version.`,{summary:a.summary});return;}
    clearDecision();if(a.summary.localSafe)setStatus('Local backup pending',`${a.summary.localSafe} local progress item${a.summary.localSafe===1?' is':'s are'} safely ahead of its known cloud base and can be backed up automatically.`,{summary:a.summary});
    else setStatus('Backed up',a.summary.retained||a.summary.bankMismatch?'Active progress is aligned. Older/unloaded form-version backups are retained as recovery data and do not block sync.':'Local progress and current cloud versions are aligned.',{summary:a.summary});
  }

  async function ensureCloudSession({interactive=false}={}){await A.initialize();if(A.getState().authorized)return true;if(interactive){setStatus('Connecting…','Redirecting to Google authorization through the shared authentication Worker…');await A.connect();return false;}setStatus('Reconnect Google','The Worker session is unavailable on this device. Local progress is safe.');return false;}
  async function validateAccount(){const acct=await A.validate();uiState.account=acct.emailAddress||acct.email||'';return acct;}

  function versionMeta(entity,oldCurrent,uploaded,versionId){return {versionId,parentVersionId:String(oldCurrent?.versionId||''),revision:Number(oldCurrent?.revision||0)+1,fileId:uploaded?.id||'',fileName:uploaded?.name||'',contentHash:entity?.contentHash||'',updatedAt:uploaded?.modifiedTime||U.iso(),deviceId:'',sizeBytes:Number(uploaded?.size||uploaded?._bytes||0),deletedAt:null};}
  function tombstoneMeta(oldCurrent,versionId,deviceId){return {versionId,parentVersionId:String(oldCurrent?.versionId||''),revision:Number(oldCurrent?.revision||0)+1,fileId:'',fileName:'',contentHash:'',updatedAt:U.iso(),deviceId,sizeBytes:0,deletedAt:U.iso()};}

  async function prepareEntityUpload(row,draft,newFiles,cleanup){
    const oldEntry=draft.entries[row.key]||row.remote||null,oldCurrent=currentOf(oldEntry),oldPrevious=oldEntry?.previous||null,entity=row.local,versionId=U.uuid(),deviceId=await R.meta.deviceId();
    if(!entity)throw new Error(`No local progress exists for ${row.label}.`);
    if(oldCurrent&&!oldCurrent.deletedAt&&oldCurrent.contentHash&&oldCurrent.contentHash===entity.contentHash)return {key:row.key,unchanged:true,current:oldCurrent,entity};
    const meta={backupId:versionId,revision:Number(oldCurrent?.revision||0)+1,updatedAt:U.iso(),deviceId,contentHash:entity.contentHash};
    const backup=entity.kind==='qbank'?S.makeQbankBackup(entity,meta):S.makeFormBackup(entity,meta);backup.syncModel=C.PROGRESS_SYNC_MODEL;backup.versionId=versionId;backup.parentVersionId=String(oldCurrent?.versionId||'');
    const up=await createJson(fileNameFor(entity,versionId),backup);newFiles.push(up.id);
    const current=versionMeta(entity,oldCurrent,up,versionId);current.deviceId=deviceId;
    draft.entries[row.key]={key:row.key,kind:entity.kind,formId:entity.formId||'',bankHash:entity.bankHash||'',current,previous:oldCurrent?clone(oldCurrent):null};
    if(oldPrevious?.fileId&&oldPrevious.fileId!==oldCurrent?.fileId)cleanup.push(oldPrevious.fileId);
    return {key:row.key,uploaded:true,current,entity};
  }
  async function prepareDeletion(row,draft,cleanup){
    const oldEntry=draft.entries[row.key]||row.remote||null,oldCurrent=currentOf(oldEntry),oldPrevious=oldEntry?.previous||null;
    if(!oldCurrent)return {key:row.key,noRemote:true,current:null};
    if(oldCurrent.deletedAt)return {key:row.key,unchanged:true,current:oldCurrent};
    const current=tombstoneMeta(oldCurrent,U.uuid(),await R.meta.deviceId());draft.entries[row.key]={key:row.key,kind:oldEntry.kind,formId:oldEntry.formId||'',bankHash:oldEntry.bankHash||'',current,previous:clone(oldCurrent)};
    if(oldPrevious?.fileId&&oldPrevious.fileId!==oldCurrent?.fileId)cleanup.push(oldPrevious.fileId);
    return {key:row.key,deleted:true,current};
  }

  async function commitRows(rows,{expectedVersions=null,force=false}={}){
    if(!rows.length)return {done:[],changed:false};
    const fresh=await analyze({flush:true,adoptAligned:true}),freshByKey=new Map(fresh.rows.map(r=>[r.key,r]));
    const selected=[];
    for(const requested of rows){const row=freshByKey.get(requested.key);if(!row)continue;const expected=expectedVersions?String(expectedVersions[row.key]??''):null,current=String(row.current?.versionId||'');if(expected!==null&&expected!==current)throw new Error(`${row.label} changed in Google Drive after the decision was shown. Recheck before overwriting.`);selected.push(row);}
    const draft=clone(fresh.manifest),newFiles=[],cleanup=[],done=[];
    try{
      for(const row of selected){
        if(row.stateMeta?.explicitDeleted===true&&!row.local)done.push(await prepareDeletion(row,draft,cleanup));
        else if(row.local)done.push(await prepareEntityUpload(row,draft,newFiles,cleanup));
      }
      const changed=done.some(x=>x.uploaded||x.deleted);
      if(changed)await writeManifest(draft);
      const states=await getStates();
      for(const x of done){
        if(x.noRemote){delete states[x.key];continue;}
        const current=x.current||draft.entries[x.key]?.current;if(!current)continue;
        states[x.key]={...(states[x.key]||{}),baseCloudVersionId:String(current.versionId||''),baseContentHash:String(current.contentHash||''),lastSyncedAt:current.updatedAt||U.iso(),localUpdatedAt:states[x.key]?.localUpdatedAt||U.iso(),explicitDeleted:false,deleteAt:null,forceDecision:false,lastMutationReason:''};
      }
      await setStates(states);if(changed){const t=cloudState.manifest?.updatedAt||U.iso();await R.meta.set('lastBackupAt',t);uiState.lastBackup=t;}
      for(const id of cleanup)try{await deleteDriveFile(id);}catch(e){console.warn('Could not prune superseded previous recovery file',e);}
      return {done,changed};
    }catch(e){for(const id of newFiles)try{await deleteDriveFile(id);}catch(_e){}throw e;}
  }

  async function syncCheckpoint(reason='Checkpoint'){
    if(running)return running;running=(async()=>{
      const enabled=await R.meta.get('syncEnabled',false);if(!enabled)return null;if(navigator.onLine===false){setStatus('Offline — saved locally','Local progress is safe. Cloud backup will be reconsidered when online.');return null;}if(!(await ensureCloudSession({interactive:false})))return null;await validateAccount();
      setStatus('Checking cloud…',`${reason}: checking version lineage before any upload.`);let a=await analyze({flush:true});const safe=safeUploadRows(a);
      if(safe.length){setStatus('Backing up…',`${reason}: ${safe.length} safely descended progress item${safe.length===1?'':'s'} → Google Drive.`);await commitRows(safe);a=await analyze({flush:false});}
      setAnalysisStatus(a);if(!a.rows.some(isDecisionRow)&&!a.summary.localSafe)ensureDailySnapshot().catch(e=>console.warn('Daily snapshot skipped',e));return a;
    })().catch(handleError).finally(()=>{running=null;});return running;
  }

  async function manualBackup(){
    if(running)return running;running=(async()=>{
      if(!(await ensureCloudSession({interactive:true})))return null;await validateAccount();setStatus('Checking cloud…','Back Up Now first checks current cloud version IDs. Nothing is uploaded until that check is complete.');
      let a=await analyze({flush:true});const decisions=a.rows.filter(isDecisionRow);if(decisions.length){rememberDecision(decisions);setAnalysisStatus(a);return {requiresDecision:true};}
      const safe=safeUploadRows(a);if(safe.length){setStatus('Backing up…',`Uploading ${safe.length} safely ahead progress item${safe.length===1?'':'s'}…`);await commitRows(safe);a=await analyze({flush:false});}
      setAnalysisStatus(a);if(!a.rows.some(isDecisionRow)&&!a.summary.localSafe)ensureDailySnapshot().catch(e=>console.warn('Daily snapshot skipped',e));return a;
    })().catch(handleError).finally(()=>{running=null;});return running;
  }

  async function resolveKeepLocal(){
    if(!decisionRows.length){const a=await analyze({flush:true});rememberDecision(a.rows.filter(isDecisionRow));}
    const keys=new Set(decisionRows.filter(x=>x.canKeepLocal).map(x=>x.key));if(!keys.size)throw new Error('The current decision contains no local progress that can safely be chosen as the source.');
    const a=await analyze({flush:true}),rows=a.rows.filter(r=>keys.has(r.key));setStatus('Resolving conflict…',`Keeping this device for ${rows.length} progress item${rows.length===1?'':'s'} and preserving the previous cloud copy as one-step recovery.`);
    await commitRows(rows,{expectedVersions:decisionExpected,force:true});const after=await analyze({flush:false});setAnalysisStatus(after);return after;
  }

  async function saveLocalRecovery(){await S.checkpoint();return true;}
  async function applyRemoteRows(rows,{expectedVersions=null}={}){
    if(!rows.length)return;await saveLocalRecovery();const fresh=await analyze({flush:true}),byKey=new Map(fresh.rows.map(r=>[r.key,r]));const states=await getStates();window.__STEP_SYNC_APPLYING_REMOTE=true;
    try{
      for(const req of rows){const row=byKey.get(req.key);if(!row?.current)continue;const exp=expectedVersions?String(expectedVersions[row.key]??''):null,cur=String(row.current.versionId||'');if(exp!==null&&exp!==cur)throw new Error(`${row.label} changed in Google Drive after the decision screen opened. Recheck before restoring.`);
        if(row.current.deletedAt)await S.applyDeletion(storageEntry(row.remote,row.current));else{const backup=await downloadJson(row.current.fileId,`${row.label} cloud progress`);await S.applyBackup(storageEntry(row.remote,row.current),backup);}states[row.key]={...(states[row.key]||{}),baseCloudVersionId:cur,baseContentHash:String(row.current.contentHash||''),lastSyncedAt:row.current.updatedAt||U.iso(),localUpdatedAt:U.iso(),explicitDeleted:false,deleteAt:null,forceDecision:false,lastMutationReason:''};}
      await setStates(states);
    }finally{window.__STEP_SYNC_APPLYING_REMOTE=false;}
    await window.StepExamSyncBridge?.refresh?.();
  }
  async function resolveUseCloud(){
    if(!decisionRows.length){const a=await analyze({flush:true});rememberDecision(a.rows.filter(isDecisionRow));}
    const keys=new Set(decisionRows.filter(x=>x.canUseCloud).map(x=>x.key));if(!keys.size)throw new Error('There is no cloud copy available for the current decision.');
    const a=await analyze({flush:true}),rows=a.rows.filter(r=>keys.has(r.key));setStatus('Resolving conflict…',`Restoring ${rows.length} cloud progress item${rows.length===1?'':'s'} to this device. The current local progress is being saved as the one-step recovery point first.`);await applyRemoteRows(rows,{expectedVersions:decisionExpected});const after=await analyze({flush:false});setAnalysisStatus(after);return after;
  }

  async function restoreCurrentCloud(){
    const rt=window.StepExamSyncBridge?.runtime?.();if(rt?.examVisible)throw new Error('Leave the active exam before restoring cloud progress.');if(!(await ensureCloudSession({interactive:true})))return;await validateAccount();const a=await analyze({flush:true});
    const rows=a.rows.filter(r=>r.current&&r.matchingFormLoaded!==false);if(!rows.length)throw new Error('No cloud progress matches forms currently loaded on this device.');
    if(!confirm(`Restore ${rows.length} current cloud progress item${rows.length===1?'':'s'} to this device? A complete local progress recovery point will be saved first. Local-only progress without a cloud counterpart will be left untouched.`))return;
    setStatus('Restoring from cloud…','Saving local recovery point, then restoring current Google Drive progress.');await applyRemoteRows(rows);const after=await analyze({flush:false});setAnalysisStatus(after);return after;
  }

  async function restorePreviousCloud(key){
    const rt=window.StepExamSyncBridge?.runtime?.();if(rt?.examVisible)throw new Error('Leave the active exam before restoring recovery progress.');if(!(await ensureCloudSession({interactive:true})))return;const a=await analyze({flush:true}),row=a.rows.find(r=>r.key===key),prev=row?.remote?.previous;if(!row||!prev)throw new Error('Previous cloud recovery is no longer available.');
    if(!confirm(`Restore the previous cloud copy for ${row.label} from ${fmtDate(prev.updatedAt)}? Current local progress will be saved as the local recovery point first.`))return;
    await saveLocalRecovery();window.__STEP_SYNC_APPLYING_REMOTE=true;try{if(prev.deletedAt)await S.applyDeletion(storageEntry(row.remote,prev));else{const b=await downloadJson(prev.fileId,`${row.label} previous cloud recovery`);await S.applyBackup(storageEntry(row.remote,prev),b);}}finally{window.__STEP_SYNC_APPLYING_REMOTE=false;}
    await patchState(key,{baseCloudVersionId:String(prev.versionId||''),baseContentHash:String(prev.contentHash||''),lastSyncedAt:prev.updatedAt||'',localUpdatedAt:U.iso(),explicitDeleted:!!prev.deletedAt,forceDecision:true,lastMutationReason:'Previous cloud recovery restored locally'});await window.StepExamSyncBridge?.refresh?.();const after=await analyze({flush:false});setAnalysisStatus(after);
  }
  async function deletePreviousCloud(key){
    if(!(await ensureCloudSession({interactive:true})))return;const cs=await readManifest(),m=cs.manifest||emptyManifest(),e=m.entries[key],prev=e?.previous;if(!prev)return;if(!confirm(`Delete the one-step previous cloud recovery for ${e.formId||'Qbank'}? Current cloud progress will not be changed.`))return;
    const draft=clone(m);draft.entries[key].previous=null;await writeManifest(draft);if(prev.fileId)try{await deleteDriveFile(prev.fileId);}catch(e2){console.warn('Could not delete old recovery file',e2);}const a=await analyze({flush:false});setAnalysisStatus(a);
  }
  async function deleteAllPreviousCloud(){
    if(!(await ensureCloudSession({interactive:true})))return;const cs=await readManifest(),m=cs.manifest||emptyManifest(),prevs=Object.values(m.entries||{}).map(e=>e.previous).filter(Boolean);if(!prevs.length)return;if(!confirm(`Delete ${prevs.length} previous cloud recovery cop${prevs.length===1?'y':'ies'}? Current progress and dated snapshots are unaffected.`))return;
    const draft=clone(m);for(const e of Object.values(draft.entries||{}))e.previous=null;await writeManifest(draft);for(const p of prevs)if(p.fileId)try{await deleteDriveFile(p.fileId);}catch(_e){}const a=await analyze({flush:false});setAnalysisStatus(a);
  }

  async function copyCurrentToSnapshot(manifest,kind,label){
    const snapshotId=U.uuid(),createdAt=U.iso(),copied=[];const entries={};
    try{
      for(const [key,e] of Object.entries(manifest.entries||{})){const cur=currentOf(e);if(!cur)continue;let fileId='';if(!cur.deletedAt&&cur.fileId){const cp=await copyDriveFile(cur.fileId,snapshotFileName(snapshotId,key));fileId=cp.id;copied.push(cp.id);}entries[key]={key,kind:e.kind,formId:e.formId||'',bankHash:e.bankHash||'',sourceVersionId:cur.versionId||'',contentHash:cur.contentHash||'',updatedAt:cur.updatedAt||'',deletedAt:cur.deletedAt||null,fileId,sizeBytes:Number(cur.sizeBytes||0)};}
      return {snapshotId,kind,label:label||'',createdAt,dayKey:kind==='daily'?localDay():'',deviceId:await R.meta.deviceId(),sourceManifestUpdatedAt:manifest.updatedAt||'',entries,_copied:copied};
    }catch(e){for(const id of copied)try{await deleteDriveFile(id);}catch(_e){}throw e;}
  }
  async function commitSnapshotFromManifest(manifest,kind='manual',label=''){
    if(!Object.keys(manifest.entries||{}).length)throw new Error('There is no cloud progress to snapshot yet.');
    const snap=await copyCurrentToSnapshot(manifest,kind,label),hs=await readHistory(),history=clone(hs.history||emptyHistory()),oldSnapshots=[...(history.snapshots||[])],removed=[];delete snap._copied;history.snapshots.push(snap);
    if(kind==='daily'){const daily=history.snapshots.filter(s=>s.kind==='daily').sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)),keep=new Set(daily.slice(0,C.DAILY_SNAPSHOT_RETENTION||7).map(s=>s.snapshotId));history.snapshots=history.snapshots.filter(s=>s.kind!=='daily'||keep.has(s.snapshotId));for(const s of oldSnapshots)if(s.kind==='daily'&&!keep.has(s.snapshotId))removed.push(s);}
    try{await writeHistory(history);}catch(e){for(const ent of Object.values(snap.entries||{}))if(ent.fileId)try{await deleteDriveFile(ent.fileId);}catch(_e){}throw e;}
    for(const old of removed)for(const ent of Object.values(old.entries||{}))if(ent.fileId)try{await deleteDriveFile(ent.fileId);}catch(_e){}
    await R.meta.set(kind==='daily'?'lastDailySnapshotAt':'lastManualSnapshotAt',snap.createdAt);uiState.history=history;renderUi();return snap;
  }
  async function createSnapshot(kind='manual',label=''){
    if(!(await ensureCloudSession({interactive:true})))return null;await validateAccount();let a=await analyze({flush:true});const decisions=a.rows.filter(isDecisionRow);if(decisions.length){rememberDecision(decisions);setAnalysisStatus(a);throw new Error('Resolve the current cloud/local decision before creating a dated progress backup.');}
    const safe=safeUploadRows(a);if(safe.length){setStatus('Backing up…','Bringing current per-form cloud progress up to date before creating the snapshot.');await commitRows(safe);a=await analyze({flush:false});}
    const manifest=a.manifest;setStatus('Creating recovery snapshot…',kind==='daily'?'Creating today’s server-side recovery snapshot in Google Drive.':'Creating a timestamped manual progress backup in Google Drive.');
    const snap=await commitSnapshotFromManifest(manifest,kind,label);setStatus('Backed up',kind==='daily'?`Daily recovery snapshot saved at ${fmtDate(snap.createdAt)}.`:`Manual progress backup saved at ${fmtDate(snap.createdAt)}.`);return snap;
  }
  async function ensureDailySnapshot(){
    const enabled=await R.meta.get(DAILY_ENABLED_KEY,true);if(!enabled||navigator.onLine===false||!A.getState().authorized)return;const hs=await readHistory(),today=localDay();if((hs.history.snapshots||[]).some(s=>s.kind==='daily'&&s.dayKey===today))return;await createSnapshot('daily',`Daily ${today}`);
  }
  async function createManualSnapshot(){const label=prompt('Optional label for this manual progress backup:','');if(label===null)return;return createSnapshot('manual',label.trim());}
  async function deleteSnapshot(snapshotId){if(!(await ensureCloudSession({interactive:true})))return;const hs=await readHistory(),history=clone(hs.history),snap=(history.snapshots||[]).find(s=>s.snapshotId===snapshotId);if(!snap)return;if(!confirm(`Delete ${snap.kind==='daily'?'daily':'manual'} progress backup from ${fmtDate(snap.createdAt)}?`))return;history.snapshots=history.snapshots.filter(s=>s.snapshotId!==snapshotId);await writeHistory(history);for(const ent of Object.values(snap.entries||{}))if(ent.fileId)try{await deleteDriveFile(ent.fileId);}catch(_e){}renderUi();}
  async function restoreSnapshot(snapshotId){
    const rt=window.StepExamSyncBridge?.runtime?.();if(rt?.examVisible)throw new Error('Leave the active exam before restoring a progress snapshot.');if(!(await ensureCloudSession({interactive:true})))return;const hs=await readHistory(),snap=(hs.history.snapshots||[]).find(s=>s.snapshotId===snapshotId);if(!snap)throw new Error('That progress snapshot no longer exists.');
    if(!confirm(`Restore the ${snap.kind==='daily'?'daily':'manual'} progress backup from ${fmtDate(snap.createdAt)}${snap.label?` (${snap.label})`:''}? This replaces local progress to that recovery point. Your current local progress will be saved as the one-step local recovery first.`))return;
    await saveLocalRecovery();const local=await S.localIndex({flush:true}),snapKeys=new Set(Object.keys(snap.entries||{})),states=await getStates();window.__STEP_SYNC_APPLYING_REMOTE=true;
    try{
      for(const [key,ent] of Object.entries(snap.entries||{})){
        const rec=ent.kind==='form'?(local.catalog.forms||[]).find(r=>B.entityKey(r.id,r.bankHash)===key):null;if(ent.kind==='form'&&!rec)continue;
        const ident={key,kind:ent.kind,formId:ent.formId||'',bankHash:ent.bankHash||''};if(ent.deletedAt)await S.applyDeletion(ident);else if(ent.fileId){const b=await downloadJson(ent.fileId,`${ent.formId||'Qbank'} snapshot progress`);await S.applyBackup(ident,b);}states[key]={...(states[key]||{}),baseCloudVersionId:String(ent.sourceVersionId||''),baseContentHash:String(ent.contentHash||''),lastSyncedAt:ent.updatedAt||'',localUpdatedAt:U.iso(),explicitDeleted:!!ent.deletedAt,deleteAt:ent.deletedAt||null,forceDecision:true,lastMutationReason:'Dated progress snapshot restored'};
      }
      for(const [key,l] of Object.entries(local.index)){if(snapKeys.has(key))continue;await S.applyDeletion({key,kind:l.kind,formId:l.formId||'',bankHash:l.bankHash||''});states[key]={...(states[key]||{}),localUpdatedAt:U.iso(),explicitDeleted:true,deleteAt:U.iso(),forceDecision:true,lastMutationReason:'Absent from restored progress snapshot'};}
      await setStates(states);
    }finally{window.__STEP_SYNC_APPLYING_REMOTE=false;}
    await window.StepExamSyncBridge?.refresh?.();const a=await analyze({flush:false});setAnalysisStatus(a);
  }

  async function clearCurrentCloud(){
    if(!(await ensureCloudSession({interactive:true})))return;const cs=await readManifest();if(!cs.manifest)throw new Error('There is no current cloud progress backup to clear.');if(!confirm('Clear CURRENT cloud progress synchronization data? Per-form current/previous sync files will be removed. Dated manual/daily progress snapshots and the Full Form Library backup will NOT be deleted. Local progress remains on this device.'))return;
    const ids=new Set();for(const e of Object.values(cs.manifest.entries||{})){if(e.current?.fileId)ids.add(e.current.fileId);if(e.previous?.fileId)ids.add(e.previous.fileId);}for(const f of cs.files||[])try{await deleteDriveFile(f.id);}catch(_e){}for(const id of ids)try{await deleteDriveFile(id);}catch(_e){}
    cloudState={manifest:null,file:null,files:[]};const states=await getStates();for(const [k,st] of Object.entries(states)){states[k]={...st,baseCloudVersionId:'',baseContentHash:'',lastSyncedAt:'',forceDecision:false,explicitDeleted:false,deleteAt:null};}await setStates(states);const a=await analyze({flush:false});setAnalysisStatus(a);
  }
  async function replaceCurrentCloudWithDevice(){
    if(!(await ensureCloudSession({interactive:true})))return;await validateAccount();if(!confirm('Replace CURRENT cloud progress with this device? A timestamped manual cloud recovery snapshot of the existing current backup will be created first when possible. The Full Form Library backup and older dated snapshots are unaffected.'))return;
    const before=await analyze({flush:true});if(Object.keys(before.manifest.entries||{}).length){setStatus('Creating recovery snapshot…','Preserving the existing current cloud progress before replacement.');await commitSnapshotFromManifest(before.manifest,'manual',`Before current-cloud replace ${new Date().toLocaleString()}`);}
    setStatus('Resolving conflict…','Rebuilding current cloud progress from this device after creating a recovery snapshot.');const draft=clone((await readManifest()).manifest||emptyManifest(before.local.deviceId)),states=await getStates(),newFiles=[],cleanup=[],done=[];
    try{
      const localKeys=new Set(Object.keys(before.local.index));for(const row of before.rows){if(row.local){done.push(await prepareEntityUpload({...row,stateMeta:states[row.key]||{}},draft,newFiles,cleanup));}else if(row.remote?.current&&!row.remote.current.deletedAt){const rr={...row,stateMeta:{...(states[row.key]||{}),explicitDeleted:true}};done.push(await prepareDeletion(rr,draft,cleanup));}}
      await writeManifest(draft);for(const x of done){if(!x.current)continue;states[x.key]={...(states[x.key]||{}),baseCloudVersionId:x.current.versionId,baseContentHash:x.current.contentHash||'',lastSyncedAt:x.current.updatedAt||U.iso(),localUpdatedAt:U.iso(),explicitDeleted:false,deleteAt:null,forceDecision:false};}await setStates(states);for(const id of cleanup)try{await deleteDriveFile(id);}catch(_e){}const a=await analyze({flush:false});setAnalysisStatus(a);
    }catch(e){for(const id of newFiles)try{await deleteDriveFile(id);}catch(_e){}throw e;}
  }

  async function restoreLocalRecovery(){const rt=window.StepExamSyncBridge?.runtime?.();if(rt?.examVisible)throw new Error('Leave the active exam before restoring the saved local recovery point.');const cp=await R.meta.get(LOCAL_RECOVERY_LABEL,null);if(!cp)throw new Error('No local recovery point is available.');if(!confirm('Restore the saved local recovery point? It may have been created before a cloud restore, dated snapshot restore, or local progress import. Cloud progress will not be changed automatically.'))return;await S.restoreCheckpoint();const local=await S.localIndex({flush:false}),states=await getStates();for(const [key,e] of Object.entries(local.index)){states[key]={...(states[key]||{}),localUpdatedAt:U.iso(),forceDecision:true,lastMutationReason:'Local recovery point restored'};}await setStates(states);const a=await analyze({flush:false});setAnalysisStatus(a);}
  async function deleteLocalRecovery(){if(!await R.meta.get(LOCAL_RECOVERY_LABEL,null))return;if(!confirm('Delete the one-step local recovery point? Current local and cloud progress are unaffected.'))return;await R.meta.del('preBackupRecoverySnapshot');await R.meta.del('preBackupRecoveryAt');renderUi();}

  async function checkCloud({interactive=false}={}){if(navigator.onLine===false){setStatus('Offline — saved locally','Cloud manifest cannot be checked while offline.');return null;}if(!(await ensureCloudSession({interactive})))return null;await validateAccount();setStatus('Checking cloud…','Comparing local base version IDs with the current Drive manifest.');const a=await analyze({flush:false});setAnalysisStatus(a);readHistory().then(x=>{uiState.history=x.history;renderUi();}).catch(()=>{});return a;}

  async function runCloudDiagnostics(){if(!(await ensureCloudSession({interactive:true})))return;const a=await analyze({flush:false}),box=document.getElementById('stepSyncDiagnostics');if(!box)return a;const interesting=a.rows.filter(r=>r.state!==CLASS.ALIGNED&&r.state!==CLASS.CLOUD_RETAINED_UNLOADED&&r.state!==CLASS.BANK_HASH_MISMATCH);if(!interesting.length){box.innerHTML='<div class="sync-diag-ok"><b>No active lineage differences.</b><span>Every active local copy either matches cloud or safely descends from the current cloud version.</span></div>';return a;}box.innerHTML=interesting.map(r=>`<div class="sync-diag-row"><div class="sync-diag-title"><b>${escHtml(r.label)}</b><span>${escHtml(r.state)}</span></div><div class="sync-diag-reason">Base cloud version <code>${escHtml(short(r.stateMeta?.baseCloudVersionId))}</code> • Current cloud version <code>${escHtml(short(r.current?.versionId))}</code></div><div class="sync-diag-grid"><span>Local changed <b>${escHtml(fmtDate(r.local?.modifiedAt||r.stateMeta?.localUpdatedAt))}</b></span><span>Cloud changed <b>${escHtml(fmtDate(r.current?.updatedAt))}</b></span><span>Local hash <code>${escHtml(short(r.local?.contentHash))}</code></span><span>Base hash <code>${escHtml(short(r.stateMeta?.baseContentHash))}</code></span><span>Cloud hash <code>${escHtml(short(r.current?.contentHash))}</code></span><span>Explicit local delete <b>${r.stateMeta?.explicitDeleted?'yes':'no'}</b></span></div></div>`).join('');return a;}

  async function handleError(e){console.error(e);if(e?.name==='WorkerAuthError'&&e.status===401)setStatus('Reconnect Google','The Worker session expired or was removed. Local progress is safe.',{lastError:e.message});else if(e?.name==='WorkerAuthError')setStatus('Authentication service unavailable','Cloud authentication failed. Local progress is safe.',{lastError:e.message});else if(e?.name==='DriveHttpError'&&e.status===401)setStatus('Reconnect Google','Google Drive authorization could not be refreshed. Local progress is safe.',{lastError:e.message});else setStatus('Backup failed','Cloud operation failed. Local progress is safe.',{lastError:e?.message||String(e)});throw e;}
  async function connect(){await A.connect();}
  async function disconnect(){const r=await A.disconnect();await R.meta.set('syncEnabled',false);clearDecision();setStatus('Disconnected',r.warning?`Disconnected locally. ${r.warning}`:'Cloud backup is disconnected on this device. Local progress and cloud data were not deleted.',{account:'',summary:null});}

  function controls(){if(!connected())return `<button class="primary" data-step-sync-action="connect">Connect Google Account</button>`;return `<button class="primary" data-step-sync-action="backup">Back Up Now</button><button class="secondary" data-step-sync-action="restore-current">Restore Current Cloud</button><button class="secondary" data-step-sync-action="disconnect">Disconnect</button>`;}
  function installStyles(){
    if(document.getElementById('stepProgressSyncStyle'))return;const st=document.createElement('style');st.id='stepProgressSyncStyle';st.textContent=`
    #progressSyncTab{position:relative}#progressSyncTab .sync-tab-dot{width:8px;height:8px;border-radius:50%;display:inline-block;margin-left:7px;background:#7d92a2}#progressSyncTab.sync-connected .sync-tab-dot{background:#34c78b}#progressSyncTab.sync-attention .sync-tab-dot{background:#f0ad45}
    #progressSyncPanel{--sync-ink:#0b1f2d;--sync-muted:#637888;--sync-line:#dbe6ed;--sync-soft:#f5f9fb;--sync-green:#159468;--sync-warn:#b87312;--sync-red:#a83b3b}#progressSyncPanel .sync-hero{display:flex;justify-content:space-between;gap:18px;padding:20px 22px;margin-bottom:16px}#progressSyncPanel .sync-hero h2{margin:2px 0 5px;font-size:24px;color:var(--sync-ink)}#progressSyncPanel .sync-hero p{margin:0;color:var(--sync-muted);font-size:12px;line-height:1.5;max-width:760px}.sync-status-pill{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--sync-line);background:#fff;border-radius:999px;padding:8px 12px;font-size:12px;font-weight:900;white-space:nowrap}.sync-status-pill i{width:9px;height:9px;border-radius:50%;background:#899ba8}.sync-status-pill.good i{background:var(--sync-green)}.sync-status-pill.warn i{background:#e2a032}.sync-status-pill.bad i{background:var(--sync-red)}.sync-status-pill.busy i{background:#1976d2;animation:stepSyncPulse 1s infinite alternate}@keyframes stepSyncPulse{from{opacity:.35}to{opacity:1}}
    #progressSyncPanel .sync-layout{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(300px,.85fr);gap:16px}#progressSyncPanel .sync-card{background:#fff;border:1px solid var(--sync-line);border-radius:20px;padding:18px;box-shadow:0 10px 26px rgba(24,54,84,.06)}#progressSyncPanel .sync-card h3{margin:0 0 5px;font-size:16px;color:var(--sync-ink)}#progressSyncPanel .sync-card p{margin:0;color:var(--sync-muted);font-size:11px;line-height:1.5}.sync-detail{margin-top:12px;padding:11px 13px;border-radius:13px;background:var(--sync-soft);font-size:12px;color:#425c6d}.sync-detail.warn{background:#fff9ed;color:#7f5a16}.sync-detail.bad{background:#fff5f5;color:#883838}.sync-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.sync-account,.sync-disconnected{margin-top:15px;padding:14px;border-radius:15px;border:1px solid #dbe6ed;background:#f8fbfc}.sync-account-email{font-weight:900;font-size:13px}.sync-account-sub{font-size:10px;color:var(--sync-muted);margin-top:3px}
    .sync-decision-notice{margin-top:13px;border:1px solid #edcd8b;background:#fff8e8;border-radius:16px;padding:14px}.sync-decision-notice[hidden]{display:none!important}.sync-decision-title{font-weight:900;color:#553b0b}.sync-decision-list{display:flex;flex-direction:column;gap:7px;margin-top:9px}.sync-decision-row{display:grid;grid-template-columns:minmax(110px,1fr) 1.2fr 1.2fr;gap:8px;font-size:10px;padding:8px;border-radius:10px;background:rgba(255,255,255,.65)}.sync-decision-row b{font-size:11px}.sync-decision-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:11px}.sync-decision-actions .use-cloud{background:#153b54!important;color:#fff!important}.sync-decision-actions .use-local{background:#fff!important;color:#754800!important;border-color:#d3a34e!important}
    #stepSyncInventory{margin-top:13px;display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px}.sync-metric{background:var(--sync-soft);border:1px solid #e0ebf1;border-radius:13px;padding:10px}.sync-metric span{display:block;font-size:9px;text-transform:uppercase;color:#78909e;font-weight:850}.sync-metric b{display:block;margin-top:4px;font-size:16px;color:var(--sync-ink)}.sync-inventory{grid-column:1/-1}.sync-footer{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:14px;font-size:10px;color:#728797}.sync-section-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}.sync-recovery-list,.sync-history-list{display:flex;flex-direction:column;gap:8px;margin-top:12px}.sync-recovery-item,.sync-history-item{border:1px solid #e0e9ee;border-radius:13px;padding:10px;background:#fbfdfe;display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center}.sync-recovery-item b,.sync-history-item b{font-size:11px}.sync-recovery-item span,.sync-history-item span{display:block;font-size:10px;color:var(--sync-muted);margin-top:2px}.sync-mini-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.sync-mini-actions button{padding:6px 8px!important;font-size:10px!important;min-width:0!important}.sync-danger{border-color:#e0b8b8!important;color:#8c3030!important}.sync-note{font-size:10px;color:var(--sync-muted);line-height:1.45;margin-top:8px}.sync-toggle-on{color:#16744f!important;border-color:#b9dfcf!important;background:#f0fbf6!important}
    #stepSyncDiagnostics{margin-top:10px;display:flex;flex-direction:column;gap:8px}.sync-diag-row,.sync-diag-ok{border:1px solid #dde8ee;border-radius:13px;padding:10px;background:#fbfdfe}.sync-diag-ok{background:#f0fbf6;color:#176846}.sync-diag-title{display:flex;justify-content:space-between;gap:8px}.sync-diag-title span{font-size:9px;font-weight:900;color:#8a5a15}.sync-diag-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:4px 9px;margin-top:7px;font-size:9px;color:#607685}.sync-diag-grid code{font-size:9px}.sync-maintenance{margin-top:13px;padding-top:12px;border-top:1px solid #e0e9ee;display:flex;gap:7px;flex-wrap:wrap}
    @media(max-width:900px){#progressSyncPanel .sync-layout{grid-template-columns:1fr}.sync-decision-row{grid-template-columns:1fr}.sync-inventory{grid-column:auto}}
    `;document.head.appendChild(st);
  }
  function ensureSurface(){
    installStyles();const tabBar=document.querySelector('.menu-tabs');if(tabBar&&!document.getElementById('progressSyncTab')){const t=document.createElement('button');t.id='progressSyncTab';t.className='menu-tab';t.type='button';t.innerHTML='Progress Backup <span class="sync-tab-dot"></span>';tabBar.appendChild(t);}if(document.getElementById('progressSyncPanel')){renderUi();return;}
    const settingsPanel=document.getElementById('settingsPanel'),main=settingsPanel?.parentNode||document.querySelector('main')||document.body,p=document.createElement('section');p.id='progressSyncPanel';p.className='mode-panel';p.innerHTML=`<div class="sync-hero"><div><h2>Google Progress Backup</h2><p><b>Progress Sync V2:</b> local IndexedDB is the runtime source of truth. Automatic Local → Cloud is allowed only when this device still descends from the current cloud version. Timestamps are shown for decisions but never choose authority.</p></div><div id="stepSyncStatusPill" class="sync-status-pill"><i></i><span id="stepSyncStatusText">Disconnected</span></div></div><div class="sync-layout">
      <section class="sync-card"><h3>Current progress</h3><p>Per-form version lineage prevents an old device or cleared browser from silently overwriting a newer cloud copy.</p><div id="stepSyncAccountArea"></div><div id="stepSyncDetailText" class="sync-detail"></div><div id="stepSyncDecisionNotice" class="sync-decision-notice" hidden></div><div id="stepSyncActions" class="sync-actions"></div><div class="sync-note">Last successful current backup: <b id="stepSyncLastText">Never</b></div></section>
      <section class="sync-card"><h3>One-step recovery</h3><p>Every cloud overwrite keeps one previous cloud version. Every cloud→local restore saves one complete local progress recovery point first.</p><div id="stepSyncLocalRecovery"></div><div id="stepSyncPreviousRecovery" class="sync-recovery-list"></div><div class="sync-section-actions"><button class="secondary" data-step-sync-action="delete-all-previous">Delete All Previous Cloud Recoveries</button></div></section>
      <section class="sync-card"><h3>Dated progress backups</h3><p>Daily and manual recovery snapshots are separate from current synchronization. They use server-side Drive copies of the current per-form backups.</p><div class="sync-section-actions"><button id="stepSyncDailyToggle" class="secondary" data-step-sync-action="toggle-daily">Daily snapshots</button><button class="primary" data-step-sync-action="manual-snapshot">Create Manual Progress Backup</button></div><div id="stepSyncHistory" class="sync-history-list"></div></section>
      <section class="sync-card"><h3>How V2 decides</h3><p>Version lineage is authoritative; timestamps are explanatory only.</p><div class="sync-recovery-list"><div class="sync-recovery-item"><div><b>Same cloud version</b><span>Local changes can auto-backup safely.</span></div></div><div class="sync-recovery-item"><div><b>Cloud version advanced</b><span>Old/new device is detected and the app asks before either side is replaced.</span></div></div><div class="sync-recovery-item"><div><b>Missing local progress</b><span>Never treated as deletion unless the simulator recorded an explicit delete/reset.</span></div></div></div></section>
      <section class="sync-card sync-inventory"><div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap"><div><h3>Diagnostics & maintenance</h3><p>Current sync, dated progress snapshots, and the Full Form Library backup are independent systems.</p></div><div class="sync-section-actions"><button class="secondary" data-step-sync-action="check">Check Cloud Manifest</button><button class="secondary" data-step-sync-action="diagnose">Diagnose Lineage</button><button class="secondary" data-step-sync-action="validate">Validate Local Progress</button></div></div><div id="stepSyncInventory"></div><div id="stepSyncDiagnostics"></div><div class="sync-maintenance"><button class="secondary sync-danger" data-step-sync-action="clear-current-cloud">Clear Current Cloud Sync</button><button class="secondary sync-danger" data-step-sync-action="replace-current-cloud">Replace Current Cloud with This Device</button></div><div class="sync-footer"><span>Progress Sync V2 • Full Form Library backup remains separate.</span><span><a href="./privacy.html" target="_blank" rel="noopener">Privacy Policy</a> · Build ${C.BUILD}</span></div></section>
    </div>`;settingsPanel?.parentNode?settingsPanel.parentNode.insertBefore(p,settingsPanel.nextSibling):main.appendChild(p);renderUi();
  }
  function activate(){ensureSurface();document.querySelectorAll('.mode-panel.active').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.menu-tab.active').forEach(x=>x.classList.remove('active'));document.getElementById('progressSyncPanel')?.classList.add('active');document.getElementById('progressSyncTab')?.classList.add('active');if(connected())checkCloud({interactive:false}).catch(()=>{});}

  function renderDecision(notice){
    if(!notice)return;if(!connected()||!decisionRows.length){notice.hidden=true;notice.innerHTML='';return;}notice.hidden=false;const rows=uiState.summary?.rows?.filter(r=>decisionRows.some(d=>d.key===r.key))||[];const canLocal=decisionRows.some(r=>r.canKeepLocal),canCloud=decisionRows.some(r=>r.canUseCloud);
    notice.innerHTML=`<div class="sync-decision-title">Progress choice required</div><div class="sync-note">Nothing will be overwritten until you choose. Version IDs decide safety; timestamps below help you identify the copy you intended to keep.</div><div class="sync-decision-list">${rows.slice(0,12).map(r=>`<div class="sync-decision-row"><b>${escHtml(r.label)}</b><span>This device: ${escHtml(fmtDate(r.local?.modifiedAt||r.stateMeta?.localUpdatedAt))}</span><span>Cloud: ${escHtml(fmtDate(r.current?.updatedAt))} · ${escHtml(r.state)}</span></div>`).join('')}${rows.length>12?`<div class="sync-note">+ ${rows.length-12} more</div>`:''}</div><div class="sync-decision-actions">${canLocal?'<button class="secondary use-local" data-step-sync-action="keep-local">Keep This Device → Cloud</button>':''}${canCloud?'<button class="primary use-cloud" data-step-sync-action="use-cloud">Use Cloud Backup → This Device</button>':''}<button class="secondary" data-step-sync-action="check">Not Now / Check Again</button></div>`;
  }
  async function renderRecovery(){
    const localBox=document.getElementById('stepSyncLocalRecovery'),prevBox=document.getElementById('stepSyncPreviousRecovery');if(localBox){const at=await R.meta.get('preBackupRecoveryAt',''),cp=await R.meta.get('preBackupRecoverySnapshot',null);localBox.innerHTML=cp?`<div class="sync-recovery-item"><div><b>Previous local progress</b><span>Saved ${escHtml(fmtDate(at))} before the last cloud/snapshot restore or local progress import.</span></div><div class="sync-mini-actions"><button class="secondary" data-step-sync-action="restore-local-recovery">Restore Local Recovery</button><button class="secondary sync-danger" data-step-sync-action="delete-local-recovery">Delete</button></div></div>`:`<div class="sync-note">No local recovery point yet.</div>`;}
    if(prevBox){const entries=Object.values(cloudState.manifest?.entries||{}).filter(e=>e?.previous);prevBox.innerHTML=entries.length?entries.slice(0,20).map(e=>`<div class="sync-recovery-item"><div><b>${escHtml(e.kind==='qbank'?'Qbank':e.formId)}</b><span>Previous cloud copy: ${escHtml(fmtDate(e.previous.updatedAt))}</span></div><div class="sync-mini-actions"><button class="secondary" data-step-sync-action="restore-previous" data-sync-key="${escHtml(encodeURIComponent(e.key))}">Restore</button><button class="secondary sync-danger" data-step-sync-action="delete-previous" data-sync-key="${escHtml(encodeURIComponent(e.key))}">Delete</button></div></div>`).join(''):`<div class="sync-note">No previous cloud recovery copies yet.</div>`;}
  }
  function renderHistory(){const box=document.getElementById('stepSyncHistory'),toggle=document.getElementById('stepSyncDailyToggle');R.meta.get(DAILY_ENABLED_KEY,true).then(on=>{if(toggle){toggle.textContent=`Daily snapshots: ${on?'On':'Off'}`;toggle.classList.toggle('sync-toggle-on',!!on);}});if(!box)return;const snaps=[...(uiState.history?.snapshots||[])].sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));box.innerHTML=snaps.length?snaps.map(s=>`<div class="sync-history-item"><div><b>${escHtml(s.kind==='daily'?'Daily backup':(s.label||'Manual backup'))}</b><span>${escHtml(fmtDate(s.createdAt))}${s.kind==='manual'&&s.label?` · ${escHtml(s.label)}`:''}</span></div><div class="sync-mini-actions"><button class="secondary" data-step-sync-action="restore-snapshot" data-snapshot-id="${escHtml(s.snapshotId)}">Restore</button><button class="secondary sync-danger" data-step-sync-action="delete-snapshot" data-snapshot-id="${escHtml(s.snapshotId)}">Delete</button></div></div>`).join(''):`<div class="sync-note">No dated progress backups yet. Daily snapshots keep the last ${C.DAILY_SNAPSHOT_RETENTION||7} days.</div>`;}
  function renderUi(){
    const pill=document.getElementById('stepSyncStatusPill'),st=document.getElementById('stepSyncStatusText'),dt=document.getElementById('stepSyncDetailText'),notice=document.getElementById('stepSyncDecisionNotice'),aa=document.getElementById('stepSyncAccountArea'),acts=document.getElementById('stepSyncActions'),last=document.getElementById('stepSyncLastText'),tab=document.getElementById('progressSyncTab'),inv=document.getElementById('stepSyncInventory');
    if(pill)pill.className='sync-status-pill '+tone();if(st)st.textContent=uiState.status;if(dt){dt.textContent=uiState.detail||'';dt.className='sync-detail '+(tone()==='bad'?'bad':tone()==='warn'?'warn':'');}renderDecision(notice);
    if(aa)aa.innerHTML=connected()?`<div class="sync-account"><div class="sync-account-email">${escHtml(uiState.account||'Connected Google account')}</div><div class="sync-account-sub">Persistent Worker session • Drive payloads transfer directly between this device and Google Drive.</div></div>`:`<div class="sync-disconnected">Progress is local-first. Connect Google once; the shared Cloudflare Worker silently refreshes Drive access on later reload/reopen.</div>`;
    if(acts)acts.innerHTML=controls();if(last)last.textContent=uiState.lastBackup?fmtDate(uiState.lastBackup):'Never';if(tab){tab.classList.toggle('sync-connected',connected());tab.classList.toggle('sync-attention',tone()==='warn'||tone()==='bad');}
    if(inv&&uiState.summary){const s=uiState.summary,items=[['Local progress',s.localCount],['Current cloud',s.cloudCount],['Safe local ahead',s.localSafe],['Cloud ahead',s.cloudAhead],['Cloud only',s.cloudOnly],['Need decision',s.decisionCount],['Previous recoveries',s.previousRecoveryCount],['Aligned',s.aligned]];inv.innerHTML=items.map(([a,b])=>`<div class="sync-metric"><span>${a}</span><b>${b}</b></div>`).join('');}
    renderRecovery().catch(()=>{});renderHistory();
  }
  async function runValidate(){const r=await S.validateLocal(),inv=document.getElementById('stepSyncInventory');if(inv){const items=[['Loaded forms',r.loadedForms],['Progress forms',r.stats.forms],['Attempts',r.stats.attempts],['Answered',r.stats.answered],['Stem highlights',r.stats.stemHighlights],['Explanation highlights',r.stats.expHighlights],['Qbank tests',r.stats.qbankTests],['Backup entities',r.entities],['Est. payload',(r.estimatedBytes/1024/1024).toFixed(2)+' MB']];inv.innerHTML=items.map(([a,b])=>`<div class="sync-metric"><span>${a}</span><b>${b}</b></div>`).join('');}return r;}

  async function action(a,el){
    if(a==='connect')return connect();if(a==='check')return checkCloud({interactive:true});if(a==='diagnose')return runCloudDiagnostics();if(a==='backup')return manualBackup();if(a==='keep-local')return resolveKeepLocal();if(a==='use-cloud')return resolveUseCloud();if(a==='restore-current')return restoreCurrentCloud();if(a==='disconnect')return disconnect();if(a==='validate')return runValidate();if(a==='restore-local-recovery')return restoreLocalRecovery();if(a==='delete-local-recovery')return deleteLocalRecovery();if(a==='delete-all-previous')return deleteAllPreviousCloud();if(a==='restore-previous')return restorePreviousCloud(decodeURIComponent(el.dataset.syncKey||''));if(a==='delete-previous')return deletePreviousCloud(decodeURIComponent(el.dataset.syncKey||''));if(a==='manual-snapshot')return createManualSnapshot();if(a==='restore-snapshot')return restoreSnapshot(el.dataset.snapshotId||'');if(a==='delete-snapshot')return deleteSnapshot(el.dataset.snapshotId||'');if(a==='toggle-daily'){const on=await R.meta.get(DAILY_ENABLED_KEY,true);await R.meta.set(DAILY_ENABLED_KEY,!on);renderUi();return;}if(a==='clear-current-cloud')return clearCurrentCloud();if(a==='replace-current-cloud')return replaceCurrentCloudWithDevice();
  }

  document.addEventListener('click',e=>{const tab=e.target?.closest?.('#progressSyncTab');if(tab){e.preventDefault();activate();return;}const other=e.target?.closest?.('.menu-tab:not(#progressSyncTab)');if(other)document.getElementById('progressSyncPanel')?.classList.remove('active');const b=e.target?.closest?.('[data-step-sync-action]');if(!b)return;e.preventDefault();b.disabled=true;Promise.resolve(action(b.dataset.stepSyncAction,b)).catch(err=>alert(err.message||String(err))).finally(()=>{b.disabled=false;});},true);
  window.addEventListener('stepsim:progress-write',e=>{if(window.__STEP_SYNC_APPLYING_REMOTE)return;recordProgressMutation(e.detail).catch(console.warn);});
  window.addEventListener('stepsim:local-progress-imported',e=>{if(window.__STEP_SYNC_APPLYING_REMOTE)return;markImportedProgressBranch(e.detail||{}).catch(console.warn);});
  window.addEventListener('stepsim:three-digit-score',e=>{if(window.__STEP_SYNC_APPLYING_REMOTE)return;const d=e.detail||{},key=B.entityKey(d.formId,d.bankHash);patchState(key,{localUpdatedAt:U.iso(),explicitDeleted:false,deleteAt:null,lastMutationReason:'3-digit score changed'}).then(async()=>{const enabled=await R.meta.get('syncEnabled',false);setStatus(enabled?'Local backup pending':'Disconnected',enabled?'3-digit score changed locally. It will back up at the next checkpoint.':'3-digit score changed locally. Google backup is disconnected on this device.');}).catch(()=>{});});
  document.addEventListener('click',e=>{const el=e.target?.closest?.('#finishBlock,#endBlockBtn,#backMenu,#reportSaveMenu,#menuNow,[data-v9="delete-attempt"],[data-v9="qbank-delete"]');if(el)R.meta.get('syncEnabled',false).then(on=>{if(on)scheduleCheckpoint(`Major checkpoint: ${el.id||el.dataset?.v9||'navigation'}`,2200);});},true);
  window.addEventListener('online',()=>{R.meta.get('syncEnabled',false).then(on=>{if(on)scheduleCheckpoint('Network restored',1800);});});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='visible')return;R.meta.get('syncEnabled',false).then(on=>{if(on)scheduleCheckpoint('App returned to foreground',2200);});});

  async function boot(){
    installStyles();await R.meta.set(V2_ENGINE_KEY,2);if('serviceWorker'in navigator){try{await navigator.serviceWorker.register('./sw.js?v='+encodeURIComponent(C.BUILD),{scope:'./'});}catch(e){console.warn('Service worker registration failed',e);}}
    const mo=new MutationObserver(()=>{if(!document.getElementById('progressSyncTab')||!document.getElementById('progressSyncPanel'))ensureSurface();});mo.observe(document.documentElement,{childList:true,subtree:true});ensureSurface();
    try{await A.initialize();}catch(e){console.warn('Cloud auth initialization failed',e);}const enabled=await R.meta.get('syncEnabled',false),acct=await R.meta.get('googleAccount',null),last=await R.meta.get('lastBackupAt','');uiState.account=acct?.email||acct?.emailAddress||'';uiState.lastBackup=last||'';
    readHistory().then(x=>{uiState.history=x.history;renderUi();}).catch(()=>{});
    if(enabled&&A.getState().authorized){setStatus('Checking cloud…','Local progress is ready. Progress Sync V2 is checking version lineage before any automatic backup.');setTimeout(()=>syncCheckpoint('App startup').catch(()=>{}),900);}else if(enabled)setStatus('Reconnect Google','Cloud backup is enabled, but this device no longer has a valid Worker session. Local progress is safe.');else setStatus('Disconnected','Progress is currently stored locally on this device.');
  }

  R.sync={backupNow:manualBackup,checkCloud,restoreFromCloud:restoreCurrentCloud,resolveConflictKeepLocal:resolveKeepLocal,resolveConflictUseCloud:resolveUseCloud,clearCloudProgressBackup:clearCurrentCloud,replaceCloudProgressWithDevice:replaceCurrentCloudWithDevice,runCloudDiagnostics,connect,disconnect,markDirtyKey:async key=>patchState(key,{localUpdatedAt:U.iso(),explicitDeleted:false,lastMutationReason:'marked dirty'}),getState:()=>({...uiState}),runValidate,markImportedProgressBranch,_test:{CLASS,classify:V.classify,normalizeManifest,isDecisionRow,canKeepLocal,canUseCloud,analyze,commitRows,createSnapshot,readHistory,restoreSnapshot,syncCheckpoint,restorePreviousCloud,deletePreviousCloud,commitSnapshotFromManifest}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

/* Sync V3 migration V2 -> V3, SHADOW mode (SYNC_HYBRID_PLAN.md section 8 steps 1-6, section 11 Release A).
   Nothing is written to Drive (and no V2 file is frozen, copied or deleted): the planner reads V2 data, converts it into
   the replica `v2legacy` and this device's own units in memory, verifies per form, and reports what V3 would do next
   to what V2 would do. Every step is deterministic: same input -> byte-identical units on every device. */
(function(root,factory){
  const isNode=typeof module==='object'&&module.exports;
  const api=factory(isNode?require('./sync3-core.js'):root.StepSync3Core,isNode?require('./sync3-bridge.js'):root.StepSync3Bridge);
  if(isNode)module.exports=api;
  if(root)root.StepSync3Migrate=api;
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:this),function(Core,Bridge){
  'use strict';
  const K=Core.K,canon=Core.canon,LEGACY_DEV='v2legacy',KEEP_DAYS=30;
  const isTrue=v=>v===true||(v&&v.done===true);
  const wallOf=(iso,fallback)=>{const t=Date.parse(iso||'');return Number.isFinite(t)?t:fallback;};

  /* step 1: when may the migration start? (an open block, a pending QID baseline or a form install in progress wait) */
  function gate({runtime,qidBaselinePending,committing}){
    const reasons=[];
    if(qidBaselinePending)reasons.push('A QID baseline is still pending.');
    if(committing)reasons.push('A form install or update is committing.');
    if(runtime&&runtime.examVisible)reasons.push('A block is open.');      // a suspended block that is not on screen is not open
    return {ok:!reasons.length,reasons};
  }

  /* deterministic stamps for converted units: sorted by key, counter 0.., log entries get their own stamps (unit = last) */
  function stampUnits(units,wall,dev){
    let c=0;const out=[];
    /* block completions get the last counters of the batch: answers of that block are stamped before it, never ignored */
    const isDone=u=>{const p=Core.parseKey(u.k);return p.fam==='B'&&p.field==='done';};
    for(const u of [...units].sort((a,b)=>(isDone(a)-isDone(b))||(a.k<b.k?-1:a.k>b.k?1:0))){
      if(Core.ruleFor(u.k)===Core.RULES.LOG){
        const entries=(u.v||[]).map(e=>({...e,t:Core.fmtStamp(wall,c++,dev)}));
        out.push({k:u.k,v:entries,t:entries.length?entries[entries.length-1].t:Core.fmtStamp(wall,c++,dev)});
      }else out.push({k:u.k,v:u.v,t:Core.fmtStamp(wall,c++,dev)});
    }
    return out;
  }
  const mapOf=units=>{const m={};for(const u of units)m[u.k]=m[u.k]?Core.joinUnits(Core.ruleFor(u.k),m[u.k],u,Date.now()):u;return m;};
  const legacyTm=units=>units.map(u=>Core.parseKey(u.k).field==='tm'&&u.v&&u.v.__total!=null?{k:u.k,v:{[LEGACY_DEV]:u.v.__total}}:u);

  /* the QIDs a form's catalog record knows, for "every QID resolves" */
  const qidSet=rec=>new Set((rec&&rec.questionIndex||[]).map(r=>String(r&&r.qid||(String(r&&r.key||'').includes('::')?String(r.key).split('::').slice(1).join('::'):''))).filter(Boolean));
  function unresolved(units,uid,sets,allSets){
    const bad=new Set();
    const check=qid=>{
      if(uid===Core.QBANK_UID){const i=qid.indexOf('::');const fu=i>=0?qid.slice(0,i):'',q=i>=0?qid.slice(i+2):qid;const s=allSets[fu];if(s&&!s.has(q))bad.add(qid);else if(!s&&i<0)bad.add(qid);}
      else if(sets&&!sets.has(qid))bad.add(qid);
    };
    for(const u of units){
      const p=Core.parseKey(u.k);
      if(p.fam==='I')check(p.qid);
      else if(p.fam==='A'&&p.field===''&&u.v&&Array.isArray(u.v.order))u.v.order.forEach(check);   // every question of the attempt, answered or not
    }
    return [...bad].sort();
  }
  /* scores: per side, completed blocks' stored `correct` count vs the count derived from the units (key = stored result) */
  function scoreCheck(progress,units,keys,uid){
    const vis=Core.view(mapOf(units),{now:Date.now()}).units;let checked=0;const bad=[];
    for(const x of Bridge.attemptsOf(progress)){
      const att=uid+':'+x.id;if(!x.id||!Array.isArray(x.session.blocks))continue;
      const h=(vis[K.att(att)]||{}).v;if(!h)continue;
      let off=0;
      (x.session.blocks||[]).forEach((b,bi)=>{
        const n=Bridge.countOf(b),q=(h.order||[]).slice(off,off+n);off+=n;
        if(!b.result||!Array.isArray(b.result.answers)||b.result.correct==null)return;
        let correct=0;q.forEach((id,i)=>{const a=vis[K.item(att,id,'ans')],ra=b.result.answers.find(r=>Number(r&&r.item)===i+1);if(a&&ra&&a.v===ra.correct)correct++;});
        checked++;if(correct!==Number(b.result.correct))bad.push({att,block:bi+1,v2:Number(b.result.correct),v3:correct});
      });
    }
    return {checked,mismatches:bad};
  }
  const LOWER=['attempts','answered','marked','struck','notes','stemHighlights','expHighlights','completedBlocks'];
  const maxCounts=(a,b)=>{const o={};for(const k of LOWER)o[k]=Math.max((a&&a[k])||0,(b&&b[k])||0);return o;};

  const V2_DECISION={
    ALIGNED:'nothing to do',LOCAL_ONLY:'upload this device',LOCAL_AHEAD_SAFE:'upload this device',CLOUD_ONLY:'restore from cloud (needs the form)',
    CLOUD_AHEAD:'auto-restore the cloud copy',DIVERGED:'ask the user: keep one side, the other is lost',DELETED_LOCAL_SAFE:'delete the cloud copy',
    DELETE_CONFLICT:'ask the user',BANK_HASH_MISMATCH:'isolate (other form version)',UNTRACKED_BOTH:'ask the user: keep one side'
  };

  /* one form's shadow conversion + verification.
     row = {key, formUid, kind, state, local:{progress,suspended,threeDigitScore,modifiedAt,rec}|null, cloud:entry|null, meta:{deleted,updatedAt}}
     readBackup(entry,'current'|'previous') -> V2 backup object (throws when missing / corrupt) */
  async function planForm({row,dev,readBackup,sets,allSets,now}){
    const uid=row.formUid,isQ=row.kind==='qbank'||uid===Core.QBANK_UID,out={uid,formId:(row.local&&row.local.formId)||(row.cloud&&row.cloud.formId)||'',kind:isQ?'qbank':'form',v2State:row.state,v2Decision:V2_DECISION[row.state]||row.state,source:'none',reasons:[],fallback:false,waitsForForm:false,notes:[]};
    const cloud=row.cloud&&!row.cloud.deleted?row.cloud:null,cloudDeleted=!!(row.cloud&&row.cloud.deleted),local=row.local;
    const ex=async(progress,suspended,score,rec)=>Bridge.extractForm({formUid:uid,rec,progress,suspended,score,qbank:isQ,dev});
    let legacy=[],legacyEx=null,cloudProgress=null,wall=wallOf(row.cloud&&(row.cloud.updatedAt||row.cloud.modifiedTime),now);
    /* step 3: pick the source per form */
    if(cloud){
      if(row.state==='ALIGNED'&&local){out.source='indexeddb';cloudProgress=local.progress;}
      else{
        out.source='download';let backup=null,err=null;
        for(const which of ['current','previous']){try{backup=await readBackup(cloud,which);if(backup){if(which==='previous')out.notes.push('newest backup unreadable, used the previous version');break;}}catch(e){err=e;}}
        if(!backup){out.fallback=true;out.reasons.push('cloud backup unreadable: '+String(err&&err.message||err||'missing'));out.source='unreadable';}
        else cloudProgress=(backup.payload&&backup.payload.progress)||null;
        if(backup&&backup.payload&&!isQ&&backup.payload.threeDigitScore&&!out.fallback)out._cloudScore=backup.payload.threeDigitScore;
        if(backup&&backup.payload)out._cloudSuspended=backup.payload.suspended||null;
      }
    }else if(cloudDeleted)out.source='tombstone';
    /* step 4: cloud side -> replica v2legacy (stamps from the Drive entry's time) */
    if(cloudProgress){
      /* no catalog record here: the replica holds progress only, so it is identical on every device (library units come from the library manifest / each device's own replica) */
      legacyEx=await ex(cloudProgress,out._cloudSuspended||(local&&row.state==='ALIGNED'?local.suspended:null),out._cloudScore||(local&&row.state==='ALIGNED'?local.threeDigitScore:''),null);
      if(!legacyEx.complete){out.fallback=true;out.reasons.push('cloud progress has blocks without QIDs ('+legacyEx.problems.length+')');}
      legacy=stampUnits(legacyTm(legacyEx.units),wall,LEGACY_DEV);
    }
    if(cloudDeleted){
      legacy=stampUnits([{k:K.form(uid,'reset'),v:{at:Core.fmtStamp(wall,0,LEGACY_DEV)}}],wall,LEGACY_DEV);
      legacy[0].v={at:legacy[0].t};
    }
    /* step 5: this device's unsynced data -> own replica, stamped with the record's real modifiedAt */
    let own=[],ownEx=null;const unsynced=['LOCAL_ONLY','LOCAL_AHEAD_SAFE','DIVERGED','UNTRACKED_BOTH','DELETE_CONFLICT','BANK_HASH_MISMATCH'].includes(row.state)||(!cloud&&!cloudDeleted&&local);
    if(local&&unsynced&&!(row.meta&&row.meta.deleted)){
      ownEx=await ex(local.progress,local.suspended,local.threeDigitScore,local.rec);
      if(!ownEx.complete){out.fallback=true;out.reasons.push('local progress has blocks without QIDs ('+ownEx.problems.length+')');}
      const w=wallOf(local.modifiedAt,now),lm=mapOf(legacy);
      /* a value the cloud copy already holds is not re-stamped: an unchanged answer keeps the older stamp (it must not look like a change made after the block was completed) */
      const fresh=Bridge.localizeTm(ownEx.units,lm,dev).filter(u=>{
        if(Core.parseKey(u.k).field==='tm'&&u.v&&Object.values(u.v)[0]===0)return false;
        const c=lm[u.k];return !(c&&Core.ruleFor(u.k)!==Core.RULES.LOG&&Core.ruleFor(u.k)!==Core.RULES.TM&&canon(c.v)===canon(u.v));
      });
      own=stampUnits(fresh,w,dev);
    }
    if(row.meta&&row.meta.deleted){
      const w=wallOf(row.meta.updatedAt,now);
      own=own.concat(stampUnits([{k:K.form(uid,'reset'),v:{at:null}}],w,dev).map(u=>({k:u.k,v:{at:u.t},t:u.t})));
    }
    /* step 6: verify */
    const merged=Core.merge({},[legacy,own],{now:now}),vis=Core.view(merged.units,{now:now}).units,mc=Core.countUnits(vis);
    const cloudCounts=cloudProgress?Bridge.v2Counts(cloudProgress):null,localCounts=local&&!(row.meta&&row.meta.deleted)?Bridge.v2Counts(local.progress):null;
    const tomb=cloudDeleted||(row.meta&&row.meta.deleted)||Object.keys(merged.units).some(k=>k.endsWith('.reset')||k.endsWith('.del'));
    const need=maxCounts(cloudCounts,localCounts),short=LOWER.filter(k=>mc[k]<need[k]);
    out.counts={cloud:cloudCounts,local:localCounts,merged:mc,expected:need};
    /* a block completed on both sides with different answers: the earliest completer's whole answer set wins (decision 2026-10-26), so fewer answers than the other side is explained */
    const lmap=mapOf(legacy),omap=mapOf(own),dones=Object.keys(lmap).filter(k=>Core.parseKey(k).field==='done'&&Core.parseKey(k).fam==='B'&&omap[k]&&canon(lmap[k].v)!==canon(omap[k].v));
    const conflict=dones.length>0&&short.length>0;
    out.checks={counts:{ok:!short.length||tomb||conflict,short:(tomb||conflict)?[]:short,explainedByTombstone:!!tomb&&short.length>0,explainedByCompletedConflict:conflict?dones.length:0}};
    if(dones.length)out.notes.push('completed on both devices with different answers in '+dones.length+' block(s): the earliest completer\'s answers are kept');
    if(short.length&&!tomb&&!conflict){out.fallback=true;out.reasons.push('merged counts lower than V2 for '+short.join(', '));}
    const bad=unresolved([...legacy,...own],uid,sets,allSets);
    const rec=local&&local.rec;
    if(!isQ&&!sets&&(legacy.length||own.length)){out.waitsForForm=true;out.checks.qids={ok:true,checked:false,unresolved:[]};}
    else{out.checks.qids={ok:!bad.length,checked:true,unresolved:bad};if(bad.length){out.fallback=true;out.reasons.push(bad.length+' question id(s) do not resolve in the installed form');}}
    const sc=[];if(cloudProgress&&legacyEx)sc.push(scoreCheck(cloudProgress,legacy,legacyEx.keys,uid));if(local&&ownEx&&own.length)sc.push(scoreCheck(local.progress,own,ownEx.keys,uid));
    const checked=sc.reduce((n,x)=>n+x.checked,0),mism=sc.flatMap(x=>x.mismatches);
    out.checks.scores={ok:!mism.length,checked,mismatches:mism};
    if(mism.length){out.fallback=true;out.reasons.push('recomputed scores differ from V2 in '+mism.length+' block(s)');}
    /* V3 vs V2: what the merge did with two sides */
    const lm=mapOf(legacy),om=mapOf(own),both=Object.keys(lm).filter(k=>om[k]),onlyCloud=Object.keys(lm).filter(k=>!om[k]).length,onlyLocal=Object.keys(om).filter(k=>!lm[k]).length;
    const conflicting=both.filter(k=>canon(lm[k].v)!==canon(om[k].v)).length;
    out.units={legacy:legacy.length,own:own.length,merged:Object.keys(merged.units).length,onlyCloud,onlyLocal,both:both.length,conflicting};
    out.v3Decision=cloudDeleted?'tombstone (progress reset) from the V2 deletion'
      :row.state==='DIVERGED'||row.state==='UNTRACKED_BOTH'?`merge both sides (${onlyLocal} units only here, ${onlyCloud} only in cloud, ${conflicting} conflicting, newest wins)`
      :cloud&&!own.length?'units from the V2 cloud backup'+(out.source==='indexeddb'?' (read from this device)':'')
      :!cloud&&own.length?'this device\'s units become its replica':'nothing to do';
    out.ok=!out.fallback;
    delete out._cloudScore;delete out._cloudSuspended;
    out.unitsPreview={legacy,own};     // dropped from the stored report (kept in memory for tests)
    return out;
  }

  /* step 2: a local copy of all progress before V3 touches anything (kept 30 days; once per migration, never overwritten while valid) */
  async function ensurePreV3Recovery({store,rows,now}){
    now=now==null?Date.now():now;
    const cur=await store.getRaw('preV3Recovery',null);
    if(cur&&Date.parse(cur.expiresAt)>now)return {created:false,forms:Object.keys(cur.forms||{}).length,expiresAt:cur.expiresAt};
    const forms={};
    for(const r of rows)if(r.local&&(r.local.progress||r.local.suspended||r.local.threeDigitScore))forms[r.formUid||r.key]={formId:r.local.formId||'',progress:r.local.progress||null,suspended:r.local.suspended||null,threeDigitScore:r.local.threeDigitScore||''};
    const rec={createdAt:new Date(now).toISOString(),expiresAt:new Date(now+KEEP_DAYS*86400000).toISOString(),forms};
    await store.setRaw('preV3Recovery',rec);
    return {created:true,forms:Object.keys(forms).length,expiresAt:rec.expiresAt};
  }

  /* the whole shadow run. rows come from the V2 analysis; a missing local record is `local:null`. */
  async function planShadow({dev,rows,readBackup,recs,now,gateState,manifest}){
    now=now==null?Date.now():now;
    const g=gate(gateState||{}),allSets={};
    for(const r of recs||[])allSets[String(r.formUid||r.id)]=qidSet(r);
    const forms=[];
    for(const row of rows){
      const uid=row.formUid||row.key,isQ=row.kind==='qbank'||uid===Core.QBANK_UID;
      forms.push(await planForm({row:{...row,formUid:isQ?Core.QBANK_UID:uid},dev,readBackup,sets:isQ?null:allSets[uid]||null,allSets,now}));
    }
    const fallback=forms.filter(f=>f.fallback),waiting=forms.filter(f=>f.waitsForForm);
    const report={mode:'shadow',at:new Date(now).toISOString(),dev,gate:g,v2:{entries:rows.filter(r=>r.cloud).length,manifestUpdatedAt:manifest&&manifest.updatedAt||'',schema:manifest&&manifest.schemaVersion||null},
      forms:forms.map(f=>{const {unitsPreview,...rest}=f;return rest;}),
      totals:{forms:forms.length,ok:forms.filter(f=>f.ok).length,fallback:fallback.length,waitingForForm:waiting.length,fromThisDevice:forms.filter(f=>f.source==='indexeddb').length,downloaded:forms.filter(f=>f.source==='download').length,tombstones:forms.filter(f=>f.source==='tombstone').length},
      keepUntil:new Date(now+KEEP_DAYS*86400000).toISOString(),wroteToDrive:false};
    return {report,forms};
  }

  /* ---------------- live migration (Release B, plan section 8 steps 1-9) ---------------- */
  const MARKER='v3.migration.json',ARCHIVE='v2.archive.manifest.json',STALE_MS=10*60000,SIXTY_DAYS=60*86400000;
  const iso=ms=>new Date(ms).toISOString();
  async function readMarker(drive){
    const f=(await drive.listByName(MARKER))[0];if(!f)return null;
    try{return {...(await drive.downloadJson(f.id,MARKER)),_id:f.id};}catch(e){return null;}
  }
  async function writeMarker(drive,m){const {_id,...rest}=m;await drive.upload(MARKER,rest);}
  /* V2's own progress files on Drive (the library backup files are not part of this) */
  async function v2Inventory(drive){
    const all=await drive.list("name contains 'exam-simulator2.' and trashed = false");
    return all.filter(f=>!/\.library\./.test(f.name)&&!/^LIB_/.test(f.name)).map(f=>({id:f.id,name:f.name,md5:f.md5Checksum||'',modifiedTime:f.modifiedTime||''}));
  }
  /* freeze V2: keep a copy of the manifest, replace it with a stub that old apps reject (they stop without writing) */
  /* per-form fallback: forms that cannot move yet keep syncing through V2 with their own manifest (the main one becomes the stub) */
  const FALLBACK_MANIFEST='v2.fallback.manifest.json';
  function fallbackManifestOf(manifest,keys,qbank){
    const m=JSON.parse(JSON.stringify(manifest||{}));
    m.forms=Object.fromEntries(Object.entries(m.forms||{}).filter(([k,e])=>keys.includes(k)||keys.includes(String(e&&e.formUid||''))));
    if(!qbank)m.qbank=null;
    return m;
  }
  async function freezeV2({drive,manifestName,manifestType,appId,fallback}){
    if(fallback&&(fallback.keys.length||fallback.qbank))await drive.upload(FALLBACK_MANIFEST,fallbackManifestOf(fallback.manifest,fallback.keys,fallback.qbank));
    const m=(await drive.listByName(manifestName))[0];
    if(m){
      for(const old of await drive.listByName(ARCHIVE))await drive.remove(old.id);
      await drive.copy(m.id,ARCHIVE);
    }
    await drive.upload(manifestName,{type:manifestType,schemaVersion:3,appId,movedTo:'v3',movedAt:iso(Date.now())});
  }
  /* the V2 side of the migration in the browser: analysis, backups, inventory, freeze, switching V2 off on this device */
  function makeV2Adapter({R,drive}){
    return {
      async analyze(){
        const a=await R.sync.analyze({flush:false,yieldBetween:true}),recs=(a.local.catalog||{forms:[]}).forms||[],byUid=new Map(recs.map(r=>[String(r.formUid||r.id),r]));
        const rows=a.summary.rows.map(r=>{
          const l=r.local,uid=r.key===R.backupModel.qbankKey?Core.QBANK_UID:String((l&&l.formUid)||(r.cloud&&r.cloud.formUid)||r.key);
          return {key:r.key,formUid:uid,kind:r.key===R.backupModel.qbankKey?'qbank':'form',state:r.state,cloud:r.cloud,meta:r.meta,
            local:l?{formId:l.formId||'',progress:l.progress||null,suspended:l.suspended||null,threeDigitScore:l.threeDigitScore||'',modifiedAt:l.modifiedAt||'',rec:byUid.get(uid)||null}:null};
        });
        return {rows,recs,manifest:a.manifest};
      },
      async readBackup(entry,which){
        const id=which==='previous'?entry.previousDriveFileId:entry.driveFileId;if(!id)throw new Error('no '+which+' version');
        const text=await drive.downloadText(id),obj=JSON.parse(text);
        R.storage.validateBackup(obj,entry);
        const h=obj.contentHash;if(entry.checksum&&h&&h!==entry.checksum&&which==='current')throw new Error('checksum differs from the manifest');
        return obj;
      },
      files:()=>v2Inventory(drive),
      normalize:raw=>R.sync.migrateManifest?R.sync.migrateManifest(raw):raw,
      freeze:(fallback)=>freezeV2({drive,manifestName:R.config.MAIN_MANIFEST_FILE||R.config.MANIFEST_FILE,manifestType:R.config.MANIFEST_TYPE,appId:R.config.CLOUD.appId,fallback}),
      async disable(){await R.meta.set('syncEnabled',false);await R.meta.set('sync3Live',true);},
      /* V2 keeps syncing only these forms (uids; the Qbank as a flag) through the fallback manifest; empty = V2 scope removed */
      async scope(uids){
        const key=R.config.V2_SCOPE_KEY||'exam-simulator2:v2Scope',forms=(uids||[]).filter(u=>u!==Core.QBANK_UID);
        try{if(uids&&uids.length)localStorage.setItem(key,JSON.stringify({manifest:FALLBACK_MANIFEST,forms,qbank:uids.includes(Core.QBANK_UID)}));else localStorage.removeItem(key);}catch(e){}
        await R.meta.set('sync3Live',true);
      }
    };
  }
  const gateOf=()=>{
    const rt=window.StepExamSyncBridge&&window.StepExamSyncBridge.runtime?window.StepExamSyncBridge.runtime():{};
    return {runtime:rt,committing:!!window.__STEP_FORM_UPDATE_COMMITTING};
  };
  /* Runs the whole migration for this device. ctx = {store, drive, engine, cycle, applier, v2, gateState, now, onProgress, localRows}
     Returns {status: 'waiting'|'other-device'|'paused'|'done', ...}. Every step is idempotent: a crash resumes. */
  async function runMigration(ctx){
    const {store,drive,engine,cycle,applier,v2}=ctx,now=ctx.now||Date.now,progress=ctx.onProgress||(()=>{});
    const dev=await store.deviceId();
    const g=gate(ctx.gateState||{});if(!g.ok){await store.setMigration({status:'waiting',reasons:g.reasons,at:iso(now())});return {status:'waiting',reasons:g.reasons};}
    const marker=await readMarker(drive);
    if(marker&&marker.status==='done')return joinDevice(ctx,marker);
    if(marker&&marker.status==='in-progress'&&marker.by!==dev&&now()-Date.parse(marker.heartbeat||0)<STALE_MS)return {status:'other-device',by:marker.by};
    progress({step:'plan',done:0,total:1,label:'Checking your forms'});
    await store.setMigration({status:'running',at:iso(now())});
    const an=await v2.analyze();
    const recovery=await ensurePreV3Recovery({store,rows:an.rows,now:now()});
    const plan=await planShadow({dev,rows:an.rows,readBackup:v2.readBackup,recs:an.recs,now:now(),gateState:ctx.gateState,manifest:an.manifest});
    plan.report.preV3Recovery=recovery;await store.addDiag(plan.report);
    /* per-form fallback (plan section 8 step 8): forms that cannot be converted stay on V2 (their own manifest) and are retried every
       launch; the rest moves. Only when nothing can move does the upgrade pause. */
    const fbForms=plan.forms.filter(f=>f.fallback),fbUids=fbForms.map(f=>f.uid);
    if(fbForms.length&&fbForms.length===plan.forms.length){
      const names=fbForms.map(f=>f.formId||f.uid);
      await store.setMigration({status:'paused',at:iso(now()),reason:'These forms cannot be converted yet: '+names.join(', ')+'. The current sync keeps working.',totals:plan.report.totals});
      return {status:'paused',reason:'fallback',forms:names,report:plan.report};
    }
    await store.setRaw('fallbackForms',fbUids);           // the engine and the cycle leave these forms to V2
    const at=iso(now()),beat=async(extra)=>writeMarker(drive,{status:'in-progress',by:dev,heartbeat:iso(now()),at,keepUntil:null,v2Files:[],fallback:[],...(extra||{})});
    await beat();
    const total=plan.forms.length+3;let n=0;
    // legacy replica, one file per form (byte-identical whichever device writes it)
    const allLegacy=[],allOwn=[],dirtyUids=new Set();
    for(const f of plan.forms){
      if(f.fallback)continue;
      progress({step:'legacy-start',uid:f.uid,done:n,total,label:'Upgrading sync · '+n+' of '+plan.forms.length+' forms'});
      const legacy=f.unitsPreview.legacy,own=f.unitsPreview.own;
      if(legacy.length){await drive.upload(Drive_N.form(LEGACY_DEV,f.uid),{dev:LEGACY_DEV,units:legacy});allLegacy.push(...legacy);}
      if(own.length){allOwn.push(...own);dirtyUids.add(f.uid);}
      progress({step:'legacy',uid:f.uid,done:++n,total,label:'Upgrading sync · '+n+' of '+plan.forms.length+' forms'});
    }
    await beat();
    const prior=await store.known();
    const merged=Core.merge(prior,[allLegacy,allOwn],{now:now()});
    await store.setKnown(Object.fromEntries(Object.entries(merged.units).map(([k,u])=>[k,{v:u.v,t:u.t}])));
    for(const uid of dirtyUids)await store.markDirty('form',uid);
    await store.markDirty('lib');
    // bring the merged state into the app (V2 DIVERGED forms now hold both sides), then the normal cycle pushes this device's replica
    await applier.prepare();
    const vis=Core.view(merged.units,{now:now()}).units,seenAll=await store.getRaw('seenLocal',{}),seenF=await store.getRaw('seenForms',{});
    /* forms can be used while the upgrade runs: a form that is open, or was changed since the plan, is not written now; the cycle
       right after stamps those local changes first and applies the form (open blocks wait until they are left) */
    const later=new Set(await store.getRaw('pendingForms',[])),touchedNow=ctx.changedDuring?ctx.changedDuring():new Set();
    for(const f of plan.forms){
      if(f.fallback)continue;
      if(applier.isOpenBlock(f.uid)||touchedNow.has(f.uid)){later.add(f.uid);continue;}
      if(f.uid===Core.QBANK_UID){await applier.applyQbank({units:merged.units,vis});continue;}
      const r=await applier.applyForm({uid:f.uid,units:merged.units,vis});
      if(applier.hasForm(f.uid)){seenF[f.uid]=1;}
      const ids=Object.keys(vis).map(Core.parseKey).filter(p=>p.fam==='A'&&p.field===''&&String(vis[K.att(p.att)].v.formUid)===f.uid).map(p=>p.att);
      if(ids.length&&!(r&&r.waiting)){seenAll[f.uid]=seenAll[f.uid]||{};ids.forEach(a=>{seenAll[f.uid][a]=1;});}
    }
    await store.setRaw('seenLocal',seenAll);await store.setRaw('seenForms',seenF);await store.setRaw('pendingForms',[...later]);
    await keepOwnOnly(store,prior,plan.forms.filter(f=>later.has(f.uid)));
    progress({step:'push',done:++n,total,label:'Upgrading sync · uploading'});
    const rep=await cycle.run({reason:'migration',content:false});
    if(rep.pushError||Object.keys(rep.failed).length||!(await store.bootstrapped())){
      await store.setMigration({status:'paused',at:iso(now()),reason:rep.pushError||'Some changes could not be applied yet; will retry.'});
      return {status:'paused',reason:'push',report:rep};
    }
    await beat();
    const files=await v2.files();
    progress({step:'freeze',done:++n,total,label:'Upgrading sync · finishing'});
    const fbKeys=an.rows.filter(r=>fbUids.includes(r.formUid)&&r.kind!=='qbank').map(r=>r.key);
    await v2.freeze({manifest:an.manifest,keys:fbKeys,qbank:fbUids.includes(Core.QBANK_UID)});
    if(fbUids.length)await v2.scope(fbUids);else await v2.disable();
    const after=await v2.files();                                           // the stub manifest has a new checksum: record it as the expected state
    await writeMarker(drive,{status:'done',by:dev,heartbeat:iso(now()),at,keepUntil:iso(now()+KEEP_DAYS*86400000),v2Files:after.length?after:files,v2Devices:[...new Set(an.rows.map(r=>r.cloud&&r.cloud.deviceId).filter(Boolean))],fallback:fbUids});
    const fbNames=fbForms.map(f=>({uid:f.uid,formId:f.formId||f.uid,reasons:f.reasons||[]}));
    await store.setMigration({status:'done',at:iso(now()),keepUntil:iso(now()+KEEP_DAYS*86400000),totals:plan.report.totals,fallback:fbNames});
    progress({step:'done',done:total,total,label:'Sync upgraded'});
    return {status:'done',report:plan.report,cycle:rep,fallback:fbNames};
  }
  /* every later device: its own unsynced data is stamped with the real modification times, merged with the cloud, applied, pushed */
  async function joinDevice(ctx,marker){
    const {store,drive,cycle,applier,v2}=ctx,now=ctx.now||Date.now,progress=ctx.onProgress||(()=>{});
    await store.setMigration({status:'running',at:iso(now())});
    progress({step:'join',done:0,total:2,label:'Upgrading sync'});
    const rows=ctx.localRows?await ctx.localRows():[];
    const recovery=await ensurePreV3Recovery({store,rows,now:now()});
    const before={};for(const r of rows)if(r.local&&r.local.progress)before[r.formUid]=Bridge.v2Counts(r.local.progress);
    const fb=marker.fallback||[];
    await store.setRaw('fallbackForms',fb);                                   // forms still on V2 are not read or written by V3 here
    for(const u of fb)delete before[u];
    const rep=await cycle.run({reason:'join',content:false});
    if(rep.pushError||Object.keys(rep.failed).length||!(await store.bootstrapped())){
      await store.setMigration({status:'paused',at:iso(now()),reason:rep.pushError||'Some changes could not be applied yet; will retry.',recovery});
      return {status:'paused',report:rep};
    }
    const after={};
    if(ctx.localRows)for(const r of await ctx.localRows())if(r.local&&r.local.progress)after[r.formUid]=Bridge.v2Counts(r.local.progress);
    const short=[];for(const u of Object.keys(before)){const b=before[u],a=after[u]||{};const miss=LOWER.filter(k=>(a[k]||0)<(b[k]||0));if(miss.length)short.push({uid:u,miss});}
    if(fb.length&&v2&&v2.scope)await v2.scope(fb);else if(v2&&v2.disable)await v2.disable();
    await store.setMigration({status:'done',at:iso(now()),keepUntil:marker.keepUntil,attention:short,recovery,fallback:fb.map(u=>({uid:u,formId:u,reasons:[]}))});
    progress({step:'done',done:2,total:2,label:'Sync upgraded'});
    return {status:'done',report:rep,attention:short};
  }
  /* a form whose apply was skipped (open / changed during the upgrade): the device's sync record keeps only its own units for it, so the
     next scan does not read the cloud-only values it has not applied yet as values the user cleared; the cloud part arrives by the cycle */
  async function keepOwnOnly(store,prior,forms){
    if(!forms.length)return;
    const kn=await store.known();
    for(const f of forms){
      const keys=new Set([...f.unitsPreview.legacy,...f.unitsPreview.own].map(u=>u.k)),sub={};
      for(const k of keys)if(prior[k])sub[k]=prior[k];
      const m=Core.merge(sub,[f.unitsPreview.own.filter(u=>keys.has(u.k))],{now:Date.now()}).units;
      for(const k of keys){if(m[k])kn[k]={v:m[k].v,t:m[k].t};else delete kn[k];}
    }
    await store.setKnown(kn);
  }
  /* every launch while forms are in fallback: follow the marker's list (another device may have moved some), then try to move this
     device's fallback forms again: V2 (scoped) analyzes only them, the same planner decides, passing forms join V3 */
  async function retryFallback(ctx){
    const {store,drive,cycle,applier,v2}=ctx,now=ctx.now||Date.now,dev=await store.deviceId();
    const marker=await readMarker(drive);
    if(!marker||marker.status!=='done')return {status:'none'};
    let list=marker.fallback||[];
    const had=await store.getRaw('fallbackForms',[]);
    await store.setRaw('fallbackForms',list);
    if(!list.length){if(had.length&&v2.scope){await v2.scope([]);await v2.disable();}return {status:'none'};}
    if(v2.scope)await v2.scope(list);
    const g=gate(ctx.gateState||{});if(!g.ok)return {status:'waiting',reasons:g.reasons,fallback:list};
    const an=await v2.analyze(),rows=an.rows.filter(r=>list.includes(r.formUid));
    const plan=await planShadow({dev,rows,readBackup:v2.readBackup,recs:an.recs,now:now(),gateState:ctx.gateState,manifest:an.manifest});
    await store.addDiag({...plan.report,mode:'fallback-retry'});
    const moved=plan.forms.filter(f=>!f.fallback);
    if(!moved.length)return {status:'kept',fallback:list,report:plan.report};
    const legacy=[],own=[],ids=moved.map(f=>f.uid);
    for(const f of moved){if(f.unitsPreview.legacy.length){await drive.upload(Drive_N.form(LEGACY_DEV,f.uid),{dev:LEGACY_DEV,units:f.unitsPreview.legacy});legacy.push(...f.unitsPreview.legacy);}own.push(...f.unitsPreview.own);}
    const prior=await store.known();
    const merged=Core.merge(prior,[legacy,own],{now:now()});
    await store.setKnown(Object.fromEntries(Object.entries(merged.units).map(([k,u])=>[k,{v:u.v,t:u.t}])));
    for(const f of moved)if(f.unitsPreview.own.length)await store.markDirty('form',f.uid);
    await store.markDirty('lib');
    const left=list.filter(u=>!ids.includes(u));
    await store.setRaw('fallbackForms',left);
    await applier.prepare();
    const vis=Core.view(merged.units,{now:now()}).units;
    const later=new Set(await store.getRaw('pendingForms',[])),touchedNow=ctx.changedDuring?ctx.changedDuring():new Set();
    for(const f of moved){if(applier.isOpenBlock(f.uid)||touchedNow.has(f.uid)){later.add(f.uid);continue;}if(f.uid===Core.QBANK_UID)await applier.applyQbank({units:merged.units,vis});else await applier.applyForm({uid:f.uid,units:merged.units,vis});}
    await store.setRaw('pendingForms',[...later]);
    await keepOwnOnly(store,prior,moved.filter(f=>later.has(f.uid)));
    const rep=await cycle.run({reason:'fallback-retry',content:false});
    if(rep.pushError||Object.keys(rep.failed).length){await store.setRaw('fallbackForms',list);return {status:'paused',report:rep,fallback:list};}   // V2 keeps them until the push works
    const cur=await readMarker(drive)||marker,fbNow=(cur.fallback||[]).filter(u=>!ids.includes(u));
    await writeMarker(drive,{...cur,fallback:fbNow,...(fbNow.length?{}:{v2Files:await v2Inventory(drive)})});      // last one moved: the V2 files as they are now are the cleanup baseline
    await store.setRaw('fallbackForms',fbNow);
    if(fbNow.length)await v2.scope(fbNow);else{await v2.scope([]);await v2.disable();}
    const m=await store.migration();await store.setMigration({...m,fallback:(m.fallback||[]).filter(x=>!ids.includes(x.uid))});
    return {status:'moved',moved:ids,fallback:fbNow,report:rep};
  }
  const Drive_N=(typeof window!=='undefined'&&window.StepSync3Drive?window.StepSync3Drive.N:(typeof require==='function'?require('./sync3-drive.js').N:null));

  /* cleanup (plan section 8): only after keepUntil, only when nothing changed in V2 since, every V2 device has been seen on V3 (or 60 days), no fallback */
  /* does a V2 file belong to one of these forms (uids, the Qbank as __QBANK__)? V2 names backups <prefix>.form.<safeName(uid)>.<version>.json */
  const v2Safe=v=>String(v||'FORM').replace(/[^a-z0-9._-]+/gi,'_').replace(/^_+|_+$/g,'').slice(0,80)||'FORM';
  function v2FileOf(name,uids){
    for(const u of uids){
      if(u===Core.QBANK_UID){if(/^exam-simulator2\.qbank\.[^.]+\.json$/.test(name))return true;continue;}
      const pre='exam-simulator2.form.'+v2Safe(u)+'.';if(name.startsWith(pre)&&/^[^.]+\.json$/.test(name.slice(pre.length)))return true;
    }
    return false;
  }
  async function runCleanup({store,drive,now=Date.now}){
    const marker=await readMarker(drive);
    if(!marker||marker.status!=='done')return {status:'not-migrated'};
    const t=now();
    if(marker.cleaned)return {status:'cleaned'};
    if(t<Date.parse(marker.keepUntil))return {status:'kept',until:marker.keepUntil};
    /* while forms are in fallback their V2 files (and the shared V2 history) keep changing: only the moved forms' files are cleaned */
    const fb=marker.fallback||[],partial=fb.length>0;
    const all=await v2Inventory(drive),stillV2=f=>partial&&(v2FileOf(f.name,fb)||/\.progress-history\.json$/.test(f.name)),cur=all.filter(f=>!stillV2(f));
    const was=new Map((marker.v2Files||[]).map(f=>[f.name,f]));
    const changed=cur.filter(f=>f.name!==ARCHIVE&&(!was.has(f.name)||was.get(f.name).md5!==f.md5));
    if(changed.length){
      await writeMarker(drive,{...marker,keepUntil:iso(t+KEEP_DAYS*86400000),v2Changed:changed.map(f=>f.name)});
      return {status:'v2-changed',files:changed.map(f=>f.name)};
    }
    const devFiles=(await drive.listV3()).filter(f=>/^v3\.dev\./.test(f.name));
    const seen=new Set();
    for(const f of devFiles){try{const j=await drive.downloadJson(f.id,f.name);if(j&&Date.parse(j.lastSeen||0)>=Date.parse(marker.at)&&j.appVersion)seen.add(j.deviceId);}catch(e){}}
    const waiting=(marker.v2Devices||[]).filter(d=>!seen.has(d)&&!devFiles.some(f=>f.name.includes(d)));
    if(waiting.length&&t-Date.parse(marker.at)<SIXTY_DAYS)return {status:'kept',reason:'devices not seen on V3 yet',devices:waiting};
    const removed=[];
    if(partial){
      /* moved forms' backup files only; the manifest stub, archive and fallback manifest stay until the last fallback form moves */
      for(const f of cur){if(!/^exam-simulator2\.(form|qbank)\./.test(f.name))continue;try{await drive.remove(f.id);removed.push(f.name);}catch(e){}}
      await writeMarker(drive,{...marker,v2Files:all.filter(f=>!removed.includes(f.name)),partialCleanedAt:iso(t)});
      const log=await store.getRaw('cleanupLog',[]);log.push({at:iso(t),removed,partial:true});await store.setRaw('cleanupLog',log);
      return {status:'partial',removed,fallback:fb};
    }
    for(const f of cur){try{await drive.remove(f.id);removed.push(f.name);}catch(e){}}
    for(const f of [...await drive.listByName(ARCHIVE),...await drive.listByName(FALLBACK_MANIFEST)]){try{await drive.remove(f.id);removed.push(f.name);}catch(e){}}
    await writeMarker(drive,{...marker,cleaned:true,cleanedAt:iso(t)});
    const log=await store.getRaw('cleanupLog',[]);log.push({at:iso(t),removed});await store.setRaw('cleanupLog',log);
    await store.setRaw('preV3Recovery',null);
    return {status:'cleaned',removed};
  }
  /* local copies the device removes by itself once the 30 days are over (the V2 files are handled by runCleanup) */
  async function expireRecovery({store,now=Date.now}){
    const r=await store.getRaw('preV3Recovery',null);
    if(r&&Date.parse(r.expiresAt)<now()){await store.setRaw('preV3Recovery',null);return true;}
    return false;
  }
  /* restore from the pre-upgrade local copy: written as NEW units stamped now (so the restore wins everywhere); deleted attempts come back */
  /* restore (plan section 8, 30 days): a source's per-form progress is written as NEW units stamped now, so the restore wins on every
     device. Sources: this device's pre-upgrade copy (`preV3Recovery`) or the V2 archive on Drive (`v2.archive.manifest.json` + backups). */
  async function restoreFromRecovery({store,applier,getRec,resolveRefs,uids,now=Date.now,sha256}){
    const rec=await store.getRaw('preV3Recovery',null);if(!rec)throw new Error('There is no pre-upgrade backup on this device.');
    return restoreForms({store,applier,getRec,resolveRefs,uids,now,sha256,forms:rec.forms||{}});
  }
  async function readArchive({drive,normalize}){
    const f=(await drive.listByName(ARCHIVE))[0];if(!f)return {at:'',entries:[]};
    const raw=await drive.downloadJson(f.id,'V2 archive manifest'),m=normalize?normalize(raw):raw,entries=[];
    for(const [k,e] of Object.entries(m&&m.forms||{}))if(e&&!e.deleted&&(e.driveFileId||e.previousDriveFileId))entries.push({uid:String(e.formUid||k),formId:String(e.formId||e.formUid||k),updatedAt:e.updatedAt||'',entry:{kind:'form',...e}});
    if(m&&m.qbank&&!m.qbank.deleted&&(m.qbank.driveFileId||m.qbank.previousDriveFileId))entries.push({uid:Core.QBANK_UID,formId:'Qbank',updatedAt:m.qbank.updatedAt||'',entry:{...m.qbank,kind:'qbank'}});
    return {at:f.modifiedTime||'',entries};
  }
  /* each archived backup: the version the manifest pointed at, else the one before it */
  async function readArchiveForms({entries,readBackup,uids}){
    const forms={},errors={};
    for(const x of entries){
      if(uids&&uids.length&&!uids.includes(x.uid))continue;
      let b=null;
      for(const which of ['current','previous']){try{b=await readBackup(x.entry,which);break;}catch(e){errors[x.uid]=String(e&&e.message||e);}}
      if(!b||!b.payload)continue;
      delete errors[x.uid];
      forms[x.uid]={formId:x.formId,progress:b.payload.progress||null,suspended:b.payload.suspended||null,threeDigitScore:b.payload.threeDigitScore||''};
    }
    return {forms,errors};
  }
  async function restoreFromArchive({store,drive,applier,getRec,resolveRefs,uids,now=Date.now,sha256,readBackup,normalize}){
    const a=await readArchive({drive,normalize});
    if(!a.entries.length)throw new Error('There is no old-sync archive on Google Drive (the cleanup removes it 30 days after the upgrade).');
    const src=await readArchiveForms({entries:a.entries,readBackup,uids});
    if(!Object.keys(src.forms).length)throw new Error('The archived backups could not be read: '+Object.values(src.errors).join('; '));
    const r=await restoreForms({store,applier,getRec,resolveRefs,uids:Object.keys(src.forms),now,sha256,forms:src.forms});
    return {...r,errors:src.errors};
  }
  async function restoreForms({store,applier,getRec,resolveRefs,uids,now=Date.now,sha256,forms}){
    const dev=await store.deviceId(),known=await store.known(),want=uids&&uids.length?uids:Object.keys(forms),done=[];
    for(const uid of want){
      const f=forms[uid];if(!f)continue;
      const r=getRec?getRec(uid):null;
      /* attempts that are deleted / reset now come back as NEW attempts (their old units are hidden for good); attempts that still exist are patched in place */
      const vis=Core.view(known,{now:now()}).units,prog=JSON.parse(JSON.stringify(f.progress||{}));
      const bundle=prog.bundle&&Array.isArray(prog.bundle.attempts)?prog.bundle:null;
      if(bundle){
        const rename={};
        for(const a of bundle.attempts){
          const id=String(a.attemptId||(a.session&&a.session.attemptId)||'');if(!id)continue;
          if(vis[K.att(uid+':'+id)])continue;
          let nid=id+'~restored',n=1;while(known[K.att(uid+':'+nid)]||vis[K.att(uid+':'+nid)])nid=id+'~restored'+(++n);
          rename[id]=nid;a.attemptId=nid;if(a.session)a.session.attemptId=nid;a.label=(a.label||id)+' (restored)';if(a.session)a.session.attemptLabel=a.label;
        }
        if(rename[bundle.activeAttemptId])bundle.activeAttemptId=rename[bundle.activeAttemptId];
      }
      const ex=await Bridge.extractForm({formUid:uid,rec:r,progress:prog,suspended:f.suspended,score:f.threeDigitScore,qbank:uid===Core.QBANK_UID,dev,sha256,resolveRefs:resolveRefs&&r?resolveRefs(r):undefined});
      if(!ex.complete)throw new Error('Pre-upgrade copy of '+uid+' cannot be restored yet (question ids pending).');
      const units=Bridge.localizeTm(ex.units,known,dev).filter(u=>{const p=Core.parseKey(u.k);return !(p.fam==='A'&&p.field==='')||!vis[u.k];});
      const list=units,st=await store.stamps(list.length);
      const mk=list.map((u,i)=>{
        if(Core.ruleFor(u.k)===Core.RULES.LOG)return {k:u.k,v:(u.v||[]).map((e,j)=>({...e,t:Core.fmtStamp(Core.parseStamp(st[i]).wall,Core.parseStamp(st[i]).counter*1000+j,dev)})),t:st[i]};
        return {k:u.k,v:u.v,t:st[i]};
      });
      const merged=Core.merge(known,[mk],{now:now()});
      for(const [k,u] of Object.entries(merged.units))known[k]={v:u.v,t:u.t};
      done.push(uid);
    }
    await store.setKnown(known);for(const uid of done)await store.markDirty(uid===Core.QBANK_UID?'form':'form',uid);
    if(applier){const vis=Core.view(known,{now:now()}).units;for(const uid of done){if(uid===Core.QBANK_UID)await applier.applyQbank({units:known,vis});else await applier.applyForm({uid,units:known,vis});}}
    return {restored:done};
  }

  /* browser wrapper for the shadow check: V2 analysis (read-only) + Drive reads -> planShadow -> diagnostics store. Never writes Drive. */
  async function runShadow({store,drive,R,now=Date.now}){
    const v2=makeV2Adapter({R,drive}),dev=await store.deviceId(),a=await v2.analyze();
    const g=gateOf();let baseline=false;try{baseline=!!(await R.meta.get('qidMigrationPendingBaseline',null));}catch(e){}
    const recovery=await ensurePreV3Recovery({store,rows:a.rows,now:now()});
    const out=await planShadow({dev,rows:a.rows,readBackup:v2.readBackup,recs:a.recs,now:now(),gateState:{runtime:g.runtime,qidBaselinePending:baseline,committing:g.committing},manifest:a.manifest});
    out.report.preV3Recovery=recovery;
    await store.addDiag(out.report);
    await store.setMigration({status:'shadow',at:out.report.at,totals:out.report.totals});
    return out.report;
  }
  return {gate,gateOf,stampUnits,planForm,planShadow,runShadow,runMigration,joinDevice,retryFallback,runCleanup,v2FileOf,readArchive,readArchiveForms,restoreFromArchive,restoreForms,fallbackManifestOf,FALLBACK_MANIFEST,expireRecovery,restoreFromRecovery,makeV2Adapter,freezeV2,v2Inventory,readMarker,writeMarker,MARKER,ARCHIVE,ensurePreV3Recovery,qidSet,scoreCheck,LEGACY_DEV,KEEP_DAYS,V2_DECISION};
});

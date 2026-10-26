/* Sync V3 engine, shadow mode (SYNC_HYBRID_PLAN.md sections 3, 5 and 11 Release A): stamping by diff and the bootstrap gate.
   The app's write paths are untouched: after a progress write the form is extracted again, compared with `known`
   (the last unit map) and only changed values get a new stamp. Nothing is pushed to Drive in Release A; changes are
   counted and reported in diagnostics. (`merge` / `apply` of remote replicas arrive in Release B.) */
(function(root,factory){
  const req=n=>(typeof module==='object'&&module.exports)?require(n):null;
  const api=factory((typeof module==='object'&&module.exports)?req('./sync3-core.js'):root.StepSync3Core,(typeof module==='object'&&module.exports)?req('./sync3-bridge.js'):root.StepSync3Bridge);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.StepSync3Sync=api;
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:this),function(Core,Bridge){
  'use strict';
  const K=Core.K,canon=Core.canon;
  const DEFAULTS={ans:null,fl:false,st:[],hs:[],he:[],nt:'',sus:null};

  /* which replica file a unit lives in: lib (L, T), set (S) or one form (A, I, B, F) */
  function scopeOf(k,attForm){
    const p=Core.parseKey(k);
    if(p.fam==='L'||p.fam==='T')return {scope:'lib'};
    if(p.fam==='S')return {scope:'set'};
    if(p.fam==='F')return {scope:'form',uid:p.uid};
    if(p.fam==='A'||p.fam==='I'||p.fam==='B'){
      const uid=attForm[p.att]||(String(p.att).charAt(0)==='~'?String(p.att).slice(1):null);
      return uid?{scope:'form',uid}:{scope:'form',uid:'?'};
    }
    return {scope:'lib'};
  }
  const attFormOf=known=>{const m={};for(const [k,u] of Object.entries(known)){const p=Core.parseKey(k);if(p.fam==='A'&&p.field==='')m[p.att]=String(u.v&&u.v.formUid||'');}return m;};

  /* units of the current extract vs known: returns the units that need a stamp (value, defaults for cleared values, log entries) */
  function diffForm({uid,extract,known,dev,bootstrapped,visible,seen}){
    /* compare with what is VISIBLE: hidden units (deleted attempt, reset, a completed block's other answers) are not what the app shows */
    const vis=visible||Core.view(known).units;
    const attForm=attFormOf(known),next=new Map(extract.units.map(u=>[u.k,u]));
    const own=Object.keys(vis).filter(k=>{const s=scopeOf(k,attForm);return s.scope==='form'&&s.uid===uid;});
    const out=[],held=[],attemptsNow=new Set(extract.attempts);
    for(const u of Bridge.localizeTm(extract.units,known,dev)){
      const old=vis[u.k],rule=Core.ruleFor(u.k),f=Core.parseKey(u.k).field;
      if(!old){out.push(rule===Core.RULES.LOG?{k:u.k,v:u.v,logAppend:true}:{k:u.k,v:u.v});continue;}
      if(rule===Core.RULES.EARLIEST)continue;                                 // write-once: first answers, attempt headers
      if((rule===Core.RULES.TRUE||rule===Core.RULES.DONE)&&(old.v===true||(old.v&&old.v.done===true)))continue;
      if(rule===Core.RULES.LOG){
        const mine=Array.isArray(old.v)?old.v:[],have=mine.length,add=(u.v||[]).slice(have);
        if(add.length)out.push({k:u.k,v:add,logAppend:true});
        continue;
      }
      if(rule===Core.RULES.TM){const prev=(old.v||{})[dev];if((prev===undefined?0:prev)===u.v[dev])continue;      // other devices already hold all of this time: nothing of mine to add
      out.push({k:u.k,v:{[dev]:u.v[dev]}});continue;}
      if(canon(old.v)!==canon(u.v))out.push({k:u.k,v:u.v});
    }
    /* values that went back to their default (answer cleared, flag removed, strikes undone): an explicit unit, absence never deletes */
    for(const k of own){
      if(next.has(k))continue;
      const p=Core.parseKey(k),old=vis[k];
      if(!attemptsNow.has(p.att)&&p.att&&String(p.att).charAt(0)!=='~')continue;   // attempt gone: handled as a tombstone below
      if(p.fam==='I'&&Object.prototype.hasOwnProperty.call(DEFAULTS,p.field)&&canon(old.v)!==canon(DEFAULTS[p.field]))out.push({k,v:DEFAULTS[p.field]});
      else if(p.fam==='B'&&(p.field==='nt'||p.field==='sus')&&canon(old.v)!==canon(DEFAULTS[p.field]))out.push({k,v:DEFAULTS[p.field]});
    }
    /* deleted attempts / reset form (only when the extract is complete: attempts missing because their QIDs are pending are not deletions) */
    const tombs=[],uninstalled=known[K.lib(uid)]&&known[K.lib(uid)].v&&known[K.lib(uid)].v.on==='deleted';
    /* a form that is uninstalled (progress hidden) or was just re-installed has no progress on screen yet: that is not a delete; the next apply brings the units back */
    if(extract.complete&&!uninstalled){
      /* only attempts that are visible AND that this device has shown before can be deleted here: a wiped or re-installed device never deletes what it has not seen */
      const alive=Object.keys(vis).map(Core.parseKey).filter(p=>p.fam==='A'&&p.field===''&&String(vis[K.att(p.att)].v.formUid)===uid).map(p=>p.att);
      const gone=alive.filter(a=>!attemptsNow.has(a)&&(!seen||seen[a]));
      if(gone.length&&gone.length===alive.length&&!attemptsNow.size)tombs.push({k:K.form(uid,'reset'),v:{at:null}});
      else gone.forEach(a=>tombs.push({k:K.attField(a,'del'),v:{del:true}}));
    }
    if(!bootstrapped){held.push(...tombs);return {changes:out,tombstones:[],held};}
    return {changes:out,tombstones:tombs,held};
  }

  function create({store,source,now=()=>Date.now(),log=()=>{}}){
    /* one scan: every form + settings through `source`; stamped units go to `known`, the scope is marked dirty, nothing is pushed */
    async function scan({only}={}){
      const dev=await store.deviceId(),boot=await store.bootstrapped(),known=await store.known(),report={dev,at:new Date(now()).toISOString(),bootstrapped:boot,forms:{},settings:{changed:0},totals:{changed:0,tombstones:0,held:0,problems:0}};
      const local=await source.readForms(),fallback=new Set(await store.getRaw('fallbackForms',[]));      // forms still on V2 (per-form fallback): not V3's
      for(const uid of fallback)delete local.forms[uid];
      const visible=Core.view(known,{now:now()}).units,seenAll=await store.getRaw('seenLocal',{}),seenF=await store.getRaw('seenForms',{});
      if(!only)for(const uid of Object.keys(local.forms))seenF[uid]=1;else if(local.forms[only])seenF[only]=1;
      const touched=new Set(),dirtyScopes=new Set(),af=attFormOf(known),mark=k=>{const hp=Core.parseKey(k);if(hp.fam==='A'&&hp.field===''&&known[k]&&known[k].v)af[hp.att]=String(known[k].v.formUid||'');const sc=scopeOf(k,af);dirtyScopes.add(sc.scope==='form'?'form:'+sc.uid:sc.scope);};
      for(const [uid,f] of Object.entries(local.forms)){
        if(only&&only!==uid)continue;
        const d=diffForm({uid,extract:f.extract,known,dev,bootstrapped:boot,visible,seen:seenAll[uid]||{}});
        if(f.extract.attempts.length){seenAll[uid]=seenAll[uid]||{};for(const a of f.extract.attempts)seenAll[uid][a]=1;}
        const list=[...d.changes,...d.tombstones],logN=list.reduce((n,u)=>n+(u.logAppend?u.v.length:0),0);
        if(list.length){
          /* before this device's first pull its units carry the record's real modification time (older cloud data must not lose to stale local data, newer local work must win) */
          const nst=list.length+logN,st=(!boot&&f.modifiedAt)?Array.from({length:nst},(_,i)=>Core.fmtStamp(f.modifiedAt,i,dev)):await store.stamps(nst);let li=list.length;
          list.forEach((u,i)=>{
            let v=u.v;
            if(u.k.endsWith('.reset')&&v&&v.at===null)v={at:st[i]};
            if(u.logAppend){const prior=(known[u.k]&&known[u.k].v)||[];v=prior.concat(u.v.map(e=>({...e,t:st[li++]})));}
            const joined=Core.joinUnits(Core.ruleFor(u.k),known[u.k]?{k:u.k,v:known[u.k].v,t:known[u.k].t}:null,{k:u.k,v,t:st[i]},now());
            known[u.k]={v:joined.v,t:joined.t};mark(u.k);
          });
          touched.add(uid);
        }
        report.forms[uid]={changed:d.changes.length,tombstones:d.tombstones.length,held:d.held.length,problems:f.extract.problems.length,complete:f.extract.complete,attempts:f.extract.attempts.length};
        report.totals.changed+=d.changes.length;report.totals.tombstones+=d.tombstones.length;report.totals.held+=d.held.length;report.totals.problems+=f.extract.problems.length;
      }
      if(!only)for(const uid of Object.keys(seenAll))if(!local.forms[uid])delete seenAll[uid];      // a form that is not installed shows nothing: nothing is "seen" any more, re-installing it is not a delete
      /* a form that left the library (uninstalled): L.<uid>.on = deleted, its progress stays hidden (held before the first pull) */
      if(!only){
        for(const k of Object.keys(known)){
          const p=Core.parseKey(k);
          if(p.fam!=='L'||p.field!==''||!known[k].v||known[k].v.on!=='installed'||p.uid===Core.QBANK_UID||local.forms[p.uid]||!seenF[p.uid])continue;      // only a form this device has had can be uninstalled here (not one that still waits for its content)
          if(fallback.has(p.uid))continue;
          if(!boot){report.totals.held++;continue;}
          const [t]=await store.stamps(1);known[k]={v:{...known[k].v,on:'deleted'},t};delete seenF[p.uid];mark(k);report.totals.tombstones++;report.totals.changed++;
        }
      }
      if(!only&&source.readSettings){
        const cur=await source.readSettings();let n=0;
        /* before this device's first pull its settings are stamped as old: settings from the cloud win, local ones only fill gaps */
        for(const [k,v] of Object.entries(cur)){const old=known[k];if(!old||canon(old.v)!==canon(v)){const [s]=boot?await store.stamps(1):[Core.fmtStamp(1,n,dev)];known[k]={v,t:s};n++;mark(k);}}
        report.settings.changed=n;report.totals.changed+=n;
      }
      for(const sc of dirtyScopes){if(sc.startsWith('form:'))await store.markDirty('form',sc.slice(5));else await store.markDirty(sc);}
      await store.setKnown(known);await store.setRaw('seenLocal',seenAll);await store.setRaw('seenForms',seenF);
      return report;
    }
    return {scan,diffForm};
  }

  /* ---------------- the live cycle (Release B, SYNC_HYBRID_PLAN.md section 5) ----------------
     scan (stamp local changes) -> pull (one listing, changed replicas only) -> merge -> apply (recovery copy first, open blocks
     wait) -> push own dirty replicas (verified) -> snapshots. Failures never lose work: dirty stays, checksums of files whose
     changes could not be applied are not remembered, the next run retries with backoff.
     applier = {isOpenBlock(uid), hasForm(uid), recover(uids), applyForm({uid,units,vis}), applySettings(units, cls), isApplyingRemote()} */
  const BACKOFF_MS=[3*60000,6*60000,12*60000,30*60000];
  /* ---------------- form content (plan section 4: v3.c.*) ----------------
     A form that does not come from the update service travels as write-once content named by its bankHash `ch` (sha256 of
     the form file text): text in `v3.c.<ch>.pN.json`, every referenced asset as base64 in `v3.c.<sha256 of its bytes>.pN.json`,
     and the manifest `v3.c.<ch>.json`, uploaded LAST (it exists only when everything else does).
     content = {local():[{uid,ch}], read(uid):{meta,text,assets:[{path,sha,b64}]}, install({uid,meta,text,assets,bankHash}),
                sha256(text), v2Library?():[{path,fileId,contentHash,size}]} */
  const CONTENT_TYPE='step-sync3-content',CONTENT_BUDGET=32*1024*1024,HASH_RE=/^[0-9a-f]{16,}$/;
  const syncsContent=v=>!!(v&&v.on==='installed'&&(v.src==='custom'||v.src==='imported')&&HASH_RE.test(String(v.ch||'')));
  /* upload the content of local forms whose units point to it and that the Drive does not hold yet (budget per cycle; the rest next cycle) */
  async function pushContent({files,drive,Drive,content,store,known,budget=CONTENT_BUDGET}){
    const out={uploaded:[],copied:[],errors:{},deferred:0},names=new Set(files.map(f=>f.name)),done=await store.getRaw('contentDone',{});
    let used=0,v2=null;
    for(const {uid,ch} of await content.local()){
      if(!HASH_RE.test(String(ch||''))||done[ch])continue;
      if(names.has(Drive.N.content(ch))){done[ch]=1;continue;}
      const lib=known[K.lib(uid)];if(!syncsContent(lib&&lib.v)||lib.v.ch!==ch)continue;
      if(used>=budget){out.deferred++;continue;}
      try{
        const data=await content.read(uid);
        if(await content.sha256(data.text)!==ch)throw new Error('the form file does not match its hash');
        const assets=[];
        for(const a of data.assets||[]){
          const parts=drive.contentParts(a.sha,a.b64);
          for(const p of parts)if(!names.has(p.name)){await drive.upload(p.name,p.text);names.add(p.name);used+=p.text.length;}
          assets.push({p:a.path,h:a.sha,parts:parts.length});
        }
        const parts=drive.contentParts(ch,data.text);let copied=false;
        /* the V2 full-library backup may already hold this exact file: copy it on the server instead of uploading it again */
        if(parts.length===1&&!names.has(parts[0].name)&&content.v2Library){
          if(v2===null){try{v2=(await content.v2Library())||[];}catch(e){v2=[];}}
          const e=v2.find(x=>x&&x.contentHash===ch&&x.fileId);
          if(e){try{await drive.copy(e.fileId,parts[0].name);names.add(parts[0].name);copied=true;}catch(err){}}
        }
        for(const p of parts)if(!names.has(p.name)){await drive.upload(p.name,p.text);names.add(p.name);used+=p.text.length;}
        await drive.upload(Drive.N.content(ch),{type:CONTENT_TYPE,v:1,sha:ch,uid,meta:data.meta||{},parts:parts.length,assets});
        names.add(Drive.N.content(ch));done[ch]=1;(copied?out.copied:out.uploaded).push(uid);
      }catch(e){out.errors[uid]=String(e&&e.message||e);}
    }
    await store.setRaw('contentDone',done);
    return out;
  }
  /* a form missing here: download its content by hash, verify it and install it; {installed} or {waiting: reason} */
  async function fetchContent({uid,lib,files,drive,Drive,content}){
    const ch=lib.ch,byName=new Map(files.map(f=>[f.name,f])),man=byName.get(Drive.N.content(ch));
    if(!man)return {waiting:'content'};
    const m=await drive.downloadJson(man.id,'Form content manifest');
    if(!m||m.type!==CONTENT_TYPE||m.sha!==ch)throw new Error('the form content manifest is invalid');
    const join=async(sha,n)=>{let t='';for(let i=0;i<n;i++){const f=byName.get(Drive.N.content(sha,i));if(!f)throw new Error('a form content part is missing');t+=await drive.downloadText(f.id);}return t;};
    const text=await join(ch,Number(m.parts)||1);
    if(await content.sha256(text)!==ch)throw new Error('the downloaded form does not match its hash');
    const assets=[];for(const a of m.assets||[])assets.push({path:a.p,sha:a.h,b64:await join(a.h,Number(a.parts)||1)});
    const r=await content.install({uid,meta:m.meta||{},text,assets,bankHash:ch});
    return r&&r.installed?{installed:true}:{waiting:r&&r.conflict?'id-taken':r&&r.busy?'busy':'content'};
  }
  const day=ms=>{const d=new Date(ms);return d.getUTCFullYear()+String(d.getUTCMonth()+1).padStart(2,'0')+String(d.getUTCDate()).padStart(2,'0');};
  /* a device pushes what it authored: whole units it stamped, plus its own share of multi-author units (its log entries, its time) */
  function ownUnits(known,me,test){
    const out=[];
    for(const k of Object.keys(known)){
      if(!test(k))continue;
      const u=known[k],rule=Core.ruleFor(k);
      if(rule===Core.RULES.LOG){const own=(u.v||[]).filter(e=>(Core.parseStamp(e.t)||{}).dev===me);if(own.length)out.push({k,v:own,t:own[own.length-1].t});}
      else if(rule===Core.RULES.TM){if(u.v&&u.v[me]!==undefined)out.push({k,v:{[me]:u.v[me]},t:(Core.parseStamp(u.t)||{}).dev===me?u.t:Core.fmtStamp((Core.parseStamp(u.t)||{wall:0}).wall,0,me)});}
      else if((Core.parseStamp(u.t)||{}).dev===me)out.push({k,v:u.v,t:u.t});
    }
    return out;
  }
  function createCycle({store,drive,engine,applier,Drive,content=null,contentInBackground=false,now=()=>Date.now(),appVersion='',log=()=>{}}){
    const N=Drive.N,parse=Drive.parseName;
    let running=null,contentRunning=null;
    /* form content can be large (many image files): in the app it uploads in the background, so a sync (or the upgrade) never waits for it */
    function startContent(args){
      if(contentRunning)return {background:true,already:true};
      contentRunning=(async()=>{try{const r=await pushContent(args);await store.setRaw('lastContent',{at:new Date(now()).toISOString(),uploaded:r.uploaded.length,copied:r.copied.length,deferred:r.deferred,errors:r.errors});return r;}catch(e){return null;}finally{contentRunning=null;}})();
      return {background:true};
    }
    async function run({reason='',push=true,pull=true,content:withContent=true}={}){
      if(running)return running;
      running=(async()=>{
        const rep={reason,at:new Date(now()).toISOString(),scan:null,pulled:{files:0,changed:0,errors:{}},changes:[],applied:[],deferred:[],waiting:[],waitReasons:{},installed:[],contentErrors:{},content:null,failed:{},pushed:[],pushError:'',skewed:[],snapshots:[]};
        if(!drive.writesEnabled)throw new Error('Sync V3 is in shadow mode.');
        const dev=await store.device(),me=dev.deviceId;
        const cls=dev.class;
        if(applier.prepare)await applier.prepare();                 // the app's catalog as it is now (forms installed, progress present)
        try{rep.scan=(await engine.scan()).totals;}catch(e){rep.failed.scan=String(e&&e.message||e);}
        let known=await store.known(),merged=null,files=null;
        if(pull){
          files=await drive.listV3();
          const others=files.filter(f=>{const p=parse(f.name);return ['lib','set','form','dev','lease'].includes(p.type)&&p.dev!==me;});
          const cache=await store.checksums();
          const got=await drive.downloadChanged(others,cache);
          rep.pulled={files:others.length,changed:Object.keys(got.downloaded).length,errors:got.errors};
          const unitFiles=Object.entries(got.downloaded).filter(([n])=>['lib','set','form'].includes(parse(n).type));
          const remotes=unitFiles.map(([,f])=>Array.isArray(f.json&&f.json.units)?f.json.units:[]);
          // device names and leases
          const devices=await store.getRaw('devices',{}),leases=await store.getRaw('leases',{});
          for(const [n,f] of Object.entries(got.downloaded)){const p=parse(n);if(p.type==='dev'&&f.json)devices[p.dev]={name:f.json.name||p.dev,class:f.json.class||'',lastSeen:f.json.lastSeen||''};if(p.type==='lease'&&f.json)leases[p.dev]=f.json.leases||{};}
          for(const dv of Object.keys(leases))if(!others.some(f=>{const p=parse(f.name);return p.type==='lease'&&p.dev===dv;}))delete leases[dv];
          await store.setRaw('devices',devices);await store.setRaw('leases',leases);
          await store.seen(remotes.flat().map(u=>u&&u.t).filter(Boolean));
          merged=Core.merge(known,remotes,{now:now()});
          rep.skewed=merged.skewed;
          const next={...merged.units},vis=Core.view(merged.units,{now:now()}).units;
          // which forms the merge touched (plus forms still waiting for their form / a score)
          const touched=new Set(await store.getRaw('pendingForms',[])),attForm=attFormOf(merged.units);
          for(const ch of merged.changes){const sc=scopeOf(ch.k,attForm);if(sc.scope==='form'&&sc.uid&&sc.uid!=='?')touched.add(sc.uid);else if(sc.scope==='lib'){const p=Core.parseKey(ch.k);if(p.uid)touched.add(p.uid);}}
          for(const [k,u] of Object.entries(merged.units)){const p=Core.parseKey(k);if(p.fam==='L'&&p.field===''&&u.v&&u.v.on==='installed'&&p.uid!==Core.QBANK_UID&&!applier.hasForm(p.uid))touched.add(p.uid);}
          // a form that is installed but shows no progress while the units hold some (re-installed, restored, wiped): bring it back
          if(applier.hasProgress)for(const uid of new Set(Object.values(attForm)))if(uid&&uid!==Core.QBANK_UID&&applier.hasForm(uid)&&!applier.hasProgress(uid)&&C_attemptIds(vis,uid).length)touched.add(uid);
          const pending=new Set(),failedUids=new Set(),keepOld=uid=>{for(const k of Object.keys(next)){const sc=scopeOf(k,attForm),p=Core.parseKey(k);if((sc.scope==='form'&&sc.uid===uid)||(p.fam==='L'&&p.uid===uid)){if(known[k])next[k]=known[k];else delete next[k];}}};
          const fallback=new Set(await store.getRaw('fallbackForms',[]));
          for(const uid of fallback)touched.delete(uid);
          for(const uid of touched){
            if(applier.isOpenBlock(uid)){rep.deferred.push(uid);pending.add(uid);keepOld(uid);continue;}
            try{
              await applier.recover([uid]);
              /* a form that is not here: custom / imported content comes from the Drive by hash; update-service forms wait to be installed */
              if(uid!==Core.QBANK_UID&&!applier.hasForm(uid)){
                const l=merged.units[K.lib(uid)];
                if(content&&syncsContent(l&&l.v)){
                  let c;try{c=await fetchContent({uid,lib:l.v,files,drive,Drive,content});}catch(e){c={waiting:'content-error'};rep.contentErrors[uid]=String(e&&e.message||e);}
                  if(c.installed){rep.installed.push(uid);if(applier.prepare)await applier.prepare();}else rep.waitReasons[uid]=c.waiting;
                }else if(l&&l.v&&l.v.on==='installed')rep.waitReasons[uid]=l.v.src==='catalog'?'catalog':'content';
              }
              const r=uid===Core.QBANK_UID?await applier.applyQbank({units:merged.units,vis}):await applier.applyForm({uid,units:merged.units,vis});
              if(r&&r.waiting){rep.waiting.push(uid);pending.add(uid);}
              else{rep.applied.push(uid);if(r&&r.pending)pending.add(uid);}
            }catch(e){rep.failed[uid]=String(e&&e.message||e);failedUids.add(uid);pending.add(uid);keepOld(uid);}
          }
          try{await applier.applySettings(merged.units,cls);}catch(e){rep.failed.settings=String(e&&e.message||e);}
          // remember checksums only for files whose changes were fully taken over
          const newCache={...cache};
          for(const [n,f] of Object.entries(got.downloaded)){
            const p=parse(n);let ok=true;
            if(p.type==='form'&&(failedUids.has(p.uid)||rep.deferred.includes(p.uid)))ok=false;
            if(ok)newCache[n]={md5:f.md5};
          }
          for(const n of Object.keys(newCache))if(!files.some(f=>f.name===n))delete newCache[n];
          await store.setKnown(Object.fromEntries(Object.entries(next).map(([k,u])=>[k,{v:u.v,t:u.t}])));
          await store.setChecksums(newCache);await store.setRaw('pendingForms',[...pending]);
          // attempts the app shows after the apply count as seen (a later local delete of them is a real delete)
          const seenAll=await store.getRaw('seenLocal',{});
          for(const uid of Object.keys(seenAll)){const l=merged.units[K.lib(uid)];if(l&&l.v&&l.v.on==='deleted')delete seenAll[uid];}
          for(const uid of rep.applied){const ids=C_attemptIds(vis,uid);if(ids.length){seenAll[uid]=seenAll[uid]||{};ids.forEach(a=>{seenAll[uid][a]=1;});}}
          await store.setRaw('seenLocal',seenAll);
          const seenF=await store.getRaw('seenForms',{});for(const uid of rep.applied){if(applier.hasForm(uid))seenF[uid]=1;else delete seenF[uid];}await store.setRaw('seenForms',seenF);
          if(!failedUids.size&&!Object.keys(got.errors).length){
            const first=!(await store.bootstrapped());
            await store.setBootstrapped(true);
            /* first pull done: this device's settings that the cloud did not override (still its own old pre-pull stamps) become real values */
            if(first){const kn=await store.known();let n=0;for(const [k,u] of Object.entries(kn)){const p=Core.parseKey(k),st=Core.parseStamp(u.t)||{};if(p.fam==='S'&&st.dev===me&&st.wall===1){const [t]=await store.stamps(1);kn[k]={v:u.v,t};n++;}}if(n){await store.setKnown(kn);await store.markDirty('set');}}
          }
          rep.changes=merged.changes.filter(c=>!failedUids.size||true).map(c=>({k:c.k,type:c.type,dev:c.dev,form:(scopeOf(c.k,attForm).uid||'')}));
          const devNames=devices;
          if(rep.changes.length){
            const list=await store.getRaw('changes',[]);
            const byDev={};rep.changes.forEach(c=>{byDev[c.dev]=(byDev[c.dev]||0)+1;});
            list.push({at:rep.at,count:rep.changes.length,forms:[...new Set(rep.changes.map(c=>c.form).filter(Boolean))],from:Object.keys(byDev).map(d=>({dev:d,name:(devNames[d]||{}).name||d,n:byDev[d]}))});
            while(list.length>100)list.shift();await store.setRaw('changes',list);
          }
          known=await store.known();
        }
        if(push&&await store.bootstrapped()){
          try{
            const dirty=await store.dirty(),attForm=attFormOf(known);
            const vis=Core.view(known,{now:now()});
            const mine=test=>Core.compact(ownUnits(known,me,test),known,{now:now()}).units;
            for(const uid of Object.keys(dirty.forms)){
              const units=mine(k=>{const s=scopeOf(k,attForm);return s.scope==='form'&&s.uid===uid;});
              const f=await drive.upload(N.form(me,uid),{dev:me,units});await store.clearDirty('form',uid);rep.pushed.push(N.form(me,uid));
              const d=day(now()),snap=N.snapshot(me,d,uid);
              if(!(await drive.listByName(snap)).length){try{await drive.copy(f.id,snap);rep.snapshots.push(snap);}catch(e){}}
            }
            if(dirty.lib){await drive.upload(N.lib(me),{dev:me,units:mine(k=>scopeOf(k,attForm).scope==='lib')});await store.clearDirty('lib');rep.pushed.push(N.lib(me));}
            if(dirty.set){await drive.upload(N.set(me),{dev:me,units:mine(k=>scopeOf(k,attForm).scope==='set')});await store.clearDirty('set');rep.pushed.push(N.set(me));}
            if(content&&withContent){
              const args={files:files||await drive.listV3(),drive,Drive,content,store,known};
              if(contentInBackground)rep.content=startContent(args);
              else{try{rep.content=await pushContent(args);}catch(e){rep.content={uploaded:[],copied:[],errors:{all:String(e&&e.message||e)},deferred:0};}}
            }
            await drive.upload(N.dev(me),{deviceId:me,name:dev.name,class:dev.class,appVersion,lastSeen:rep.at,bootstrapped:true});
            const mineLeases=await store.getRaw('myLeases',{});await drive.upload(N.lease(me),{dev:me,leases:mineLeases});
            void vis;
            // snapshots older than 14 days (own device only)
            const cutoff=day(now()-Drive.SNAPSHOT_KEEP_DAYS*86400000);
            for(const f of await drive.listV3()){const p=parse(f.name);if(p.type==='snapshot'&&p.dev===me&&p.day<cutoff){try{await drive.remove(f.id);}catch(e){}}}
          }catch(e){rep.pushError=String(e&&e.message||e);}
        }
        await store.setRaw('waitReasons',rep.waitReasons);
        const st=await store.getRaw('cycleState',{failures:0});
        const failed=!!(rep.pushError||Object.keys(rep.failed).length);
        st.failures=failed?Math.min(st.failures+1,BACKOFF_MS.length):0;st.nextAt=failed?now()+BACKOFF_MS[st.failures-1]:0;st.last=rep.at;st.lastReport=summary(rep);
        await store.setRaw('cycleState',st);rep.nextAt=st.nextAt;
        return rep;
      })();
      try{return await running;}finally{running=null;}
    }
    const summary=r=>({at:r.at,changes:r.changes.length,applied:r.applied.length,deferred:r.deferred.length,waiting:r.waiting.length,failed:Object.keys(r.failed).length,pushError:r.pushError,pushed:r.pushed.length});
    /* "Synced 2 min ago · 14 changes from iPad" */
    async function statusLine(){
      const st=await store.getRaw('cycleState',{}),last=st.lastReport;
      if(!last)return 'Not synced yet';
      const mins=Math.max(0,Math.round((now()-Date.parse(last.at))/60000)),ago=mins<1?'just now':mins===1?'1 min ago':mins<60?mins+' min ago':Math.round(mins/60)+' h ago';
      const ch=await store.getRaw('changes',[]),lastCh=ch[ch.length-1];
      const from=lastCh&&lastCh.from.length?' from '+lastCh.from.map(f=>f.name).join(', '):'';
      return (last.failed||last.pushError?'Sync will retry · ':'Synced ')+ago+(lastCh&&Date.parse(lastCh.at)>=Date.parse(last.at)-1?` · ${lastCh.count} change${lastCh.count===1?'':'s'}${from}`:'');
    }
    const due=async()=>{const st=await store.getRaw('cycleState',{});return !st.nextAt||now()>=st.nextAt;};
    return {run,statusLine,due,ownUnits,contentDone:()=>contentRunning||Promise.resolve(null)};
  }
  /* "Delete progress" for a form this device does not have (it waits for its form): the same stamped reset a local delete writes,
     so every device hides that form's progress; restorable from the old-sync archive while it exists */
  async function resetFormProgress({store,uid}){
    const [t]=await store.stamps(1),kn=await store.known(),k=K.form(uid,'reset');
    const j=Core.joinUnits(Core.ruleFor(k),kn[k]?{k,v:kn[k].v,t:kn[k].t}:null,{k,v:{at:t},t},Date.now());
    kn[k]={v:j.v,t:j.t};await store.setKnown(kn);await store.markDirty('form',uid);
    return {uid,at:t};
  }
  function C_attemptIds(vis,uid){return Object.keys(vis).map(Core.parseKey).filter(p=>p.fam==='A'&&p.field===''&&String(vis[K.att(p.att)].v.formUid)===uid).map(p=>p.att);}
  return {create,createCycle,resetFormProgress,attemptIdsOf:C_attemptIds,ownUnits,diffForm,scopeOf,attFormOf,DEFAULTS,pushContent,fetchContent,syncsContent,CONTENT_TYPE};
});

/* Sync V3 boot (Release B): store, engine, applier and cycle; triggers (app open, online, block end / suspend / reset / delete,
   every 3 min while visible, hidden = push only); the automatic V2 -> V3 migration with its slim top bar; "Upgrading..." tags on
   form cards; status line, Changes list, pre-upgrade backups and the lease prompt in Backup & sync. Until the migration is done
   the V2 sync keeps working untouched and V3 only runs the read-only check (shadow). */
(function(){
  'use strict';
  if(window.__STEP_SYNC3_BOOT)return;window.__STEP_SYNC3_BOOT=true;
  const need=['StepSync3Core','StepSync3Bridge','StepSync3Store','StepSync3Drive','StepSync3Sync','StepSync3Migrate'];
  if(need.some(n=>!window[n])||!window.StepProgressSync){console.warn('Sync V3 modules are incomplete; skipped.');return;}
  const Core=window.StepSync3Core,Bridge=window.StepSync3Bridge,Store=window.StepSync3Store,Drive=window.StepSync3Drive,Sync=window.StepSync3Sync,Mig=window.StepSync3Migrate,R=window.StepProgressSync,K=Core.K;
  const AUTO_EVERY_MS=6*3600*1000,TIMED_EVERY_MS=2*3600*1000,TIMED_CHECK_MS=15*60000,BEAT_MS=60000;
  const isPhone=Math.min((screen&&screen.width)||innerWidth,(screen&&screen.height)||innerHeight)<768;

  const store=Store.create({screen:{width:(screen&&screen.width)||innerWidth,height:(screen&&screen.height)||innerHeight},name:/iPad/i.test(navigator.userAgent)?'iPad':/iPhone/i.test(navigator.userAgent)?'iPhone':'This device'});
  const drive=Drive.create({auth:R.auth,writesEnabled:false});          // writes switch on only when the migration is done on this device
  const applier=Bridge.createApplier({store});
  const source={
    async readForms(opts){const dev=await store.deviceId(),l=await Bridge.readLocalUnits({dev,...(opts||{})});const forms={};for(const [uid,f] of Object.entries(l.forms))forms[uid]={extract:f.extract,modifiedAt:f.modifiedAt};return {forms};},
    async readSettings(){
      const cls=(await store.device()).class,out={};
      for(const [name,scope,key] of Bridge.SETTING_KEYS){if(!Bridge.settingApplies(scope,cls))continue;let v=null;try{v=localStorage.getItem(key);}catch(e){}if(v!=null)out[K.setting(Bridge.settingScope(scope,cls),name)]=v;}
      try{const ls=(await window.StepExamSyncBridge.catalog()).librarySettings;if(ls&&typeof ls==='object'&&Object.keys(ls).length)out[K.setting('g','libTabs')]=ls;}catch(e){}      // library tab settings live in catalog.json
      return out;
    }
  };
  const engine=Sync.create({store,source});
  const content=Bridge.createContentAdapter({drive,libraryManifestName:R.config&&R.config.LIBRARY_MANIFEST_FILE});
  const cycle=Sync.createCycle({store,drive,engine,applier,Drive,content,contentInBackground:true,appVersion:String(window.__STEP_SIM_VERSION||'')});
  const state={live:false,lastScan:null,lastCheck:null,lastCycle:null,running:false,error:'',migration:null,bar:null,status:'',migrating:false};
  const rt=()=>{try{return window.StepExamSyncBridge.runtime();}catch(e){return {};}};
  const examOpen=()=>!!rt().examVisible;
  const connected=async()=>{try{return !!(R.auth.getState().authorized&&(await R.meta.get('syncEnabled',false)||await R.meta.get('sync3Live',false)));}catch(e){return false;}};
  const online=()=>navigator.onLine!==false;

  /* ---------------- local scan after progress writes (stamping by diff; pushed by the cycle once live) ---------------- */
  let scanTimer=null,pendingOnly=new Set(),pendingAll=false;
  function scheduleScan(filename){
    const m=/^(.+?)_(?:progress_save|suspended_test)\.json$/.exec(String(filename||''));
    if(m)pendingOnly.add(m[1]);else pendingAll=true;
    clearTimeout(scanTimer);scanTimer=setTimeout(runScan,2000);
  }
  async function runScan(){
    if(window.__STEP_SYNC_APPLYING_REMOTE||state.migrating){scanTimer=setTimeout(runScan,2000);return;}
    const only=[...pendingOnly],all=pendingAll;pendingOnly=new Set();pendingAll=false;
    try{
      if(all||!only.length)state.lastScan=await engine.scan();
      else{
        const cat=await window.StepExamSyncBridge.catalog();
        for(const id of only){const rec=(cat.forms||[]).find(x=>String(x.id)===id);if(rec)state.lastScan=await Sync.create({store,source:{readForms:()=>source.readForms({onlyFormId:id})}}).scan({only:String(rec.formUid||rec.id)});}
      }
      state.error='';
      if(state.live)scheduleCycle(4000,'progress');
    }catch(e){state.error=String(e&&e.message||e);console.warn('Sync V3 scan failed',e);}
    render();
  }
  /* forms written while the upgrade runs (you can keep studying): the upgrade does not overwrite them, the cycle after it merges them */
  const writtenDuringUpgrade=new Set();
  window.addEventListener('stepsim:progress-write',e=>{const d=e&&e.detail||{};if(state.migrating&&d.formId)writtenDuringUpgrade.add(String(d.formId));if(state.migrating&&/^QBANK_MODE/i.test(String(d.filename||'')))writtenDuringUpgrade.add(Core.QBANK_UID);scheduleScan(d.filename);});
  let uidByFormId=new Map();
  async function refreshUidMap(){try{const cat=await window.StepExamSyncBridge.catalog();uidByFormId=new Map((cat.forms||[]).map(r=>[String(r.id),String(r.formUid||r.id)]));}catch(e){}}
  const changedDuring=()=>new Set([...writtenDuringUpgrade].map(id=>id===Core.QBANK_UID?id:(uidByFormId.get(id)||id)));

  /* ---------------- the live cycle ---------------- */
  let cycleTimer=null;
  function scheduleCycle(ms,reason){clearTimeout(cycleTimer);cycleTimer=setTimeout(()=>runCycle({reason}),ms);}
  async function runCycle({reason='timer',push=true,pull=true,force=false}={}){
    if(!state.live||state.migrating||!online())return null;
    if(!force&&!(await cycle.due()))return null;
    /* timed and tab-switch cycles run at most every TIMED_EVERY_MS; saved progress and new forms sync at once (reason 'progress') */
    if(!force&&(reason==='timer'||reason==='visible')){const last=(await store.getRaw('cycleState',{})).last;if(last&&Date.now()-Date.parse(last)<TIMED_EVERY_MS)return null;}
    if(window.__STEP_SYNC_APPLYING_REMOTE||window.__STEP_FORM_UPDATE_COMMITTING){scheduleCycle(3000,reason);return null;}
    if(!(await connected()))return null;
    try{
      await applier.prepare();
      await store.setRaw('myLeases',myLeases);
      state.cycling=true;publishLive();
      const rep=await cycle.run({reason,push,pull}).finally(()=>{state.cycling=false;});
      state.lastCycle=rep;state.error=rep.pushError||Object.values(rep.failed)[0]||'';
      await refreshLeases();
      if(rep.applied.length||rep.changes.length){try{await window.StepExamSyncBridge.refresh();}catch(e){}}
    }catch(e){state.error=String(e&&e.message||e);console.warn('Sync V3 cycle failed',e);}
    state.status=await cycle.statusLine();render();publishLive();return state.lastCycle;
  }
  window.addEventListener('online',()=>runCycle({reason:'online',force:true}));
  document.addEventListener('visibilitychange',async()=>{
    if(document.visibilityState!=='hidden'){runCycle({reason:'visible'});return;}
    /* leaving the tab pushes only when something is unsaved (a scan waiting, or changes marked dirty); iOS may suspend the page before the 4 s progress cycle */
    const d=await store.dirty();
    if(pendingAll||pendingOnly.size||Object.keys(d.forms).length||d.lib||d.set)runCycle({reason:'hidden',pull:false,force:true});
  });
  setInterval(()=>{if(document.visibilityState==='visible')runCycle({reason:'timer'});},TIMED_CHECK_MS);
  window.addEventListener('stepsim:three-digit-score',()=>{scheduleScan(null);});

  /* ---------------- leases (section 6) ---------------- */
  let myLeases={},otherLeases={};
  async function refreshLeases(){otherLeases=await store.getRaw('leases',{});checkLost();}
  const allLeases=async()=>({...otherLeases,[await store.deviceId()]:myLeases});
  const devName=async d=>{const m=await store.getRaw('devices',{});return (m[d]&&m[d].name)||d;};
  /* the app's globals are script-scope bindings (let), not window properties */
  const G=name=>{try{return (0,eval)(name);}catch(e){return undefined;}};
  function activeAttemptKey(){try{const s=G('activeSession');if(!s)return null;const uid=String(s.formUid||s.libraryFormId||'');const raw=String(s.attemptId||'');return uid&&raw?uid+':'+raw:null;}catch(e){return null;}}
  async function takeLease(att,block){myLeases=Core.leaseTake(myLeases,att,block);await store.setRaw('myLeases',myLeases);pushLease();}
  async function dropLease(){if(!Object.keys(myLeases).length)return;myLeases={};await store.setRaw('myLeases',myLeases);pushLease();}
  let leaseBusy=false;
  async function pushLease(){if(!state.live||leaseBusy||!online())return;leaseBusy=true;try{const me=await store.deviceId();await drive.upload(Drive.N.lease(me),{dev:me,leases:myLeases});}catch(e){}leaseBusy=false;}
  setInterval(async()=>{
    if(!state.live)return;
    try{
      if(examOpen()){const att=activeAttemptKey();if(att){const blk=Number(G('blockPointer')||0)+1;if(!myLeases[att]||myLeases[att].block!==blk)myLeases=Core.leaseTake(myLeases,att,blk);else myLeases=Core.leaseBeat(myLeases,att);await store.setRaw('myLeases',myLeases);pushLease();}}
      else if(Object.keys(myLeases).length)await dropLease();
    }catch(e){}
  },BEAT_MS);
  function checkLost(){
    try{
      if(!examOpen())return;const att=activeAttemptKey();if(!att||!myLeases[att])return;
      Promise.resolve().then(async()=>{
        const lost=Core.leaseLost(await allLeases(),await store.deviceId(),att,myLeases[att].block);
        if(!lost)return;
        const name=await devName(lost.dev);await dropLease();
        try{document.getElementById('suspendBtn')&&document.getElementById('suspendBtn').dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));}catch(e){}
        setTimeout(()=>{try{const ok=document.getElementById('appDialogOk');if(ok)ok.click();}catch(e){}},500);          // the app's own "suspend this block?" confirmation
        setTimeout(()=>{try{if(typeof appAlert==='function')appAlert('Continued on '+name+'. This block was suspended here; your answers are saved.','Block continued on another device');}catch(e){}},1200);
      });
    }catch(e){}
  }
  /* opening a block that another device holds: "Open on iPad 2 min ago. Continue here?" (Continue = take over) */
  function wrapStartBlock(){
    if(typeof window.startBlock!=='function'||window.startBlock.__s3)return;
    const base=window.startBlock;let bypass=false;
    const wrapped=function(ptr){
      if(bypass||!state.live||!online()||G('reviewMode'))return base.apply(this,arguments);
      const args=arguments,self=this,att=activeAttemptKey(),blk=Number(ptr)+1;
      if(!att)return base.apply(self,args);
      const start=async()=>{await takeLease(att,blk);bypass=true;try{return base.apply(self,args);}finally{bypass=false;}};
      return (async()=>{
        let c=null;try{await refreshLeases();c=Core.leaseConflict(await allLeases(),await store.deviceId(),att,blk);}catch(e){}
        if(!c)return start();
        const name=await devName(c.dev),ok=typeof appConfirm==='function'?await appConfirm(`Open on ${name} ${c.minutesAgo<1?'just now':c.minutesAgo+' min ago'}. Continue here?`,{okText:'Continue here',cancelText:'Not now',title:'Block is open on another device'}):true;
        if(ok)return start();
        try{document.getElementById('libraryTab')&&document.getElementById('libraryTab').click();}catch(e){}
      })();
    };
    wrapped.__s3=true;window.startBlock=wrapped;   // eslint-disable-line no-global-assign
  }
  setTimeout(wrapStartBlock,1500);setTimeout(wrapStartBlock,6000);

  /* ---------------- migration (automatic) ---------------- */
  let v2adapter=null;
  const v2=()=>v2adapter||(v2adapter=Mig.makeV2Adapter({R,drive}));
  async function localRows(){
    const dev=await store.deviceId(),l=await Bridge.readLocalUnits({dev});
    return Object.entries(l.forms).map(([uid,f])=>({key:uid,formUid:uid,kind:uid===Core.QBANK_UID?'qbank':'form',local:{formId:f.formId,progress:f.progress,suspended:f.suspended,threeDigitScore:(f.rec&&f.rec.threeDigitScore)||'',modifiedAt:f.modifiedAt?new Date(f.modifiedAt).toISOString():'',rec:f.rec}}));
  }
  async function runMigrate({manual=false}={}){
    if(state.migrating||state.live)return state.migration;
    try{
      if(!(await connected()))throw new Error('Connect Google Backup first: the upgrade moves your Google backups to the new sync.');
      if(R.sync.isBusy())throw new Error('Google Backup is busy; the upgrade will retry.');
      state.migrating=true;state.error='';up.done.clear();up.now='';await refreshUidMap();markUpgrading(true);showBar({busy:true,label:'Upgrading sync',done:0,total:1});
      drive.enableWrites(true);
      let baseline=false;try{baseline=!!(await R.meta.get('qidMigrationPendingBaseline',null));}catch(e){}
      const g=Mig.gateOf();
      await refreshUidMap();writtenDuringUpgrade.clear();
      const res=await Mig.runMigration({store,drive,engine,cycle,applier,v2:v2(),changedDuring,gateState:{runtime:g.runtime,committing:g.committing,qidBaselinePending:baseline},localRows,
        onProgress:p=>{if(p.uid&&p.step==='legacy-start')up.now=p.uid;if(p.uid&&p.step==='legacy'){up.done.add(p.uid);up.now='';}markUpgrading(true);if(p.step!=='legacy-start')showBar({busy:true,label:p.label,done:p.done,total:p.total});}});
      state.migration=res;
      if(res.status==='done'){
        state.live=true;await R.meta.set('sync3Live',true);
        const fb=(res.fallback||(await store.migration()).fallback||[]).length;
        showBar({done:true,detail:'Old backups kept until '+String((await store.migration()).keepUntil||'').slice(0,10)+(fb?' · '+fb+' form'+(fb===1?'':'s')+' stay on the current sync for now':'')});setTimeout(hideBar,5000);scheduleCycle(2000,'migrated');
      }
      else{
        drive.enableWrites(false);
        showBar({paused:true,detail:(res.status==='waiting'?(res.reasons||[]).join(' '):res.status==='other-device'?'another device is upgrading':res.reason==='fallback'?'some forms need a later update':((await store.migration()).reason||''))});
      }
    }catch(e){
      state.error=String(e&&e.message||e);drive.enableWrites(state.live);
      showBar({paused:true,detail:state.error});
      console.warn('Sync V3 migration paused',e);
    }
    state.migrating=false;markUpgrading(false);render();return state.migration;
  }

  /* the upgrade and the live sync speak through the header sync pill (thunder-ui.js listens to stepsync3:state); never a separate bar.
     While the upgrade runs every form stays usable; cards only get a small "Upgraded / Upgrading now / In queue" note. */
  function publish(v){
    state.bar=v;try{window.dispatchEvent(new CustomEvent('stepsync3:state',{detail:v}));}catch(e){}
    /* the Backup & sync menu dot follows the new sync too (the old sync paints it from its own, now stale, state) */
    const tab=document.getElementById('progressSyncTab');if(tab){if(v)tab.setAttribute('data-s3-tone',v.tone||'good');else tab.removeAttribute('data-s3-tone');}
    if(!document.getElementById('sync3DotStyle')){const st=document.createElement('style');st.id='sync3DotStyle';st.textContent='#progressSyncTab[data-s3-tone] .sync-tab-dot{background:#22c55e!important}#progressSyncTab[data-s3-tone="busy"] .sync-tab-dot{background:#3b82f6!important}#progressSyncTab:is([data-s3-tone="pending"],[data-s3-tone="error"]) .sync-tab-dot{background:#f59e0b!important}';document.head.appendChild(st);}
  }
  function showBar(o){
    if(o.busy){const l=String(o.label||'');publish({tone:'busy',label:/^Upgrading sync · \d+ of \d+/.test(l)?l.replace(/ forms$/,''):'Upgrading sync',progress:o.total?o.done/o.total:0,detail:'Your forms stay usable while it runs'});}
    else if(o.done)publish({tone:'good',label:'Sync upgraded',detail:o.detail||''});
    else if(o.paused)publish({tone:'pending',label:'Upgrade will retry',detail:o.detail||'The current sync keeps working'});
  }
  function hideBar(){publishLive();}
  /* after the upgrade: Synced / Syncing… / Sync will retry, with the status line as detail */
  async function publishLive(){
    if(!state.live){publish(null);return;}
    if(state.migrating)return;
    let line='';try{line=await cycle.statusLine();}catch(e){}
    publish(state.cycling?{tone:'busy',label:'Syncing…',detail:line}:state.error?{tone:'error',label:'Sync will retry',detail:state.error}:{tone:'good',label:'Synced',detail:line.replace(/^Synced\s*/,'')});
  }
  const up={done:new Set(),now:''};
  function markUpgrading(on){
    document.querySelectorAll('article.tu-form[data-tu-form]').forEach(c=>{
      const span=c.querySelector('.tu-form-date>span');
      if(!on){if(c.hasAttribute('data-s3-up')){c.removeAttribute('data-s3-up');if(span)span.removeAttribute('data-s3-label');}return;}
      const uid=uidByFormId.get(c.dataset.tuForm)||c.dataset.tuForm,label=up.done.has(uid)?'Upgraded':up.now===uid?'Upgrading now':'In queue';
      if(span&&span.getAttribute('data-s3-label')!==label){c.setAttribute('data-s3-up','');span.setAttribute('data-s3-label',label);}
    });
  }
  new MutationObserver(()=>{if(state.migrating)markUpgrading(true);}).observe(document.documentElement,{childList:true,subtree:true});

  /* ---------------- the check (shadow) ---------------- */
  async function runCheck(){
    if(state.running)return state.lastCheck;
    state.running=true;state.error='';render();
    try{
      if(!(await connected()))throw new Error('Connect Google Backup first: the check compares this device with the Google backups (read-only).');
      if(R.sync.isBusy())throw new Error('Google Backup is busy; try again in a moment.');
      state.lastCheck=await Mig.runShadow({store,drive,R});
      try{await R.meta.set('sync3LastAutoCheck',Date.now());}catch(e){}
    }catch(e){state.error=String(e&&e.message||e);}
    state.running=false;render();return state.lastCheck;
  }

  /* ---------------- Backup & sync card ---------------- */
  const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const cnt=c=>c?`${c.attempts}a · ${c.answered}ans · ${c.marked}fl · ${c.struck}st · ${c.notes}nt · ${c.stemHighlights}+${c.expHighlights}hl · ${c.completedBlocks}blk`:'–';
  function formRow(f){
    const ck=f.checks||{},flag=f.fallback?'⚠ stays on the current sync':(f.waitsForForm?'… waits for the form':'✓ ready');
    return `<tr class="${f.fallback?'s3-bad':''}"><td>${esc(f.formId||f.uid)}${f.kind==='qbank'?' (Qbank)':''}</td><td>${esc(f.v2State)}<br><small>V2: ${esc(f.v2Decision)}</small></td><td><small>V3: ${esc(f.v3Decision)}</small><br><small>source: ${esc(f.source)}</small></td><td><small>cloud ${esc(cnt(f.counts&&f.counts.cloud))}<br>this device ${esc(cnt(f.counts&&f.counts.local))}<br>merged ${esc(cnt(f.counts&&f.counts.merged))}</small></td><td>${flag}${f.reasons&&f.reasons.length?`<br><small>${esc(f.reasons.join('; '))}</small>`:''}${f.notes&&f.notes.length?`<br><small>${esc(f.notes.join('; '))}</small>`:''}<br><small>counts ${ck.counts&&ck.counts.ok?'ok':'LOW'} · ids ${ck.qids&&ck.qids.ok?(ck.qids.checked?'ok':'n/a'):'BAD'} · scores ${ck.scores&&ck.scores.ok?'ok ('+ck.scores.checked+')':'DIFF'}</small></td></tr>`;
  }
  async function render(){
    let host=document.getElementById('tuSync3Card');
    if(!host){const layout=document.querySelector('#progressSyncPanel .sync-layout');if(!layout)return;host=document.getElementById('sync3Diag');if(!host){host=document.createElement('section');host.id='sync3Diag';host.className='sync-card sync-inventory';layout.appendChild(host);}}
    host.hidden=false;
    if(!host.dataset.s3){
      host.dataset.s3='1';
      host.innerHTML='<div class="tu-synchead"><div class="tu-syncttl"><h2 id="s3Title">Sync V3</h2><span id="s3Sub"></span></div></div><div class="tu-actions" id="s3Actions"></div><div id="sync3Body"></div>';
      host.addEventListener('click',onClick);
      if(!document.getElementById('sync3Style')){const st=document.createElement('style');st.id='sync3Style';st.textContent='#tuSync3Card .tu-actions{margin:10px 0}#sync3Body{font-size:13px;line-height:1.4}#sync3Body table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}#sync3Body td,#sync3Body th{border-top:1px solid rgba(128,128,128,.3);padding:5px 6px;vertical-align:top;text-align:left}#sync3Body .s3-bad td{background:rgba(220,120,0,.12)}#sync3Body small{opacity:.8}#sync3Body .s3-sum{margin:8px 0}#sync3Body summary{cursor:pointer;font-weight:600;margin-top:6px}#sync3Body .s3-err{color:#b3261e;font-weight:600;margin:6px 0}#sync3Body .s3-row{display:flex;gap:8px;align-items:center;justify-content:space-between;padding:4px 0;border-top:1px solid rgba(128,128,128,.2)}';document.head.appendChild(st);}
    }
    const mig=await store.migration(),dev=await store.device();
    host.querySelector('#s3Title').textContent=state.live?'Sync':'Sync V3 preview';
    host.querySelector('#s3Sub').innerHTML=state.live?`${esc(state.status||await cycle.statusLine())}. Changes from your other devices are applied automatically; no questions asked.`:'The new sync merges work from all your devices automatically. Until it is switched on, <b>nothing is uploaded or changed</b>; Google Drive progress sync keeps working as before.';
    const acts=host.querySelector('#s3Actions');
    acts.innerHTML=state.live?`<button type="button" class="tu-btn small outline" data-s3="sync"${state.migrating?' disabled':''}>Sync now</button>`:`<button type="button" class="tu-btn small outline" data-s3="check"${state.running?' disabled':''}>${state.running?'Checking…':'Run check'}</button><button type="button" class="tu-btn small" data-s3="upgrade"${state.migrating?' disabled':''}>${state.migrating?'Upgrading…':'Upgrade sync now'}</button>`;
    const body=host.querySelector('#sync3Body'),open=!!(body.querySelector('details')&&body.querySelector('details').open);
    let html=`<div class="s3-sum"><small>Device ${esc(dev.deviceId)} · ${esc(dev.class)}${state.lastScan?` · local scan: ${state.lastScan.totals.changed} change(s) stamped, ${state.lastScan.totals.held} held`:''}${mig.status&&mig.status!=='none'?' · upgrade: '+esc(mig.status):''}</small></div>`;
    if(state.error)html+=`<div class="s3-err">${esc(state.error)}</div>`;
    if(mig.reason&&mig.status==='paused')html+=`<div class="s3-err">${esc(mig.reason)}</div>`;
    if(state.live){
      /* forms other devices have that are not here yet, and why */
      const kn=await store.known(),visNow=Core.view(kn).units,waits=Object.entries(await store.getRaw('waitReasons',{})).filter(([uid])=>Sync.attemptIdsOf(visNow,uid).length);      // only forms that still have progress
      const WHY={content:'its content arrives from the device that has it',catalog:'install it here from Add forms › Check for updates','id-taken':'another form on this device uses the same ID','content-error':'its content could not be verified; retried on every sync',busy:'waits until the current form install finishes'};
      if(waits.length)html+=`<details><summary>Waiting for their form (${waits.length})</summary>${waits.map(([uid,why])=>{const nm=kn[K.libField(uid,'name')];return `<div class="s3-row"><span>${esc(nm&&nm.v||uid)}<br><small>${esc(WHY[why]||why)}</small></span><button type="button" class="tu-btn small outline" data-s3="delete-waiting" data-uid="${esc(uid)}">Delete progress</button></div>`;}).join('')}</details>`;
      const fb=mig.fallback||[];
      if(fb.length)html+=`<details><summary>Still on the current sync (${fb.length})</summary>${fb.map(f=>`<div class="s3-row"><span>${esc(f.formId||f.uid)}${f.uid===Core.QBANK_UID?' (Qbank)':''}</span><small>${esc((f.reasons||[]).join('; ')||'retried every time the app opens')}</small></div>`).join('')}</details>`;
      const ch=(await store.getRaw('changes',[])).slice(-8).reverse();
      html+=`<details${open?' open':''}><summary>Changes from other devices (${ch.length})</summary>${ch.length?ch.map(c=>`<div class="s3-row"><span>${esc(c.forms.join(', ')||'settings / library')} · ${c.count} change${c.count===1?'':'s'} from ${esc(c.from.map(f=>f.name).join(', '))}</span><small>${esc(c.at.slice(0,16).replace('T',' '))}</small></div>`).join(''):'<div class="s3-row"><span>Nothing yet.</span></div>'}</details>`;
      const rec=await store.getRaw('preV3Recovery',null);
      if(rec){const forms=Object.entries(rec.forms||{});html+=`<details><summary>Pre-upgrade backups (until ${esc(String(rec.expiresAt).slice(0,10))})</summary><div class="s3-row"><span>Restore every form from before the upgrade</span><button type="button" class="tu-btn small outline" data-s3="restore-all">Restore all</button></div>${forms.map(([uid,f])=>`<div class="s3-row"><span>${esc(f.formId||uid)}</span><button type="button" class="tu-btn small outline" data-s3="restore" data-uid="${esc(uid)}">Restore</button></div>`).join('')}</details>`;}
      const ar=state.archive;
      html+=`<details${ar?' open':''}><summary>Old sync archive on Google Drive</summary>${!ar?'<div class="s3-row"><span>What the old sync last held, kept on Google Drive until the cleanup</span><button type="button" class="tu-btn small outline" data-s3="archive-list">Show forms</button></div>':ar.error?`<div class="s3-err">${esc(ar.error)}</div>`:!ar.entries.length?'<div class="s3-row"><span>No archive on Google Drive (it is removed 30 days after the upgrade).</span></div>':`<div class="s3-row"><span>Restore every form from the archive</span><button type="button" class="tu-btn small outline" data-s3="restore-archive-all">Restore all</button></div>${ar.entries.map(x=>`<div class="s3-row"><span>${esc(x.formId||x.uid)} <small>${esc(String(x.updatedAt||'').slice(0,10))}</small></span><button type="button" class="tu-btn small outline" data-s3="restore-archive" data-uid="${esc(x.uid)}">Restore</button></div>`).join('')}`}</details>`;
    }else{
      const r=state.lastCheck||(await store.diag()).slice(-1)[0];
      if(r){const t=r.totals;
        html+=`<div class="s3-sum"><b>${t.ok} of ${t.forms} forms ready</b> · ${t.fallback} would stay on the current sync · ${t.waitingForForm} wait for their form · ${t.fromThisDevice} read from this device · ${t.downloaded} from cloud backups · ${t.tombstones} deletions<br><small>${esc(r.at)} · Drive writes: ${r.wroteToDrive?'YES':'none'} · old backups would be kept until ${esc(String(r.keepUntil).slice(0,10))}${r.gate&&!r.gate.ok?' · would wait: '+esc(r.gate.reasons.join(' ')):''}${r.preV3Recovery?` · local pre-V3 copy: ${r.preV3Recovery.forms} form(s)`:''}</small></div>`;
        html+=`<details${open?' open':''}><summary>Per-form numbers</summary><table><thead><tr><th>Form</th><th>Current sync (V2)</th><th>V3</th><th>Counts</th><th>Result</th></tr></thead><tbody>${(r.forms||[]).map(formRow).join('')}</tbody></table></details>`;
      }else html+='<div class="sync-empty"><small>No check yet.</small></div>';
    }
    body.innerHTML=html;
  }
  async function onClick(e){
    const b=e.target.closest('[data-s3]');if(!b)return;const a=b.dataset.s3;
    if(a==='check')return runCheck();
    if(a==='upgrade')return runMigrate({manual:true});
    if(a==='sync')return runCycle({reason:'manual',force:true});
    if(a==='delete-waiting'){
      const uid=b.dataset.uid;
      try{
        if(typeof appConfirm==='function'&&!await appConfirm('Delete the progress of '+uid+' on all your devices? It can be restored from the old sync archive until the cleanup.',{okText:'Delete progress',cancelText:'Cancel',title:'Delete progress',danger:true}))return;
        await Sync.resetFormProgress({store,uid});state.status='Progress of '+uid+' deleted';runCycle({reason:'delete-waiting',force:true});
      }catch(err){state.error=String(err&&err.message||err);}
      return render();
    }
    if(a==='archive-list'){
      try{state.archive=await Mig.readArchive({drive,normalize:v2().normalize});}catch(err){state.archive={entries:[],error:String(err&&err.message||err)};}
      return render();
    }
    if(a==='restore'||a==='restore-all'||a==='restore-archive'||a==='restore-archive-all'){
      const fromArchive=a.startsWith('restore-archive');
      try{
        if(typeof appConfirm==='function'&&!await appConfirm(fromArchive?'Restore from the old sync archive on Google Drive? Newer answers for the restored forms are replaced, on all your devices.':'Restore from the copy made before the upgrade? Newer answers on this device for the restored forms are replaced, on all your devices.',{okText:'Restore',cancelText:'Cancel',title:fromArchive?'Restore from the old sync archive':'Restore pre-upgrade backup'}))return;
        await applier.prepare();
        const cat=await window.StepExamSyncBridge.catalog();
        const args={store,applier,getRec:uid=>(cat.forms||[]).find(r=>String(r.formUid||r.id)===uid)||null,resolveRefs:rec=>{const M=window.StepQidMigration;if(!M||!M.sessionQuestionRefs)return null;const blocks=[];(rec.questionIndex||[]).forEach(r=>{(blocks[r.blockIndex]=blocks[r.blockIndex]||{questions:[]}).questions[r.questionIndex]={qid:r.qid};});return s=>M.sessionQuestionRefs(s,{blocks});},uids:(a==='restore'||a==='restore-archive')?[b.dataset.uid]:null};
        const out=fromArchive?await Mig.restoreFromArchive({...args,drive,readBackup:v2().readBackup,normalize:v2().normalize}):await Mig.restoreFromRecovery(args);
        state.error='';state.status='Restored '+out.restored.length+' form(s)';await window.StepExamSyncBridge.refresh();runCycle({reason:'restore',force:true});
      }catch(err){state.error=String(err&&err.message||err);}
      render();
    }
  }
  const mount=()=>{if(document.getElementById('tuSync3Card')||document.querySelector('#progressSyncPanel .sync-layout'))render();};
  for(const d of [800,2000,5000,12000])setTimeout(mount,d);
  document.addEventListener('click',e=>{if(e.target&&e.target.closest&&e.target.closest('#progressSyncTab,#tuSyncTab'))for(const d of [60,400,1200])setTimeout(mount,d);},true);

  /* ---------------- start-up ---------------- */
  (async()=>{
    try{
      const mig=await store.migration(),live=mig.status==='done'&&await R.meta.get('sync3Live',false);
      if(live){state.live=true;drive.enableWrites(true);setTimeout(publishLive,1500);}
    }catch(e){}
    setTimeout(()=>{runScan().catch(()=>{});},4000);
    setTimeout(async()=>{
      try{
        await Mig.expireRecovery({store});
        if(state.live){
          /* forms in per-form fallback: follow the marker, try to move them again (every launch) */
          try{if(online()&&!examOpen()){const g=Mig.gateOf();let baseline=false;try{baseline=!!(await R.meta.get('qidMigrationPendingBaseline',null));}catch(e){}
            await refreshUidMap();state.fallback=await Mig.retryFallback({store,drive,engine,cycle,applier,v2:v2(),changedDuring,gateState:{runtime:g.runtime,committing:g.committing,qidBaselinePending:baseline}});}}catch(e){console.warn('Sync V3 fallback retry failed',e);}
          await runCycle({reason:'open',force:true});return;
        }
        if(await R.meta.get('sync3Disabled',false))return;
        if(examOpen()||!(await connected()))return;
        const last=Number(await R.meta.get('sync3LastAutoRun',0))||0;
        if(Date.now()-last<AUTO_EVERY_MS)return;
        await R.meta.set('sync3LastAutoRun',Date.now());
        await runMigrate({});
      }catch(e){}
    },25000);
    // old V2 files are removed on a sync after keepUntil, when the rules in the plan allow it
    setTimeout(async()=>{try{if(state.live&&online())await Mig.runCleanup({store,drive});}catch(e){}},90000);
  })();

  window.StepSync3=Object.freeze({release:'B',store,engine,drive,cycle,applier,scan:()=>engine.scan(),runCheck,runMigrate,runCycle,status:()=>({...state,writesEnabled:drive.writesEnabled}),diagnostics:()=>store.diag(),
    disableAuto:()=>R.meta.set('sync3Disabled',true),enableAuto:()=>R.meta.set('sync3Disabled',false),cleanup:()=>Mig.runCleanup({store,drive})});
})();

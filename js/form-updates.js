/* iPad form distribution and password-protected, browser-persistent Admin UI. */
(function(){
  'use strict';
  const R=window.StepProgressSync,C=window.StepFormUpdateCore,meta=R.meta;
  const base=R.config.CLOUD.workerBaseUrl+'/exam-simulator2/updates/';
  const LOCKED='exam2AdminExplicitlyLocked';
  const KEY='formUpdatesAdminGrant',REVOKE='formUpdatesAdminRevocations',LABEL='formUpdatesDeviceLabel';
  const state={busy:false,message:'',percent:null,forms:[],manifest:null,receiptPending:false};
  const admin={token:'',rows:[],message:'',busy:false,next:null,search:'',formId:'',revision:''};
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const bytes=n=>n<1024?n+' B':n<1048576?(n/1024).toFixed(1)+' KB':(n/1048576).toFixed(1)+' MB';
  let device={id:'',label:''},reporting=null,stagingPromise=null,adminGeneration=0;
  const channel='BroadcastChannel' in window?new BroadcastChannel('exam2-admin-access'):null;
  async function post(route,body={},token=''){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
    try{
      const res=await fetch(base+route,{method:'POST',cache:'no-store',credentials:'omit',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body),signal:controller.signal});
      let data;try{data=await res.json();}catch(_){throw new Error('The update service is not configured yet.');}
      if(!res.ok){const error=new Error(data.error||'Update service HTTP '+res.status);error.status=res.status;throw error;}
      return data;
    }finally{clearTimeout(timer);}
  }
  async function withLock(name,fn){
    if(navigator.locks)return navigator.locks.request(name,{ifAvailable:true},lock=>{if(!lock)throw new Error('This action is running in another tab.');return fn();});
    return fn();
  }
  async function stageDb(){
    return new Promise((resolve,reject)=>{const q=indexedDB.open('ExamSimulator2_FORM_UPDATE_STAGE_DB',1);q.onupgradeneeded=()=>q.result.createObjectStore('files',{keyPath:'key'});q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
  }
  async function stage(mode,fn){const db=await stageDb();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('files',mode),q=fn(tx.objectStore('files'));tx.oncomplete=()=>resolve(q?.result);tx.onabort=()=>reject(tx.error||new Error('Download staging failed.'));tx.onerror=()=>{};});}finally{db.close();}}
  async function cleanStage(batchId){await stage('readwrite',s=>{const q=s.openCursor();q.onsuccess=()=>{const c=q.result;if(!c)return;if(batchId?c.value.batchId===batchId:c.value.updatedAt<Date.now()-86400000)c.delete();c.continue();};return q;});}
  async function digest(blob){const b=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('');}
  async function fetchFile(url,file,progress){
    const controller=new AbortController();let timer=setTimeout(()=>controller.abort(),60000);
    try{
      const res=await fetch(url,{cache:'no-store',credentials:'omit',signal:controller.signal});if(!res.ok)throw new Error('Could not download '+file.path+' (HTTP '+res.status+').');
      const chunks=[];let length=0;
      if(res.body?.getReader){const reader=res.body.getReader();while(true){const {done,value}=await reader.read();if(done)break;clearTimeout(timer);timer=setTimeout(()=>controller.abort(),60000);length+=value.byteLength;if(length>file.size){await reader.cancel();throw new Error('Size mismatch: '+file.path);}chunks.push(value);progress(value.byteLength);}}
      else {const b=await res.arrayBuffer();length=b.byteLength;chunks.push(b);progress(length);}
      const blob=new Blob(chunks,{type:res.headers.get('Content-Type')||'application/octet-stream'});
      if(length!==file.size||await digest(blob)!==file.sha256)throw new Error('Checksum or size mismatch: '+file.path+'. Nothing was installed.');
      return blob;
    }finally{clearTimeout(timer);}
  }
  function paint(){
    mountToolbar();
    const box=document.getElementById('formUpdatesPanel');if(!box)return;
    const actionable=state.forms.filter(f=>f.status==='New'||f.status==='Revised');
    box.hidden=!state.message&&!state.forms.length;
    box.innerHTML='<div class="fu-status" role="status" aria-live="polite">'+esc(state.message)+'</div>'+
      (state.percent!==null?'<div class="fu-progress-row"><div class="fu-track" role="progressbar" aria-label="Form download" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+state.percent+'"><i style="width:'+state.percent+'%"></i></div><span>'+state.percent+'%</span></div>':'')+
      (state.forms.length?'<div class="fu-list">'+state.forms.map(f=>'<div class="fu-item"><div><b>'+esc(f.title||f.id)+'</b><small>'+esc(f.tab)+' · '+bytes(f.files.reduce((n,x)=>n+x.size,0))+'</small></div><span class="fu-kind">'+esc(f.status)+'</span>'+(f.reason?'<small class="fu-reason">'+esc(f.reason)+'</small>':'')+'</div>').join('')+'</div>':'')+
      (actionable.length?'<button type="button" id="formUpdatesInstall" class="primary" '+(state.busy?'disabled':'')+'>Download & install · '+actionable.length+'</button><small class="fu-report-note">Successful installs are reported to the app administrator.</small>':'');
    const button=document.getElementById('formUpdatesCheck');if(button){button.disabled=state.busy;button.textContent=state.busy?'Updating…':'Check for updates';}
  }
  function mountToolbar(){
    const bar=document.querySelector('#libraryModePanel .exam-final-actionbar');if(!bar)return;
    if(!bar.classList.contains('fu-toolbar')){
      const load=document.getElementById('loadNewFormBtn');if(!load)return;
      const others=['importProgressOnlyBackupBtn','exportProgressOnlyBackupBtn','importFullLibraryBackupBtn','exportFullLibraryBackupBtn','updateAppShellBtn','connectDataFolderBtn','scanDataFolderBtn','exportCatalogBtn'].map(id=>document.getElementById(id)).filter(Boolean);
      const version=document.getElementById('appVersionLabel');
      bar.replaceChildren();bar.classList.add('fu-toolbar');load.textContent='Add form';load.classList.remove('primary');load.classList.add('secondary');bar.append(load);
      const check=document.createElement('button');check.type='button';check.id='formUpdatesCheck';check.className='primary';check.textContent='Check for updates';bar.append(check);
      const more=document.createElement('details');more.className='exam-toolbar-menu fu-more';const summary=document.createElement('summary');summary.textContent='More';more.append(summary);
      const panel=document.createElement('div');panel.className='exam-toolbar-menu-panel';others.forEach(n=>panel.append(n));if(version)panel.append(version);more.append(panel);bar.append(more);
    }
    if(!document.getElementById('formUpdatesPanel')){const box=document.createElement('div');box.id='formUpdatesPanel';box.className='fu-panel';box.hidden=true;bar.after(box);}
  }
  async function check(){
    if(state.busy)return;state.busy=true;state.message='Checking for forms…';state.forms=[];state.percent=null;paint();
    try{
      if(navigator.onLine===false)throw new Error('You’re offline. Connect to check for forms.');
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);let manifest;
      try{const res=await fetch(new URL('form-updates-manifest.json',new URL('./',location.href)),{cache:'no-store',credentials:'omit',signal:controller.signal});if(!res.ok)throw new Error('Update list is unavailable (HTTP '+res.status+').');manifest=C.validateManifest(await res.json());}finally{clearTimeout(timer);}
      const installed=await window.StepFormUpdateStore.installed();state.manifest=manifest;
      state.forms=manifest.forms.map(f=>{const prev=installed.find(x=>x.id.toLowerCase()===f.id.toLowerCase());return {...f,status:!prev?'New':f.onExisting==='skip'?'Skipped':prev.formUpdateRevision===f.revision?'Installed':'Revised'};});
      const count=state.forms.filter(f=>f.status==='New'||f.status==='Revised').length;
      state.message=count?count+' form'+(count===1?'':'s')+' available · '+bytes(state.forms.filter(f=>f.status==='New'||f.status==='Revised').reduce((n,f)=>n+f.files.reduce((x,v)=>x+v.size,0),0)):manifest.forms.length?'Your library is up to date.':'No form updates available.';
    }catch(e){state.message=e.name==='AbortError'?'The update check timed out. Try again.':e.message;state.manifest=null;}
    finally{state.busy=false;paint();}
  }
  async function install(){
    if(state.busy||!state.manifest)return;
    const selected=state.forms.filter(f=>f.status==='New'||f.status==='Revised');if(!selected.length)return;
    state.busy=true;state.percent=0;state.message='Preparing download…';paint();
    const batchId=crypto.randomUUID(),authKey='formUpdatesReceiptAuth:'+batchId;
    try{
      await withLock('exam2-form-install',async()=>{
        const runtime=window.StepExamSyncBridge?.runtime?.();if(runtime?.examVisible)throw new Error('Leave the active exam before installing forms.');
        await stagingPromise;
        const total=selected.reduce((n,f)=>n+f.files.reduce((a,x)=>a+x.size,0),0),estimate=await navigator.storage?.estimate?.();
        if(estimate?.quota&&estimate.quota-estimate.usage<total*2)throw new Error('There is not enough browser storage for this update and its recovery copy.');
        let done=0;
        for(const form of selected)for(const file of form.files){
          state.message='Downloading '+(form.title||form.id)+'…';paint();
          const url='https://raw.githubusercontent.com/'+state.manifest.repository+'/'+state.manifest.sourceCommit+'/update/'+file.path.split('/').map(encodeURIComponent).join('/');
          const blob=await fetchFile(url,file,n=>{done+=n;state.percent=total?Math.min(94,Math.floor(done/total*94)):94;paint();});
          await stage('readwrite',s=>s.put({key:batchId+'/'+file.path,batchId,path:file.path,blob,updatedAt:Date.now()}));
        }
        state.message='Checking form compatibility…';state.percent=96;paint();
        const stored=await stage('readonly',s=>s.getAll(IDBKeyRange.bound(batchId+'/',batchId+'/\uffff')));
        const plan=await window.StepBulkImport.prepareEntries(stored.map(x=>({path:x.path,readText:()=>x.blob.text(),readBlob:async()=>x.blob})),normalizeBank);
        // Keep the identity used at install time separate from the portable library/progress files.
        await R.auth.initialize();await meta.set(authKey,await meta.get(R.config.WORKER_SESSION_META_KEY,''));
        const result=await window.StepFormUpdateStore.importForms(plan,state.manifest,batchId,device,(phase,pct)=>{state.message=phase+'…';state.percent=pct;paint();});
        for(const f of state.forms){if(result.applied.some(x=>x.formId===f.id))f.status='Installed';const b=result.blocked.find(x=>x.id===f.id);if(b){f.status='Blocked';f.reason=b.reason;}if(result.skipped.includes(f.id))f.status='Skipped';}
        if(!result.applied.length)await meta.del(authKey);
        state.percent=result.applied.length?100:null;
        state.message=result.applied.length?'Installed '+result.applied.length+' form'+(result.applied.length===1?'':'s')+'.': 'No forms changed.';
        if(result.blocked.length)state.message+=' '+result.blocked.length+' incompatible revision'+(result.blocked.length===1?' was':'s were')+' left unchanged.';
      });
    }catch(e){state.percent=null;state.message=e.name==='AbortError'?'Download interrupted. Check your connection and try again.':e.message;}
    finally{await cleanStage(batchId).catch(()=>{});state.busy=false;paint();flushReports().catch(()=>{});}
  }
  async function flushReports(){
    if(reporting||navigator.onLine===false||window.__STEP_FORM_UPDATE_COMMITTING)return reporting;
    reporting=withLock('exam2-update-reports',async()=>{
      const pending=await meta.get(REVOKE,[]),remaining=[];
      for(const token of pending)try{await post('admin/lock',{},token);}catch(e){if(e.status!==401)remaining.push(token);}
      await meta.set(REVOKE,remaining);
      const events=await window.StepFormUpdateStore.receipts(),acked=[];
      for(const event of events){
        if(window.__STEP_FORM_UPDATE_COMMITTING)break;
        const token=await meta.get('formUpdatesReceiptAuth:'+event.batchId,'');
        try{try{await post('receipt',event,token);}catch(e){if(e.status!==401)throw e;await post('receipt',event);}acked.push(event.id);}catch(_){break;}
      }
      if(acked.length){await window.StepFormUpdateStore.acknowledge(acked);for(const batch of new Set(events.filter(e=>acked.includes(e.id)).map(e=>e.batchId)))if(!events.some(e=>e.batchId===batch&&!acked.includes(e.id)))await meta.del('formUpdatesReceiptAuth:'+batch);}
      state.receiptPending=events.length>acked.length;
      const note=document.getElementById('formUpdatesReportNote');if(note)note.remove();
      if(state.receiptPending){const box=document.getElementById('formUpdatesPanel');if(box&&!box.hidden){const note=document.createElement('small');note.id='formUpdatesReportNote';note.className='fu-report-note';note.textContent='Installation report pending · retries when online';box.append(note);}}
    }).catch(()=>{}).finally(()=>{reporting=null;});return reporting;
  }
  function adminHtml(){
    const filters=admin.rows;
    return '<section class="settings-panel-v195 fu-admin"><header class="fu-admin-head"><div><h3>Admin</h3><p>Form installations</p></div>'+(admin.token?'<button type="button" data-fu="lock" class="secondary">Lock admin</button>':'<span class="fu-kind">Locked</span>')+'</header>'+
      '<label class="fu-device-label">This device<input id="fuDeviceLabel" maxlength="80" value="'+esc(device.label)+'" aria-label="Device name"><button type="button" class="secondary" data-fu="device">Save name</button></label>'+
      (!admin.token?'<form id="fuAdminUnlock" class="fu-unlock"><label for="fuAdminPassword">Admin password</label><div><input id="fuAdminPassword" type="password" autocomplete="current-password" required><button type="submit" class="primary" '+(admin.busy?'disabled':'')+'>Unlock</button></div><small>Stays unlocked in this browser until you lock it.</small></form>':
      '<form id="fuAdminFilters" class="fu-admin-filters"><input id="fuAdminSearch" type="search" placeholder="Search user, device or form" aria-label="Search installations" value="'+esc(admin.search)+'"><input id="fuAdminForm" placeholder="Form ID" aria-label="Filter by form ID" value="'+esc(admin.formId)+'"><input id="fuAdminRevision" placeholder="Revision" aria-label="Filter by revision" value="'+esc(admin.revision)+'"><button class="secondary" type="submit" '+(admin.busy?'disabled':'')+'>Refresh</button></form>'+
      '<div class="fu-admin-table"><table><thead><tr><th>Form</th><th>User / device</th><th>Installed</th></tr></thead><tbody>'+filters.map(r=>'<tr><td><b>'+esc(r.title||r.form_id)+'</b><small>'+esc(r.form_id)+' · '+esc(r.revision.slice(0,10))+'</small></td><td>'+esc(r.account_email||r.device_label)+'<small>'+esc(r.account_email?r.device_label:'Device report · no Google account')+'</small></td><td>'+esc(new Date(r.installed_at).toLocaleString())+'</td></tr>').join('')+'</tbody></table>'+(!filters.length?'<div class="fu-empty">'+(admin.busy?'Loading…':'No installations to show.')+'</div>':'')+'</div>'+(admin.next?'<button class="secondary" type="button" data-fu="more" '+(admin.busy?'disabled':'')+'>Load more</button>':''))+
      '<p id="fuAdminStatus" role="status" class="fu-admin-status">'+esc(admin.message)+'</p></section>';
  }
  function paintAdmin(){const content=document.querySelector('#settingsPanel .settings-content-v195');if(content?.querySelector('.fu-admin'))content.innerHTML=adminHtml();}
  async function loadAdmin(more=false){
    const token=admin.token;if(!token||admin.busy)return;
    admin.busy=true;admin.message='';paintAdmin();
    try{const result=await post('admin/receipts',{search:admin.search,formId:admin.formId,revision:admin.revision,after:more?admin.next:0},token);if(admin.token!==token)return;admin.rows=more?admin.rows.concat(result.rows):result.rows;admin.next=result.nextCursor;}
    catch(e){if(admin.token!==token)return;if(e.status===401){admin.token='';admin.rows=[];await meta.del(KEY);}admin.message=e.name==='AbortError'?'The admin request timed out.':e.message;}
    finally{if(admin.token===token||!admin.token){admin.busy=false;paintAdmin();}}
  }
  async function unlock(password){
    if(admin.busy)return;const generation=++adminGeneration;admin.busy=true;admin.message='';paintAdmin();
    try{const result=await post('admin/unlock',{password});if(generation!==adminGeneration){await meta.set(REVOKE,(await meta.get(REVOKE,[])).concat(result.token));flushReports();return;}if(typeof result.token!=='string'||result.token.length<32)throw new Error('Invalid admin grant.');try{localStorage.removeItem(LOCKED);}catch(_){}await meta.set(KEY,result.token);admin.token=result.token;channel?.postMessage({type:'unlocked'});}
    catch(e){admin.message=e.message;}
    finally{admin.busy=false;paintAdmin();}
    if(admin.token)await loadAdmin();
  }
  function clearAdmin(){adminGeneration++;admin.token='';admin.rows=[];admin.next=null;admin.message='Admin locked.';admin.busy=false;paintAdmin();}
  async function lock(){
    const token=admin.token;try{localStorage.setItem(LOCKED,'1');}catch(_){}clearAdmin();
    if(token){const list=await meta.get(REVOKE,[]);await meta.set(REVOKE,Array.from(new Set(list.concat(token))));}
    await meta.del(KEY);channel?.postMessage({type:'locked'});try{localStorage.setItem('exam2AdminLockSignal',String(Date.now()));}catch(_){}
    await flushReports();
  }
  async function receiveLock(){try{localStorage.setItem(LOCKED,'1');}catch(_){}clearAdmin();await meta.del(KEY);}
  if(channel)channel.onmessage=async e=>{if(e.data?.type==='locked')await receiveLock();if(e.data?.type==='unlocked'){admin.token=await meta.get(KEY,'');
    let wasLocked=false;try{wasLocked=localStorage.getItem(LOCKED)==='1';}catch(_){}
    if(wasLocked){if(admin.token)await meta.set(REVOKE,Array.from(new Set((await meta.get(REVOKE,[])).concat(admin.token))));await meta.del(KEY);admin.token='';}
    paintAdmin();}};
  window.addEventListener('storage',e=>{if(e.key==='exam2AdminLockSignal')receiveLock();});
  document.addEventListener('click',e=>{
    if(window.__STEP_FORM_UPDATE_COMMITTING&&!e.target.closest?.('#formUpdatesPanel')){e.preventDefault();e.stopImmediatePropagation();return;}
    const checkButton=e.target.closest?.('#formUpdatesCheck'),installButton=e.target.closest?.('#formUpdatesInstall');
    if(checkButton){e.preventDefault();check();}if(installButton){e.preventDefault();install();}
    const action=e.target.closest?.('[data-fu]')?.dataset.fu;
    if(action==='lock')lock().catch(e=>{admin.message=e.message;paintAdmin();});
    if(action==='more')loadAdmin(true);
    if(action==='device'){const label=document.getElementById('fuDeviceLabel').value.trim();if(label){device.label=label;meta.set(LABEL,label).then(()=>{admin.message='Device name saved.';paintAdmin();});}}
    if(e.target.closest?.('[data-v195b-settings-tab="admin"]'))setTimeout(()=>loadAdmin(),0);
  },true);
  document.addEventListener('submit',e=>{
    if(e.target.id==='fuAdminUnlock'){e.preventDefault();const input=document.getElementById('fuAdminPassword'),password=input.value;input.value='';unlock(password);}
    if(e.target.id==='fuAdminFilters'){e.preventDefault();admin.search=document.getElementById('fuAdminSearch').value;admin.formId=document.getElementById('fuAdminForm').value;admin.revision=document.getElementById('fuAdminRevision').value;loadAdmin();}
  });
  window.addEventListener('online',()=>flushReports());
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){flushReports();if(admin.token)loadAdmin();}});
  window.StepFormUpdates={check,install,lock,adminHtml,getState:()=>({...state,forms:state.forms.map(f=>({...f}))})};
  const style=document.createElement('style');style.textContent=`
    #libraryModePanel .workflow-actions-pane-v217 .exam-final-actionbar.fu-toolbar{display:grid!important;grid-template-columns:minmax(80px,1fr) minmax(125px,1.6fr) 70px!important;gap:7px!important;align-items:center!important}
    #libraryModePanel .fu-toolbar>button,#libraryModePanel .fu-toolbar>.exam-toolbar-menu>summary{min-height:42px!important;padding:9px 8px!important;font-size:12px!important;border-radius:11px!important}
    .fu-panel,.fu-admin{--fu-line:#dce5eb;--fu-muted:#647986;--fu-ink:#193848;--fu-soft:#f5f8fa;color:var(--fu-ink)}
    #settingsPanel:has(.fu-admin) .settings-shell-v195{grid-template-columns:minmax(0,1fr)!important}
    #settingsPanel:has(.fu-admin) .settings-nav-v195{display:flex!important;flex-wrap:wrap!important;position:static!important;overflow:visible!important;height:auto!important;max-height:none!important;gap:5px!important;padding:9px!important;border-radius:15px!important}
    #settingsPanel:has(.fu-admin) .settings-nav-v195 button{display:inline-flex!important;flex:0 0 auto!important;width:auto!important;padding:9px 12px!important;min-height:38px!important;font-size:12px!important}
    #settingsPanel:has(.fu-admin) #qidMigrationCard{display:none!important}
    #settingsPanel:has(.fu-admin)>.library-toolbar p,#settingsPanel:has(.fu-admin)>.library-toolbar .panel-kicker{display:none!important}
    #settingsPanel:has(.fu-admin)>.library-toolbar{padding:17px 21px!important;margin-bottom:14px!important;border-radius:18px!important}
    #menu.theme-dark .fu-toolbar .fu-more>summary{background:#1b3447!important;border-color:#4e6c80!important;color:#e3eef4!important}
    .fu-panel[hidden]{display:none}.fu-panel{border:1px solid var(--fu-line);border-radius:13px;padding:12px;margin-top:3px;background:var(--fu-soft);font:12px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
    .fu-status{color:var(--fu-muted)}.fu-progress-row{display:flex;gap:9px;align-items:center;margin-top:8px;font-variant-numeric:tabular-nums}.fu-track{height:4px;flex:1;overflow:hidden;border-radius:9px;background:#78909c30}.fu-track i{height:100%;display:block;background:#28847a;border-radius:9px;transition:width .15s}
    .fu-list{max-height:230px;overflow:auto;margin:8px 0}.fu-item{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:5px 10px;padding:8px 0;border-top:1px solid var(--fu-line)}.fu-item>div{min-width:0;flex:1}.fu-item b{font-weight:650;overflow-wrap:anywhere}.fu-item small,.fu-admin td small{display:block;color:var(--fu-muted);font-size:11px}.fu-kind{font-size:10px;color:var(--fu-muted);background:#78909c15;padding:3px 7px;border-radius:20px;white-space:nowrap}.fu-reason{flex-basis:100%;color:#97622f!important}.fu-report-note{display:block;margin-top:8px;color:var(--fu-muted)}
    .fu-panel>button{width:100%;font-size:12px;padding:9px!important;min-height:40px}.fu-admin{max-width:960px}.fu-admin-head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:20px}.fu-admin-head h3{margin:0!important}.fu-admin-head p{margin:3px 0 0!important;font-size:12px;color:var(--fu-muted)}.fu-admin button{min-height:40px;font-size:12px}.fu-admin input{box-sizing:border-box;min-width:0;min-height:40px;border:1px solid var(--fu-line);border-radius:9px;padding:9px 11px;background:transparent;color:inherit;font:inherit}
    .fu-device-label{display:flex;align-items:center;gap:9px;font-size:12px;color:var(--fu-muted);flex-wrap:wrap;margin-bottom:22px}.fu-device-label input{flex:1;max-width:280px}.fu-unlock{max-width:380px;margin:14px 0}.fu-unlock>label{font-size:12px;display:block;margin-bottom:7px}.fu-unlock>div{display:flex;gap:8px}.fu-unlock input{flex:1;width:0}.fu-unlock small{display:block;color:var(--fu-muted);font-size:11px;margin-top:8px}.fu-admin-filters{display:grid;grid-template-columns:minmax(130px,2fr) minmax(80px,1fr) minmax(80px,1fr) auto;gap:7px;margin-bottom:14px;font-size:12px}
    .fu-admin-table{overflow:auto;border:1px solid var(--fu-line);border-radius:12px}.fu-admin table{width:100%;border-collapse:collapse;font-size:12px;text-align:left}.fu-admin th,.fu-admin td{padding:11px 12px;border-bottom:1px solid var(--fu-line);vertical-align:top}.fu-admin th{background:var(--fu-soft);color:var(--fu-muted);font-size:11px;font-weight:600}.fu-admin td{overflow-wrap:anywhere}.fu-empty{padding:28px;text-align:center;font-size:12px;color:var(--fu-muted)}.fu-admin-status{font-size:12px;color:var(--fu-muted);min-height:18px}
    #menu.theme-dark .fu-panel,#menu.theme-dark .fu-admin{--fu-line:#3b5365;--fu-muted:#abc1d0;--fu-ink:#e3eef4;--fu-soft:#1a3041}#menu.theme-dark .fu-admin input{background:#142a3b!important;color:#e3eef4!important;border-color:#476579!important}#menu.theme-dark .fu-admin input::placeholder{color:#91aabc}#menu.theme-dark .fu-track i{background:#58bdb0}#menu.theme-dark .fu-reason{color:#edc384!important}
    @media(max-width:980px){#settingsPanel .settings-shell-v195{grid-template-columns:minmax(0,1fr)!important}#settingsPanel .settings-nav-v195{flex-wrap:wrap!important;overflow:visible!important}#settingsPanel .settings-nav-v195 button{flex:0 0 auto!important}}
    @media(max-width:620px){.fu-admin-filters{grid-template-columns:1fr 1fr}.fu-admin-filters input:first-child{grid-column:1/-1}.fu-admin-head{gap:8px}.fu-admin td,.fu-admin th{padding:9px 7px}.fu-device-label{gap:7px}}
    @media(prefers-reduced-motion:reduce){.fu-track i{transition:none}}
  `;document.head.append(style);
  async function boot(){
    const id=await meta.deviceId(),ipad=/iPad|iPhone|iPod/.test(navigator.userAgent)||(/Macintosh/.test(navigator.userAgent)&&navigator.maxTouchPoints>1);
    device={id,label:await meta.get(LABEL,'')||(ipad?'iPad':'Browser')+' · '+id.slice(-4).toUpperCase()};
    admin.token=await meta.get(KEY,'');paintAdmin();
    stagingPromise=cleanStage().catch(()=>{});
    const host=document.getElementById('libraryModePanel');if(host)new MutationObserver(()=>{if(!document.querySelector('.fu-toolbar')){mountToolbar();paint();}}).observe(host,{childList:true,subtree:true});
    mountToolbar();paint();
    await flushReports();
    const saved=admin.token;if(saved)try{await post('admin/status',{},saved);}catch(e){if(e.status===401&&admin.token===saved){clearAdmin();await meta.del(KEY);}}
  }
  boot().catch(e=>console.warn('Form update initialization failed',e.message));
})();

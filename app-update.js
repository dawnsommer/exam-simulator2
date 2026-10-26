/* App-shell updates are independent of optional Google Backup and never clear user storage. */
(function(){
  'use strict';
  const APP_VERSION = 24;
  const PREFIX = 'exam-simulator2-';
  const APP_SHELL = [
  "./",
  "index.html",
  "offline.html",
  "privacy.html",
  "manifest.webmanifest",
  "./app-update.js?v=24",
  "./bulk-import.js?v=24",
  "./exam-notes.js?v=24",
  "./icons/icon-192.png?v=24",
  "./icons/icon-512.png?v=24",
  "./icons/thunder/blue-128.png?v=24",
  "./icons/thunder/blue-32.png?v=24",
  "./icons/thunder/blue-touch-180.png?v=24",
  "./icons/thunder/crimson-128.png?v=24",
  "./icons/thunder/crimson-32.png?v=24",
  "./icons/thunder/crimson-touch-180.png?v=24",
  "./icons/thunder/teal-128.png?v=24",
  "./icons/thunder/teal-32.png?v=24",
  "./icons/thunder/teal-touch-180.png?v=24",
  "./js/form-update-store.js?v=24",
  "./js/form-updates-core.js?v=24",
  "./js/form-updates.js?v=24",
  "./js/google-auth.js?v=24",
  "./js/library-backup.js?v=24",
  "./js/progress-sync.js?v=24",
  "./js/qid-migration.js?v=24",
  "./js/qid-settings.js?v=24",
  "./js/sync-config.js?v=24",
  "./js/sync-merge.js?v=24",
  "./js/sync-storage.js?v=24",
  "./js/sync3-boot.js?v=24",
  "./js/sync3-bridge.js?v=24",
  "./js/sync3-core.js?v=24",
  "./js/sync3-drive.js?v=24",
  "./js/sync3-migrate.js?v=24",
  "./js/sync3-store.js?v=24",
  "./js/sync3-sync.js?v=24",
  "./jszip.min.js?v=24",
  "./nav-delay.js?v=24",
  "./thunder-ui.js?v=24",
  "./ui_icons/calculator.png",
  "./ui_icons/endblock.png",
  "./ui_icons/lab.png",
  "./ui_icons/lock.png",
  "./ui_icons/next.png",
  "./ui_icons/notes.png",
  "./ui_icons/prev.png",
  "./ui_icons/settings.png"
];
  const sw=navigator.serviceWorker;
  const appScope=new URL('./',location.href).href;
  let offered=false, lastCheck=Date.now(), refreshing=false;
  async function flush(){
    window.StepExamNotes?.flush();
    if(window.StepAppUpdateFlush)await window.StepAppUpdateFlush();
  }
  function notice(message,action){
    let box=document.getElementById('appUpdateNotice');
    if(!box){box=document.createElement('div');box.id='appUpdateNotice';box.setAttribute('role','status');document.body.appendChild(box);}
    box.textContent=message;
    if(action){const button=document.createElement('button');button.type='button';button.textContent='Reload';button.addEventListener('click',()=>reloadSaved().catch(e=>notice(e.message)));box.appendChild(button);}
  }
  async function reloadSaved(){await flush();location.reload();}
  async function ownRegistration(){const reg=await sw?.getRegistration(appScope);return reg?.scope===appScope?reg:null;}
  async function reloadLatest(){
    if(refreshing)return;
    refreshing=true;
    try{
      await flush();
      notice('Downloading latest version…');
      for(const file of [...APP_SHELL,'sw.js']){
        const res=await fetch(file,{cache:'reload'});
        if(!res.ok)throw new Error('Could not download '+file+'. Try again when online.');
        await res.arrayBuffer();
      }
      const reg=await ownRegistration();
      if(reg)await reg.unregister();
      if('caches' in window){const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith(PREFIX)).map(k=>caches.delete(k)));}
      location.reload();
    }catch(err){notice('Update failed: '+err.message);throw err;}
    finally{refreshing=false;}
  }
  const style=document.createElement('style');style.textContent='#appUpdateNotice{position:fixed;bottom:84px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:16px;max-width:90vw;box-sizing:border-box;background:#173449;color:#fff;border:1px solid #6b9cbb;border-radius:12px;padding:12px 16px;box-shadow:0 4px 24px #0004;z-index:1500;font:14px Arial,sans-serif}#appUpdateNotice button{border:0;border-radius:7px;background:#fff;color:#173449;padding:7px 12px;cursor:pointer;font-weight:700}.app-version-label{font:12px Arial,sans-serif;opacity:.75;white-space:nowrap}';document.head.appendChild(style);
  function labelVersion(){
    const button=document.getElementById('updateAppShellBtn');if(!button)return;
    if(button.textContent!=='Reload latest version')button.textContent='Reload latest version';
    let label=document.getElementById('appVersionLabel');
    if(!label){label=document.createElement('span');label.id='appVersionLabel';label.className='app-version-label';label.textContent='App version '+APP_VERSION;button.after(label);}
  }
  labelVersion();
  const library=document.getElementById('libraryModePanel');
  if(library)new MutationObserver(labelVersion).observe(library,{childList:true,subtree:true});
  window.StepAppUpdates={version:APP_VERSION,reloadLatest,flush};
  if(sw && /^https?:$/.test(location.protocol)){
    const hadController=!!sw.controller;
    sw.addEventListener('controllerchange',async()=>{
      if(!hadController || offered)return;
      offered=true;
      try{await flush();notice('Updated — Reload',true);}catch(e){notice('Update ready. Save progress before reloading.');}
    });
    const register=()=>sw.register('sw.js',{updateViaCache:'none'}).catch(e=>console.warn('App update registration failed',e));
    if(document.readyState==='complete')register();else window.addEventListener('load',register,{once:true});
    document.addEventListener('visibilitychange',()=>{
      if(document.visibilityState!=='visible' || Date.now()-lastCheck<30*60000)return;
      lastCheck=Date.now();ownRegistration().then(reg=>reg?.update()).catch(()=>{});
    });
  }
})();

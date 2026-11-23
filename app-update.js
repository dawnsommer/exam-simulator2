/* App-shell updates are independent of optional Google Backup and never clear user storage. */
(function(){
  'use strict';
  const APP_VERSION = 71;
  const PREFIX = 'exam-simulator2-';
  const APP_SHELL = [
  "./",
  "index.html",
  "offline.html",
  "privacy.html",
  "manifest.webmanifest",
  "./analysis.js?v=71",
  "./app-update.js?v=71",
  "./bulk-import.js?v=71",
  "./choice-epc.js?v=71",
  "./exam-notes.js?v=71",
  "./icons/icon-192.png?v=71",
  "./icons/icon-512.png?v=71",
  "./icons/splash/dark-1488x2266.png?v=71",
  "./icons/splash/dark-1536x2048.png?v=71",
  "./icons/splash/dark-1620x2160.png?v=71",
  "./icons/splash/dark-1640x2360.png?v=71",
  "./icons/splash/dark-1668x2224.png?v=71",
  "./icons/splash/dark-1668x2388.png?v=71",
  "./icons/splash/dark-1668x2420.png?v=71",
  "./icons/splash/dark-2048x1536.png?v=71",
  "./icons/splash/dark-2048x2732.png?v=71",
  "./icons/splash/dark-2064x2752.png?v=71",
  "./icons/splash/dark-2160x1620.png?v=71",
  "./icons/splash/dark-2224x1668.png?v=71",
  "./icons/splash/dark-2266x1488.png?v=71",
  "./icons/splash/dark-2360x1640.png?v=71",
  "./icons/splash/dark-2388x1668.png?v=71",
  "./icons/splash/dark-2420x1668.png?v=71",
  "./icons/splash/dark-2732x2048.png?v=71",
  "./icons/splash/dark-2752x2064.png?v=71",
  "./icons/splash/light-1488x2266.png?v=71",
  "./icons/splash/light-1536x2048.png?v=71",
  "./icons/splash/light-1620x2160.png?v=71",
  "./icons/splash/light-1640x2360.png?v=71",
  "./icons/splash/light-1668x2224.png?v=71",
  "./icons/splash/light-1668x2388.png?v=71",
  "./icons/splash/light-1668x2420.png?v=71",
  "./icons/splash/light-2048x1536.png?v=71",
  "./icons/splash/light-2048x2732.png?v=71",
  "./icons/splash/light-2064x2752.png?v=71",
  "./icons/splash/light-2160x1620.png?v=71",
  "./icons/splash/light-2224x1668.png?v=71",
  "./icons/splash/light-2266x1488.png?v=71",
  "./icons/splash/light-2360x1640.png?v=71",
  "./icons/splash/light-2388x1668.png?v=71",
  "./icons/splash/light-2420x1668.png?v=71",
  "./icons/splash/light-2732x2048.png?v=71",
  "./icons/splash/light-2752x2064.png?v=71",
  "./icons/thunder/blue-128.png?v=71",
  "./icons/thunder/blue-32.png?v=71",
  "./icons/thunder/blue-touch-180.png?v=71",
  "./icons/thunder/crimson-128.png?v=71",
  "./icons/thunder/crimson-32.png?v=71",
  "./icons/thunder/crimson-touch-180.png?v=71",
  "./icons/thunder/teal-128.png?v=71",
  "./icons/thunder/teal-32.png?v=71",
  "./icons/thunder/teal-touch-180.png?v=71",
  "./item-code.js?v=71",
  "./js/form-update-store.js?v=71",
  "./js/form-updates-core.js?v=71",
  "./js/form-updates.js?v=71",
  "./js/google-auth.js?v=71",
  "./js/library-backup.js?v=71",
  "./js/progress-sync.js?v=71",
  "./js/qid-migration.js?v=71",
  "./js/qid-settings.js?v=71",
  "./js/sync-config.js?v=71",
  "./js/sync-merge.js?v=71",
  "./js/sync-storage.js?v=71",
  "./js/sync3-boot.js?v=71",
  "./js/sync3-bridge.js?v=71",
  "./js/sync3-core.js?v=71",
  "./js/sync3-drive.js?v=71",
  "./js/sync3-migrate.js?v=71",
  "./js/sync3-store.js?v=71",
  "./js/sync3-sync.js?v=71",
  "./jszip.min.js?v=71",
  "./library-simple.js?v=71",
  "./nav-delay.js?v=71",
  "./qbank-builtin-tags.js?v=71",
  "./qbanks-core.js?v=71",
  "./qbanks.js?v=71",
  "./rapid-review.js?v=71",
  "./revision-book.js?v=71",
  "./shadow-logger.js?v=71",
  "./thunder-ui.js?v=71",
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
  const style=document.createElement('style');style.textContent='#appUpdateNotice{position:fixed;left:16px;right:16px;margin:0 auto;width:max-content;bottom:calc(84px + env(safe-area-inset-bottom,0px));display:flex;align-items:center;gap:14px;max-width:min(520px,calc(100vw - 32px));box-sizing:border-box;background:#fff;color:#161A25;border:1px solid #D9DCE5;border-radius:14px;padding:10px 10px 10px 16px;box-shadow:0 8px 28px rgba(16,20,40,.22);z-index:1500;font:600 14px var(--tu-font,system-ui,-apple-system,sans-serif)}#appUpdateNotice button{border:0;border-radius:999px;background:var(--tu-p,#A2283A);color:var(--tu-onp,#fff);padding:8px 16px;cursor:pointer;font:700 13.5px var(--tu-font,system-ui,-apple-system,sans-serif)}:root[data-tu-dark] #appUpdateNotice{background:#1E2230;color:#ECEEF5;border-color:#3A3F52}.app-version-label{font:12px var(--tu-font,Arial,sans-serif);opacity:.75;white-space:nowrap}';document.head.appendChild(style);
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

/* Sync V3 local store (SYNC_HYBRID_PLAN.md section 3 / 9): IndexedDB database `sync3` (store `kv`) with the clock, device
   record, bootstrapped flag, `known` unit map, dirty scopes, cached Drive checksums, migration state and diagnostics.
   The storage backend is pluggable (memory in tests, IndexedDB with a localStorage fallback in the browser). */
(function(root,factory){
  const Core=(typeof module==='object'&&module.exports)?require('./sync3-core.js'):root.StepSync3Core;
  const api=factory(Core);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.StepSync3Store=api;
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:this),function(Core){
  'use strict';
  const DB='sync3',STORE='kv',FALLBACK='sync3:';
  const clone=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));

  function memoryBackend(){
    const m=new Map();
    return {async get(k){return m.has(k)?clone(m.get(k)):undefined;},async set(k,v){m.set(k,clone(v));},async del(k){m.delete(k);},async keys(){return [...m.keys()];}};
  }
  function browserBackend(){
    let dbp=null;
    const fb={get:k=>{try{const r=localStorage.getItem(FALLBACK+k);return r===null?undefined:JSON.parse(r);}catch(e){return undefined;}},set:(k,v)=>{try{localStorage.setItem(FALLBACK+k,JSON.stringify(v));}catch(e){}},del:k=>{try{localStorage.removeItem(FALLBACK+k);}catch(e){}}};
    function open(){
      if(dbp)return dbp;
      dbp=new Promise((resolve,reject)=>{
        if(typeof indexedDB==='undefined'){reject(new Error('IndexedDB unavailable'));return;}
        let done=false;const timer=setTimeout(()=>{if(!done){done=true;reject(new Error('sync3 database did not open in time'));}},3000);
        let req;try{req=indexedDB.open(DB,1);}catch(e){clearTimeout(timer);reject(e);return;}
        req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE);};
        req.onsuccess=()=>{if(done)return;done=true;clearTimeout(timer);resolve(req.result);};
        req.onerror=()=>{if(done)return;done=true;clearTimeout(timer);reject(req.error);};
      }).catch(e=>{dbp=null;throw e;});
      return dbp;
    }
    const tx=async(mode,fn)=>{const db=await open();return await new Promise((res,rej)=>{const t=db.transaction(STORE,mode),s=t.objectStore(STORE),r=fn(s);t.oncomplete=()=>res(r&&r.result);t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error);});};
    return {
      async get(k){try{const v=await tx('readonly',s=>s.get(k));return v===undefined?fb.get(k):v;}catch(e){return fb.get(k);}},
      async set(k,v){try{await tx('readwrite',s=>s.put(v,k));}catch(e){fb.set(k,v);}},
      async del(k){try{await tx('readwrite',s=>s.delete(k));}catch(e){}fb.del(k);},
      async keys(){try{return await tx('readonly',s=>s.getAllKeys());}catch(e){return [];}}
    };
  }

  function create({backend,now=()=>Date.now(),random=()=>Math.random().toString(16).slice(2,10),screen={width:1024,height:768},name='This device',appVersion=''}={}){
    backend=backend||(typeof indexedDB!=='undefined'||typeof localStorage!=='undefined'?browserBackend():memoryBackend());
    let chain=Promise.resolve();
    const serial=fn=>{const p=chain.then(fn,fn);chain=p.catch(()=>{});return p;};     // clock / known updates never interleave
    const get=async(k,d)=>{const v=await backend.get(k);return v===undefined?d:v;};
    const set=(k,v)=>backend.set(k,v);

    /* the device record is created once; its class is fixed then (rotation / split view never change it) */
    async function deviceRaw(){
      let d=await get('device',null);
      if(!d){d={deviceId:'d'+random().replace(/[^0-9a-f]/gi,'').slice(0,8).padEnd(8,'0'),class:Core.deviceClass(screen.width,screen.height),name,createdAt:new Date(now()).toISOString()};await set('device',d);}
      return d;
    }
    const device=()=>serial(deviceRaw);
    const deviceId=async()=>(await device()).deviceId;
    async function stamp(){return (await stamps(1))[0];}
    async function stamps(n){
      return serial(async()=>{
        const d=await deviceRaw();let clock=await get('clock',{wall:0,counter:0});const out=[];
        for(let i=0;i<n;i++){const r=Core.hlcNow(clock,d.deviceId,now());out.push(r.stamp);clock=r.clock;}
        await set('clock',clock);return out;
      });
    }
    async function seen(list){return serial(async()=>{const c=Core.hlcSeen(await get('clock',{wall:0,counter:0}),list,now());await set('clock',c);return c;});}
    const known=()=>get('known',{});
    const setKnown=m=>set('known',m);
    const bootstrapped=()=>get('bootstrapped',false);
    const setBootstrapped=v=>set('bootstrapped',!!v);
    async function dirty(){return get('dirty',{forms:{},lib:false,set:false});}
    async function markDirty(scope,uid){return serial(async()=>{const d=await dirty();if(scope==='form')d.forms[uid]=true;else d[scope]=true;await set('dirty',d);return d;});}
    async function clearDirty(scope,uid){return serial(async()=>{const d=await dirty();if(scope==='form')delete d.forms[uid];else d[scope]=false;await set('dirty',d);return d;});}
    const checksums=()=>get('checksums',{});
    const setChecksums=m=>set('checksums',m);
    const migration=()=>get('migration',{status:'none'});
    const setMigration=v=>set('migration',v);
    /* diagnostics: the newest shadow runs, capped */
    async function addDiag(entry,keep=20){return serial(async()=>{const list=await get('diag',[]);list.push(entry);while(list.length>keep)list.shift();await set('diag',list);return list;});}
    const diag=()=>get('diag',[]);
    const getRaw=(k,d)=>get(k,d),setRaw=(k,v)=>set(k,v);
    const clearAll=async()=>{for(const k of await backend.keys())await backend.del(k);};
    return {backend,device,deviceId,stamp,stamps,seen,known,setKnown,bootstrapped,setBootstrapped,dirty,markDirty,clearDirty,checksums,setChecksums,migration,setMigration,addDiag,diag,getRaw,setRaw,clearAll};
  }
  return {create,memoryBackend,browserBackend,DB,STORE};
});

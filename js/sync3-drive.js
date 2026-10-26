/* Sync V3 Drive layer (SYNC_HYBRID_PLAN.md section 4): flat appDataFolder names, one-call change detection
   (files.list with md5Checksum), parallel download of changed replicas, verified upload, server-side copy, delete.
   Release A (shadow): `writesEnabled` is false, so upload / copy / remove throw before any request is made. Reads only. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.StepSync3Drive=api;
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:this),function(){
  'use strict';
  const API='https://www.googleapis.com/drive/v3/files',UPLOAD='https://www.googleapis.com/upload/drive/v3/files';
  const PART_BYTES=4*1024*1024,SNAPSHOT_KEEP_DAYS=14;
  class ShadowModeError extends Error{constructor(op){super(`Sync V3 is in shadow mode (Release A): Drive ${op} is disabled.`);this.name='ShadowModeError';}}

  /* MD5 (RFC 1321) of a UTF-8 string, to check Drive's md5Checksum after an upload */
  function md5Hex(text){
    const bytes=typeof TextEncoder!=='undefined'?Array.from(new TextEncoder().encode(String(text))):Array.from(Buffer.from(String(text),'utf8'));
    const n=bytes.length,add=(x,y)=>(x+y)|0,rol=(x,c)=>(x<<c)|(x>>>(32-c));
    const S=[7,12,17,22,5,9,14,20,4,11,16,23,6,10,15,21],Kt=[];
    for(let i=0;i<64;i++)Kt[i]=Math.floor(Math.abs(Math.sin(i+1))*4294967296)|0;
    bytes.push(0x80);while(bytes.length%64!==56)bytes.push(0);
    const bits=n*8;for(let i=0;i<8;i++)bytes.push(i<4?(bits>>>(8*i))&255:(Math.floor(bits/4294967296)>>>(8*(i-4)))&255);
    let a0=0x67452301|0,b0=0xefcdab89|0,c0=0x98badcfe|0,d0=0x10325476|0;
    for(let o=0;o<bytes.length;o+=64){
      const M=[];for(let i=0;i<16;i++)M[i]=bytes[o+4*i]|(bytes[o+4*i+1]<<8)|(bytes[o+4*i+2]<<16)|(bytes[o+4*i+3]<<24);
      let A=a0,B=b0,Cc=c0,D=d0;
      for(let i=0;i<64;i++){
        let F,g;const r=i>>4;
        if(r===0){F=(B&Cc)|(~B&D);g=i;}else if(r===1){F=(D&B)|(~D&Cc);g=(5*i+1)%16;}else if(r===2){F=B^Cc^D;g=(3*i+5)%16;}else{F=Cc^(B|~D);g=(7*i)%16;}
        F=add(add(add(F,A),Kt[i]),M[g]);A=D;D=Cc;Cc=B;B=add(B,rol(F,S[r*4+(i%4)]));
      }
      a0=add(a0,A);b0=add(b0,B);c0=add(c0,Cc);d0=add(d0,D);
    }
    return [a0,b0,c0,d0].map(v=>{let s='';for(let i=0;i<4;i++)s+=((v>>>(8*i))&255).toString(16).padStart(2,'0');return s;}).join('');
  }

  const N={
    dev:d=>`v3.dev.${d}.json`,
    lib:d=>`v3.r.${d}.lib.json`,
    set:d=>`v3.r.${d}.set.json`,
    form:(d,uid)=>`v3.r.${d}.f.${encodeURIComponent(uid)}.json`,
    lease:d=>`v3.r.${d}.lease.json`,
    content:(sha,part)=>part==null?`v3.c.${sha}.json`:`v3.c.${sha}.p${part}.json`,
    snapshot:(d,yyyymmdd,uid)=>`v3.s.${d}.${yyyymmdd}.${encodeURIComponent(uid)}.json`,
    migration:'v3.migration.json'
  };
  /* what a v3 file name is: {type:'dev'|'lib'|'set'|'form'|'lease'|'content'|'snapshot'|'migration', dev, uid, ...} */
  function parseName(name){
    let m;
    if(name==='v3.migration.json')return {type:'migration'};
    if((m=/^v3\.dev\.(.+)\.json$/.exec(name)))return {type:'dev',dev:m[1]};
    if((m=/^v3\.r\.([^.]+)\.lib\.json$/.exec(name)))return {type:'lib',dev:m[1]};
    if((m=/^v3\.r\.([^.]+)\.set\.json$/.exec(name)))return {type:'set',dev:m[1]};
    if((m=/^v3\.r\.([^.]+)\.lease\.json$/.exec(name)))return {type:'lease',dev:m[1]};
    if((m=/^v3\.r\.([^.]+)\.f\.(.+)\.json$/.exec(name)))return {type:'form',dev:m[1],uid:decodeURIComponent(m[2])};
    if((m=/^v3\.c\.([0-9a-f]+)(?:\.p(\d+))?\.json$/.exec(name)))return {type:'content',sha:m[1],part:m[2]==null?null:Number(m[2])};
    if((m=/^v3\.s\.([^.]+)\.(\d{8})\.(.+)\.json$/.exec(name)))return {type:'snapshot',dev:m[1],day:m[2],uid:decodeURIComponent(m[3])};
    return {type:'other'};
  }
  const q=s=>String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'");

  function create({auth,writesEnabled=false,md5=md5Hex,retries=3}){
    if(!auth||typeof auth.driveFetch!=='function')throw new Error('Sync V3 Drive layer needs an auth provider with driveFetch().');
    let writes=!!writesEnabled;
    const guard=op=>{if(!writes)throw new ShadowModeError(op);};
    async function list(query,fields='nextPageToken,files(id,name,md5Checksum,modifiedTime,size)'){
      const out=[];let token='';
      do{
        const p=new URLSearchParams({spaces:'appDataFolder',q:query,fields,pageSize:'1000',orderBy:'name'});
        if(token)p.set('pageToken',token);
        const r=await auth.driveFetch(`${API}?${p.toString()}`),d=await r.json();
        out.push(...(Array.isArray(d.files)?d.files:[]));token=d.nextPageToken||'';
      }while(token);
      return out;
    }
    /* every V3 file with its checksum in one paged call */
    const listV3=()=>list("name contains 'v3.' and trashed = false");
    const listByName=name=>list(`name = '${q(name)}' and trashed = false`);
    async function downloadText(id){const r=await auth.driveFetch(`${API}/${encodeURIComponent(id)}?alt=media`);return await r.text();}
    async function downloadJson(id,label){
      const t=await downloadText(id);
      try{return JSON.parse(t);}catch(e){throw new Error(`${label||'Drive file'} is not valid JSON.`);}
    }
    /* download only files whose checksum differs from the cached one, `parallel` at a time; failures are reported, never thrown */
    async function downloadChanged(files,cache,{parallel=4}={}){
      const todo=files.filter(f=>!cache||!cache[f.name]||cache[f.name].md5!==f.md5Checksum),got={},errors={};let i=0;
      async function worker(){while(i<todo.length){const f=todo[i++];try{got[f.name]={id:f.id,md5:f.md5Checksum,modifiedTime:f.modifiedTime,json:await downloadJson(f.id,f.name)};}catch(e){errors[f.name]=String(e&&e.message||e);}}}
      await Promise.all(Array.from({length:Math.min(parallel,todo.length)},worker));
      return {downloaded:got,errors,skipped:files.length-todo.length};
    }
    async function createFile(name){
      const r=await auth.driveFetch(`${API}?fields=id,name,modifiedTime,size,md5Checksum`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,parents:['appDataFolder'],mimeType:'application/json'})});
      return await r.json();
    }
    /* verified upload: the returned md5Checksum must equal the local one; otherwise retry (the old version stays readable) */
    async function upload(name,obj){
      guard('upload');
      const text=typeof obj==='string'?obj:JSON.stringify(obj),want=md5(text);
      let file=(await listByName(name))[0];
      if(!file)file=await createFile(name);
      let last=null;
      for(let i=0;i<retries;i++){
        const r=await auth.driveFetch(`${UPLOAD}/${encodeURIComponent(file.id)}?uploadType=media&fields=id,name,modifiedTime,size,md5Checksum`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:text});
        last=await r.json();
        if(last&&last.md5Checksum===want)return {...last,md5:want};
      }
      throw new Error(`Upload of ${name} could not be verified (md5 ${last&&last.md5Checksum} vs ${want}).`);
    }
    async function copy(id,name){
      guard('copy');
      const r=await auth.driveFetch(`${API}/${encodeURIComponent(id)}/copy?fields=id,name,modifiedTime,size,md5Checksum`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,parents:['appDataFolder']})});
      return await r.json();
    }
    async function remove(id){guard('delete');await auth.driveFetch(`${API}/${encodeURIComponent(id)}`,{method:'DELETE'});}
    /* custom form content: write-once by hash, 4 MB parts; data is always in `.pN` parts, the bare name is the manifest */
    function contentParts(sha,text){
      const parts=[];for(let o=0;o<text.length;o+=PART_BYTES)parts.push(text.slice(o,o+PART_BYTES));
      if(!parts.length)parts.push('');
      return parts.map((t,i)=>({name:N.content(sha,i),text:t}));
    }
    return {get writesEnabled(){return writes;},enableWrites(v){writes=!!v;},list,listV3,listByName,downloadText,downloadJson,downloadChanged,upload,copy,remove,contentParts};
  }
  return {md5Hex,N,parseName,create,ShadowModeError,PART_BYTES,SNAPSHOT_KEEP_DAYS};
});

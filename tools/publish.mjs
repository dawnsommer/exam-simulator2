// Validate ordinary update folders and build a deployment artifact without backend sources.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url), C=require('../js/form-updates-core.js');
const defaultRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
export function buildManifest(root,commit){
  if(!/^[a-f0-9]{40}$/.test(commit||''))throw new Error('A full source commit SHA is required.');
  const dir=path.join(root,'update'),items=fs.readdirSync(dir,{withFileTypes:true});
  const folders=items.filter(e=>e.isDirectory()).map(e=>e.name).sort();
  for(const e of items)if(e.isSymbolicLink()||(!e.isDirectory()&&!['instructions.txt','.gitkeep','.DS_Store'].includes(e.name)))throw new Error('Unexpected update entry: '+e.name);
  const instructions=C.parseInstructions(fs.readFileSync(path.join(dir,'instructions.txt'),'utf8'),folders);
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),start=html.indexOf('function normalizeBank(data){'),end=html.indexOf('\nfunction getBlockSizeSetting()',start);
  if(start<0||end<0)throw new Error('Could not locate form validator.');
  const normalize=vm.runInNewContext('const letters="ABCDEFGHIJKLMNO".split("");'+html.slice(start,end)+';normalizeBank');
  const forms=folders.map(id=>{
    const files=[];
    function walk(folder,prefix){for(const e of fs.readdirSync(folder,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){if(e.name==='.DS_Store'||e.name.startsWith('._')||e.name==='__MACOSX')continue;const p=prefix+'/'+e.name;C.safePath(p);if(e.isSymbolicLink())throw new Error('Symlinks are not supported: '+p);if(e.isDirectory())walk(path.join(folder,e.name),p);else{const bytes=fs.readFileSync(path.join(folder,e.name));files.push({path:p,size:bytes.length,sha256:sha(bytes)});}}}
    walk(path.join(dir,id),id);
    const bank=JSON.parse(fs.readFileSync(path.join(dir,id,id+'.json'),'utf8'));let normalized;try{normalized=normalize(bank);}catch(e){throw new Error(id+': '+e.message);}
    const policy=instructions.get(id),revision=sha(C.stable({files,tab:policy.tab,onExisting:policy.onExisting}));
    return {...policy,title:bank.title||id,totalQuestions:normalized.blocks.reduce((n,b)=>n+b.questions.length,0),revision,files};
  });
  return C.validateManifest({schemaVersion:1,repository:'dawnsommer/exam-simulator2',sourceCommit:commit,forms});
}
export function publish(root,output,commit){
  const manifest=buildManifest(root,commit);
  const publicFiles=['index.html','manifest.webmanifest','offline.html','privacy.html','sw.js','app-update.js','bulk-import.js','exam-notes.js','nav-delay.js','jszip.min.js','thunder-ui.js','js','icons','ui_icons'];
  const allowed=new Set([...publicFiles,'.nojekyll','form-updates-manifest.json']);
  if(path.resolve(output)===path.resolve(root)||path.resolve(root).startsWith(path.resolve(output)+path.sep))throw new Error('Choose a dedicated site output directory.');
  if(fs.existsSync(output)){
    for(const name of fs.readdirSync(output))if(!allowed.has(name))throw new Error('Unexpected file in site output: '+name+'. Use an empty output directory.');
    for(const name of allowed)fs.rmSync(path.join(output,name),{recursive:true,force:true});
  }
  fs.mkdirSync(output,{recursive:true});
  for(const f of publicFiles)fs.cpSync(path.join(root,f),path.join(output,f),{recursive:true});
  fs.writeFileSync(path.join(output,'.nojekyll'),'');
  fs.writeFileSync(path.join(output,'form-updates-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  return manifest;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const manifest=publish(defaultRoot,path.resolve(defaultRoot,process.env.SITE_OUTPUT||'_site'),process.env.GITHUB_SHA);
  console.log('Prepared site with '+manifest.forms.length+' published form update(s).');
}

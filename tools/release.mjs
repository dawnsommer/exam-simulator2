// Run before every deploy. No dependencies; paths are resolved relative to this script.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const C=createRequire(import.meta.url)('../js/form-updates-core.js');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const write=(p,s)=>fs.writeFileSync(path.join(root,p),s);
const current=Number(read('sw.js').match(/const VERSION = (\d+);/)[1]);
const check=process.argv.includes('--check'), version=check?current:current+1;
// Hidden files (macOS .DS_Store) are never deployed, so they must not enter the offline shell.
function walk(dir){return fs.readdirSync(path.join(root,dir),{withFileTypes:true}).filter(e=>!e.name.startsWith('.')).flatMap(e=>e.isDirectory()?walk(path.posix.join(dir,e.name)):[path.posix.join(dir,e.name)]);}
const assets=[...fs.readdirSync(root).filter(f=>/\.(js|css)$/.test(f)&&f!=='sw.js'&&!f.startsWith('.')),...['js','icons','ui_icons'].flatMap(walk)].sort();
const url=f=>'./'+f+(/\.(js|css)$/.test(f)||f.startsWith('icons/')?'?v='+version:'');
const shell=['./','index.html','offline.html','privacy.html','manifest.webmanifest',...assets.map(url)];
const replaceVersion=s=>s.replace(/\?v=[A-Za-z0-9_.%-]+/g,'?v='+version);
const outputs=new Map();
outputs.set('index.html',replaceVersion(read('index.html')));
// Classic scripts have no imports today; also coordinate versioned module imports when added.
for(const file of assets.filter(f=>f.endsWith('.js')&&f!=='app-update.js')){
  outputs.set(file,replaceVersion(read(file)));
}
// thunder-ui.js carries the release number shown in Settings › About of both apps; the Local copy (../thunder-ui.js) is kept identical.
outputs.set('thunder-ui.js',outputs.get('thunder-ui.js').replace(/const TU_RELEASE = \d+;/,'const TU_RELEASE = '+version+';'));
outputs.set('app-update.js',replaceVersion(read('app-update.js')).replace(/const APP_VERSION = \d+;/,'const APP_VERSION = '+version+';').replace(/const APP_SHELL = \[[\s\S]*?\];/,'const APP_SHELL = '+JSON.stringify(shell,null,2)+';'));
outputs.set('sw.js',read('sw.js').replace(/const VERSION = \d+;/,'const VERSION = '+version+';').replace(/const SHELL = \[[\s\S]*?\];/,'const SHELL = '+JSON.stringify(shell,null,2)+';'));
const manifest=JSON.parse(replaceVersion(read('manifest.webmanifest')));manifest.start_url='./index.html';outputs.set('manifest.webmanifest',JSON.stringify(manifest,null,2)+'\n');
// Version every external script/style even if it did not have a query before.
outputs.set('index.html',outputs.get('index.html').replace(/(<script\b[^>]*\bsrc=["'])([^"']+)(["'])/gi,(_,a,u,b)=>a+u.replace(/(?:\?v=[^?&#]+)?$/,'?v='+version)+b).replace(/(<link\b(?=[^>]*\brel=["']stylesheet["'])[^>]*\bhref=["'])([^"']+)(["'])/gi,(_,a,u,b)=>a+u.replace(/(?:\?v=[^?&#]+)?$/,'?v='+version)+b));
// Rapid Review explanation files (update/explanations/<ID>.json): JSON, type, formId = file name, qid keys, <= 2 MB; qids must exist in update/<ID>/<ID>.json when that form is in update/.
const xdir=path.join(root,'update','explanations'),xfiles=fs.existsSync(xdir)?fs.readdirSync(xdir).filter(f=>!f.startsWith('.')&&f!=='__MACOSX'):[];
for(const f of xfiles){
  if(!/^[A-Za-z0-9_-]+\.json$/.test(f))throw new Error('update/explanations/'+f+': file names must be <FormID>.json.');
  const id=f.slice(0,-5),bankFile=path.join(root,'update',id,id+'.json');let qids=null;
  if(fs.existsSync(bankFile)){const bank=JSON.parse(fs.readFileSync(bankFile,'utf8'));qids=new Set((Array.isArray(bank.blocks)?bank.blocks:[{questions:bank.questions||bank}]).flatMap(b=>Array.isArray(b)?b:(b.questions||b.items||[])).map(q=>q&&q.qid).filter(Boolean).map(String));}
  C.validateExplanationFile(id,fs.readFileSync(path.join(xdir,f)),qids);
}
// rapid-review.js is shared with Local (../rapid-review.js), like thunder-ui.js
const localRR=path.join(root,'..','rapid-review.js');
if(check){const stale=[...outputs].filter(([f,s])=>read(f)!==s).map(([f])=>f);if(fs.existsSync(localRR)&&fs.readFileSync(localRR,'utf8')!==outputs.get('rapid-review.js'))stale.push('../rapid-review.js');if(stale.length)throw new Error('Release files are out of sync: '+stale.join(', '));console.log('Release '+version+' verified; '+shell.length+' shell entries; '+xfiles.length+' explanation file(s) valid.');}
else{for(const [f,s] of outputs)write(f,s);const local=path.join(root,'..','thunder-ui.js');if(fs.existsSync(local))fs.writeFileSync(local,outputs.get('thunder-ui.js'));if(fs.existsSync(path.join(root,'..')))fs.writeFileSync(localRR,outputs.get('rapid-review.js'));console.log('Released app version '+version+'; '+shell.length+' shell entries.');}

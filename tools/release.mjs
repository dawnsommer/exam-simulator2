// Run before every deploy. No dependencies; paths are resolved relative to this script.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const write=(p,s)=>fs.writeFileSync(path.join(root,p),s);
const current=Number(read('sw.js').match(/const VERSION = (\d+);/)[1]);
const check=process.argv.includes('--check'), version=check?current:current+1;
function walk(dir){return fs.readdirSync(path.join(root,dir),{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.posix.join(dir,e.name)):[path.posix.join(dir,e.name)]);}
const assets=[...fs.readdirSync(root).filter(f=>/\.(js|css)$/.test(f)&&f!=='sw.js'),...['js','icons','ui_icons'].flatMap(walk)].sort();
const url=f=>'./'+f+(/\.(js|css)$/.test(f)||f.startsWith('icons/')?'?v='+version:'');
const shell=['./','index.html','offline.html','privacy.html','manifest.webmanifest',...assets.map(url)];
const replaceVersion=s=>s.replace(/\?v=[A-Za-z0-9_.%-]+/g,'?v='+version);
const outputs=new Map();
outputs.set('index.html',replaceVersion(read('index.html')));
// Classic scripts have no imports today; also coordinate versioned module imports when added.
for(const file of assets.filter(f=>f.endsWith('.js')&&f!=='app-update.js')){
  outputs.set(file,replaceVersion(read(file)));
}
outputs.set('app-update.js',replaceVersion(read('app-update.js')).replace(/const APP_VERSION = \d+;/,'const APP_VERSION = '+version+';').replace(/const APP_SHELL = \[[\s\S]*?\];/,'const APP_SHELL = '+JSON.stringify(shell,null,2)+';'));
outputs.set('sw.js',read('sw.js').replace(/const VERSION = \d+;/,'const VERSION = '+version+';').replace(/const SHELL = \[[\s\S]*?\];/,'const SHELL = '+JSON.stringify(shell,null,2)+';'));
const manifest=JSON.parse(replaceVersion(read('manifest.webmanifest')));manifest.start_url='./index.html';outputs.set('manifest.webmanifest',JSON.stringify(manifest,null,2)+'\n');
// Version every external script/style even if it did not have a query before.
outputs.set('index.html',outputs.get('index.html').replace(/(<script\b[^>]*\bsrc=["'])([^"']+)(["'])/gi,(_,a,u,b)=>a+u.replace(/(?:\?v=[^?&#]+)?$/,'?v='+version)+b).replace(/(<link\b(?=[^>]*\brel=["']stylesheet["'])[^>]*\bhref=["'])([^"']+)(["'])/gi,(_,a,u,b)=>a+u.replace(/(?:\?v=[^?&#]+)?$/,'?v='+version)+b));
if(check){const stale=[...outputs].filter(([f,s])=>read(f)!==s).map(([f])=>f);if(stale.length)throw new Error('Release files are out of sync: '+stale.join(', '));console.log('Release '+version+' verified; '+shell.length+' shell entries.');}
else{for(const [f,s] of outputs)write(f,s);console.log('Released app version '+version+'; '+shell.length+' shell entries.');}

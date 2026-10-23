const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const version=Number(fs.readFileSync(path.join(root,'sw.js'),'utf8').match(/const VERSION = (\d+);/)[1]);
function worker({offline=false}={}){
 const handlers={},calls={fetch:[],opened:[],deleted:[],precache:[]},stores=new Map();
 const caches={async open(key){calls.opened.push(key);if(!stores.has(key))stores.set(key,new Map());const data=stores.get(key);return {async match(req){return data.get(typeof req==='string'?new URL(req,'https://example.test/exam-simulator2/').href:req.url)},async put(req,res){data.set(req.url,res)},async addAll(reqs){calls.precache.push(...reqs)}}},async keys(){return ['otherapp-v1','exam-simulator2-v0','exam-simulator2-v'+version]},async delete(key){calls.deleted.push(key)}};
 class RelativeRequest extends Request {constructor(url,opts){super(new URL(url,'https://example.test/exam-simulator2/sw.js'),opts)}}
 const c=vm.createContext({URL,Request:RelativeRequest,Response,caches,fetch:async(req)=>{calls.fetch.push(req.url);if(offline)throw new Error('offline');return new Response('network')},setTimeout,clearTimeout,self:{registration:{scope:'https://example.test/exam-simulator2/'},clients:{async claim(){}},async skipWaiting(){},addEventListener(n,fn){handlers[n]=fn}}});
 vm.runInContext(fs.readFileSync(path.join(root,'sw.js'),'utf8'),c);
 return {handlers,calls,stores};
}
test('worker install revalidates the complete shell and cleans only app-owned old caches',async()=>{
 const {handlers,calls}=worker();let pending;handlers.install({waitUntil(p){pending=p}});await pending;
 assert.ok(calls.precache.some(r=>r.url.endsWith('/index.html')));assert.ok(calls.precache.every(r=>r.cache==='reload'));assert.ok(calls.precache.some(r=>r.url.includes('/exam-notes.js?v='+version)));
 handlers.activate({waitUntil(p){pending=p}});await pending;assert.deepEqual(calls.deleted,['exam-simulator2-v0']);
});
test('worker does not intercept another app, another origin, or writes',()=>{
 const {handlers}=worker();let responded=false;
 for(const req of [new Request('https://example.test/otherapp/index.html'),new Request('https://api.test/test'),new Request('https://example.test/exam-simulator2/write',{method:'POST'})])handlers.fetch({request:req,respondWith(){responded=true}});
 assert.equal(responded,false);
});
test('versioned assets use only this release cache; explicit reload reaches the network',async()=>{
 const {handlers,calls,stores}=worker();const req=new Request('https://example.test/exam-simulator2/exam-notes.js?v='+version);
 stores.set('exam-simulator2-v'+version,new Map([[req.url,new Response('cached')]]));
 let pending;handlers.fetch({request:req,respondWith(p){pending=p}});assert.equal(await(await pending).text(),'cached');assert.equal(calls.fetch.length,0);
 handlers.fetch({request:new Request(req,{cache:'reload'}),respondWith(p){pending=p}});assert.equal(await(await pending).text(),'network');assert.equal(calls.fetch.length,1);
 assert.ok(calls.opened.every(k=>k==='exam-simulator2-v'+version));
});
test('release assets, UI version, and unversioned launch URL stay coordinated',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 for(const m of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)/g))assert.equal(new URL(m[1],'https://example.test/exam-simulator2/').searchParams.get('v'),String(version));
 const app=fs.readFileSync(path.join(root,'app-update.js'),'utf8');assert.match(app,new RegExp('const APP_VERSION = '+version+';'));
 assert.equal(JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8')).start_url,'./index.html');
 assert.match(app,/register\('sw.js',\{updateViaCache:'none'\}\)/);
 assert.doesNotMatch(app,/localStorage\.clear|deleteDatabase|getRegistrations/);
});

test('form-update manifests bypass app caches and fail offline rather than using stale availability',async()=>{
 const req=new Request('https://example.test/exam-simulator2/form-updates-manifest.json');
 for(const offline of [false,true]){const w=worker({offline});w.stores.set('exam-simulator2-v'+version,new Map([[req.url,new Response('stale update')]]));let pending;w.handlers.fetch({request:req,respondWith(p){pending=p}});if(offline)await assert.rejects(pending,/offline/);else assert.equal(await(await pending).text(),'network');assert.equal(w.calls.opened.length,0);}
});
test('published site contains every offline shell file and every script index.html loads',async()=>{
 const os=require('node:os'),{pathToFileURL}=require('node:url');
 const {publish}=await import(pathToFileURL(path.join(root,'tools/publish.mjs')).href);
 const out=fs.mkdtempSync(path.join(os.tmpdir(),'shell-publish-'));
 try{
  publish(root,path.join(out,'site'),'a'.repeat(40));
  const shell=JSON.parse(fs.readFileSync(path.join(root,'sw.js'),'utf8').match(/const SHELL = (\[[\s\S]*?\]);/)[1]);
  const scripts=[...fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)].map(m=>m[1]).filter(u=>!/^https?:/.test(u));
  for(const url of [...shell,...scripts]){
   const file=url.replace(/^\.\//,'').replace(/\?.*$/,'')||'index.html';
   assert.ok(fs.existsSync(path.join(out,'site',file)),url+' is missing from the published site');
  }
 }finally{fs.rmSync(out,{recursive:true,force:true});}
});

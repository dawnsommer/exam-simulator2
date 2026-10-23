const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {DatabaseSync}=require('node:sqlite'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),origin='https://dawnsommer.github.io',pass='synthetic-admin-secret';
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
async function setup(){
 const {default:worker}=await import(pathToFileURL(path.join(root,'backend/worker.mjs')).href);
 const db=new DatabaseSync(':memory:');db.exec(fs.readFileSync(path.join(root,'backend/form-updates.sql'),'utf8'));
 db.exec(`CREATE TABLE sessions (session_hash TEXT, account_id TEXT, app_id TEXT, device_id TEXT, created_at INTEGER, last_used_at INTEGER, expires_at INTEGER, revoked_at INTEGER);
 CREATE TABLE google_accounts (account_id TEXT PRIMARY KEY, email TEXT, revoked_at INTEGER, encrypted_refresh_token TEXT, refresh_token_iv TEXT);
 CREATE TABLE oauth_states (state TEXT, app_id TEXT, return_url TEXT, device_id TEXT, created_at INTEGER, expires_at INTEGER, used_at INTEGER);`);
 const env={EXAM2_ADMIN_PASSWORD:pass,GOOGLE_CLIENT_ID:'test',AUTH_DB:{prepare(sql){return {bind(...args){const statement=db.prepare(sql);return {async first(){return statement.get(...args)||null;},async all(){return {results:statement.all(...args)};},async run(){return statement.run(...args);}};}};}}};
 async function call(route,body={},token='',ip='127.0.0.1'){
  const response=await worker.fetch(new Request('https://worker.test/exam-simulator2/updates/'+route,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':ip,...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)}),env);
  return {status:response.status,data:await response.json(),response};
 }
 return {db,env,worker,call,close:()=>db.close()};
}
const receipt=(id='FORM')=>({installationId:'device-12345',formId:id,revision:'a'.repeat(64),title:'Form',deviceLabel:'iPad · 1234',installedAt:new Date().toISOString()});
test('admin is password-only, grants survive Google changes, and lock revokes only that browser token',async()=>{
 const x=await setup();try{
  assert.equal((await x.call('admin/receipts')).status,401);
  const a=await x.call('admin/unlock',{password:pass}),b=await x.call('admin/unlock',{password:pass});assert.equal(a.status,200);assert.notEqual(a.data.token,b.data.token);
  assert.equal(x.db.prepare('SELECT token_hash FROM exam2_admin_sessions WHERE token_hash = ?').get(a.data.token),undefined);
  assert.ok(x.db.prepare('SELECT token_hash FROM exam2_admin_sessions WHERE token_hash = ?').get(sha(a.data.token)));
  assert.equal((await x.call('admin/status',{},a.data.token)).status,200);
  assert.equal((await x.call('admin/lock',{},a.data.token)).status,200);assert.equal((await x.call('admin/receipts',{},a.data.token)).status,401);assert.equal((await x.call('admin/status',{},b.data.token)).status,200);
 }finally{x.close();}
});
test('password failures are rate limited and missing secret fails closed',async()=>{
 const x=await setup();try{for(let i=0;i<5;i++)assert.equal((await x.call('admin/unlock',{password:'wrong'})).status,403);assert.equal((await x.call('admin/unlock',{password:pass})).status,429);assert.equal((await x.call('admin/unlock',{password:pass},'','different-ip')).status,200);delete x.env.EXAM2_ADMIN_PASSWORD;assert.equal((await x.call('admin/unlock',{password:pass})).status,503);}finally{x.close();}
});
test('receipts derive Google identity server-side, reject foreign/revoked sessions, and deduplicate retries',async()=>{
 const x=await setup();try{
  x.db.prepare('INSERT INTO google_accounts (account_id,email) VALUES (?,?)').run('acct','verified@example.test');
  x.db.prepare('INSERT INTO sessions (session_hash,account_id,app_id) VALUES (?,?,?)').run(sha('google-session'),'acct','exam-simulator2');
  const r=receipt();r.account_email='forged@example.test';assert.equal((await x.call('receipt',r,'google-session')).status,200);assert.equal((await x.call('receipt',r,'google-session')).status,200);
  assert.equal(x.db.prepare('SELECT COUNT(*) AS n FROM exam2_update_receipts').get().n,1);assert.equal(x.db.prepare('SELECT account_email FROM exam2_update_receipts').get().account_email,'verified@example.test');
  assert.equal((await x.call('receipt',receipt('ANON'))).status,200);assert.equal(x.db.prepare('SELECT account_email FROM exam2_update_receipts WHERE form_id = ?').get('ANON').account_email,null);
  x.db.prepare('UPDATE sessions SET app_id = ?').run('thundershadow');assert.equal((await x.call('receipt',receipt('FOREIGN'),'google-session')).status,401);
  x.db.prepare('UPDATE sessions SET app_id = ?, expires_at = ?').run('exam-simulator2',1);assert.equal((await x.call('receipt',receipt('EXPIRED'),'google-session')).status,401);
  x.db.prepare('UPDATE sessions SET expires_at = NULL, revoked_at = 1').run();assert.equal((await x.call('receipt',receipt('REVOKED'),'google-session')).status,401);
  assert.equal((await x.call('receipt',{...receipt(),formId:'../bad'})).status,400);
 }finally{x.close();}
});
test('admin receipts are privately filtered and paginated; literal search cannot inject SQL',async()=>{
 const x=await setup();try{
  for(let i=0;i<103;i++)await x.call('receipt',receipt('FORM'+i));
  const token=(await x.call('admin/unlock',{password:pass})).data.token;
  const first=await x.call('admin/receipts',{},token);assert.equal(first.status,200);assert.equal(first.data.rows.length,100);assert.ok(first.data.nextCursor);
  assert.equal((await x.call('admin/receipts',{after:first.data.nextCursor},token)).data.rows.length,3);
  assert.equal((await x.call('admin/receipts',{formId:'FORM1'},token)).data.rows.length,1);
  assert.equal((await x.call('admin/receipts',{search:"%' OR 1=1 --"},token)).data.rows.length,0);
 }finally{x.close();}
});
test('original health/OAuth/disconnect contracts remain available and foreign origins are rejected',async()=>{
 const x=await setup();try{
  assert.equal((await x.worker.fetch(new Request('https://worker.test/health'),x.env)).status,200);
  for(const [app,slug] of [['exam-simulator2','exam-simulator2'],['step-simulator-progress','step-simulator-progress'],['thundershadow','ThunderShadow'],['thundertracker','thundertracker']]){
   const u='https://worker.test/oauth/start?'+new URLSearchParams({app_id:app,return_url:'https://dawnsommer.github.io/'+slug+'/',device_id:'device'});const r=await x.worker.fetch(new Request(u),x.env);assert.equal(r.status,302);assert.ok(r.headers.get('Location').startsWith('https://accounts.google.com/'));
  }
  const r=await x.worker.fetch(new Request('https://worker.test/exam-simulator2/updates/admin/unlock',{method:'POST',headers:{Origin:'https://elsewhere.test'},body:'{}'}),x.env);assert.equal(r.status,403);
  assert.equal((await x.worker.fetch(new Request('https://worker.test/disconnect',{method:'POST',headers:{Origin:origin,Authorization:'Bearer unknown'}}),x.env)).status,200);
 }finally{x.close();}
});

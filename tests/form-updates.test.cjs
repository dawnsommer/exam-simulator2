const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),vm=require('node:vm');
const {pathToFileURL}=require('node:url');
const C=require('../js/form-updates-core.js'),Bulk=require('../bulk-import.js');
const root=path.resolve(__dirname,'..'),commit='a'.repeat(40),sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),start=html.indexOf('function normalizeBank(data){');
const normalize=vm.runInNewContext('const letters="ABCDEFGHIJKLMNO".split("");'+html.slice(start,html.indexOf('\nfunction getBlockSizeSetting()',start))+';normalizeBank');
function bank(){return {title:'Test',formUid:'test',qidSchemaVersion:1,provenance:{keep:true},blocks:[{name:'One',questions:[{qid:'q1',stem:'One',choices:['A','B'],correct:0,explanation:'Old'},{qid:'q2',stem:'Two',choices:['C','D'],correct:1}]}]};}
test('TXT instructions report exact lines, enforce one policy per folder, and support comments',()=>{
 const rows=C.parseInstructions('# Folder | Tab | action\nA | N-Forms | UPDATE\n\nB | UWSA | skip',['A','B']);assert.equal(rows.get('A').onExisting,'update');
 for(const [text,folders,match] of [['A | Tab | replace',['A'],/line 1/],['A | X | skip\na | Y | skip',['A'],/line 2.*duplicate/],['A | X | skip',['A','B'],/folder B/],['A | X | skip',[],/missing folder A/],['A | Overview | skip',['A'],/form tab/],['../A | X | skip',['../A'],/invalid form folder/]])assert.throws(()=>C.parseInstructions(text,folders),match);
 assert.equal(C.parseInstructions('# Empty',[]).size,0);
});
test('entry planner preserves banks/assets without a ZIP and rejects duplicate/path traversal',async()=>{
 const entries=[{path:'A/A.json',readText:async()=>JSON.stringify(bank()),readBlob:async()=>new Blob()},{path:'A/assets/a.png',readText:async()=>'',readBlob:async()=>new Blob(['image'])}];
 const plan=await Bulk.prepareEntries(entries,normalize);assert.equal(plan.forms[0].id,'A');assert.equal(plan.forms[0].bank.provenance.keep,true);assert.equal(plan.forms[0].assets[0].path,'assets/A/a.png');
 await assert.rejects(Bulk.prepareEntries(entries.concat(entries[0]),normalize),/Duplicate/);
 await assert.rejects(Bulk.prepareEntries([{...entries[0],path:'../A.json'}],normalize),/Unsafe/);
});
test('QID revisions preserve installed ordering and block choice/answer/question identity changes',()=>{
 const a=bank(),b=bank();b.blocks[0].questions.reverse();b.blocks[0].questions[1].explanation='New';
 const out=C.compatibleBank(a,b,normalize,true);assert.deepEqual(out.blocks[0].questions.map(q=>q.qid),['q1','q2']);assert.equal(out.blocks[0].questions[0].explanation,'New');assert.equal(out.provenance.keep,true);
 for(const change of [x=>x.blocks[0].questions.pop(),x=>x.blocks[0].questions[0].correct=1,x=>x.blocks[0].questions[0].choices.reverse(),x=>x.formUid='other',x=>x.blocks[0].questions[1].qid='q1']){const n=bank();change(n);assert.throws(()=>C.compatibleBank(a,n,normalize,true));}
 const n=bank();n.blocks[0].questions[0].correct=1;assert.throws(()=>C.compatibleBank(a,n,normalize,false),/permanent question/);delete a.qidSchemaVersion;delete n.qidSchemaVersion;assert.equal(C.compatibleBank(a,n,normalize,false).blocks[0].questions[0].correct,1);
});
test('legacy revisions ignore top-level metadata but preserve substantive blocks and nested attempt hashes',()=>{
 const a=bank();delete a.qidSchemaVersion;const b=structuredClone(a);b.title='Renamed';assert.equal(C.compatibleBank(a,b,normalize,true).title,'Renamed');b.blocks[0].questions[0].stem='changed';assert.throws(()=>C.compatibleBank(a,b,normalize,true),/identical/);
 const progress={bankHash:'old',bundle:{attempts:[{session:{bankHash:'old',answers:[1],notes:'Keep'}}]},other:{bankHash:'different'}};
 const out=C.rewriteHash(progress,'old','new');assert.equal(out.bundle.attempts[0].session.bankHash,'new');assert.deepEqual(out.bundle.attempts[0].session.answers,[1]);assert.equal(out.other.bankHash,'different');assert.equal(progress.bankHash,'old');
});
test('publisher validates forms, creates deterministic manifests, and excludes backend sources',async()=>{
 const {buildManifest,publish}=await import(pathToFileURL(path.join(root,'tools/publish.mjs')).href);
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'form-update-publish-'));
 try{
  fs.mkdirSync(path.join(tmp,'update/A/assets'),{recursive:true});fs.writeFileSync(path.join(tmp,'index.html'),html);fs.writeFileSync(path.join(tmp,'update/instructions.txt'),'A | My tab | update');fs.writeFileSync(path.join(tmp,'update/A/A.json'),JSON.stringify(bank()));fs.writeFileSync(path.join(tmp,'update/A/assets/p.png'),'bytes');
  const a=buildManifest(tmp,commit),b=buildManifest(tmp,commit);assert.deepEqual(a,b);assert.equal(a.forms[0].files.length,2);assert.equal(a.forms[0].files[1].sha256,sha('bytes'));
  fs.writeFileSync(path.join(tmp,'update/A/assets/p.png'),'changed');assert.notEqual(buildManifest(tmp,commit).forms[0].revision,a.forms[0].revision);
  fs.writeFileSync(path.join(tmp,'update/A/A.json'),'{broken');assert.throws(()=>buildManifest(tmp,commit));
  const output=path.join(tmp,'site');const empty=publish(root,output,commit);assert.equal(empty.forms.length,0);assert.equal(fs.existsSync(path.join(output,'backend')),false);assert.equal(fs.existsSync(path.join(output,'tests')),false);assert.equal(fs.existsSync(path.join(output,'js/form-updates.js')),true);fs.mkdirSync(path.join(output,'backend'));assert.throws(()=>publish(root,output,commit),/Unexpected file in site output/);
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
test('manifest rejects unpinned sources, duplicate IDs, unsafe paths, and invalid checksums',()=>{
 const m={schemaVersion:1,repository:'dawnsommer/exam-simulator2',sourceCommit:commit,forms:[{id:'A',tab:'Tab',onExisting:'update',revision:'b'.repeat(64),files:[{path:'A/A.json',sha256:'c'.repeat(64),size:2}]}]};assert.equal(C.validateManifest(m),m);
 for(const change of [x=>x.sourceCommit='main',x=>x.repository='someone/else',x=>x.forms.push(x.forms[0]),x=>x.forms[0].files[0].path='A/../x',x=>x.forms[0].files[0].sha256='oops']){const n=structuredClone(m);change(n);assert.throws(()=>C.validateManifest(n));}
});

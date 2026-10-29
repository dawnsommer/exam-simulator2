/* Sync V3 bridge (SYNC_HYBRID_PLAN.md sections 3 and 9): turns the app's own progress records into plain units
   (extract), rebuilds the counts from units (rebuild, for verification and, in Release B, apply), and the V2-style counts
   used by migration step 6. The pure helpers work in node and the browser; `readLocalUnits` is the thin glue over
   window.StepExamSyncBridge (read-only in Release A; nothing here writes app data or Drive). */
(function(root,factory){
  const Core=(typeof module==='object'&&module.exports)?require('./sync3-core.js'):root.StepSync3Core;
  const api=factory(Core);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.StepSync3Bridge=api;
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:this),function(C){
  'use strict';
  const K=C.K,isObj=v=>v&&typeof v==='object'&&!Array.isArray(v);
  const countOf=b=>Math.max(Number(b&&b.total)||0,Array.isArray(b&&b.answers)?b.answers.length:0);

  async function sha256Hex(text){
    const g=typeof globalThis!=='undefined'?globalThis:window;
    if(g.crypto&&g.crypto.subtle){const buf=await g.crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return Array.from(new Uint8Array(buf)).map(x=>x.toString(16).padStart(2,'0')).join('');}
    return require('node:crypto').createHash('sha256').update(text).digest('hex');
  }
  /* attempts of one progress record: [{attemptId, a, session}] (bundle, legacy single session, or a bare session) */
  function attemptsOf(progress){
    if(!isObj(progress))return [];
    const b=isObj(progress.bundle)?progress.bundle:(Array.isArray(progress.attempts)?progress:null);
    if(b&&Array.isArray(b.attempts))return b.attempts.filter(a=>a&&isObj(a.session)).map((a,i)=>({id:a.attemptId||a.session.attemptId||'',a,session:a.session,index:i}));
    if(isObj(progress.session))return [{id:progress.session.attemptId||'',a:{},session:progress.session,index:0}];
    if(Array.isArray(progress.blocks))return [{id:progress.attemptId||'',a:{},session:progress,index:0}];
    return [];
  }
  const typeOf=(a,s)=>{const t=String(s.attemptType||a.type||'');return s.qbankMode||/qbank/i.test(t)?'qbank':/^retest/i.test(t)?'retest':'first';};
  /* the QID of a saved position key: "formUid::qid", or a legacy "formId:block:question" looked up in the form's question index */
  function qidOfKey(key,rec){
    const k=String(key==null?'':key),i=k.indexOf('::');
    if(i>=0)return k.slice(i+2);
    const m=/^(.+?):(\d+):(\d+)$/.exec(k);
    if(m&&rec){const row=(rec.questionIndex||[]).find(r=>Number(r.blockIndex)===Number(m[2])&&Number(r.questionIndex)===Number(m[3]));return row&&row.qid?String(row.qid):'';}
    return '';
  }
  /* position -> QID per block: block.questionQids (set by the QID migration), else the session's positionQuestionKeys, else
     (Qbank) qbankKeys, else a browser-side resolver over StepQidMigration.sessionQuestionRefs; otherwise "pending" */
  function qidsOfSession(session,qbank,rec,resolveRefs){
    const rows=[],problems=[],keys=Array.isArray(session.qbankKeys)?session.qbankKeys:null,pq=Array.isArray(session.positionQuestionKeys)?session.positionQuestionKeys:null;
    let flat=0,refs=null,refsTried=false;
    (session.blocks||[]).forEach((b,bi)=>{
      const n=countOf(b),q=Array.isArray(b.questionQids)?b.questionQids:null;let list=null;
      if(q&&q.length>=n&&q.slice(0,n).every(Boolean))list=q.slice(0,n).map(String);
      if(!list&&pq&&Array.isArray(pq[bi])&&pq[bi].length>=n){const t=pq[bi].slice(0,n).map(k=>qidOfKey(k,rec));if(t.every(Boolean))list=t;}
      if(!list&&qbank&&keys&&keys.length>=flat+n)list=keys.slice(flat,flat+n).map(String);
      if(!list&&typeof resolveRefs==='function'){
        if(!refsTried){refsTried=true;try{refs=resolveRefs(session);}catch(e){refs=null;}}
        const r=refs&&refs[bi];
        if(r&&r.length>=n){const t=r.slice(0,n).map(x=>{const row=x&&(rec&&rec.questionIndex||[]).find(y=>Number(y.blockIndex)===Number(x.blockIndex)&&Number(y.questionIndex)===Number(x.questionIndex));return row&&row.qid?String(row.qid):'';});if(t.every(Boolean))list=t;}
      }
      if(!list)problems.push({code:'no-qids',block:bi+1});
      flat+=n;rows.push(list);
    });
    return {rows,problems};
  }
  const nonEmpty=v=>Array.isArray(v)?v.length>0:v!=null&&v!=='';
  /* extract one attempt's units ({k,v}, no stamps). Returns null with problems when a block has no QIDs yet. */
  async function extractAttempt({formUid,att,raw,a,session,qbank,rec,resolveRefs,dev,sha256}){
    const {rows,problems}=qidsOfSession(session,qbank,rec,resolveRefs);
    if(problems.length)return {problems:problems.map(p=>({...p,att})),units:[],keys:{}};
    const units=[],keys={},order=[],bl=[];
    rows.forEach(r=>{bl.push(r.length);r.forEach(q=>order.push(q));});
    units.push({k:K.att(att),v:{formUid,raw:raw!==undefined?raw:att,type:typeOf(a,session),src:String(session.sourceAttemptId||a.sourceAttemptId||''),pool:String(session.retestPool||session.pool||''),
      bs:String(session.blockSizeSetting||''),timer:session.timerEnabled!==undefined?!!session.timerEnabled:(session.timer!==undefined?session.timer:null),shuffle:!!(session.v215Shuffle&&session.v215Shuffle.enabled),
      order,bl,createdAt:String(a.createdAt||session.startedAt||''),
      /* what a device that only knows this attempt from the cloud needs to rebuild a session (write-once, like the rest of the header) */
      rt:String(session.attemptType||a.type||''),title:String(session.title||''),spq:String(session.secondsPerQuestion||''),mode:String(session.mode||''),sc:!!session.showCorrect,
      brk:session.break&&typeof session.break==='object'?{...session.break}:null,ab:Array.isArray(session.activeBlockIndexes)?session.activeBlockIndexes.slice():null,
      bnames:(session.blocks||[]).map((b,i)=>String(b&&b.blockName||'Block '+(i+1))),cfg:(session.blocks||[]).map((b,i)=>b&&b.configuredIndex!=null?Number(b.configuredIndex):i),
      qb:qbank&&a.entry?{name:String(a.entry.name||''),mode:String(a.entry.mode||''),sourceMode:String(a.entry.sourceMode||''),poolType:String(a.entry.poolType||''),attemptSource:String(a.entry.attemptSource||''),formIds:Array.isArray(a.entry.formIds)?a.entry.formIds.slice():[],createdAt:String(a.entry.createdAt||'')}:undefined}});
    const label=String(a.label||session.attemptLabel||'');if(label)units.push({k:K.attField(att,'label'),v:label});
    (session.blocks||[]).forEach((b,bi)=>{
      const q=rows[bi],n=q.length,bn=bi+1,log=Array.isArray(b.answerChangeLog)?b.answerChangeLog:[];
      for(let i=0;i<n;i++){
        const id=q[i],item=(f,v)=>units.push({k:K.item(att,id,f),v});
        const ans=Array.isArray(b.answers)?b.answers[i]:null;if(ans!=null)item('ans',ans);
        const first=Array.isArray(b.firstAnswers)?b.firstAnswers[i]:null;if(first!=null)item('first',first);
        const entries=log.filter(e=>Number(e&&e.item)===i+1);if(entries.length)item('log',entries.map(e=>({...e})));
        const st=isObj(b.struck)?b.struck[i]:null;if(nonEmpty(st))item('st',st);
        if(Array.isArray(b.flagged)&&b.flagged[i]===true)item('fl',true);
        const hs=isObj(b.stemHighlightAnchors)?b.stemHighlightAnchors[i]:null;if(nonEmpty(hs))item('hs',hs);
        const he=isObj(b.explanationHighlightAnchors)?b.explanationHighlightAnchors[i]:null;if(nonEmpty(he))item('he',he);
        const hr=isObj(b.rapidHighlights)?b.rapidHighlights[i]:null;if(nonEmpty(hr))item('hr',hr);     // Rapid Review highlights: a field of their own, older code ignores it
        const tm=Array.isArray(b.questionTime)?Number(b.questionTime[i]):0;if(tm>0)item('tm',{__total:tm});
        const rv=isObj(b.revealed)||Array.isArray(b.revealed)?b.revealed[i]:null;if(rv===true)item('rv',true);
        const ra=b.result&&Array.isArray(b.result.answers)?b.result.answers.find(r=>Number(r&&r.item)===i+1):null;
        if(ra&&ra.correct!=null)keys[att+'|'+id]=ra.correct;
      }
      if(b.blockCompleted===true){
        const snap={};q.forEach((id,i)=>{const v=Array.isArray(b.answers)?b.answers[i]:null;if(v!=null)snap[id]=v;});
        units.push({k:K.block(att,bn,'done'),v:{done:true,ans:snap,at:String(b.result&&b.result.completedAt||''),el:b.result&&b.result.elapsedSeconds!=null?Number(b.result.elapsedSeconds):null,sid:String(b.result&&b.result.sessionId||'')}});     // the earliest completer's answer set wins (decision 2026-10-26)
      }
      if(String(b.notes||'').trim())units.push({k:K.block(att,bn,'nt'),v:String(b.notes)});
      if(b.blockCompleted!==true&&(Number(b.current)>0||b.blockRemainingSeconds!=null||b.resumeCapturedAt!=null)){
        units.push({k:K.block(att,bn,'sus'),v:{current:Number(b.current)||0,blockRemainingSeconds:b.blockRemainingSeconds==null?null:Number(b.blockRemainingSeconds),
          dayRemainingSeconds:b.dayRemainingSeconds==null?null:Number(b.dayRemainingSeconds),blockElapsedSeconds:b.blockElapsedSeconds==null?null:Number(b.blockElapsedSeconds),resumeCapturedAt:b.resumeCapturedAt==null?null:b.resumeCapturedAt,
          susp:!!(session.suspended&&Number(session.currentBlockPointer)===bi),rs:session.suspended&&Number(session.currentBlockPointer)===bi&&session.resumeState&&typeof session.resumeState==='object'?JSON.parse(JSON.stringify(session.resumeState)):null}});
      }
    });
    return {problems:[],units,keys};
  }
  /* where a form comes from: the update service (catalog: installed again from there), or the user's own file (custom = no fixed slot,
     imported = a fixed slot): those two travel as content (`v3.c.*`) */
  const srcOf=rec=>rec.formUpdateRevision?'catalog':rec.custom?'custom':'imported';
  /* extract one form (or the Qbank when formUid is __QBANK__). Never throws for data that is merely not ready:
     blocks without QIDs are reported in `problems` and their attempts are left out (= QID baseline pending). */
  async function extractForm({formUid,rec,progress,suspended,score,qbank,dev,sha256,resolveRefs}){
    sha256=sha256||sha256Hex;
    const units=[],problems=[],keys={},attempts=[],rawIds=[];
    const qsess=s=>s&&s.session?s.session:s;
    const list=qbank?attemptsOf({bundle:{attempts:(progress&&progress.sessions||[]).filter(s=>s&&(s.session||s.blocks)).map(s=>({attemptId:s.qbankTestId||s.attemptId||qsess(s).qbankTestId||qsess(s).attemptId||'',createdAt:s.createdAt||qsess(s).startedAt||'',label:s.name||s.label||'',entry:s,session:qsess(s)}))}}):attemptsOf(progress);
    /* a form whose QID schema is not established yet (QID baseline pending): positions are not stable identities, nothing is extracted */
    if(rec&&!qbank&&Number(rec.qidSchemaVersion||0)<1&&list.length){problems.push({code:'qid-schema',formUid});list.length=0;}
    for(const x of list){
      let raw=x.id;
      if(!raw)raw=await sha256(String(formUid)+'|'+String(x.session.startedAt||x.a.createdAt||'')+'|'+String(x.a.label||x.session.attemptLabel||''));
      const att=formUid+':'+raw;     // attempt ids are namespaced by form: legacy ids such as attempt_1 repeat across forms
      const r=await extractAttempt({formUid,att,raw,a:x.a,session:x.session,qbank,rec,resolveRefs,dev,sha256});
      problems.push(...r.problems);Object.assign(keys,r.keys);
      if(!r.problems.length){units.push(...r.units);attempts.push(att);rawIds.push(raw);}
    }
    if(!qbank){
      const b=isObj(progress&&progress.bundle)?progress.bundle:null;
      if(b&&b.activeAttemptId&&rawIds.includes(String(b.activeAttemptId)))units.push({k:K.form(formUid,'active'),v:String(b.activeAttemptId)});
      const g=b&&b.explanationHighlightAnchorsByQuestionKey;     // V2 global explanation highlights, shared by all attempts
      if(isObj(g))for(const [key,v] of Object.entries(g)){if(!nonEmpty(v))continue;const i=key.indexOf('::');units.push({k:K.item('~'+formUid,i>=0?key.slice(i+2):key,'he'),v});}
      if(suspended&&isObj(suspended.session||suspended)){
        const ss=suspended.session||suspended,aid=String(ss.attemptId||(b&&b.activeAttemptId)||'');
        if(aid&&rawIds.includes(aid))(ss.blocks||[]).forEach((bp,bi)=>{const ak=formUid+':'+aid;if(bp&&bp.blockCompleted!==true&&!units.some(u=>u.k===K.block(ak,bi+1,'sus')))units.push({k:K.block(ak,bi+1,'sus'),v:{current:Number(bp.current)||0,blockRemainingSeconds:bp.blockRemainingSeconds==null?null:Number(bp.blockRemainingSeconds),dayRemainingSeconds:bp.dayRemainingSeconds==null?null:Number(bp.dayRemainingSeconds),blockElapsedSeconds:bp.blockElapsedSeconds==null?null:Number(bp.blockElapsedSeconds),resumeCapturedAt:bp.resumeCapturedAt==null?null:bp.resumeCapturedAt,suspendedFile:true}});});
      }
    }
    if(rec){
      units.push({k:K.lib(formUid),v:{on:'installed',src:srcOf(rec),ch:String(rec.bankHash||'')}});
      units.push({k:K.libField(formUid,'rev'),v:{hash:String(rec.bankHash||''),seq:Number(rec.revisionSeq||rec.formRevisionSeq||0)}});
      if(rec.displayName&&rec.displayName!==rec.defaultName)units.push({k:K.libField(formUid,'name'),v:String(rec.displayName)});
      if(rec.color)units.push({k:K.libField(formUid,'color'),v:String(rec.color)});
      if(rec.custom&&rec.filter)units.push({k:K.libField(formUid,'tab'),v:String(rec.filter)});     // tabs are derived from the form's filter
    }
    if(score!=null&&String(score).trim()!==''&&!qbank)units.push({k:K.libField(formUid,'score'),v:String(score)});
    return {units,problems,keys,attempts,attemptsRaw:rawIds,complete:!problems.length};
  }
  /* the per-device time of a question: the app's total minus what the other devices' units already hold (tm = per-device max) */
  function localizeTm(units,known,dev){
    return units.map(u=>{
      if(C.parseKey(u.k).field!=='tm'||!u.v||u.v.__total==null)return u;
      const others=Object.entries((known[u.k]&&known[u.k].v)||{}).filter(([d])=>d!==dev).reduce((s,[,x])=>s+(Number(x)||0),0);
      return {k:u.k,v:{[dev]:Math.max(0,Number(u.v.__total)-others)}};
    });
  }
  const tmTotal=v=>Object.values(v||{}).reduce((s,x)=>s+(Number(x)||0),0);

  /* sessions rebuilt from visible units (positional arrays from QIDs), for verification today and apply in Release B */
  function rebuildAttempts(vis){
    const out=[];
    for(const att of C.attemptsOf(vis)){
      const h=vis[K.att(att)].v||{},order=Array.isArray(h.order)?h.order:[],bl=Array.isArray(h.bl)&&h.bl.length?h.bl:[order.length];
      let off=0;const blocks=bl.map((len,bi)=>{
        const q=order.slice(off,off+len);off+=len;const g=f=>i=>{const u=vis[K.item(att,q[i],f)];return u?u.v:undefined;};
        const b={blockName:(h.bnames&&h.bnames[bi])||'Block '+(bi+1),total:len,questionQids:q,answers:[],firstAnswers:[],flagged:[],struck:{},revealed:{},questionTime:[],stemHighlightAnchors:{},explanationHighlightAnchors:{},rapidHighlights:{},answerChangeLog:[],notes:'',blockCompleted:false};
        q.forEach((id,i)=>{
          const a=g('ans')(i);b.answers.push(a==null?null:a);const f=g('first')(i);b.firstAnswers.push(f==null?null:f);
          b.flagged.push(g('fl')(i)===true);const st=g('st')(i);if(nonEmpty(st))b.struck[i]=st;
          const hs=g('hs')(i);if(nonEmpty(hs))b.stemHighlightAnchors[i]=hs;
          const he=g('he')(i);if(nonEmpty(he))b.explanationHighlightAnchors[i]=he;
          const hr=g('hr')(i);if(nonEmpty(hr))b.rapidHighlights[i]=hr;
          b.questionTime.push(tmTotal(g('tm')(i)));const rv=g('rv')(i);if(rv===true)b.revealed[i]=true;
          (g('log')(i)||[]).forEach(e=>{const{t,...rest}=e;b.answerChangeLog.push({...rest,item:i+1});});
        });
        const nt=vis[K.block(att,bi+1,'nt')];if(nt)b.notes=String(nt.v||'');
        const d=vis[K.block(att,bi+1,'done')];b.blockCompleted=!!d&&(d.v===true||d.v.done===true);
        const sus=vis[K.block(att,bi+1,'sus')];
        if(sus&&sus.v&&!b.blockCompleted){b.current=Number(sus.v.current)||0;if(sus.v.blockRemainingSeconds!=null)b.blockRemainingSeconds=sus.v.blockRemainingSeconds;if(sus.v.dayRemainingSeconds!=null)b.dayRemainingSeconds=sus.v.dayRemainingSeconds;if(sus.v.blockElapsedSeconds!=null)b.blockElapsedSeconds=sus.v.blockElapsedSeconds;if(sus.v.resumeCapturedAt!=null)b.resumeCapturedAt=sus.v.resumeCapturedAt;b.susp=!!sus.v.susp;b.rs=sus.v.rs||null;}
        return b;
      });
      const lab=vis[K.attField(att,'label')];
      out.push({attemptId:h.raw!==undefined?h.raw:att,key:att,formUid:h.formUid,label:lab?String(lab.v):'',type:h.type||'first',createdAt:h.createdAt||'',session:{attemptId:h.raw!==undefined?h.raw:att,attemptLabel:lab?String(lab.v):'',attemptType:h.type||'first',blockSizeSetting:h.bs||'',sourceAttemptId:h.src||null,blocks}});
    }
    return out;
  }
  /* a V2-shaped progress record for one form from visible units (apply, Release B; used by the scenario tests) */
  function rebuildProgress(vis,uid){
    const list=rebuildAttempts(vis).filter(a=>a.formUid===uid);
    if(!list.length)return null;
    const act=vis[K.form(uid,'active')],activeAttemptId=act&&list.some(a=>a.attemptId===act.v)?String(act.v):list[0].attemptId;
    const exp={};
    for(const [k,u] of Object.entries(vis)){const p=C.parseKey(k);if(p.fam==='I'&&p.att==='~'+uid&&p.field==='he'&&nonEmpty(u.v))exp[uid+'::'+p.qid]=u.v;}
    return {fileType:'StepExamSimulatorV10ProgressBundle',formSlot:uid,bundle:{activeAttemptId,attempts:list.map(a=>({attemptId:a.attemptId,label:a.label,type:a.type,createdAt:a.createdAt,session:a.session})),explanationHighlightAnchorsByQuestionKey:exp}};
  }
  /* ---------- apply (Release B): visible units -> the app's own progress record, patched in place by QID ---------- */
  const cl=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
  const POS_OBJ=['struck','revealed','stemHighlightAnchors','explanationHighlightAnchors','rapidHighlights'];
  const sameList=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((x,i)=>x===b[i]);
  /* a block of a session built from its units alone (an attempt that only exists in the cloud, or a block whose questions differ) */
  function blockFromUnits(rb,hdr,bi,keep){
    const b={blockName:(hdr.bnames&&hdr.bnames[bi])||rb.blockName||'Block '+(bi+1),configuredIndex:hdr.cfg&&hdr.cfg[bi]!=null?hdr.cfg[bi]:bi,total:rb.total,current:rb.current||0,
      answers:rb.answers.slice(),flagged:rb.flagged.slice(),struck:cl(rb.struck),revealed:cl(rb.revealed),stemHtml:[],questionTime:rb.questionTime.slice(),firstAnswers:rb.firstAnswers.slice(),
      answerChangeLog:cl(rb.answerChangeLog),notes:rb.notes||'',blockStartedAt:Date.now(),blockCompleted:false,locked:false,result:null,explanationHtml:rb.questionQids.map(()=>''),
      stemHighlightAnchors:cl(rb.stemHighlightAnchors),explanationHighlightAnchors:cl(rb.explanationHighlightAnchors),rapidHighlights:cl(rb.rapidHighlights),highlightMigrationVersion:15,legacyRenderedHtmlIgnored:true,questionQids:rb.questionQids.slice()};
    if(rb.blockRemainingSeconds!=null)b.blockRemainingSeconds=rb.blockRemainingSeconds;if(rb.dayRemainingSeconds!=null)b.dayRemainingSeconds=rb.dayRemainingSeconds;
    if(rb.blockElapsedSeconds!=null)b.blockElapsedSeconds=rb.blockElapsedSeconds;if(rb.resumeCapturedAt!=null)b.resumeCapturedAt=rb.resumeCapturedAt;
    return Object.assign(b,keep||{});
  }
  function buildSession({att,h,rb,rec,formUid,blocks,qmv}){
    const keys=(h.order||[]).map(q=>formUid+'::'+q);let off=0;
    const pos=(h.bl||[blocks.length?h.order.length:0]).map(n=>{const r=keys.slice(off,off+n);off+=n;return r;});
    return {version:'7',sessionId:'sync3-'+att,bankHash:String(rec.bankHash||''),title:h.title||((rec.displayName||rec.id)+' — All Questions'),blockSizeSetting:h.bs||'all',secondsPerQuestion:h.spq||'90',mode:h.mode||'full',
      activeBlockIndexes:h.ab||blocks.map((_,i)=>i),showCorrect:!!h.sc,break:h.brk||{enabled:false,totalSeconds:3600,elapsedSeconds:0,active:false,startedAt:null,mode:'bank'},startedAt:h.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),
      completedAt:null,currentBlockPointer:Math.max(0,blocks.findIndex(b=>!b.blockCompleted)),blocks,results:blocks.map(b=>b.result||null),libraryFormId:rec.id,libraryFormName:rec.displayName||rec.id,formUid,attemptId:att,
      attemptType:h.rt||(h.type==='retest'?'retest_all':'initial'),attemptLabel:'',progressVersion:'19',saveVersion:'10.2',a193QuestionKeys:keys.slice(),libraryQuestionKeys:keys.slice(),sourceAttemptId:h.src||null,sourceFilter:'all',
      shuffleQuestions:!!h.shuffle,preserveLinkedSets:true,v215Shuffle:{enabled:false},positionQuestionKeys:pos,qidMappingVersion:qmv||undefined};
  }
  /* patch one local session so its positions carry the unit values (matching blocks by QID list); returns whether anything was rebuilt wholesale */
  function patchSession({local,rebuilt,h,rec,resolveRefs,buildResult,doneOf}){
    const lq=qidsOfSession(local,false,rec,resolveRefs).rows;let replaced=false;const pending=[];
    rebuilt.session.blocks.forEach((rb,bi)=>{
      const lb=(local.blocks||[])[bi],q=lq[bi],same=lb&&q&&sameList(q,rb.questionQids);
      if(!same){const nb=blockFromUnits(rb,h,bi,lb?{blockName:lb.blockName,configuredIndex:lb.configuredIndex}:null);if(!local.blocks)local.blocks=[];local.blocks[bi]=nb;replaced=true;if(rb.blockCompleted)pending.push(bi);return;}
      const idx=new Map(rb.questionQids.map((x,j)=>[x,j]));const n=countOf(lb);
      ['answers','firstAnswers','flagged','questionTime'].forEach(f=>{const arr=Array.isArray(lb[f])?lb[f]:(lb[f]=[]);for(let i=0;i<n;i++)arr[i]=rb[f][idx.get(q[i])];});
      for(const f of POS_OBJ){const o={};for(let i=0;i<n;i++){const v=rb[f][idx.get(q[i])];if(v!==undefined&&v!==null&&!(Array.isArray(v)&&!v.length))o[i]=cl(v);}lb[f]=o;}
      const log=[];for(const e of rb.answerChangeLog){const j=e.item-1;const i=q.indexOf(rb.questionQids[j]);if(i>=0)log.push({...cl(e),item:i+1});}lb.answerChangeLog=log;
      lb.notes=rb.notes||lb.notes||'';
      if(!rb.blockCompleted){if(rb.susp){local.suspended=true;local.resumeAvailable=true;if(rb.rs)local.resumeState=cl(rb.rs);local.currentBlockPointer=bi;}
        if(rb.current!=null&&rb.blockRemainingSeconds!=null){lb.current=rb.current;lb.blockRemainingSeconds=rb.blockRemainingSeconds;if(rb.dayRemainingSeconds!=null)lb.dayRemainingSeconds=rb.dayRemainingSeconds;if(rb.blockElapsedSeconds!=null)lb.blockElapsedSeconds=rb.blockElapsedSeconds;if(rb.resumeCapturedAt!=null)lb.resumeCapturedAt=rb.resumeCapturedAt;}}
      else if(!lb.blockCompleted||!lb.result)pending.push(bi);
    });
    for(const bi of pending){
      const lb=local.blocks[bi],d=doneOf(bi+1),res=buildResult?buildResult({session:local,block:lb,blockIndex:bi,done:d}):null;
      if(res){lb.blockCompleted=true;lb.locked=true;lb.result=res;}
      else{lb.blockCompleted=false;lb.locked=false;lb.result=null;}               // the form is not here to score it yet: stays open, retried next cycle
    }
    local.results=(local.blocks||[]).map(b=>b&&b.result?b.result:null);
    return {replaced,pending};
  }
  /* The whole apply for one form. progress = the app's current record (or null), units = ALL merged units, vis = their view.
     Attempts that exist only locally and are unknown to the units (not stamped yet) are never removed. */
  function applyUnitsToProgress({progress,units,vis,formUid,formId,rec,resolveRefs,buildResult,qmv,now}){
    const before=progress?JSON.stringify(progress):'';
    const wanted=rebuildAttempts(vis).filter(a=>a.formUid===formUid),known=new Set();
    for(const k of Object.keys(units)){const p=C.parseKey(k);if(p.fam==='A'&&p.field===''){const hv=units[k].v||{};known.add(hv.raw!==undefined?hv.raw:p.att);}}
    const out=progress&&typeof progress==='object'?cl(progress):{fileType:'StepExamSimulatorV10ProgressBundle',saveVersion:'10.2',formSlot:formId,bundle:{attempts:[]}};
    if(!out.bundle||!Array.isArray(out.bundle.attempts)){out.bundle={...(out.bundle||{}),attempts:[],activeAttemptId:null};}
    const b=out.bundle,report={created:[],patched:[],removed:[],pending:[]};
    const doneUnit=(att,n)=>(vis[K.block(att,n,'done')]||{}).v||{};
    for(const w of wanted){
      const h=vis[K.att(w.key)].v||{},la=b.attempts.find(a=>a.attemptId===w.attemptId||(a.session&&a.session.attemptId===w.attemptId));
      if(!la){
        const blocks=w.session.blocks.map((rb,bi)=>blockFromUnits(rb,h,bi));
        const session=buildSession({att:w.attemptId,h,rb:null,rec,formUid,blocks,qmv});session.attemptLabel=w.label||'';
        const att={attemptId:w.attemptId,label:w.label||'',type:h.rt||'initial',createdAt:h.createdAt||session.startedAt,completedAt:null,session};
        b.attempts.push(att);
        const r=patchSession({local:session,rebuilt:w,h,rec,resolveRefs:null,buildResult,doneOf:n=>doneUnit(w.key,n)});
        void r;report.created.push(w.attemptId);
        const allDone=session.blocks.length&&session.blocks.every(x=>x.blockCompleted);if(allDone){att.completedAt=new Date(now||Date.now()).toISOString();session.completedAt=att.completedAt;}
        continue;
      }
      const r=patchSession({local:la.session,rebuilt:w,h,rec,resolveRefs,buildResult,doneOf:n=>doneUnit(w.key,n)});
      if(w.label&&la.label!==w.label){la.label=w.label;la.session.attemptLabel=w.label;}
      report.patched.push(w.attemptId);if(r.pending.length)report.pending.push(w.attemptId);
    }
    const wantedIds=new Set(wanted.map(a=>a.attemptId));
    b.attempts=b.attempts.filter(a=>{const id=a.attemptId||(a.session&&a.session.attemptId);if(known.has(id)&&!wantedIds.has(id)){report.removed.push(id);return false;}return true;});
    const act=vis[K.form(formUid,'active')];
    if(act&&b.attempts.some(a=>a.attemptId===act.v))b.activeAttemptId=String(act.v);
    else if(!b.attempts.some(a=>a.attemptId===b.activeAttemptId))b.activeAttemptId=b.attempts[0]?b.attempts[0].attemptId:null;
    const g=isObj(b.explanationHighlightAnchorsByQuestionKey)?b.explanationHighlightAnchorsByQuestionKey:(b.explanationHighlightAnchorsByQuestionKey={});
    for(const [k,u] of Object.entries(units)){const p=C.parseKey(k);if(p.fam==='I'&&p.att==='~'+formUid&&p.field==='he'){const key=formUid+'::'+p.qid;if(nonEmpty(u.v))g[key]=cl(u.v);else delete g[key];}}
    if(!b.attempts.length)return {progress:null,changed:before!=='',report};
    const active=b.attempts.find(a=>a.attemptId===b.activeAttemptId)||b.attempts[0];
    out.formSlot=formId;out.session=active.session;
    const after=JSON.stringify(out);
    return {progress:out,changed:after!==before,report};
  }
  /* Qbank: tests are attempts of __QBANK__ (item ids are the full "formUid::qid" keys); `used` is derived from the tests, never synced */
  function applyUnitsToQbank({qbank,units,vis,buildResult,summarize,now}){
    const before=qbank?JSON.stringify(qbank):'';
    const out=qbank&&typeof qbank==='object'?cl(qbank):{fileType:'StepExamSimulatorV75QbankProgress',used:{},sessions:[],lastSelectedFormIds:null};
    if(!Array.isArray(out.sessions))out.sessions=[];
    const wanted=rebuildAttempts(vis).filter(a=>a.formUid===C.QBANK_UID),known=new Set(),rep={created:[],patched:[],removed:[],pending:[]};
    for(const k of Object.keys(units)){const p=C.parseKey(k);if(p.fam==='A'&&p.field===''&&String((units[k].v||{}).formUid)===C.QBANK_UID){const hv=units[k].v||{};known.add(hv.raw!==undefined?hv.raw:p.att);}}
    const idOf=e=>String(e&&(e.qbankTestId||(e.session&&e.session.qbankTestId))||'');
    const doneUnit=(att,n)=>(vis[K.block(att,n,'done')]||{}).v||{};
    const sum=summarize||((s,total)=>({total,scoreTotal:total,scoreCorrect:0,scorePct:null,answered:(s.blocks||[]).reduce((n,b)=>n+(b.answers||[]).filter(x=>x!=null).length,0)}));
    for(const w of wanted){
      const h=vis[K.att(w.key)].v||{},qb=h.qb||{};let entry=out.sessions.find(e=>idOf(e)===w.attemptId);
      if(!entry){
        const blocks=w.session.blocks.map((rb,bi)=>blockFromUnits(rb,h,bi));
        const session={version:'7',sessionId:'sync3-'+w.attemptId,title:qb.name||h.title||'Qbank Test',blockSizeSetting:h.bs||'all',secondsPerQuestion:h.spq||'90',mode:h.mode||'full',activeBlockIndexes:h.ab||blocks.map((_,i)=>i),showCorrect:!!h.sc,
          break:h.brk||{enabled:false,totalSeconds:3600,elapsedSeconds:0,active:false,startedAt:null,mode:'bank'},startedAt:h.createdAt||new Date(now||Date.now()).toISOString(),updatedAt:new Date(now||Date.now()).toISOString(),completedAt:null,currentBlockPointer:0,
          blocks,results:blocks.map(()=>null),qbankMode:true,qbankTestId:w.attemptId,qbankTestName:qb.name||'',qbankRunMode:qb.mode||'testing',qbankSourceMode:qb.sourceMode||'separate',qbankPoolType:qb.poolType||'unused',qbankAttemptSource:qb.attemptSource||'first',
          qbankFormIds:qb.formIds||[],qbankKeys:(h.order||[]).slice(),attemptId:w.attemptId,attemptLabel:w.label||'',attemptType:h.rt||'qbank',progressVersion:'19',saveVersion:'10.2',positionQuestionKeys:null};
        entry={qbankTestId:w.attemptId,name:qb.name||'Qbank Test',mode:qb.mode||'testing',status:'in_progress',createdAt:qb.createdAt||session.startedAt,updatedAt:session.updatedAt,completedAt:null,sourceMode:session.qbankSourceMode,poolType:session.qbankPoolType,
          attemptSource:session.qbankAttemptSource,formIds:session.qbankFormIds,total:session.qbankKeys.length,summary:null,session};
        out.sessions.push(entry);rep.created.push(w.attemptId);
      }else rep.patched.push(w.attemptId);
      const r=patchSession({local:entry.session,rebuilt:w,h,rec:null,resolveRefs:null,buildResult,doneOf:n=>doneUnit(w.key,n)});
      if(r.pending.length)rep.pending.push(w.attemptId);
      const allDone=entry.session.blocks.length&&entry.session.blocks.every(b=>b&&b.blockCompleted);
      if(allDone&&!entry.completedAt){entry.completedAt=new Date(now||Date.now()).toISOString();entry.session.completedAt=entry.completedAt;}
      entry.status=allDone?'completed':'in_progress';
      const sm=sum(entry.session,(entry.session.qbankKeys||[]).length);
      entry.summary={total:sm.total||sm.scoreTotal||0,correct:sm.scoreCorrect||0,percent:sm.scorePct,answered:sm.answered};
    }
    const wantedIds=new Set(wanted.map(a=>a.attemptId));
    out.sessions=out.sessions.filter(e=>{const id=idOf(e);if(known.has(id)&&!wantedIds.has(id)){rep.removed.push(id);return false;}return true;});
    out.sessions.sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
    const used={};out.sessions.forEach(t=>{(((t.session&&t.session.qbankKeys)||t.qbankKeys)||[]).forEach(k=>{if(k)used[k]=true;});});out.used=Object.assign({},out.used&&typeof out.used==='object'?out.used:{},used);
    const after=JSON.stringify(out);
    return {qbank:out,changed:after!==before,report:rep};
  }
  /* the block result the Score Report reads, from the stored answers and the form's own question objects (texts come from the form, not the cloud) */
  function buildResultFromQuestions({session,block,blockIndex,done,questions,nowIso}){
    const n=countOf(block);if(!questions||questions.length<n||questions.slice(0,n).some(x=>!x))return null;
    const log=Array.isArray(block.answerChangeLog)?block.answerChangeLog:[];
    const answers=Array.from({length:n},(_,i)=>{
      const q=questions[i],a=block.answers[i],f=block.firstAnswers?block.firstAnswers[i]:null,ch=log.filter(x=>Number(x.item)===i+1);
      return {block:blockIndex+1,item:i+1,chosen:a==null?null:a,firstChosen:f==null?null:f,firstChosenText:f!=null&&q.choices?q.choices[f]:'',changed:f!=null&&a!==f||ch.length>0,chosenText:a==null?'':(q.choices&&q.choices[a])||'',
        correct:q.correct,correctText:q.choices?q.choices[q.correct]:'',isCorrect:a===q.correct,flagged:!!(block.flagged&&block.flagged[i]),struck:(block.struck&&block.struck[i])||[],subject:q.subject||q.system||q.topic||'',topic:q.topic||q.subject||'',
        stem:q.stem||'',stemHtml:q._stemHtml||'',questionTimeSeconds:Number(block.questionTime&&block.questionTime[i])||0,answerChangeLog:ch,explanation:q.explanation||'',explanationPanel:q.explanationPanel||q.explanation_panel||null};
    });
    const correct=answers.filter(x=>x.isCorrect).length;
    return {sessionId:(done&&done.sid)||session.sessionId||'',blockIndex:blockIndex+1,blockName:block.blockName||'Block '+(blockIndex+1),total:n,correct,percent:n?Math.round(correct/n*100):0,
      elapsedSeconds:done&&done.el!=null?done.el:null,completedAt:(done&&done.at)||nowIso||new Date().toISOString(),answers};
  }
  /* V2's stats() for one form's progress (same counting rules), used to compare with the units' counts */
  function v2Counts(progress){
    const c={attempts:0,answered:0,marked:0,struck:0,notes:0,stemHighlights:0,expHighlights:0,completedBlocks:0};
    for(const x of attemptsOf(progress)){
      c.attempts++;
      for(const bp of x.session.blocks||[]){
        if(Array.isArray(bp.answers))c.answered+=bp.answers.filter(v=>v!==null&&v!==undefined).length;
        if(Array.isArray(bp.flagged))c.marked+=bp.flagged.filter(Boolean).length;
        if(isObj(bp.struck))Object.values(bp.struck).forEach(a=>{if(Array.isArray(a))c.struck+=a.length;});
        if(isObj(bp.stemHighlightAnchors))Object.values(bp.stemHighlightAnchors).forEach(a=>{if(Array.isArray(a))c.stemHighlights+=a.length;});
        if(isObj(bp.explanationHighlightAnchors))Object.values(bp.explanationHighlightAnchors).forEach(a=>{if(Array.isArray(a))c.expHighlights+=a.length;});
        if(String(bp.notes||'').trim())c.notes++;
        if(bp.blockCompleted===true)c.completedBlocks++;
      }
    }
    const g=progress&&progress.bundle&&progress.bundle.explanationHighlightAnchorsByQuestionKey;
    if(isObj(g))Object.values(g).forEach(a=>{if(Array.isArray(a))c.expHighlights+=a.length;});
    return c;
  }
  /* when the record was last changed (V2's deriveModified): the stamp of units a device brings along from before V3 */
  function modifiedAtOf(progress,suspended,rec){
    const v=[];try{v.push(progress&&progress.bundle&&progress.bundle.updatedAt,progress&&progress.exportedAt,progress&&progress.session&&progress.session.updatedAt,progress&&progress.session&&progress.session.completedAt,progress&&progress.updatedAt);
      ((progress&&progress.bundle&&progress.bundle.attempts)||[]).forEach(a=>v.push(a&&a.completedAt,a&&a.createdAt,a&&a.session&&a.session.updatedAt,a&&a.session&&a.session.completedAt));}catch(e){}
    try{v.push(suspended&&suspended.updatedAt,suspended&&suspended.resumeCapturedAt,rec&&rec.updatedAt);}catch(e){}
    const ms=Math.max(0,...v.map(x=>{const t=Date.parse(x||'');return Number.isFinite(t)?t:0;}));
    return ms||0;
  }
  const countsEqual=(a,b)=>Object.keys(a).every(k=>(a[k]||0)===(b[k]||0));
  const countsAtLeast=(a,b)=>Object.keys(a).every(k=>(a[k]||0)>=(b[k]||0));

  /* StepQidMigration.sessionQuestionRefs over a bank rebuilt from the catalog's question index (no form file needed) */
  function refsResolver(rec){
    const M=typeof window!=='undefined'&&window.StepQidMigration;if(!M||!M.sessionQuestionRefs)return null;
    const blocks=[];(rec.questionIndex||[]).forEach(r=>{const b=blocks[r.blockIndex]||(blocks[r.blockIndex]={questions:[]});b.questions[r.questionIndex]={qid:r.qid};});
    for(let i=0;i<blocks.length;i++)if(!blocks[i])blocks[i]={questions:[]};
    const bank={blocks};return session=>M.sessionQuestionRefs(session,bank);
  }
  /* browser glue (read-only): the forms' extracts through StepExamSyncBridge. `onlyFormId` reads one form (after a
     progress write), `onlyQbank` just the Qbank file; nothing is written. */
  async function readLocalUnits({dev,onlyFormId,onlyQbank}={}){
    const B=(typeof window!=='undefined'&&window.StepExamSyncBridge);if(!B)throw new Error('Simulator bridge is not available.');
    await B.ensureReady();
    const cat=await B.catalog(),forms={};
    const parse=t=>{try{return t==null?null:JSON.parse(t);}catch(e){return null;}};
    for(const rec of cat.forms||[]){
      if(onlyQbank||(onlyFormId&&String(rec.id)!==String(onlyFormId)))continue;
      const progress=parse(await B.readFormProgressText(rec.id)),suspended=parse(await B.readFormSuspendedText(rec.id));
      const formUid=String(rec.formUid||rec.id);
      forms[formUid]={formId:String(rec.id),formUid,rec,progress,suspended,modifiedAt:modifiedAtOf(progress,suspended,rec),extract:await extractForm({formUid,rec,progress,suspended,score:rec.threeDigitScore,dev,resolveRefs:refsResolver(rec)})};
    }
    if(!onlyFormId){
      const q=parse(await B.readQbankText());
      forms[C.QBANK_UID]={formId:'',formUid:C.QBANK_UID,rec:null,progress:q,suspended:null,modifiedAt:modifiedAtOf(q,null,null),extract:await extractForm({formUid:C.QBANK_UID,progress:q,qbank:true,dev})};
    }
    return {forms,catalog:cat};
  }

  /* synced settings that exist today: registry name -> [scope, localStorage key]; scope CLASS = L on large devices, P on phones */
  const SETTING_KEYS=[['accent','g','ThunderUSMLE.accent'],['nbmeSize','g','ThunderUSMLE.nbmeTextSize'],['nbmeStrike','g','ThunderUSMLE.nbmeStrikeHidden'],['nbmeTheme','g','ThunderUSMLE.nbmeTheme'],
    ['libSort','g','ThunderUSMLE.librarySort'],['libView','g','ThunderUSMLE.libraryView'],['libFilters','g','ThunderUSMLE.libraryStatus'],['examStyle','CLASS','ThunderUSMLE.examStyle'],
    ['explanationLayout','g','StepExamReviewExplanationLayout'],['keepNotesOpen','g','exam-simulator2:keepNotesOpen'],['navDelay','g','ThunderUSMLE.navDelay'],['navClock','g','ThunderUSMLE.navDelayMode'],['examDark','L','StepExamIpadExamDarkMode']];
  const settingScope=(scope,cls)=>scope==='CLASS'?(cls==='phone'?'P':'L'):scope;
  const settingApplies=(scope,cls)=>scope==='L'?cls!=='phone':scope==='P'?cls==='phone':true;      // large-only settings are not read on phones

  /* browser applier for the live cycle: patches the app's own progress through StepExamSyncBridge (inside __STEP_SYNC_APPLYING_REMOTE,
     which keeps V2 and the app from treating it as a local edit); a local recovery copy is made first */
  function createApplier({store,now=()=>Date.now()}){
    const B=()=>window.StepExamSyncBridge,R=()=>window.StepProgressSync;
    let catalog=null;
    const uidOf=r=>String(r.formUid||r.id);
    const recOf=uid=>catalog&&(catalog.forms||[]).find(r=>uidOf(r)===uid)||null;
    const parse=t=>{try{return t==null?null:JSON.parse(t);}catch(e){return null;}};
    return {
      async prepare(){catalog=await B().catalog();return catalog;},
      isApplyingRemote:()=>!!window.__STEP_SYNC_APPLYING_REMOTE||!!window.__STEP_FORM_UPDATE_COMMITTING,
      isOpenBlock(uid){
        const rt=B().runtime();if(!rt||!rt.examVisible)return false;
        if(uid===C.QBANK_UID)return !!rt.qbank;
        const rec=recOf(uid);return !!rec&&String(rt.activeFormId)===String(rec.id);
      },
      hasForm:uid=>!!recOf(uid),
      hasProgress:uid=>{const r=recOf(uid);return !!(r&&r.progressSummary);},
      async recover(uids){
        const st=R()&&R().storage;if(!st||!st.createLocalRecoveries)return;
        await st.createLocalRecoveries(uids,'Saved before Sync V3 applied cloud changes');
      },
      async applyForm({uid,units,vis}){
        const rec=recOf(uid);if(!rec)return {waiting:true};
        const prog=parse(await B().readFormProgressText(rec.id));
        // texts for rebuilt block results come from the form itself
        const need=new Set();
        for(const [k,u] of Object.entries(vis)){const p=C.parseKey(k);if(p.fam==='B'&&p.field==='done'&&u.v&&u.v.done){const h=(vis[K.att(p.att)]||{}).v;if(h&&String(h.formUid)===uid)(h.order||[]).forEach(q=>need.add(q));}}
        let qmap={};
        if(need.size&&B().questionsForQids){const list=[...need],qs=await B().questionsForQids(rec.id,list);list.forEach((q,i)=>{qmap[q]=qs[i];});}
        const buildResult=({session,block,blockIndex,done})=>buildResultFromQuestions({session,block,blockIndex,done,questions:(block.questionQids||[]).map(q=>qmap[q]||null),nowIso:new Date(now()).toISOString()});
        const QM=window.StepQidMigration;
        const r=applyUnitsToProgress({progress:prog,units,vis,formUid:uid,formId:rec.id,rec,resolveRefs:refsResolver(rec),buildResult,qmv:QM&&QM.QID_MAPPING_VERSION,now:now()});
        const flag=window.__STEP_SYNC_APPLYING_REMOTE;window.__STEP_SYNC_APPLYING_REMOTE=true;
        try{
          if(r.changed){if(r.progress===null)await B().deleteFormProgress(rec.id);else await B().writeFormProgressText(rec.id,JSON.stringify(r.progress));}
          const nm=units[K.libField(uid,'name')],tab=units[K.libField(uid,'tab')],sc=units[K.libField(uid,'score')];
          if((nm||tab)&&B().setFormMeta)await B().setFormMeta(rec.id,{displayName:nm&&nm.v,filter:tab&&tab.v});
          if(sc&&String(rec.threeDigitScore||'')!==String(sc.v)&&B().setThreeDigitScore)await B().setThreeDigitScore(rec.id,sc.v);
        }finally{window.__STEP_SYNC_APPLYING_REMOTE=flag;}
        catalog=null;await this.prepare();
        return {pending:r.report.pending.length>0,report:r.report,changed:r.changed};
      },
      async applyQbank({units,vis}){
        const text=await B().readQbankText(),qb=parse(text),keys=new Set();
        for(const [k,u] of Object.entries(vis)){const p=C.parseKey(k);if(p.fam==='B'&&p.field==='done'&&u.v&&u.v.done){const h=(vis[K.att(p.att)]||{}).v;if(h&&String(h.formUid)===C.QBANK_UID)(h.order||[]).forEach(q=>keys.add(q));}}
        const byForm={};keys.forEach(k=>{const i=k.indexOf('::');if(i>0)(byForm[k.slice(0,i)]=byForm[k.slice(0,i)]||[]).push(k);});
        const qmap={};
        for(const [uid,list] of Object.entries(byForm)){const rec=recOf(uid);if(!rec||!B().questionsForQids)continue;const qs=await B().questionsForQids(rec.id,list.map(k=>k.slice(uid.length+2)));list.forEach((k,i)=>{qmap[k]=qs[i];});}
        const buildResult=({session,block,blockIndex,done})=>buildResultFromQuestions({session,block,blockIndex,done,questions:(block.questionQids||[]).map(q=>qmap[q]||null),nowIso:new Date(now()).toISOString()});
        const r=applyUnitsToQbank({qbank:qb,units,vis,buildResult,summarize:B().summarizeSession?(s,t)=>B().summarizeSession(s,t)||{total:t,scoreTotal:t,scoreCorrect:0,scorePct:null,answered:0}:null,now:now()});
        if(r.changed){const flag=window.__STEP_SYNC_APPLYING_REMOTE;window.__STEP_SYNC_APPLYING_REMOTE=true;try{await B().writeQbankText(JSON.stringify(r.qbank));}finally{window.__STEP_SYNC_APPLYING_REMOTE=flag;}}
        return {pending:r.report.pending.length>0,report:r.report,changed:r.changed};
      },
      async applySettings(units,cls){
        let n=0;
        for(const [name,scope,key] of SETTING_KEYS){
          if(!settingApplies(scope,cls))continue;
          const u=units[K.setting(settingScope(scope,cls),name)];if(!u)continue;
          let cur=null;try{cur=localStorage.getItem(key);}catch(e){}
          if(String(u.v)!==String(cur)){try{localStorage.setItem(key,String(u.v));n++;}catch(e){}}
        }
        /* library tab settings live in catalog.json (librarySettings), not in localStorage */
        const lt=units[K.setting('g','libTabs')];
        if(lt&&lt.v&&typeof lt.v==='object'&&B().setLibrarySettings){const cat=await B().catalog();if(JSON.stringify(cat.librarySettings||{})!==JSON.stringify(lt.v)){const flag=window.__STEP_SYNC_APPLYING_REMOTE;window.__STEP_SYNC_APPLYING_REMOTE=true;try{if(await B().setLibrarySettings(lt.v))n++;}finally{window.__STEP_SYNC_APPLYING_REMOTE=flag;}}}
        if(n)try{window.dispatchEvent(new CustomEvent('stepsim:sync3-settings',{detail:{count:n}}));}catch(e){}
        return n;
      }
    };
  }

  /* form content for custom / imported forms (v3.c.*, js/sync3-sync.js pushContent / fetchContent): the form file text exactly as
     stored (its sha256 is the record's bankHash) plus every asset it references (`DATA/assets/...` / `assets/...` strings) */
  const ASSET_RE=[/(?:DATA\/)?assets\/[^"'\\\s)<>?#]+/g,/(?:DATA\/)?assets\/[^"'\\)<>?#]+/g];      // names with spaces too (a candidate without a file is skipped)
  const CONTENT_META=['id','defaultName','displayName','type','group','filter','subject','expectedQuestions','suggestedBlockSize','formUid','qidSchemaVersion','legacyBankHashes','optimized','imageAssets','sourceFiles'];
  function assetPathsOf(text){
    const out=new Set();
    for(const re of ASSET_RE)for(const m of String(text).matchAll(re)){const p=m[0].replace(/^DATA\//,'').trim(),parts=p.split('/');if(parts.length>=3&&!parts.includes('..')&&!parts.includes('.'))out.add(p);}
    return [...out];
  }
  function bytesToB64(bytes){let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode.apply(null,bytes.subarray(i,i+0x8000));return btoa(s);}
  function b64ToBytes(b64){const s=atob(b64),u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return u;}
  async function sha256Bytes(bytes){const d=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(d)).map(b=>b.toString(16).padStart(2,'0')).join('');}
  function createContentAdapter({drive,libraryManifestName}={}){
    const B=()=>window.StepExamSyncBridge,uidOf=r=>String(r.formUid||r.id);
    const recs=async()=>((await B().catalog()).forms||[]);
    return {
      async local(){return (await recs()).filter(r=>srcOf(r)!=='catalog'&&r.bankHash).map(r=>({uid:uidOf(r),ch:String(r.bankHash)}));},
      async read(uid){
        const rec=(await recs()).find(r=>uidOf(r)===uid);if(!rec)throw new Error('the form is not installed here');
        const text=await (await B().readLibraryFileBlob('forms/'+rec.id+'.json')).text(),assets=[];
        for(const path of assetPathsOf(text)){
          let blob=null;try{blob=await B().readLibraryFileBlob(path);}catch(e){}
          if(!blob)continue;                                                          // a reference without a file: the form shows it as it does here
          const bytes=new Uint8Array(await blob.arrayBuffer());assets.push({path,sha:await sha256Bytes(bytes),b64:bytesToB64(bytes)});
        }
        const meta={};CONTENT_META.forEach(k=>{if(rec[k]!==undefined)meta[k]=rec[k];});
        return {meta,text,assets};
      },
      async install({uid,meta,text,assets,bankHash}){
        if(!B().installSyncedForm)return {busy:true};
        const list=[];
        for(const a of assets||[]){const bytes=b64ToBytes(a.b64);if(await sha256Bytes(bytes)!==a.sha)throw new Error('an image of the form does not match its hash');list.push({path:a.path,blob:new Blob([bytes])});}
        const flag=window.__STEP_SYNC_APPLYING_REMOTE;window.__STEP_SYNC_APPLYING_REMOTE=true;
        try{return await B().installSyncedForm({id:String(meta.id||uid),formUid:uid,meta,text,assets:list,bankHash});}
        finally{window.__STEP_SYNC_APPLYING_REMOTE=flag;}
      },
      sha256:sha256Hex,
      /* the V2 full-library backup (if any): its files can be copied on the server instead of uploaded again */
      async v2Library(){
        if(!drive||!libraryManifestName)return [];
        const f=(await drive.listByName(libraryManifestName))[0];if(!f)return [];
        const m=await drive.downloadJson(f.id,'Library backup manifest');
        return Object.values(m&&m.entries||{}).filter(e=>e&&e.fileId&&e.contentHash).map(e=>({path:e.path,fileId:e.fileId,contentHash:e.contentHash,size:Number(e.size)||0}));
      }
    };
  }

  return {modifiedAtOf,SETTING_KEYS,settingScope,settingApplies,createApplier,createContentAdapter,assetPathsOf,srcOf,sha256Hex,attemptsOf,extractAttempt,extractForm,localizeTm,tmTotal,rebuildAttempts,rebuildProgress,applyUnitsToProgress,applyUnitsToQbank,buildResultFromQuestions,blockFromUnits,qidsOfSession,v2Counts,countsEqual,countsAtLeast,readLocalUnits,countOf};
});

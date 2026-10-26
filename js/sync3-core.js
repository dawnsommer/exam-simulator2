/* Sync V3 core (pure, no I/O): hybrid logical clock, unit keys, merge rules (SYNC_HYBRID_PLAN.md sections 1, 2, 7),
   visibility (tombstones / resets / uninstall), compaction, derived scores, settings registry.
   Works in node (require) and in the browser (window.StepSync3Core). Release A (shadow): nothing here touches Drive. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.StepSync3Core=api;
})(typeof window!=='undefined'?window:(typeof globalThis!=='undefined'?globalThis:this),function(){
  'use strict';
  const MAX_AHEAD_MS=24*3600*1000;      // a remote wall more than 24 h ahead of now is compared as now + 24 h
  const LOG_KEEP=20;
  const QBANK_UID='__QBANK__';

  /* ---------- stamps: "<wall base36, 9>.<counter base36, 4>.<dev>" (string order = clock order for equal dev) ---------- */
  const b36=(n,w)=>Math.max(0,Math.floor(n)).toString(36).padStart(w,'0');
  const cleanDev=d=>String(d==null?'':d).replace(/[^A-Za-z0-9_-]/g,'_')||'dev';
  function fmtStamp(wall,counter,dev){return `${b36(wall,9)}.${b36(counter,4)}.${cleanDev(dev)}`;}
  function parseStamp(s){
    const m=/^([0-9a-z]+)\.([0-9a-z]+)\.(.+)$/.exec(String(s||''));
    if(!m)return null;
    return {wall:parseInt(m[1],36),counter:parseInt(m[2],36),dev:m[3]};
  }
  const effWall=(st,now)=>Math.min(st.wall,now+MAX_AHEAD_MS);
  /* total order on stamps; `now` makes absurd future clocks compare as now + 24 h (equal walls then fall to counter / dev). */
  function cmpStamp(a,b,now){
    if(a===b)return 0;
    const x=parseStamp(a),y=parseStamp(b);
    if(!x||!y)return x?1:(y?-1:(String(a)<String(b)?-1:(String(a)>String(b)?1:0)));
    now=now==null?Date.now():now;
    const wx=effWall(x,now),wy=effWall(y,now);
    if(wx!==wy)return wx<wy?-1:1;
    if(x.counter!==y.counter)return x.counter<y.counter?-1:1;
    if(x.dev!==y.dev)return x.dev<y.dev?-1:1;
    if(x.wall!==y.wall)return x.wall<y.wall?-1:1;
    return 0;
  }
  const isSkewed=(stamp,now)=>{const s=parseStamp(stamp);return !!s&&s.wall>(now==null?Date.now():now)+MAX_AHEAD_MS;};
  /* clock = {wall, counter}; returns the new stamp and the advanced clock (pure). */
  function hlcNow(clock,dev,now){
    now=now==null?Date.now():now;
    const last=clock||{wall:0,counter:0};
    let wall=Math.max(now,last.wall),counter=wall===last.wall?last.counter+1:0;
    return {stamp:fmtStamp(wall,counter,dev),clock:{wall,counter}};
  }
  /* last = max(last, every remote stamp); a stamp far in the future only advances the clock to now + 24 h. */
  function hlcSeen(clock,stamps,now){
    now=now==null?Date.now():now;
    let c={wall:(clock&&clock.wall)||0,counter:(clock&&clock.counter)||0};
    for(const s of stamps||[]){
      const p=parseStamp(s);if(!p)continue;
      const w=effWall(p,now);
      if(w>c.wall||(w===c.wall&&p.counter>c.counter))c={wall:w,counter:w===p.wall?p.counter:0};
    }
    return c;
  }

  /* ---------- keys ---------- */
  const esc=s=>String(s==null?'':s).replace(/[%.]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase().padStart(2,'0'));
  const unesc=s=>String(s).replace(/%([0-9A-F]{2})/g,(_,h)=>String.fromCharCode(parseInt(h,16)));
  const K={
    lib:uid=>`L.${esc(uid)}`,
    libField:(uid,f)=>`L.${esc(uid)}.${f}`,
    tab:(id,f)=>`T.${esc(id)}.${f}`,
    form:(uid,f)=>`F.${esc(uid)}.${f}`,
    att:att=>`A.${esc(att)}`,
    attField:(att,f)=>`A.${esc(att)}.${f}`,
    item:(att,qid,f)=>`I.${esc(att)}.${esc(qid)}.${f}`,
    block:(att,n,f)=>`B.${esc(att)}.${n}.${f}`,
    setting:(scope,name)=>`S.${scope}.${esc(name)}`
  };
  /* fam: L T F A I B S; rule decided from the key shape (SYNC_HYBRID_PLAN.md section 2) */
  function parseKey(k){
    const p=String(k).split('.'),fam=p[0];
    if(fam==='L'&&p.length>=2)return {fam,uid:unesc(p[1]),field:p[2]||''};
    if(fam==='T'&&p.length>=3)return {fam,tab:unesc(p[1]),field:p[2]};
    if(fam==='F'&&p.length>=3)return {fam,uid:unesc(p[1]),field:p[2]};
    if(fam==='A'&&p.length>=2)return {fam,att:unesc(p[1]),field:p[2]||''};
    if(fam==='I'&&p.length>=4)return {fam,att:unesc(p[1]),qid:unesc(p[2]),field:p[3]};
    if(fam==='B'&&p.length>=4)return {fam,att:unesc(p[1]),n:Number(p[2]),field:p[3]};
    if(fam==='S'&&p.length>=3)return {fam,scope:p[1],name:unesc(p.slice(2).join('.'))};
    return {fam:'?'};
  }
  const R={NEWEST:'newest',EARLIEST:'earliest',SEQ:'seq',LOG:'log',TM:'tm',TRUE:'true',DONE:'done'};
  function ruleFor(k){
    const p=parseKey(k);
    switch(p.fam){
      case 'L':return p.field==='rev'?R.SEQ:R.NEWEST;
      case 'A':return p.field===''?R.EARLIEST:R.NEWEST;
      case 'I':return p.field==='first'?R.EARLIEST:p.field==='log'?R.LOG:p.field==='tm'?R.TM:p.field==='rv'?R.TRUE:R.NEWEST;
      case 'B':return p.field==='done'?R.DONE:R.NEWEST;
      default:return R.NEWEST;          // T, F, S and unknown keys are kept and passed through (newest)
    }
  }

  /* ---------- canonical JSON (tie-breaks, equality) ---------- */
  function canon(v){
    if(v===undefined)return 'null';
    if(v===null||typeof v!=='object')return JSON.stringify(v);
    if(Array.isArray(v))return '['+v.map(canon).join(',')+']';
    return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canon(v[k])).join(',')+'}';
  }
  const clone=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
  const mk=(k,v,t)=>({k,v:clone(v),t});

  /* ---------- the join of two units under one rule: commutative, associative, idempotent ---------- */
  function newer(a,b,now){const c=cmpStamp(a.t,b.t,now);return c!==0?c>0:canon(a.v)>=canon(b.v);}
  function joinUnits(rule,a,b,now){
    if(!a)return b;if(!b)return a;
    switch(rule){
      case R.EARLIEST:{const c=cmpStamp(a.t,b.t,now);return c!==0?(c<0?a:b):(canon(a.v)<=canon(b.v)?a:b);}
      case R.SEQ:{
        const sa=Number(a.v&&a.v.seq)||0,sb=Number(b.v&&b.v.seq)||0;
        if(sa!==sb)return sa>sb?a:b;
        return newer(a,b,now)?a:b;
      }
      case R.LOG:{
        const by=new Map();
        for(const e of [].concat(a.v||[],b.v||[])){
          if(!e||e.t==null)continue;
          const prev=by.get(e.t);
          if(!prev||canon(e)>canon(prev))by.set(e.t,e);
        }
        const all=[...by.values()].sort((x,y)=>cmpStamp(x.t,y.t,now)||(canon(x)<canon(y)?-1:1));
        const t=cmpStamp(a.t,b.t,now)>=0?a.t:b.t;
        return {k:a.k,v:all.slice(-LOG_KEEP),t};
      }
      case R.TM:{
        const out={},va=a.v||{},vb=b.v||{};
        for(const d of new Set([...Object.keys(va),...Object.keys(vb)]))out[d]=Math.max(Number(va[d])||0,Number(vb[d])||0);
        const t=cmpStamp(a.t,b.t,now)>=0?a.t:b.t;
        return {k:a.k,v:out,t};
      }
      case R.TRUE:case R.DONE:{
        const ta=a.v===true||(a.v&&a.v.done===true),tb=b.v===true||(b.v&&b.v.done===true);
        if(ta&&tb){const c=cmpStamp(a.t,b.t,now);return c!==0?(c<0?a:b):(canon(a.v)<=canon(b.v)?a:b);}
        if(ta)return a;if(tb)return b;
        return newer(a,b,now)?a:b;
      }
      default:return newer(a,b,now)?a:b;
    }
  }
  const asMap=x=>{
    if(!x)return {};
    if(Array.isArray(x)){const m={};for(const u of x){if(u&&u.k!=null)m[u.k]=m[u.k]?joinUnits(ruleFor(u.k),m[u.k],u,Date.now()):u;}return m;}
    return x;
  };
  /* merge(known, remotes) -> {units, changes}. `known` is this device's last unit map (k -> {k?,v,t}); remotes are
     replicas (arrays of {k,v,t} or maps). Absence never deletes. changes lists keys whose merged unit differs from known. */
  function merge(known,remotes,opts){
    const now=opts&&opts.now!=null?opts.now:Date.now();
    const out={};
    const add=u=>{const k=u.k;out[k]=out[k]?joinUnits(ruleFor(k),out[k],u,now):u;};
    const base=asMap(known);for(const k of Object.keys(base)){const u=base[k];if(u)add({k,v:u.v,t:u.t});}
    const sources=[];
    (remotes||[]).forEach((r,i)=>{
      const label=r&&r.dev!==undefined&&r.units?r.dev:('r'+i),list=r&&r.units?r.units:r;
      const arr=Array.isArray(list)?list:Object.keys(list||{}).map(k=>({k,v:list[k].v,t:list[k].t}));
      for(const u of arr){if(u&&u.k!=null&&u.t!=null){add({k:u.k,v:u.v,t:u.t});sources.push(u.t);}}
      void label;
    });
    const changes=[],skewed=[];
    for(const k of Object.keys(out)){
      const u=out[k],b=base[k];
      if(!b)changes.push({k,type:'add',t:u.t,dev:(parseStamp(u.t)||{}).dev||''});
      else if(b.t!==u.t||canon(b.v)!==canon(u.v))changes.push({k,type:'update',t:u.t,dev:(parseStamp(u.t)||{}).dev||''});
      if(isSkewed(u.t,now))skewed.push(u.t);
    }
    changes.sort((x,y)=>x.k<y.k?-1:x.k>y.k?1:0);
    return {units:out,changes,skewed:[...new Set(skewed)].sort()};
  }
  /* order-independent equality of two unit maps */
  const sameUnits=(a,b)=>canon(Object.keys(a).sort().map(k=>[k,a[k].t,a[k].v]))===canon(Object.keys(b).sort().map(k=>[k,b[k].t,b[k].v]));

  /* ---------- visibility: tombstones, resets, uninstall, answers after a completed block ---------- */
  function blockOfQid(header,qid){
    const order=header&&Array.isArray(header.order)?header.order:null;if(!order)return null;
    const i=order.indexOf(qid);if(i<0)return null;
    const bl=Array.isArray(header.bl)&&header.bl.length?header.bl:null;
    if(bl){let acc=0;for(let n=0;n<bl.length;n++){acc+=bl[n];if(i<acc)return n+1;}return bl.length;}
    const bs=Math.max(1,Number(header.bs)||order.length||1);return Math.floor(i/bs)+1;
  }
  /* A delete / reset / uninstall hides what was stamped before it (cutoff = the newest one that applies); units stamped
     later on another device survive, and bring their attempt header back with them (the item reappears). */
  function view(units,opts){
    const now=opts&&opts.now!=null?opts.now:Date.now();
    const attForm={},headers={},cut={},done={};
    const raise=(key,t)=>{if(!cut[key]||cmpStamp(t,cut[key],now)>0)cut[key]=t;};
    for(const [k,u] of Object.entries(units)){
      const p=parseKey(k);
      if(p.fam==='A'&&p.field===''){headers[p.att]=u.v||{};attForm[p.att]=String(u.v&&u.v.formUid||'');}
      else if(p.fam==='F'&&p.field==='reset')raise('f:'+p.uid,(u.v&&u.v.at)||u.t);
      else if(p.fam==='L'&&p.field===''&&u.v&&u.v.on==='deleted')raise('f:'+p.uid,u.t);
      else if(p.fam==='A'&&p.field==='del'&&u.v&&u.v.del===true)raise('a:'+p.att,u.t);
      else if(p.fam==='B'&&p.field==='done'&&(u.v===true||(u.v&&u.v.done===true)))done[p.att+'|'+p.n]={t:u.t,k,snap:u.v&&u.v.ans&&typeof u.v.ans==='object'?u.v.ans:null};
    }
    const hide=new Set(),survivors=new Set();
    for(const [k,u] of Object.entries(units)){
      const p=parseKey(k);
      if(p.fam!=='A'&&p.fam!=='I'&&p.fam!=='B'&&!(p.fam==='F'&&p.field==='active'))continue;
      const uid=p.fam==='F'?p.uid:(attForm[p.att]||(String(p.att).charAt(0)==='~'?String(p.att).slice(1):null));
      let c=null;
      for(const cand of [uid!==null?cut['f:'+uid]:null,p.att!==undefined?cut['a:'+p.att]:null]){if(cand&&(!c||cmpStamp(cand,c,now)>0))c=cand;}
      if(p.fam==='A'&&p.field==='del')continue;
      if(c&&cmpStamp(u.t,c,now)<0)hide.add(k);
      else if(p.fam==='I'&&p.field==='ans'){
        const n=blockOfQid(headers[p.att],p.qid),dt=n==null?null:done[p.att+'|'+n];
        if(dt&&!dt.snap&&cmpStamp(u.t,dt.t,now)>0)hide.add(k);     // legacy completion without a snapshot: later answers are ignored
      }
      if(!hide.has(k)&&(p.fam==='I'||p.fam==='B'))survivors.add(p.att);
    }
    for(const k of [...hide]){const p=parseKey(k);if(p.fam==='A'&&p.field===''&&survivors.has(p.att))hide.delete(k);}
    const vis={},hidden=[];
    for(const [k,u] of Object.entries(units)){if(hide.has(k))hidden.push(k);else vis[k]=u;}
    /* a completed block shows the answer set of its earliest completer (the snapshot inside its done unit), whatever ans units say */
    for(const [key,d] of Object.entries(done)){
      if(!d.snap||hide.has(d.k))continue;
      const [att,n]=[key.slice(0,key.lastIndexOf('|')),Number(key.slice(key.lastIndexOf('|')+1))],h=headers[att];if(!h)continue;
      for(const qid of (h.order||[])){
        if(blockOfQid(h,qid)!==n)continue;
        const ak=K.item(att,qid,'ans'),val=d.snap[qid];
        if(val==null||val===undefined)delete vis[ak];else vis[ak]={k:ak,v:val,t:d.t};
      }
    }
    return {units:vis,hidden:hidden.sort()};
  }
  /* own replica only: drop hidden I / B units of a deleted attempt or reset form; tombstones stay forever */
  function compact(replica,merged,opts){
    const hidden=new Set(view(merged,opts).hidden),arr=Array.isArray(replica)?replica:Object.keys(replica).map(k=>({k,v:replica[k].v,t:replica[k].t}));
    const kept=[],dropped=[];
    for(const u of arr){
      const p=parseKey(u.k);
      if(hidden.has(u.k)&&(p.fam==='I'||p.fam==='B'||(p.fam==='A'&&p.field===''))){dropped.push(u.k);continue;}
      kept.push(u);
    }
    return {units:kept,dropped};
  }

  /* ---------- derived, never synced: scores and counts ---------- */
  function attemptsOf(vis){return Object.keys(vis).map(parseKey).filter(p=>p.fam==='A'&&p.field==='').map(p=>p.att).sort();}
  function deriveScores(vis,att,correctFn){
    const header=(vis[K.att(att)]||{}).v||{},order=Array.isArray(header.order)?header.order:[];
    let answered=0,correct=0;
    for(const qid of order){
      const a=vis[K.item(att,qid,'ans')];
      if(!a||a.v==null)continue;answered++;
      if(typeof correctFn==='function'&&canon(correctFn(header.formUid,qid))===canon(a.v))correct++;
    }
    const total=order.length;
    return {total,answered,correct,percent:total&&typeof correctFn==='function'?Math.round(correct/total*100):null};
  }
  /* the counts compared in migration step 6 (same names as the V2 stats()) */
  function countUnits(vis){
    const c={attempts:0,answered:0,marked:0,struck:0,notes:0,stemHighlights:0,expHighlights:0,completedBlocks:0};
    for(const [k,u] of Object.entries(vis)){
      const p=parseKey(k),v=u.v;
      if(p.fam==='A'&&p.field==='')c.attempts++;
      else if(p.fam==='I'){
        if(p.field==='ans'&&v!=null)c.answered++;
        else if(p.field==='fl'&&v===true)c.marked++;
        else if(p.field==='st'&&Array.isArray(v)&&v.length)c.struck+=v.length;
        else if(p.field==='hs'&&Array.isArray(v))c.stemHighlights+=v.length;
        else if(p.field==='he'&&Array.isArray(v))c.expHighlights+=v.length;
      }else if(p.fam==='B'){
        if(p.field==='done'&&(v===true||(v&&v.done===true)))c.completedBlocks++;
        else if(p.field==='nt'&&String(v||'').trim())c.notes++;
      }
    }
    return c;
  }

  /* ---------- settings registry (section 7) ---------- */
  const SETTINGS=[
    ['accent','g','crimson'],['nbmeSize','g','100'],['nbmeStrike','g',true],['nbmeTheme','g','default'],['explanationLayout','g','below'],
    ['keepNotesOpen','g',false],['navDelay','g',false],['navClock','g','real'],['libSort','g','name'],['libView','g','grid'],['libFilters','g','all'],
    ['libTabs','g',{}],                                   // catalog.librarySettings: 3-digit score chips, tab meters, overview tabs (retest carry choices are not stored by the app)
    ['examStyle','L','nbme'],['examDark','L',false],
    ['examStyle','P','modern'],['phoneLayout','P',{}],
    ['driveAuth','d',null],['deviceId','d',null],['fullScreen','d',false],['zoom','d',100],['debug','d',false],['qidMigration','d',null],['transferUi','d',null]
  ].map(([name,scope,def])=>({name,scope,default:def}));
  const SYNCED_SCOPES=['g','L','P'];
  const deviceClass=(w,h)=>Math.min(Number(w)||0,Number(h)||0)<768?'phone':'large';
  /* the registry rows a device of this class reads and writes (the d scope never syncs) */
  function settingsFor(cls){const own=cls==='phone'?'P':'L';return SETTINGS.filter(s=>s.scope==='g'||s.scope===own);}
  const settingScope=(name,cls)=>{const row=settingsFor(cls).find(s=>s.name===name);return row?row.scope:null;};
  const isSyncedSetting=(name,scope)=>SYNCED_SCOPES.includes(scope)&&SETTINGS.some(s=>s.name===name&&s.scope===scope);

  /* ---------- open-block lease (section 6): {dev: {att: {block, since, heartbeat}}} ---------- */
  const LEASE_FRESH_MS=10*60*1000,LEASE_BEAT_MS=60*1000;
  const ms=iso=>{const t=typeof iso==='number'?iso:Date.parse(iso);return Number.isFinite(t)?t:0;};
  /* opening a block that another device holds (heartbeat < 10 min): who and how long ago, else null */
  function leaseConflict(leases,me,att,block,now){
    now=now==null?Date.now():now;
    for(const dev of Object.keys(leases||{}).sort()){
      if(dev===me)continue;
      const l=(leases[dev]||{})[att];
      if(l&&Number(l.block)===Number(block)&&now-ms(l.heartbeat)<LEASE_FRESH_MS)return {dev,since:l.since,heartbeat:l.heartbeat,minutesAgo:Math.max(0,Math.round((now-ms(l.heartbeat))/60000))};
    }
    return null;
  }
  /* Continue here = take over: my lease is newer than theirs. The holder sees it on its next cycle and suspends. */
  const leaseTake=(mine,att,block,now)=>({...(mine||{}),[att]:{block:Number(block),since:new Date(now==null?Date.now():now).toISOString(),heartbeat:new Date(now==null?Date.now():now).toISOString()}});
  const leaseBeat=(mine,att,now)=>mine&&mine[att]?{...mine,[att]:{...mine[att],heartbeat:new Date(now==null?Date.now():now).toISOString()}}:mine;
  const leaseDrop=(mine,att)=>{const o={...(mine||{})};delete o[att];return o;};
  /* true when another device took over the block I hold (its lease for the same block is newer than mine) */
  function leaseLost(leases,me,att,block){
    const mine=((leases||{})[me]||{})[att];if(!mine)return null;
    for(const dev of Object.keys(leases).sort()){
      if(dev===me)continue;const l=(leases[dev]||{})[att];
      if(l&&Number(l.block)===Number(block)&&ms(l.since)>ms(mine.since))return {dev};
    }
    return null;
  }

  return {MAX_AHEAD_MS,LOG_KEEP,QBANK_UID,fmtStamp,parseStamp,cmpStamp,isSkewed,hlcNow,hlcSeen,esc,unesc,K,parseKey,RULES:R,ruleFor,
    canon,clone,mk,joinUnits,merge,sameUnits,view,compact,blockOfQid,attemptsOf,deriveScores,countUnits,SETTINGS,SYNCED_SCOPES,
    deviceClass,settingsFor,settingScope,isSyncedSetting,LEASE_FRESH_MS,LEASE_BEAT_MS,leaseConflict,leaseTake,leaseBeat,leaseDrop,leaseLost};
});

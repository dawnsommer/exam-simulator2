/* Native IndexedDB update transaction. The simulator supplies its private storage boundary. */
(function(root){
  'use strict';
  root.createStepFormUpdateStore=function(H){
    const C=root.StepFormUpdateCore,OUTBOX='progress/backups/FORM_UPDATE_RECEIPTS.json',EPOCH='__stepsim_internal__/epoch';
    const textBlob=v=>new Blob([typeof v==='string'?v:JSON.stringify(v)],{type:'application/json'});
    const record=(path,blob)=>({path,blob,type:blob.type||'',updatedAt:Date.now()});
    let busy=false;
    async function binaryHash(blob){const data=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());return Array.from(new Uint8Array(data)).map(x=>x.toString(16).padStart(2,'0')).join('');}
    function transaction(db,mode,fn){return new Promise((resolve,reject)=>{const tx=db.transaction('files',mode),s=tx.objectStore('files');let result;try{result=fn(s,tx);}catch(e){tx.abort();reject(e);return;}tx.oncomplete=()=>{try{resolve(typeof result==='function'?result():result);}catch(e){reject(e);}};tx.onabort=()=>reject(tx.error||new Error('Library transaction cancelled; nothing was installed.'));tx.onerror=()=>{};});}
    async function snapshot(){const db=await H.open();try{return await transaction(db,'readonly',s=>{const q=s.getAll();return ()=>new Map(q.result.map(r=>[r.path,r]));});}finally{db.close();}}
    const json=async(r,fallback=null)=>r?JSON.parse(await r.blob.text()):fallback;
    async function assertIdle(){
      if(!H.browser())throw new Error('Form updates use the iPad Browser Library.');
      if(H.examVisible())throw new Error('Leave the active exam before installing forms.');
      const R=root.StepProgressSync,st=R?.sync?.getState?.();
      if(root.StepBulkImportStore?.isBusy?.()||root.__STEP_NATIVE_IMPORT_BUSY||R?.sync?.isBusy?.()||R?.libraryBackup?.isBusy?.()||R?.libraryBackup?.getState?.()||root.__STEP_SYNC_APPLYING_REMOTE||/Checking|Backing up|Restoring|Connecting/.test(st?.status||''))throw new Error('Wait for the Google transfer to finish before installing forms.');
    }
    async function importForms(plan,publication,batchId,device,onProgress=()=>{}){
      if(busy)throw new Error('A form update is already running.');
      await H.ready();await assertIdle();busy=true;root.__STEP_FORM_UPDATE_COMMITTING=true;
      try{
        await H.flush();await assertIdle();root.__STEP_FORM_UPDATE_WRITING=true;
        const before=await snapshot(),expected=before.get(EPOCH)?.value||0;
        const cat=await json(before.get('catalog.json'),{forms:[]});cat.forms=cat.forms||[];
        const writes=[],applied=[],skipped=[],blocked=[],progressChanged=[];
        const outbox=await json(before.get(OUTBOX),[]);
        let qp=null;const qpRecord=before.get('progress/QBANK_MODE_progress.json');
        if(qpRecord)qp=await json(qpRecord);
        for(const f of plan.forms){
          const info=publication.forms.find(x=>x.id===f.id);if(!info)throw new Error('Unexpected form '+f.id+'.');
          const prev=cat.forms.find(r=>r.id.toLowerCase()===f.id.toLowerCase());
          if(prev&&(info.onExisting==='skip'||prev.formUpdateRevision===info.revision)){skipped.push(f.id);continue;}
          if(prev&&prev.id!==f.id){blocked.push({id:f.id,reason:'Folder capitalization differs from installed ID '+prev.id+'.'});continue;}
          const oldRecord=before.get('forms/'+f.id+'.json');
          if(oldRecord&&!prev){blocked.push({id:f.id,reason:'An unindexed form exists. Scan the library first.'});continue;}
          const progressPaths=['progress/'+f.id+'_progress_save.json','progress/'+f.id+'_suspended_test.json'];
          const qpText=qp?JSON.stringify(qp):'',uid=prev?.formUid||f.id;
          const qbankRefs=qpText.includes(JSON.stringify(f.id+':').slice(0,-1))||qpText.includes(JSON.stringify(uid+'::').slice(0,-1))||(qp?.sessions||[]).some(s=>(s.formIds||s.session?.qbankFormIds||[]).includes(f.id));
          const hasProgress=progressPaths.some(p=>before.has(p))||qbankRefs;
          let bank=f.bank;
          try{
            if(prev){
              if(!oldRecord)throw new Error('Installed form source is missing.');
              if(prev.bankHash&&await H.hash(await oldRecord.blob.text())!==prev.bankHash)throw new Error('Installed form checksum differs from its catalog. Restore a matching library before updating.');
              const oldBank=await json(oldRecord);bank=C.compatibleBank(oldBank,bank,H.normalize,hasProgress);
              if(hasProgress&&(Number(oldBank.qidSchemaVersion)!==1||Number(bank.qidSchemaVersion)!==1)){
                for(const asset of f.assets){const old=before.get(asset.path);if(!old||await binaryHash(old.blob)!==await binaryHash(asset.blob))throw new Error('Saved legacy progress requires unchanged image assets.');}
              }
            }
            const normalized=H.normalize(bank);
            if(Number(bank.qidSchemaVersion)===1&&!root.StepQidMigration.validateForm(normalized,f.id).ok)throw new Error('Invalid permanent question identities.');
            if(bank.formUid&&cat.forms.some(r=>r.id!==f.id&&r.formUid===bank.formUid))throw new Error('Permanent form identity is already used by another form.');
          }catch(e){blocked.push({id:f.id,reason:e.message});continue;}
          const rawText=JSON.stringify(bank,null,2),hash=await H.hash(rawText),normalized=H.normalize(bank);
          const tab=H.resolveTab(info.tab,cat),meta={...H.meta(f.id),defaultName:f.name,filter:tab,group:tab};
          const rec=H.record(f.id,meta,normalized,rawText,hash,[f.source],prev||{});
          Object.assign(rec,{filter:tab,group:tab,formUpdateRevision:info.revision,imageAssets:f.assets.length,optimized:!!f.assets.length});
          // Custom instructions can move a fixed slot into another tab as well.
          if(tab!=='N-Forms'&&rec.type==='N')rec.type='Custom';
          if(tab==='N-Forms')rec.type='N';
          cat.forms=cat.forms.filter(r=>r.id!==f.id).concat(rec);
          writes.push({path:'forms/'+f.id+'.json',blob:textBlob(rawText)},...f.assets);
          if(prev&&hasProgress&&prev.bankHash!==hash){
            for(const p of progressPaths)if(before.has(p)){writes.push({path:p,blob:textBlob(C.rewriteHash(await json(before.get(p)),prev.bankHash,hash))});progressChanged.push(f.id);}
          }
          const receipt={id:batchId+':'+f.id,batchId,formId:f.id,title:f.name,revision:info.revision,installationId:device.id,deviceLabel:device.label,installedAt:new Date().toISOString()};
          outbox.push(receipt);applied.push(receipt);
        }
        if(!applied.length)return {applied,skipped,blocked};
        cat.updatedAt=new Date().toISOString();
        writes.push({path:'catalog.json',blob:textBlob(cat)},{path:OUTBOX,blob:textBlob(outbox)});
        const recovery=new root.JSZip();
        for(const item of writes){const old=before.get(item.path);if(old)recovery.file(item.path,old.blob);}
        recovery.file('recovery.json',JSON.stringify({fileType:'StepExamFormUpdateRecovery',createdAt:cat.updatedAt,newPaths:writes.filter(x=>!before.has(x.path)).map(x=>x.path),forms:applied.map(x=>x.formId)}));
        const recoveryBlob=await recovery.generateAsync({type:'blob'});
        const backupPath='progress/backups/PRE_FORM_UPDATE_'+batchId+'.zip';
        onProgress('Saving forms',98);
        const db=await H.open();let conflict=false,writeError=null;
        try{await transaction(db,'readwrite',(s,tx)=>{
          const q=s.get(EPOCH);
          q.onsuccess=()=>{
            try{
            if((q.result?.value||0)!==expected){conflict=true;tx.abort();return;}
            s.put(record(backupPath,recoveryBlob));
            for(const item of writes)s.put(record(item.path,item.blob));
            s.put({path:EPOCH,value:expected+1,updatedAt:Date.now()});
            }catch(e){writeError=e;tx.abort();}
          };

        });}catch(e){if(conflict)throw new Error('The library changed in another tab. Check updates again.');if(writeError)throw new Error('Could not save forms: '+writeError.message+' Nothing was installed.');throw e;}finally{db.close();}
        H.adopt(cat,applied.map(x=>x.formId));root.__STEP_FORM_UPDATE_WRITING=false;
        // Presentation errors cannot turn a durable commit into an apparent failed install.
        try{await H.refresh();}catch(e){console.warn('Forms installed; refresh the library to redraw.',e);}
        for(const id of new Set(progressChanged))try{root.dispatchEvent(new CustomEvent('stepsim:progress-write',{detail:{formId:id,bankHash:cat.forms.find(r=>r.id===id)?.bankHash}}));}catch(_){}
        return {applied,skipped,blocked};
      }finally{busy=false;root.__STEP_FORM_UPDATE_WRITING=false;root.__STEP_FORM_UPDATE_COMMITTING=false;}
    }
    async function receipts(){await H.ready();return json((await snapshot()).get(OUTBOX),[]);}
    async function acknowledge(ids){
      // A Web Lock serializes receipt drains; epoch verification prevents lost writes across tabs.
      for(let tries=0;tries<3;tries++){
        const before=await snapshot(),events=await json(before.get(OUTBOX),[]),epoch=before.get(EPOCH)?.value||0,blob=textBlob(events.filter(e=>!ids.includes(e.id)));
        const db2=await H.open();let retry=false;try{await transaction(db2,'readwrite',(s,tx)=>{const q=s.get(EPOCH);q.onsuccess=()=>{if((q.result?.value||0)!==epoch){retry=true;tx.abort();return;}s.put(record(OUTBOX,blob));s.put({path:EPOCH,value:epoch+1,updatedAt:Date.now()});};});return;}catch(e){if(!retry)throw e;}finally{db2.close();}
      }
      throw new Error('Receipt queue changed; it will be retried.');
    }
    return {importForms,receipts,acknowledge,isBusy:()=>busy,async installed(){await H.ready();return (await json((await snapshot()).get('catalog.json'),{forms:[]})).forms||[];}};
  };
})(window);

(function(){
  'use strict';
  const R=window.StepProgressSync;
  const CLASS=Object.freeze({
    ALIGNED:'ALIGNED',
    LOCAL_AHEAD_SAFE:'LOCAL_AHEAD_SAFE',
    LOCAL_ONLY_SAFE:'LOCAL_ONLY_SAFE',
    CLOUD_AHEAD:'CLOUD_AHEAD',
    CLOUD_ONLY:'CLOUD_ONLY',
    DIVERGED:'DIVERGED',
    UNTRACKED_BOTH:'UNTRACKED_BOTH',
    DELETED_LOCAL_SAFE:'DELETED_LOCAL_SAFE',
    DELETE_CONFLICT:'DELETE_CONFLICT',
    BANK_HASH_MISMATCH:'BANK_HASH_MISMATCH',
    CLOUD_RETAINED_UNLOADED:'CLOUD_RETAINED_UNLOADED',
    CLOUD_MISSING_CHANGED:'CLOUD_MISSING_CHANGED'
  });
  const entityKey=(id,hash)=>`${String(id)}@@${String(hash||'NOHASH')}`;
  const qbankKey='__QBANK__';

  /* Progress Sync V2 classifier.
     Timestamps are deliberately NOT used to choose authority. They are display/debug metadata only.
     The decision is based on whether the local copy descends from the current cloud version. */
  function classify({local=null,remote=null,state=null,matchingFormLoaded=true,differentVersionLoaded=false}={}){
    state=state||{};
    const current=remote?.current||null;
    const base=String(state.baseCloudVersionId||'');
    const baseHash=String(state.baseContentHash||'');
    const explicitDeleted=state.explicitDeleted===true;
    const forceDecision=state.forceDecision===true;
    const localHash=String(local?.contentHash||'');
    const remoteHash=String(current?.contentHash||'');
    const remoteVersion=String(current?.versionId||'');
    const remoteDeleted=!!current?.deletedAt;

    if(current && remote?.kind==='form' && !matchingFormLoaded){
      return differentVersionLoaded?CLASS.BANK_HASH_MISMATCH:CLASS.CLOUD_RETAINED_UNLOADED;
    }

    if(local && current && !remoteDeleted && localHash && remoteHash && localHash===remoteHash)return CLASS.ALIGNED;
    if(!local && current && remoteDeleted)return CLASS.ALIGNED;

    if(explicitDeleted && !local){
      if(!current)return CLASS.ALIGNED;
      if(remoteDeleted && (!base || base===remoteVersion))return CLASS.ALIGNED;
      if(forceDecision)return CLASS.DELETE_CONFLICT;
      if(base && base===remoteVersion)return CLASS.DELETED_LOCAL_SAFE;
      return CLASS.DELETE_CONFLICT;
    }

    if(!local && current && !remoteDeleted)return CLASS.CLOUD_ONLY;

    if(local && !current){
      if(forceDecision || base)return CLASS.CLOUD_MISSING_CHANGED;
      return CLASS.LOCAL_ONLY_SAFE;
    }

    if(!local && !current)return CLASS.ALIGNED;

    if(local && current && remoteDeleted){
      if(forceDecision)return CLASS.DIVERGED;
      if(base && base===remoteVersion)return CLASS.LOCAL_AHEAD_SAFE;
      if(!base)return CLASS.UNTRACKED_BOTH;
      return CLASS.DIVERGED;
    }

    if(forceDecision)return CLASS.DIVERGED;
    if(!base)return CLASS.UNTRACKED_BOTH;
    if(base===remoteVersion)return CLASS.LOCAL_AHEAD_SAFE;
    if(baseHash && localHash===baseHash)return CLASS.CLOUD_AHEAD;
    return CLASS.DIVERGED;
  }

  R.backupModel={entityKey,qbankKey};
  R.syncV2Model={CLASS,classify};
})();

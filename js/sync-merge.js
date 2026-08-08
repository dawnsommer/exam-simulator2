(function(){
  'use strict';
  const R=window.StepProgressSync=window.StepProgressSync||{};
  const STATES=Object.freeze({
    ALIGNED:'ALIGNED',
    LOCAL_ONLY:'LOCAL_ONLY',
    LOCAL_AHEAD_SAFE:'LOCAL_AHEAD_SAFE',
    CLOUD_ONLY:'CLOUD_ONLY',
    CLOUD_AHEAD:'CLOUD_AHEAD',
    DIVERGED:'DIVERGED',
    DELETED_LOCAL_SAFE:'DELETED_LOCAL_SAFE',
    DELETE_CONFLICT:'DELETE_CONFLICT',
    BANK_HASH_MISMATCH:'BANK_HASH_MISMATCH',
    UNTRACKED_BOTH:'UNTRACKED_BOTH'
  });
  const entityKey=(id,hash)=>`${String(id)}@@${String(hash||'NOHASH')}`;
  const qbankKey='__QBANK__';

  /* Pure Progress Sync V2 classifier. Timestamps never decide direction. */
  function classifyFormSync(local,cloud){
    local=local||null; cloud=cloud||null;
    if(local?.bankHashMismatch||cloud?.bankHashMismatch)return STATES.BANK_HASH_MISMATCH;

    const localExists=!!local?.exists;
    const explicitDelete=!!local?.deleted;
    const dirty=!!local?.dirty;
    const base=String(local?.baseCloudVersionId||'');
    const localHash=String(local?.contentHash||local?.localContentHash||'');
    const cloudExists=!!cloud;
    const cloudDeleted=!!cloud?.deleted;
    const cloudVersion=String(cloud?.currentVersionId||'');
    const cloudHash=String(cloud?.checksum||cloud?.contentHash||'');

    if(!cloudExists){
      if(explicitDelete)return STATES.ALIGNED;
      return localExists?STATES.LOCAL_ONLY:STATES.ALIGNED;
    }

    if(explicitDelete){
      if(!base)return STATES.DELETE_CONFLICT;
      return base===cloudVersion?STATES.DELETED_LOCAL_SAFE:STATES.DELETE_CONFLICT;
    }

    if(!localExists){
      return cloudDeleted?STATES.ALIGNED:STATES.CLOUD_ONLY;
    }

    if(!cloudDeleted && localHash && cloudHash && localHash===cloudHash)return STATES.ALIGNED;

    if(!base){
      return cloudDeleted?STATES.UNTRACKED_BOTH:STATES.UNTRACKED_BOTH;
    }

    if(base===cloudVersion){
      /* The current Drive version is exactly the version this local copy descended from. */
      return STATES.LOCAL_AHEAD_SAFE;
    }

    if(dirty)return STATES.DIVERGED;
    return STATES.CLOUD_AHEAD;
  }

  R.backupModel={entityKey,qbankKey};
  R.classifier={STATES,classifyFormSync};
})();

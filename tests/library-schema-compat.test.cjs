const fs=require('fs');
const assert=require('assert');
const config=fs.readFileSync(__dirname+'/../js/sync-config.js','utf8');
const lib=fs.readFileSync(__dirname+'/../js/library-backup.js','utf8');
const progress=fs.readFileSync(__dirname+'/../js/progress-sync.js','utf8');

assert.match(config,/SCHEMA_VERSION:\s*2,/,'Active Progress Sync must write schema 2');
assert.match(config,/HISTORY_SCHEMA_VERSION:\s*2,/,'Progress history must write schema 2');
assert.match(config,/LIBRARY_SCHEMA_VERSION:\s*2,/,'Full Library cloud manifest must write schema 2');
assert.match(lib,/schema!==1&&schema!==Number\(C\.LIBRARY_SCHEMA_VERSION\)/,'Library reader must accept legacy schema 1 and current schema 2');
assert.match(lib,/schemaVersion:C\.LIBRARY_SCHEMA_VERSION,backupType:'library',containsProgress:false/,'Library manifests must normalize to schema 2 and explicitly remain library-only');
assert.match(progress,/schema!==1&&schema!==Number\(C\.HISTORY_SCHEMA_VERSION\)/,'Progress history reader must accept schema 1 and schema 2');
assert.match(progress,/schemaVersion:C\.HISTORY_SCHEMA_VERSION/,'Progress history writes must use current schema 2');
assert.doesNotMatch(lib,/schemaVersion\s*:\s*1/,'Library writer must never emit schema 1');
console.log('PASS Unified schema policy: all new cloud writes=2; library/history readers accept legacy schema 1');

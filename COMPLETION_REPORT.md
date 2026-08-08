# exam-simulator2 — Progress Sync V2 Completion Report

Build: `EXAM-SIMULATOR2-PROGRESS-V2-1`

## What was replaced

The CLOUD8 progress synchronization state machine was removed and replaced. The previous `knownCloud`, `lastBackedUpHash`, `dirtyKeys`, `protectedDeletes`, and `deleteTombstones` decision model is no longer referenced by executable progress-sync code.

The following infrastructure was preserved:

- simulator native IndexedDB / DATA progress storage
- simulator save/import representation
- highlight anchor data
- Qbank progress storage
- 3-digit score integration
- Google Drive `appDataFolder`
- shared Cloudflare OAuth Worker and silent `/token` refresh
- direct browser → Google Drive payload traffic
- Full Form Library Backup / restore / pause / resume
- production GitHub Pages base path and PWA scope

## V2 authority model

Each local entity now stores:

- `baseCloudVersionId`
- `baseContentHash`
- `lastSyncedAt`
- local change timestamp/reason metadata
- explicit-delete state when the simulator itself records a delete/reset
- a `forceDecision` guard after recovery restores

The current cloud manifest stores a unique version lineage for each form/Qbank entity.

Automatic Local → Cloud is allowed only when the cloud current version is still the local entity's base version, or when the entity has never existed in cloud.

## V2 classifications

The pure classifier can return:

- `ALIGNED`
- `LOCAL_AHEAD_SAFE`
- `LOCAL_ONLY_SAFE`
- `CLOUD_AHEAD`
- `CLOUD_ONLY`
- `DIVERGED`
- `UNTRACKED_BOTH`
- `DELETED_LOCAL_SAFE`
- `DELETE_CONFLICT`
- `CLOUD_MISSING_CHANGED`
- `BANK_HASH_MISMATCH`
- `CLOUD_RETAINED_UNLOADED`

Timestamps are not used to choose authority.

## Checkpoint behavior

Routine answers/highlights remain immediate local IndexedDB writes only.

Cloud checkpoints occur on major simulator events, app startup/foreground, network restoration, and manual Back Up Now.

At a checkpoint:

1. local progress loads first
2. tiny Drive manifest is read
3. each form is classified by lineage
4. only `LOCAL_AHEAD_SAFE`, `LOCAL_ONLY_SAFE`, and `DELETED_LOCAL_SAFE` may upload automatically
5. cloud-ahead/diverged/untracked states stop and require a user decision

## New-device / data-loss behavior

Missing local progress is never interpreted as deletion unless an explicit local delete/reset marker exists.

A fresh device with cloud progress receives `CLOUD_ONLY` and is offered cloud restore. It cannot automatically upload an empty local state over cloud.

## Previous cloud recovery

Every successful Local → Cloud replacement preserves the previous cloud current version as that entity's single previous recovery point. The older previous recovery is pruned after the new manifest transaction commits.

Users can restore or delete individual previous cloud recovery copies, or delete all previous recoveries. Current progress and dated snapshots are unaffected by deleting previous recovery copies.

## Local recovery

Before cloud → local restore or dated-snapshot restore, one complete local progress recovery point is saved in the sync metadata IndexedDB.

The recovery rollback is progress-only and now restores the currently loaded forms/Qbank exactly; it does not replace the form library.

Users can Undo Restore or delete the local recovery point to reclaim local storage.

## Daily + manual progress snapshots

A separate Drive history manifest is used:

`exam-simulator2.progress-history.json`

- Daily snapshots are enabled by default.
- At most seven daily snapshots are retained.
- Manual snapshots are timestamped and may have an optional label.
- Snapshot creation uses Drive `files.copy` on current per-form backup files, avoiding a full browser re-upload of the progress collection.
- Snapshot restore is local-first. If cloud current versions are newer, the restored local copy becomes a deliberate branch and requires an explicit direction before cloud can be overwritten.
- Snapshot deletion does not affect current sync or the Full Form Library backup.

## Advanced maintenance

- `Clear Current Cloud Sync` removes only the current progress manifest and its current/previous per-form sync files. Dated progress snapshots and Full Form Library Backup remain intact.
- `Replace Current Cloud with This Device` first creates a timestamped manual cloud recovery snapshot when current cloud progress exists, then rebuilds current cloud progress from local state.

## Manifest compatibility

Legacy schema-1 progress manifests are accepted and converted to the V2 shape in memory. Stable legacy version IDs are derived from the existing backup/file/hash identity. A legacy cloud entry is only adopted automatically when local content is semantically identical.

## Build/cache changes

- build: `EXAM-SIMULATOR2-PROGRESS-V2-1`
- service-worker cache version bumped
- manifest start URL bumped
- production bridge build ID bumped
- Google Backup top sticker recognizes V2 states such as Cloud Restore Available and Backup Decision Required

## Tests actually performed

Static/syntax:

- all external JS modules passed `node --check`
- service worker passed `node --check`
- all 34 inline scripts in `index.html` passed syntax validation

Pure classifier tests:

- same-content aligned adoption
- Device 1 local-ahead safe
- stale device cloud-ahead
- both-sides changed → diverged
- new device cloud-only
- untracked local+cloud → explicit decision
- explicit deletion safe
- explicit deletion conflict
- missing local progress never treated as deletion
- aligned cloud tombstone
- local progress created after known cloud deletion
- forced snapshot deletion requires a decision

Mocked Drive/state-machine integration tests:

- first local-only backup creates current version and settles aligned
- second local backup advances cloud version and preserves one previous cloud recovery
- restoring previous cloud recovery changes local only, keeps cloud current unchanged, saves local undo recovery, and creates a deliberate branch decision
- old-device cloud-ahead classification
- true divergent local/cloud classification
- fresh/new device recovery classification
- cloud → local restore + base-version adoption
- manual dated snapshot creation
- legacy manifest migration produces stable version identity
- manual Back Up Now performs zero divergent overwrite before user decision
- explicit **Keep This Device → Cloud** decision creates a new current version, preserves the old current as previous recovery, and settles aligned
- fresh-device automatic checkpoint does not alter cloud
- explicit safe local deletion creates a cloud tombstone and previous recovery, then settles aligned
- restoring an older dated snapshot leaves newer current cloud untouched and requires explicit direction
- daily snapshot retention caps at 7
- clearing current cloud sync preserves dated snapshots
- clearing current cloud sync leaves an unrelated Full Form Library manifest/file untouched

## Not performed in this environment

Real Google/Drive/iPad integration still requires the deployed production origin and user Google session. Specifically not claimed as tested here:

- actual Worker OAuth callback on production GitHub Pages
- real Drive `files.copy` for daily/manual snapshots
- actual iPad Safari/Home-Screen PWA storage wipe/reopen behavior
- multi-device concurrent production sessions
- 30–50 MB real progress corpus
- 300 MB real Full Form Library transfer

These should be tested on disposable form/progress data before relying on V2 for exam-critical recovery.

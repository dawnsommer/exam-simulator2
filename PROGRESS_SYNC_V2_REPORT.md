# exam-simulator2 — Progress Sync V2/V2.2 Implementation Report

Build: `EXAM-SIMULATOR2-PROGRESS-SYNC-V2.2`

Baseline: the uploaded working `exam-simulator2-cloud8(3).zip` was used as the authoritative source. No previously generated V2/V2.2 build was used as a base.

## 1. Actual uploaded architecture discovered

- `index.html` contains the simulator UI and the native DATA/IndexedDB persistence layer.
- Runtime progress remains local-first through the existing DATA abstraction. Native progress writes already emitted `stepsim:progress-write`; 3-digit score changes emitted `stepsim:three-digit-score`.
- Cloud code is isolated in:
  - `js/sync-config.js`
  - `js/google-auth.js`
  - `js/sync-merge.js`
  - `js/sync-storage.js`
  - `js/progress-sync.js`
  - `js/library-backup.js`
- The Google Backup tab is mounted into the existing `.modern-sidebar`, immediately before `#settingsTab`.
- The existing Cloudflare Worker flow already used the shared Worker only for OAuth/session/token refresh, while Drive payloads moved browser ↔ Google Drive directly.
- Full Form Library cloud backup was already a separate resumable/chunked Drive workflow and was retained.

## 2. Exact old progress-sync code removed/replaced

The previous progress decision engine in `js/progress-sync.js` was replaced. Its overlapping authoritative concepts included:

- `knownCloud`
- `lastBackedUpHash`
- `dirtyKeys`
- `dirtyAll`
- `protectedDeletes`
- `deleteTombstones`
- ad-hoc `cloudNewer`/decision flags

Those old keys are now read only by a one-time migration/retirement path where needed. They no longer drive sync decisions.

The previous body/subtree tab-mount `MutationObserver` logic in the progress sync and library-backup modules was removed. V2 uses the known sidebar structure plus bounded retry timers.

## 3. Files modified

Core implementation:

- `index.html`
- `js/sync-config.js`
- `js/sync-merge.js`
- `js/sync-storage.js`
- `js/progress-sync.js`
- `js/library-backup.js`

Build/cache metadata updated:

- `sw.js`
- `manifest.webmanifest`
- `README_A22.14_GITHUB_PAGES_UPLOAD.md`
- `README_CLOUD_PRODUCTION.md`
- `COMPLETION_REPORT.md`

Added:

- `tests/progress-sync-v2.test.cjs`
- `PROGRESS_SYNC_V2_REPORT.md`

`js/google-auth.js` was inspected and deliberately left functionally unchanged because the uploaded Worker/auth implementation already matched the required architecture.

## 4. V2 cloud manifest schema

Active manifest: `exam-simulator2.manifest.json`

Conceptual schema:

```json
{
  "schemaVersion": 2,
  "appId": "exam-simulator2",
  "updatedAt": "ISO timestamp",
  "forms": {
    "<formId>@@<bankHash>": {
      "kind": "form",
      "formId": "N-11",
      "bankHash": "...",
      "currentVersionId": "crypto.randomUUID()",
      "previousVersionId": "uuid-or-null",
      "driveFileId": "...",
      "previousDriveFileId": "...",
      "checksum": "sha256",
      "sizeBytes": 0,
      "updatedAt": "ISO timestamp",
      "deviceId": "...",
      "deleted": false
    }
  },
  "qbank": { "...": "same active-version semantics" }
}
```

Each successful new cloud version receives a random UUID. Local lineage is advanced only after the manifest commit succeeds.

A V1 manifest is migrated once to schema 2. Existing V1 payloads remain readable during migration.

## 5. Local sync metadata schema

Stored in the existing isolated sync metadata database, not in native simulator progress:

```json
{
  "<entityKey>": {
    "baseCloudVersionId": "uuid-or-empty",
    "lastKnownCloudVersionId": "uuid-or-empty",
    "localContentHash": "sha256",
    "updatedAt": "ISO timestamp",
    "dirty": true,
    "deleted": false
  }
}
```

Cloud lineage is not written into native progress JSON, portable Progress ZIPs, Library backups, or simulator source forms.

## 6. Classification states

`js/sync-merge.js` now provides one pure classifier with these states:

- `ALIGNED`
- `LOCAL_ONLY`
- `LOCAL_AHEAD_SAFE`
- `CLOUD_ONLY`
- `CLOUD_AHEAD`
- `DIVERGED`
- `DELETED_LOCAL_SAFE`
- `DELETE_CONFLICT`
- `BANK_HASH_MISMATCH`
- `UNTRACKED_BOTH`

Timestamps are displayed but never determine overwrite direction. Version lineage is authoritative.

## 7. Automatic checkpoint behavior

Normal answers/highlights remain immediate local DATA/IndexedDB writes. They mark only the affected sync entity dirty.

Cloud backup is checkpoint/debounce driven rather than per-answer. Hooks cover major durable transitions such as block/form navigation, deletion/reset actions, foreground/network return while dirty, manual backup, and existing progress-write events.

Startup does not eagerly hash all progress before the simulator becomes usable. Local hashing is incremental and yields between forms.

## 8. Device 1 normal behavior

When local `baseCloudVersionId` equals Drive `currentVersionId` and local content changed:

1. local save is already durable;
2. cloud manifest is checked;
3. a new immutable form payload is uploaded;
4. the previous current cloud payload is retained as one-step recovery;
5. a second manifest-lineage check protects against another device advancing Drive during upload;
6. the V2 manifest is committed;
7. only after that commit does local `baseCloudVersionId` advance and `dirty` clear.

No prompt is shown for the safe lineage case.

## 9. Fresh Device 2 behavior

No local progress + matching cloud progress classifies as `CLOUD_ONLY`.

The device does not upload an empty state. The UI offers cloud restore. If the required form/library is absent, the matching library must be restored/imported first.

## 10. Stale Device 3 behavior

If an unchanged local copy descends from an older cloud version and Drive has advanced, it classifies as `CLOUD_AHEAD`.

The UI shows the local/cloud timestamps and summaries and requires a user choice rather than auto-uploading the stale device.

## 11. Divergence behavior

If local is dirty and its base version no longer equals Drive current, it classifies as `DIVERGED`.

Resolution actions are explicit:

- Keep This Device → create a new cloud current version, preserving old cloud current as previous recovery.
- Use Cloud Backup → create local recovery first, then restore cloud locally.
- Cancel → no destructive action.

Successful resolution updates hashes/lineage and re-analysis returns `ALIGNED` unless Drive changed again.

## 12. Deletion behavior

Missing local progress is not deletion authority.

Only explicit delete/reset actions establish a local deletion intent. A deletion automatically propagates only if the current Drive version still equals the local base version (`DELETED_LOCAL_SAFE`).

If Drive advanced, state is `DELETE_CONFLICT` and the user must choose whether to delete Google progress or restore it.

## 13. Previous cloud recovery

Each active entity retains at most one previous cloud version.

Before a replacing Local → Cloud write, the prior current entry becomes `previousVersionId`/`previousDriveFileId`.

Restoring Previous Cloud creates a fresh new current version; the version being replaced becomes the next previous recovery. Previous recovery can also be deleted independently.

## 14. Local undo recovery

Before Cloud → Local restore or portable progress import replacement, V2 stores one local recovery record per affected entity containing native progress/suspended data, 3-digit score, bankHash, timestamp, reason, and content hash.

Undo restores that native local content. Cloud lineage itself is not embedded in the recovery payload.

## 15. Daily backups

After the first successful cloud backup on a calendar day, V2 may create one daily snapshot.

- at most one daily snapshot per calendar day;
- maximum seven daily snapshots retained;
- older daily snapshots are removed;
- active manifest remains separate from history.

## 16. Manual backups

`Create Manual Progress Backup` creates a history snapshot of the current cloud state.

Where an active cloud file already exists, Drive server-side copy is used instead of re-uploading browser progress. Manual snapshots are listed/restorable/deletable independently from active synchronization.

History is tracked in `exam-simulator2.progress-history.json`.

## 17. Progress Export / Import behavior

Portable Progress ZIP export contains native progress under `progress/**` plus `progress_metadata.json` with restoration metadata such as `formId`, `bankHash`, 3-digit score, and export time.

It intentionally excludes:

- `baseCloudVersionId`
- cloud version IDs
- Drive file IDs
- Worker session/token data
- device authority
- sync dirty state
- library source files

Import validates structure and bankHash where possible, creates local recovery before replacement, suppresses normal sync mutation bookkeeping during the import write, restores native progress and 3-digit scores, clears imported entities' cloud lineage, then classifies against the current cloud.

If imported content hash equals cloud current, V2 safely re-adopts that cloud version and becomes `ALIGNED`. If it differs, it becomes `UNTRACKED_BOTH` and requires a Local-vs-Cloud choice. With no cloud copy it is `LOCAL_ONLY`.

Legacy portable progress material can be read without inheriting stale cloud authority.

## 18. Library Export / Import behavior

Local Library backup is now library-only and is separate from Progress backup.

It contains source/library data such as:

- sanitized `catalog.json`
- `forms/`
- `assets/`
- other non-progress library/source configuration files

It excludes `progress/**` and does not carry active progress, answers, highlights, attempts, scores, Qbank progress, cloud lineage, or sync metadata.

On Library restore, the incoming catalog is merged so matching local progress-owned catalog values are preserved. A legacy Full Library ZIP containing progress can be opened, but embedded progress is ignored and the user is told to use Import Progress Backup separately.

## 19. 3-digit score handling

3-digit scores remain native local progress-owned data.

- They travel with per-form cloud progress backup.
- They travel with portable Progress backup metadata.
- They are restored with progress.
- They are stripped from Library backup catalog data.
- Library restore preserves the device's existing matching 3-digit score instead of replacing/resetting it.

## 20. bankHash handling

Form sync identity is `formId + bankHash`.

A different bankHash is never automatically attached to the currently loaded form. Same form ID with a different bankHash is isolated as `BANK_HASH_MISMATCH`/historical recovery rather than becoming an active conflict for the current form version.

Portable import also validates bankHash where possible.

## 21. Full Form Library cloud behavior

The existing manual large cloud-library workflow remains separate from progress sync:

- direct browser ↔ Drive data transfer;
- resumable/chunked upload;
- range/chunk restore;
- progress percentage, bytes, speed, ETA;
- pause/resume/cancel;
- catalog restored last for safer interrupted restore.

The cloud-library bridge excludes `progress/`. Its `catalog.json` is sanitized on backup, and cloud library restore preserves local progress-owned catalog values.

## 22. Startup / performance safeguards

- Google Backup surface mounts first using the actual `.modern-sidebar` structure.
- No progress-sync or library-backup body-wide recursive `MutationObserver` is used.
- Mount retries are finite/bounded timers.
- Service-worker registration is non-blocking.
- Worker auth is restored after the UI surface exists.
- Cloud manifest work is deferred until idle when possible.
- Local progress reads/hashing are incremental and yield between forms.
- Normal backup uploads only affected per-form entities, not all forms.
- A second Drive manifest read immediately before normal manifest commit aborts a staged upload if another device advanced the same entity while this device was uploading.

## 23. Worker/auth behavior preserved

`js/google-auth.js` was not rewritten.

Preserved behavior includes:

- opaque Worker session persisted device-locally;
- Google access token memory-only;
- `POST /token` silent refresh;
- Drive 401 → refresh → retry exactly once;
- Drive 403 does not automatically destroy the Worker session;
- disconnect is device-local Worker-session disconnect;
- Drive payload traffic remains browser ↔ Google Drive, not proxied through Cloudflare.

## 24. Tests actually run

Automated/mocked regression command:

```bash
node tests/progress-sync-v2.test.cjs
```

Result: **25/25 passed**.

The suite includes every requested A–V scenario:

A. Device 1 normal flow  
B. no-change  
C. fresh Device 2  
D. old Device 3  
E. divergence  
F. Keep This Device  
G. Use Cloud  
H. explicit deletion safe/conflict  
I. previous cloud recovery  
J. local undo recovery  
K. manual snapshot create/list/restore/delete  
L. daily snapshot one/day + max seven  
M. Progress export excludes cloud lineage  
N. Progress import resets lineage  
O. identical imported progress re-adopts cloud version  
P. differing imported progress requires decision  
Q. Library export has no progress and sanitizes catalog  
R. legacy Full Library embedded progress ignored  
S. Library restore preserves matching local progress-owned catalog values  
T. cloud Full Library backup is library-only  
U. startup stability safeguards  
V. Worker callback/token/401/403/disconnect mocks

Three additional adversarial tests also pass:

- concurrent Drive manifest advancement aborts staged upload without committing;
- bankHash mismatch is isolated from the current form;
- V1 manifest/legacy sync metadata migrate once and old decision metadata is retired.

Additional checks run successfully:

- `node --check` on every external JS module and `sw.js`;
- all **35** inline `index.html` script blocks parsed successfully;
- integrated headless DOM execution of the actual `index.html` plus actual local JS modules mounted:
  - `.modern-sidebar`;
  - `Google Backup` before `Settings`;
  - `progressSyncPanel`;
  - Current Progress Sync / Recovery / Backup History / Advanced sections;
  - separate Full Form Library Backup card;
  - initial `Google Backup: Off` state without a connected Worker session.

## 25. Tests not possible in this environment

Not claimed as passed:

- real Google account OAuth callback through the deployed Worker;
- real Google Drive `appDataFolder` upload/copy/delete against the user's account;
- live two-/three-device synchronization over Google Drive;
- real iPad/iPhone Safari/PWA behavior;
- installed GitHub Pages service-worker update behavior on the production origin;
- large real-world transfer/performance benchmark on the user's device.

A conventional served-page Chromium smoke test could not run because this environment blocks localhost and synthetic HTTPS navigation with `ERR_BLOCKED_BY_ADMINISTRATOR`. An in-memory headless DOM integration run was used instead. That sandbox origin denies IndexedDB, so IndexedDB persistence was tested through the mocked regression harness rather than falsely reported as a real-browser persistence pass.

## 26. Unresolved limitations / deployment verification

No known mocked A–V regression remains failing.

The remaining validation is environmental rather than an identified code failure: deploy this build and verify one real Google flow on the actual production origin, then exercise Device 1 → fresh Device 2 → stale Device 3 using a non-critical test form before relying on it for irreplaceable progress.

The build intentionally keeps portable Progress, local Library, active cloud progress sync, progress history, and Full Form Library cloud backup as separate systems.

---

## Primary safety invariant implemented

Local DATA/IndexedDB remains the runtime source of truth.

Automatic Local → Cloud replacement is permitted only when the current Drive version is still the version the local copy descended from. If Drive lineage has advanced, V2 requires an explicit decision. A second manifest check before commit also prevents a normal upload from winning a race against a concurrent device update.

## V2.2.3 schema unification

Current cloud write schema is now uniformly version 2 for active progress, per-form/Qbank payloads, progress history, and Full Form Library manifests. Readers remain backward-compatible with schema 1 where legacy data can exist. Library schema-1 manifests are normalized to schema 2 in memory, with `backupType: "library"` and `containsProgress: false`, and are naturally upgraded on the next successful backup commit. Progress-history schema-1 manifests are handled the same way. No new cloud writer emits schema 1.

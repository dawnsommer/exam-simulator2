# Simulator for iPad (`exam-simulator2`) — standalone handoff

Last inspected: 2026-08-12  
Effective simulator UI version: `A22.14` (final script in `index.html`)  
Cloud/cache build: `EXAM-SIMULATOR2-PROGRESS-SYNC-V2.3.0`  
Scope: this nested repository only; do not inspect the parent LOCAL simulator for iPad-only work.

## Start here

This is the handoff and maintenance manifest for the iPad/GitHub Pages/PWA build. Although its exam engine shares ancestry with Simulator LOCAL, its durable storage, import/export, update, recovery, and Google Drive behavior are different. Read this file first, then open only the subsystem files listed below.

The parent `../DATA/` tree is exclusively a LOCAL simulator test fixture (currently `CKNotes4`). The iPad app does not read it, migrate it, or synchronize it. For iPad work, use the browser library in IndexedDB, an explicitly imported iPad backup, or a temporary browser test fixture; do not inspect or copy the parent LOCAL data.

After every functional, schema, persistence, sync, deployment, or cache change, update **Current change record** at the end. Include behavior, files, tests, and unresolved risks. Keep entries compact.

## What this app is

`index.html` is the main simulator and browser-library implementation. On iPad and normal HTTPS hosting, the primary source of truth is a virtual `DATA/` filesystem stored in IndexedDB—not Google Drive and not downloaded JSON files. Google Drive is optional backup/synchronization layered on top.

The app is deployed at `https://dawnsommer.github.io/exam-simulator2/` and is installable/offline through `manifest.webmanifest` and `sw.js`.

## Source map

| Path | Role | Read when |
|---|---|---|
| `index.html` | Exam engine, IndexedDB virtual filesystem, library/forms/progress/Qbank, local ZIP backups, cloud bridge, UI patch layers | Any simulator/storage/UI issue |
| `js/sync-config.js` | Production endpoints/build IDs, sync metadata DB, utilities | Configuration/build/metadata issues |
| `js/google-auth.js` | Worker OAuth session, memory-only Drive access token, Drive fetch/retry | Login/token/Drive auth issues |
| `js/sync-merge.js` | Pure lineage classifier and entity keys | Sync direction/conflict logic |
| `js/sync-storage.js` | Adapter between native simulator storage and cloud entities/recoveries | Payload/hash/apply/undo issues |
| `js/progress-sync.js` | Drive manifests/version files, dirty tracking, checkpoints, conflict UI, history/recovery | Progress sync issues |
| `js/library-backup.js` | Separate resumable full-library Drive backup/restore | Large library transfer issues |
| `js/qid-migration.js` | Shared pure QID/formUid migration and legacy mapping logic | Identity/schema migration work |
| `js/qid-settings.js` | Settings audit/backup/migrate/verify/restore and baseline UI | QID rollout/baseline work |
| `sw.js` | App-shell cache/update policy | Offline/stale-version issues |
| `manifest.webmanifest` | PWA metadata/start URL/icons | Install/launch issues |
| `offline.html`, `privacy.html` | Offline fallback and privacy disclosure | PWA/legal surface |
| `tests/*.test.cjs` | Node mock/regression tests | Every sync/storage/UI change |
| `PROGRESS_SYNC_V2_REPORT.md`, `COMPLETION_REPORT.md` | Detailed implementation history and test claims | Deep sync archaeology |

This folder is its own Git repository. At inspection time it was already dirty (tracked `index.html`, `manifest.webmanifest`, and `sw.js` modified; cloud docs/modules/tests also present as untracked work). Treat all pre-existing changes as user-owned. Never reset or discard them.

## Primary storage model

### Browser library (runtime authority)

IndexedDB database: `StepExamSimulatorV784_A4_iPadBrowserLibrary_DB`  
Object store: `files` with key path `path`  
Record shape: `{path, blob, updatedAt, type}`

`createIpadDirectoryHandle()` and `createIpadFileHandle()` emulate the File System Access API over those records. The rest of the simulator therefore uses familiar virtual paths:

- `catalog.json`
- `forms/<FORM>.json`
- `forms/backups/...`
- `assets/<FORM>/...`
- `progress/<FORM>_progress_save.json`
- `progress/<FORM>_suspended_test.json`
- `progress/QBANK_MODE_progress.json`

`shouldUseBrowserLibrary()` selects this mode on iOS, when directory picker support is missing, when `?browserLibrary=1` is present, and normally on HTTPS. Desktop testing can explicitly request real folder access with `?folderAccess=1`.

This is IndexedDB, not OPFS, despite some historical notes mentioning both. Do not move the primary library to another storage technology as a small repair.

### Sync metadata (separate from progress)

Database: `ExamSimulator2_SYNC_META_DB`  
Store: `kv`

It contains device ID, Worker session, cloud lineage, dirty/deletion state, local recovery points, last backup markers, and interrupted library-transfer state. If this DB cannot open, metadata falls back to `localStorage` keys prefixed `ExamSimulator2_SYNC_META_FALLBACK:`. Google access tokens are memory-only.

### Library-transfer chunks

Large Drive library transfers use `ExamSimulator2_LIBRARY_TRANSFER_DB` / `chunks`, with a configured 4 MiB chunk size. This is staging data, not the live library.

## Native simulator behavior

The core exam/session/progress model is similar in shape to LOCAL but independent in runtime:

- forms are normalized from arrays, `{questions}`, or `{blocks}`;
- library attempts are stored as v10 progress bundles;
- suspend/resume persists current item and timer state;
- Qbank has independent used history/test sessions;
- v15 compact highlight anchors are authoritative;
- linked-set-safe shuffle persists question order;
- later versioned wrappers in `index.html` override earlier globals.

The effective storage profile is set late to `ipad-browser-library-primary`. The final A22.14 patch sets the visible version/title. Earlier title constants in the same HTML are historical and not authoritative.

Form import accepts JSON or ZIP. ZIP metadata junk is ignored; question JSON is discovered and asset references are rewritten into the virtual `assets/` tree. Library progress writes dispatch `stepsim:progress-write`; 3-digit score changes dispatch `stepsim:three-digit-score` so sync can mark only the affected entity dirty.

## Native data contracts

Catalog/form/progress paths mirror the LOCAL naming convention but live in the browser DB. A per-form progress file is a `StepExamSimulatorV10ProgressBundle` envelope with an active session and multi-attempt bundle. Progress includes answers, answer-change audit, flags, strikes, notes, per-question time, results, resume state, and v15 highlight anchors.

Legacy cloud/form identity was `formId + bankHash`, encoded as `formId@@bankHash`. QID schema 1 uses stable `formUid` entity identity and immutable question `qid` values; `bankHash` is retained as revision metadata rather than entity identity. A cross-revision restore is allowed only when both sides declare QID schema 1, the `formUid` matches, and question counts are compatible. Qbank remains the independent entity `__QBANK__`, with migrated question references encoded as `formUid::qid`. Legacy/non-QID hash mismatches still fail closed.

`StepExamSyncBridge` in `index.html` is the only supported boundary for cloud modules. It exposes catalog/runtime inspection; flush; per-form progress/suspended/Qbank read/write; 3-digit scores; library file listing/read/write/prune; and refresh. Cloud modules should not reach into simulator globals or IndexedDB directly.

## Four separate backup systems

Do not merge these concepts:

1. **Portable Progress ZIP** — `progress/**` plus `progress_metadata.json`; contains native progress and 3-digit scores, but no forms/assets or cloud authority. Import validates `bankHash`, creates local recovery, resets lineage, then reclassifies against Drive.
2. **Local Library ZIP** — sanitized `catalog.json` plus `forms/` and `assets/`; intentionally excludes progress, Qbank, scores, and lineage. Restore preserves matching local progress-owned catalog values.
3. **Drive Progress Sync/History** — small per-entity progress revisions, an active v2 manifest, one previous cloud version, local undo recovery, one rolling automatic daily snapshot, and user-created manual snapshots.
4. **Full Drive Library Backup** — manual large/resumable transfer of catalog/forms/assets only. It has its own manifest and chunk staging. Restore writes `catalog.json` last and excludes `progress/`.

The Update App action clears app-shell caches/service-worker registration and reloads the clean Pages URL; it must not delete the IndexedDB browser library.

Simulator LOCAL emits and accepts the same first two ZIP contracts. Cross-simulator transfer order is Full Form Library first, Portable Progress second. QID-compatible imports use `formUid`/QID identity; legacy imports remain strict about the matching installed form and `bankHash`.

The temporary **QID Migration & Compatibility** Settings card must be run on one canonical device only. Migration creates an IndexedDB recovery, suppresses sync mutation events, rewrites local identity, clears old lineage, and sets `qidMigrationPendingBaseline`. While that marker exists, normal cloud checks/uploads/restores are blocked. **Establish New Cloud Baseline** first verifies/mirrors Full Form Library, replaces per-form progress with opaque progress revisions, verifies alignment, records `qidCloudBaseline`, then removes the block. New devices restore Full Form Library first; clean cloud-only/cloud-ahead progress may then restore automatically.

## Google Drive architecture

Production configuration is in one block in `sync-config.js`:

- app ID / prefix: `exam-simulator2`
- Worker: `https://study-tools-auth-worker.summerofdawn20.workers.dev`
- return URL: `https://dawnsommer.github.io/exam-simulator2/`
- scope: `https://www.googleapis.com/auth/drive.appdata`
- callback fragment parameter: `cloud-auth`

The Cloudflare Worker handles OAuth/session/token refresh only. Drive payloads travel browser ↔ Google Drive `appDataFolder` directly. The opaque Worker session is stored device-locally; the callback fragment is captured early and removed from the visible URL. Drive 401 clears the memory token and retries once; 403 does not automatically destroy the Worker session.

Active progress manifest: `exam-simulator2.manifest.json`  
History manifest: `exam-simulator2.progress-history.json`  
Library manifest: `exam-simulator2.library.manifest.json`

All new manifest writers use schema 2; readers accept legacy schema 1 where documented.

## Sync safety invariant

Timestamps never choose overwrite direction. The pure classifier in `sync-merge.js` uses content hashes plus version lineage and returns:

`ALIGNED`, `LOCAL_ONLY`, `LOCAL_AHEAD_SAFE`, `CLOUD_ONLY`, `CLOUD_AHEAD`, `DIVERGED`, `DELETED_LOCAL_SAFE`, `DELETE_CONFLICT`, `BANK_HASH_MISMATCH`, or `UNTRACKED_BOTH`.

Automatic local → cloud replacement is safe only when local `baseCloudVersionId` still equals Drive `currentVersionId`. Before manifest commit, Drive is checked again to catch a concurrent device advance. Clean `CLOUD_ONLY`/`CLOUD_AHEAD` progress may restore automatically when there is no conflict and no active exam; a local recovery is created before replacement. Divergence, untracked-both, delete conflict, and identity incompatibility always require explicit user direction. A missing local file is not deletion authority; only an explicit delete/reset action creates a tombstone intent. Writes debounce for 2 seconds with a 5-second maximum delay, major milestones checkpoint immediately, and progress changed during an upload produces exactly one follow-up checkpoint.

Portable backups never inherit Drive lineage. This is essential for fresh-device safety.

## Load order and cache coordination

`sync-config.js` and `google-auth.js` load near the top so the OAuth callback can be captured before simulator initialization. Near the bottom, after `StepExamSyncBridge` exists, load order is:

1. `sync-merge.js`
2. `sync-storage.js`
3. `progress-sync.js`
4. `library-backup.js`
5. `qid-settings.js`

When changing the cloud build, coordinate all of the following:

- `C.BUILD` in `js/sync-config.js`
- cache-buster query strings in `index.html`
- `BUILD`, cache name, and shell URLs in `sw.js`
- `manifest.webmanifest` start URL
- production/readme/report labels

Current coordinated runtime JS/SW/manifest truth is `V2.3.0`. QID migration is loaded before the app integration points and its Settings layer loads after the storage/cloud bridges exist.

## Validation commands

Run from this folder:

```bash
node --test --test-concurrency=1 tests/*.test.cjs
for f in js/*.js sw.js; do node --check "$f"; done
```

Also verify in a served/deployed browser:

- browser library initializes and survives reload/offline launch;
- import a disposable JSON/ZIP and render its assets;
- answer/highlight/suspend/resume and inspect durable progress;
- portable Progress and Library exports remain separate;
- cloud UI mounts before Settings and other menu modes hide it;
- fresh, stale, and divergent devices receive the correct explicit choices;
- service-worker update loads the new build without deleting IndexedDB.

As run on 2026-08-12, external syntax checks, inline-script parsing, shared QID tests, and the full mocked iPad suite passed. The former real-date-coupled daily snapshot test now derives the runtime date and verifies one rolling daily snapshot. Real OAuth, Drive, multi-device, iPad Safari/PWA, and large-transfer behavior still require production/device testing; mocked Node tests cannot prove them.

Real OAuth, Drive, multi-device, iPad Safari/PWA, and large-transfer behavior still require production/device testing; mocked Node tests cannot prove them.

## Known hazards

- `index.html` has many later wrappers; trace all assignments before editing a core function.
- Browser IndexedDB can be cleared by site-data removal. Encourage both progress and library backups.
- Library restore requires matching forms before cloud progress can be applied.
- Progress-owned catalog fields (`threeDigitScore`, `progressSummary`) must survive library restore.
- Qbank `settings` and `lastSelectedFormIds` are device-local and are preserved when cloud Qbank progress is applied.
- Never include `progress/` in a library backup or forms/assets in a progress backup.
- Never store Google access tokens in IndexedDB/localStorage or proxy Drive payloads through the Worker.
- Do not use timestamps to resolve sync direction.
- A service-worker build mismatch can leave installed iPads on stale HTML/JS even when source files are correct.
- Preserve the dirty working tree; no destructive Git cleanup without explicit authorization.

## Current change record

Keep newest entries first.

| Date | Change | Files | Verification | Follow-up |
|---|---|---|---|---|
| 2026-08-12 | Fixed the shared migration safety invariant so newly assigned per-question `qid` fields are accepted as identity metadata while all substantive question/progress content remains protected. | `js/qid-migration.js`, LOCAL `qid-migration.js`, shared QID tests, both handoffs | Added a regression proving QID-only form migration passes while a stem change fails; shared and full iPad suites run after the change. | Import the canonical LOCAL Full Library and Portable Progress; do not independently generate iPad QIDs. |
| 2026-08-12 | Kept iPad QID identity behavior in parity with LOCAL: unmigrated copied/backup forms now derive their one-time `formUid` from the distinct catalog record ID instead of an inherited internal form ID, while existing explicit `formUid` values still fail closed on real collisions. The audit table and blocker alert now expose exact error details. | `js/qid-migration.js`, `js/qid-settings.js`, LOCAL `qid-*.js`, shared QID tests, both handoffs | Shared and full iPad regression suites run after the change; LOCAL/iPad migration/settings files remain byte-identical. | Distribute the canonical LOCAL Full Library and Portable Progress to iPad rather than independently migrating the iPad library. |
| 2026-08-12 | Restyled the Score Report sorting controls with a modern sort bar and added independent Ascending/Descending selection for Test order, Status, Time taken, and Subject. | `index.html`, `HANDOFF.md` | External syntax, inline script parse, and iPad regression suite run after the change. | Perform a manual browser check of both sort selectors on a multi-block completed test. |
| 2026-08-12 | Added Score Report question sorting by Test order, Status, Time taken, or Subject; sorting reorders rows within every block while preserving each Review action. | `index.html`, `HANDOFF.md` | External syntax, inline script parse, and iPad regression suite run after the change. | Perform a manual browser check of each sort mode on a multi-block completed test. |
| 2026-08-12 | Added per-question time-taken columns to the Score Report and block-complete table, plus an adjacent incorrect-only JSON export. Incorrect exports are sorted by block/item test order, retain original numbering, and add 1-based `incorrectNumber` values. | `index.html`, `HANDOFF.md` | External syntax, inline script parse, and iPad regression suite run after the change. | Perform a manual completed-test export check in the browser library build, including a test with no incorrect answers. |
| 2026-08-12 | Added a reusable sealed multi-device Mock Drive/Auth harness with machine-readable operations and deterministic upload/download/manifest/delete/auth/corruption faults; added stale-clean/dirty, offline/auth recovery, failed transaction, idempotency, checksum corruption, QID-set compatibility, cross-revision, snapshot verification, debounce/priority, and 100 seeded classifier scenarios. Repaired cloud restore/snapshot validation to recompute payload checksums and reject size/hash mismatches before writes, and repaired cross-bankHash QID compatibility to validate incoming QIDs against the installed catalog before applying progress. | `js/progress-sync.js`, `js/sync-storage.js`, `tests/autonomous-sync-safety.test.cjs`, `tests/support/autonomous-harness.cjs`, `HANDOFF.md` | Full mocked iPad suite passes 115/115; external JS/SW syntax passes. In-app browser smoke passed at 768×1024 and 1024×768 with Google Backup, Full Library, and all six QID/baseline controls accessible, zero page overflow, and zero console errors. | Real OAuth/Drive, true network interception, large resumable-library fault injection, and physical iPad/PWA lifecycle behavior remain manual/next-phase gates; never run destructive faults on production Drive. |
| 2026-08-12 | Released QID-aware V2.3.0 identity/migration and safe automatic sync: stable formUid entities, immutable QIDs, opaque progress revisions/parents, clean cloud auto-restore with local recovery, 2s/5s checkpoints plus dirty-again follow-up, exact progress byte UI, one rolling daily snapshot, explicit post-migration cloud baseline, and verified/awaited Full Library mirror cleanup limited to managed `LIB_..._exam-simulator2_` files. | `index.html`, `manifest.webmanifest`, `sw.js`, `js/qid-*.js`, `js/sync-{config,merge,storage}.js`, `js/progress-sync.js`, `js/library-backup.js`, `tests/*.test.cjs`, reports/readme, `HANDOFF.md` | External JS/SW syntax and all inline scripts parse; full mocked iPad suite and shared QID suite pass, including fresh/stale/divergent, race, rolling snapshot, dirty-again, legacy hash mismatch, Qbank/retest mapping, and library mirror policy coverage. | Deploy and test one disposable canonical migration/baseline, then Device 1 → fresh Device 2 → stale Device 3 on real iPad/Drive before production use. |
| 2026-08-12 | Recorded adoption of the existing iPad Portable Progress and Local Library ZIP contracts by Simulator LOCAL. No iPad runtime code changed. | `HANDOFF.md` | iPad external JS/SW syntax passed; existing suite remained 26/27 plus both other test files passing, with only the known real-date daily-snapshot failure. LOCAL contract tests passed 6/6. | Keep these archive contracts backward compatible; test transfer in the order Library then Progress. |
| 2026-08-12 | Clarified that the parent LOCAL `CKNotes4` fixture is unrelated to iPad runtime data. No runtime behavior changed. | `HANDOFF.md` | Cross-checked the documented IndexedDB/browser-library authority and standalone scope. | Keep LOCAL fixture details out of this handoff unless the runtime gains an explicit migration feature. |
| 2026-08-12 | Created standalone iPad architecture/storage/sync/deployment handoff after full source, report, and test inspection. No runtime behavior changed. | `HANDOFF.md` | External JS/SW syntax passed; regression run produced 26/27 sync scenarios plus both other test files passing. | Make the daily snapshot test use an injected/fixed clock; align stale `V2.2` metadata labels with runtime `V2.2.4` when intentionally releasing. |

# Simulator for iPad (`exam-simulator2`) — standalone handoff

Last inspected: 2026-11-10  
Effective simulator UI version: `A22.14` (final script in `index.html`)  
Cloud sync: **Sync v3 is live** (since release 24; `js/sync3-*.js`, resume file `../SYNC_V3_PROGRESS.md`), V2 modules remain as the fallback/archive path. App-shell release: numeric `VERSION` in `sw.js` (**48**, bumped by `tools/release.mjs`)  
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
| `js/form-updates-core.js`, `js/form-update-store.js`, `js/form-updates.js` | TXT/manifest contracts, atomic native update transaction, compact update/Admin UI | Form distribution or Admin work |
| `tools/publish.mjs`, `.github/workflows/pages.yml`, `update/instructions.txt` | Validate folders/TXT and generate a commit-pinned manifest in the Pages artifact | Publishing new/revised forms |
| `backend/worker.mjs`, `backend/form-updates.sql`, `UPDATE_SETUP.md` | Complete shared Worker extension, additive AUTH_DB tables, one-time setup | Receipts/Admin deployment |
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

The existing deployed Cloudflare Worker handles OAuth/session/token refresh. The complete extension in `backend/worker.mjs` also adds namespaced form-install receipts and browser Admin grants after the setup in `UPDATE_SETUP.md`; no production deployment was performed during implementation. Drive payloads travel browser ↔ Google Drive `appDataFolder` directly. The opaque Worker session is stored device-locally; the callback fragment is captured early and removed from the visible URL. Drive 401 clears the memory token and retries once; 403 does not automatically destroy the Worker session.

Active progress manifest: `exam-simulator2.manifest.json`  
History manifest: `exam-simulator2.progress-history.json`  
Library manifest: `exam-simulator2.library.manifest.json`

All new manifest writers use schema 2; readers accept legacy schema 1 where documented.

### Sync v3 Drive objects (live; details in `../SYNC_V3_PROGRESS.md`)

Flat names in the appDataFolder: `v3.dev.<dev>.json`, `v3.r.<dev>.{lib,set,f.<uid>,lease}.json` (per-device replicas of stamped units, merged), `v3.c.<sha>[.pN].json` (form content, write-once), `v3.x.<formId>.<key14>.<sha16>.json` (Rapid Review explanation files, newest `updatedAt` wins), `v3.t.<id>.<sha16>.json` (**ThunderShadow log files, merged, never replaced**: every device downloads the copies that differ, merges with its file, uploads the result, removes the copies it merged; `syncShadow` in `js/sync3-sync.js`, adapter `createShadowAdapter` in `js/sync3-bridge.js`, owner `shadow-logger.js`), `v3.s.<dev>.<day>.<uid>.json` (snapshots), `v3.migration.json`. Content, explain and shadow steps run after the push in the same cycle; the logger fires `stepsim:shadowlog-write` and `sync3-boot.js` schedules a cycle 8 s later.

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

Before each deployment, run `node tools/release.mjs` from this folder. `--check` verifies the current coordinated shell without a bump. The release tool updates `sw.js` VERSION/SHELL, `app-update.js` version/download list, all script/style queries in `index.html`, and icon queries in the manifest. `index.html` and the manifest start URL stay unversioned. The app-shell release is independent of sync's `C.BUILD`/bridge protocol identity, currently `V2.3.0`.

`app-update.js` owns relative `sw.js` registration with `updateViaCache: none`, update checks, a save-before-reload notice, and exact-scope refresh. `progress-sync.js` no longer registers a separate versioned worker. Cache reads/writes/deletes are limited to `exam-simulator2-` and to this folder's requests. User data and other apps are untouched. `StepAppUpdateFlush` captures frozen resume timing and awaits native durable writes before any update reload.

Shared root scripts `exam-notes.js` and `bulk-import.js` are byte-identical to LOCAL. Notes uses the existing block note field; **Keep notes open** is a separate iPad preference. The first Settings tab is **Bulk import**; one question JSON per folder is previewed and new form IDs are committed separately, with namespaced assets. Existing IDs are skipped. `StepBulkImportStore` preflights all paths, saves recovery metadata in `progress/backups/`, writes catalog last, and rolls back on failures. It never changes existing progress or cloud lineage.

## Form updates and browser Admin

`update/<ID>/<ID>.json` plus optional `assets/` uses one `instructions.txt` line per folder: `ID | Tab | update` or `ID | Tab | skip`. Missing forms install under either policy. Existing `skip` forms remain untouched. Publishing validates input and emits `form-updates-manifest.json` with sizes/checksums and a pinned source commit. The public artifact excludes backend/test files and reads form bytes directly from that commit. Keep the TXT comments when no forms are published.

`StepFormUpdateStore` is the only update write boundary. Files download into a separate staging DB, are validated/checksummed, then an atomic transaction commits recovery ZIP, forms/assets, required progress revision hashes, receipt outbox, and catalog. Browser interruption automatically rolls the transaction back. A hidden filesystem epoch rejects commits after concurrent writes; native writers are gated during preflight/commit. Internal records never appear in virtual file listings. QID revisions preserve the installed question/block order, immutable identity and choices/answer mappings; legacy progress requires unchanged canonical blocks/assets. Existing scores, attempts, suspended state and cloud lineage survive. Incompatible forms are reported individually while other eligible forms install.

Installation receipts queue at `progress/backups/FORM_UPDATE_RECEIPTS.json` (excluded from portable Progress/Library exports), with install-time Worker auth context kept separately in sync metadata. The backend derives signed-in identity from its sessions, never from a supplied email. Anonymous reports carry an editable browser label. Reports are idempotent per installation/form/revision.

Settings → Admin uses the Worker secret `EXAM2_ADMIN_PASSWORD`, independent of Gmail. An opaque browser token persists in local sync metadata; only its hash is stored in D1. Grants never expire automatically. Lock clears all open tabs and revokes this grant; offline revocation queues until reconnect. Password attempts are rate limited. Neither the password nor tokens belong in checked-in/public files or portable/cloud backups. Update availability is network-only and is never an offline service-worker fallback.

Production setup is pending: run the additive SQL on AUTH_DB, set the secret to the user's supplied password, deploy the complete Worker, and enable the prepared Pages workflow. Follow `UPDATE_SETUP.md`.

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

Newest first, compact. Full history (64 rows from 2026-08-12 plus releases 22–34 notes): `../_archive_2026-10-27/handoffs_2026-11-10/IPAD_HANDOFF_full.md`.

| Date | Change | Files | Verification | Follow-up |
|---|---|---|---|---|
| 2026-11-10 | **iPad release 49: Rapid Review dark tabs + time spent.** Dark theme: section tabs (Overview/Options/Stem/Topic) get a white outline, white bold labels and a cyan active tab, matching the exam's explanation tabs; "Time spent" is larger and bold like the explanation header (`rapid-review.js` CSS only; mirrored to Local). Version 49 also carries release 48 (ThunderShadow files + Sync v3, same commit). Suites: iPad 298/299 (known `publisher validates`), Local only the known CKNotes4 fixture failures; all.sh 12/12 file runs pass. |
| 2026-11-10 | **iPad release 48: ThunderShadow log in progress + Sync v3.** The log is now one file per form, `progress/<id>_shadow_log.json` in the browser library (same path as Local's `DATA/progress/`), canonical JSON, merged per form/attempt/question by `updatedAt` with delete tombstones; localStorage `ThunderShadowLog.v1` stays as cache and migrates into the files on first run. Files travel through Sync v3 as `v3.t.<id>.<sha16>.json` (merge, never replace; two devices converge to one object; a copy that fails to download/validate is never removed). New Settings → Appearance "ThunderShadow" switch (`#tslSetSwitch`) beside the exam-menu row, same key `ThunderShadowLog.off`. TSV unchanged. | `shadow-logger.js` (shared copy), `js/sync3-drive.js` (`N.shadow`, `parseName`), `js/sync3-sync.js` (`syncShadow`, `createCycle({shadow})`), `js/sync3-bridge.js` (`createShadowAdapter`), `js/sync3-boot.js`, `tests/sync3-shadow.test.cjs`, `tests/support/shadow-env.cjs`, release files | iPad suite 297/298 (pre-existing `publisher validates`); 11 new sync tests; Local logger tests 26; headless `v3-probe-shadowlogger` 54/54 on Local and iPad; `release.mjs --check`; all.sh (see the commit). | NOT checked: real iPad + keyboard, Modern dark, a real Qbank session, two real devices on a real Drive. Log files are not in Progress ZIP / Library ZIP (fixed file-name contracts) and survive "Delete progress". |
| 2026-11-10 | iPad release 47: ThunderShadow logger shipped (floating bar in Review, 13-column TSV, exam-menu switch; localStorage only). Commit `587f5f7`. | `shadow-logger.js`, `index.html`, `sw.js`, `app-update.js`, `tools/publish.mjs`, tests | shadow-logger unit tests 12, probe, all.sh | storage moved by 48. |
| 2026-11-08 | iPad release 46: explanation review round 2 published. 13 explanation files republished from ThunderReview `DATA/explanations` after the review pass (N-09 to N-16, F120-2019/2021/2023, UWSA2, UWSA3; batches 182–300, 1,337 items changed). Each has a new `updatedAt`, so Sync v3 moves the newer copy. No app code changed (release stamps only). | `update/explanations/*.json` (13), release files | `release.mjs --check`: 78 explanation files valid; unit suites 287/288 (pre-existing publisher test); all 13 pass `validate_rapid --v4`. | Not checked on a real device. Flash originals in `ThunderReview/DATA/review/backup/`. |
| 2026-11-07 | iPad release 45: Topic Book card edit published. All 56 explanation files republished and 22 forms' explanation files published for the first time (78 in `update/explanations/`), copied from ThunderReview `DATA/explanations` after the card edit stage (336 of 507 topic cards edited, 66 retags, 16 Fact lines corrected; gate passed, see `_draft_rapid_review/coverage/edit/`). … | `update/explanations/*.json`, release files | `release.mjs --check`: 78 explanation files valid; unit suites 287/288 (pre-existing publisher test); headless all.sh (see release commit). | ThunderReview backup before the edit: `ThunderReview/BACKUPS/before_card_edit_20261107_131345`. Not checked on a real device. |
| 2026-11-02 | **Built for release 44, NOT deployed:** Rapid Review explanation files now travel through Sync v3. Each local `explanations/<ID>.json` is also stored on the Drive as write-once `v3.x.<formId>.<key14>.<sha16>.json` = `{type:'step-sync3-explain', formId, key, sha, text}` (key = `updatedAt`, else `generatedAt`, 14 digits). … | `js/sync3-drive.js` (N.explain, parseName), `js/sync3-sync.js` (syncExplain, startExplain, createCycle `explain`), … | 9 new unit tests + 1 cycle scenario pass; all suites pass except the pre-existing publisher test; headless `v3-probe-rr3` 8/8 on iPad; … | Next: `node tools/release.mjs` on "deploy", then try it with two real devices. … |
| 2026-11-01 | iPad release 43: Settings → Appearance → Review screen gains a **Rule + Trap first** switch (off by default, key `stepRuleTrapFirst`). On, the Rapid rule and Trap tested blocks move above Correct Answer in every explanation that has them (NBME, Modern, phones; review and exam review); off restores the app's order. Implemented in `rapid-review.js` only (`placeRuleTrap`, idempotent so the observer does not loop). … | `rapid-review.js` (+ Local copy), release files | `release.mjs --check`; unit suites pass except the pre-existing publisher test; … | Local lane still fails as before (pre-existing). The probe is `Step Simulator/tools/headless/v3-probe-rf.js` (outside this repo). |
| 2026-10-30 | iPad release 42: Rapid Review goes live with data. `rapid-review.js` gains a fourth sub-tab **Topic** (shown only when `items[qid].topic` has a card in the file's top-level `topics` block; stays selected while paging, Overview on questions without a card; highlights per sub-tab; narrow panels stack labels and the table; card text escaped, only http(s) evidence links). … | `rapid-review.js` (+ Local copy), `update/explanations/*.json`, release files | `release.mjs --check`: 56 explanation files valid; iPad unit suites pass except the pre-existing publisher test; … | Cards come from `ThunderReview/DATA/topics/` (tag → write → `attach_topics.py`); republish a form's file after its cards change. |

### Earlier releases (one line each)

- 2026-10-25: iPad release 22, commit efc9169 (bug fixes: review incorrect tint, NBME review Prev/Next Block + counter replacing Lock, Score Report footer button + Home button, NBME calculator ×, …
- 2026-10-25: iPad release 23, commit 0b0b2cf (patient-chart v3 stem calibration: sub/sup 75 % with ±.5em offsets, centred / vitals cells never wrap, Medications subheading + list spaced as the …
- 2026-10-26: iPad release 24, commit 1d6c8d5 (Sync V3: merge-based Google Drive sync, per-device replicas of stamped units, automatic V2 -> V3 upgrade with archive + per-form fallback + restore + …
- 2026-10-26: Item code pill (NOT deployed; iPad shell prepared as release 26 by release.mjs; release 25 was a local run never deployed). New shared `item-code.js` (byte-identical Local/iPad, loaded …
- 2026-10-26 (item code, follow-up): pill restyled to the NBME header (square, 1px white border, shadow, hover #325b77, 16px bold) and also drawn in the Modern header (`ItemCode.pillHtml(true)` from …
- 2026-10-26: Linked-set pages (iPad release 27 with the item code pill, sync timing and form slots below). Abstract sets (passage pane left, items stacked on the right, any order) and sequential …
- 2026-10-26 (same release, from other chats): sync3-boot timed and tab-switch cycles at most every 2 h (`TIMED_EVERY_MS`), check every 15 min, leaving the tab pushes only when something is unsaved …
- 2026-10-26: DEPLOYED as iPad release 27 (commit 9c92d25, Publish workflow success). Live smoke OK: App version 27, live thunder-ui.js and index.html byte-equal to the repo. Contents: linked-set …
- 2026-10-26: audio / video exhibits (`MEDIA_AV_PLAN.md`, `MEDIA_JSON_SPEC.md`): `thunder-ui.js` only, not deployed; see the last section of `NBME_V2_HANDOFF.md`. Probe …
- 2026-10-26: DEPLOYED as iPad release 28 (commit 989c533, Publish workflow success). Live smoke OK: App version 28, live thunder-ui.js and sw.js byte-equal to the repo. Contents: audio / video …
- 2026-10-26: builder-form (ThunderFORMbuilder UWSA1) fixes, not deployed: audio/video never played because the form names files `DATA/assets/<file>` (no form folder); `hydrateAssetUrlsInBank(bank, …
- 2026-10-26 (2): linked sets from builder forms. `v215DeriveStimulus` (both HTMLs, end of `v215AnnotateQuestions`) turns an .abstract-box in every stem into abstractStimulusHtml and a vignette …
- 2026-10-26: DEPLOYED as iPad release 29 (commit 083f793, Publish workflow success). Live smoke: live thunder-ui.js, sw.js, index.html and bulk-import.js byte-equal to the repo. Contents: the two …
- 2026-10-26 (3): not deployed. (a) Media never played on the iPad because the form-ZIP import (`imgRx` in index.html, `COMPAT_IMAGE_RX` in Local) copied only images; audio / video extensions are now …
- 2026-10-26: DEPLOYED as iPad release 30 (commit e67dc3b, Publish workflow success). Live smoke: index.html, thunder-ui.js, sw.js, js/sync3-boot.js and js/sync3-sync.js byte-equal to the repo. …
- 2026-10-27: not deployed. (a) Delete progress on a SUSPENDED form came back at the next sync, two causes. V2 (`js/progress-sync.js`): Delete progress fires three delete events (progress file, …
- 2026-10-27: not deployed. Fixed Local import blocked with 'has existing progress and different question blocks' for text-only form revisions (C-EM-01, C-FM-04 etc.): `assessFormReplacement` …
- 2026-10-27: DEPLOYED as iPad release 31 (commit 829aebf, Publish workflow success). Live smoke: thunder-ui.js, sw.js, index.html and js/progress-sync.js byte-equal to the repo, live sw VERSION 31. …
- 2026-10-27: DEPLOYED as iPad release 32 (commit 3ba048c, Publish workflow success; live thunder-ui.js, sw.js, index.html byte-equal to the repo, live sw VERSION 32). Quick practice takes ZIP banks …
- 2026-10-27: iPad release 33. Settings > Appearance "Keep CMS forms open" switch (persisted); Library confirm/prompt dialogs (appDialog) restyled to the modern card and the device-wipe confirmation …
- 2026-10-27: iPad release 34. "Keep CMS forms open" now expands the CMS subject tiles without selecting the CMS forms button or filtering the list (pane shown when selected or kept open); Library …

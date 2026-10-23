# Simulator for iPad (`exam-simulator2`) — standalone handoff

Last inspected: 2026-10-24  
Effective simulator UI version: `A22.14` (final script in `index.html`)  
Cloud sync build: `EXAM-SIMULATOR2-PROGRESS-SYNC-V2.3.0`; app-shell release: numeric `VERSION` in `sw.js` (currently `3`)  
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

Keep newest entries first.

| Date | Change | Files | Verification | Follow-up |
|---|---|---|---|---|
| 2026-10-24 | Redesign Phase B (built, not deployed): start dialog (chosen blocks, per-block breaks), Quick practice, Add forms (Bulk ZIP moved out of Settings), Form updates popover; engine script `a23-phase-b-start-engine`; bridge `setup()` reads the A19.3 setup (`#a193NewAttemptSetup`, `a193Pool`, `a193Carry*`), which also fixes the Phase A sheet Retest tiles on iPad. | `index.html`, `thunder-ui.js`, `bulk-import.js`, `tests/form-updates.browser.cjs` | iPad 135/135; headless fa-ipad 12 and fb-ipad PASS. `form-updates.browser.cjs` updated (hidden legacy controls clicked through the DOM) but not run: Playwright not installed. | Run `node tools/release.mjs` + `--check`, commit and deploy when the user says "deploy". |
| 2026-10-24 | Deploy fixes for release 5: `tools/publish.mjs` copies an explicit file list, so `thunder-ui.js` was added to it (the first release-5 publish served it as 404); `tools/release.mjs` now skips hidden files (a Finder `.DS_Store` had entered the shell list and failed the CI release check). New test: every offline-shell file and every `<script src>` must exist in the published site. | `tools/publish.mjs`, `tools/release.mjs`, `sw.js`, `app-update.js`, `tests/app-shell-update.test.cjs` | iPad suite 135/135; the new test fails when `thunder-ui.js` is removed from the publish list. | Add any new root asset to `publicFiles` in `tools/publish.mjs`. |
| 2026-10-24 | Deployed iPad release 5: ThunderUSMLE redesign Phase 1 via the shared `thunder-ui.js` (see LOCAL handoff for the full list). iPad specifics: manifest/home-screen name ThunderUSMLE, theme color #A2283A, `icons/icon-192/512.png` replaced (full-bleed for iOS masking) plus `icons/thunder/*` per accent (apple-touch-icon follows the accent; iOS keeps the icon from when the app was added). Library header keeps the `#googleBackupStatus` pill (tone-coloured) and the form-updates toolbar (Add form / Check for updates / More) in one row; the collapsible tab strip keeps its Show all tabs toggle. Backup & sync is reordered with CSS `order` (no nodes moved): Library on this iPad (new, proxies Rescan/Start storage), Google Drive progress sync, Full library backup, then Recovery, Backup history and Advanced sync tools collapsed, and a new Move between devices card whose buttons click the existing export/import buttons. | `thunder-ui.js`, `index.html`, `manifest.webmanifest`, `icons/`, `sw.js`, `app-update.js` (release tool) | iPad suite 134/134; `release.mjs --check` passes; headless checks: Resume strip → exam, Check for updates, sync order/collapse/proxies, sync pill → panel, Settings Appearance/Admin tabs, QID card only under Backup; no horizontal scroll at 1180×820. | Phase 2 and 3 as in `../REDESIGN_BUILD_HANDOFF.md`. |
| 2026-10-23 | Deployed iPad release 4 (commit `cf6f36d`, on top of GitHub's 20 older uploads) and switched GitHub Pages to build from GitHub Actions (user-approved); the workflow passed and the live site was smoke-tested. Redesign build paused at the start of Phase 1; see `../REDESIGN_BUILD_HANDOFF.md`. | Git/Pages only | Actions build+deploy succeeded; live sw VERSION 4, manifest served, fixes present. | Cloudflare Worker setup (`UPDATE_SETUP.md`) still pending for receipts/Admin. |
| 2026-10-23 | Shared retest/new-attempt position-mapping fix (see LOCAL handoff): `a193SessionMappings`, `a193AnchorDirect`, `v16SessionMappings`, `v191AnchorFallback` and the v9/v10/v10.3 pool builders read progress through `StepQidMigration.bankOrderedSession`; new sessions record `positionQuestionKeys`; shuffled resume converts legacy JSON-block indexes. Exam Dark Mode explanation headings fixed. | `index.html`, `js/qid-migration.js`, parent shared tests, both handoffs | iPad 134/134, LOCAL/shared 46/46; Chrome: shuffled attempt pools matched shown questions. Not deployed. | Run `node tools/release.mjs` before the next deploy (the service worker caches `js/qid-migration.js`). |
| 2026-10-23 | Answer-change audit fix (shared with Local): a revealed item (Tutor Submit or Show Explanation) keeps its answer, so post-explanation clicks are no longer logged as changes or scored. | `index.html`, parent `tests/exam-session-tools.test.cjs`, both handoffs | iPad 134/134 and LOCAL/shared 35/35 passed; browser probe confirmed. Not deployed; `node tools/release.mjs` still required before the next Pages deploy. | Older saves keep any post-reveal changes already recorded. |
| 2026-10-23 | Added iPad-only commit-pinned form distribution from ordinary folders + simple TXT tab/update/skip rules; compact library toolbar, byte progress, checksum/staging/recovery and atomic IndexedDB commit; compatible-revision protection, queued install receipts, persistent browser Admin with cross-tab/offline Lock. Supplied complete additive shared Worker/D1 setup and Pages publisher. | `js/form-updates*.js`, `js/form-update-store.js`, `index.html`, shared `bulk-import.js`, sync gates, `backend/`, publisher/workflow, privacy/setup docs, tests | Shared/Local 33/33 and iPad 134/134 passed; existing disposable Local/iPad browser regressions and new updater/Admin Chromium scenarios passed; release 3 coordinated. Local fixture preserved. | Deploy Worker SQL/secret/source and enable GitHub Actions using `UPDATE_SETUP.md`; physical iPad and actual production OAuth/rollout remain device checks. No live deployment or Drive changes. |
| 2026-10-23 | Corrected the audit definition to include any actual revision, even when the final choice equals the first. Added visible Correct → Correct counts; Incorrect → Incorrect includes both different wrong choices and returns to the same wrong choice. Each revised question counts once; initial selection alone does not. New result JSON marks round trips as changed, and reports can recognize them in existing per-answer logs without rewriting saved files. | Simulator HTML, `tests/exam-session-tools.test.cjs`, `tests/browser-regressions.cjs`, coordinated app-shell release 2 | LOCAL/shared 33/33 and iPad 122/122 passed; browser checks cover all four categories, unchanged answers, report counts, and exported JSON. | Old saves without a change log cannot prove a return to the original answer. |
| 2026-10-23 | Fixed sitting/block answer-audit hydration and session tagging, Lock/Resume timing, prefixed result filenames, non-modal autosaved Notes/Keep notes open, and first-tab bulk folder ZIP import with preflight/recovery/rollback. Added independent release-numbered app-shell updates, generated versioned URLs/SHELL, save-before-reload notice, exact-scope Reload latest version, and 30-minute foreground checks. Guarded legacy v16 attempt listeners against out-of-scope activeRunContext on Resume/Review. | `index.html`, `sw.js`, `app-update.js`, `tools/release.mjs`, `bulk-import.js`, `exam-notes.js`, `manifest.webmanifest`, `js/progress-sync.js`, tests/readme, both handoffs | iPad 122/122 and LOCAL/shared 31/31 passed. Disposable Chrome browser verified native IndexedDB form/assets, durable note/audit suspend/resume, all pause clocks/untimed Lock, cached-script reload, release update notice/new assets, offline launch, escape-hatch preservation of another app’s cache/localStorage/IndexedDB/worker and saved exam progress, plus portrait layout. | Before every deploy run `node tools/release.mjs`; current prepared shell release is 2. Physical iPad/Safari and actual Pages rollout remain manual; no deployment or live Drive changes were made. |
| 2026-09-10 | Replaced iPad favicon, Apple touch, installed-PWA, and sidebar brand assets with the supplied red exam-card artwork at native 192/512 sizes. Advanced the icon URL cache key across HTML, manifest, and service-worker shell entries; exam toolbar icons remain unchanged. | `index.html`, `manifest.webmanifest`, `sw.js`, `icons/*.png`, `HANDOFF.md` | PNG dimensions/alpha, cache-key parity, manifest/SW syntax, inline-script parsing, and iPad regression suite verified. | Refresh once; if the installed home-screen icon remains stale, reinstall the PWA so iPadOS refreshes it. |
| 2026-08-12 | Fixed Quick Import New Attempt Setup Dark Mode: retest/new-attempt cards, counts, pool choices, carry-forward chips, context/notes, available-question panels, and disabled/hover states now use readable dark surfaces and semantic contrast. | `index.html`, `HANDOFF.md` | All inline scripts parsed; final New Attempt dark-mode override layer detected. | Manually start a new attempt from a loaded form while menu Dark Mode is enabled. |
| 2026-08-12 | Improved Dark Mode contrast for Form Library card category chips and color indicators, including NBME/OBGyn/IM-style tab identity chips. Chips now use readable dark surfaces, bright borders, shadow separation, and clearer category dots while preserving each tab’s accent color. | `index.html`, `HANDOFF.md` | All inline scripts parsed; final category-chip dark-mode override layer detected. | Manually inspect cards from several colored categories in iPad Dark Mode. |
| 2026-08-12 | Added clearer context to New Attempt Setup when launching a form attempt: the card identifies the selected form, names the source attempt when available, explains that it remains untouched, and states that the new attempt is separate. Added matching light/dark context styling. | `index.html`, `HANDOFF.md` | All inline scripts parsed; browser loaded iPad setup and detected the context style layer. | Manually open New Attempt Setup from a populated Form Library form and confirm the selected-form/source copy. |
| 2026-08-12 | Improved menu Dark Mode contrast for Recently Completed Forms and Test Setup: workflow/recent cards, completed-form rows, dates/scores, setup switches, inputs/selects, bank status, save status, and block tables now use consistent dark shading and readable semantic colors. | `index.html`, `HANDOFF.md` | All inline scripts parsed; iPad browser loaded the final scoped override layer and verified the Test Setup card computed to a dark surface. | Manually inspect a populated Recently Completed Forms card and Test Setup after toggling menu Dark Mode. |
| 2026-08-12 | Fixed iPad Dark Mode for the Google Backup Full Form Library Backup transfer card, including transfer progress, notes, messages, and controls. Also styled expanded “show more” Recovery and Backup History disclosures, summaries, and nested rows with dark surfaces and readable contrast. | `index.html`, `HANDOFF.md` | Fresh-origin browser check detected 17 scoped backup/recovery dark rules; toggled iPad menu dark mode and verified the Full Form Library Backup card computed to a dark surface. | Manually expand populated older Recovery and Backup History groups on iPad Safari. |
| 2026-08-12 | Updated the iPad Form Library disclosure so “Show all tabs” is hidden when the tabs fit within the collapsed strip, and shown only when the strip overflows into additional rows. The check runs after layout and after resize/paint timing. | `index.html`, `HANDOFF.md` | Fresh-port browser test: control hidden when no overflow; visible for 12 tabs when strip scroll height exceeded its collapsed height (182px vs 174px). | Manually rotate/resize Safari and confirm the control updates after orientation changes. |
| 2026-08-12 | Made every iPad Form Library tab use a fixed compact width instead of flex-growing on shorter rows, so Neuro and subsequent tabs match the earlier rows exactly. | `index.html`, `HANDOFF.md` | Browser verified all 12 rendered tabs use `flex: 0 0 124px` and a uniform 124px width, including Neuro. | Manually inspect the expanded tab grid at the target iPad orientation. |
| 2026-08-12 | Made only the iPad Form Library tabs approximately 20% more compact: reduced tab height, internal spacing, meter widths, NBME ring/score sizing, tab gaps, and the expand/collapse control. Local and other iPad surfaces were not changed. | `index.html`, `HANDOFF.md` | iPad inline scripts parsed; browser found 12 Form Library tab pills and measured the compact override at 66px minimum height with reduced padding. | Manually inspect the expanded tab list on a physical iPad/Safari width. |
| 2026-08-12 | Fixed the Answer Change Audit card in exam Dark Mode: dark audit surface, readable heading/note, high-contrast metric boxes, and distinct Correct→Incorrect, Incorrect→Correct, and Incorrect→Incorrect colors. | `index.html`, `HANDOFF.md` | All inline scripts parsed; browser loaded iPad and detected four audit-related dark CSS rules. | Check the audit card in a completed test with answer changes. |
| 2026-08-12 | Strengthened exam Dark Mode contrast for explanation headings, left Question Status rows/dots, correct-answer feedback and time box, saved highlights, and the modern Score Report (rings, tabs, sort controls, tables, and status pills). Added a final scoped override layer so older late-loaded exam CSS cannot wash these surfaces back to light colors. | `index.html`, `HANDOFF.md` | All inline scripts parsed; browser loaded iPad and found the final contrast layer plus 61 scoped exam-dark rules. | Manually inspect a populated dark-mode completed report and highlighted explanation. |
| 2026-08-12 | Added optional exam-screen Dark Mode in Settings, separate from Reverse Color. It uses a non-inverting dark palette with readable contrast across the question workspace, answers, Qbank, explanations, review/report tables, break screen, and exam chrome; Review explanation layout remains available in the same modern menu. | `index.html`, `HANDOFF.md` | All inline scripts parsed; browser loaded iPad successfully and verified the scoped dark-mode stylesheet, exam-screen hooks, and 17 exam-only selector groups. | Manually toggle Exam Dark Mode during a populated iPad block and check Split/Below explanation layouts. |
| 2026-08-12 | Fixed the remaining dark-mode gaps for QID Migration & Compatibility and incomplete Form Library progress bars. QID cards, warnings, audit tables/statuses, and progress tracks now use dark surfaces with readable semantic colors. | `index.html`, `HANDOFF.md` | Browser smoke verified QID card/warning dark styling; progress-track dark styling is scoped to `.v75-progress`; iPad inline scripts parsed. | Manually inspect a connected populated iPad Form Library with an incomplete form. |
| 2026-08-12 | Completed dark-mode coverage for Qbank Mode and all nested Settings navigation/content tabs, including Qbank metrics, form options, warnings, Settings rows, order/color tools, custom-tab tools, safety/default cards, and backup controls. | `index.html`, `HANDOFF.md` | Browser smoke verified iPad Qbank and Settings surfaces with dark backgrounds/readable text; iPad inline scripts parsed. | Manually inspect populated Qbank test cards if test history is available. |
| 2026-08-12 | Expanded dark-mode coverage across Settings cards/rows, Quick Import panels and controls, Form Library cards/metrics/stickers/more menus/tabs, and the top menu hero/status strip; preserved the exam interface unchanged. | `index.html`, `HANDOFF.md` | Browser smoke verified dark backgrounds and readable text for Quick Import, Form Library tabs, and Google Backup; confirmed `#examScreen` remains unchanged; inline scripts parsed. | Manually inspect a populated iPad Form Library card with 3-digit score and progress stickers. |
| 2026-08-12 | Added persistent Light/Dark mode for non-exam surfaces only. The theme toggle covers menu, Form Library, Settings, Qbank, Google Backup, recovery/history, and library backup cards; `#examScreen` remains unaffected. Local and iPad preferences use separate storage keys. | `index.html`, `HANDOFF.md` | iPad inline scripts parsed; browser smoke verified light/dark menu and Google Backup contrast and confirmed the exam background remains unchanged. | Reload the iPad PWA and confirm the preferred menu theme persists. |
| 2026-08-12 | Added compact iPad disclosures: Form Library tabs show two rows with a modern expand/collapse chevron; Recovery shows one newest Cloud and Local item with older entries expandable; Backup History shows one newest Daily and Manual snapshot with older entries expandable. | `index.html`, `js/progress-sync.js`, `HANDOFF.md` | External JS/SW syntax, 36 inline scripts, and the full iPad suite passed 118/118. | Manually verify tab expansion and Recovery/History disclosure actions on Safari/iPad with populated data. |
| 2026-08-12 | Fixed iPad icon resolution by adding an explicit favicon, versioned `./icons/...` references for the favicon/sidebar/manifest, and matching service-worker cache entries. | `index.html`, `manifest.webmanifest`, `sw.js`, `HANDOFF.md` | Confirmed both PNG assets are readable and valid; manifest JSON and all 36 inline scripts parsed successfully. | Refresh or reinstall the iPad PWA once so the versioned icon assets replace any stale cached references. |
| 2026-08-12 | Replaced only the left-sidebar brand `S` beside “Step Exam Simulator by Bladelord” with the supplied STEP logo; all other toolbar and navigation icons remain unchanged. | `index.html`, `icons/icon-192.png`, `HANDOFF.md` | iPad inline scripts parsed and scoped brand-mark reference verified. | Refresh the iPad PWA/service-worker cache to confirm the sidebar logo. |
| 2026-08-12 | Replaced the iPad PWA app icons with the supplied STEP artwork: `icon-192.png` was generated from the supplied 256px asset and `icon-512.png` uses the supplied 512px asset. Exam toolbar `ui_icons` were left unchanged. | `icons/icon-192.png`, `icons/icon-512.png`, `HANDOFF.md` | Verified PNG dimensions, manifest references, and service-worker shell references. | Refresh the installed iPad PWA/service-worker cache to see the new icon. |
| 2026-08-12 | Compacted the Recovery card to show only the two newest cloud and local recoveries by default; older entries are manually expandable under modern disclosure panels, while totals and all actions remain available. | `js/progress-sync.js`, `HANDOFF.md` | External syntax and inline script parsing passed; full iPad regression suite passed 118/118. | Manually verify expansion and restore/delete actions with more than two recoveries in each section. |
| 2026-08-12 | Recovery card now shows saved item counts and byte totals for Previous Cloud Recovery and Previous Local Recovery, plus visible retention rules. Cloud keeps one prior version per item and trims it after the next successful item backup; local keeps one per item until replaced, restored, or manually deleted. | `js/progress-sync.js`, `HANDOFF.md` | External JS syntax, 45 inline scripts parsed, and targeted iPad UI/schema tests passed. | Full iPad suite and a manual recovery restore/delete check remain recommended. |
| 2026-08-12 | Added a light-red `Clear Extra Cloud Data` button to the Full Form Library Backup card. It compares cloud library paths with the authoritative IndexedDB library, verifies a cleaned manifest before deleting unreferenced managed Drive files and stale duplicate library manifests, and leaves local data unchanged. | `js/library-backup.js`, `HANDOFF.md` | iPad external syntax, inline script parse, and regression suite run after the change. | Manually test with a disposable cloud backup containing an extra managed file; confirm cancellation and cleanup-warning behavior. |
| 2026-08-12 | Made completed-attempt Review genuinely read-only for cloud state. Opening, navigating, leaving, backgrounding, or sync-flushing a passive review no longer writes progress; read-side A20/v16 normalization is held in memory. Adding or removing a stem/explanation highlight explicitly authorizes one durable write, while answers, suspend, new/retest starts, and other genuine mutations retain normal persistence. | `index.html`, `tests/review-readonly-cloud.test.cjs`, `HANDOFF.md` | Added guard/annotation/read-side regressions; inline scripts and the complete iPad suite run after the change. | Manually verify Google Backup stays Synced through passive review, then becomes Local Changes after adding/removing a review highlight. |
| 2026-08-12 | Fixed JSON/ZIP single-form replacement so a canonical migrated LOCAL form retains its validated `formUid`, `qidSchemaVersion`, and `legacyBankHashes` after iPad normalization/reconstruction. Multi-file combinations do not inherit one source identity, and incomplete/invalid QID metadata is not promoted. | `index.html`, shared `js/qid-migration.js`, LOCAL importer parity, compatibility/shared tests, both handoffs | Added pure carry-forward and importer-wiring regressions; combined LOCAL and full iPad suites run after the change. | Replace the affected iPad form again from the canonical LOCAL JSON, then Scan Forms and confirm MIGRATED. |
| 2026-08-12 | Fixed the shared migration safety invariant so newly assigned per-question `qid` fields are accepted as identity metadata while all substantive question/progress content remains protected. | `js/qid-migration.js`, LOCAL `qid-migration.js`, shared QID tests, both handoffs | Added a regression proving QID-only form migration passes while a stem change fails; shared and full iPad suites run after the change. | Import the canonical LOCAL Full Library and Portable Progress; do not independently generate iPad QIDs. |
| 2026-08-12 | Kept iPad QID identity behavior in parity with LOCAL: unmigrated copied/backup forms now derive their one-time `formUid` from the distinct catalog record ID instead of an inherited internal form ID, while existing explicit `formUid` values still fail closed on real collisions. The audit table and blocker alert now expose exact error details. | `js/qid-migration.js`, `js/qid-settings.js`, LOCAL `qid-*.js`, shared QID tests, both handoffs | Shared and full iPad regression suites run after the change; LOCAL/iPad migration/settings files remain byte-identical. | Distribute the canonical LOCAL Full Library and Portable Progress to iPad rather than independently migrating the iPad library. |
| 2026-08-12 | Restyled the Score Report sorting controls with a modern sort bar, added independent Ascending/Descending selection, and simplified sort options to field names only. | `index.html`, `HANDOFF.md` | External syntax, inline script parse, and iPad regression suite run after the change. | Perform a manual browser check of both sort selectors on a multi-block completed test. |
| 2026-08-12 | Added Score Report question sorting by Test order, Status, Time taken, or Subject; sorting reorders rows within every block while preserving each Review action. | `index.html`, `HANDOFF.md` | External syntax, inline script parse, and iPad regression suite run after the change. | Perform a manual browser check of each sort mode on a multi-block completed test. |
| 2026-08-12 | Added per-question time-taken columns to the Score Report and block-complete table, plus an adjacent incorrect-only JSON export. Incorrect exports are sorted by block/item test order, retain original numbering, and add 1-based `incorrectNumber` values. | `index.html`, `HANDOFF.md` | External syntax, inline script parse, and iPad regression suite run after the change. | Perform a manual completed-test export check in the browser library build, including a test with no incorrect answers. |
| 2026-08-12 | Added a reusable sealed multi-device Mock Drive/Auth harness with machine-readable operations and deterministic upload/download/manifest/delete/auth/corruption faults; added stale-clean/dirty, offline/auth recovery, failed transaction, idempotency, checksum corruption, QID-set compatibility, cross-revision, snapshot verification, debounce/priority, and 100 seeded classifier scenarios. Repaired cloud restore/snapshot validation to recompute payload checksums and reject size/hash mismatches before writes, and repaired cross-bankHash QID compatibility to validate incoming QIDs against the installed catalog before applying progress. | `js/progress-sync.js`, `js/sync-storage.js`, `tests/autonomous-sync-safety.test.cjs`, `tests/support/autonomous-harness.cjs`, `HANDOFF.md` | Full mocked iPad suite passes 115/115; external JS/SW syntax passes. In-app browser smoke passed at 768×1024 and 1024×768 with Google Backup, Full Library, and all six QID/baseline controls accessible, zero page overflow, and zero console errors. | Real OAuth/Drive, true network interception, large resumable-library fault injection, and physical iPad/PWA lifecycle behavior remain manual/next-phase gates; never run destructive faults on production Drive. |
| 2026-08-12 | Released QID-aware V2.3.0 identity/migration and safe automatic sync: stable formUid entities, immutable QIDs, opaque progress revisions/parents, clean cloud auto-restore with local recovery, 2s/5s checkpoints plus dirty-again follow-up, exact progress byte UI, one rolling daily snapshot, explicit post-migration cloud baseline, and verified/awaited Full Library mirror cleanup limited to managed `LIB_..._exam-simulator2_` files. | `index.html`, `manifest.webmanifest`, `sw.js`, `js/qid-*.js`, `js/sync-{config,merge,storage}.js`, `js/progress-sync.js`, `js/library-backup.js`, `tests/*.test.cjs`, reports/readme, `HANDOFF.md` | External JS/SW syntax and all inline scripts parse; full mocked iPad suite and shared QID suite pass, including fresh/stale/divergent, race, rolling snapshot, dirty-again, legacy hash mismatch, Qbank/retest mapping, and library mirror policy coverage. | Deploy and test one disposable canonical migration/baseline, then Device 1 → fresh Device 2 → stale Device 3 on real iPad/Drive before production use. |
| 2026-08-12 | Recorded adoption of the existing iPad Portable Progress and Local Library ZIP contracts by Simulator LOCAL. No iPad runtime code changed. | `HANDOFF.md` | iPad external JS/SW syntax passed; existing suite remained 26/27 plus both other test files passing, with only the known real-date daily-snapshot failure. LOCAL contract tests passed 6/6. | Keep these archive contracts backward compatible; test transfer in the order Library then Progress. |
| 2026-08-12 | Clarified that the parent LOCAL `CKNotes4` fixture is unrelated to iPad runtime data. No runtime behavior changed. | `HANDOFF.md` | Cross-checked the documented IndexedDB/browser-library authority and standalone scope. | Keep LOCAL fixture details out of this handoff unless the runtime gains an explicit migration feature. |
| 2026-08-12 | Created standalone iPad architecture/storage/sync/deployment handoff after full source, report, and test inspection. No runtime behavior changed. | `HANDOFF.md` | External JS/SW syntax passed; regression run produced 26/27 sync scenarios plus both other test files passing. | Make the daily snapshot test use an injected/fixed clock; align stale `V2.2` metadata labels with runtime `V2.2.4` when intentionally releasing. |

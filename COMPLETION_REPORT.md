# exam-simulator2 — Cloud Production Completion Report

Build: `EXAM-SIMULATOR2-CLOUD-6`

## Architecture preserved

- Existing simulator IndexedDB / DATA abstraction remains authoritative for runtime use.
- Main browser library DB remains `StepExamSimulatorV784_A4_iPadBrowserLibrary_DB`.
- DATA-handle DB remains `StepExamSimulatorV75_DATA_Handle_DB`.
- Existing form/progress JSON structures, attempts, highlights, Qbank behavior, scoring, settings, and manual import/export remain intact.

## Added cloud architecture

- Shared OAuth Worker: `https://study-tools-auth-worker.summerofdawn20.workers.dev`
- `app_id`: `exam-simulator2`
- return URL: `https://dawnsommer.github.io/exam-simulator2/`
- Google scope: `https://www.googleapis.com/auth/drive.appdata`
- Drive payloads remain browser ↔ Google Drive directly; Worker handles authentication/token refresh only.
- Opaque Worker session is persisted in `ExamSimulator2_SYNC_META_DB`.
- Short-lived Google Drive access token is memory-only.
- Drive HTTP 401 refreshes via Worker and retries once; 403 does not automatically discard the Worker session.

## Progress backup

- Tiny manifest: `exam-simulator2.manifest.json`
- One hidden Drive backup file per form/version (`formId + bankHash` identity).
- Qbank progress has its own backup entity.
- Existing progress is serialized losslessly; highlight anchors are preserved.
- Manually entered 3-digit score travels with that form's progress backup.
- Routine exam activity saves locally immediately and marks the affected form dirty.
- Cloud uploads are checkpoint/debounce-driven, not tied to every answer/highlight.
- Empty/missing local data is never treated as a delete.
- Explicit delete/reset while cloud backup is enabled creates a tombstone.
- Same-form cloud/local divergence is conflict-guarded rather than blindly overwritten.
- Restore is explicit and creates a local recovery checkpoint first.

## Full Form Library backup

- Separate manual system from progress backup.
- Backs up non-progress DATA files such as `catalog.json`, `forms/`, `assets/`, and other library files.
- Library manifest: `exam-simulator2.library.manifest.json`.
- Resumable/chunked uploads and range downloads.
- Progress UI includes percentage, bytes, current file, speed, ETA, Pause, Resume, and Cancel.
- Large payloads transfer directly between browser and Google Drive.
- Restore writes directly into the browser/IndexedDB-backed library.
- `catalog.json` is restored last.
- After successful restore, obsolete non-progress local library files are pruned; `progress/` is preserved.
- Normal library backup keeps the latest committed manifest/file set and asynchronously removes superseded Drive file objects.

## PWA / caching

- Service-worker build: `EXAM-SIMULATOR2-CLOUD-6`.
- Cache namespace: `exam-simulator2-*`.
- Cache/service-worker reset code is scoped to `/exam-simulator2/` and no longer clears unrelated GitHub Pages apps.
- Core cloud JS and manifest are network-first to reduce stale PWA code.
- Worker token/disconnect POST responses and Drive payloads are not application-shell cached.

## Tests actually performed in the build environment

- `node --check` passed for every external cloud JS module and `sw.js`.
- All 33 inline scripts in `index.html` passed JavaScript syntax validation.
- Final production index was diffed against the uploaded source; only intended cloud/storage hooks were added/changed.
- Static scan confirmed no GIS `initTokenClient`, Google OAuth client ID, or old browser-only Google auth remains.
- Mocked Worker OAuth lifecycle passed:
  - `#cloud-auth` capture
  - immediate URL-fragment removal
  - persistent Worker-session storage
  - `/token` access-token acquisition
  - Drive 401 → one refresh → one retry
  - account-email capture
  - device-local `/disconnect`
- Synthetic cloud serialization/restore round-trip passed for answers, flags, strikeouts, 3-digit score, stem highlight anchors, and explanation highlight anchors.

## Deployment tests still required

The build environment cannot complete a real Google OAuth/PWA flow for your account. After deployment, verify:

1. Google Cloud OAuth Web Client includes exact redirect URI:
   `https://study-tools-auth-worker.summerofdawn20.workers.dev/oauth/callback`
2. Connect once → Worker callback returns → `#cloud-auth` disappears.
3. Reload → no Google consent prompt.
4. Close/reopen Safari and installed iPad PWA → Worker session silently obtains a fresh Drive access token.
5. Back up and restore a disposable form.
6. Back up and restore a disposable full library and confirm old non-progress library storage is pruned while progress remains.
7. Test Mac + iPad multi-device discrepancy/conflict behavior before relying on the production cloud copy.

## EXAM-SIMULATOR2-CLOUD-6 UI update

- Progress Backup conflicts now render as a dedicated action-needed notification card instead of adding a destructive Replace-Cloud button to the normal action row.
- During a conflict, the card offers two explicit directions: **Keep This Device → Cloud** or **Use Cloud Backup → This Device**. The standard row is reduced to Check Again / Disconnect until the conflict is resolved.
- The Form Library persistent toolbar is reduced to four top-level controls in one compact row: **Add New Form**, **Progress**, **Update App**, and **Others**.
- Progress contains Import Progress File / Export Progress File. Others contains storage connection/refresh, catalog write, and full-library import/export.
- Added a clickable **Google Backup** status pill to the left of the existing local library status. It follows the real sync state event and opens Progress Backup when tapped.
- Cloud status labels include Synced, Syncing/Connecting, Pending, Conflict, Cloud Available, Offline, Reconnect, Error, and Off.
- Qbank's pool/source line is now stacked below the available-question count so `Qbank · Unused` no longer competes for horizontal space.


## EXAM-SIMULATOR2-CLOUD-6 structural Library fix
- Removed the CLOUD3 interval mutation and CLOUD4 menu-panel reparenting patch.
- Persistent Workflow remains a true 50/50 right-side column beside Recently Completed Forms at iPad/desktop widths; stacking occurs only below 620 CSS px.
- Progress and Others are native collapsed `<details>` menus again. Their panels remain children of the menu and use fixed positioning only while open, preventing inline-button clutter and lower-card clipping.
- No sync/storage/auth logic changed in this patch.

### Internal validation for CLOUD-5
- `node --check` passed for all cloud JS modules and `sw.js`.
- All 35 inline scripts in `index.html` passed `node --check` after extraction.
- Headless Chromium layout harness at an iPad-class width verified:
  - Recent Completed Forms and Persistent Workflow render on the same row.
  - Computed columns are approximately 50/50.
  - Workflow action bar uses `flex-direction: column`.
  - Closed Progress/Others dropdowns expose zero visible option buttons.
  - Open Progress dropdown exposes only its intended options and uses `position: fixed` with top-level z-index `2147483001`.
- Previous CLOUD3 interval layout mutation and CLOUD4 DOM-reparenting dropdown code are absent.


## CLOUD-6 conflict resolution fix
- Fixed acknowledged cloud deletion tombstones being reclassified as cloud-newer after **Keep This Device → Cloud**.
- Conflict resolution now enters an explicit busy state while Drive work is in flight.
- **Use Cloud Backup → This Device** now restores only the currently conflicting form(s), not every matching cloud backup.
- After either conflict choice, known-cloud lineage, dirty flags, deletion tombstones, protected-delete state and hashes are reconciled before the final analysis.
- Regression tests covered keep-local deletion, cloud restore, and scoped cloud restore with an unrelated dirty form.

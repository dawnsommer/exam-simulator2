# exam-simulator2 — Cloud Production Completion Report

Build: `EXAM-SIMULATOR2-CLOUD-1`

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

- Service-worker build: `EXAM-SIMULATOR2-CLOUD-1`.
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

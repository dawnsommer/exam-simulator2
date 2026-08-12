# exam-simulator2 — QID + Safe Automatic Progress Sync V2.3 Production Build

Build: `EXAM-SIMULATOR2-PROGRESS-SYNC-V2.3.0`

Production URL: `https://dawnsommer.github.io/exam-simulator2/`

## Architecture

- IndexedDB / the simulator's existing DATA abstraction remains the runtime source of truth.
- Google Drive `appDataFolder` stores active progress as a small V2 manifest plus immutable per-form/version payloads.
- Form identity is stable `formUid`; immutable question identity is `qid`; `bankHash` is form-revision metadata. Qbank is an independent sync entity whose migrated references use `formUid::qid`.
- The shared Cloudflare Worker handles OAuth/session/token refresh only.
- Normal Drive payload traffic remains browser ↔ Google Drive.
- Full Form Library cloud backup is separate from progress sync and remains manual/resumable.
- Local Progress Backup and Local Library Backup are separate portable systems. Cloud lineage is never exported in a portable progress file.
- Full Library cloud backup is a verified mirror: its manifest is committed and re-read before awaited cleanup of old managed `LIB_..._exam-simulator2_` files.

## Google Cloud requirement

The OAuth Web Client used by the shared Worker must include this exact Authorized redirect URI:

`https://study-tools-auth-worker.summerofdawn20.workers.dev/oauth/callback`

Production cloud configuration:

- `app_id`: `exam-simulator2`
- return URL: `https://dawnsommer.github.io/exam-simulator2/`
- Drive scope: `https://www.googleapis.com/auth/drive.appdata`
- Drive prefix: `exam-simulator2`

## V2 safety rule

Automatic Local → Cloud replacement is allowed only when the local entity's `baseCloudVersionId` still equals Drive's `currentVersionId`.

If another device advanced Drive, the app classifies the state as Cloud Newer / Conflict and requires an explicit direction. Timestamps are informational only.

Clean cloud-only/cloud-ahead progress can restore automatically when there is no conflict and no active exam; the app creates a local recovery first. A QID migration sets a baseline-required marker that blocks ordinary cloud sync until **Establish New Cloud Baseline** verifies both Full Form Library and current progress.

## Production verification after upload

Use a disposable test form first:

1. Open the production Pages URL and verify the simulator/library works before connecting Google.
2. Open Google Backup and connect Google once.
3. Verify the Worker callback returns and the URL fragment disappears.
4. Reload/reopen and confirm the Worker session restores without a new consent prompt.
5. Device 1: make progress and use Back Up Now. Verify status returns to Synced.
6. Fresh Device 2: restore the Full Form Library and verify clean cloud progress restores automatically rather than being overwritten by empty local state.
7. Stale Device 3: confirm a clean cloud-ahead revision restores automatically with a local recovery, while a truly divergent edit remains an explicit conflict.
8. Create a true divergent edit on two devices and verify the Local-vs-Cloud conflict prompt.
9. Test Previous Cloud Recovery and Undo Last Cloud Restore with disposable data.
10. Export/import a Progress Backup and verify cloud lineage is not inherited.
11. Export/import a Library Backup and verify existing progress/3-digit scores remain intact.
12. Test Full Form Library cloud backup separately, including pause/resume/cancel if desired.
13. On disposable data, run the QID Settings migration on one device, verify ordinary sync is blocked, establish the new cloud baseline, and verify the marker clears only after library/progress alignment.

See `PROGRESS_SYNC_V2_REPORT.md` for the implementation details and the regression-test results.

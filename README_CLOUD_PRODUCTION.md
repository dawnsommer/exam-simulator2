# exam-simulator2 — Progress Sync V2.2 Production Build

Build: `EXAM-SIMULATOR2-PROGRESS-SYNC-V2.2`

Production URL: `https://dawnsommer.github.io/exam-simulator2/`

## Architecture

- IndexedDB / the simulator's existing DATA abstraction remains the runtime source of truth.
- Google Drive `appDataFolder` stores active progress as a small V2 manifest plus immutable per-form/version payloads.
- Form identity is `formId + bankHash`; Qbank is an independent sync entity.
- The shared Cloudflare Worker handles OAuth/session/token refresh only.
- Normal Drive payload traffic remains browser ↔ Google Drive.
- Full Form Library cloud backup is separate from progress sync and remains manual/resumable.
- Local Progress Backup and Local Library Backup are separate portable systems. Cloud lineage is never exported in a portable progress file.

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

## Production verification after upload

Use a disposable test form first:

1. Open the production Pages URL and verify the simulator/library works before connecting Google.
2. Open Google Backup and connect Google once.
3. Verify the Worker callback returns and the URL fragment disappears.
4. Reload/reopen and confirm the Worker session restores without a new consent prompt.
5. Device 1: make progress and use Back Up Now. Verify status returns to Synced.
6. Fresh Device 2: install the same library and verify existing cloud progress is offered for restore rather than overwritten by empty local state.
7. Stale Device 3: confirm a newer cloud copy is not automatically overwritten.
8. Create a true divergent edit on two devices and verify the Local-vs-Cloud conflict prompt.
9. Test Previous Cloud Recovery and Undo Last Cloud Restore with disposable data.
10. Export/import a Progress Backup and verify cloud lineage is not inherited.
11. Export/import a Library Backup and verify existing progress/3-digit scores remain intact.
12. Test Full Form Library cloud backup separately, including pause/resume/cancel if desired.

See `PROGRESS_SYNC_V2_REPORT.md` for the implementation details and the regression-test results.

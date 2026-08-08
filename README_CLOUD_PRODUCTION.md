# exam-simulator2 — Production Cloud Build

Build: `EXAM-SIMULATOR2-CLOUD-5`

Production URL: `https://dawnsommer.github.io/exam-simulator2/`

## Architecture

- Existing IndexedDB / DATA storage remains the immediate local source of truth.
- Google Drive `appDataFolder` stores one progress backup per form/version plus a small manifest.
- 3-digit scores are included with the corresponding form progress backup.
- Full Form Library backup is separate, manual, resumable, and transfers directly browser ↔ Google Drive.
- `study-tools-auth-worker.summerofdawn20.workers.dev` handles OAuth/session/token refresh only.
- Google refresh tokens remain on the Worker. Short-lived Drive access tokens remain in browser memory only.

## Google Cloud requirement

The OAuth Web Client used by the shared Worker must include this exact Authorized redirect URI:

`https://study-tools-auth-worker.summerofdawn20.workers.dev/oauth/callback`

## Production cloud configuration

- `app_id`: `exam-simulator2`
- return URL: `https://dawnsommer.github.io/exam-simulator2/`
- Drive prefix: `exam-simulator2`

## First deployment test

1. Open the production Pages URL and verify the simulator/library works before connecting Google.
2. Open Progress Sync and connect Google once.
3. Verify the callback returns and the URL fragment disappears.
4. Reload: no new Google consent prompt.
5. Close/reopen Safari or installed PWA: no new consent prompt while the Worker session remains valid.
6. Back up one disposable form and restore it.
7. Test a full library backup/restore with disposable data before relying on it for recovery.

## CLOUD-2 interface

The Form Library now exposes only four persistent workflow controls: Add New Form, Progress, Update App, and Others. Google backup state is visible beside the local Library connection status. Backup conflicts appear as an action-needed notification rather than as a permanent destructive toolbar button.

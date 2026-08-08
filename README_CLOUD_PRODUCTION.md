# exam-simulator2 — Progress Sync V2 Production Build

Build: `EXAM-SIMULATOR2-PROGRESS-V2-2`

Production URL: `https://dawnsommer.github.io/exam-simulator2/`

## Core architecture

- Existing simulator IndexedDB / DATA storage remains the immediate runtime source of truth.
- Google Drive `appDataFolder` remains the cloud storage backend.
- The shared Cloudflare Worker remains OAuth/session/token-refresh only; simulator payloads never pass through it.
- Full Form Library Backup remains a separate manual/resumable system.

## Progress Sync V2 rule

Each local progress entity stores the `baseCloudVersionId` it descended from. Automatic Local → Cloud backup is allowed only when Drive still reports that exact current version.

Timestamps are displayed to the user but **do not choose authority**.

### Normal Device 1

Local changes while cloud remains at the same base version → checkpoint automatically backs up only the changed form → new cloud version created → local base advances to that version.

### New / cleared Device 2

No local progress + cloud progress exists → never interpreted as deletion → app offers cloud restore. No automatic empty-device upload occurs.

### Old Device 3

Local base version differs from the current cloud version → automatic upload stops. If local remained unchanged, cloud is classified as newer; if local also changed, the copies are classified as diverged. The user chooses direction.

## One-step recovery

- Local → Cloud overwrite: previous cloud current becomes the single `previous` recovery version for that form/Qbank entry.
- Cloud → Local restore: the simulator saves one complete local progress recovery point before applying cloud data.
- Previous cloud recovery and local recovery can be explicitly restored or deleted.

## Dated progress backups

Progress Sync V2 adds a separate dated recovery system:

- Daily recovery snapshots: enabled by default, created once per day after a successful aligned cloud checkpoint, last 7 retained.
- Manual progress snapshots: created explicitly by the user with an optional label.
- Snapshots use Google Drive server-side copies of the already-uploaded per-form progress files; the browser does not re-upload the full 30–50 MB progress collection merely to create a snapshot.
- Restoring an old dated snapshot restores locally first and deliberately creates a branch/decision if current cloud has advanced. It cannot silently overwrite current cloud.

## Current progress manifest

`exam-simulator2.manifest.json`

Manifest schema V2 stores, per form/Qbank:

- form identity + `bankHash`
- `current.versionId`
- `current.parentVersionId`
- current checksum/content hash
- updated timestamp/device metadata
- optional deletion timestamp
- one optional `previous` cloud recovery version

Legacy schema-1 manifests from the prior cloud builds are read and migrated in memory. If local content exactly matches a legacy cloud entry, V2 safely adopts that cloud version as its base. If they differ and no V2 lineage exists, V2 asks the user instead of guessing.

## Cloud authentication

Shared Worker:

`https://study-tools-auth-worker.summerofdawn20.workers.dev`

Production app ID:

`exam-simulator2`

Return URL:

`https://dawnsommer.github.io/exam-simulator2/`

Google Drive scope:

`https://www.googleapis.com/auth/drive.appdata`

The Google OAuth Web Client used by the Worker must include this exact redirect URI:

`https://study-tools-auth-worker.summerofdawn20.workers.dev/oauth/callback`

## Full Form Library Backup

Unchanged from the previous production cloud build:

- explicit/manual only
- catalog + forms + assets
- resumable chunked upload/download
- progress/ excluded
- browser/iPad ↔ Google Drive directly
- Cloudflare Worker supplies authentication only
- restore prunes obsolete non-progress library files after successful transfer
- `catalog.json` restored last

## First deployment checks

1. Verify existing simulator progress/library before connecting Google.
2. Connect Google and verify Worker callback/session.
3. Reload and reopen PWA: no repeated Google consent while Worker session remains valid.
4. Back up one disposable form; confirm a new V2 version is created and status settles to Synced.
5. Change that form again; confirm automatic/manual backup creates one previous cloud recovery copy.
6. Simulate an old device by using a second browser with older local progress; confirm the app asks before overwriting.
7. On a clean/fresh browser with the matching form library, confirm cloud-only progress is offered for restore and is never treated as deletion.
8. Test Undo Restore / previous cloud recovery.
9. Create and restore a Manual Progress Backup.
10. Verify daily snapshot retention and the separate Full Form Library backup.


## Local portable backups (V2.2)

### Progress Backup

Local Progress Backup is intentionally independent from Google lineage. It contains native `progress/` files plus a small `progress_metadata.json` for progress-owned metadata such as the 3-digit score. It does **not** export `versionId`, `baseCloudVersionId`, Worker sessions, tokens, or sync metadata.

After import, the affected progress is treated as a new local branch. V2 compares it with the cloud manifest before any upload. Matching content re-adopts the current cloud version automatically; different content requires an explicit direction.

### Library Backup

Local and cloud Library Backup are library-only: catalog structure + forms + assets. They exclude `progress/`, Qbank progress, 3-digit scores, progress summaries, and cloud lineage. Restoring a Library Backup preserves existing local progress and progress-owned catalog metadata. Legacy full ZIPs that contain a `progress/` folder are imported as library-only; that progress folder is ignored.

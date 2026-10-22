# Step Exam Simulator iPad — deploy and update

Before every deploy, run `node tools/release.mjs`.

Run it from this iPad folder. It increments the app-shell version, versions all external scripts/styles and referenced icons together, and regenerates the service worker and refresh file lists from the actual files. `node tools/release.mjs --check` verifies the current release without bumping it. Upload the complete contents of this folder (including the new root-level JS files and `js/`, `icons/`, `ui_icons/`). `index.html` and the manifest launch URL remain unversioned. Sync's `V2.3.0` identity is independent of the numeric app-shell version.

The service worker revalidates pages past Pages' HTTP cache and serves versioned scripts from this app's release cache. Returning to the app checks for updates at most every 30 minutes. An existing controlled client receives **Updated — Reload**; it saves pending progress before showing the notice and again before reloading. Initial install does not show an update notice.

Form Library shows **Reload latest version** with the current app version. This downloads the complete shell using HTTP reload semantics, unregisters only the exact current app scope, deletes only `exam-simulator2-` caches, and reloads. A failed download leaves the current worker/cache available. It does not clear localStorage, IndexedDB, the Browser Library, or other apps' registrations/caches. Existing clients using the older worker may need one or two reloads when this fix first ships.

Settings opens on **Bulk import**. A ZIP can contain `UWSA2/UWSA2.json`, `UWSA2/assets/…`, `NBME14/NBME14.json`, and `NBME14/assets/…`, optionally inside a wrapping folder. Each form folder contains one question-bank JSON. Preview the form counts, assets, and skipped installed IDs, then click **Import forms**. This adds separate forms and namespaces their assets; existing IDs/progress are preserved. Failed writes roll back newly created files and the catalog. Crash recovery metadata is stored in `progress/backups/PRE_BULK_IMPORT_*.json` and is excluded from library/portable exports.

Notes is a non-modal panel at the bottom right. Typing saves the block note, clicking elsewhere leaves it open, and **Save and Close**, ×, and **Delete Note** have distinct actions. Exam Settings → **Keep notes open** controls whether changing questions hides the panel; hiding never deletes the saved note. Lock/Resume now freezes block/day countdowns, elapsed time, question time, and saved resume timing, including untimed Lock.

Validation: from this folder run `node --test --test-concurrency=1 tests/*.test.cjs` and `node tools/release.mjs --check`. From the parent LOCAL folder, run the shared suite including `tests/exam-session-tools.test.cjs`. `node tests/browser-regressions.cjs` in the parent runs disposable Chrome QA when Playwright is resolvable; `PLAYWRIGHT_MODULE` and `TEST_BROWSER_PATH` can override the runtime paths. This checks offline/update/data preservation without live Drive access. Physical Safari/PWA and production Pages deployment still need a device check.

## Original A22.14 layout release notes

Base: A22.13 iPad package.

Changes in A22.14:
- Centers HOPI Physical Examination and Diagnostic Studies tables within the usable stem width.
- Keeps those HOPI tables border-invisible and enables word wrapping inside cells.
- Normalizes extra spacing after the HOPI History heading.
- Keeps Question: label and its statement on the same visual line.
- Keeps Reason for Visit/Chief Concern: label and its statement on the same visual line.
- OPFS/IndexedDB/library/import/export/suspend-resume code was not intentionally changed.

Upload the contents of this ZIP to the GitHub Pages repository root.

# Form updates — one-time setup and everyday use

The files are implemented locally. The GitHub Pages workflow and Cloudflare changes must be deployed before users can use the new update service.

## 1. Prepare Cloudflare once

Use the existing **study-tools-auth-worker**. Keep its existing bindings and Google secrets.

1. In Cloudflare, open **Workers & Pages → study-tools-auth-worker → Bindings**.
2. Find the database bound as **AUTH_DB**, then open that D1 database's **Console**.
3. Copy the contents of **backend/form-updates.sql**, paste them into the console, and run them. These statements only add tables/indexes; they do not replace your Google accounts or sessions. Running them again is safe.
4. Return to the Worker and open **Settings → Variables and Secrets → Add**.
5. Choose **Secret**, name it **EXAM2_ADMIN_PASSWORD**, and enter the admin password you supplied in this chat. Save/deploy it. The password does not appear in any repository file.
6. Open **Edit code**. Copy **all** of **backend/worker.mjs** into the Worker editor, replacing the current source. This file includes your original Google-login code and the new update endpoints.
7. Deploy the Worker. Keep its existing name and URL.

The complete Worker is supplied as one file so no imports, build tools, or new Cloudflare service are required. It reuses AUTH_DB for installation records and admin grants. Existing Google OAuth apps and their routes remain in place.

## 2. Enable GitHub publishing once

1. Upload/commit the prepared iPad repository files, including `.github/workflows/pages.yml` and `update/instructions.txt`, to `dawnsommer/exam-simulator2` on `main`.
2. In GitHub open **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
3. Open **Actions → Publish simulator and form updates**. Run it manually if the first push happened before Actions was enabled.
4. Wait for the build and deployment to turn green.
5. Open the simulator and use **Form Library → More → Reload latest version** once.

The workflow packages only public app files. Backend sources, SQL, tests, and local settings are excluded from the deployed site. Backend source may still be visible in the public Git repository; all actual passwords and Google secrets stay in Cloudflare.

## 3. Publish forms — normal everyday use

Put each form and its assets in a named folder:

```text
update/
  instructions.txt
  NBME14/
    NBME14.json
    assets/
      image1.jpg
  UWSA2/
    UWSA2.json
    assets/
      image1.jpg
```

Open `update/instructions.txt` and write:

```text
# Folder | Tab | If already installed
NBME14 | N-Forms | update
UWSA2  | UWSA    | skip
```

- The folder and JSON filename must match exactly. Use letters, numbers, hyphens, or underscores for folder names.
- The second column is the destination tab. Existing names are reused; new names create custom tabs. Use form tabs, such as `N-Forms`, `IM`, or a custom name, rather than Overview/All/Completed filters.
- `update`: add the form if missing; otherwise apply a compatible revision and the specified tab.
- `skip`: add the form if missing; otherwise leave the installed form and its tab unchanged.
- One instruction is required for each form folder. Blank lines and lines beginning with `#` are ignored.
- Assets use the same references as Bulk Import, such as `assets/image1.jpg`.

Commit/upload the folders and instructions together. GitHub builds the manifest, checksums, file sizes, and revisions automatically. You never edit the generated manifest or create a ZIP.

Users choose **Check for updates → Download & install**. Forms are fetched from the exact published commit. Existing saved progress is protected: legacy revisions need identical question blocks; QID revisions need matching identities/question sets and unchanged choices/correct answers. Installed question order is retained for saved attempts. Unsafe revisions show **Blocked**, with the reason.

For app-code changes run `node tools/release.mjs` before publishing, then `node tools/release.mjs --check`. Uploading/removing only update forms does not require an app-release bump.

## 4. Open Admin

1. Open the iPad simulator's **Settings → Admin**.
2. Enter your admin password and choose **Unlock**.
3. Review installation records; search or filter by form ID and revision.

Admin access stays unlocked in this browser across reloads, app updates, and Google-account changes. Other browsers/devices require the password. Clearing site data also removes this browser's grant.

When using another person's browser, press **Lock admin** before leaving it. This clears the visible records, locks all open simulator tabs in that browser, and revokes its grant. Locking offline hides/clears access immediately; revocation is retried when the browser reconnects. Other devices' grants remain unchanged.

Google identities in records are checked against the Worker's sessions. Users without a valid Google connection appear under their editable device label. Browser code cannot obtain the computer's actual machine name. A completed install may initially show **Installation report pending** if the backend is offline; the app retries when online or reopened.

## 5. Remove distributed forms

After reviewing the installations in Admin, remove the corresponding folders and instruction lines from GitHub and commit the change. Keep `instructions.txt` with just its comment lines when no updates are available.

The next successful Pages deployment publishes an empty list. Already installed forms and progress remain on users' devices. Removal is always your decision; receipt counts do not establish that every intended user has downloaded a form.

## Verification

Run the shared/Local suite from the parent directory as documented in its handoff. From the iPad directory:

```sh
node --test --test-concurrency=1 tests/*.test.cjs
node tools/release.mjs --check
```

Disposable browser tests require Playwright and Chrome:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright node tests/form-updates.browser.cjs
```

The browser test uses its own origin, temporary browser storage, synthetic forms, and a local SQLite-backed Worker. Service workers are blocked in that test so all backend traffic stays intercepted. The existing `../tests/browser-regressions.cjs` separately checks actual app-shell/offline behavior. No production Drive data is needed for either suite.

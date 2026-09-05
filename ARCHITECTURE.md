# Rising AMP — Architecture (Phase 10 live, 2026-09-02; Phase 11 Parts A–E on branch)

This describes the **running app**. Phase records: `PLAN.md` through `PHASE11.md`. Phase 10 Cost Plan is live on production hosting and Firestore rules (2 Sep 2026). Phase 11 Parts A–E are on `phase-11-cold-start`. Staging has `maintainLedgerRollup` and rollup docs; production hosting, function and rules are not deployed unless named.

Firebase project (production): `rising-amp-467702-b5`  
Live URL: https://risingamp.com.au (same app as https://rising-amp-467702-b5.web.app)  
Staging (localhost): `rising-amp-staging`  
Working branch: `phase-11-cold-start`. Never commit to `master` / `main`.
App name in the sidebar: “RisingAMP”. Look: Manrope, Palette 1, category colour as data ink only.

---

## 1. Stack

| Layer | What it is |
|--------|------------|
| UI | React 18, Vite 6, Tailwind. TypeScript `allowJs` + `strict`. New files are TypeScript. |
| Routing | `react-router-dom`. Job id lives in the URL: `/jobs/:jobId`. |
| Money | Integer cents in `src/money.ts`. Parse at the Firestore / form boundary. Stored documents stay mixed until a later migration. |
| Server state | TanStack Query. Cost Plan, quotes, org trade list, and job directories (labour, trades, clients, suppliers, service providers, payers, progress payments, HIA contracts, bank details) load on the screen that uses them. Expenses and invoices still live in `AppContext` via `onSnapshot`. |
| Backend | Firebase: Auth (Google or email/password), Firestore, Storage, Hosting, Cloud Functions. Analytics removed. App Check client is wired but **not enforced**. |
| Functions | Node 22. Live on production: `sendJobInviteEmail`, `readReceiptImage`, `allocateInvoiceNumber`, `checkEstimateImport`, `readQuoteFile`. Phase 11 Part E adds `maintainLedgerRollup` (on the branch; deploy **by name**). |
| OCR | OpenAI Vision via Cloud Function `readReceiptImage` (receipts) and `readQuoteFile` (quote photo or PDF). If that fails, show an error. |
| PWA | Standalone meta tags + safe-area CSS. `vite-plugin-pwa` generates `sw.js` and a minimal webmanifest (existing favicon only; no new PNG icons). Hashed assets are cache-first. HTML is network-first. Firestore, Cloud Functions and Storage are NetworkOnly. `npm start` does not register a worker. |

Entry: `index.html` → `src/index.js` → `src/App.js`.

Localhost must load `.env.local` (staging). Production builds must load `.env.production.local`. Do not swap them.

**Initial JS budget:** 275 KB gzipped, enforced in `vite.config.js`. **That is the held ceiling.** It moved from 250 in Phase 11 Part B because Firestore’s IndexedDB persistence lives in the same `firebase/firestore` module as `getDocs` and cannot be split out (~24 KB gzip). **Do not raise 275 because a build exceeds it.** Current (Part E): **272.7 KB**. Phase 11 Part B build: **270.0 KB**. Phase 11 Part A: **245.9 KB**. Phase 10 production: **245.5 KB**. The worker registers from an inline script in `index.html`, not from the React bundle. `exceljs`, `jspdf`/`html2canvas` and `pdf-lib` load on click. Job-file helpers are imported from `src/firebase/jobFiles.ts`, not the `src/data` barrel, so they stay off the first load. Cost Plan loads its Firestore module dynamically. See `build/stats.html` after `npm run build`.

---

## 2. Routes

Wired in `src/components/MainContent.js`. Map: `src/navigation.ts`.

| Path | File |
|------|------|
| `/` | `JobsHomePage.js` |
| `/jobs/:jobId` | `DashboardPage.js` |
| `/jobs/:jobId/expenses/new` | `AddExpensePage.js` |
| `/jobs/:jobId/invoices` | `InvoiceManagementPage.jsx` |
| `/jobs/:jobId/history` | `HistoryPage.js` |
| `/jobs/:jobId/files` | `FilesPage.tsx` |
| `/jobs/:jobId/cost-plan` | `CostPlanPage.tsx` |
| `/jobs/:jobId/budget` | `BudgetTrackingPage.js` |
| `/jobs/:jobId/contracts` | `HIAContractPage.jsx` |
| `/clients` | `ClientManagerPage.jsx` |
| `/profile` | `ProfilePage.js` |
| `/privacy` `/terms` | static HTML via `firebase.json` rewrites |
| `/clear-sw` | static HTML that unregisters the service worker and clears its caches |
| anything else | `NotFoundPage.jsx` |

The URL is the source of truth for the open job. `localStorage` is a cold-start fallback only.

Login (outside those routes): `LoginScreen.jsx`, `ProfileSetupScreen.jsx`, `AskForAccessScreen.jsx` when the signed-in email is on no organisation. While auth loads: `BootScreen.jsx`.

---

## 3. Access model

Google or email/password via Firebase Auth. After sign-in:

1. If the profile is incomplete, show **Set up your account**. Saved at `profiles/{uid}`.
2. Organisation is resolved from membership (`invitedEmails` query), not from a hardcoded constant. Opal (`opal-ss-constructions`) is preferred when the user is on it.
3. A signed-in person with no org sees **Ask us for access**.
4. Jobs home lists only projects where `invitedEmails` contains that email.
5. Tracker reads/writes `organizations/{orgId}/projects/{projectId}/…`. Receipt Storage still uses the legacy workspace id (`storageKey`) so live photos keep working.

Invite: owner taps the person icon on a job card. Invite mail is Resend from `invites@risingamp.com.au` via `sendJobInviteEmail`. Gmail fallback remains until the owner asks to remove it.

Old PIN trees `users/{accessCode}/…` still exist. The live app does not use them. Rules deny all reads/writes. Do not delete them unless asked.

---

## 4. Where auth is enforced

`firestore.rules`:

- `users/{accessCode}/**` — deny (legacy PIN copies kept, not world-open).
- `profiles/{uid}` — owner of that uid can read/write; same-email read for the dual-uid login case; delete denied. **Not** any-signed-in read.
- `publicProfiles/{email}` — signed-in get of display name + photo; list denied; owner write of those fields only.
- `organizations/{orgId}` — signed-in email must be in `invitedEmails`.
- `organizations/{orgId}/projects/{projectId}` — signed-in email must be in that project’s `invitedEmails`. List queries use `resource.data.invitedEmails` so they match `array-contains`. Owner-only: create job, archive, invite, remove person. Delete job is denied.
- Project subcollections use a `get()` of the parent project’s `invitedEmails`.
- `costPlan/current` — members can read and write a valid plan; Level 1 creates as `target`; updates may raise `level` and `sections`. Audit fields stay fixed and delete is denied.
- `quotes/{quoteId}` — members can create/update a valid quote; delete is denied (void instead).
- `organizations/{orgId}/tradeList/{tradeId}` — signed-in read; org-invited write; delete denied.
- These Phase 10 rules are live on staging and production (2 Sep 2026).

`storage.rules` in the repo: receipts require sign-in and job membership (or a known legacy PIN folder). Production Storage rules shipped 31 Aug 2026 with Phase 9. Quote and estimate files use the same job-file path; Phase 10 did not change Storage rules. See `DATABASE.md`.

---

## 5. How data is scoped

One organisation is live: Opal SS Constructions (`opal-ss-constructions`). A second org `phase8-isolation` exists on **staging only** so we can prove a member of org B cannot read org A. Production isolation org is not created unless named.

The dashboard is **one job at a time**. The job id is in the URL. `localStorage` restores it on a cold start if the URL has none.

---

## 6. Firestore layout (live)

```
organizations/{orgId}
  invitedEmails, ownerEmail, name
  counters/invoices            # year + next sequence; written by allocateInvoiceNumber
  tradeList/{tradeId}          org-wide cost-plan trades (not job trade contacts)
  projects/{projectId}
    expenses, invoices, files, costPlan, quotes, ledgerRollup, clients, labour, trades, …
profiles/{uid}              # private: name, mobile, ABN, address, photo
publicProfiles/{email}      # display name + photo only
users/{accessCode}          # leftover copies, unused by the app
```

Project document fields include `name`, `invitedEmails`, `legacyWorkspaceId`, `orgId`, optional `kind` (`client` | `own`).

`costPlan/current` is optional. Level 1 stores one GST-inclusive target. Level 2 adds `sections` keyed by trade. Level 3 adds imported lines under those trades. `quotes/{quoteId}` are separate documents with optional `fileIds` (and leftover `fileId`) pointing at `files/{fileId}`. Expenses may carry optional `tradeId` and a retaggable `category`. `ledgerRollup/current` is the server-owned expense summary (cost, counts, category and calendar buckets). Members can read it; only Cloud Functions write it. A job with no document has no Cost Plan nav item. Plan, quotes and the org trade list are shared through TanStack Query; they are not added to AppContext.

---

## 7. Storage layout

| Path | What |
|------|------|
| `receipts/{jobId}/{expenseId}/…` | Expense receipt images. `customMetadata.orgId` is set on new uploads so rules can resolve membership without hardcoding the org. Objects uploaded before Phase 9 have no metadata and fall back to Opal. |
| `files/{orgId}/{jobId}/{fileId}/…` | Job files. Org is in the path. Members only. Delete denied. 25 MB, images/PDFs/common documents, no video. Lists render `thumb.jpg`, never the original. |
| `siteLogs/{legacyWorkspaceId}/…` | Old Site Log photos (unused) |
| `reports/{legacyWorkspaceId}/…` | Old Weekly Report files (unused) |

Staging has a Storage bucket so localhost can upload receipts. Production Storage rules shipped 31 Aug 2026 with Phase 9. Quote files use that same `files/{orgId}/{jobId}/{fileId}/…` path. Do not change the receipt path.

---

## 8. Cloud Functions

Production functions are `sendJobInviteEmail`, `readReceiptImage`, `allocateInvoiceNumber`, `checkEstimateImport` and `readQuoteFile` (us-central1, callable). Phase 11 Part E adds `maintainLedgerRollup` (Firestore trigger on expenses). Deploy **by name**. **No `--force`.** `--force` suppresses the confirmation before deleting functions. This repo never lets a functions deploy delete something. Production order for Part E is the list in `PHASE11.md` (backup first; function; rules; dry-run; apply; dry-run must be zero; then hosting).

```
firebase deploy --project rising-amp-staging --only functions:readQuoteFile
firebase deploy --project production --only functions:readQuoteFile
firebase deploy --project staging --only functions:maintainLedgerRollup
firebase deploy --project production --only functions:maintainLedgerRollup
```

Deploying by name is the habit for this live app. Do not run a bare `firebase deploy --only functions` unless you intend to publish every exported function in `functions/index.js`.

Gmail invite fallback remains in the client until the owner asks to remove it. `sendNewSignInNotice` is still Gmail.

---

## 9–10. Site Log and Weekly Report

Removed from the UI. Cold export under gitignored `backups/cold-export-site-log-weekly-*`. Staging site-log documents deleted. Production rows and files left in place.

---

## 11. Backups

Usable production backups: gitignored `backups/production-*` (Firestore + Storage), taken with `scripts/backup-production.js`. Keep them. Do not commit them. Last production backup was 2 Sep 2026. Part E production starts with `npm run backup:production` (see `PHASE11.md`). Do not invent a backup record.

The old Oct 2025 `latest-backup.json` is not a usable restore.

---

## 12. Other Firebase projects on this Google account

Do not use these unless we confirm what they are:

- `construction-expense-tra-4adb0`
- `video-chat-test-28ae6`
- `watemelon-e586e`

Production is **`rising-amp-467702-b5`**. Staging is **`rising-amp-staging`**. Production also has an empty named Firestore database `cost-tracker`; the app uses `(default)`. Do not delete it.

---

## 13. Honest shape of the codebase

Working family tool after a foundations pass, not a greenfield platform.

Done in Phase 8:

- Vite + TypeScript for new files. `react-scripts` is gone.
- Real URLs. Refresh stays on the same screen.
- Money is integer cents in one module.
- Invoice numbers from a server counter. Invoices are voided, not deleted.
- One import path: `src/data` for the ledger. Job files are imported from `src/firebase/jobFiles.ts` so they stay off the first JS load. `firebaseService.js` is a thin re-export of `directories.js`.
- Auth / org / UI contexts exist; the ledger still sits in a large `AppContext` data provider (ADR 004).
- Org id from membership. Wildcard project writes are gone.
- Jobs list counts with `getCountFromServer`. Past 1,000 expenses the app hides cost and margin rather than showing a partial total.
- Vitest + GitHub Action on `phase-*` branches.

Done in Phase 9 Part A:

- Storage rules resolve org from receipt metadata (Opal fallback for old objects).
- Expenses and invoices void first; purge only from Recently deleted and only when already void. Clients, HIA, labour and trades void with no purge.
- `exceljs` is a dynamic import.

Done in Phase 9 Part B:

- Job files live at `organizations/{orgId}/projects/{jobId}/files/{fileId}` with a fixed type list (no folders). Archive, never delete.
- Storage path `files/{orgId}/{jobId}/{fileId}/…` is gated on job membership. 25 MB, no video.

Done in Phase 9 Part C:

- Job-file uploads reuse `src/firebase/storage.js`. Images compress to 1920px at 0.8 plus a 320px JPEG thumbnail. PDFs store as-is with a type icon. Lists render the thumbnail, never the original.
- Storage is written first, then Firestore. A failed Storage upload never gets a record. Retry can skip a completed Storage write.
- Firestore `thumbnailPath` must match `files/{org}/{job}/{fileId}/.+` — `matches()` is a full-string match, so a trailing slash with no `.+` rejects `thumb.jpg`. Staging Firestore + Storage rules are live; production is not.

Done in Phase 9 Part D:

- Route `/jobs/:jobId/files` with search, type counts (dots, not badges), list/grid, and a viewer. Receipts from expenses appear read-only and are not copied. Lists render `thumb.jpg` only.

Done in Phase 9 Part E:

- What needs you today reads job files: missing contract after other paperwork exists; $5,000+ invoices unlinked only after a quote/variation is on the job; Other files older than a week when `uploadedAt` is known. Certificate age is not treated as expiry.
- `linkedTo` is set from the file viewer. Expenses and invoices list attached files without copying them.

Done in Phase 9 Part F:

- Handover pack on Files. Default selection is contract, variation, plan, permit and certificate. Photos stay off until ticked. Cover page, contents (including missing types), then each document. Images are full-page plates. PDFs are appended with `pdf-lib`, loaded only when Generate is tapped. Word and other office files are named as not included. The pack is not stored.

Done in Phase 9 Part G:

- Files is a document register: one table with sortable columns, a summary bar, and multi-select (change type, archive, add to handover pack). Receipts stay in the list as “From an expense”, same hairline as everything else, and are not selectable. Type chips are mobile-only; desktop filters from the type column. List/grid is a two-segment control. Copy does not mention folders. Presentation only — no model or rule changes.

Phase 9 closed 31 Aug 2026: production hosting, Firestore rules and Storage rules. No new Cloud Functions. Localhost stays on staging.

Done on the Phase 10 branch:

- Optional `costPlan/current` per job. Target money is integer cents; spend is derived from active expenses.
- Lazy `/jobs/:jobId/cost-plan` route. No plan means no nav item and the direct route returns to Overview.
- Trade amounts, History coding and History category retag (Investor codes off construction).
- Quotes with allocations, chosen forecast, GST conversion and optional `fileIds` into existing Files (`type: quote`). Bytes stay in Storage; the quote document is a pointer list. Files can assign documents onto a live quote. The quote sheet fills from a photo or PDF via `readQuoteFile`. Add files can set the display name before upload (Storage path still uses the original filename).
- Spreadsheet column mapper; source file stored as Files type `estimate`. `checkEstimateImport` reviews the mapping; live on staging and production 2 Sep 2026.
- `job.kind: client | own` and factual Cost Plan attention.
- Cost Plan refuses to show spend when the 1,000-expense cap is reached.
- Firestore rules gate plans, quotes, trade list, expense `tradeId` and job kind. Emulator-tested. Staging and production rules live 2 Sep 2026.
- Expense fetch now derives `totalCents` from labour hours/rate and quantity/unit cost when no direct total field exists.

Left on purpose:

- Stored money fields are still mixed strings/numbers. Normalising them is a migration.
- Ledger rollups: `maintainLedgerRollup` writes `ledgerRollup/current`. Overview, Jobs home counts, Cost Plan headline spend and Budget read it. History, “what needs you,” and the Cost Plan trade board still read expense rows. If they disagree, the ledger wins on Overview. Staging function, rules and recompute applied 5 Sep 2026. Production is not deployed. Runbook: `PHASE11.md` Part E production list.
- TanStack Query is mounted. Cost Plan, quotes, the org trade list, and job directories load on the screen that uses them. Expenses and invoices still sit in `AppContext`.
- App Check enforcement is off until a site key exists and traffic is clean.
- Gmail invite fallback remains until the owner asks to remove it.
- Dismantling the remaining AppContext ledger/directory blob.

Decisions: `ADR/` (including `006-no-folders.md`).

---

## 14. Mobile and standalone

Phase 7. Layout and metadata only.

**Do not detect standalone in JavaScript to set margins.** `env(safe-area-inset-*)` is the operating system’s number for this device and this orientation. In a Safari tab the values are `0` because Safari’s chrome already occupies that space. The same CSS is therefore correct in a tab and on the home screen.

Variables in `src/index.css`:

- `--safe-top` / `--safe-right` / `--safe-bottom` / `--safe-left` → `env(safe-area-inset-*, 0px)`

Where they are applied:

- `.content` — bottom always; right always; left only under 768px (sidebar already sits on the left at `md`)
- `.app-main` / `.auth-frame` / `.boot-screen` — `padding-top: var(--safe-top)` so the header is below the clock
- Header menu button — in the header row on the left, not `position:fixed`
- `.sidebar-safe` — pad the drawer **contents**, not the steel panel
- `.auth-frame` — sign-in / sign-up shell
- `.app-shell` / `body` / `.mobile-modal` — `100dvh` with `100vh` as the fallback

Status bar: `apple-mobile-web-app-status-bar-style` is `default` (dark clock text on the light canvas). `.app-main`, `.auth-frame` and `.boot-screen` get `padding-top: var(--safe-top)` so the header sits below the clock.

**iOS 26 standalone reports `--safe-top: 0` while the page still draws under the clock** (WebKit 301994). Bottom env() is fine (`34px` measured). On a home-screen iPhone only, `--safe-top` is `max(env(safe-area-inset-top), 59px)` so the header sits below the Dynamic Island even when env() is lying. A Safari tab is not that media query, so it stays at `0`. This is not a per-device table and it is not a JavaScript standalone check.

**Measured (owner iPhone, standalone, 28 Aug 2026):**

| Mode | top | right | bottom | left |
|------|-----|-------|--------|------|
| Home screen, portrait | `0px` (env, buggy) | `0px` | `34px` | `0px` |

Do not treat that top `0` as “iOS reserved the strip”. The header was going under the clock. The 59px floor is the workaround until env() reports the real island height.

Part B (new PNG icons) was skipped — owner did not want a new home-screen icon. Orientation was not locked. Phase 11 Part A added a shell-only service worker; it does not change that icon.

---

## 15. Cold start (Phase 11)

The owner’s number is **time from tapping the home-screen icon to the Jobs list being readable**, on production, on a phone, throttled, force-close then reopen. That production-phone reading is still pending the Part E production list in `PHASE11.md` (not a hosting-only deploy).

| | Before Part A | After Part A (localhost `vite preview`, 5 Sep 2026) |
|--|--|--|
| Service worker | None. Every open re-downloaded the JS. | `sw.js` cache-firsts hashed assets (57 precache entries). HTML is NetworkFirst (`risingamp-html`). |
| Initial JS gzip | 245.5 KB on production | 245.9 KB (budget 250). Register script is inline in `index.html`, not in the React bundle. |
| Part B initial JS | n/a | **270.0 KB** (275 KB held ceiling). The extra ~24 KB is Firestore IndexedDB persistence, same module as `getDocs`. |
| Money data in the worker | n/a | Firestore, `*.cloudfunctions.net`, Storage, Auth and App Check are NetworkOnly. |
| Upgrade | n/a | Changed a hashed entry (`index-DzWVcopq.js` → `index-C-aVLcaD.js`), reopened: new build ran, worker activated, nothing left waiting. `skipWaiting` + `clientsClaim`. |
| Staging localhost (5 Sep 2026) | n/a | `vite build --mode staging` then preview on **:3000**. Signed-in Jobs, Kelly Street overview / Cost Plan / Files / History against `rising-amp-staging`. Worker controlled the page. `/clear-sw` unregisters and returns to Jobs. `npm start` has no worker. |
| Escape hatch | n/a | `/clear-sw` unregisters the worker and empties Cache Storage, then opens `/`. If that page itself is trapped: Safari → Settings → Advanced → Website Data. Kill-switch in code: `VitePWA({ selfDestroying: true })` then hosting. |
| Hosting cache | Firebase default 1 hour | `**` `Cache-Control: no-cache`; `/assets/**` immutable. So `sw.js` and `index.html` are not pinned. |

Serial round trips for *data* are unchanged by Part A (still Iowa). Boot cache from `86e2451` still paints Jobs after JS parses.

**Part B (on the branch, 5 Sep 2026):** `initializeFirestore` with `persistentLocalCache` (IndexedDB; memory fallback if IndexedDB is missing). The job list, expenses and invoices use `onSnapshot`, so a repeat open paints from disk then revalidates. Empty disk snapshots are ignored so they cannot wipe a boot-cached list. Invoice numbers stay on `allocateInvoiceNumber`; a manual invoice reload uses `getDocsFromServer`. Cost Plan saves stay transactions. The service worker still never caches Firestore.

**Part C (on the branch, 5 Sep 2026):** Opening a job only attaches the expenses and invoices listeners. Labour, trades, clients, suppliers, service providers, payers, progress payments, HIA contracts and bank details load with `useQuery` on the screen that needs them. Clients are one query (`queryKeys.clients`), not the old pair of `loadCompanies` + `loadClientDetails`. Directory lists stay fresh for 30 minutes; invoice/contract extras use the default minute. Writes still go through `AppContext` mutations, which patch the same query cache. Initial JS gzip **272.5 KB** (275 KB held ceiling).

**Part D (on the branch, 5 Sep 2026):** `invalidateKeys` in `src/query/client.ts` invalidates only the keys a write changes. An expense write touches `queryKeys.expenses`. An invoice void/restore/purge touches `queryKeys.invoices`. The old `invalidateQueries()` with no arguments is gone, so a save no longer refetches Cost Plan, quotes or directories. Initial JS gzip **272.6 KB** (275 KB held ceiling).

**Part E (on the branch, 5 Sep 2026):** `maintainLedgerRollup` recomputes `ledgerRollup/current` from every expense on that job, then writes the complete document in one `set()` if the revision is unchanged. Members read; clients cannot write. Overview cost, period, categories, Jobs home expense counts, Cost Plan headline spend and Budget use the rollup. History, “what needs you,” and the Cost Plan trade board still read the ledger. If an uncapped ledger disagrees, the ledger wins on Overview. Staging: function, Firestore rules and `node scripts/recompute-ledger-rollups.js --apply --staging` (Kelly Street `costCents=465633`, 5 live). Production is not deployed. The owner runs the Part E production list in `PHASE11.md` (backup first; no `--force`; second dry-run must be zero before hosting). Initial JS gzip **272.7 KB**. **275 KB is the held ceiling — do not raise it because a build exceeds it.**

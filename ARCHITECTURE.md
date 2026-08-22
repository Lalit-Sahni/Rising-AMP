# Rising AMP — Architecture (as of `pre-phase1-2026-08-22`)

This describes the **running production app**, not the target design. Phase 1 target design lives in `PLAN.md`.

Firebase project (production): `rising-amp-467702-b5`  
Default git branch in use: `master` (`main` is an old initial-commit only).  
App name in the sidebar: “Opal Track”. Login title still says “Construction Tracker”.

---

## 1. Stack

| Layer | What it is |
|--------|------------|
| UI | React 18, Create React App (`react-scripts`), Tailwind |
| Routing | **No react-router.** A string `currentPage` in `AppContext` switches which page component is shown. |
| Backend | Firebase: Auth (anonymous), Firestore, Storage, Hosting, Cloud Functions, Analytics |
| Functions | Node 22. One callable function: `generateWeeklyReport`. No scheduled jobs. |
| OCR | Client-side: OpenAI Vision (`gpt-4o-mini`) → Google Cloud Vision → Tesseract.js |
| PWA | Mobile web-app meta tags only. No `manifest.json`, no service worker. Not a full installable PWA despite the product description. |

Entry: `src/index.js` → `src/App.js`.

---

## 2. Pages (“routes”)

Wired in `src/components/MainContent.js`:

| `currentPage` key | In sidebar? | File |
|-------------------|-------------|------|
| `dashboard` | Yes | `src/components/pages/DashboardPage.js` |
| `add-expense` | Yes | `src/components/pages/AddExpensePage.js` |
| `new-invoice` | Yes (“Invoices”) | `src/components/pages/InvoiceManagementPage.jsx` |
| `history` | Yes | `src/components/pages/HistoryPage.js` |
| `budget-tracking` | Yes | `src/components/pages/BudgetTrackingPage.js` |
| `site-log` | Yes | `src/components/pages/SiteLogPage.jsx` |
| `weekly-report` | Yes | `src/components/pages/WeeklyReportPage.jsx` |
| `hia-contract` | Dashboard card only | `src/components/pages/HIAContractPage.jsx` |
| `client-manager` | Switch only | `src/components/pages/ClientManagerPage.jsx` |
| `ocr-test` | Hidden | `src/components/OCRTest.jsx` |
| `enhanced-ocr-test` | Hidden | `src/components/EnhancedOCRTest.jsx` |

Present but **not wired** into the live app: `PurchaseOrdersPage.js`, `ConstructionExpenseTracker.js` (legacy monolith), `Fab.js`.

---

## 3. Access model (the shared code)

This is not real login. It is a shared filing cabinet key.

1. `LoginScreen` asks for any 4–8 character string.
2. `loginWithAccessCode` in `src/firebase/auth.js` calls **Firebase Anonymous Auth** (a throwaway session so Firebase APIs work), then stores the string in `localStorage.accessCode`.
3. There is **no check** that the code is valid, invited, or known. A typo creates a new empty cabinet: `users/{thatTypo}`.
4. The anonymous Auth UID is **not** tied to the code. Rules ignore `request.auth`.
5. Logout signs out of Firebase and deletes `localStorage.accessCode`.

The code **is** the Firestore document ID:

```
users/{accessCode}/…
```

Knowing the code means you can read and write that whole tree.

---

## 4. Where auth is “enforced”

**It is not enforced in a meaningful way.**

`firestore.rules`: under `users/{accessCode}` and every nested path, `allow read, write: if true`. Comment in the file: “temporarily allow all access for debugging”. Anything outside `users/` is denied.

`storage.rules`: `receipts/{accessCode}/…` and `siteLogs/{accessCode}/…` also `allow read, write: if true`. Paths like `reports/` are denied to the client (the Cloud Function uses the Admin SDK, which bypasses rules).

Anyone who can load the web app (the Firebase API key is in the client bundle) can read or write any access-code namespace. The shared code is a naming convention, not a lock.

---

## 5. How data is scoped today

There is **no organisation**. There is **no per-user ownership**.

- One “workspace” = one document `users/{accessCode}` plus its subcollections.
- **Projects are labels, not containers.** There is currently **no** `users/{accessCode}/projects` collection in production. Saved project names, where they exist, are fields on records (e.g. expense `projectName`). The dashboard shows **all** expenses in the workspace, not one project at a time.
- After login you land straight on the workspace dashboard. There is no project picker.

This matters for Phase 1: “select a project, then see that project’s dashboard” is **new behaviour**, not a small wiring change. Records will need to be grouped under real project documents (matching on `projectName` where we can; leftover records with no name need an explicit home).

---

## 6. Firestore layout

Top-level collection used by the app: **`users`** only.

Under `users/{accessCode}/`:

| Subcollection | Used by |
|---------------|---------|
| `expenses` | Core tracker |
| `projects` | In the code, not present in the current production snapshot |
| `clients` | Client records (optional `projectId` field) |
| `labour` | Saved labour contacts |
| `trades` | Saved trades |
| `purchaseOrders` | Service exists; page not wired |
| `workerHistory` | Service exists |
| `siteNames` | Service exists |
| `projectPhases` | Service exists |
| `progressPayments` | Budget / HIA flow |
| `invoices` | Invoices |
| `hiaContracts` | HIA contracts |
| `bankDetails` | Bank details for invoices |
| `siteLogs` | Site Log feature |
| `payers` | “Paid by” autocomplete |

Legacy names still in rules (may or may not have data): `savedLabour`, `savedTrades`, `savedCompanies`, `savedProjects`, `clientDetails`.

User document fields: `accessCode`, `budget`, `createdAt`, `updatedAt`.

---

## 7. Storage layout

| Path | What |
|------|------|
| `receipts/{accessCode}/{expenseId}/receipt_{timestamp}.{ext}` | Expense receipt images |
| `siteLogs/{accessCode}/{logEntryId}/log_{timestamp}.{ext}` | Site Log photos |
| `reports/{accessCode}/Weekly-Report-{YYYY-MM-DD}.docx` | Weekly Report Word files (written by Cloud Function) |

---

## 8. Cloud Functions

Only export: `generateWeeklyReport` (`functions/index.js`).

- Callable HTTPS (v2), region used by the client: `us-central1`.
- Input: `{ accessCode }`.
- Reads last-week-ish `siteLogs` and `expenses` under that access code.
- Writes a `.docx` to Storage and returns a signed download URL (~1 hour).
- No cron. No email send.

Email for Site Log is **client-side only**: OpenAI drafts subject/body, then the browser opens a `mailto:` link (`src/utils/SiteLogEmailService.js`).

---

## 9. Site Log — full map (for removal)

| Kind | Location |
|------|----------|
| Page | `src/components/pages/SiteLogPage.jsx` |
| Nav | `src/components/Sidebar.js` (`site-log`) |
| Switch | `src/components/MainContent.js` |
| Context | `src/context/AppContext.js` (`siteLogs`, add/update/delete/load) |
| Firestore | `src/firebase/data.js` (`addSiteLogToFirestore`, `fetchSiteLogsFromFirestore`, `updateSiteLogInFirestore`, `deleteSiteLogFromFirestore`) → `users/{code}/siteLogs` |
| Storage | `src/firebase/storage.js` (`uploadSiteLogImage`, `deleteSiteLogImages`) → `siteLogs/{code}/…` |
| Email | `src/utils/SiteLogEmailService.js` |
| Function | Weekly Report **reads** site logs (see below) |
| Other | `src/components/Fab.js` (unwired) |

---

## 10. Weekly Report — full map (for removal)

| Kind | Location |
|------|----------|
| Page | `src/components/pages/WeeklyReportPage.jsx` |
| Nav | `src/components/Sidebar.js` (`weekly-report`) |
| Switch | `src/components/MainContent.js` |
| Client call | `httpsCallable(..., 'generateWeeklyReport')` |
| Function | `functions/index.js` (`exports.generateWeeklyReport`) |
| Builder | `functions/buildWeeklyReport.js` |
| Reads | `users/{code}/siteLogs`, `users/{code}/expenses` |
| Storage | `reports/{code}/Weekly-Report-*.docx` |

After both features are gone, the `functions/` package may have nothing left to deploy. That is a later, reviewed step — do not delete Cloud Functions from production until staging is verified.

---

## 11. Backups (current)

- Scripts: `npm run backup` / `npm run restore` → `scripts/backup-firebase-data.js`, `scripts/restore-firebase-data.js`.
- They use the **client** Firestore SDK and `process.env.REACT_APP_FIREBASE_*`.
- They do **not** load `.env.local` (`dotenv` is not used). Running them from a normal terminal likely talks to nothing useful, or to whatever happened to be in the shell env.
- The only backup on disk (`backups/latest-backup.json`, 18 Oct 2025) has **`totalUsers: 0`**. It is not a usable restore.
- The collection list **omits** `siteLogs` and `payers`.
- **Storage files are not backed up** (receipts would be lost in a restore-from-JSON-only scenario).

Treat current backups as **not production-ready**. A real backup (Admin SDK + Storage, pointed explicitly at a named project, dry-runnable) is a prerequisite before any production cutover.

---

## 12. Other Firebase projects on this Google account

Do not use these unless we confirm what they are:

- `construction-expense-tra-4adb0` — “Construction Expense Tracker”
- `video-chat-test-28ae6`
- `watemelon-e586e`

Production is **`rising-amp-467702-b5`** (display name “My First Project”).

Staging (created 2026-08-22, empty): **`rising-amp-staging`**. Default Firestore exists. Storage bucket not created yet (billing not attached). Auth not Get-started yet.

Production also has a second Firestore database named `cost-tracker` besides `(default)`. The app uses `getFirestore(app)` which is `(default)`. Do not delete `cost-tracker`; note it when writing the real backup script and check whether it holds anything.

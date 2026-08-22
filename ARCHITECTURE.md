# Rising AMP — Architecture (after Phase 2, 2026-08-23)

This describes the **running live app**. Phase 1 record is `PLAN.md`. Phase 2 visual record is `PHASE2.md`.

Firebase project (production): `rising-amp-467702-b5`  
Live URL: https://rising-amp-467702-b5.web.app  
Staging (localhost): `rising-amp-staging`  
Default git branch in use was `master`; Phase 1 landed on `phase-1-foundation`; Phase 2 (live look) is `phase-2-visual`.  
App name in the sidebar: “Opal Track”. Look: Manrope, Palette 1, category colour as data ink only.

---

## 1. Stack

| Layer | What it is |
|--------|------------|
| UI | React 18, Create React App (`react-scripts`), Tailwind |
| Routing | **No react-router.** A string `currentPage` in `AppContext` switches which page component is shown. |
| Backend | Firebase: Auth (Google), Firestore, Storage, Hosting, Cloud Functions (unused leftover), Analytics |
| Functions | Node 22. App source no longer exports Weekly Report. Production still has unused `generateWeeklyReport`. Do not deploy functions unless asked. |
| OCR | Client-side: OpenAI Vision (`gpt-4o-mini`) → Google Cloud Vision → Tesseract.js |
| PWA | Mobile web-app meta tags only. No `manifest.json`, no service worker. |

Entry: `src/index.js` → `src/App.js`.

Localhost must load `.env.local` (staging). Production builds must load `.env.production.local`. Do not swap them.

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
| `hia-contract` | Dashboard card only | `src/components/pages/HIAContractPage.jsx` |
| `client-manager` | Switch only | `src/components/pages/ClientManagerPage.jsx` |
| `ocr-test` | Hidden | `src/components/OCRTest.jsx` |
| `enhanced-ocr-test` | Hidden | `src/components/EnhancedOCRTest.jsx` |

Removed: Site Log, Weekly Report.

Present but **not wired**: `PurchaseOrdersPage.js`, `ConstructionExpenseTracker.js` (legacy monolith), `Fab.js`.

Login / chooser (not `currentPage`): `LoginScreen.jsx`, `NotInvitedScreen.jsx`, `ProjectPicker.jsx`.

---

## 3. Access model

Google sign-in via Firebase Auth. After sign-in:

1. Read `organizations/opal-ss-constructions`. If the Gmail is not on org `invitedEmails`, show Not invited. Nothing new is created.
2. List `organizations/…/projects` where `invitedEmails` array-contains that Gmail (dotted/undotted Gmail spellings are stored as variants).
3. Owner sees every job they are on (both family jobs). An invitee sees only the jobs they were added to.
4. Tracker reads/writes `organizations/{orgId}/projects/{projectId}/…`. Receipt Storage still uses the legacy workspace id (`storageKey`) so live photos keep working.

Invite: owner taps the person icon on a job card. That Gmail is added to that project (and to the org door list). The app tries to send mail from the inviter’s Gmail via the Gmail API. Live OAuth consent may still need a Console pass.

Old PIN trees `users/{accessCode}/…` still exist. The live app does not use them. Do not delete them unless asked. `users/` rules are still `if true` for those leftover trees.

---

## 4. Where auth is enforced

`firestore.rules`:

- `users/{accessCode}/**` — still `if true` (legacy PIN copies).
- `organizations/{orgId}` — signed-in Gmail must be in `invitedEmails`.
- `organizations/{orgId}/projects/{projectId}` — signed-in Gmail must be in that project’s `invitedEmails`. List queries use `resource.data.invitedEmails` so they match `array-contains`.
- Project subcollections use a `get()` of the parent project’s `invitedEmails`.

`storage.rules`: receipts still keyed by legacy access code, `if true`. Same as before Phase 1.

---

## 5. How data is scoped

One organisation: Opal SS Constructions.

Two projects (job lists): **72 Centenary Dr**, **Gurner St**. Each is a Firestore document under `organizations/opal-ss-constructions/projects/{projectId}` with tracker subcollections copied from the old PIN folders.

The dashboard is **one job list at a time**, chosen on the picker (or restored from `localStorage`).

---

## 6. Firestore layout (live)

```
organizations/opal-ss-constructions
  projects/{projectId}
    expenses, invoices, clients, labour, trades, …
users/{accessCode}     # leftover copies, unused by the app
```

Project document fields include `name`, `invitedEmails`, `legacyWorkspaceId`, `orgId`.

---

## 7. Storage layout

| Path | What |
|------|------|
| `receipts/{legacyWorkspaceId}/{expenseId}/…` | Expense receipt images (live bucket exists) |
| `siteLogs/{legacyWorkspaceId}/…` | Old Site Log photos (unused) |
| `reports/{legacyWorkspaceId}/…` | Old Weekly Report files (unused) |

Staging has **no** Storage bucket; localhost receipts may be missing. Live receipts work.

---

## 8. Cloud Functions

Production still has `generateWeeklyReport`. The app UI does not call it.

`functions/index.js` on this branch exports nothing. **Do not** `firebase deploy --only functions` to production; that would delete the live function.

---

## 9–10. Site Log and Weekly Report

Removed from the UI. Cold export under gitignored `backups/cold-export-site-log-weekly-*`. Staging site-log documents deleted. Production rows and files left in place.

---

## 11. Backups

Usable production backups: gitignored `backups/production-*` (Firestore + Storage), taken with `scripts/backup-production.js`. Keep them. Do not commit them.

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

Working family tool, not a tidy platform. Phase 1 was not a rewrite.

Fine for now:

- Folder layout (`pages`, `firebase`, `hooks`, `utils`).
- Live data path: `organizations/…/projects/…`.
- Staging + branch + restore tag.

Still messy, and not a side quest unless it blocks the next asked piece of work:

- Two overlapping Firestore helpers (`data.js` and `firebaseService.js`).
- `AppContext.js` loads a lot for every screen.
- Leftover unwired files.
- No react-router; almost no tests.
- Legacy `users/` and Storage rules still open.

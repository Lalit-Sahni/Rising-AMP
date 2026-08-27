# Phase 6 — Legacy cut (agent brief)

Read `CLAUDE.md` then `PROGRESS.md` then this file before touching anything.

Branch: **`phase-6-legacy-cut`** (from `phase-5-jobs-members`). Never commit to `master` or `main`.

Restore tag before first deletion: `pre-phase6-2026-08-27`.

This phase removes code. It does not add features and it does not touch data. Nothing here changes a Firestore document, a security rule, or a stored field. If a task in this brief seems to require a data migration, stop and ask. That is a sign the task was mis-scoped.

Database integrity leftovers from the earlier Phase 6 draft live in `PHASE6-INTEGRITY.md`. Do not start those until this legacy cut is done.

## Why this phase exists

The app was written about three years ago as a single-user localStorage tool, then grew through five phases into a multi-user Firestore product. Each phase added the new path and left the old one in place. The result is that roughly **a quarter of the source tree is unreachable**, and the parts that are reachable still speak the vocabulary of a product that no longer exists.

That is not a tidiness problem. It is a correctness problem, for one specific reason: **Lalit builds this app with AI agents.** An agent reads the codebase to decide what to do. When the codebase contains a 1,684-line component describing an older version of the app, four competing OCR services, and a data layer whose every function takes a parameter called `accessCode` that is not an access code, the agent reasons from the wrong model and produces wrong work. Dead code in an agent-built codebase is not inert. It is actively misleading, and it has already caused rework.

## Prime directive for this phase

- **Deleting code is safe. Deleting the wrong code is not.** Every deletion must be justified by a reference count of zero, re-verified at the time of deletion, not trusted from this document.
- **Prove before you cut.** For each file, run the check in the task, paste the output into the commit message, then delete. If the count is not zero, stop and report. Do not "clean up" the reference instead.
- **One part per session, one commit per part.** Each part below is sized for a single agent context window. Do not attempt two.
- **The app must build and run after every commit.** `npm run build` must pass. Then load localhost against staging and click through Jobs, Overview, Add expense (all five categories), Invoices, History.
- **No behaviour changes.** If removing dead code appears to change what the user sees, you have found live code. Stop.
- **Do not rename a file and delete it in the same commit.** Delete only.
- Nothing in this phase touches production data, Firestore rules, Storage, or Cloud Functions.
- Deploy nothing. Phase 6 ends on the branch. Lalit decides when it merges and deploys.

## Status (2026-08-27)

- [x] Restore tag `pre-phase6-2026-08-27`
- [x] Part A — Delete the orphans (`authValidation.js` left in place: still imported by `src/firebase/auth.js` and tests). Follow-up: `FormField.jsx` and `validation.js` were substring false positives, deleted with Part B.
- [x] Part B — Close the OCR dead end (Tesseract removed; live path is OpenAI Cloud Function only)
- [ ] Part C — The "Quick Access to Saved Data" box
- [ ] Part D — Strip the dead collections from the data layer
- [ ] Part E — Rename `accessCode` to `jobId` (own session, after A–D)
- [ ] Part F — Repo hygiene (`craco.config.js` already removed with Part B; it required an uninstalled package)

## Part A — Delete the orphans

Done 2026-08-27. Twenty files plus Windows `start-dev` leftovers. `authValidation.js` was on the original list but **is live** (`LoginScreen` / `ProfileSetupScreen` via `firebase/auth.js`). `useClientManager.js` and `projectCatalog.test.js` left alone. See the Part A commit for the verification counts and the list of capabilities that lived only in `ConstructionExpenseTracker.js`.

## Part B — Close the OCR dead end

**Do this only after the in-flight Cloud Function work is committed.** (It is: `e29c7ca Route receipt AI through a Cloud Function and drop Tesseract fallback.` Scanner is already OpenAI-only in the live path.)

There are currently four OCR services and two test harnesses. The live path after the Cloud Function migration is `OCRScanner.jsx` to `EnhancedOCRService` to `OpenAIOCRService` to `readReceipt.js` to the `readReceiptImage` function. Everything else is fallback for a world where the browser called the OCR API directly, which is exactly what the migration removed.

**The two test harnesses ship to users and cannot be reached.** `MainContent.js` routes `ocr-test` and `enhanced-ocr-test`, but `Sidebar.js` has no nav item for either, and nothing else sets those page keys. They are developer scratch pages that have been in the production bundle for months.

1. Remove `case 'ocr-test'` and `case 'enhanced-ocr-test'` from `MainContent.js`, and their two `lazy()` imports.
2. Delete `src/components/OCRTest.jsx` (180) and `src/components/EnhancedOCRTest.jsx` (329).
3. Confirm `OCRService.js` (540) and `SmartInvoiceOCR.js` (120) now have zero importers. `OCRService` is imported today only by `OCRTest.jsx`, `EnhancedOCRService.js`, and the orphaned `ConstructionExpenseTracker.js`. Once the harness is gone and Part A has run, the only remaining reference is the Tesseract fallback inside `EnhancedOCRService`.
4. **Decide the Tesseract question with Lalit before acting.** `EnhancedOCRService` falls back to `Tesseract.recognize()` in the browser when the primary path fails. `tesseract.js` is a multi-megabyte dependency that every user downloads. The argument for removing it: the Cloud Function is now the real path, the browser fallback produces markedly worse extraction, and a bad silent extraction is exactly the failure mode the product philosophy forbids. The argument for keeping it: it is an offline path for a tradie with one bar of signal. **Recommendation: remove it.** A wrong number extracted offline is worse than no number, and an honest failure ("could not read that photo, enter it manually") matches how the rest of the app behaves. But this is Lalit's call, not the agent's. Ask, then act.
5. If Tesseract goes: delete `OCRService.js`, `SmartInvoiceOCR.js`, remove the `tesseract.js` dependency from `package.json`, and strip `extractWithTesseract` from `EnhancedOCRService.js`.
6. Remove the dead API-key checks from the `env:check` script in `package.json`. It still probes `REACT_APP_GOOGLE_CLOUD_VISION_API_KEY` and `REACT_APP_OPENAI_API_KEY`, neither of which should exist in the client after the migration. Leaving them there invites someone to put a key back.

Commit: `Remove unreachable OCR harnesses and the superseded client-side OCR path.`

**Note for the Part B agent:** Phase 5 already dropped the Tesseract fallback from the live scanner (`PROGRESS.md`: "if AI fails, show an error (no Tesseract)"). Confirm what is still in `EnhancedOCRService.js` and `package.json` before asking. Do not assume this brief's "currently four services" counts are still exact.

Done 2026-08-27. Hidden routes `ocr-test` / `enhanced-ocr-test` removed. `OCRTest.jsx`, `EnhancedOCRTest.jsx`, `OCRService.js`, `SmartInvoiceOCR.js` deleted. `tesseract.js` removed from the client. Dead Tesseract/Vision classes stripped from `EnhancedOCRService.js`. Live path is `OCRScanner` → `EnhancedOCRService` → `OpenAIOCRService` → `readReceiptImage`. Vestigial `craco.config.js` and `@craco/craco` removed (it required `webpack-bundle-analyzer`, which was never installed; all scripts already used `react-scripts`).

## Part C — The "Quick Access to Saved Data" box

This is the one Lalit pointed at directly. It is the grey panel at the top of every Add Expense modal, holding a "Select saved worker" dropdown and a "Select saved project" dropdown.

**Read this section carefully, because "delete the box" and "delete the saved data" are two very different jobs and only the first one is wanted.**

The box lives in `src/components/ExpenseModal.jsx` at roughly lines 520 to 594, and renders five `SavedDataSelector` instances (`src/components/SavedDataSelector.jsx`, 226 lines). It is redundant, for a precise reason: **the form field directly below it already does the same job.** "Worker Name" is a `CreatableSelect` populated from the same saved-worker list. So the modal offers the user two different controls, in two different visual styles, that fill the same field from the same data. The box is the older of the two.

**Three separate things to do here.**

**C1. Delete the box, keep the data.**

Remove the `<div>` wrapper with the `Database` icon and the "Quick Access to Saved Data" heading, and all five `SavedDataSelector` instances inside it. Then delete `SavedDataSelector.jsx` once its reference count is zero.

**Do not remove** `savedLabour`, `savedTrades`, `savedCompanies` / `savedSuppliers`, or `savedServiceProviders` from `AppContext`. Those still feed the `CreatableSelect` fields that are staying. An agent that reads "delete the box" as "delete saved data" will break the Worker Name, supplier, and provider autocompletes and take a genuinely useful feature with it. Verify after this change that typing in Worker Name still suggests previously used workers.

**One capability is genuinely lost:** `SavedDataSelector` had a delete affordance (`showDelete`) letting a user remove a saved worker or trade from the list. The `CreatableSelect` fields have no equivalent. Note this in the commit message. It is a small loss and the box is not worth keeping for it, but managing saved workers should go on the list of things the product eventually needs somewhere sane, probably under More, not buried in an expense form.

**C2. Kill `savedProjects` as a concept, entirely.**

The "Select saved project" dropdown is not merely redundant, it is **actively harmful and should go regardless of what happens to the rest of the box.**

It writes a free-text `projectName` string onto an expense. That is precisely the disease Phase 5 just cured on invoices: the reason the app showed "72 Centenary Drive", "72 Centenary Road" and "72 Centenary Rd" as three different sites. Jobs are first-class records with stable IDs now. An expense already knows its job by living under `projects/{jobId}/expenses`. A second, hand-typed job name on the same record can only ever disagree with the real one.

The database audit confirms the nested catalogue this reads from (`projects/{jobId}/projects`) is **empty on production**. This is dead UI reading a dead collection and writing a field that contradicts the data model.

Remove, in `src/context/AppContext.js`: the `savedProjects` state, its loader, and its export. In `ExpenseModal.jsx`: the `projectName` field definition, `handleProjectSelect`, `getProjectOptions`, and the `field.name === 'projectName'` render branch. In `src/firebase/data.js`: `saveProjectInfo`, `fetchProjects`, `fetchSavedProjects`. In `src/firebase/firebaseService.js`: `saveProjectInfo`, `getProjects`, `updateProject`, `deleteProject`, and `PROJECTS` from the `COLLECTIONS` constant.

**Careful:** `src/firebase/projectCatalog.js` is a completely different and very much live file. It backs Jobs home, invites, and renames. The name collision between "project catalogue" (live, means jobs) and "saved projects" (dead, means a free-text label) is itself part of the legacy mess. Do not touch `projectCatalog.js`.

**Leave the stored data alone.** Any `projectName` already written on an expense document stays where it is. This phase does not write to Firestore. Removing the field from the form stops the bleeding; cleaning the existing values is a separate, later, approved job.

**C3. Fix the dark dropdowns while you are in there.**

The `CreatableSelect` fields in `ExpenseModal.jsx` carry hardcoded inline styles from the pre-Phase-2 dark theme: background `#334155`, border `#475569`, white text. That is why they render as navy blue boxes inside an otherwise white modal. The Phase 2 restyle did not reach them because the colours are inline JS objects, not classes.

Restyle them to the design system: white background, `#E7E9EC` hairline border, `#17181C` text, `#E85D1A` focus ring, matching the plain inputs beside them. Tokens are in `src/styles/tokens.css` and `design/opal-track-reference.html`. Colour stays in the data, never on the furniture.

Commit: `Remove the Quick Access box and the dead saved-projects concept.`

## Part D — Strip the dead collections from the data layer

`src/firebase/firebaseService.js` still exports full read/write/update/delete sets for four collections that no live screen touches, and that the database audit found empty or absent on production:

- `purchaseOrders` (the page was a 14-line stub, deleted in Part A)
- `workerHistory`
- `siteNames`
- `projectPhases`

Delete those functions and their entries in the `COLLECTIONS` constant. Roughly 150 lines inside an otherwise live file.

Confirm zero references first. The only importers of `firebaseService.js` are `NewInvoicePage.jsx`, `jobSummaries.js`, and the four manager hooks, three of which Part A deletes.

While here, note but **do not act on** the larger duplication: `firebase/data.js` (971 lines) and `firebase/firebaseService.js` (403 lines) are two parallel data layers with overlapping responsibilities (`saveProjectInfo` exists in both; `updateClient` and `updateClientInfo` do the same thing in different files). Merging them is real work with real risk and it is not this phase. Write what you find into `ARCHITECTURE.md` as a known issue so the next phase can scope it properly.

Commit: `Remove data-layer functions for collections nothing reads.`

## Part E — Rename `accessCode` to `jobId`

**Do this last, in its own session, and only after Parts A to D are committed and the app is verified working.**

This is the highest-value change in the phase for future agent work, and it is pure mechanics.

`src/context/AppContext.js` line 1008 reads:

```js
accessCode: jobListId,
```

The value is a job ID. It has been a job ID since Phase 1 removed PIN-based access. But the name `accessCode` propagates from there into **224 occurrences across 13 files**, including every one of the roughly 40 exported functions in `data.js` and `firebaseService.js`:

```js
export const addExpense = async (accessCode, expenseData) => { ... }
```

Any agent reading that signature concludes the app has access codes, that expenses are keyed by one, and that the security model works some way it does not. That misreading is expensive and it will recur in every future session until the name is fixed.

Distribution: `data.js` 79, `firebaseService.js` 51, `storage.js` 27, four manager hooks 13 each (three deleted in Part A), `NewInvoicePage.jsx` 6, `ClientManager.jsx` 4, `ExpenseModal.jsx` 2, and one each in `tenancy.js`, `AppContext.js`, `App.js`.

Method, and do not deviate:

1. Do Part A first. That removes 39 occurrences for free.
2. `AppContext` already exports `projectId: jobListId` alongside `accessCode: jobListId`. Settle on `jobId` as the single correct name and migrate consumers to it. Do not leave three names for one value at the end of this.
3. Rename mechanically, file by file, one commit per file. Parameter names, variable names, destructuring. Nothing else in the same commit.
4. **Change no string literal, no Firestore path, and no document field.** This is a rename of local identifiers only. If a diff line changes anything other than an identifier, revert it.
5. `npm run build` after each file.
6. At the end, `grep -rn "accessCode" src` must return nothing.

The risk here is not that the rename breaks something subtly. It is that an agent gets bored halfway through 224 edits and starts "improving" things. One file per commit, no refactoring, no cleverness.

Commit per file: `Rename accessCode to jobId in <file>.`

## Part F — Repo hygiene

Small, safe, do them together at the end.

1. `package.json` still declares `"name": "construction-expense-tracker"`. Change to `"risingamp"`. One name only.
2. `src/utils/excelExport.js` line 631 sets the workbook creator to `'Rising AMP Construction Tracker'`. Change to `'RisingAMP'`. This one is user-visible: it appears in the file properties of every spreadsheet exported to a client.
3. Delete three stale root documents, all from October 2025 and all describing a version of the app that no longer exists: `IMPROVEMENTS_PLAN.md`, `SETUP-COMPLETE.md`, `SECURITY-REFACTOR-SUMMARY.md`. `SECURITY.md` and `CONTRIBUTING.md` stay, but read them and fix anything that describes the old access-code model.
4. There are **60 `console.log` calls** in `src`, 14 of them in `AppContext.js` and 11 in `data.js`. `src/utils/logger.js` exists and is the right home for this. Route deliberate diagnostics through it, delete the rest. Do not leave logging that prints user data or job contents to the browser console of a production app.
5. `src/App.css` is deleted in Part A. Confirm nothing else imports a stylesheet that is not `index.css` or `premium-animations.css`.

Commit: `Repo hygiene: one product name, drop stale docs, route logging through logger.`

## What this phase does NOT do

Named explicitly so no agent talks itself into them:

- No Firestore writes, no migrations, no rule changes, no Storage changes.
- No merging of `data.js` and `firebaseService.js`. Documented as a known issue, scoped later.
- No cleanup of `projectName` values already stored on expense or invoice documents.
- No deletion of the leftover `users/{accessCode}` PIN trees in Firestore. Code cleanup only. The stored data stays until Lalit says otherwise.
- No deploy. Not hosting, not functions, not rules.
- No new features, no new dependencies, no restyling beyond the specific dark-dropdown fix in C3.
- No touching the in-flight OCR Cloud Function work beyond what Part B names.

## Definition of done

- `npm run build` passes.
- Localhost against staging: Jobs, Overview, Add expense in all five categories, Invoices, History, all work as before.
- Worker Name, supplier, and provider autocompletes still suggest previously saved entries.
- No dark navy dropdowns anywhere in the expense modal.
- `grep -rn "accessCode" src` returns nothing.
- The import-graph check reports no unreachable non-test files.
- `PROGRESS.md`, `CLAUDE.md`, and `ARCHITECTURE.md` updated to match.
- Roughly 6,300 fewer lines, and no user can tell the difference.

## Continuity

Update `PROGRESS.md` at the end of every session with the part completed and the next concrete step. Update `CLAUDE.md` when Phase 6 closes. Keep commits small and each one a restore point.

**Paste this to start a new chat:**

> Read CLAUDE.md, then PROGRESS.md, then PHASE6.md. Open design/risingamp-vision.html. Work is on branch phase-6-legacy-cut (from phase-5-jobs-members). Restore tag: pre-phase6-2026-08-27. Shopfront is https://risingamp.com.au. Localhost stays on staging. Phases 1–5 are live. Never hard-delete user records. Never accept a pasted API key. Do not deploy. One part per session.

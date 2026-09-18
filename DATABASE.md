# Rising AMP — Database (living guide)

**Start here for the database.** This is what is true on production and on the Phase 10 branch. Cost Plan rules are live on staging and production (2 Sep 2026). Storage rules were not redeployed with Phase 10.

`DATABASE-AUDIT.md` is the **26 August 2026 read-only scan**. It is still useful as a snapshot (counts, invoice name spellings, Storage file list). Parts of it are **stale**: `jobId` is backfilled, `users/` rules are closed in the repo and on production Firestore, jobs can be created / archived, people can be added / removed, and `clients` is no longer a mixed pile of house-owners and Bunnings. Prefer this file when the two disagree.

Nothing in this file is a licence to write production data. Schema and data writes still follow `PHASE5.md`: backup, staging, owner yes.

---

## Direct answers

### Why the Jobs chooser feels slow

It is not Firestore “being slow.” It is the **app asking for too much before it shows you anything.**

Until this session, opening Jobs home called `loadInvitedJobSummaries`, which for **every invited job** downloaded:

- every expense
- every invoice
- every client

then computed margin, “needs you,” and the subtitle **in the browser**. Two live jobs and ~130 expenses is about **~200 document reads** and a large JSON payload before the first card appears. Opening a job then downloads those collections **again** for the dashboard.

The cheap UX fix (now in the app, no schema change): show job **names** as soon as the invited-jobs query has an answer (boot cache, then IndexedDB, then the server), then hydrate **counts** from `ledgerRollup/current` when it exists, else `getCountFromServer`. Drawing the Jobs list does **not** download the ledger. Opening a job still listens to expenses and invoices for History and “what needs you,” but Overview cost comes from the rollup.

The **real** scale fix is the Phase 11 Part E rollup document (`ledgerRollup/current`), written by `maintainLedgerRollup`. Staging and production function, rules and recompute applied 5 Sep 2026. Phase 13 Part B adds `byTrade` and `byParty` on the same document (schema v1) and an org rollup at `organizations/{orgId}/ledgerRollup/current`, summed from complete job rollups. Staging applied in Part B; production function + recompute applied 11 Sep 2026. Recompute with `scripts/recompute-ledger-rollups.js`. If rollup and ledger disagree, the ledger wins.

Phase 13 Part D adds a typed, **read-only** query layer in `src/queries/` (no barrel file). Spend, job and portfolio summaries are rollup-first. Overview totals go through `jobSummary`, which calls the same `resolveExpenseTotals` helper. Membership is `{ orgId, allowedJobIds }` from invited jobs — never a free orgId. Trade and plan-versus-actual results carry the uncoded pool (live expenses with no stored `tradeId`). Production is untouched this phase.

### Is the model right for a family construction tracker?

**Yes, for what it is today.** One organisation, jobs as first-class IDs, membership as email lists, subcollections per job, soft archive, no hard deletes of user records. That is the correct Firebase shape for a small team.

### Is it right to scale into a product with many companies and thousands of jobs?

**Not as-is.** The tree can grow, but several habits will hurt: a 1,000-expense page (Phase 9 Part A **hides** cost and margin when the cap is hit), leftover PIN copies, and Jobs-list counts that used to download the ledger. Jobs-list counts and the profile leak were fixed in Phase 8. Storage rules are membership-gated on production as of Phase 9. None of the leftovers is fatal at two jobs.

---

## 1. What is actually stored

Three root collections on the default Firestore database. Production project: `rising-amp-467702-b5`. Staging: `rising-amp-staging`. Empty named database `cost-tracker` exists on production (0 documents) — leave it.

```
organizations/{orgId}
  name, ownerEmail, invitedEmails
  assistantWritesEnabled                   # Phase 15 Part E. Owner-only boolean. Missing or not true = assistant writes off (createExpense / codeExpense / codeExpenseBatch refused). Undo of an already-applied receipt still works. Live with Phase 16 go-live; leave off unless named.
  counters/invoices                            # year + next; Cloud Function only
  tradeList/{tradeId}                          # cost-plan categories; not job trade contacts
  parties/{partyId}                            # org identity (Phase 13). kind supplier | worker | trade | client | service provider. status active | merged. Delete denied.
  askHistory/{uid}/items/{id}                  # Phase 14. Per-user Ask questions. Question, routed query+params, provenance, snapshot cents, optional refusalReason (fact_missing | nothing_coded | unreadable_file | out_of_scope). Never model sentence/reason. answerFromDocuments and jobFacts are allowed choices; provenance source may be 'facts'. Owner uid only. Not a chat log.
  assistantReceipts/{id}                       # Phase 15. Receipt for an assistant write: action (codeExpense | createExpense | codeExpenseBatch | undoAction), tier (do|propose|refuse), status (applied|proposed|refused|undone), evidence per field (including batch), clientKey, document ids (expenseId / receiptId, or expenseIds / receiptIds for a batch), undo payload (restoreTradeId | restoreTradeIdBatch | voidExpense | none). source is always 'assistant'. Members of the org read; create with that shape; update is undo only (status undone, undoneAt, undoReceiptId). Delete denied. Activity lists with getDocs on the collection and sorts createdAt in memory (newest 50). No orderBy, so no composite index — the family org is small. Not a chat log (no messages/sentence). Rules live on staging and production (11 Sep 2026). Kill switch stays off.
  ledgerRollup/current                         # Phase 13 Part B. Org sum of complete job rollups. Same shape as the job rollup (no extra keys). Members read; client write denied. Staging and production recomputed (production 11 Sep 2026).
  legacyWorkspaceIds, legacyWorkspaceNames     # leftover PIN folder map; keep
  projects/{jobId}                             # THE job record
    name, orgId, status                        # active | archived
    kind                               # client | own; missing means client
    invitedEmails, formerEmails
    managers, viewers                     # Phase 18 Part B. Per-job roles. Missing keys = empty = Site. Both Gmail spellings, like invitedEmails. Disjoint; each is a subset of invitedEmails; owner email is never in viewers. Only the org owner may change managers[]. Firestore rules authorise; the uid-keyed boot cache is first paint only and is never a grant.
    archivedAt, archivedBy, createdAt, updatedAt
    legacyWorkspaceId, accessCode              # only on the two original jobs
    budget, expenses[]                         # leftover PIN copy fields; ignore
    files/{id}             job documents (Phase 9). type from a fixed list including estimate; no folders. status active | archived; delete denied. Optional linkedTo { kind, id } for expense | invoice | hiaContract. Files screen also lists expense receipts read-only; it does not copy them. Job Overview reads files for What needs you today; Jobs home does not. Handover pack is generated in the browser from selected files and is not stored. Extracted text is not on this list document.
    files/{id}/content/text  Phase 13 Part C sibling. text, textStatus (ok | truncated | none | unsupported | error), charCount, truncated, contentType, updatedAt. Cap 80_000 characters. Members may read `text` only; client create/update/delete denied. Written by `extractJobFileText` after the file record exists (embedded PDF text, text/plain; images are `none`; Word/Excel/other are `unsupported`). No OCR. No OpenAI. `findFiles` searches this extract. Phase 14 Part F `answerFromDocuments` quotes a verbatim slice of it (with file identity and character position; page only if stored). It never loads the original PDF. A `none` or `error` status is returned as unreadable, not guessed. Staging function live (retry: false so the first create did not need --force). Staging re-extract of existing PDFs (7 Sep 2026, `scripts/reextract-job-file-text.js`): 8 scanned, 4 written (3 ok, 1 error on a broken test PDF). Production function created 11 Sep 2026 (new uploads only; existing production PDFs not backfilled).
    costPlan/current        optional Phase 10 plan. targetCents is integer cents; baselineDate; GST mode; draft | locked | archived; sections hold trade amounts and optional imported lines. sourceFileId optional. Job members read. Site may create and edit a draft (including restore archived→draft); lock and archive are manager or owner. Delete denied. Archiving is reversible: the same `current` document can be replaced with a new draft.
    facts/current           optional Phase 16 facts record (`schemaVersion: 1`). Site, building, commercial, dates and compliance; every field optional with source / sourceRef / confirmation / previous (cap 20). Money is integer cents; areas are `{ value, unit: 'sqm' }`. Empty `{ jobId, schemaVersion: 1, updatedAt }` is valid. Schema in `src/domain/jobFacts.ts`. Members of the job read and write a valid shape; delete denied. **Rules live on staging and production (11 Sep 2026).** Phase 16 Part B: proposals are collected in memory (BOQ cover, HIA, unique client/invoice address, labelled file extracts, job name) and written only after a human accepts, via `saveJobFacts`. Proposals are not stored as their own documents. Phase 16 Part C: Overview reads `facts/current` (fail quiet) and shows present fields on the lead and Details panel; in-place owner edits call `saveJobFacts`. Handover / invoice Job line / expense export read present facts only. Phase 16 Part D: Ask `jobFacts` reads this document with getDoc only (403/missing → empty); it never writes.
    ledgerRollup/current    Phase 11 Part E + Phase 13 Part B. Server-owned expense totals (costCents, counts, byCategory, byMonth, byDay, byTrade, byParty). Schema version stays 1. Members read; client write denied. Recomputed from the expense collection; a failed write leaves the previous document. Staging and production have the Phase 13 buckets (production recomputed 11 Sep 2026).
    quotes/{id}            optional Phase 10 quotes. Allocations must sum to amountCents. status received | chosen | passed | void. Optional fileIds (max 10) point at files/{id}; fileId is the first pointer. The PDF is not stored on the quote. Delete denied.
    expenses/{id}          + jobId, optional tradeId (or not-in-estimate | investor). Optional source: 'assistant', assistantReceiptId, assistantConfirmed (false until a human opens or saves the expense in the form), and gstCents (integer cents, stated GST only — never derived). Assistant-created expenses omit tradeId. Human Cost Plan edits do not stamp those fields. Schema in the repo; not deployed.
    invoices/{id}          + jobId, invoiceNumber, status including void
    clients/{id}           house owner you invoice (one per job, ideally)
    suppliers/{id}         materials (Bunnings, Rodgers, …) upsert by name
    serviceProviders/{id}  same idea as labour, not mixed into clients
    labour/{id}, trades/{id}, payers/{id}
    hiaContracts/{id}, progressPayments/{id}
    clientDetails/{id}
    savedLabour/{id}, savedTrades/{id}, savedCompanies/{id}   # leftover
    siteNames/{id}, projectPhases/{id}, workerHistory/{id}
    siteLogs/{id}          # UI removed; rows may still exist

profiles/{uid}             private (mobile, ABN, business). Owner-only read.
publicProfiles/{email}     display name + photo. Signed-in get, no listing.

users/{accessCode}/…       leftover PIN copies. App unused. Do not delete.
```

Live jobs (production):

| Job ID | Name |
|--------|------|
| `job-78b8dcb3ea6bb3c0` | 72 Centenary Dr |
| `job-9dd078ccaa27d302` | Gurner St |

Staging may also have Part B test jobs. Localhost always talks to staging.

**Membership** is “is this email string in `invitedEmails`?” There is no `members` subcollection. Invite stores Gmail dotted/undotted variants, so raw array length looks larger than the number of people. Org `invitedEmails` is the door (union of people still on any job). Job `invitedEmails` is what Firestore rules and the Jobs list query use.

**Per-job role** (Phase 18 Part B, on `phase-18-people`, not production) sits on the same job document: `managers[]` and `viewers[]`. Absent from both means **Site**. Rules compare lowercased strings only, so both arrays store both Gmail spellings the same way `invitedEmails` does. The two role arrays are disjoint, each is a subset of `invitedEmails`, and the owner is never a viewer. Only the org owner may edit `managers[]`. A manager can invite and edit `viewers[]` on jobs they already manage. Site does the daily writes (expenses, files, draft cost-plan content). Viewer reads everything and writes nothing. Invoices, HIA, progress payments, and locking or archiving the cost plan are manager or owner. Cached membership/role in `risingAmp.boot.{uid}` is first paint only — it is never authorisation.

**A job is an ID.** Expenses live under that ID. Renaming the job document changes the card and header. Invoices still also store a free-text `projectName` typed at save time (six spellings on Centenary). That string is a snapshot for PDFs, not the source of truth. Screens should show the job’s `name`.

**A cost plan is optional and additive.** No `costPlan/current` document means the job behaves exactly as it did before Phase 10. Spend is always active expenses, never paid invoices. Investor expenses (`category: investor` or `tradeId: investor`) are not construction: they stay off Cost Plan spend, Uncoded and Overview margin. Other expenses code to a trade id, never to an estimate section. Quotes are their own documents. Derived forecast, variance and progress are never stored. The job `trades` directory is still saved trade contacts; the org `tradeList` is the cost-plan category list and its names can be renamed.

**Directories (after the split):**

| Collection | Meaning |
|------------|---------|
| `clients` | Person/company you invoice (Centenary: Vaneet Khera) |
| `suppliers` | Materials — one Bunnings, one Rodgers, not 13 copies |
| `serviceProviders` | Saved like labour |
| `labour` / `trades` | Upsert by canonical name, not append |

Canonical matching lives in `src/firebase/partyName.js`. Soft-moved old rows keep `status: moved/archived/duplicate`. Never hard-delete those.

**Parties (Phase 13 Part A1 + A2):** `organizations/{orgId}/parties/{partyId}` is the org-level identity for a supplier, worker, trade contact, client or service provider. Display name is what was typed; `canonicalName` is `canonicalPartyName` of that string. Status is `active` or `merged`. A merge points `mergedInto` at the survivor; nobody is deleted. New expense, invoice, quote and directory writes stamp `partyId` when an exact canonical match is unique for that kind. Fuzzy `namesMatch` stays for dropdowns and is not identity. **Staging** `opal-ss-constructions` was backfilled from live directory names (exact canonical + kind only) by `scripts/backfill-parties.js`. Owner-named staging merges (7 Sep 2026): Lalit → Lalit Sahni; Sydney Excavation and Demo → Sydney Excavation and Demolition. Metro Consulting vs Metro Consulting Group is still back to the owner. Production has not been backfilled.

---

## 2. What is right (keep this)

1. **One org, jobs as documents with stable IDs.** Do not invent a second jobs table. Do not key data by the site name.
2. **Parenting by path.** `organizations/{orgId}/projects/{jobId}/expenses/{id}` is how Firebase is meant to be used. Security rules `get()` the parent job.
3. **List query matches rules.** Jobs home uses `where('invitedEmails', 'array-contains', email)`. That is the only pattern that both scales a little and satisfies membership rules.
4. **Soft deletes.** Archive a job. Remove a person (`formerEmails`, keep their expenses). Close leftover PIN **rules**, do not delete PIN **documents**.
5. **`jobId` on child docs** (backfilled 27 Aug 2026). If you ever move or export a row, you still know which job it belongs to.
6. **Clients ≠ suppliers.** Mixing them made the invoice picker unusable. Keep them split.
7. **Firestore is the system of record.** Derived things (margin %, verdict, “needs you”) are computed in the client today. That is honest. Do not store a verdict unless you also define who updates it.
8. **Staging vs production.** Localhost → staging. Production only behind an explicit yes. That split is correct and must stay.
9. **Job files have a type, not a folder.** Certificates, variations, plans live as typed records on the job. Do not add a folder tree. Archive, never hard-delete. Extracted text lives on `files/{id}/content/text`, not on the file list document.
10. **Cost Plan expenses will code to stable trades, never imported sections.** Sections belong to a replaceable estimate. Part A ships the stable ids in code; organisation trade documents wait for Part B.
11. **The query layer is read-only and rollup-first.** `src/queries/` answers spend, summaries, files, invoices, quotes, document passages and recorded job facts from membership (`orgId` + invited `allowedJobIds`). It never writes. Numbers are computed in code, never by a model. Overview totals use `jobSummary`. The command palette answers spend, file text, invoice status, quoted document passages and `jobFacts` from the same queries. `answerFromDocuments` returns a verbatim excerpt of `files/{id}/content/text` plus the file; a scan (`textStatus: none`) or `error` is unreadable, never a guessed clause. `jobFacts` reads `facts/current` (getDoc only; missing / 403 is empty, never 0 sqm / $0) and does not calculate. Spend-by-trade and plan-versus-actual results carry the uncoded pool (`{ count, cents }` plus `affected`): live expenses with no stored `tradeId`, never a guessed trade. Ask answers show that provenance as a working line (query, params, rollup revision or row count), state a non-zero uncoded pool, and treat a capped ledger as incomplete; a `none` route may still show `planVsActual` or `jobSummary` figures the code already knows. Ask question history is `organizations/{orgId}/askHistory/{uid}/items/{id}`: the question, the routed choice, provenance, the snapshot cents from that query result, and a code-assigned `refusalReason` when the answer is a teaching refusal. The model sentence is not stored. `answerFromDocuments` and `jobFacts` are allowed stored query names.
12. **The action layer is receipted and undoable (Phase 15).** `src/actions/` writes through membership scope, never from `src/queries/`. Primitives are `codeExpense` (one existing expense `tradeId`), `createExpense` (a new uncoded expense from a scanned receipt), and `codeExpenseBatch` (a reviewed pass over uncoded rows; never recodes a stored `tradeId`). Every write returns a receipt at `organizations/{orgId}/assistantReceipts/{id}` with evidence, tier, `clientKey` idempotency, and an undo payload. Undo restores the previous `tradeId` (or every child in a batch) or voids a created expense (`status: 'void'`). It never `deleteDoc`s a live expense. Undo after a reload uses that stored receipt id, not a client buffer. The activity view lists receipts (getDocs, sort in memory, newest 50; no composite index). History marks an assistant row until `assistantConfirmed` is true. GST is the stated figure only (`gstCents`); empty tax is omitted; inferred GST is not stored and is never divided by 11. The model does not calculate and does not choose the tier. Inferred evidence never reaches do. NEVER actions (email, invoice numbers, invite, archive, delete, settings, spend) refuse with no write. Org field `assistantWritesEnabled` is the kill switch: owner-only; missing or not true is off; undo still works when off. Rules live on staging and production (11 Sep 2026). Kill switch stays off; palette does not execute writes.

These are product-grade decisions. Scaling does not mean throwing them away.

---

## 3. What is not right (honest)

### 3.1 Jobs home used to download the ledger to draw a list

The old per-job expense/invoice/client download (`jobSummaries.js`) was removed in Phase 12; nothing had called it since Phase 8. Counts come from `ledgerRollup/current` when present, else `getCountFromServer`.

### 3.2 Expense fetch cap

`fetchExpensesFromFirestore` still pages at `limit(1000)`, but it now compares that page to `getCountFromServer`. A job with exactly 1,000 expenses is complete. A job past 1,000 is **capped**: Overview hides cost and margin unless `ledgerRollup/current` exists. Rollup documents are Phase 11 Part E (`maintainLedgerRollup`). Centenary is ~124. Invoices have no cap.

### 3.3 Login no longer scans every profile

Phase 8 Part A: `findProfileByEmail` queries `where('email', '==', own email)` instead of `getDocs` on the whole collection. Private `profiles/{uid}` are owner-only (plus same-email). Job people chips read `publicProfiles/{email}` (display name and photo). Production rules are not deployed until named.

### 3.4 Typed job names on invoices

The job ID is correct. Invoice screens still persist and sometimes display `projectName` as typed (`72`, `72 Centenary Rd`, `72 Centenary Drive South Wentworthville`, …). That is leftover from before jobs were IDs. Part C item: show `projects/{id}.name`; keep the typed string as a snapshot.

### 3.5 Leftover collections and fields

Still on disk, unused by the current UI:

- `users/{accessCode}/…` PIN trees
- `savedLabour`, `savedCompanies`, some `savedTrades`
- `siteLogs` + Storage `siteLogs/` (~12 MB on production)
- `expenses[]` array on the Centenary job document
- empty `cost-tracker` database
- `firestore.indexes.json` is empty (`"indexes": []`)

Leave them unless a later approved plan says otherwise. They confuse agents and cost a little storage. They do not break the app.

### 3.6 Duplicate-check queries without indexes

Some labour/trade “already saved?” checks need composite indexes that were never added. They either fail quietly or scan more than they should. Empty `firestore.indexes.json` means nothing custom is deployed.

### 3.7 Secrets in the web app

`REACT_APP_*` values are baked into the JavaScript bundle. Anyone can extract them.

- **OpenAI** was called from the browser (`api.openai.com`). Browsers block that (**CORS**). That is why the console showed `No 'Access-Control-Allow-Origin'` and OCR “still worked”: Google Vision is the fallback. The OpenAI key in `.env.local` was never usable from localhost, and it was exposed anyway. The fix is Cloud Function `readReceiptImage` + Firebase secret `OPENAI_API_KEY` (never `REACT_APP_OPENAI_API_KEY`).
- **Google Cloud Vision** is still called from the browser with `REACT_APP_GOOGLE_CLOUD_VISION_API_KEY`. Google allows CORS, so it works — and the key is still in the bundle. Same class of problem; move it behind a function when you are ready.

Rotate the OpenAI key after the function is live. Do not paste keys into chat.

### 3.8 Storage rules are membership-gated

Repo `storage.rules` require sign-in and job membership (or a known legacy PIN folder). Org is taken from upload `customMetadata.orgId`, with a fallback to Opal for receipts uploaded before Phase 9. **Production Storage rules shipped 31 Aug 2026** (`firebase deploy --project production --only storage`) after hosting and Firestore rules. Receipts are no longer world-open. Job files live under `files/{orgId}/{jobId}/{fileId}/…`. Nobody can delete a Storage object; archive is a Firestore status change.

Staging has a Storage bucket (`rising-amp-staging.firebasestorage.app`, created 28 Aug 2026) so localhost can upload receipts and job files. CORS allows `http://localhost:3000`.

### 3.9 Job roles are Site, Viewer, Manager, Owner

Rules read `invitedEmails`, `managers[]` and `viewers[]` off the same job `get()`. Missing `managers`/`viewers` means empty means Site, so existing jobs keep working. Site may write expenses, files, quotes, facts and draft cost-plan content; they cannot write invoices or lock/archive the cost plan. Viewer reads those collections and writes nothing. Manager or owner write invoices, HIA, progress payments, and lock or archive the cost plan. Only the org owner may change `managers[]`. Only the org owner may create a job (manager-create needs an org-level signal and is deferred). Rename of `name`/`budget`/`kind` is still any job member until Part D. The boot cache is paint, not a grant.

### 3.10 One hard-coded organisation

`FAMILY_ORG_ID = 'opal-ss-constructions'` is still the client fallback and the Cloud Function default. Storage rules no longer hardcode that id for membership: they read `customMetadata.orgId` on the object, and only fall back to Opal for receipts uploaded before Phase 9. Org `allow create: if false`. Correct for this family app.

### 3.11 No server-side aggregation

Margin, unpaid invoices, missing receipts, category trends are all client-side. Correct and honest at this size. At 100× you either denormalise summaries on write, or use scheduled functions / BigQuery. Do not run Cloud Functions that rewrite every expense “to make Jobs faster” without a plan.

---

## 4. How reads actually happen (why it feels slow)

Typical signed-in visit:

| Step | What it reads | Rough size today |
|------|----------------|------------------|
| Auth + profile | `profiles/{uid}` plus same-email query (not the whole collection) | 1–2 docs |
| Jobs home (names) | `projects` `array-contains` email (and Gmail variants) | 2 job docs |
| Jobs home (figures) | all expenses + invoices + clients **per job** | ~130 + 10 + remaining clients |
| Open a job | expenses, invoices, labour, trades, payers, HIA, clients, … again | another ~200 |
| History / budget | same expense pile again if not already in memory | repeats |

Firestore does not have SQL `SUM()`. If you want a total on the chooser, you either download the rows or store the total on the parent.

**10× (20 jobs, ~1,300 expenses):** Jobs home might do **thousands of reads** and freeze a phone. Bill still modest. UX is not.

**100× (200 jobs, tens of thousands of expenses):** this pattern is unusable. You will also hit the 1,000 cap; the app now hides margin rather than silently lying.

---

## 5. Security (current, not the August audit)

| Area | Status |
|------|--------|
| Job data | Signed-in email must be on that job’s `invitedEmails` to read. Writes split by role: Site vs Viewer vs Manager vs Owner. Isolation holds for one org. |
| Org create | Denied. Cannot spawn a second org from the client. |
| Job delete | Denied. Archive only. |
| `users/**` PIN copies | Repo + production Firestore: **deny**. Documents kept. |
| `profiles` | Owner (or same email) can read private fields. `publicProfiles` is name + photo, get-only. Production rules deploy still outstanding. |
| Storage receipts and job files | Membership-gated on production (31 Aug 2026). |
| Cost Plan | Membership-gated, shape-validated, fixed `current` id, delete denied on the branch. Not deployed yet. |
| Client API keys | Vision key in the bundle. OpenAI must not be. |

Gmail dots: rules compare lowercased strings. Invite writes variants. Remove-person must remove **all** variants (the app does this).

---

## 6. Storage layout

Production bucket: `rising-amp-467702-b5.firebasestorage.app` (audit: 21 files, ~18 MB).

| Prefix | Role |
|--------|------|
| `receipts/{legacy PIN}/…` | Original photos; URLs stored on old expenses. Do not move. |
| `receipts/{jobId}/…` | New uploads. Keep using job ID. |
| `files/{orgId}/{jobId}/{fileId}/…` | Job files (Phase 9). Original plus optional `thumb.jpg`. Gated on job membership. 25 MB, no video. |
| `siteLogs/{legacy PIN}/…` | Unused by UI. |
| `avatars/{uid}/…` | Profile photos. |

Staging bucket: `rising-amp-staging.firebasestorage.app` (created 28 Aug 2026). Localhost can upload new receipts here. Old production photos are not copied over.

---

## 7. What to do to improve (ordered)

Do these in order. Earlier items are worth it even if you never “scale.” Later items wait until the family is bigger or you productise.

### Now (no schema write, or already in the app)

1. **Jobs home: names first, figures second.** Done in this session. Confirms the slowness was “wait for the ledger,” not “Firestore is broken.”
2. **Put OpenAI behind `readReceiptImage`.** Browser cannot call `api.openai.com`. Deploy **by name only** after the owner sets `OPENAI_API_KEY` at a masked prompt. Staging first (localhost). Production functions are `sendJobInviteEmail`, `readReceiptImage`, `allocateInvoiceNumber`, `checkEstimateImport` and `readQuoteFile`.
3. **Deploy Storage rules.** Done 31 Aug 2026 with Phase 9. Receipts and job files are membership-gated.
4. **Rotate the OpenAI key** once the function works. The old `REACT_APP_OPENAI_API_KEY` lived in the client.

### Soon (Part C, additive / reversible — owner yes)

5. **Show the job’s `name` on invoice UI**, keep typed `projectName` as PDF history.
6. **Stop scanning all profiles.** Client is on the branch. Production leak still open. Backfill `publicProfiles` with `scripts/backfill-public-profiles.js` before rules. Hosting before rules.
7. **Paginate expenses** (page of 100–200). The 1,000 cap is now detected and cost/margin are hidden; pagination is still the real fix.
8. **Void, then Recently deleted.** Done for expenses and invoices in Phase 9 Part A. Clients / HIA / progress payments void with no purge.
9. **Move Google Vision** to a function the same way as OpenAI, then remove `REACT_APP_GOOGLE_CLOUD_VISION_API_KEY`.

### When you add a third job, or Jobs home feels slow again

10. **Denormalise a summary on the job** — done in Phase 11 Part E as `ledgerRollup/current`, not fields on the job document. Function `maintainLedgerRollup`. Recompute: `node scripts/recompute-ledger-rollups.js --dry-run --staging`.

11. **onWrite Cloud Function** — `maintainLedgerRollup`. Deploy **by name**. Do not bundle it with a full functions deploy.

### When you productise (many orgs, many users)

12. Replace the hard-coded org id with “orgs this email belongs to.”
13. `members/{uid}` (or `members/{canonicalEmail}`) subcollection with a role, instead of only email arrays. Keep `invitedEmails` until rules are rewritten — Firestore `array-contains` has a 1 MB doc limit; a busy job’s invite list will not hit that soon, but a members collection is the grown-up model.
14. Org-level supplier directory (one Bunnings for the company) with per-job usage, instead of copying suppliers onto every job.
15. Role-based rules (owner / bookkeeper / site can add expenses but not change HIA).
16. App Check on functions so random people cannot burn your OpenAI balance even if they obtain a Firebase API key.
17. If you need analytics / “all jobs this quarter,” export to BigQuery. Do not use Firestore as a warehouse.

### Leave unless asked

- Deleting PIN trees, site logs, `cost-tracker`, leftover `expenses[]` on the job doc
- Billing / Stripe
- Second product
- Pointing localhost at production

---

## 8. What “good” looks like at three sizes

| | Family (now) | 10× | Product |
|--|----------------|-----|---------|
| Orgs | 1 hard-coded | 1 | Many |
| Jobs | 2–10 | ~20 | Hundreds |
| Jobs home | List jobs, then optional summary field | **Must** use summary field | Summary + pagination |
| Expense open | Load that job’s expenses | Paginate | Paginate + indexes |
| Membership | Email arrays | Same | `members` + roles |
| Secrets | Functions + Secret Manager | Same | App Check |
| Isolation | Job invite list | Same | Org + job + roles |

Firestore is a good database for this product **if** list screens read small documents and detail screens read one job’s subcollections. It is a bad database if every screen downloads the whole company.

---

## 9. Files that tell the truth

| File | Role |
|------|------|
| `DATABASE.md` (this file) | Living model, weaknesses, scale advice |
| `DATABASE-AUDIT.md` | 26 Aug 2026 counts and findings (historical) |
| `firestore.rules` | Who can read/write |
| `storage.rules` | Who can read/write files (deploy separately) |
| `src/firebase/projectCatalog.js` | Job list, create, archive, invite, remove |
| `src/firebase/directories.js` | Client / supplier / labour upsert |
| `src/firebase/parties.ts` | Org party identity; exact canonical match only |
| `src/firebase/partyName.js` | Canonical names |
| `scripts/backup-production.js` | Backup before writes |
| `scripts/backfill-job-ids.js` | Already applied |
| `scripts/recompute-ledger-rollups.js` | Rebuild job `ledgerRollup/current` from expenses, then the org rollup from those job docs (dry-run default). Writes need `--apply --staging` or `--apply --production`. `--clear` is staging only. Production applied 11 Sep 2026. |
| `scripts/split-directory-parties.js` | Already applied |

---

## 10. Rules for later agents

- Do not hard-delete live user records. Void first (Recently deleted). Permanent delete is only allowed on already-voided expenses and invoices.
- Do not run production schema or data writes without a backup, a staging run, and an explicit yes.
- Do not `firebase deploy --only functions` unless you intend to publish every exported function. Production functions are `sendJobInviteEmail`, `readReceiptImage`, `allocateInvoiceNumber`, `checkEstimateImport`, `readQuoteFile`, `maintainLedgerRollup`, `extractJobFileText` and `askRisingAmp` (the last two created 11 Sep 2026, `retry: false`). `askRisingAmp` returns a query route only — it does not read expenses or compute spend. The client runs `src/queries/` and paints palette rows from those results. `maintainLedgerRollup` was updated with the Phase 13 recompute on 11 Sep 2026. Deploy **by name**.
- Do not accept a pasted API key.
- Do not “fix” localhost receipts by pointing `.env.local` at production.
- If chat and this file disagree, this file plus `CLAUDE.md` / `PROGRESS.md` win.

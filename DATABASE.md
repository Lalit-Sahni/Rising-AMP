# Rising AMP — Database (living guide)

**Start here for the database.** This is what is true after Phase 5 Part B and the clients / suppliers / service-providers split (live on production 27 August 2026).

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

The cheap UX fix (now in the app, no schema change): show job **names** as soon as `listInvitedProjects` returns (one query), then hydrate **counts** with `getCountFromServer` (one read per thousand documents). Drawing the Jobs list does **not** download the ledger. Opening a job still downloads expenses and invoices for the dashboard.

The **real** scale fix is denormalised summary fields on the job document (section 7). Do not do that until you approve a write plan. Phase 8 skipped rollups on purpose so the ledger stays the only source of truth.

### Is the model right for a family construction tracker?

**Yes, for what it is today.** One organisation, jobs as first-class IDs, membership as email lists, subcollections per job, soft archive, no hard deletes of user records. That is the correct Firebase shape for a small team.

### Is it right to scale into a product with many companies and thousands of jobs?

**Not as-is.** The tree can grow, but several habits will hurt: a silent 1,000-expense cap (Phase 8 now **refuses** a margin when the cap is hit), leftover PIN copies, and Storage rules that may still be the old open rules on production. Jobs-list counts and the profile leak were fixed in Phase 8. None of the leftovers is fatal at two jobs.

---

## 1. What is actually stored

Three root collections on the default Firestore database. Production project: `rising-amp-467702-b5`. Staging: `rising-amp-staging`. Empty named database `cost-tracker` exists on production (0 documents) — leave it.

```
organizations/{orgId}
  name, ownerEmail, invitedEmails
  counters/invoices                            # year + next; Cloud Function only
  legacyWorkspaceIds, legacyWorkspaceNames     # leftover PIN folder map; keep
  projects/{jobId}                             # THE job record
    name, orgId, status                        # active | archived
    invitedEmails, formerEmails
    archivedAt, archivedBy, createdAt, updatedAt
    legacyWorkspaceId, accessCode              # only on the two original jobs
    budget, expenses[]                         # leftover PIN copy fields; ignore
    expenses/{id}          + jobId
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

**A job is an ID.** Expenses live under that ID. Renaming the job document changes the card and header. Invoices still also store a free-text `projectName` typed at save time (six spellings on Centenary). That string is a snapshot for PDFs, not the source of truth. Screens should show the job’s `name`.

**Directories (after the split):**

| Collection | Meaning |
|------------|---------|
| `clients` | Person/company you invoice (Centenary: Vaneet Khera) |
| `suppliers` | Materials — one Bunnings, one Rodgers, not 13 copies |
| `serviceProviders` | Saved like labour |
| `labour` / `trades` | Upsert by canonical name, not append |

Canonical matching lives in `src/firebase/partyName.js`. Soft-moved old rows keep `status: moved/archived/duplicate`. Never hard-delete those.

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

These are product-grade decisions. Scaling does not mean throwing them away.

---

## 3. What is not right (honest)

### 3.1 Jobs home downloads the ledger to draw a list

`src/firebase/jobSummaries.js` still fetches every expense, invoice, and client per job to compute:

- paid / cost / margin
- attention count
- subtitle (client name · suburb)

That is fine for **two** jobs and a couple of hundred expenses. It is the wrong query for a chooser at 20 or 200 jobs.

Opening a job (`fetchExpensesFromFirestore` and friends) repeats the same reads.

**Cost today:** a few hundred reads per Jobs visit. Firestore’s bill is still tiny (reads are $0.06 per 100,000). **What you feel is latency and main-thread work**, not the invoice from Google.

### 3.2 Silent 1,000-expense cap

`fetchExpensesFromFirestore` uses `limit(1000)` and does not tell you if more exist. Centenary is ~124. The day a job passes 1,000, Jobs home **undercounts cost and margin** and History looks complete when it is not. Invoices have no cap (fine for now).

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

### 3.8 Storage on production may still be the old rules

Repo `storage.rules` require sign-in and job membership (or a known legacy PIN folder). The 27 Aug production deploy was **hosting + Firestore rules only**. Storage was not named. **Live receipt files may still be world-open** until `firebase deploy --project production --only storage` with an explicit yes.

Staging now has a Storage bucket (`rising-amp-staging.firebasestorage.app`, created 28 Aug 2026) so localhost can upload receipts. CORS allows `http://localhost:3000`. Staging Storage rules were deployed the same day. Production Storage rules were not.

### 3.9 Anyone on a job can write everything on that job

Rules: if your email is on `invitedEmails`, you can read and write every subcollection (expenses, invoices, HIA, directories). Only the org owner can create jobs, archive, invite, remove people. There is no “bookkeeper vs site manager” split in Firestore. Fine for family. Wrong for a multi-tenant product.

### 3.10 One hard-coded organisation

`FAMILY_ORG_ID = 'opal-ss-constructions'` is in the client and in functions. A second company cannot exist without a code change. Org `allow create: if false`. Correct for this family app. A scaled product needs `organizations/{orgId}` chosen at login, not a constant.

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

**100× (200 jobs, tens of thousands of expenses):** this pattern is unusable. You will also hit the 1,000 cap and silently lie about margin.

---

## 5. Security (current, not the August audit)

| Area | Status |
|------|--------|
| Job data | Signed-in email must be on that job’s `invitedEmails`. Isolation holds for one org. |
| Org create | Denied. Cannot spawn a second org from the client. |
| Job delete | Denied. Archive only. |
| `users/**` PIN copies | Repo + production Firestore: **deny**. Documents kept. |
| `profiles` | Owner (or same email) can read private fields. `publicProfiles` is name + photo, get-only. Production rules deploy still outstanding. |
| Storage receipts | **Repo is tight; production deploy of Storage rules is still outstanding.** |
| Client API keys | Vision key in the bundle. OpenAI must not be. |

Gmail dots: rules compare lowercased strings. Invite writes variants. Remove-person must remove **all** variants (the app does this).

---

## 6. Storage layout

Production bucket: `rising-amp-467702-b5.firebasestorage.app` (audit: 21 files, ~18 MB).

| Prefix | Role |
|--------|------|
| `receipts/{legacy PIN}/…` | Original photos; URLs stored on old expenses. Do not move. |
| `receipts/{jobId}/…` | New uploads. Keep using job ID. |
| `siteLogs/{legacy PIN}/…` | Unused by UI. |
| `avatars/{uid}/…` | Profile photos. |

Staging bucket: `rising-amp-staging.firebasestorage.app` (created 28 Aug 2026). Localhost can upload new receipts here. Old production photos are not copied over.

---

## 7. What to do to improve (ordered)

Do these in order. Earlier items are worth it even if you never “scale.” Later items wait until the family is bigger or you productise.

### Now (no schema write, or already in the app)

1. **Jobs home: names first, figures second.** Done in this session. Confirms the slowness was “wait for the ledger,” not “Firestore is broken.”
2. **Put OpenAI behind `readReceiptImage`.** Browser cannot call `api.openai.com`. Deploy **by name only** after the owner sets `OPENAI_API_KEY` at a masked prompt. Staging first (localhost). Never `firebase deploy --only functions`.
3. **Deploy Storage rules** when the owner names `--only storage`, after a yes. Highest remaining hole if production is still on the old open rules.
4. **Rotate the OpenAI key** once the function works. The old `REACT_APP_OPENAI_API_KEY` lived in the client.

### Soon (Part C, additive / reversible — owner yes)

5. **Show the job’s `name` on invoice UI**, keep typed `projectName` as PDF history.
6. **Stop scanning all profiles.** Client is on the branch. Production leak still open. Backfill `publicProfiles` with `scripts/backfill-public-profiles.js` before rules. Hosting before rules.
7. **Paginate expenses** (page of 100–200) and **surface the 1,000 cap** until pagination exists (“showing first 1,000”).
8. **Archive instead of hard-delete** on expense/invoice delete buttons, or remove those buttons.
9. **Move Google Vision** to a function the same way as OpenAI, then remove `REACT_APP_GOOGLE_CLOUD_VISION_API_KEY`.

### When you add a third job, or Jobs home feels slow again

10. **Denormalise a summary on the job document**, updated in the same write as the expense/invoice (client today; callable later if you do not trust the client):

    ```
    projects/{jobId}
      summary.expenseCount
      summary.invoiceCount
      summary.paidTotal
      summary.costTotal
      summary.attentionCount
      summary.updatedAt
    ```

    Jobs home then reads **only job documents**. Dashboard still loads the ledger when you open a job. This is the single highest-leverage scaling change. It is a **write** to every job on every expense save, so it needs a plan, staging, and a yes. Idempotent backfill from existing expenses first.

11. **Optional:** `onWrite` Cloud Function to recompute summary if a client write is skipped. Deploy **by name**. Do not bundle it with a full functions deploy.

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
| `src/firebase/jobSummaries.js` | Why Jobs home is heavy |
| `src/firebase/directories.js` | Client / supplier / labour upsert |
| `src/firebase/partyName.js` | Canonical names |
| `scripts/backup-production.js` | Backup before writes |
| `scripts/backfill-job-ids.js` | Already applied |
| `scripts/split-directory-parties.js` | Already applied |

---

## 10. Rules for later agents

- Do not hard-delete user records.
- Do not run production schema or data writes without a backup, a staging run, and an explicit yes.
- Do not `firebase deploy --only functions` (would delete leftover `generateWeeklyReport` on production). Deploy functions **by name**.
- Do not accept a pasted API key.
- Do not “fix” localhost receipts by pointing `.env.local` at production.
- If chat and this file disagree, this file plus `CLAUDE.md` / `PROGRESS.md` win.

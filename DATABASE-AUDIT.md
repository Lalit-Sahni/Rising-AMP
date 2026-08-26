# Database audit — Phase 5 Part A

**Status:** Part A written 2026-08-26 (read-only scan). Part B is on staging only. Production data was not changed.  
**Scanned:** 26 August 2026, read-only, production `rising-amp-467702-b5` (default database) and staging `rising-amp-staging`.  
**Shopfront:** https://risingamp.com.au  
**Stop here for production.** Part B is on staging only until a second owner yes.

How this was measured: `scripts/audit-database-readonly.js` walked every Firestore document and listed Storage objects. Raw output is gitignored under `backups/phase5-audit-*`. This file is the committed report. Family emails and leftover PIN codes are not repeated here.

---

## Direct answer: is a job an ID, or a typed name?

**Both, and that is the core problem.**

1. **The job list is already a first-class record with a stable ID.** There are two live jobs:

   | Job document ID | Name on the job |
   |-----------------|-----------------|
   | `job-78b8dcb3ea6bb3c0` | 72 Centenary Dr |
   | `job-9dd078ccaa27d302` | Gurner St |

   Expenses, invoices, clients, and the rest of the tracker live *under* that ID:

   `organizations/opal-ss-constructions/projects/{jobId}/…`

   Parenting is by ID. Renaming the job document (the pencil on Jobs home) already changes the name on the card and in the header. It does **not** rewrite invoices.

2. **Invoices, the HIA contract, and client-details still store a free-text site name**, typed by hand, not the job ID. That is why the invoice screen shows the same site several ways. Live `projectName` values on the ten invoices (all of them sit under 72 Centenary Dr):

   - `72`
   - `72 ` (trailing space)
   - `72 Centenary Rd`
   - `72 Centenary Road ` (trailing space)
   - `72 Centenary Drive South Wentworthville`
   - `72 Centenary Road South Wentworthville`

   None of those ten invoices has a `jobId` or `projectId` field. The HIA contract and the client-details row store `72 centenary road` (lowercase, “road”). Gurner St has **no invoices**.

3. **Expenses do not store a job name at all.** They only exist under the parent job. There is no nested “saved projects” catalogue under either live job (`projects/{jobId}/projects` is empty). The expense form’s old “project name” picker is leftover UI; current categories do not collect it.

So: a job **can** be renamed without moving its expenses, because expenses hang off the ID. A job **cannot** be renamed without leaving invoices looking like a different site, because those screens print the typed string.

---

## 1. Current model (what is actually in the database)

Three root collections on production. Nothing else.

```
organizations/opal-ss-constructions
  name, ownerEmail, invitedEmails
  legacyWorkspaceIds, legacyWorkspaceNames   # leftover PIN folder map
  projects/{jobId}
    name, invitedEmails, orgId, legacyWorkspaceId
    accessCode, budget, expenses[]           # leftover from the PIN copy
    expenses/{id}
    invoices/{id}
    clients/{id}
    labour/{id}
    trades/{id}
    payers/{id}
    hiaContracts/{id}
    progressPayments/{id}
    clientDetails/{id}
    savedLabour/{id}, savedTrades/{id}, savedCompanies/{id}
    siteNames/{id}, projectPhases/{id}, workerHistory/{id}
    siteLogs/{id}                            # UI removed; rows still on production

profiles/{uid}                               # one per signed-in person

users/{accessCode}/…                         # leftover PIN copies, unused by the app
```

Production also has an empty named Firestore database `cost-tracker` (0 documents). Leave it.

**Counts (production org tree, the live app’s data):**

| Thing | 72 Centenary Dr | Gurner St | Total |
|--------|-----------------|-----------|-------|
| Expenses | 124 | 5 | 129 |
| Invoices | 10 (all `paid`) | 0 | 10 |
| Clients | 29 | 0 | 29 |
| Labour saved | 8 across jobs | | 8 |
| Trades saved | 23 | | 23 |
| HIA contracts | 1 | 0 | 1 |
| Progress payments | 1 | 0 | 1 |
| Site log rows | 5 | 0 | 5 |
| Profiles | | | 4, all marked complete |

Staging is the same two job IDs, but it has **drifted**: 124 org expenses not 129, Gurner invite list is shorter, org site-log rows were deleted on staging in Phase 1, extra leftover PIN tree, five profiles not four. **Do not migrate on today’s staging without a fresh copy of production.**

### 1.1 Organisation

One organisation: **Opal SS Constructions**.  
Owner is on the invite list. The org invite list is the door (`resolveInvitation` reads it first). Each job has its own `invitedEmails`. Invite stores Gmail dotted/undotted variants as extra array entries, so the raw counts look larger than the number of people.

There is no `members` subcollection. Membership is “is this email string in `invitedEmails`?”

### 1.2 Job document shape

Present on both jobs: `name`, `invitedEmails`, `orgId`, `legacyWorkspaceId`, `accessCode`, `budget`, `createdAt`, `migratedAt`, `updatedAt`.  
72 Centenary Dr also still has an `expenses` **array of two old objects** on the job document itself — a leftover from the PIN user doc. The real expenses are the 124 subcollection documents. The app reads the subcollection, not that array.

No `status`, `archived`, or `ownerUid`. Archive is not modelled. Create and delete are forbidden by rules (`allow create, delete: if false`).

### 1.3 Expense shape

Every live expense has `id`, `category`, `total` (number), `timestamp`, `notes`.  
Categories: labour 37, trade 30, purchase 29, service 23, equipment 10.

Money fields besides `total` are a mix of **strings and numbers** (`hours` all strings; `amount`/`cost`/`quantity` mostly strings; `rate` mostly numbers). The UI parses with `parseFloat`, so totals still add up.

`date` is missing on 10 expenses (9 of them equipment, which use `startDate`/`endDate` instead). Two equipment rows have empty start/end strings. No stored `"Invalid Date"` string on expenses.

Receipt fields (`receiptImageUrl` / `receiptImagePath`) exist on **10 of 129** expenses.

No `jobId` field. No `reviewed` field in use.

### 1.4 Invoice shape

All ten have a real Firestore timestamp for `invoiceDate` and `dueDate`, plus `invoiceNumber`, `status` (`paid`), `total`, line items, client fields, bank fields, and `projectName` as a string. `projectReference` is empty except one row (`0001025`).

No `jobId`. Totals (all paid) sum to **$812,500**. The HIA contract on the same job stores `totalAmount` **$1,250,000** — a different figure; the overview still uses paid invoices, not the HIA total (Phase 3 choice, still true).

### 1.5 Other tracker collections

- **clients:** 29 documents, almost all name-only autofill stubs. One has email/address/ABN.
- **clientDetails:** one row; its `projectId` field is the string `72 centenary road`, not the job document ID.
- **hiaContracts:** one row, `projectName: 72 centenary road`.
- **bankDetails:** none under the org jobs. One leftover copy still sits in a PIN test tree.
- **savedLabour / savedTrades / savedCompanies:** overlap with `labour` / `trades` / `clients` (old and new names for the same idea).
- **siteNames / projectPhases:** odd shapes (`name` stored as an array). Unused by the current UI.
- **siteLogs:** still on the production Centenary job (and in the matching PIN copy). Removed from the UI. Staging org copy was deleted in Phase 1.

### 1.6 Profiles

`profiles/{uid}`: name, role, mobile, business, ABN, address, photo, `setupComplete`, last sign-in. Four complete profiles on production. Any signed-in user may read them (see Security).

### 1.7 Leftover PIN trees (`users/`)

Five leftover trees on production (six on staging). Two are the family folders that were copied into the two jobs. One is a tester folder with extra leftover rows (including the only `bankDetails` document). Two are empty shells.

The live app does not read these. **Do not delete them in Part B.** List them; leave them, unless a later approved plan says otherwise **and** the owner asks.

---

## 2. Integrity

| Issue | What is true in the data | Severity |
|--------|--------------------------|----------|
| Invoice job names | Six spellings of the same Centenary site; none is the job ID; all ten invoices already live under the Centenary job ID | High (product / rename) |
| HIA / clientDetails job name | `72 centenary road` — a seventh spelling, and `clientDetails.projectId` is that string, not `job-78b8…` | High |
| No `jobId` on children | 0 of 129 expenses and 0 of 10 invoices carry a stable job id field. Parent path is the only ID | High for Part B |
| “Invalid Date” invoices | **Not stored.** All ten `invoiceDate` / `dueDate` values are valid timestamps. The words “Invalid Date” appear when some screens pass a Firestore Timestamp through `new Date(value)` (notably `ExpenseSummaryTable`). Invoice list/preview were patched to show an em dash instead. History shows an em dash. | Medium (UI, not data) |
| Uncategorised expenses | **None.** Every live expense has `category`. The Jobs home check would flag zero of these | Low (check can stay) |
| Missing receipts | 119 / 129 expenses have no receipt path. “What needs you” will look noisy | Medium (product) |
| Missing expense `date` | 10 rows (mostly equipment) | Low |
| Duplicate / stub clients | 28 of 29 clients are name-only | Low |
| Leftover `expenses[]` on the Centenary job doc | Two stale objects; unused | Low |
| PIN copy vs org copy | PIN trees have 133 expenses vs 129 in the org (tester/extra folders were not copied, and a few org rows were added after cutover). They can drift further | Medium (do not treat PIN as live) |
| Hard delete in the UI | History can delete an expense; Invoices can delete an invoice. That is a hard delete of user-created data, against this phase’s rule | High (behaviour) |
| Amount types | Strings and numbers mixed; parsing hides it | Low |
| Staging ≠ production | Invite lists and expense counts differ; staging has no Storage bucket | High **before any Part B write** |

Orphans: no invoice sits under the wrong job. No nested-project orphans (there are none). One extra receipt file in Storage under a leftover PIN prefix is not referenced by an org expense (see Storage).

---

## 3. Efficiency and cost

Firestore bills **per document read/write**, not per “page load”.

**Jobs home today** (`loadInvitedJobSummaries`): for every invited job it downloads **every expense, every invoice, and every client**, then derives margin in the browser. At today’s size that is on the order of **~200 reads per visit** for someone on both jobs.

| Scale | Rough Jobs-home reads per visit |
|--------|----------------------------------|
| Now (2 jobs, ~130 expenses) | ~200 |
| 10× jobs, same density | ~2,000 |
| 100× | ~20,000 |

Opening a job loads those collections **again**, plus labour, trades, payers, HIA, bank, progress payments.

**Other amplifiers:**

- Login runs `findProfileByEmail`, which **reads the entire `profiles` collection** (today 4; at 100 users that is 100 extra reads every sign-in). The people strip on a job uses a tighter `email in […]` query — that part is fine.
- `listOrgProjects` can count expenses/invoices with `limit(1000)` (another full scan). Jobs home uses the heavier path above.
- Expenses fetch is capped at 1,000 (`orderBy timestamp`). The 1,001st expense on a job would vanish without error.
- Duplicate-check queries (`labour` name+role, `trades` name+category) need **composite indexes**. Live `firestore.indexes` on production and staging are **empty**. Those checks likely fail closed and insert duplicates instead.
- Documents are small (largest ~3 KB site-log rows). Size is not the bill. **Read amplification is.**

Writes: each expense save also may write labour/trade/client/payer autofill documents. Invite writes the job **and** the org. That is acceptable at family scale.

**What gets expensive later:** keeping Jobs home as a full download; scanning all profiles on login; no pagination.

---

## 4. Security and isolation

### Organisation isolation

Tracker data is under `organizations/{orgId}/…`. Rules require the signed-in email (lowercased) to be on **that** org’s `invitedEmails` to read the org, and on **that job’s** `invitedEmails` to read a job. A second organisation, if it existed, would not share those lists. **Only one org exists**, and rules forbid creating another (`allow create: if false` on the org). Isolation holds for the current shape.

Job list queries use `resource.data.invitedEmails` with `array-contains`, which matches the rules. Subcollections `get()` the parent job’s invite list. That is correct.

Gaps:

- **Org door vs job membership.** If someone is on a job but missing from the org list, `resolveInvitation` treats them as not invited and they never see Jobs. Invite today writes both lists. Remove-person (Part B) must keep them in sync (org list = union of people still on any job).
- **Owner on a job** is only enforced when the job document is *updated* (owner email must remain in `invitedEmails`). A crafted client could not create a job (create is denied) but also **cannot archive, set status, or change budget** — updates may only touch `name`, `invitedEmails`, `updatedAt`. That is why “New job” was refused until now, and why Part B **must** change rules.
- **Any job member can write and delete subcollections** (expenses, invoices, the lot). There is no role split beyond “org owner can invite / rename.”
- **Profiles:** `allow read: if request.auth != null`. Anyone who can sign up can read every profile (name, mobile, ABN, address, photo). Login already downloads all of them.
- **`users/{accessCode}/**` is `if true`.** Leftover PIN copies of the family expenses and invoices are world-readable and world-writable to anyone who can guess or leak a short code. This is the highest security finding. Do not delete the data; **do close the rule.**
- **Storage `receipts/{…}/**` is `if true`.** Same class of hole for receipt images. Avatars are authenticated.

Gmail spelling: rules compare the exact lowercased string. Invite already stores variants. Removing a person must remove **all** variants.

---

## 5. Storage

Production bucket `rising-amp-467702-b5.firebasestorage.app`: **21 files, ~18 MB**.

| Prefix | Files | Notes |
|--------|-------|--------|
| `receipts/{legacy PIN}/…` | 9 | Original expense photos |
| `receipts/{jobId}/…` | 2 | New uploads; the app now passes the job document ID as the storage folder |
| `siteLogs/{legacy PIN}/…` | 9 | Unused by the UI; ~12 MB |
| `avatars/{uid}/…` | 1 | Profile photo |

Staging bucket does not exist (list returns 404). Missing receipts on localhost are expected. **Do not point localhost at production to “fix” that.**

Ten org expenses point at a receipt path; Storage has eleven receipt objects — one leftover file under a PIN prefix is not referenced from the org tree.

This layout will not scale as a platform, but it is fine for a family of two jobs if new files keep using `{jobId}` and old PIN paths are left in place (moving them would break stored URLs). Rules must require sign-in and membership before Part B is done.

---

## 6. Ranked issues

**P0 — fix in Part B (security + the four operations), after backup and staging**

1. Close leftover `users/**` `if true` rules (keep the documents).
2. Close Storage receipt `if true` rules; require signed-in membership.
3. Allow create-job / archive / membership-update in rules, owner-only where it matters; never hard-delete a job.
4. Four product operations: create job, archive job, add person (existing invite), remove person (revoke, keep their rows).
5. Backfill `jobId` on expenses, invoices, HIA, clientDetails (parent ID; no guessing from the six name spellings).
6. Refresh staging from a new production backup **before** any of the above writes. Today’s staging is not a faithful copy.

**P1 — Part C, additive / reversible**

7. Stop printing typed `projectName` as if it were the job. Show the job’s `name`. Keep the typed string on old invoices for the PDF history (`projectNameEntered` or leave the field as-is).
8. Replace hard delete of expenses/invoices with archive, or remove those buttons.
9. Restrict profile reads to people who share a job (or the org).
10. Flag, do not auto-rewrite, the six invoice name variants.
11. Stop the full `profiles` collection scan on login.

**P2 — cost, when the family grows**

12. Store summary figures on the job document so Jobs home does not download every expense.
13. Paginate expenses. Raise or remove the silent 1,000 cap with a real “load more”.
14. Add the missing composite indexes for labour/trade duplicate checks, or drop those queries.

**P3 — leave unless asked**

15. Leftover PIN trees (do not delete).
16. Site log rows and files.
17. Empty `cost-tracker` database.
18. Stale `expenses[]` on the Centenary job document (strip only as a documented, reversible field delete — not a user record).
19. Billing, Stripe, second product.

---

## 7. Target data model

Keep the Phase 1 tree. Do not invent a second job table. **The job is `organizations/{orgId}/projects/{jobId}`.**

```
organizations/{orgId}
  name
  ownerEmail
  invitedEmails          # union of people still on any active or archived job
  projects/{jobId}
    name
    orgId
    status               # "active" | "archived"
    archivedAt, archivedBy
    invitedEmails        # rules + list query (keep this; array-contains)
    formerEmails         # people removed; not used for access
    createdAt, updatedAt
    legacyWorkspaceId    # keep on the two old jobs so old receipt paths still resolve
    expenses/{expenseId}     # + jobId
    invoices/{invoiceId}     # + jobId, keep projectName as typed snapshot
    …existing tracker subcollections…
profiles/{uid}           # unchanged fields; tighter read rules
users/{accessCode}       # leftover; locked down, not deleted
```

**Rules of the model:**

- Everything the product calls a job points at `{jobId}`. The name is a label.
- New receipts: `receipts/{jobId}/{expenseId}/…`. Old PIN paths stay.
- Soft only: archive a job; revoke a person (`arrayRemove` from `invitedEmails`, record in `formerEmails`). Keep expenses and invoices they entered.
- Never remove the org owner from a job. Never delete the job document.
- New jobs get a new `job-{id}` (same pattern as cutover). No PIN code. Storage key = job id.
- Org `invitedEmails` stays in sync on add/remove so the door list matches membership.

New Cloud Functions are **not** required for this if rules allow the owner to create/update the job document. Do not deploy a full functions set.

---

## 8. Migration plan (only after a yes)

Every step is a script: dry-run default, idempotent, reversible. Staging first, production only behind a separate yes and a fresh backup whose restore has been tested.

### 8.1 Before any write

1. `node scripts/backup-production.js` (new dated folder).
2. Restore that backup onto **staging** (today’s staging has drifted).
3. Confirm localhost still uses `.env.local` → staging.
4. Propose the rules diff; do not deploy it until the backfill dry-run looks right.

### 8.2 Staging

1. **Rules (staging only):**  
   - Owner may `create` a project under the family org, with `status: active` and owner on `invitedEmails`.  
   - Owner may update `status`, `archivedAt`, `archivedBy`, `formerEmails` as well as name/invites.  
   - `delete` of a job stays `false`.  
   - `users/{accessCode}/**` → deny (or authenticated owner read-only).  
   - Storage receipts → signed-in only; path folder must be a job the user is on, or a `legacyWorkspaceId` of such a job.  
   - Profile read: signed-in, and (own uid **or** email listed on a job they can read).
2. **Backfill `jobId`** on every child document from its parent path. Dry-run prints counts; apply writes only the missing field. No deletes. No rewriting `projectName`.
3. **App, on staging:**  
   - Create job (owner).  
   - Archive / unarchive (owner); archived jobs do not crash; they are hidden on Jobs home unless “Show archived”.  
   - Add person: existing invite flow.  
   - Remove person: cannot remove the owner; removed user hitting a cached job gets a calm “you no longer have this job” and lands on Jobs home.  
   - New expense/invoice writes include `jobId`. Invoice UI shows the job name; typed `projectName` still saved for the PDF.  
   - Receipt upload keeps using `{jobId}`.
4. Edge cases to click through: archived job, job with only the owner, remove someone while they have the job open, rename after `jobId` backfill (invoices must still belong to the job).

### 8.3 Production

Same backup → restore test → owner yes → apply backfill → deploy **hosting + firestore rules + storage rules** with explicit `--only`. No `firebase deploy --only functions`.

### 8.4 Part C (after B is live)

Integrity flags and docs (`ARCHITECTURE.md`, this file, `PROGRESS.md`, `CLAUDE.md`). Deduplicate display of job names. Optional: strip the stale `expenses[]` on the Centenary job doc. Still no hard deletes of user rows. Still no PIN-folder deletion unless the owner asks.

---

## 9. What I need from you

Please confirm or correct:

1. **The job is the existing `projects/{jobId}` document** (72 Centenary Dr and Gurner St), not a new nested “site” inside them. That matches the live data.
2. **Part B order:** refresh staging from a new production backup, then rules + `jobId` backfill + the four operations, then production behind a second yes.
3. **Close the open `users/` and receipt Storage rules** as part of Part B (data stays).
4. **Leave PIN trees, site logs, and `cost-tracker` alone.**
5. Anything in the ranked list you want **out** of Part B (for example profile-read tightening can wait for Part C).

No production schema or data writes until that yes.

# Phase 5 — Jobs, Members, and a Database Audit (closed record)

**Closed 2026-08-27.** Live: jobs as stable IDs, create / archive job, add / remove person, clients vs suppliers vs service providers, `jobId` backfill, `DATABASE.md`, OpenAI receipt reads via `readReceiptImage`. Leftovers moved to `PHASE6.md` (invoice typed names, profile scan, Storage rules deploy, expense pagination).

Read `CLAUDE.md` then `PROGRESS.md` then `PHASE6.md` for current work.

---

# Phase 5 — Jobs, Members, and a Database Audit (agent brief)

Read `CLAUDE.md` then `PROGRESS.md` then this file before touching anything. Open `design/risingamp-vision.html` in a browser.

Branch: **`phase-5-jobs-members`**, created from `phase-4-domain-email` (2026-08-26). Phases 1–4 are live. Shopfront: `https://risingamp.com.au`. Localhost still uses **staging**. Never commit to `master` or `main`.

This is the **same family app and the same irreplaceable data**. It is the first phase that deliberately authorises schema and data-structure changes. That is why earlier sessions refused “New job” writes and record deletes: those rules protected a live cutover. They did their job. Phase 5 lifts them **under the heightened process below**, because this phase is about the data model itself.

`CLAUDE.md` must already say that (updated when this branch opened). If a later edit puts the old ban back, stop and fix `CLAUDE.md` before any migration. Do not start Part B until the owner approves the Part A plan.

## Heightened process (strongest here)

- Nothing runs against **production** Firestore or Storage without a full backup and a tested restore first.
- All schema and data migrations happen on **staging** (`rising-amp-staging`) loaded with a copy of production data, are verified there, and run against production only behind an explicit owner yes.
- Every migration is a reversible, idempotent, dry-runnable script, reviewed before it runs.
- Destructive user actions are **soft, never hard**. Archiving a job keeps its records. Removing a person revokes access and keeps the data they entered. Nothing user-created is hard-deleted.
- Propose before executing. One change at a time. The app stays working throughout.
- Never `firebase deploy --only functions` to production (would delete leftover `generateWeeklyReport`). Deploy functions only if this brief names them, and then **by name**.
- Never accept a raw API key or secret pasted into chat.

## What is already live (do not redo)

- Google or email/password login. Shopfront Google login uses `authDomain` `risingamp.com.au` plus the OAuth redirect `https://risingamp.com.au/__/auth/handler`.
- Jobs home, job overview, capture, profiles, `/privacy` and `/terms`.
- Invites: Resend `sendJobInviteEmail` from `invites@risingamp.com.au`, Gmail still a fallback. **Do not remove Gmail** unless the owner asks after a real live Resend invite.
- Tracker data lives under `organizations/opal-ss-constructions/projects/{projectId}/…`. Profiles at `profiles/{uid}`. Old `users/{accessCode}` PIN trees still exist as unused copies — list them in the audit; do not delete them unless the approved plan says so **and** the owner asks.

## Part A — Database audit (do this first, change nothing)

Produce a written assessment **before touching data or rules**. Map the real current state; do not assume. Jobs at `projects/{projectId}` already have document IDs — the invoice screens still show the same site written several ways (`72 Centenary Drive South`, `72 Centenary Road South`, `72 Centenary Rd`), which may mean **some** records still store a free-text job name instead of (or as well as) the project ID. Prove that in the audit. Do not guess.

Deliverable: **`DATABASE-AUDIT.md`**, covering:

- **Current model:** every collection, subcollection, and document shape, and how jobs, expenses, invoices, receipts, users, organisations, and memberships relate today. State clearly whether a job is a first-class record with a stable ID, or is referenced by a free-text string (or both).
- **Integrity:** inconsistent job references, orphaned records, duplicates, invalid or missing fields (including “Invalid Date” invoices and uncategorised expenses), leftover code-keyed `users/` trees.
- **Efficiency and cost:** query patterns and whether they scale, read/write amplification, missing or unused indexes, oversized documents, and what gets expensive at 10× and 100× the data. Firestore bills per operation.
- **Security and isolation:** whether the rules actually stop one organisation reading another’s data, and whether access to a job follows its membership. Note leftover `users/{accessCode}/**` `if true` rules.
- **Storage:** how receipt images are organised and whether that scales. Staging still has no Storage bucket; localhost missing receipts are expected — do not point localhost at production to “fix” that.

Then propose a **target data model** and a **migration plan** to reach it, every issue ranked by severity. Stop. Get owner approval on that plan before Part B.

## Part B — Jobs as first-class entities, and membership

Only after the owner approves the Part A plan:

- Make a job a proper record with a stable ID that everything else references, so a job’s **name** can change without breaking expenses and invoices. Migrate existing free-text job references onto those IDs. Staging first, behind a backup, reversible, then production behind a separate yes.
- Four operations in the product: **create a job**, **archive a job** (soft delete, recoverable, keeps records), **add a person** (reuse the existing invite flow), **remove a person** (revoke access, reversible, keep the data they entered).
- Update security rules so access to a job follows membership and organisation isolation holds.
- Interface edge cases: an archived job, a job with no members, a person removed while they were using it, and **never** leaving a job with no owner. Nothing should crash or show orphaned data.

## Part C — Clean up and document

- Fix integrity issues the audit found, where it is safe: deduplicate job references, correct or clearly flag invalid data. Additive and reversible. Never by deleting user records.
- Update `ARCHITECTURE.md`, `DATABASE-AUDIT.md`, `PROGRESS.md`, and `CLAUDE.md` to match the new model.

## Out of scope

- Billing, Stripe, a second product.
- Phase 4 leftovers (Gmail invite fallback, `www` SSL, leftover `generateWeeklyReport`) unless the owner names them.
- Pointing localhost at production.
- Inventing legal text or accepting pasted secrets.

## Continuity

- Small reviewable steps. Propose each risky diff before applying.
- Keep `CLAUDE.md` and `PROGRESS.md` current as you go.
- Order: Part A (audit, no writes) → owner yes → Part B (staging migration + four operations + rules) → owner yes for production → Part C (integrity + docs).

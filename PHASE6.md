# Phase 6 — Integrity and follow-through (agent brief)

Read `CLAUDE.md` then `PROGRESS.md` then this file before touching anything. Open `design/risingamp-vision.html` in a browser.

Branch: **`phase-6-integrity`**, created from `phase-5-jobs-members` (2026-08-27). Phases 1–5 are live. Shopfront: `https://risingamp.com.au`. Localhost still uses **staging**. Never commit to `master` or `main`.

This is still the same family app and the same irreplaceable data. Phase 5 made jobs real records and wrote `DATABASE.md`. Phase 6 is the safe follow-through from that guide — **no new product, no billing, no second company**.

## Heightened process (unchanged)

- Nothing runs against **production** Firestore or Storage without a full backup and a tested restore first.
- Staging first. Production only behind an explicit owner yes.
- Soft deletes only. Never hard-delete user records.
- Propose before executing.
- Never `firebase deploy --only functions` to production (would delete leftover `generateWeeklyReport`). Deploy functions **by name only**.
- Never accept a raw API key or secret pasted into chat.
- Hosting: `firebase deploy --project production --only hosting` when the owner names hosting.

## What is already live (do not redo)

- Jobs as `organizations/opal-ss-constructions/projects/{jobId}`: create, archive, invite, remove person.
- Clients vs suppliers vs service providers.
- `readReceiptImage` on staging and production. OpenAI only; if it fails, the scanner shows an error (no Tesseract / Vision fake read).
- `DATABASE.md` is the living database guide.

## What this phase is for

Work from `DATABASE.md` section 7 (“Soon” and “When you add a third job”). One slice at a time. First slice is the owner’s pick from the list below.

**Integrity (additive, reversible)**

1. Invoice UI shows the job’s `name`. Keep typed `projectName` on old invoices as a PDF snapshot.
2. Stop scanning every `profiles` document on login. Then tighten profile read rules without locking people out of their own profile.
3. Paginate expenses (or clearly say “showing first 1,000”) so the silent cap cannot lie about margin.
4. Archive expenses/invoices instead of hard-delete, or remove those delete buttons.

**Ops the owner must name**

5. Deploy Storage rules (`--only storage`) so production receipts match the repo rules.
6. Hosting deploy for any UI that is only on the branch until he asks.

**Later, when Jobs home feels slow again**

7. Denormalised summary fields on the job document (write plan, staging, yes). Do not do this on day one.

## Out of scope unless asked

- Billing, Stripe, a second organisation.
- Deleting leftover PIN trees or site logs.
- Pointing localhost at production.
- Removing the Gmail invite fallback, `www` SSL, leftover `generateWeeklyReport`.
- New npm packages.

## Continuity

- Small reviewable steps. Get a yes before production writes or named deploys.
- Keep `CLAUDE.md` and `PROGRESS.md` current.
- Prefer `DATABASE.md` over `DATABASE-AUDIT.md` when they disagree.

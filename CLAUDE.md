# Rising AMP — Agent source of truth

Read this file at the start of every session. It beats anything said in chat.

This is a live production app for Opal SS Constructions. It holds real, irreplaceable business data. Prefer shipping nothing over risking what already exists.

## Next agent — start here (do this first)

1. Confirm git branch. Latest work is **`phase-11-cold-start`**. Phase 10 Cost Plan is live. Phase 11 Parts A–E are on the branch. Staging has `maintainLedgerRollup`, Part E Firestore rules and rollup docs. **Not deployed to production.** Next is the Part E production list in `PHASE11.md` (owner runs it or names it). Restore tag: `pre-phase11-2026-09-05`. Never commit to `master` or `main`. Older restore tags: `pre-phase10-2026-09-02`, `pre-phase10-2026-08-31`, `pre-phase9-2026-08-31`, `pre-phase8-2026-08-28`, `pre-phase7-2026-08-28`, `pre-phase6-2026-08-27`, `pre-phase1-2026-08-22`.
2. Read `PROGRESS.md` (next concrete step), then `PHASE11.md`. Open `design/risingamp-vision.html` before changing the shell. `PHASE10.md` is the closed Cost Plan record. `PHASE9.md` through `PLAN.md` are closed records. `ARCHITECTURE.md` is how the running app is built. `DATABASE.md` is the living database guide.
3. Localhost (`npm start` → http://localhost:3000, **Vite**) must use `.env.local`, which points at **staging** (`rising-amp-staging`). Production keys are in gitignored `.env.production.local`. Do not swap them. Env vars are `VITE_*`. `npm start` does not register a service worker; `npm run build` then `npm run preview` does.
4. Family access codes and owner email live in gitignored `.phase1-local.json`. Do not commit that file. Do not put the codes in git.
5. **Next:** The owner runs the Part E production list in `PHASE11.md` (or names that list). Backup first (`npm run backup:production`). Then function `maintainLedgerRollup` **with no `--force`**, then Firestore rules, then recompute dry-run / apply / dry-run-must-be-zero, then hosting. Staging has `maintainLedgerRollup`, Part E Firestore rules, and rollup docs. Production function, rules and hosting are not deployed. Do not deploy unless he names the project and surface. Do not use `--force` on a functions deploy.
6. **Never accept a raw API key or secret pasted into chat.** Have the owner set Firebase secrets himself at a masked prompt.
7. **All new files are TypeScript.** Existing JS converts only when a brief says so, or when the file is being substantially rewritten anyway.
8. Owner (Lalit) writes in plain language. Explain in plain language.

**Paste this to start a new chat:**

> Read CLAUDE.md, then PROGRESS.md, then PHASE11.md. Phase 11 Parts A–E are on `phase-11-cold-start`. Staging has `maintainLedgerRollup` and rollup docs; production is not deployed. Localhost stays on staging. Restore tag: pre-phase11-2026-09-05. Next is the Part E production list in PHASE11.md (backup first; no `--force`; second dry-run must be zero before hosting). Never hard-delete user records. Never accept a pasted API key. Do not deploy unless named.

If you are unsure whether a command writes to production, do not run it.

## Prime directive

- This is a live app with real, irreplaceable data. **Phase 8 is closed** (foundations). Profile leak is closed on production (owner-only `profiles`, public name/photo cards, verified from a second account that is not on any family job). Database follow-through is parked in `PHASE6-INTEGRITY.md`. Phase 5’s heightened process still applies.
- Nothing runs against **production** Firestore or Storage without a full backup and a tested restore first. Staging first, production only behind an explicit yes.
- No hard deletes of user-created data from the live list. Archive a job; **void** an invoice or expense (Recently deleted); revoke a person’s access. Permanent delete is only from Recently deleted, and only after the row is already voided.
- Before any change that has side effects, stop, write a plan, and wait for explicit human approval. Propose first, execute second.
- All work happens on a branch, never on `master` or `main`.
- Day-to-day work uses **staging** (`rising-amp-staging`). Localhost must keep pointing there.
- Production (`rising-amp-467702-b5`) is the live family app. Git push does not deploy; live only changes on `firebase deploy --project production` with an explicit `--only` the owner named.
- Every data migration is a reversible, idempotent, dry-runnable script, reviewed before it runs.
- When unsure, ask. A withheld change is cheap. A broken production build is not.

## How to preview work

- Day-to-day: `npm start` → http://localhost:3000 (Vite, staging). After Google or email login, complete profile if asked, then **Jobs**.
- Saved-app copy (service worker) on the same port against staging: `npm run preview:staging`. This is a production-style build pointed at staging, not `npm start`. It takes port 3000.
- Live shopfront: https://risingamp.com.au (same app as https://rising-amp-467702-b5.web.app)
- Design mockup (Phase 3): `design/risingamp-vision.html`
- Job Files vision (Phase 9): `design/risingamp-files-vision.html`
- Cost Plan vision (Phase 10): `design/risingamp-costplan-vision.html`
- Auth mockups: `design/risingamp-auth.html`, `design/risingamp-signin-email.html`
- Live look (Phase 2): `design/opal-track-reference.html`
- Never run `firebase deploy` against production unless the owner explicitly asks. Part E production order is the list in `PHASE11.md` (backup first; no `--force`; second dry-run must be zero before hosting). Hosting only when named: `firebase deploy --project production --only hosting`. Do not deploy functions, Firestore rules, or Storage unless he names them. Production functions are `sendJobInviteEmail`, `readReceiptImage`, `allocateInvoiceNumber`, `checkEstimateImport` and `readQuoteFile`. Deploy functions **by name**. **No `--force`.**

## Environments

| Alias | Firebase project ID | Role |
|--------|---------------------|------|
| production | `rising-amp-467702-b5` | Live family app (Google or email/password, org + job lists). |
| staging | `rising-amp-staging` | Copy of production data. Localhost and experiments. `.firebaserc` default is staging. |

What matters is **which database the app points at**, not local versus deployed.

## Access model (live)

Google or email/password via Firebase Auth (email/password is on **staging and production**). After login, anyone can use the app. Family jobs still only show for emails on that job’s invite list (Firestore rules). Tracker data lives under `organizations/{orgId}/projects/{projectId}/…` (Opal id `opal-ss-constructions`). User profiles live under `profiles/{uid}` (owner-only read of private fields). Job people chips read `publicProfiles/{email}` (display name and photo only). Old `users/{accessCode}` trees still exist as unused copies. Do not delete them unless the owner later asks.

## Phase 1 (closed 2026-08-23)

Google login, one org, two named job lists, per-job invites, Site Log / Weekly Report removed from the UI. Do not re-run cutover scripts.

## Phase 2 (closed 2026-08-23)

Visual overhaul is live on production hosting. Brief: `PHASE2.md`. Look: `design/opal-track-reference.html` (Manrope, Palette 1). Colour lives in the data (dots, icons, bars), never on card furniture. Do not re-run the restyle. Do not add mockup-only features.

## Phase 3 (closed 2026-08-23; live hosting; localhost still staging)

Same app, same data. Brief: `PHASE3.md`. Mockup: `design/risingamp-vision.html`. Jobs home, job overview (verdict + what needs you), RisingAMP naming, OCR “Check this”, open sign-up + profiles. **No New job write** until Phase 5 Part B.

## Phase 4 (closed 2026-08-26; live)

Brief: `PHASE4.md`. Legal pages, Resend invite function on staging and production (`invites@risingamp.com.au`), shopfront `https://risingamp.com.au`, Google login on that domain. Gmail invite fallback still in the client until the owner asks to remove it. Production functions are `sendJobInviteEmail`, `readReceiptImage`, `allocateInvoiceNumber`, `checkEstimateImport` and `readQuoteFile`; deploy **by name**.

## Phase 5 (closed 2026-08-27; live)

Brief: `PHASE5.md`. Jobs as stable IDs, create / archive / invite / remove, clients vs suppliers, `DATABASE.md`, OpenAI via `readReceiptImage`. Leftovers are in `PHASE6.md`.

## Phase 6 (closed 2026-08-28; live hosting)

Brief: `PHASE6.md`. Unreachable code cut. Receipt scan stays OpenAI Cloud Function only. Hosting live. Database integrity leftovers: `PHASE6-INTEGRITY.md`. Staging now has a Storage bucket for localhost receipts. Production Storage rules still not deployed.

## Phase 7 (closed 2026-08-28; live hosting)

Brief: `PHASE7.md`. Safe areas, `default` status bar, pinch zoom, selectable content. Layout and metadata only. Manifest / new icons skipped on purpose. Measured standalone portrait: `t:0 r:0 b:34 l:0`.

## Phase 8 (closed 2026-08-28; live hosting)

Brief: `PHASE8.md`. Vite, routes, integer cents, server invoice numbers (`YYYY-0001`), void not delete, tighter rules, org from membership. Profile leak closed on production and verified from a second account that is not on a family job. App Check client is present; **do not enforce**. Restore tag: `pre-phase8-2026-08-28`. **New files are TypeScript; existing files convert only when a brief says so.**

## Phase 9 (closed 2026-08-31; live hosting, Firestore rules, Storage rules)

Brief: `PHASE9.md`. Mockup: `design/risingamp-files-vision.html`. Branch: `phase-9-job-files`. Restore tag: `pre-phase9-2026-08-31`. Job files live on a job with a fixed type list, thumbnails, a 25 MB cap, no video, no folders, and a handover pack. Production Storage rules are live (receipts are no longer world-open). No new Cloud Functions. Localhost stays on staging.

## Phase 10 (live on production hosting and Firestore rules, 2 Sep 2026)

Brief: `PHASE10.md`. Mockup: `design/risingamp-costplan-vision.html`. Branch: `phase-10-cost-plan`. Restore tags: `pre-phase10-2026-09-02` (before staging rules), `pre-phase10-2026-08-31` (this phase). Parts A–E are live: target cost, trade amounts, expense coding, quotes, spreadsheet import (Excel/CSV, layout reader, file-total gate), job kind and attention. Jobs without a plan still work; Cost Plan is in the job nav. Spend comes from active expenses, not paid invoices, and is hidden when the 1,000-expense cap is reached. **Production hosting and Firestore rules were deployed 2 Sep 2026.** Storage rules were not redeployed: quote files use the existing Files path, already live since Phase 9 (31 Aug 2026). `checkEstimateImport` is live on staging and production (2 Sep 2026). `readQuoteFile` reads a quote photo or PDF onto the Cost Plan quote form. Production functions are `sendJobInviteEmail`, `readReceiptImage`, `allocateInvoiceNumber`, `checkEstimateImport` and `readQuoteFile`.

## Out of scope until asked

- Billing, Stripe, a second product, deleting leftover PIN folders unless the owner asks, deploying functions beyond what the current phase names, new npm packages except the list already in `PHASE8.md` and `vite-plugin-pwa` for Phase 11 Part A, Phase 4 Gmail-fallback removal, a service worker **offline queue**, App Check **enforcement** until staging traffic is clean, normalising stored money fields, dismantling the remaining AppContext ledger blob

## Continuity

- `AGENTS.md` — pointer. Read this file, then `PROGRESS.md`.
- `PHASE11.md` — Cold start — active brief.
- `PHASE10.md` — Cost Plan — closed record.
- `PHASE9.md` — Job Files — closed record.
- `PHASE8.md` — foundations / technical revamp — closed record.
- `PHASE7.md` — app feel on a phone — closed record.
- `PHASE6.md` — legacy cut — closed record.
- `PHASE6-INTEGRITY.md` — parked database follow-through; not this branch.
- `PHASE5.md` — jobs, members, database audit — closed record.
- `PHASE4.md` — domain, Resend, legal pages — closed record.
- `PHASE3.md` — Phase 3 vision brief — closed record.
- `PHASE2.md` — Phase 2 restyle record (complete).
- `PROGRESS.md` — next concrete step. Update at session end.
- `PLAN.md` — Phase 1 record (complete).
- `ARCHITECTURE.md` — how the running app is built.
- `DATABASE.md` — living database guide (model, weaknesses, scale). Prefer this over the audit when they disagree.
- `DATABASE-AUDIT.md` — Phase 5 Part A scan (26 Aug 2026; plan approved). Historical counts.
- Small sessions: one checklist item, then commit on the branch.

## Owner working style

Lalit can read diffs and plans and knows the system, but is not a full-time engineer. Explain tradeoffs plainly. Show the plan, get the yes, then act in small reviewable steps. Prefer boring, safe, well-tested moves over clever ones. If a Google Cloud click is required, give numbered steps or do it from this machine when the Firebase CLI is already logged in.

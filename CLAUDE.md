# Rising AMP — Agent source of truth

Read this file at the start of every session. It beats anything said in chat.

This is a live production app for Opal SS Constructions. It holds real, irreplaceable business data. Prefer shipping nothing over risking what already exists.

## Next agent — start here (do this first)

1. Confirm git branch. Work is on **`phase-5-jobs-members`** (created from `phase-4-domain-email`, 2026-08-26). Phases 1–4 are live. Localhost still uses **staging**. Never commit to `master` or `main`. Restore tag if you need to unwind Phase 1: `pre-phase1-2026-08-22`.
2. Read `PROGRESS.md` (next concrete step), then `PHASE5.md` (current phase: database audit, then jobs as records and membership). `PHASE4.md`, `PHASE3.md`, `PHASE2.md`, and `PLAN.md` are closed records. `ARCHITECTURE.md` is how the running app is built. Open `design/risingamp-vision.html` in a browser.
3. Localhost (`npm start` → http://localhost:3000) must use `.env.local`, which points at **staging** (`rising-amp-staging`). Production keys are in gitignored `.env.production.local`. Do not swap them.
4. Family access codes and owner email live in gitignored `.phase1-local.json`. Do not commit that file. Do not put the codes in git.
5. **Next:** Phase 5 Part B (jobs/members) and the clients vs suppliers split are **live on production** (2026-08-27). Localhost still uses staging. Part C is integrity + docs. See `PHASE5.md`.
6. **Never accept a raw API key or secret pasted into chat.** Have the owner set Firebase secrets himself at a masked prompt.
7. Owner (Lalit) writes in plain language. Explain in plain language.

**Paste this to start a new chat:**

> Read CLAUDE.md, then PROGRESS.md, then PHASE5.md. Open design/risingamp-vision.html. Work is on branch phase-5-jobs-members (from phase-4-domain-email). Shopfront is https://risingamp.com.au. Localhost stays on staging. Part A is done and approved. Part B (jobs/members) and the clients vs suppliers split are live on production (2026-08-27). Never hard-delete user records. Never accept a pasted API key. Do not deploy a full functions set to production (that would delete generateWeeklyReport).

If you are unsure whether a command writes to production, do not run it.

## Prime directive

- This is a live app with real, irreplaceable data. **Schema and data-structure changes are in scope for Phase 5**, and they are the highest-risk work in the project. They follow the heightened process in `PHASE5.md`, not a free-for-all.
- Part A (`DATABASE-AUDIT.md`) is **read-only**. Do not migrate, rewrite, or delete anything until the owner approves that plan.
- Nothing runs against **production** Firestore or Storage without a full backup and a tested restore first. Staging first, production only behind an explicit yes.
- No hard deletes of user-created data. Archive a job; revoke a person’s access. Keep the records they entered.
- Before any change that has side effects, stop, write a plan, and wait for explicit human approval. Propose first, execute second.
- All work happens on a branch, never on `master` or `main`.
- Day-to-day work uses **staging** (`rising-amp-staging`). Localhost must keep pointing there.
- Production (`rising-amp-467702-b5`) is the live family app. Git push does not deploy; live only changes on `firebase deploy --project production` with an explicit `--only` the owner named.
- Every data migration is a reversible, idempotent, dry-runnable script, reviewed before it runs.
- When unsure, ask. A withheld change is cheap. A broken production build is not.

## How to preview work

- Day-to-day: `npm start` → http://localhost:3000 (staging). After Google or email login, complete profile if asked, then **Jobs**.
- Live shopfront: https://risingamp.com.au (same app as https://rising-amp-467702-b5.web.app)
- Design mockup (Phase 3): `design/risingamp-vision.html`
- Auth mockups: `design/risingamp-auth.html`, `design/risingamp-signin-email.html`
- Live look (Phase 2): `design/opal-track-reference.html`
- Never run `firebase deploy` against production unless the owner explicitly asks. Hosting only: `firebase deploy --project production --only hosting`. Do not deploy functions, Firestore rules, or Storage unless he names them. Never `firebase deploy --only functions` to production (would delete leftover `generateWeeklyReport`).

## Environments

| Alias | Firebase project ID | Role |
|--------|---------------------|------|
| production | `rising-amp-467702-b5` | Live family app (Google or email/password, org + job lists). |
| staging | `rising-amp-staging` | Copy of production data. Localhost and experiments. `.firebaserc` default is staging. |

What matters is **which database the app points at**, not local versus deployed.

## Access model (live)

Google or email/password via Firebase Auth (email/password is on **staging and production**). After login, anyone can use the app. Family jobs still only show for emails on that job’s invite list (Firestore rules). Tracker data lives under `organizations/opal-ss-constructions/projects/{projectId}/…`. User profiles live under `profiles/{uid}`. Old `users/{accessCode}` trees still exist as unused copies. Do not delete them unless the owner later asks.

## Phase 1 (closed 2026-08-23)

Google login, one org, two named job lists, per-job invites, Site Log / Weekly Report removed from the UI. Do not re-run cutover scripts.

## Phase 2 (closed 2026-08-23)

Visual overhaul is live on production hosting. Brief: `PHASE2.md`. Look: `design/opal-track-reference.html` (Manrope, Palette 1). Colour lives in the data (dots, icons, bars), never on card furniture. Do not re-run the restyle. Do not add mockup-only features.

## Phase 3 (closed 2026-08-23; live hosting; localhost still staging)

Same app, same data. Brief: `PHASE3.md`. Mockup: `design/risingamp-vision.html`. Jobs home, job overview (verdict + what needs you), RisingAMP naming, OCR “Check this”, open sign-up + profiles. **No New job write** until Phase 5 Part B.

## Phase 4 (closed 2026-08-26; live)

Brief: `PHASE4.md`. Legal pages, Resend invite function on staging and production (`invites@risingamp.com.au`), shopfront `https://risingamp.com.au`, Google login on that domain. Gmail invite fallback still in the client until the owner asks to remove it. Unused `generateWeeklyReport` still on production — deploy functions **by name only**.

## Phase 5 (in progress, branch `phase-5-jobs-members`)

Brief: `PHASE5.md`. Database audit first (`DATABASE-AUDIT.md`, no writes). Then, only after owner yes: jobs as stable IDs, create / archive job, add / remove person, rules that follow membership. Soft deletes only.

## Out of scope until asked

- Billing, Stripe, a second product, deleting leftover PIN folders unless the approved Phase 5 plan says so, deploying functions beyond what `PHASE5.md` names, new npm packages (fonts via Google Fonts are OK), Phase 4 Gmail-fallback removal

## Continuity

- `AGENTS.md` — pointer. Read this file, then `PROGRESS.md`.
- `PHASE5.md` — current phase brief (audit, then jobs and membership).
- `PHASE4.md` — domain, Resend, legal pages — closed record.
- `PHASE3.md` — Phase 3 vision brief — closed record.
- `PHASE2.md` — Phase 2 restyle record (complete).
- `PROGRESS.md` — next concrete step. Update at session end.
- `PLAN.md` — Phase 1 record (complete).
- `ARCHITECTURE.md` — how the running app is built.
- `DATABASE-AUDIT.md` — Phase 5 Part A deliverable (written 2026-08-26; plan approved).
- Small sessions: one checklist item, then commit on the branch.

## Owner working style

Lalit can read diffs and plans and knows the system, but is not a full-time engineer. Explain tradeoffs plainly. Show the plan, get the yes, then act in small reviewable steps. Prefer boring, safe, well-tested moves over clever ones. If a Google Cloud click is required, give numbered steps or do it from this machine when the Firebase CLI is already logged in.

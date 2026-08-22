# Rising AMP — Agent source of truth

Read this file at the start of every session. It beats anything said in chat.

This is a live production app for Opal SS Constructions. It holds real, irreplaceable business data. Prefer shipping nothing over risking what already exists.

## Next agent — start here (do this first)

1. Confirm git branch. **Phase 2 is live** on `phase-2-visual` (hosting deployed 2026-08-23). Phase 1 is on `phase-1-foundation`. **Phase 3 is on `phase-3-vision` (from `phase-2-visual`). Step 0 is parked — wait for a yes on the mockup-vs-live table before any `src/` work.** Never commit to `master` or `main`. Restore tag if you need to unwind Phase 1: `pre-phase1-2026-08-22`.
2. Read `PROGRESS.md` (next concrete step), then `PHASE3.md` (the vision brief). `PHASE2.md` and `PLAN.md` are closed records. `ARCHITECTURE.md` is how the running app is built. Open `design/risingamp-vision.html` in a browser.
3. Localhost (`npm start` → http://localhost:3000) must use `.env.local`, which points at **staging** (`rising-amp-staging`). Production keys are in gitignored `.env.production.local`. Do not swap them.
4. Family access codes and owner email live in gitignored `.phase1-local.json`. Do not commit that file. Do not put the codes in git.
5. **Next:** Wait for Lalit to approve the mockup-vs-live table in `PHASE3.md`. Do not change `src/`. Do not add “New job”. Do not rename Opal Track to RisingAMP. Do not deploy.
6. Owner (Lalit) writes in plain language. Explain in plain language.

**Paste this to start a new chat:**

> Read CLAUDE.md, then PROGRESS.md, then PHASE3.md. Open design/risingamp-vision.html. Step 0 is done on phase-3-vision. Wait for a yes on the mockup-vs-live table. Do not change src/ until then.

If you are unsure whether a command writes to production, do not run it.

## Prime directive

- Do not run any destructive or irreversible operation against production Firestore or Storage. No hard deletes, no in-place data mutation, no schema changes against production unless the owner asked after a backup.
- Before any change that has side effects, stop, write a plan, and wait for explicit human approval. Propose first, execute second.
- All work happens on a branch, never on `master` or `main`.
- Day-to-day work uses **staging** (`rising-amp-staging`). Localhost must keep pointing there.
- Production (`rising-amp-467702-b5`) is the live family app. Write to it only after a backup and an explicit yes. Git push does not deploy; live only changes on `firebase deploy --project production`.
- Every data migration is a reversible, idempotent, dry-runnable script, reviewed before it runs.
- When unsure, ask. A withheld change is cheap. A broken production build is not.

## How to preview work

- Day-to-day: `npm start` → http://localhost:3000 (staging).
- Live: https://rising-amp-467702-b5.web.app (production).
- Design mockup (Phase 3): `design/risingamp-vision.html`
- Live look (Phase 2): `design/opal-track-reference.html`
- Never run `firebase deploy` against production unless the owner explicitly asks. Hosting only: `firebase deploy --project production --only hosting`. Do not deploy functions, Firestore rules, or Storage unless he names them.

## Environments

| Alias | Firebase project ID | Role |
|--------|---------------------|------|
| production | `rising-amp-467702-b5` | Live family app (Google login, org + job lists). |
| staging | `rising-amp-staging` | Copy of production data. Localhost and experiments. `.firebaserc` default is staging. |

What matters is **which database the app points at**, not local versus deployed.

## Access model (live)

Google / Gmail via Firebase Auth. After login: only invited addresses continue. The chooser lists **job lists that Gmail was invited to**. Tracker data lives under `organizations/opal-ss-constructions/projects/{projectId}/…`. Old `users/{accessCode}` trees still exist as unused copies. Do not delete them unless the owner later asks.

## Phase 1 (closed 2026-08-23)

Google login, one org, two named job lists, per-job invites, Site Log / Weekly Report removed from the UI. Do not re-run cutover scripts. Do not deploy Cloud Functions unless asked (live still has unused `generateWeeklyReport`).

## Phase 2 (closed 2026-08-23)

Visual overhaul is live on production hosting. Brief: `PHASE2.md`. Look: `design/opal-track-reference.html` (Manrope, Palette 1). Colour lives in the data (dots, icons, bars), never on card furniture. Do not re-run the restyle. Do not add mockup-only features.

## Phase 3 (current)

Same app, same data. Brief: `PHASE3.md`. Mockup: `design/risingamp-vision.html`. Lead with “is this job making money”, then what needs attention. Step 0 is parked on `phase-3-vision` — no app code, no New job, no live rename, no production deploy until Lalit says yes.

## Out of scope until asked

Billing, Stripe, a second product, deleting leftover PIN folders, deploying functions, new npm packages (fonts via Google Fonts are OK), changing what the app calculates or who can see which job.

## Continuity

- `AGENTS.md` — pointer. Read this file, then `PROGRESS.md`.
- `PHASE3.md` — Phase 3 vision brief (jobs portfolio, verdict, capture).
- `PHASE2.md` — Phase 2 restyle record (complete).
- `PROGRESS.md` — next concrete step. Update at session end.
- `PLAN.md` — Phase 1 record (complete).
- `ARCHITECTURE.md` — how the running app is built.
- Small sessions: one checklist item, then commit on the branch.

## Owner working style

Lalit can read diffs and plans and knows the system, but is not a full-time engineer. Explain tradeoffs plainly. Show the plan, get the yes, then act in small reviewable steps. Prefer boring, safe, well-tested moves over clever ones. If a Google Cloud click is required, give numbered steps or do it from this machine when the Firebase CLI is already logged in.

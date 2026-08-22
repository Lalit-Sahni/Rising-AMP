# Rising AMP — Agent source of truth

Read this file at the start of every session. It beats anything said in chat.

This is a live production app for Opal SS Constructions. It holds real, irreplaceable business data. Prefer shipping nothing over risking what already exists.

## Next agent — start here (do this first)

1. **Phase 1 is done** (live as of 2026-08-23). Do not re-run cutover scripts. Do not delete old PIN folders. Do not deploy Cloud Functions unless the owner explicitly asks (live still has unused `generateWeeklyReport`).
2. Confirm git branch. Phase 1 landed on `phase-1-foundation`. Restore tag if you need to unwind that work: `pre-phase1-2026-08-22`. Start Phase 2 on a **new branch** from `phase-1-foundation`, never on `master` or `main`.
3. Read `PROGRESS.md` (next step), then `PLAN.md` (Phase 1 record), then `ARCHITECTURE.md`.
4. Localhost (`npm start` → http://localhost:3000) must use `.env.local`, which points at **staging** (`rising-amp-staging`). Production keys are in gitignored `.env.production.local`. Do not swap them.
5. Family access codes and owner email live in gitignored `.phase1-local.json`. Do not commit that file. Do not put the codes in git.
6. **Next:** Phase 2. Wait for Lalit’s brief. Do not invent Phase 2 scope. Invite email still needs the live Google OAuth consent screen if they want auto-send from Gmail.
7. Owner (Lalit) writes in plain language. Explain in plain language.

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
- Never run `firebase deploy` against production unless the owner explicitly asks after sign-off.
- Optional: Firebase Hosting preview channels pointed at staging, for phone checks without overwriting the live site.

## Environments

| Alias | Firebase project ID | Role |
|--------|---------------------|------|
| production | `rising-amp-467702-b5` | Live family app (Google login, org + job lists). |
| staging | `rising-amp-staging` | Copy of production data. Localhost and experiments. `.firebaserc` default is staging so an accidental deploy cannot hit production. |

What matters is **which database the app points at**, not local versus deployed.

## Access model (live)

Google / Gmail via Firebase Auth. After login: only invited addresses continue. The chooser lists **job lists that Gmail was invited to**, not every job in the company. Tracker data lives under `organizations/opal-ss-constructions/projects/{projectId}/…`. Old `users/{accessCode}` trees still exist as unused copies. Do not delete them unless the owner later asks.

## Phase 1 (closed 2026-08-23)

A. Remove Site Log and Weekly Report from the UI — done. Old rows remain in production Firestore; staging site-log rows were deleted.
B. Replace the shared PIN with per-person Google login, job-list chooser, per-job invites.
C. Promote the two real PIN workspaces into one organisation with two named job lists. Owner Gmail attached; other family Gmails invited per job. Leftover PIN folders left untouched.

Keep the account / organisation / tenancy layer product-agnostic. Do not bake tracker-specific assumptions into auth or orgs. No billing or Stripe unless Lalit asks.

## Out of scope until asked

Billing, Stripe, deleting leftover PIN folders, deploying functions, new dependencies, a big-bang tracker UI rewrite. Do not invent Phase 2.

## Continuity

- `AGENTS.md` — pointer for Cursor agents. Same instruction: read this file, then `PROGRESS.md`.
- `PLAN.md` — Phase 1 record (complete).
- `PROGRESS.md` — what was done, what is in flight, next concrete step. Update at session end.
- `ARCHITECTURE.md` — how the running app is actually built.
- Small sessions: one checklist item, then commit on the branch.

## Owner working style

Lalit can read diffs and plans and knows the system, but is not a full-time engineer. Explain tradeoffs plainly. Show the plan, get the yes, then act in small reviewable steps. Prefer boring, safe, well-tested moves over clever ones. If a Google Cloud click is required, give numbered steps or do it from this machine when the Firebase CLI is already logged in.

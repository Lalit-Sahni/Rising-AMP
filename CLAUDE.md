# Rising AMP — Agent source of truth

Read this file at the start of every session. It beats anything said in chat.

This is a live production app for Opal SS Constructions. It holds real, irreplaceable business data. Prefer shipping nothing over risking what already exists.

## Next agent — start here (do this first)

1. Confirm git branch is `phase-1-foundation`. Restore tag if you need to unwind code: `pre-phase1-2026-08-22`.
2. Read `PROGRESS.md` (next step), then `PLAN.md`, then `ARCHITECTURE.md`.
3. Localhost (`npm start` → http://localhost:3000) must use `.env.local`, which points at **staging** (`rising-amp-staging`). Production keys are in gitignored `.env.production.local`. Do not swap them.
4. Family access codes and owner email live in gitignored `.phase1-local.json`. Do not commit that file. Do not put the codes in git.
5. **Next work is Phase 1 B:** Google / Gmail login on staging. Phase 1 A (Site Log / Weekly Report) is done on this branch and on staging. Phase 1 C (org migration) waits until B works.
6. Owner (Lalit) writes in plain language. Explain in plain language. Other family Gmails can wait; start with his Gmail only.

If you are unsure whether a command writes to production, do not run it.

## Prime directive

- Do not run any destructive or irreversible operation against production Firestore or Storage. No hard deletes, no in-place data mutation, no schema changes against production.
- Before any change that has side effects, stop, write a plan, and wait for explicit human approval. Propose first, execute second.
- All work happens on a branch, never on `master` or `main`. Restore tag before Phase 1: `pre-phase1-2026-08-22`.
- Migration and cleanup run against a **staging** Firebase project loaded with a **copy** of production data, never against production.
- Production is written to only at the very end, after a verified backup, a tested restore, and human sign-off.
- Every data migration is a reversible, idempotent, dry-runnable script, reviewed before it runs.
- When unsure, ask. A withheld change is cheap. A broken production build is not.

## How to preview work (do not deploy live)

- Day-to-day: `npm start` → http://localhost:3000
- Localhost must point at **staging** Firebase (`.env.local` / `.env.staging`), not production.
- Never run `firebase deploy` against production unless the owner explicitly asks after sign-off.
- Optional later: Firebase Hosting preview channels, still pointed at staging, for phone checks without overwriting the live site.
- Git push does **not** auto-deploy. The live site only changes on `firebase deploy` to project `rising-amp-467702-b5`.

## Environments

| Alias | Firebase project ID | Role |
|--------|---------------------|------|
| production | `rising-amp-467702-b5` | Live family app. Read-only until final cutover. |
| staging | `rising-amp-staging` | Copy of production data. All cleanup, auth, and migration work. `.firebaserc` default is staging so an accidental deploy cannot hit production. |

What matters is **which database the app points at**, not local versus deployed.

## Current access model (being replaced in Phase 1 B)

There is no per-person login. A shared 4–8 character code is the Firestore document ID under `users/{accessCode}`. Anyone who knows the code is in. A mistyped code silently creates a new empty workspace. Do not treat this as secure. Staging still uses this until B lands.

## Phase 1 scope (only this)

A. Remove Site Log and Weekly Report — **done on this branch and on staging.** Production still has the old data and the old live UI until cutover.
B. Replace the shared code with per-person email login. Prefer Google / Gmail via Firebase Auth. After login: list projects → select one → project dashboard. **This is the current work.**
C. Promote the family's two real code-keyed workspaces into one organisation. Attach the owner Gmail now; other family Gmails later. Organisation owns projects; users belong to an organisation. Leave stray/orphan code spaces untouched.

Keep the account / organisation / tenancy layer product-agnostic. Do not bake tracker-specific assumptions into auth or orgs. Do not build, stub, or mention a second product. No billing or Stripe.

## Out of scope

Billing, Stripe, any second product, design/3D/takeoff, any feature not named above, new dependencies without asking first. Do not big-bang-refactor the tracker UI in Phase 1.

## Continuity

- `AGENTS.md` — pointer for Cursor agents. Same instruction: read this file, then `PROGRESS.md`.
- `PLAN.md` — proposed approach and remaining checkpoints.
- `PROGRESS.md` — what was done, what is in flight, next concrete step. Update at session end.
- `ARCHITECTURE.md` — how the app actually works (and what was removed).
- Small sessions: one checklist item, then commit on the branch.

## Owner working style

Lalit can read diffs and plans and knows the system, but is not a full-time engineer. Explain tradeoffs plainly. Show the plan, get the yes, then act in small reviewable steps. Prefer boring, safe, well-tested moves over clever ones. If a Google Cloud click is required, give numbered steps or do it from this machine when the Firebase CLI is already logged in.

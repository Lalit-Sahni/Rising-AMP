# Rising AMP — Agent source of truth

Read this file at the start of every session. It beats anything said in chat.

This is a live production app for Opal SS Constructions. It holds real, irreplaceable business data. Prefer shipping nothing over risking what already exists.

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
| staging | `rising-amp-staging` | Empty copy target. All cleanup, auth, and migration work. `.firebaserc` default is staging so an accidental deploy cannot hit production. |

What matters is **which database the app points at**, not local vs deployed.

## Current access model (being replaced in Phase 1)

There is no per-person login. A shared 4–8 character code is the Firestore document ID under `users/{accessCode}`. Anyone who knows the code is in. A mistyped code silently creates a new empty workspace. Do not treat this as secure.

## Phase 1 scope (only this)

A. Remove Site Log and Weekly Report (export to cold JSON first, then delete feature code; production data delete only at the end).
B. Replace the shared code with per-person email login. Prefer Google / Gmail via Firebase Auth. After login: list projects → select one → project dashboard.
C. Promote the family's real code-keyed workspace into one organisation. Attach four family Gmail accounts. Organisation owns projects; users belong to an organisation. Leave stray/orphan code spaces untouched.

Keep the account / organisation / tenancy layer product-agnostic. Do not bake tracker-specific assumptions into auth or orgs. Do not build, stub, or mention a second product. No billing or Stripe.

## Out of scope

Billing, Stripe, any second product, design/3D/takeoff, any feature not named above, new dependencies without asking first.

## Continuity

- `PLAN.md` — proposed approach. Re-read at session start.
- `PROGRESS.md` — what was done, what is in flight, next concrete step. Update at session end.
- `ARCHITECTURE.md` — how the app actually works today.
- Small sessions: one checklist item, then commit on the branch.

## Owner working style

Lalit can read diffs and plans and knows the system, but is not a full-time engineer. Explain tradeoffs plainly. Show the plan, get the yes, then act in small reviewable steps. Prefer boring, safe, well-tested moves over clever ones. If a Google Cloud click is required, give numbered steps or do it from this machine when the Firebase CLI is already logged in.

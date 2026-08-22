# Phase 1 plan

Status: **proposed**. Nothing in A/B/C has been executed. Owner approval required before each side-effect step.

This plan is written so Lalit can say yes/no to each block without needing to be an engineer. Technical detail is here so the next agent can execute it.

---

## How you will see the work (agreed)

1. I work on git branch `phase-1-foundation`, never on `master`.
2. You run `npm start` and open http://localhost:3000.
3. That local app talks to a **staging** Firebase project (a copy of the data), not the live family app.
4. I will not run `firebase deploy` to production unless you explicitly ask after a backup, a staging dry run, and your sign-off.
5. The live URL the family uses stays as it is until that final step.

Restore point if we ever need to unwind code: git tag `pre-phase1-2026-08-22`.

---

## Safety scaffolding — gaps (from investigation)

| Item | Status | Risk |
|------|--------|------|
| Git restore tag | Done this session: `pre-phase1-2026-08-22` | — |
| Feature branch | Done: `phase-1-foundation` | — |
| Staging Firebase project | **Created:** `rising-amp-staging` | Firestore copy of production loaded. Receipt photos are in the local backup folder; staging has no Storage bucket yet (Google did not ask to upgrade). Auth Get started is done; anonymous sign-in enabled on staging. |
| Usable production backup | **Taken 2026-08-22** (read-only). Folder gitignored under `backups/production-*`. Includes Storage files. | Keep this folder. Do not commit it. |
| Production deploy protection | `.firebaserc` default is **staging**. Production is the named alias `production`. | Accidental `firebase deploy` hits empty-then-copied staging, not live. |

**Safety scaffolding is in place.** Cleanup and auth work still wait for Lalit to confirm localhost looks right.

The old Oct 2025 backup file is unused. Do not write to production. Do not delete leftover test/typo workspaces.

---

## Target design (Phase 1 only)

Keep auth, organisations, and membership **product-agnostic**. Tracker collections (expenses, invoices, …) hang off a project; they are not mixed into the login layer.

```
organizations/{orgId}
  name, createdAt
  members/{uid}          # role: owner | member
  projects/{projectId}   # name, createdAt, …
    expenses/{id}
    invoices/{id}
    …tracker data here…

users/{uid}              # Firebase Auth user profile: email, orgId
                         # (this replaces today's users/{accessCode} for the family org)
```

Rules of the road:

- An **organisation** owns **projects**. People belong to an organisation.
- Phase 1 has **exactly one** organisation (Opal SS Constructions).
- After Google sign-in: show that org’s projects → user picks one → dashboard for **that** project only.
- Stray access-code workspaces (`users/{someOtherCode}`) are **left untouched**. Not deleted.
- Do not model “user owns project”. That would break later isolation between organisations.

Invite flow (simple, boring): store the four family Gmail addresses as pending members. On first Google sign-in, match email → attach that Auth UID as a member. No magic links, no extra product.

---

## A. Remove Site Log and Weekly Report

### What exists (mapped)

See `ARCHITECTURE.md` sections 9–10. Short version:

- UI: sidebar items, two pages, AppContext helpers.
- Data: Firestore `siteLogs`; Storage `siteLogs/` and `reports/`.
- Backend: Cloud Function `generateWeeklyReport` plus `functions/buildWeeklyReport.js`.
- Email: client `mailto:` helper only.

### Removal plan (staging first, production last)

1. **Export (throwaway insurance, not re-imported)**  
   Dry-runnable script dumps, for the family access code only (and optionally all codes, still as files):
   - `users/{code}/siteLogs` → JSON
   - Storage prefixes `siteLogs/{code}/` and `reports/{code}/` → listed + downloaded  
   Save **outside** Firestore (a dated folder on this machine, gitignored). Production export happens only when we are ready to remove from production, after staging practice.

2. **Remove from the app (code, on the branch)**  
   Small commits, in order:
   - Hide/remove sidebar entries and `MainContent` cases.
   - Delete pages and `SiteLogEmailService.js`.
   - Strip AppContext site-log state and `data.js` / `storage.js` helpers.
   - Remove `generateWeeklyReport` and `buildWeeklyReport.js`. Leave `functions/` in a compiling state (or empty index with a comment) so we do not surprise-deploy a broken functions package.

3. **Remove from the database**  
   Staging: after you confirm the export file exists and you can open it, a reviewed script deletes only `siteLogs` (and report files) in **staging**.  
   Production: same script, much later, after backup + your yes. Never a console click-delete of the whole project.

Expenses stay. Weekly Report only *reads* expenses; removing the report does not delete expense history.

---

## B. Real accounts (Google / Gmail)

1. Enable **Google** sign-in on the **staging** Firebase project (Auth → Sign-in method). Authorized domain: `localhost` (and later the staging hosting URL if we add one).
2. Replace `LoginScreen` + `loginWithAccessCode` / anonymous auth with “Continue with Google”.
3. After sign-in, if the email is a pending or active org member, show the project list. If not, show a calm “not invited” screen (no new empty workspace).
4. Project picker → set current project in app state → dashboard filtered to that project’s records.
5. Firestore rules: member of the org can read/write that org’s project trees. No more `if true`.

Anonymous auth and `localStorage.accessCode` go away for the family app path. We do **not** keep a dual “type a code or use Google” login in production. Staging can keep a temporary escape hatch during development if you want to compare old vs new; that hatch will not ship.

---

## C. Ownership migration (staging first)

This is not “add an owner field to ownerless projects”. It is **promoting the family’s two real code-keyed cabinets into one organisation**.

The owner confirmed (chat only, stored in gitignored `.phase1-local.json`, never commit):

- Owner Gmail: already recorded locally.
- Two real workspaces. All other codes are tests or typos and must be left untouched (not deleted).
- Other family Gmails can be attached later. Phase 1 can start with the owner only.

On staging (copy of prod):

1. Find the two real `users/{code}` trees. Leave every other code document alone.
2. Create `organizations/{orgId}` named e.g. “Opal SS Constructions”.
3. Attach the owner Gmail now; add father/sister/mother when those addresses are provided.
4. There is **no saved `projects` collection** in the live data. Project names live on expense/invoice records. The migration will build the org project list from those names (plus an **Unassigned** bucket so nothing is dropped).
5. Move tracker data under the matching project. Keep both cabinets’ jobs visible inside the one org — do not merge them into a single project unless the owner asks.
6. Script properties: `--dry-run` default, idempotent, logs every move, can reverse **on staging only** until the old tree is retired (old tree kept until the owner confirms the new tree looks right).

Production run of this script is a separate, signed-off event with a fresh backup immediately before.

### What I need from you before C can be written (not needed to start staging)

Owner Gmail is confirmed. Other family Gmails can wait. Both real access codes are recorded locally, not in git.

---

## Suggested session order (one item, then commit)

0. Docs, git safety, staging project, localhost → staging.
1. Production read-only backup + Firestore copy into staging (done 2026-08-22). Receipt files saved locally; not yet on staging Storage.
2. Lalit confirms localhost looks like the live jobs.
3. Site Log / Weekly Report **code** removal on the branch; you check localhost.
4. Staging export of those collections, then staging data delete for those two features only.
5. Google Auth on staging + login UI + project picker (still may show old data shape until step 6).
6. Ownership migration script on staging, dry-run then apply. You and family (or just you) verify projects.
7. Only after all of that: production backup, production migration, production deploy — each with a written yes.

---

## Out of scope (will not do)

Billing, Stripe, a second product, design/3D/takeoff, new features, new npm packages unless we ask first.

---

## Approval checkpoints (I will stop and wait)

- [ ] You: staging project is OK, and the two Console clicks below are done.
- [ ] You: localhost with the real codes looks like the live jobs (Firestore copy is loaded; receipt photos may be missing on staging).
- [ ] You: Site Log / Weekly Report gone from the UI (code).
- [ ] You: export files exist; OK to delete those two features’ data **on staging**.
- [ ] You: Google login + org/project model on staging.
- [ ] You: migration dry-run log looks right; OK to apply **on staging**.
- [ ] You: family Gmails can sign in and see the right projects on staging.
- [ ] You: production backup + restore test + cutover. Separate day.

Until you tick these in conversation, I will not skip ahead.

---

## Two Google clicks (staging only)

Do these on **Rising AMP Staging**, not on “My First Project”.

1. Open https://console.firebase.google.com/project/rising-amp-staging/authentication  
   Click **Get started**. Leave the rest. This unlocks the existing code-login while we test.

2. Open https://console.firebase.google.com/project/rising-amp-staging/overview  
   If you see a banner to **upgrade to Blaze / add billing**, attach the **same billing account** the live app already uses. Google now requires this for Storage (receipt photos) and some Auth features. The live project is not changed by this.

If anything looks like it is asking about `rising-amp-467702-b5` or “My First Project”, stop and tell me.

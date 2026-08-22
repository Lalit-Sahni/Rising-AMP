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
| Staging Firebase project | **Created empty:** `rising-amp-staging` | Firestore exists. Storage + Auth still need a one-time Google Console setup (billing / Get started). No production data copied yet. |
| Usable production backup | **Missing** (Oct 2025 file has 0 users; script skips siteLogs/payers; no Storage) | Cannot safely restore today |
| Auto-deploy on git push | None (good) | Live site only changes on `firebase deploy` |
| Production deploy protection | Weak: `.firebaserc` default is production | Accidental `firebase deploy` would hit live |

**Before any cleanup or migration scripts run**, we will:

1. Create an empty staging Firebase project.
2. Point localhost at staging (new env file). Change Firebase aliases so `default` is staging, production is a named alias you have to ask for.
3. Write a proper backup script (Admin SDK, all collections, Storage, explicit `--project`, dry-run flag). Review it, then take a **production read-only backup** to a folder **outside** git (and outside the live database).
4. Copy that backup **into staging only**. Verify the family workspace appears in staging by logging in with the known code on localhost.
5. Only then start feature removal and auth work against staging.

I will not copy or write production data until you confirm steps 1–2, and I will not run the new backup until you have seen the script.

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

This is not “add an owner field to ownerless projects”. It is **promoting the family’s code-keyed cabinet into one organisation**.

1. You tell me the **real family access code** in chat (do not commit it to git).
2. On staging (copy of prod), find `users/{thatCode}`. Leave every other `users/{otherCode}` document alone.
3. Create `organizations/{orgId}` named e.g. “Opal SS Constructions”.
4. Attach the four Gmail addresses as members (pending until each person signs in once).
5. Create `projects` under that org from today’s `users/{code}/projects` list.
6. Move tracker data (expenses, invoices, clients, labour, trades, budget, payers, bank details, HIA, progress payments, receipts in Storage) under the matching project.
   - Match expenses/invoices to a project by `projectName` where it lines up.
   - Records with no project name go into an explicit **“Unassigned”** project so nothing is dropped. You can rename or merge that later.
7. Script properties: `--dry-run` default, idempotent, logs every move, can reverse by writing back to the old paths **on staging only** until we delete the old tree (old tree kept until you confirm the new tree looks right).

Production run of this script is a separate, signed-off event with a fresh backup immediately before.

### What I need from you before C can be written (not needed to start staging)

- The family access code (chat only).
- The four Gmail addresses (you, father, sister, mother). I already see `sahni.lalit18@gmail.com` on this machine’s Firebase login; confirm if that is the owner account to use.

---

## Suggested session order (one item, then commit)

0. **This session:** docs + git safety + empty staging project `rising-amp-staging`. Localhost env now points at staging. `.firebaserc` default is staging. **No app behaviour change. No data copy yet.**
1. You finish the two Google Console clicks below (Auth + billing/Storage). Then confirm staging is OK.
2. Proper backup script (review → run **read-only** against production → copy into staging). You click around staging on localhost with the family code and say “this looks like our data”.
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
- [ ] You: backup script looks OK to run as **read-only** on production.
- [ ] You: staging copy looks like real data.
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

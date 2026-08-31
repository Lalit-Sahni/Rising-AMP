# Phase 1 plan (complete)

Status: **done.** Landed on branch `phase-1-foundation` and on the live site 2026-08-23.

This file is the Phase 1 record. Do not re-run the cutover.

**Phase 2 (visual overhaul):** **done** and live 2026-08-23. Record: `PHASE2.md`. Look: `design/opal-track-reference.html`. Branch `phase-2-visual`.

Live URL: https://rising-amp-467702-b5.web.app  
Localhost: http://localhost:3000 → staging (`rising-amp-staging`)  
Restore tag: `pre-phase1-2026-08-22`

---

## What shipped

A. Site Log and Weekly Report removed from the UI. Old rows remain in production Firestore; staging site-log rows were deleted. The leftover Cloud Function `generateWeeklyReport` was later deleted from production by name (29 Aug 2026); it was unused.

B. Shared PIN replaced with Google / Gmail login. Uninvited accounts see a calm screen. No new empty folder on a typo.

C. Two real PIN workspaces copied into one organisation, `organizations/opal-ss-constructions`, as two job lists: **72 Centenary Dr** and **Gurner St**. Invite is per job, not the whole company. Leftover PIN folders left untouched.

Auth and orgs stay product-agnostic. No billing or Stripe.

---

## How work was previewed

1. Branch `phase-1-foundation`, never `master`.
2. `npm start` → localhost → **staging**, not live.
3. Production writes only after backup and an explicit yes.
4. Live deploy: `firebase deploy --project production --only hosting,firestore:rules`.

---

## Target design (what is live)

```
organizations/{orgId}
  name, ownerEmail, invitedEmails
  projects/{projectId}   # name, invitedEmails, legacyWorkspaceId
    expenses/{id}
    invoices/{id}
    …tracker data here…
```

- The organisation owns projects. People are invited to **jobs**, not to every job by default.
- Org `invitedEmails` is the door (can they sign in at all). Each project’s `invitedEmails` is which jobs they see.
- Store Gmail dotted/undotted variants. Job-list queries must match rules on `resource.data.invitedEmails` (do not use `get()` for that list).
- Do not model “user owns project”.
- Stray `users/{code}` trees stay until someone later decides to delete them.

Invite: type a Gmail, tap Invite. The app tries to send a pre-made email from the inviter’s Gmail (Gmail API). Live OAuth consent may still need a Console pass.

---

## Approval checkpoints (all ticked)

- [x] Staging project OK; Auth Get started + Google enable on staging.
- [x] Localhost numbers look like the live jobs.
- [x] Site Log / Weekly Report gone from the UI.
- [x] Staging site-log rows deleted (production still has them).
- [x] Google login + org/project model on staging.
- [x] Staging migration dry-run, then apply.
- [x] Per-job invites.
- [x] Push live after backup. Lalit confirmed the live site works.

---

## Out of scope (Phase 1 did not do)

Billing, Stripe, a second product, design/3D/takeoff, deleting leftover PIN folders, deploying functions, new npm packages unless asked.

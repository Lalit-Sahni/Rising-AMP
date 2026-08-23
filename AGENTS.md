# Agent instructions

Read these files **in this order** before touching anything:

1. `CLAUDE.md` — prime directive, environments, what is in scope
2. `PROGRESS.md` — where we stopped and the **next concrete step**
3. `PHASE4.md` — current phase brief (legal pages, invites off Gmail onto Resend, custom domain)
4. Open `design/risingamp-vision.html` in a browser
5. `ARCHITECTURE.md` — how the running app is actually built
6. `PHASE3.md` / `PHASE2.md` / `PLAN.md` — closed records only

Do not rely on chat history. If chat and these files disagree, these files win.

Phase 1, 2, and 3 are **done** and live. Phase 4 is in progress on branch `phase-4-domain-email` (from `phase-3-vision`). Never commit to `master` or `main`. Never write to production job data unless `PROGRESS.md` and the owner explicitly say so. Hosting deploy is `firebase deploy --project production --only hosting`. Do not deploy Cloud Functions beyond the single, narrowly-scoped invite-email function `PHASE4.md` asks for. Never accept a raw API key or secret pasted into chat — have the owner set Firebase secrets himself (`firebase functions:secrets:set ...`).

**Paste this to start a new chat:**

Read CLAUDE.md, then PROGRESS.md, then PHASE4.md. Open design/risingamp-vision.html. Work is on branch phase-4-domain-email (from phase-3-vision). Domain is risingamp.com.au, DNS at Crazy Domains, Resend account already set up. Localhost stays on staging. Never accept a pasted API key — have the owner set Firebase secrets himself. Do not deploy Cloud Functions beyond what PHASE4.md explicitly asks for.

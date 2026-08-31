# Agent instructions

Read these files **in this order** before touching anything:

1. `CLAUDE.md` — prime directive, environments, what is in scope
2. `PROGRESS.md` — where we stopped and the **next concrete step**
3. `PHASE9.md` — Job Files brief (this phase)
4. Open `design/risingamp-files-vision.html` in a browser
5. `ARCHITECTURE.md` — how the running app is actually built
6. `PHASE8.md` / `PHASE7.md` / `PHASE6.md` / `PHASE5.md` / `PHASE4.md` / `PHASE3.md` / `PHASE2.md` / `PLAN.md` — closed records only

Do not rely on chat history. If chat and these files disagree, these files win.

**Where we are (2026-08-31):** Phase 9 **Part G** is on **`phase-9-job-files`**. Staging Firestore + Storage rules are live so localhost Files works. Production is not. Phases 1–8 are live. Localhost still uses staging. Production functions are `sendJobInviteEmail`, `readReceiptImage` and `allocateInvoiceNumber`; deploy by name. Never commit to `master` or `main`. Never accept a raw API key or secret pasted into chat.

**Paste this to start a new chat:**

Read CLAUDE.md, then PROGRESS.md, then PHASE9.md. Open design/risingamp-files-vision.html. Phase 9 Part G is on phase-9-job-files. Phases 1–8 are live. Shopfront is https://risingamp.com.au. Localhost stays on staging. Restore tags: pre-phase9-2026-08-31, pre-phase8-2026-08-28, pre-phase7-2026-08-28, pre-phase6-2026-08-27, pre-phase1-2026-08-22. Never hard-delete user records. Never accept a pasted API key. Do not deploy unless named.

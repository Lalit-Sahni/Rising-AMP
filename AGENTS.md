# Agent instructions

Read these files **in this order** before touching anything:

1. `CLAUDE.md` — prime directive, environments, what is in scope
2. `PROGRESS.md` — where we stopped and the **next concrete step**
3. `PHASE10.md` — Cost Plan (active phase)
4. Open `design/risingamp-costplan-vision.html` in a browser
5. `ARCHITECTURE.md` — how the running app is actually built
6. `PHASE9.md` / `PHASE8.md` / `PHASE7.md` / `PHASE6.md` / `PHASE5.md` / `PHASE4.md` / `PHASE3.md` / `PHASE2.md` / `PLAN.md` — closed records only

Do not rely on chat history. If chat and these files disagree, these files win.

**Where we are (2026-08-31):** **Phase 10 Cost Plan is active on `phase-10-cost-plan`.** Part A (target cost and Level 1 screen) is implemented on the branch, not deployed. Production remains Phase 9. Localhost still uses staging. Production functions are `sendJobInviteEmail`, `readReceiptImage` and `allocateInvoiceNumber`; deploy by name. Never commit to `master` or `main`. Never accept a raw API key or secret pasted into chat.

**Paste this to start a new chat:**

Read CLAUDE.md, then PROGRESS.md, then PHASE10.md. Phase 10 Cost Plan Part A is on the branch, not deployed. Production remains Phase 9. Shopfront is https://risingamp.com.au. Localhost stays on staging. Restore tag: pre-phase10-2026-08-31. Never hard-delete user records. Never accept a pasted API key. Do not deploy unless named.

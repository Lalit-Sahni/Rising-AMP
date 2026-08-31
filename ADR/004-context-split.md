# Why the context was split

`AppContext` exported dozens of values to 17 screens. Any toast or filter keystroke re-rendered the tree. It also hid what depends on what.

## What shipped in Phase 8

Three new providers sit **around** the old blob:

- **Auth** — signed-in user and profile
- **Org** — company and open job
- **UI** — toasts, palette, current page from the URL

`useApp()` still composes them so existing screens keep working. New code should take the smaller hook (`useAuth`, `useOrg`, `useUI`) when it only needs that slice.

## What is not done

The original `AppContext.js` is still a large data provider: ledger, directories, invoices, HIA, progress payments, and the write helpers. Auth/Org/UI were extracted; the god object was **not** dismantled. There are now four contexts **and** the original problem for ledger screens.

Dismantling the remaining blob is deferred. Do not treat this ADR as “the split is finished.”

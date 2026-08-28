# Why the context was split

`AppContext` exported 62 values to 17 screens. Any toast or filter keystroke re-rendered the tree. It also hid what depends on what.

It is now four providers: **Auth** (user and profile), **Org** (company and open job), **UI** (toasts, palette, current page from the URL), and **App data** (ledger and directories). `useApp()` still composes them so existing screens keep working. New code should take the smaller hook.

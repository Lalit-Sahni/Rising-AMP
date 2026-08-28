# Phase 7 — App feel on a phone (agent brief)

**Closed 2026-08-28.** Hosting live. Safe areas, `default` status bar, pinch zoom, selectable content. Part B (manifest + icons) skipped — owner did not want a new home-screen icon. Measured standalone portrait: `t:0 r:0 b:34 l:0`.

Read `CLAUDE.md` then `PROGRESS.md` then this file before touching anything.

Branch: create **`phase-7-app-feel`** from `phase-6-legacy-cut` once Phase 6 is finished and merged. Never commit to `master` or `main`.

This phase changes layout and metadata only. No data, no rules, no functions, no auth. If a task here seems to need a Firestore write, stop. It was mis-scoped.

## The problem, stated precisely

Lalit added RisingAMP to his iPhone home screen. It opens without Safari's top address bar and bottom toolbar, which is correct, but the layout was built assuming that browser furniture is there. With it gone, the app's own content sits hard against the top and bottom of the screen and collides with the iOS status bar and home indicator.

**The plumbing for this is already in the repo and is not connected to anything.** That is the whole finding:

| What exists | Where | State |
|---|---|---|
| `viewport-fit=cover` | `public/index.html` | Set. Content is allowed into the unsafe area. |
| `apple-mobile-web-app-capable` | `public/index.html` | Set. This is why it opens standalone. |
| `apple-mobile-web-app-status-bar-style: black-translucent` | `public/index.html` | Set, and it is the main culprit. See below. |
| `.safe-area-top` / `-bottom` / `-left` / `-right` | `src/index.css` lines 47 to 61 | **Defined and applied to zero elements.** |
| `manifest.json` | `public/` | **Does not exist.** |
| App icons | `public/` | **Do not exist.** Only `favicon.ico`. |

So somebody wired the app to draw edge to edge, wrote the utilities to keep content out of the corners, and never used them.

**The status bar is a second, separate bug.** `black-translucent` makes the iOS status bar transparent with **white** text. The app canvas is `#F5F6F8`, near white. That means the clock, battery and signal render white on near white and are effectively invisible. That is very likely part of what reads as "unusual" alongside the spacing.

**Third, `h-screen`.** `src/App.js` line 279 wraps the app in `h-screen`, which is `height: 100vh`. On mobile browsers `100vh` is the height of the viewport *without* the collapsing browser chrome, so it has always been slightly wrong in Safari and is wrong in a different way in standalone. `100dvh` is the fix.

## Answering the risk Lalit raised, because the answer changes the approach

He asked whether adjusting margins is risky across different phone sizes, iPads and so on, and whether to detect standalone mode from JavaScript and adjust from there.

**Do not detect standalone in JavaScript and set margins from it. Use `env(safe-area-inset-*)` unconditionally instead.**

The reasoning matters, so hold it:

`env(safe-area-inset-top)` and its siblings are not a guess and are not a per-device lookup table. The operating system computes them for the actual hardware and the current orientation and hands the browser the real number. A phone with no notch returns `0`. An iPhone with a Dynamic Island returns its exact height. An iPad returns its own values. Rotate to landscape and the left and right insets appear on their own. **There is no device list to maintain and nothing to get wrong per model**, which is exactly the risk he was worried about, and it is the risk this API exists to delete.

Better still: **in a normal browser tab those insets are `0`**, because Safari's own chrome already occupies that space. So the same CSS is correct in a browser tab and correct on the home screen, with no branch, no JavaScript, and no second code path. One rule, both modes.

Detecting standalone in JavaScript would be worse in four ways: it is a branch that can be wrong, it causes a visible layout shift after hydration, it tells you only *that* you are standalone and never *how much* space to leave, and it doubles the layout you have to maintain. `display-mode: standalone` has a legitimate use, which is hiding an "add to home screen" prompt from someone who already did. It is the wrong tool for spacing.

So: **his instinct to be cautious is right, and the correct fix happens to be the one with no per-device risk in it at all.**

## Prime directive for this phase

- Layout and metadata only. No data, rules, functions, or auth.
- Apply safe-area insets **unconditionally**. Never behind a JavaScript standalone check.
- **Never hardcode a pixel value for a notch, an island, or a home indicator.** If a diff contains a number like `44px` or `34px` for that purpose, it is wrong.
- **Measure on the real device before tuning.** Part A step 5 says how. Do not guess numbers and do not tune against a desktop browser's device emulator alone.
- Test in both modes every time: Safari tab **and** home screen. A change that fixes one and breaks the other is not done.
- Deploy nothing. Phase 7 ends on the branch. Lalit decides when it merges and deploys.
- One part per session, one commit per part.

---

## Part A — Safe areas and the shell

**A1. Fix the status bar first, because it changes what the other numbers will be.**

In `public/index.html`, change:

```html
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
```

to:

```html
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
```

`default` gives a status bar whose text is dark and readable over a light app, and iOS reserves that strip rather than letting content slide under it. That is the right starting point for a light-canvas product and it is the boring, safe option.

Also change `theme-color` from `#17181C` to the canvas `#F5F6F8`, so Android's status bar matches the app rather than fighting it.

**Note for later, do not build it now:** the more immersive look, where the app paints its own dark strip behind a translucent status bar, is achievable and would look sharper. It is a deliberate design pass, not a bug fix, and it belongs in its own phase after Lalit has seen this version on the phone.

**A2. Promote the insets to variables.**

In `src/index.css`, alongside the existing `.safe-area-*` classes:

```css
:root {
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left: env(safe-area-inset-left, 0px);
  --safe-right: env(safe-area-inset-right, 0px);
}
```

The `, 0px` fallback matters. A browser that does not understand `env()` gets zero rather than an invalid value.

**A3. Fix the viewport height.**

`src/App.js` line 279 currently reads:

```jsx
<div className="flex h-screen bg-canvas text-ink overflow-hidden">
```

Replace `h-screen` with a class or style giving `height: 100dvh`, with `height: 100vh` immediately before it as the fallback for older browsers. Tailwind 3.3 has `h-dvh`; confirm it compiles in this config before relying on it, and fall back to a small CSS rule in `index.css` if it does not.

Check `src/index.css` line 17 (`body { min-height: 100vh }`) and line 416 (`max-height: calc(100vh - 1rem)`) and give both the same treatment.

**A4. Apply the insets, in three places only.**

Be surgical. Padding applied in the wrong layer will double up and look worse than it does now.

1. **The scrolling content area** (`src/components/MainContent.js`, the `div.content`): add bottom padding of `var(--safe-bottom)` on top of its existing padding, so the last row of a long History list clears the home indicator instead of hiding behind it.
2. **The mobile menu button** (`src/components/Sidebar.js` line 79, `fixed top-4 left-4`): its `top-4` is measured from the true top of the screen, so in standalone it sits under the status bar. Offset it by `var(--safe-top)`.
3. **The sidebar drawer** (`src/components/Sidebar.js` line 94, `fixed inset-y-0`): the dark steel panel itself should keep bleeding to all four edges, because a panel that stops short of the screen edge is exactly what looks unfinished. Pad its **contents** instead: `var(--safe-top)` above the first nav item, `var(--safe-bottom)` below the user block at the bottom.

Add left and right insets only where an element is pinned to a screen edge, for landscape on a notched phone.

**Do not** add insets to cards, modals, or anything already inside a padded container.

**A5. Measure, then report, before tuning anything.**

Once A1 to A4 are in, have Lalit open the app from his home screen and read the real numbers. Add this temporarily to a visible screen, or read it from Safari's remote inspector:

```js
getComputedStyle(document.documentElement).getPropertyValue('--safe-top')
```

Report the four values from: iPhone portrait, iPhone landscape, and Safari tab (which should be zeros or near it). **Then** tune. Do not tune first. Remove the readout before committing.

Commit: `Apply safe-area insets and fix the standalone status bar.`

---

## Part B — Make it a real installed app

Right now there is no `manifest.json` and no icons. iOS is working purely off the `apple-` meta tags, and Android cannot install it properly at all. The home screen icon is whatever iOS could scrape.

**B1.** Create `public/manifest.json`:

```json
{
  "name": "RisingAMP",
  "short_name": "RisingAMP",
  "description": "Construction expense and job tracking",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait-primary",
  "background_color": "#F5F6F8",
  "theme_color": "#F5F6F8",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

Link it from `public/index.html`: `<link rel="manifest" href="%PUBLIC_URL%/manifest.json" />`.

**B2.** Produce the icons from the existing RisingAMP mark used on the boot screen and in the sidebar. Do not invent a new mark and do not restyle the existing one.

- `icon-192.png` and `icon-512.png`: the mark on the steel `#17181C` background.
- `icon-maskable-512.png`: same, but with the mark at roughly 60% of the canvas so Android's circular and squircle crops do not clip it. This is the one people get wrong.
- `apple-touch-icon.png` at 180x180 in `public/`, linked with `<link rel="apple-touch-icon" href="/apple-touch-icon.png" />`. **iOS ignores the manifest icons and uses only this one.** Without it, Lalit's home screen icon stays whatever it is now.

Keep the accent to the mark itself. Colour lives in the data, and an icon is the one place the wordmark's own colour is the data.

**B3.** Set `"orientation": "portrait-primary"` as above, but confirm with Lalit first. It is right for one-handed use on a site. It is wrong if anyone reviews invoices or the History table on an iPad in landscape. Ask before locking it.

Commit: `Add a web manifest and real app icons.`

---

## Part C — Two mobile settings that are working against you

Both are in `public/index.html` and `src/index.css` today, both were almost certainly copied in early without much thought, and both are worth a decision rather than a silent inheritance.

**C1. Pinch zoom is disabled.**

```html
content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
```

`maximum-scale=1, user-scalable=no` blocks pinch zoom. Recent iOS ignores it; Android obeys it.

**Recommendation: remove both.** This app's user is standing on a site in bright sun looking at a photographed receipt, and the app's own philosophy is to design for the moment things are hard rather than the happy path. Taking away the pinch is the wrong thing to do to that person, and it is an accessibility problem for anyone who needs to enlarge a number before trusting it. Removing it also removes the iOS habit of zooming the whole page when a small input is focused, as long as inputs are at least 16px, which C2 covers.

**C2. Text cannot be selected anywhere.**

`src/index.css` sets `user-select: none` on `*`, then re-enables it only for `input`, `textarea` and `[contenteditable]`. So nobody can select or copy an invoice number, a job address, an ABN, or a total from any screen in the app.

For a tool people put money records into, being unable to copy a figure out is a real loss, and the reason the rule exists (stopping the blue selection flash when tapping around) is solved more narrowly.

**Recommendation:** scope `user-select: none` to the furniture only, meaning nav items, buttons, tabs and the sidebar. Let all content text, tables, totals and card values be selectable. Keep `-webkit-tap-highlight-color: transparent`, which is the part that was actually earning its place.

Both of these are judgement calls with a real tradeoff, so **present them to Lalit and get a yes before changing them.** Do not fold them into another commit.

Commit: `Restore pinch zoom and allow content text to be selected.`

---

## Part D — Verify and record

Test every one of these in **both** Safari as a tab and from the home screen:

- Jobs home, long enough to scroll. The last card clears the home indicator.
- A job Overview. Nothing under the status bar, nothing under the home indicator.
- Add expense, all five categories. Open the modal, focus each field, bring up the keyboard. The keyboard does not hide the field being typed into, and the page does not zoom on focus.
- History with a long list. Scroll to the very bottom.
- The mobile menu button. Fully tappable, not under the clock.
- The sidebar drawer open. Top nav item and the bottom user block both clear.
- Rotate to landscape on a notched phone. Nothing lands in the notch.
- An iPad if one is available, both orientations.

Then update `PROGRESS.md`, `CLAUDE.md`, and add a short "Mobile and standalone" section to `ARCHITECTURE.md` recording the inset variables, where they are applied, and the deliberate decision to apply them unconditionally rather than behind a standalone check. Write down the measured inset values from A5. The next agent should not have to rediscover them.

Commit: `Record the standalone layout rules.`

---

## Out of scope, and one of them deliberately so

- **Offline support and a service worker.** There is no service worker today, so one bar of signal is a white screen. That is the largest gap between what this product says it is and what it does, and it deserves its own phase with a real think about what to cache, how to queue a receipt captured with no signal, and how to show honestly that something has not synced yet. Doing it badly is worse than not doing it, because a queued expense that silently disappears is exactly the trust failure the whole product is built to avoid. **Do not start it here.** Note it and move on.
- The immersive dark status bar treatment described in A1.
- Push notifications, app store packaging, anything native.
- Any data, rules, function, or auth change.
- Restyling beyond the spacing fixes named above. No new components.

## Definition of done

- The app opens from the home screen with nothing under the status bar and nothing under the home indicator, portrait and landscape.
- The same layout is still correct in a Safari tab.
- No pixel value for a notch or home indicator anywhere in the diff.
- No JavaScript check for standalone mode anywhere in the diff.
- The home screen icon is the RisingAMP mark.
- Measured inset values recorded in `ARCHITECTURE.md`.

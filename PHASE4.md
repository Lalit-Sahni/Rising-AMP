# Phase 4 — Domain, Invites off Gmail, Legal Pages (closed record)

**Closed 2026-08-26.** Live: legal pages, Resend invite function on staging and production, shopfront `https://risingamp.com.au`, Google login on that domain. Leftovers (not Phase 5 unless asked): Gmail invite fallback still in the client until a live Resend invite is proved and the owner says yes to Task 3; `www.risingamp.com.au` has no SSL; leftover `generateWeeklyReport` on production.

Read `CLAUDE.md` then `PROGRESS.md` then `PHASE5.md` for current work.

---

# Phase 4 — Domain, Invites off Gmail, Legal Pages (agent brief)

Read `CLAUDE.md` then `PROGRESS.md` then this file before touching anything.

Branch: **`phase-4-domain-email`**, created from `phase-3-vision` (2026-08-23). Phase 1–3 are live. Same app, same data. This phase does not touch job data, calculations, or the Jobs UI.

All earlier safety rules hold: do not lose data, do not break the running app, work on this branch, use **staging** for anything that sends email or touches data, propose before executing, and keep secrets server-side and out of the client bundle.

## What the owner already has

- Domain: **`risingamp.com.au`**, bought and DNS-managed at **Crazy Domains**.
- A **Resend** account and API key, tied to that domain. Resend's required SPF/DKIM DNS records were already added at Crazy Domains by the owner. **Confirm domain shows "Verified" in the Resend dashboard before sending anything** — don't assume the DNS propagated cleanly.
- Decision already made: stop sending invite email through a user's personal Gmail (the `gmail.send` OAuth popup) and send from RisingAMP's own domain instead, via Resend. This removes the need for the Google OAuth verification work discussed earlier (see "Superseded" below) — for the invite feature specifically.
- **Google sign-in for login is separate and must not be touched.** Nothing here changes how anyone logs in.

## Task 1 — Legal pages (do this first, low risk)

- The owner will provide two documents: a privacy policy and a terms of service, with the bracketed placeholders filled in (business name, ABN, contact email, effective date, etc.). **If they haven't been provided yet, stop and ask for them before writing content** — do not invent legal text.
- Publish them as public, static pages at `/privacy` and `/terms` in the app.
- Replace the placeholder `href="#"` links currently in `LoginScreen.jsx` (and the mockups `design/risingamp-auth.html`, `design/risingamp-signin-email.html`) with real links to those two pages.
- This is additive and visual only. No data, logic, or auth touched.
- Bonus: once Task 4 (below) puts the app on `risingamp.com.au`, these pages give you real URLs to use later for Google OAuth app verification (Search Console domain ownership + Privacy Policy link) — that work is optional and not part of this phase, just don't block it.

## Task 2 — Switch invites to transactional email

- The owner is providing the verified sending domain (`risingamp.com.au`) and a Resend API key. **Do not accept the raw key over chat.** Have the owner run this themselves, or run it with them present, once per environment that needs it:

  ```bash
  firebase functions:secrets:set RESEND_API_KEY --project production
  firebase functions:secrets:set RESEND_API_KEY --project rising-amp-staging
  ```

  This prompts for the value at a masked prompt and stores it in Secret Manager — it never touches a file in this repo and never appears in `git diff`.

- If you judge the **Firebase Trigger Email extension** simpler for this stack than a hand-written Cloud Function, propose that instead before building, rather than switching silently. **Decision (2026-08-23):** use a narrowly-scoped callable `sendJobInviteEmail`, not the extension. The invite is already written in the client, the HTML already exists, and Resend is an HTTP call (no extra Firestore `mail` collection, no extra npm package). Either way this requires deploying *something* server-side — flag that clearly to the owner first, since standing instruction elsewhere in this repo is "do not deploy Cloud Functions unless asked." This phase is that ask, scoped narrowly to invite email only. Do not touch or redeploy the existing unused `generateWeeklyReport` function. Deploy by name only: `firebase deploy --project <alias> --only functions:sendJobInviteEmail`.
- Add a server-side send path that sends the invite email from `invites@risingamp.com.au`, containing the existing invite link. Reuse the existing HTML template in `src/emails/risingAmpMail.js` (`buildJobInviteEmail`) rather than rebuilding it — keep it plain and on brand, matching `design/risingamp-signin-email.html`.
- The Resend API key lives only server-side (Secret Manager / Functions secret). It must never appear in `.env*`, in `REACT_APP_*` vars, or anywhere that ends up in the built front-end bundle. Before finishing, grep the production build output for the key prefix to confirm nothing leaked.
- Do not remove the existing `gmail.send` path until the new one works. Put the new path behind a simple switch, verify end to end on **staging** (a real invite email arrives at a real inbox and its link works), get the owner's explicit approval, then make it the default.
- The invite must still create the exact same membership record it does today (`invitedEmails` on the job doc, etc.). Only how the email is *sent* changes — never who can access what.

## Task 3 — Clean up (only after Task 2 is proven on staging and approved)

- Remove the `gmail.send` scope request and its OAuth popup flow from the invite feature (`src/firebase/email.js` — `sendInviteFromSignedInGmail` and the `addScope('.../gmail.send')` call), so the app no longer asks anyone for Gmail permission to send an invite.
- Leave `sendNewSignInNotice` (the security "new sign-in" email) alone unless the owner separately asks to move it to Resend too — it's a smaller, lower-risk flow and can follow later.
- Update `ARCHITECTURE.md` and `PROGRESS.md` to describe the new send path and that the Gmail OAuth invite path is gone.

## Task 4 — Custom domain on Firebase Hosting (owner said yes to this)

- Firebase Console → Hosting → production site (`rising-amp-467702-b5`) → **Add custom domain** → enter `risingamp.com.au` (confirm with the owner whether the root domain or a subdomain like `app.risingamp.com.au` should serve the app — the mockups and current UI don't assume a subdomain, root is simplest unless he wants `risingamp.com.au` to later host a marketing/landing page).
- Firebase will show a TXT record (ownership verification) first, then two `A` records once verified. Add each at Crazy Domains DNS as shown, exactly as given — do not guess the IPs.
- SSL cert provisioning can take up to 24 hours after DNS is correct. Confirm `https://risingamp.com.au` loads the live app before calling this done, and confirm the `.web.app` URL still works too (Firebase keeps both).
- This is hosting-only, same `firebase deploy --project production --only hosting` rule as before. Do not deploy functions, Firestore rules, or Storage as a side effect of this step.

## Out of scope

- Google sign-in — leave it exactly as is.
- Any data, schema, or calculation change.
- New dependencies beyond the email service, without asking first.
- Billing, Stripe, a second product, a working "New job" create (all still out of scope from Phase 3).

## Continuity

- Small reviewable steps. Propose each diff before applying.
- Keep `CLAUDE.md` and `PROGRESS.md` current as you go, not just at the end.
- Order: Task 1 (legal pages) → Task 4 (custom domain, can happen in parallel, low risk) → Task 2 (Resend send path, proven on staging first) → Task 3 (remove Gmail OAuth, only after Task 2 is approved and live).

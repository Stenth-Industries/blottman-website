# Blottman Legal Services: website (blottman.ca)

Next.js 14 (App Router) + TypeScript + Tailwind. It is the landing site that Google Ads traffic and phone calls
land on for an Ontario traffic-ticket paralegal (Leslie Rivas). It exists to turn a visitor into a phone call or a
form lead, so **anything that touches the forms, the phone number or the tracking is business-critical**. Read
"Do not break" before changing those.

## Run it

```bash
npm ci
npm run dev        # http://localhost:3000
npm run build      # production build: run this before every pull request
npx tsc --noEmit   # typecheck
```

You do not need any secrets to work on the site. With no environment variables set, submitting a form is safe:
the server only logs the lead to the console and nothing is emailed, saved or sent to Google Ads. Copy
`.env.local.example` to `.env.local` only if you are told to, and never commit it.

## How work gets shipped

- **Work on a branch and open a pull request. Do not push to `main`.** The owner reviews and merges; a merge to `main`
  deploys to production automatically (Vercel), and production is live client traffic paid for with ad spend.
- Production keys (lead delivery, phone screening, Google Ads tags) live in the Vercel project settings, not in this
  repo. You will not be given them and do not need them.
- If a build or deploy looks blocked or stale, tell the owner. Do not try to work around it.

## Automatic checks

`npm run check` runs everything a pull request must pass, and GitHub runs the same checks on every branch you push:

- **Guardrails** (`scripts/guardrails.mjs`): the copy rules above, the phone number, no hardcoded numbers, every live route present,
  form honeypots, one Ads conversion call, the Twilio signature checks, and no secrets or env files committed.
- **Guardrail self-test** (`scripts/test-guardrails.mjs`): breaks a copy of the site 14 ways to prove the guardrails catch it.
- Typecheck and production build.

If a guardrail flags a line you believe is fine, add `// guardrail-ok: <reason>` on that line and explain it in the pull request.
**Do not edit the guardrail scripts to make a check pass**; a reviewer will treat that as a red flag. Ask the owner instead.

## Pages

`/` (home) and one page per charge: `/speeding`, `/careless-driving`, `/stunt-driving`, `/fail-to-stop`,
`/disobey-sign`, `/no-insurance`, `/driving-under-suspension`, `/no-licence`, `/cell-phone`, plus `/privacy`.
Per-charge copy and metadata live in `lib/content.ts` (`TICKET_PAGES`). Sections are components in `components/`.
**Live Google Ads send traffic to these exact URLs** (checked 2026-09-27): Search ads land on `/`, `/speeding`,
`/careless-driving`, `/stunt-driving`, `/disobey-sign`, `/no-insurance`, `/driving-under-suspension`, `/no-licence` and
`/cell-phone`; the Performance Max campaign lands on `/`. **Never rename, move or delete a route** without asking, because
the ad would land on a 404 and keep spending. Adding new pages is fine.

## Do not break (each of these has failed silently before)

1. **The phone number.** `PHONE_DISPLAY` and `PHONE_TEL` in `lib/content.ts` are the only place the number is
   written. It is a call-screening line (a recorded greeting, press 1 to be connected), not Leslie's own number.
   Every `tel:` link, the structured data, and the Google Ads call-conversion number swap in `app/layout.tsx` are
   derived from these two constants. Never hardcode a number anywhere else, and never change these without asking.
2. **The forms** (`components/QuickForm.tsx` under the hero, `components/QuoteForm.tsx` at the bottom, both post to
   `/api/lead`). Keep the field names, the hidden honeypot field `company`, and the Google click id capture in
   `lib/lead-client.ts` (it ties leads back to the ad that produced them). Phone and charge are required; name is
   required except for the partial-lead path. When more fields were required in August, the Search conversion rate fell from about 5% to under 1% over the same weeks, so treat every extra required field as expensive.
3. **The Ads conversion** fires once per person, in `lib/lead-client.ts`. Do not add a second call to it.
4. **`/api/voice/*`** is the phone screening, called by Twilio with signature verification. Do not edit these routes.
5. **`/api/lead` and `/api/version`.** `/api/version` is read by monitoring. Leave both alone.
6. **Google tags** (`NEXT_PUBLIC_GADS_*` in `app/layout.tsx`): do not remove or move them.

## Copy rules (Law Society of Ontario compliance, set by the client)

- Leslie is a licensed **paralegal**. Never write "lawyer" or "attorney". The client has also asked that the word
  "paralegal" not be used in ad copy; use "Licensed in Ontario". Check with the owner before adding either word to the site.
- No outcome promises or statistics ("98% win rate", "beat your ticket", "guaranteed dismissed"), no client outcomes,
  results or case galleries, no testimonials that describe outcomes beyond what already exists.
- No "upload your ticket" or any request to review a ticket before a conflict check and signed retainer.
- Business name is **Blottman Legal Services** (not "Blottman Law").
- Scope: Ontario traffic tickets only. **Not parking tickets, not paying fines, not court locations.** Those callers
  are junk for this business, so copy should not attract them.
- **Never invent facts.** The site needs an About page, but it needs Leslie's real licence number, business address,
  hours, years in practice and bio, and those have not been supplied. Do not make them up or use placeholders.

## Known problems you are welcome to fix (measured 2026-09-27)

- **Mobile speed.** Lighthouse mobile performance 61/100: largest contentful paint 4.2s (good is under 2.5s), total
  blocking time 650ms. The main headline arrives from the server in about 0.1s but does not paint for about 2s, so
  the delay is in the browser (CSS and JavaScript), not the server. About 95% of visitors are on phones. Google's
  Landing Page Experience score for this site is below average, and speed is one of its inputs.
- The Google Ads tag is the largest script and is required; do not remove it to improve the score.
- Images are placeholders or stock in places. The client has not supplied brand photography.

## What is where

`app/` routes and API · `components/` page sections · `lib/content.ts` all copy, charges and constants ·
`lib/lead-client.ts` form submit + click id + conversion · `lib/twilio.ts` phone screening helpers ·
`public/` images · `tailwind.config.ts` and `app/layout.tsx` colours and fonts (black + gold, Anton + Poppins).

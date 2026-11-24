# STAMP — Media passport

STAMP is a passport-style diary for everything you finish: films, series, books, manga, games and albums. Every finished work gets a rubber stamp pressed into your visa pages.

This repository holds both deliverables from the build prompt:

- **The STAMP app** at `/app`: an installable PWA for iPhone and iPad.
- **The marketing website** at `/`: static, and built from the same design tokens and components.

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000  (website)  ·  http://localhost:3000/app  (app)
```

Without any environment variables everything still works:

- **Continue without an account** issues a local-only passport. It is stored in IndexedDB on the device.
- **Email sign-in runs in demo mode.** No email is sent, and the 6-digit code is shown on the passport cover. This lets you try every Passport Control state: code, wrong code, magic link, ADMITTED, ISSUED and EXIT. Apple and Google sign-in are simulated the same way.
- **The Archivist and the Diplomat** fall back to keyword matching against the catalog. They label this "Keyword match · Catalog only".

Copy `.env.example` to `.env.local` to turn on real accounts, sync and AI.

| Variable | What it does |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Accounts (email code / magic link, Apple, Google), Postgres with Row Level Security, sync between devices |
| `ANTHROPIC_API_KEY` | Server-only. Powers `/api/archivist` and `/api/diplomat`. It never reaches the browser |
| `ANTHROPIC_MODEL` | Optional. Defaults to `claude-opus-5-5` |
| `ANTHROPIC_EFFORT` | Optional: `low`, `medium` (the default) or `high`. Use `low` for faster answers |
| `NEXT_PUBLIC_SITE_URL` | Optional. Base URL for metadata |

## Supabase setup

1. Create a project, then apply the schema and the catalog seed:
   ```bash
   supabase link --project-ref <ref>
   supabase db push                      # supabase/migrations/*_init.sql
   psql "$DATABASE_URL" -f supabase/seed.sql
   ```
   You can also paste both files into the SQL editor.
2. **Authentication → Providers**: enable **Email** with "Confirm email", and set the OTP length to 6. To enable **Apple** and **Google**, add each provider's client ID and secret.
3. **Authentication → Email templates → Magic link**: include **both** the code and the link, so one email serves the 6-digit code and the "Email me a link instead" path:
   ```html
   <h2>Your STAMP code: {{ .Token }}</h2>
   <p>Or open your passport: <a href="{{ .ConfirmationURL }}">sign in to STAMP</a></p>
   ```
4. **Authentication → URL configuration**: set the Site URL to your domain, and add `https://<your-domain>/app` (and `http://localhost:3000/app`) to the redirect URLs.

### What the schema does

- **Tables:** `profiles`, `items` (the seeded catalog), `custom_items`, `stamps`, `canon`, `wishlist`, `follows`, `likes`, `dispatches`.
- **Row Level Security:** each user reads and writes only their own rows. The exception is `dispatches`, which the people who follow you can read.
- **Public passport fields:** a follower reads them through `passport_cards(ids)`. Search by passport code goes through `find_passport(code)`.
- **Conflict handling:** a trigger keeps the newer write, comparing `updated_at` (last write wins). It also stamps `synced_at` with the server clock. Clients pull by `synced_at`, so a device with a slow clock is never skipped.
- **Tested:** the schema and RLS were checked against PostgreSQL 16, covering cross-user isolation, follower-only dispatches, last-write-wins and unique passport numbers.

### Sync

The app is offline-first:

- IndexedDB is the source of truth for the UI.
- Changes push about 1.5 s after an edit. The app also pulls and pushes when it comes back online, when it regains focus or visibility, and every 2 minutes while visible.
- Settings shows the sync status: "Synced", or "Saved on this device".

## The AI tools

Both routes call Claude from the server with the official SDK (`@anthropic-ai/sdk`):

- **Output:** structured JSON output, validated with zod (`src/lib/ai/schemas.ts`). Values are clamped and checked against the catalog. The Diplomat's pick is re-checked against everyone's intensity ceiling, and against person 1's comfort shield.
- **Model:** `claude-opus-5-5`, with the server-side refusal fallback turned on (`fallbacks: "default"`).
- **Errors:**
  - A rate limit or overload returns `429`. The client shows "The Archivist is busy. Wait a minute, then try again." next to a keyword match.
  - Offline, the client shows "You're offline — the Archivist needs a connection."
  - Any other failure also falls back to keyword matching.
- **Abuse guard:** a best-effort limit of 8 requests per minute per IP, per server instance.

## Scripts

| Script | |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js 16 (App Router, Turbopack) |
| `npm test` | Unit tests (vitest): heat, shield, taste match, MRZ, search, Wrapped, Letterboxd import, AI fallbacks, sync merge |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run gen:seed` | Regenerates `supabase/seed.sql` from `src/lib/catalog.ts` (Appendix A) |
| `npm run gen:icons` | Renders the PWA icons from the seal (needs Playwright) |
| `npm run gen:screens` | Re-shoots the real app screenshots used on the website (needs Playwright, Pillow and a running app) |

## Project layout

```
src/app/(marketing)/      website: sections 1–11 (§7)
src/app/app/              app routes: passport, discover, feed, people, wrapped, archivist, diplomat, shield
src/app/api/              archivist + diplomat route handlers (server-only key)
src/components/brand/     Seal, Stamp (4 shapes, worn-ink filter), Poster, MRZ, MatchRing, icons
src/components/control/   PassportControl: the login / sign-up animation (§9), timings in PC_TIMING
src/components/app/       shell (tab bar / rail), screens, sheets, record view, stamp moment
src/lib/                  catalog + seed data, heat, shield, match, MRZ, wrapped, Letterboxd, AI, store, sync, auth
supabase/                 migration (tables, RLS, functions) + generated seed
public/                   manifest, service worker (offline shell), icons, website screenshots
```

## PWA

- **Install:** add `/app` to the Home Screen from Safari's share sheet. It runs full-screen, with `apple-mobile-web-app-capable` and `viewport-fit=cover`, and respects safe areas.
- **Offline:** the service worker (`public/sw.js`, production builds only) pre-caches every app route and its assets. The passport and the visa pages then work offline.
- **App Store:** to ship there later, wrap the app with Capacitor. That also unlocks native haptics and Core NFC for the passport exchange.

## Decisions worth knowing

- **Contrast:** `--ink3` is `#6F6963` instead of `#7C766F`, so 10–12px labels pass WCAG 2.1 AA (4.5:1) on parchment.
- **Error text on the wine cover:** it uses the light rose `#EF8A9C`; rose-d would be too dark there.
- **Passport cover size:** the cover is 1:1.42, but on narrow phones it grows taller to fit the form, because the 44px touch targets win.
- **Feed content:** new passports follow the six sample citizens, so the feed has dispatches from day one. Sample people and dispatches are labelled as fictional, and unfollowing removes them.
- **Diplomat ceiling for Person 1:** it is prefilled from the comfort shield: No limits and Sensory safe → Peak, Sanctuary → Strong, Family → Mild.
- **Mystery dispatch image:** the flat-lay photo wasn't included in the prototype PDF, so the website draws the Repertory crate with CSS. To use a real photo, put it in `public/` and swap the `<figure className="crate">` in `src/app/(marketing)/page.tsx` for an `<img>`.
- **Demo sign-in:** it only exists when Supabase isn't configured.

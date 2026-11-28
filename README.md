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
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or the legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`) | Accounts (email code / magic link, Apple, Google), Postgres with Row Level Security, sync between devices |
| `ANTHROPIC_API_KEY` | Server-only. Powers `/api/archivist` and `/api/diplomat`. It never reaches the browser |
| `ANTHROPIC_MODEL` | Optional. Defaults to `claude-opus-5-5` |
| `ANTHROPIC_EFFORT` | Optional: `low`, `medium` (the default) or `high`. Use `low` for faster answers |
| `NEXT_PUBLIC_SITE_URL` | Optional. Base URL for metadata |
| `TMDB_API_KEY` | Films and series from TMDB in Discover search |
| `RAWG_API_KEY` | Games from RAWG in Discover search |

## Supabase setup

1. Create a project, then apply the schema and the catalog seed:
   ```bash
   supabase link --project-ref <ref>
   supabase db push                      # every file in supabase/migrations/, in order
   psql "$DATABASE_URL" -f supabase/seed.sql
   ```
   You can also paste the files into the SQL editor in this order: `20261124000000_init.sql`, `20261125000000_presence.sql` (the "Now" status), `20261125000100_api_grants.sql` (Data API access, needed when "Grant API access to new tables automatically" was left off), `20261128000000_shorts.sql` (Indie shorts), then `seed.sql`. Without the presence table everything else still syncs; "Now" just stays on the device.
2. **Authentication → Providers**: enable **Email** with "Confirm email", and set the OTP length to 6. To enable **Apple** and **Google**, add each provider's client ID and secret.
3. **Authentication → Emails → Magic link or OTP**: include **both** the code and the link, so one email serves the 6-digit code and the "Email me a link instead" path. Supabase only lets you edit templates once custom SMTP is set up (**Emails → SMTP Settings**, e.g. Resend); the built-in sender also only delivers to your organization's members, so real users need custom SMTP anyway. Until then the default email carries the link only, and signing in by link works.
   ```html
   <h2>Your STAMP code: {{ .Token }}</h2>
   <p>Or open your passport: <a href="{{ .ConfirmationURL }}">sign in to STAMP</a></p>
   ```
4. **Authentication → URL configuration**: set the Site URL to your domain, and add `https://<your-domain>/app` (and `http://localhost:3000/app`) to the redirect URLs.

### Deploying on Vercel

- Import the GitHub repo into Vercel; every push to `main` deploys to production.
- Link Supabase from **Supabase → Project Settings → Integrations → Vercel** ("Link Existing Supabase Account", scoped to this project). It writes `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (plus server-only Postgres and secret keys the app doesn't use) to the Vercel project.
- Variables apply from the next deployment, so redeploy once after linking.

### What the schema does

- **Tables:** `profiles`, `items` (the seeded catalog), `custom_items`, `stamps`, `canon`, `wishlist`, `follows`, `likes`, `dispatches`, `presence` (the "Now" status: one row per person, which expires on its own), `shorts` and `short_reports` (Indie shorts).
- **Row Level Security:** each user reads and writes only their own rows. The exceptions are `dispatches` and `presence`, which the people who follow you can read.
- **Public passport fields:** a follower reads them through `passport_cards(ids)`. Search by passport code goes through `find_passport(code)`.
- **Conflict handling:** a trigger keeps the newer write, comparing `updated_at` (last write wins). It also stamps `synced_at` with the server clock. Clients pull by `synced_at`, so a device with a slow clock is never skipped.
- **Indie shorts:** approved (`live`) shorts are public, even signed out; a pending or rejected film is visible only to the person who sent it. Senders can't set the status, edit, or have more than 5 films waiting. Reports are write-only. `short_applause(ids)` counts other people's applause (from `likes`, `short:<id>`).
- **Tested:** the schema and RLS were checked against PostgreSQL 16, covering cross-user isolation, follower-only dispatches, last-write-wins, unique passport numbers, and the shorts rules above.

### Sync

The app is offline-first:

- IndexedDB is the source of truth for the UI.
- Changes push about 1.5 s after an edit. The app also pulls and pushes when it comes back online, when it regains focus or visibility, and every 2 minutes while visible.
- Settings shows the sync status: "Synced", or "Saved on this device".

## Looks: Modern and Retro

The app has two looks, each in light and dark (4 in all). People pick one after sign-up and can change it in Settings; it's saved with the passport (`prefs.look`) and syncs. The website always uses its own paper style.

| | Modern | Retro |
| --- | --- | --- |
| Feel | Clean and calm, like the Apple TV app | An 80s horror-movie night: VHS tapes, screen-printed paper |
| Type | SF Pro on Apple devices, Inter elsewhere | Anton, Playfair italic, VT323 (VHS on-screen text), Permanent Marker (tape labels) |
| Controls | Soft rounded buttons, iOS segmented controls | Keys that press down, VCR piano keys, stars punched into a ticket, Dymo-label toasts |
| Stamping | "Stamp passport" button | Slide the rubber stamp along its rail (tap / Enter also work) |
| Light / dark | Sun / moon button | Pull the lamp cord (tap / Enter also work) |
| Dark mode | Black, Apple TV style | A VHS tape on a CRT: scanlines, OSD labels, "● REC" while stamping |

- Tokens live in `src/app/themes/modern.css` and `src/app/themes/retro.css` (`:root[data-look=…][data-theme=…]`); base component CSS stays in `globals.css`, `app/shell.css`, `app/screens.css`.
- `<html data-look data-theme>` is set before first paint (`src/app/app/layout.tsx`); a first visit follows the system's light or dark setting.
- Interactions: `SlideAction`, `PullCord`, swipe to turn visa pages; all have tap and keyboard alternatives and respect reduced motion.

## Sounds

Every button makes a sound, built in the browser with the Web Audio API (no audio files, `src/lib/sound.ts`).

- **Retro:** physical clacks: keys, VCR piano keys, a ticket punch, the lamp cord, a tape going in when you change pages at night, a Dymo label for toasts and a heavy rubber stamp.
- **Modern:** short, soft ticks and a clean stamp with a chime.
- One delegated listener gives every button its sound; an element can pick another with `data-sfx="…"`, or none with `data-sfx="none"`.
- Levels are set per sound (`LEVEL`), measured from offline renders. Settings → **Sounds** turns them all off (`prefs.sfx`, synced).

## Indie shorts

`/app/shorts` is a room for short films (up to 40 minutes) by new, independent filmmakers, free to watch. A card in Discover and the iPad rail lead there.

- **Watching:** a short of the day, filters by length and genre, a player using `youtube-nocookie.com` or Vimeo with Do Not Track, which loads only after Play is pressed. A short can be applauded, saved, stamped into the passport like any film, or reported.
- **Sending:** anyone with an account sends a YouTube or Vimeo link, title, length, genre, one line and optional content notes (which feed the comfort shield). The link is stored in one canonical form, so the same film can't be sent twice. Sent films appear under **Your films** with their status.
- **Until the first film is approved**, the room shows 6 clearly labelled sample films.
- **Approving:** in Supabase → Table Editor → `shorts`, set `status` to `live` (or `rejected`). Or in SQL:
  ```sql
  update shorts set status = 'live', reviewed_at = now() where id = '<id>';
  select s.title, r.reason, count(*) from short_reports r join shorts s on s.id = r.short_id group by 1, 2 order by 3 desc;
  ```

## World archives

Discover searches the 50-work catalog first, then the world archives through `/api/media/search`:

| Kind | Source | Key |
| --- | --- | --- |
| Films, series | TMDB (and anime from AniList) | `TMDB_API_KEY` |
| Books | Open Library | none |
| Manga | AniList | none |
| Games | RAWG | `RAWG_API_KEY` |
| Albums | MusicBrainz | none |

- A source without a key is simply skipped; a failing source never breaks the others.
- Results are cached at the edge for a day.
- An archive work is saved into the passport (as a custom item, so it syncs) only when it's stamped or wishlisted.
- Archive works have no heat vectors, so they show "No heat data" and the comfort shield doesn't gate them.

## Mystery dispatch (coming soon)

The monthly box is not on sale. The app shows it as "Coming soon" with a **Notify me** button, and the website shows the tiers without prices. Interest is saved in the passport's prefs, which sync to `profiles.prefs` for account holders. To count it:

```sql
select count(*) from profiles where prefs->>'dispatchInterest' = 'true';
```

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
| `npm run gen:logos` | Builds the logo pack in `public/brand/logos/` (needs Playwright; Pillow makes the PNGs smaller). `-- --zip <file>` also writes a zip |
| `npm run gen:screens` | Re-shoots the real app screenshots used on the website (needs Playwright, Pillow and a running app) |

## Project layout

```
src/app/(marketing)/      website: sections 1–11 (§7) and /brand (the logo pack)
src/app/app/              app routes: passport, discover, feed, people, wrapped, archivist, diplomat, shield
src/app/api/              archivist + diplomat route handlers (server-only key)
src/components/brand/     Seal, Stamp (4 shapes, worn-ink filter), Poster, MRZ, MatchRing, icons
src/components/control/   PassportControl: the login / sign-up animation (§9), timings in PC_TIMING
src/components/app/       shell (tab bar / rail), screens, sheets, record view, stamp moment
src/lib/                  catalog + seed data, heat, shield, match, MRZ, wrapped, Letterboxd, AI, store, sync, auth
supabase/                 migration (tables, RLS, functions) + generated seed
public/                   manifest, service worker (offline shell), icons, website screenshots, brand/logos (SVG + PNG)
```

## PWA

- **Install:** add `/app` to the Home Screen from Safari's share sheet. It runs full-screen, with `apple-mobile-web-app-capable` and `viewport-fit=cover`, and respects safe areas.
- **Offline:** the service worker (`public/sw.js`, production builds only) pre-caches every app route and its assets. The passport and the visa pages then work offline.
- **App Store:** to ship there later, wrap the app with Capacitor. That also unlocks native haptics and Core NFC for the passport exchange.

## Brand kit

27 logos in `public/brand/logos/`: seals (colour, one colour, white, rubber, Retro, night), wordmarks and lockups, app icons (Modern, Retro, VHS), postage stamp, ticket, passport cover, monogram, star, italic, neon, screen print, VCR screen, marker on tape, rubber stamp, Modern wordmark and badge, passport line and film reel.

- Each one is an SVG with its text turned into outlines (it looks the same without the fonts) and a transparent 1024px PNG. `contact-sheet.jpg` shows them all.
- The website lists them at `/brand` (linked from the footer) with downloads.
- Fonts: Anton, Playfair Display, JetBrains Mono, Inter, VT323 and Permanent Marker, all under the SIL Open Font License.

## Decisions worth knowing

- **Contrast:** `--ink3` is `#6F6963` instead of `#7C766F`, so 10–12px labels pass WCAG 2.1 AA (4.5:1) on parchment.
- **Error text on the wine cover:** it uses the light rose `#EF8A9C`; rose-d would be too dark there.
- **Passport cover size:** the cover is 1:1.42, but on narrow phones it grows taller to fit the form, because the 44px touch targets win.
- **Feed content:** new passports follow the six sample citizens, so the feed has dispatches from day one. Sample people and dispatches are labelled as fictional, and unfollowing removes them.
- **Diplomat ceiling for Person 1:** it is prefilled from the comfort shield: No limits and Sensory safe → Peak, Sanctuary → Strong, Family → Mild.
- **Mystery dispatch image:** the flat-lay photo wasn't included in the prototype PDF, so the website draws the Repertory crate with CSS. To use a real photo, put it in `public/` and swap the `<figure className="crate">` in `src/app/(marketing)/page.tsx` for an `<img>`.
- **Demo sign-in:** it only exists when Supabase isn't configured.

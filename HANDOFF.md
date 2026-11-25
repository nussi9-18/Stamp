# STAMP — handoff

Read this first in a new session. The spec is the original build prompt (STAMP_PROMPT, sections §0–§10 + Appendix A); `README.md` has setup details.

- Repo: `nussi9-18/Stamp`. `main` = `claude/new-session-84z8ky` (Vercel deploys `main`).
- Live: https://stamp-gilt.vercel.app (website) and `/app` (the app).
- Owner's PC: `C:\Users\moham\Projects\Stamp` (Windows, Claude Code at `%USERPROFILE%\.local\bin\claude.exe`, not on PATH).
- Owner speaks Arabic; reply in Arabic, keep it short and step-by-step (they often use a phone).

## Done

**App (`/app`, Next.js 16 + TypeScript + plain CSS, PWA)**
- Every screen in §5: Passport (holder card, canonical nine, paginated visa pages), Discover (iPad split view), record sheet (heat box, shield gate, stamp form), Feed, People (taste match), Wrapped (+ 1080×1920 share card), Archivist, Diplomat, Comfort shield, Settings (Letterboxd import), Field manual, phone tab bar, iPad rail, Nocturne.
- Stamp moment animation; Passport Control login/sign-up animation (§9: email code, magic link, Apple/Google, no-account passport, ADMITTED / ISSUED / EXIT, errors, reduced motion).
- Offline-first store (IndexedDB) + Supabase sync, last-write-wins (`src/lib/sync/sync.ts`).
- Demo sign-in when Supabase keys are missing (code shown on screen).
- PWA: manifest, icons from the seal, service worker offline shell.

**Server**
- `/api/archivist`, `/api/diplomat`: Claude (`claude-opus-5-5`, override `ANTHROPIC_MODEL`), zod-validated JSON, keyword fallback on failure/rate-limit/offline.
- `/api/media/search`: world archives — TMDB (films/series, `TMDB_API_KEY`), Open Library (books), AniList (manga/anime), RAWG (games, `RAWG_API_KEY`), MusicBrainz (albums). Results appear in Discover under "From the world archive"; saved to the passport only when stamped/wishlisted. No heat data for these.

**Two looks (Prompt 1, done)**
- Modern (Apple TV-like) and Retro (80s / VHS / IT vibe, tactile), each light + dark. Picked after sign-up, changeable in Settings, saved in `prefs.look` (syncs).
- Retro interactions: slide to stamp, lamp pull-cord for light/dark, piano-key segments, ticket-punch stars, Dymo toasts, VHS page wobble, swipe visa pages.
- Files: `src/app/themes/{modern,retro}.css`, `src/components/app/{SlideAction,PullCord,LookPicker,PageTitle}.tsx`. Checked at 320–1440px in all 4 looks, no overflow.

**Features added after the spec**
- "Now" status (like Discord): set from any record ("I'm watching this"), optional progress, fades after 1–24 h by kind, ends on stamp; shown on Passport, Feed "Right now", People. Followers-only via `presence` table.
- Mystery dispatch = **Coming soon** (owner can't ship physical goods): card on Passport + Settings with only a "Notify me" button (`prefs.dispatchInterest`); website shows tiers without prices. Count: `select count(*) from profiles where prefs->>'dispatchInterest'='true';`

**Database** (`supabase/migrations/`, validated on Postgres 16)
- `20261124000000_init.sql` tables + RLS + `passport_cards`, `find_passport`
- `20261125000000_presence.sql` "Now" status
- `20261125000100_api_grants.sql` Data API grants
- `supabase/seed.sql` catalog (Appendix A)

**Website (`/`)**: all 11 sections of §7, real app screenshots, static.

**Tests**: `npm test` (vitest), `npm run typecheck`, `npm run build` all pass.

## To do

**Owner (keys go in Vercel → Settings → Environment Variables, then Redeploy; never in the code/chat)**
1. Confirm Supabase is set up: all 3 migrations + `seed.sql` run; Site URL + redirect `https://stamp-gilt.vercel.app/app`; email template with `{{ .Token }}` and `{{ .ConfirmationURL }}` (needs custom SMTP); optional Google/Apple providers.
2. `TMDB_API_KEY` (films/series), `RAWG_API_KEY` (games; owner has one — put it in Vercel), `ANTHROPIC_API_KEY` (AI tools).
3. Decide: real TMDB posters vs typographic posters (spec says typographic for copyright); custom domain.

**Next prompts** — see NEXT_PROMPTS.md (Prompt 1 is done; start with Prompt 2: real posters + Retro zine style).

**Build — month plan**
- Week 2 (rest of "Now"): Spotify (OAuth, currently playing), Steam (Web API), Xbox (OpenXBL), PlayStation as "experimental" (unofficial NPSSO token; may break, against Sony terms). Owner's decisions so far: status visible to followers; TTLs as implemented.
- Week 3: Android app with Capacitor + plugin reading the system media session (Netflix/YouTube/etc. "now playing", needs Notification access). iPhone can't read other apps — manual/Spotify/Trakt only.
- Week 4 (beta): in-app "Feedback" button stored in Supabase, invite link for 50–100 testers, privacy policy + terms pages, custom domain, Google Play open testing ($25) / TestFlight ($99/yr).
- Monetisation (plan only, keep locked as "Coming soon", **no ads**): STAMP+ subscription (unlimited AI, monthly Wrapped, cover/ink themes, PDF export), one-off cover/stamp packs, festival/cinema partner stamps, affiliate "watch/buy" links. Stripe on web is cheaper than store billing (15–30%).

**Small leftovers**
- Archivist/Diplomat could also use the world archives (today: catalog + user's own items).
- Remote Control from a cloud session to the Windows PC didn't work (folder "not_available"); work from a session started on the PC instead (claude.ai/code → computer `nussi`, folder `Stamp`).

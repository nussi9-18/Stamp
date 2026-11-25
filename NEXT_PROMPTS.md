# STAMP — prompts for the next sessions

Send these one at a time, in order. Each one starts with: "Read HANDOFF.md first."
Reply to the owner in Arabic, short and step by step.

---

## Prompt 1 — Two themes: Modern and Retro (do this first)

Read HANDOFF.md first.

Redesign STAMP's look into **two complete themes**, each with **light and dark** (4 looks in total). This comes before any new feature, so everything built later supports both themes.

**Modern**
- Clean and calm: more white space, softer corners, a modern sans-serif, quieter headings.
- Real posters shown as they are.
- Fewer words, more icons.

**Retro**
- The zine / screen-print look: old paper, grain, halftone dots, two or three inks only (for example red + black, or blue + rust on cream), torn edges, chunky condensed titles, small collage details (stars, barcodes, tiny print).
- Keeps the passport and rubber-stamp idea.

**Rules**
- Build every colour from scratch for each of the 4 looks so they match. The owner's current complaint is that light and dark don't feel consistent.
- Switch in Settings (Theme: Modern / Retro + Light / Dark), and offer the choice once after sign-up.
- Keep text contrast WCAG AA, 44px touch targets and reduced-motion support.
- Show me screenshots of the main screens in all 4 looks before finishing, at 390×844 and 1180×820.

---

## Prompt 2 — Real posters, with a Retro "zine" style (beta)

Read HANDOFF.md first.

Show **real artwork** for every work:
- Films and series: TMDB posters.
- Books: Open Library covers.
- Manga: AniList covers.
- Games: RAWG images.
- Albums: Cover Art Archive.
- Keep the current typographic poster as the fallback when there's no image.

In the **Retro** theme, turn each real poster into a **zine / screen-print poster** automatically:
- Two or three inks picked per work, halftone dots, grain, aged paper, and the title in a chunky condensed font.
- References from the owner: two-colour halftone posters (red/black, blue/rust on cream), newspaper-collage manga covers, Xerox-style prints.
- Do it in the browser (canvas or SVG filters) or on the server, and cache the results.
- Label it **Beta** in Settings.
- Don't copy any artist's poster. Only imitate the style, generated from the official artwork.

Later we may add hand-made posters for chosen works. Leave a way for a per-work override image.

---

## Prompt 3 — Profile page and fewer words

Read HANDOFF.md first.

1. **Edit profile page.** Today the name and tastes are hidden inside Settings. Add a proper profile screen: photo (upload or initials), name, short bio, tastes (up to 3), and city (optional). Show the photo on the passport and on People. Sync with Supabase; add a migration and a storage bucket for photos, with RLS.
2. **Fewer words everywhere.** Go screen by screen and cut text: shorter helper lines, remove repeated labels, use icons where clear. Keep the meaning, but make every screen calmer. Show me before/after screenshots.

---

## Prompt 4 — Give the app a soul

Read HANDOFF.md first.

The owner feels the app is "lifeless". Make it feel alive without clutter:
- Small, meaningful motion: stamps landing, pages turning, gentle haptics.
- Personal touches: greetings by time of day, "on this day" memories from past stamps, a streak or "passport milestones" (10, 50, 100 stamps, first country, …).
- Empty states with character.
- Sound for stamping (already exists, off by default): make it nicer.
- Work in both themes; respect reduced motion.

Propose 5–8 ideas first, let the owner pick, then build.

---

## Prompt 5 — "Now": connect accounts

Read HANDOFF.md first.

The manual "Now" status is done. Add automatic sources:
- **Spotify:** OAuth, currently playing. Needs `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET`, redirect `https://stamp-gilt.vercel.app/api/spotify/callback`.
- **Steam:** Web API, `STEAM_API_KEY`, public profiles.
- **Xbox:** via OpenXBL.
- **PlayStation:** experimental, labelled as such. Uses the unofficial NPSSO token; may break, and is against Sony's terms.
- The manual status always stays available.

---

## Prompt 6 — Android app

Read HANDOFF.md first.

Wrap the app with Capacitor. On Android, add a plugin that reads the system media session (Netflix, YouTube, Shahid, Anghami, …) with Notification access, to fill the "Now" status automatically. iPhone can't read other apps, so keep manual / Spotify there. Prepare a Google Play internal test build.

---

## Prompt 7 — Beta launch

Read HANDOFF.md first.

- In-app **Feedback** button, saved in Supabase.
- Invite link for 50–100 testers.
- Privacy policy and terms pages.
- Custom domain (owner chooses).
- Google Play open testing and TestFlight.
- Keep Mystery dispatch and STAMP+ as **Coming soon**. No ads, ever.

// Indie shorts — short films by new and independent filmmakers.
// Pure helpers (no network): video links, validation, filters, samples.

import { hash } from './hash';
import type { HeatVector, Item } from './types';

export const SHORT_GENRES = ['drama', 'comedy', 'horror', 'animation', 'documentary', 'experimental', 'sci-fi', 'romance'] as const;
export type ShortGenre = (typeof SHORT_GENRES)[number];
export const GENRE_LABEL: Record<ShortGenre, string> = {
  drama: 'Drama',
  comedy: 'Comedy',
  horror: 'Horror',
  animation: 'Animation',
  documentary: 'Documentary',
  experimental: 'Experimental',
  'sci-fi': 'Sci-fi',
  romance: 'Romance',
};

export type ShortStatus = 'pending' | 'live' | 'rejected';

export type Short = {
  /** uuid, or `sample-…` for the made-up examples */
  id: string;
  title: string;
  filmmaker: string;
  /** canonical YouTube or Vimeo link ('' for samples) */
  url: string;
  mins: number;
  year?: number;
  cc?: string;
  genre: ShortGenre;
  logline: string;
  v: HeatVector | null;
  makerLink?: string;
  status: ShortStatus;
  createdAt: string;
  mine?: boolean;
  sample?: boolean;
};

export const STATUS_LABEL: Record<ShortStatus, string> = { pending: 'Waiting for review', live: 'Live', rejected: 'Not accepted' };

export const MAX_SHORT_MINS = 40;
export const MAX_PENDING = 5;

/* ── Video links (YouTube and Vimeo only) ─────────────────────────────── */

export type Video = { host: 'youtube' | 'vimeo'; id: string; hash?: string; url: string };

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^\d{5,12}$/;
const VIMEO_HASH = /^[0-9a-f]{6,20}$/;

function yt(id: string | null | undefined): Video | null {
  if (!id || !YT_ID.test(id)) return null;
  return { host: 'youtube', id, url: `https://www.youtube.com/watch?v=${id}` };
}

function vimeo(id: string | undefined, h?: string | null): Video | null {
  if (!id || !VIMEO_ID.test(id)) return null;
  const key = h && VIMEO_HASH.test(h) ? h : undefined;
  return { host: 'vimeo', id, hash: key, url: `https://vimeo.com/${id}${key ? `/${key}` : ''}` };
}

/** Read a pasted YouTube or Vimeo link into its canonical form; null for anything else. */
export function parseVideo(input: string): Video | null {
  let raw = input.trim();
  if (!raw || raw.length > 400) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = `https://${raw}`;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const host = u.hostname.toLowerCase().replace(/^(www|m)\./, '');
  const parts = u.pathname.split('/').filter(Boolean);
  if (host === 'youtu.be') return yt(parts[0]);
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (parts[0] === 'watch') return yt(u.searchParams.get('v'));
    if (['shorts', 'embed', 'live', 'v'].includes(parts[0])) return yt(parts[1]);
    return null;
  }
  if (host === 'player.vimeo.com') return parts[0] === 'video' ? vimeo(parts[1], u.searchParams.get('h')) : null;
  if (host === 'vimeo.com') {
    if (VIMEO_ID.test(parts[0] ?? '')) return vimeo(parts[0], u.searchParams.get('h') ?? parts[1]);
    const at = parts.indexOf('video');
    if (at >= 0) return vimeo(parts[at + 1], u.searchParams.get('h'));
    // vimeo.com/channels/staffpicks/123456789
    return vimeo([...parts].reverse().find((p) => VIMEO_ID.test(p)), u.searchParams.get('h'));
  }
  return null;
}

/** The privacy-friendly player address (no cookies until it plays). */
export function embedUrl(v: Video): string {
  if (v.host === 'youtube') return `https://www.youtube-nocookie.com/embed/${v.id}?rel=0&playsinline=1&autoplay=1`;
  return `https://player.vimeo.com/video/${v.id}?dnt=1&title=0&byline=0&autoplay=1${v.hash ? `&h=${v.hash}` : ''}`;
}

/** YouTube still frame; Vimeo has none without its API, so those get a title card. */
export function thumbUrl(v: Video | null, size: 'card' | 'hero' = 'card'): string | null {
  if (!v || v.host !== 'youtube') return null;
  return `https://i.ytimg.com/vi/${v.id}/${size === 'hero' ? 'hqdefault' : 'mqdefault'}.jpg`;
}

/* ── The submit form ─────────────────────────────────────────────────── */

export type ShortForm = {
  url: string;
  title: string;
  filmmaker: string;
  mins: string;
  year: string;
  cc: string;
  genre: ShortGenre | '';
  logline: string;
  /** heat vectors the film contains (indexes into VECTOR_NAMES) */
  notes: number[];
  makerLink: string;
  rights: boolean;
};

export type NewShort = {
  url: string;
  title: string;
  filmmaker: string;
  mins: number;
  year?: number;
  cc?: string;
  genre: ShortGenre;
  logline: string;
  v: HeatVector;
  makerLink?: string;
};

export type ShortField = Exclude<keyof ShortForm, 'notes'>;
export const FIELD_ORDER: ShortField[] = ['url', 'title', 'filmmaker', 'mins', 'genre', 'logline', 'year', 'cc', 'makerLink', 'rights'];

export function emptyShortForm(filmmaker = ''): ShortForm {
  return { url: '', title: '', filmmaker, mins: '', year: String(new Date().getFullYear()), cc: '', genre: '', logline: '', notes: [], makerLink: '', rights: false };
}

function httpsLink(s: string): string | null {
  try {
    const u = new URL(s.trim());
    return u.protocol === 'https:' && s.trim().length <= 300 ? u.toString() : null;
  } catch {
    return null;
  }
}

/** One field's problem in plain words, or null when it's fine. */
export function shortFieldError(field: ShortField, f: ShortForm, nowYear = new Date().getFullYear()): string | null {
  switch (field) {
    case 'url':
      return parseVideo(f.url) ? null : 'Paste a YouTube or Vimeo link to the film.';
    case 'title':
      return f.title.trim() ? (f.title.trim().length > 80 ? 'Keep the title under 80 characters.' : null) : 'Add the film’s title.';
    case 'filmmaker':
      return f.filmmaker.trim() ? (f.filmmaker.trim().length > 60 ? 'Keep the name under 60 characters.' : null) : 'Add who made it.';
    case 'mins': {
      const n = Number(f.mins);
      return Number.isInteger(n) && n >= 1 && n <= MAX_SHORT_MINS ? null : `Shorts here run 1 to ${MAX_SHORT_MINS} minutes.`;
    }
    case 'year': {
      if (!f.year.trim()) return null;
      const n = Number(f.year);
      return Number.isInteger(n) && n >= 1950 && n <= nowYear ? null : `Use a year from 1950 to ${nowYear}.`;
    }
    case 'cc':
      return !f.cc || /^[A-Z]{2}$/.test(f.cc) ? null : 'Pick a country from the list.';
    case 'genre':
      return f.genre ? null : 'Pick the closest genre.';
    case 'logline':
      return f.logline.trim() ? (f.logline.trim().length > 160 ? 'Keep it under 160 characters.' : null) : 'Add one line about the film.';
    case 'makerLink':
      return !f.makerLink.trim() || httpsLink(f.makerLink) ? null : 'Use a full link that starts with https://';
    case 'rights':
      return f.rights ? null : 'Tick this to send the film.';
  }
}

export function validateShort(f: ShortForm, nowYear = new Date().getFullYear()): { ok: true; value: NewShort } | { ok: false; errors: Partial<Record<ShortField, string>> } {
  const errors: Partial<Record<ShortField, string>> = {};
  for (const field of FIELD_ORDER) {
    const e = shortFieldError(field, f, nowYear);
    if (e) errors[field] = e;
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  const v = [0, 0, 0, 0, 0, 0, 0, 0] as HeatVector;
  for (const i of f.notes) if (i >= 0 && i < 8) v[i] = 2;
  return {
    ok: true,
    value: {
      url: parseVideo(f.url)!.url,
      title: f.title.trim(),
      filmmaker: f.filmmaker.trim(),
      mins: Number(f.mins),
      year: f.year.trim() ? Number(f.year) : undefined,
      cc: f.cc || undefined,
      genre: f.genre as ShortGenre,
      logline: f.logline.trim(),
      v,
      makerLink: f.makerLink.trim() ? httpsLink(f.makerLink)! : undefined,
    },
  };
}

/* ── Browsing ─────────────────────────────────────────────────────────── */

export type LengthBand = 'any' | 'u5' | '5-15' | '15+';
/** Shown under a "Minutes" label, so the unit isn't repeated on each key. */
export const LENGTH_BANDS: { id: LengthBand; label: string }[] = [
  { id: 'any', label: 'Any' },
  { id: 'u5', label: 'Under 5' },
  { id: '5-15', label: '5–15' },
  { id: '15+', label: '15+' },
];

export function inBand(mins: number, band: LengthBand): boolean {
  if (band === 'u5') return mins < 5;
  if (band === '5-15') return mins >= 5 && mins <= 15;
  if (band === '15+') return mins > 15;
  return true;
}

/** The same pick for everyone on a given day. */
export function shortOfTheDay(list: Short[], day: string): Short | null {
  if (!list.length) return null;
  const sorted = [...list].sort((a, b) => a.id.localeCompare(b.id));
  return sorted[hash(`short:${day}`) % sorted.length];
}

export const shortItemId = (id: string) => `short:${id}`;
export const applauseKey = (id: string) => `short:${id}`;

/** A short as a passport work, so it can be stamped and saved like any film. */
export function shortToItem(s: Short): Item {
  return { id: shortItemId(s.id), kind: 'film', title: s.title, year: s.year, by: s.filmmaker, mins: s.mins, cc: s.cc, v: s.v, log: s.logline, custom: true, source: 'shorts' };
}

/* ── Countries ────────────────────────────────────────────────────────── */

const CC =
  'AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW';

let names: Intl.DisplayNames | null | undefined;
export function regionName(cc?: string): string {
  if (!cc) return '';
  if (names === undefined) {
    try {
      names = new Intl.DisplayNames(['en'], { type: 'region' });
    } catch {
      names = null;
    }
  }
  try {
    return names?.of(cc) ?? cc;
  } catch {
    return cc;
  }
}

let countries: { cc: string; name: string }[] | null = null;
export function countryOptions(): { cc: string; name: string }[] {
  countries ??= CC.split(' ')
    .map((cc) => ({ cc, name: regionName(cc) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return countries;
}

/* ── Samples (shown only until the first real shorts are approved) ─────── */

const S = (id: string, title: string, filmmaker: string, mins: number, year: number, cc: string, genre: ShortGenre, logline: string, v: string): Short => ({
  id: `sample-${id}`,
  title,
  filmmaker,
  url: '',
  mins,
  year,
  cc,
  genre,
  logline,
  v: v.split('').map(Number) as HeatVector,
  status: 'live',
  createdAt: '2026-11-01T00:00:00.000Z',
  sample: true,
});

export const SAMPLE_SHORTS: Short[] = [
  S('ferryman', 'Tea for the Ferryman', 'Rania Saab', 11, 2025, 'LB', 'drama', 'A ferryman in Tripoli keeps a cup of tea ready for a passenger who stopped coming.', '00010000'),
  S('paper-moons', 'Paper Moons', 'Kenji Aoyama', 6, 2026, 'JP', 'animation', 'A girl cuts moons out of newspaper until one of them starts to glow.', '00000000'),
  S('static', 'Static', 'Ola Nwosu', 14, 2025, 'NG', 'horror', 'A night-shift radio host hears her own voice calling in.', '01031010'),
  S('lunch-break', 'Lunch Break', 'Marta Silva', 4, 2026, 'PT', 'comedy', 'Two office workers fight a silent war over the last chair in the sun.', '00001000'),
  S('video-store', 'The Last Video Store', 'Tom Hale', 18, 2024, 'GB', 'documentary', 'The final week of a seaside video shop and the regulars who still rent tapes.', '00001000'),
  S('salt-light', 'Salt Light', 'Noor Khalil', 9, 2026, 'JO', 'experimental', 'One day at the Dead Sea, first light to dark, without a word.', '00000010'),
];

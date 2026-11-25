// Core domain types — see STAMP build prompt §3.

export type Kind = 'film' | 'series' | 'book' | 'manga' | 'game' | 'album';

/** Heat vectors 0–3, in order: sex, violence, gore, dread, language, substances, flashing, animal. */
export type HeatVector = [number, number, number, number, number, number, number, number];

export type Item = {
  id: string;
  kind: Kind;
  title: string;
  year?: number;
  /** director / author / artist / studio */
  by: string;
  /** total time: runtime, total watch/read/play time */
  mins?: number;
  /** ISO-ish country code (HK, JP, LB, SU…) */
  cc?: string;
  v: HeatVector | null;
  /** one-line plain-language description */
  log: string;
  /** added by the user / imported / found in a world archive */
  custom?: boolean;
  /** where an external work came from: tmdb, openlibrary, anilist, rawg, musicbrainz */
  source?: string;
};

export type Place = 'home' | 'out' | 'event';

export const MOODS = [
  'Rain-soaked',
  'Slow burn',
  'Tender',
  'Unsettling',
  'Funny',
  'Gorgeous',
  'Devastating',
  'Dreamlike',
] as const;
export type Mood = (typeof MOODS)[number];

export type Rating = 0 | 1 | 2 | 3 | 4 | 5;

export type Stamp = {
  itemId: string;
  /** 0 only for imports without a rating (no stars drawn) */
  rating: Rating;
  tags: Mood[];
  /** YYYY-MM-DD */
  date: string;
  place: Place;
  note: string;
  createdAt: number;
};

export type ShieldPreset = 'open' | 'sanctuary' | 'family' | 'sensory' | 'custom';
export type ShieldAction = 'hide' | 'blur' | 'warn';
export type Shield = { preset: ShieldPreset; limits: number[]; action: ShieldAction };

export type Theme = 'day' | 'night';

/** The two looks: Modern (clean, Apple TV-like) and Retro (VHS / 80s print, tactile). */
export type Look = 'modern' | 'retro';

export const AFFINITIES = [
  'Slow cinema',
  'Arab cinema',
  'Animation',
  'Horror & dread',
  'Manga',
  'Games',
  'Books',
  'Music',
  'Romance',
  'Documentary',
] as const;

export type Passport = {
  userId: string;
  name: string;
  /** 'STMP-' + 4 digits */
  passportNo: string;
  /** YYYY-MM-DD */
  issued: string;
  /** max 3 */
  affinities: string[];
  /** max 9 item ids, ordered */
  canon: string[];
  wishlist: string[];
  follows: string[];
  likes: string[];
  shield: Shield;
  theme: Theme;
};

export type Person = {
  id: string;
  name: string;
  handle: string;
  city: string;
  av: string;
  bio: string;
  /** item id → rating */
  r: Record<string, number>;
  /** canon item ids (sample people: their top-rated works) */
  canon?: string[];
  sample?: boolean;
};

export type Dispatch = {
  id: string;
  p: string;
  item: string;
  rating: number;
  place: Place;
  date: string;
  ago: string;
  note: string;
  sample?: boolean;
};

export type LiveSession = { p: string; item: string; pct: number | null; label: string };

// "Now" — what someone is watching, reading, playing or listening to right now (like a Discord status).
// Set by hand from a record; it expires on its own and ends when the work is stamped.

import type { Kind } from './types';

export type NowStatus = {
  itemId: string;
  /** free progress text: "S2 · E6", "Vol. 14", "46 h in", "Track 7 of 10" */
  label: string;
  /** 0–100, or null when unknown */
  pct: number | null;
  startedAt: number;
  expiresAt: number;
  updatedAt: number;
  /** tombstone so a "stop" syncs too */
  cleared?: boolean;
};

const HOUR = 3_600_000;

/** How long a status lasts before it fades on its own. */
export const NOW_TTL: Record<Kind, number> = {
  film: 3 * HOUR,
  series: 3 * HOUR,
  album: 1 * HOUR,
  book: 24 * HOUR,
  manga: 24 * HOUR,
  game: 24 * HOUR,
};

export function nowVerb(kind: Kind): string {
  if (kind === 'book' || kind === 'manga') return 'Reading';
  if (kind === 'game') return 'Playing';
  if (kind === 'album') return 'Listening to';
  return 'Watching';
}

export function nowPlaceholder(kind: Kind): string {
  switch (kind) {
    case 'series':
      return 'S2 · E6';
    case 'book':
      return 'Chapter 12';
    case 'manga':
      return 'Vol. 14';
    case 'game':
      return '46 h in';
    case 'album':
      return 'Track 7 of 10';
    default:
      return 'Half-way through';
  }
}

/** The status if it's still running, else null. */
export function liveNow<T extends Pick<NowStatus, 'expiresAt' | 'cleared'>>(s: T | null | undefined, at = Date.now()): T | null {
  if (!s || s.cleared || s.expiresAt <= at) return null;
  return s;
}

export function makeNow(itemId: string, kind: Kind, label: string, pct: number | null, at = Date.now(), prev?: NowStatus | null): NowStatus {
  const same = prev && liveNow(prev, at) && prev.itemId === itemId;
  return {
    itemId,
    label: label.trim().slice(0, 40),
    pct: pct === null || Number.isNaN(pct) ? null : Math.max(0, Math.min(100, Math.round(pct))),
    startedAt: same ? prev!.startedAt : at,
    expiresAt: at + NOW_TTL[kind],
    updatedAt: at,
  };
}

/** "for 2 h", "for 12 min" */
export function since(startedAt: number, at = Date.now()): string {
  const m = Math.max(1, Math.round((at - startedAt) / 60_000));
  return m < 60 ? `${m} min` : `${Math.round(m / 60)} h`;
}

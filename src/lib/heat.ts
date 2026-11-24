import type { HeatVector, Item, Kind } from './types';

export const VECTOR_NAMES = [
  'Sex & nudity',
  'Violence',
  'Gore',
  'Dread & fear',
  'Language',
  'Substances',
  'Flashing lights',
  'Animal harm',
] as const;

export const LEVEL_NAMES = ['Clear', 'Mild', 'Strong', 'Peak'] as const;
export type Tier = (typeof LEVEL_NAMES)[number];

/** CSS custom property for each level / tier. */
export const LEVEL_VARS = ['var(--clear)', 'var(--mild)', 'var(--strong)', 'var(--peak)'] as const;

/** Heat score 0–10: min(10, max(v)*2.4 + sum(v)*0.22). */
export function heatScore(v: HeatVector | null | undefined): number | null {
  if (!v) return null;
  const max = Math.max(...v);
  const sum = v.reduce((a, b) => a + b, 0);
  return Math.min(10, max * 2.4 + sum * 0.22);
}

export function tierIndex(score: number): 0 | 1 | 2 | 3 {
  if (score < 3.6) return 0;
  if (score < 6.6) return 1;
  if (score < 8.9) return 2;
  return 3;
}

export function tierName(score: number): Tier {
  return LEVEL_NAMES[tierIndex(score)];
}

export function formatScore(score: number): string {
  return (Math.round(score * 10) / 10).toFixed(1);
}

/** e.g. { score: 9.4, label: "Peak 9.4", tier: 3 } — or null for "No heat data". */
export function heatOf(item: Pick<Item, 'v'>): { score: number; tier: 0 | 1 | 2 | 3; label: string } | null {
  const s = heatScore(item.v);
  if (s === null) return null;
  const t = tierIndex(s);
  return { score: s, tier: t, label: `${LEVEL_NAMES[t]} ${formatScore(s)}` };
}

/** Highest single vector level of an item (its "intensity"), or null without data. */
export function intensity(v: HeatVector | null | undefined): number | null {
  return v ? Math.max(...v) : null;
}

/** Time display: films/albums or under 120 min → "98 min"; otherwise "≈25 h". */
export function formatTime(item: Pick<Item, 'kind' | 'mins'>): string {
  const m = item.mins;
  if (!m && m !== 0) return '—';
  if (item.kind === 'film' || item.kind === 'album' || m < 120) return `${m} min`;
  return `≈${Math.round(m / 60)} h`;
}

export function timeLabel(kind: Kind): string {
  if (kind === 'book' || kind === 'manga') return 'Reading';
  if (kind === 'game') return 'Playtime';
  return 'Runtime';
}

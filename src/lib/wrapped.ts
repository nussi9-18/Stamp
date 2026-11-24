import { monthOf, yearOf } from './format';
import { heatScore, tierIndex } from './heat';
import type { Item, Kind, Mood, Stamp } from './types';
import { KINDS } from './catalog';

export type YearStats = {
  year: number;
  stamps: number;
  mins: number;
  avg: number | null;
  fiveStars: number;
};

export type WrappedData = YearStats & {
  countries: string[];
  topCreator: { name: string; count: number } | null;
  perMonth: number[];
  mediaMix: Record<Kind, number>;
  heatMix: [number, number, number, number];
  noHeat: number;
  moods: Mood[];
  prev: YearStats | null;
};

type Lookup = (id: string) => Item | undefined;

/** Years that have stamps + the current year, the last four, oldest first. */
export function wrappedYears(stamps: Stamp[], currentYear: number): number[] {
  const set = new Set<number>([currentYear]);
  for (const s of stamps) set.add(yearOf(s.date));
  return [...set]
    .sort((a, b) => b - a)
    .slice(0, 4)
    .sort((a, b) => a - b);
}

function yearStats(year: number, stamps: Stamp[], get: Lookup): YearStats {
  const ys = stamps.filter((s) => yearOf(s.date) === year);
  const mins = ys.reduce((acc, s) => acc + (get(s.itemId)?.mins ?? 0), 0);
  const rated = ys.filter((s) => s.rating > 0);
  const avg = rated.length ? rated.reduce((a, s) => a + s.rating, 0) / rated.length : null;
  return { year, stamps: ys.length, mins, avg, fiveStars: ys.filter((s) => s.rating === 5).length };
}

export function computeWrapped(year: number, stamps: Stamp[], get: Lookup): WrappedData {
  const ys = stamps.filter((s) => yearOf(s.date) === year);
  const base = yearStats(year, stamps, get);
  const prevStats = yearStats(year - 1, stamps, get);

  const countries: string[] = [];
  const creators = new Map<string, { count: number; best: number; latest: string }>();
  const perMonth = new Array(12).fill(0) as number[];
  const mediaMix = Object.fromEntries(KINDS.map((k) => [k, 0])) as Record<Kind, number>;
  const heatMix: [number, number, number, number] = [0, 0, 0, 0];
  let noHeat = 0;
  const moodCount = new Map<Mood, number>();

  for (const s of ys) {
    const item = get(s.itemId);
    perMonth[monthOf(s.date)]++;
    if (!item) continue;
    if (item.cc && !countries.includes(item.cc.toUpperCase())) countries.push(item.cc.toUpperCase());
    if (item.by) {
      const c = creators.get(item.by) ?? { count: 0, best: 0, latest: '' };
      c.count++;
      c.best = Math.max(c.best, s.rating);
      if (s.date > c.latest) c.latest = s.date;
      creators.set(item.by, c);
    }
    mediaMix[item.kind]++;
    const score = heatScore(item.v);
    if (score === null) noHeat++;
    else heatMix[tierIndex(score)]++;
    for (const t of s.tags) moodCount.set(t, (moodCount.get(t) ?? 0) + 1);
  }

  let topCreator: WrappedData['topCreator'] = null;
  for (const [name, c] of creators) {
    if (
      !topCreator ||
      c.count > topCreator.count ||
      (c.count === topCreator.count && (c.best > (creators.get(topCreator.name)?.best ?? 0) ||
        (c.best === (creators.get(topCreator.name)?.best ?? 0) && c.latest > (creators.get(topCreator.name)?.latest ?? ''))))
    ) {
      topCreator = { name, count: c.count };
    }
  }

  const moods = [...moodCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([m]) => m);

  return {
    ...base,
    countries,
    topCreator,
    perMonth,
    mediaMix,
    heatMix,
    noHeat,
    moods,
    prev: prevStats.stamps > 0 ? prevStats : null,
  };
}

/** "+50%" / "−12%" / "±0%" */
export function pctChange(prev: number, cur: number): string {
  if (prev <= 0) return '';
  const p = Math.round(((cur - prev) / prev) * 100);
  if (p > 0) return `+${p}%`;
  if (p < 0) return `−${Math.abs(p)}%`;
  return '±0%';
}

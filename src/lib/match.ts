/**
 * Taste match: shared = items both rated. If none → "New".
 * m = 100 − avgAbsDiff × 18, w = min(1, shared/4), pct = round(55 × (1−w) + m × w).
 */
export type MatchResult = {
  pct: number | null;
  shared: string[];
  bothFive: string[];
};

export function tasteMatch(mine: Record<string, number>, theirs: Record<string, number>): MatchResult {
  const shared = Object.keys(theirs).filter((id) => (mine[id] ?? 0) > 0 && (theirs[id] ?? 0) > 0);
  if (!shared.length) return { pct: null, shared: [], bothFive: [] };
  const avgAbsDiff = shared.reduce((acc, id) => acc + Math.abs(mine[id] - theirs[id]), 0) / shared.length;
  const m = 100 - avgAbsDiff * 18;
  const w = Math.min(1, shared.length / 4);
  const pct = Math.round(55 * (1 - w) + m * w);
  const bothFive = shared.filter((id) => mine[id] === 5 && theirs[id] === 5);
  return { pct, shared, bothFive };
}

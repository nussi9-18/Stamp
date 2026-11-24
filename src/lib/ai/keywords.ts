import { countryName } from '../catalog';
import { norm } from '../search';
import type { Item } from '../types';

export const STOPWORDS = new Set(
  `a an the and or but if then so of in on at to for from by with without into onto over under about after before
  his her their its our your my me i we you he she they it this that these those there here who whom whose which what when where why how
  is are was were be been being am do does did done have has had having can could would should will shall may might must
  some any all each every no not only just very really quite also too more most much many few lot lots one two three
  thing things something someone stuff kind sort like think remember remembered maybe probably around about roughly
  keeps keep kept plays play played playing over again ever even still back while because though although
  film movie show series book novel manga game album record song songs track watched read played saw seen`
    .split(/\s+/)
    .filter(Boolean),
);

/** Very small stemmer: plural and -ing/-ed endings. */
export function stem(w: string): string {
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith('es') && !w.endsWith('ses')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

export function tokens(text: string): string[] {
  return norm(text)
    .split(' ')
    .filter((w) => w && !STOPWORDS.has(w));
}

export type ItemIndex = { item: Item; title: Set<string>; by: Set<string>; log: Set<string>; place: Set<string>; titleNorm: string };

export function indexItem(item: Item): ItemIndex {
  const set = (s: string) => new Set(tokens(s).map(stem));
  return {
    item,
    title: set(item.title),
    by: set(item.by),
    log: set(item.log),
    place: set(`${countryName(item.cc)} ${item.cc ?? ''}`),
    titleNorm: norm(item.title),
  };
}

/** "mid 90s", "nineties", "1994", "early 2000s" → a year range. */
export function yearHints(text: string): { from: number; to: number; word: string }[] {
  const t = norm(text);
  const out: { from: number; to: number; word: string }[] = [];
  for (const m of t.matchAll(/\b(19|20)(\d{2})\b/g)) {
    const y = Number(m[1] + m[2]);
    out.push({ from: y - 1, to: y + 1, word: m[0] });
  }
  for (const m of t.matchAll(/\b(?:(early|mid|late)\s+)?(?:(19|20)?(\d)0s|(\d)0 s)\b/g)) {
    const century = m[2] ? Number(m[2]) * 100 : null;
    const decadeDigit = Number(m[3] ?? m[4]);
    const base = century !== null ? century + decadeDigit * 10 : decadeDigit >= 3 ? 1900 + decadeDigit * 10 : 2000 + decadeDigit * 10;
    let from = base;
    let to = base + 9;
    if (m[1] === 'early') to = base + 4;
    if (m[1] === 'mid') {
      from = base + 3;
      to = base + 7;
    }
    if (m[1] === 'late') from = base + 5;
    out.push({ from, to, word: m[0] });
  }
  const words: Record<string, number> = { fifties: 1950, sixties: 1960, seventies: 1970, eighties: 1980, nineties: 1990 };
  for (const [w, base] of Object.entries(words)) if (t.includes(w)) out.push({ from: base, to: base + 9, word: w });
  return out;
}

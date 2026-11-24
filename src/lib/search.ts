import { countryName, KIND_LABEL } from './catalog';
import type { Item } from './types';

/** Lowercase, accent-insensitive, punctuation folded to spaces. */
export function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function haystack(item: Item): string {
  return norm(
    [item.title, item.by, item.year ?? '', countryName(item.cc), item.cc ?? '', item.kind, KIND_LABEL[item.kind]].join(' '),
  );
}

/** Matches title, creator, year, country name, type (accent-insensitive). Every word must match. */
export function searchItems(items: Item[], query: string): Item[] {
  const q = norm(query);
  if (!q) return items;
  const tokens = q.split(' ');
  return items.filter((item) => {
    const hay = haystack(item);
    return tokens.every((t) => hay.includes(t) || (t.length > 3 && t.endsWith('s') && hay.includes(t.slice(0, -1))));
  });
}

import { isISODate, todayISO } from './format';
import { norm } from './search';
import type { Item, Rating, Stamp } from './types';

export const LB_MAX_ROWS = 2000;
export const LB_EMPTY = 'That file looks empty.';
export const LB_NOT_EXPORT = 'This doesn’t look like a Letterboxd export. Pick diary.csv or ratings.csv.';

/** RFC 4180-ish CSV parser: quoted fields, escaped quotes, commas and newlines inside quotes, CRLF, BOM. */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== '')) rows.push(row);
  return rows;
}

export type LbRow = { name: string; year?: number; rating: Rating; date: string };

/** Rating 0.5–5 → round, min 1; blank → 0. */
export function lbRating(raw: string | undefined): Rating {
  const n = Number.parseFloat((raw ?? '').trim());
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(5, Math.max(1, Math.round(n))) as Rating;
}

export function readLetterboxd(text: string, today = todayISO()): { rows: LbRow[] } | { error: string } {
  const table = parseCSV(text);
  if (table.length === 0) return { error: LB_EMPTY };
  const header = table[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const iName = col('name');
  const iYear = col('year');
  const iRating = col('rating');
  const iWatched = col('watched date');
  const iDate = col('date');
  if (iName < 0 || iRating < 0 || (iWatched < 0 && iDate < 0)) return { error: LB_NOT_EXPORT };
  const data = table.slice(1, LB_MAX_ROWS + 1);
  if (data.length === 0) return { error: LB_EMPTY };
  const rows: LbRow[] = [];
  for (const r of data) {
    const name = (r[iName] ?? '').trim();
    if (!name) continue;
    const yearNum = iYear >= 0 ? Number.parseInt((r[iYear] ?? '').trim(), 10) : NaN;
    const watched = iWatched >= 0 ? (r[iWatched] ?? '').trim() : '';
    const dated = iDate >= 0 ? (r[iDate] ?? '').trim() : '';
    const date = isISODate(watched) ? watched : isISODate(dated) ? dated : today;
    rows.push({ name, year: Number.isFinite(yearNum) ? yearNum : undefined, rating: lbRating(r[iRating]), date: date > today ? today : date });
  }
  if (rows.length === 0) return { error: LB_EMPTY };
  return { rows };
}

function slug(s: string): string {
  return norm(s).replace(/\s+/g, '-').slice(0, 48) || 'untitled';
}

export type ImportPlan = { stamps: Stamp[]; newItems: Item[] };

/**
 * Match catalog by normalised title + year; otherwise create a custom film item
 * (100 min, no heat data). Skip already-stamped items. Within one file, keep the latest entry.
 */
export function planImport(rows: LbRow[], known: Item[], stamped: Set<string>, now = Date.now()): ImportPlan {
  const byKey = new Map<string, Item>();
  for (const it of known) byKey.set(`${norm(it.title)}|${it.year ?? ''}`, it);
  const latest = new Map<string, { row: LbRow; item: Item; isNew: boolean }>();
  for (const row of rows) {
    const key = `${norm(row.name)}|${row.year ?? ''}`;
    let item = byKey.get(key);
    let isNew = false;
    if (!item) {
      item = {
        id: `lb-${slug(row.name)}-${row.year ?? 'x'}`,
        kind: 'film',
        title: row.name,
        year: row.year,
        by: '',
        mins: 100,
        v: null,
        log: 'Imported from Letterboxd.',
        custom: true,
      };
      byKey.set(key, item);
      isNew = true;
    }
    if (stamped.has(item.id)) continue;
    const prev = latest.get(item.id);
    if (!prev || row.date > prev.row.date) latest.set(item.id, { row, item, isNew: prev ? prev.isNew : isNew });
  }
  const stamps: Stamp[] = [];
  const newItems: Item[] = [];
  let i = 0;
  for (const { row, item, isNew } of latest.values()) {
    stamps.push({ itemId: item.id, rating: row.rating, tags: [], date: row.date, place: 'home', note: '', createdAt: now + i++ });
    if (isNew) newItems.push(item);
  }
  return { stamps, newItems };
}

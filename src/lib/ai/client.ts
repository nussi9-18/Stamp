'use client';

import { allItems } from '../store/store';
import type { Item } from '../types';
import { archivistFallback } from './archivist';
import { diplomatFallback } from './diplomat';
import type { ArchivistResult, DiplomatPerson, DiplomatResult } from './schemas';

export const MSG_BUSY = 'The Archivist is busy. Wait a minute, then try again.';
export const MSG_OFFLINE = 'You’re offline — the Archivist needs a connection.';
export const MSG_FAILED = 'The Archivist couldn’t answer just now, so this is a keyword match against the catalog.';
export const MSG_DIPLOMAT_BUSY = 'The Diplomat is busy. Wait a minute, then try again.';
export const MSG_DIPLOMAT_OFFLINE = 'You’re offline — the Diplomat needs a connection.';
export const MSG_DIPLOMAT_FAILED = 'The Diplomat couldn’t answer just now, so this pick comes from a keyword match against the catalog.';

type Outcome<T> = { result: T; note: string | null };

function extraItems(): { id: string; title: string; year?: number; by: string; kind: Item['kind'] }[] {
  return allItems()
    .filter((i) => i.custom)
    .slice(0, 200)
    .map((i) => ({ id: i.id, title: i.title.slice(0, 160), year: i.year, by: (i.by || '').slice(0, 120), kind: i.kind }));
}

async function post<T>(url: string, body: unknown, signal?: AbortSignal): Promise<{ ok: true; data: T } | { ok: false; status: number | 'offline' }> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ok: false, status: 'offline' };
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, data: (await res.json()) as T };
  } catch (e) {
    if ((e as DOMException)?.name === 'AbortError') throw e;
    return { ok: false, status: typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 0 };
  }
}

export async function askArchivist(clues: string, signal?: AbortSignal): Promise<Outcome<ArchivistResult>> {
  const r = await post<ArchivistResult>('/api/archivist', { clues, extra: extraItems() }, signal);
  if (r.ok && r.data.match) return { result: r.data, note: null };
  const fallback = archivistFallback(clues, allItems());
  if (r.ok) return { result: fallback, note: MSG_FAILED };
  const note = r.status === 'offline' ? MSG_OFFLINE : r.status === 429 ? MSG_BUSY : MSG_FAILED;
  return { result: fallback, note };
}

export async function askDiplomat(people: DiplomatPerson[], shield: number[] | undefined, signal?: AbortSignal): Promise<Outcome<DiplomatResult>> {
  const r = await post<DiplomatResult>('/api/diplomat', { people, shield, extra: extraItems() }, signal);
  if (r.ok && r.data.pick) return { result: r.data, note: null };
  const fallback = diplomatFallback(people, shield, allItems());
  if (r.ok) return { result: fallback, note: MSG_DIPLOMAT_FAILED };
  const note = r.status === 'offline' ? MSG_DIPLOMAT_OFFLINE : r.status === 429 ? MSG_DIPLOMAT_BUSY : MSG_DIPLOMAT_FAILED;
  return { result: fallback, note };
}

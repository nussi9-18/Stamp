'use client';

import { ago } from '../format';
import { supabase } from '../supabase/client';
import { getState, setState } from '../store/store';
import type { Dispatch, Item, Person } from '../types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AVATARS = ['#F5C6D0', '#7EA8BE', '#E2DCCE', '#B8894A'];

type Card = { id: string; name: string; passport_no: string; affinities: string[] | null; canon: string[] | null };
type DispatchRow = { id: string; user_id: string; item_id: string; item: Item | null; rating: number; place: Dispatch['place']; note: string | null; date: string; updated_at: string };

function toPerson(c: Card, r: Record<string, number>): Person {
  return {
    id: c.id,
    name: c.name,
    handle: c.passport_no,
    city: 'Passport holder',
    av: AVATARS[c.passport_no.charCodeAt(c.passport_no.length - 1) % AVATARS.length],
    bio: c.affinities?.length ? c.affinities.join(' · ') : 'A fellow passport holder.',
    r,
    canon: c.canon ?? [],
  };
}

/** Load real people you follow (public passport fields + their dispatches). */
export async function refreshSocial(): Promise<void> {
  const sb = supabase();
  const d = getState().data;
  if (!sb || !d || d.mode !== 'account') return;
  const ids = Object.entries(d.follows)
    .filter(([id, f]) => f.on && UUID.test(id))
    .map(([id]) => id);
  if (!ids.length) {
    setState({ remote: { people: [], dispatches: [], items: {} } });
    return;
  }
  const [cards, rows] = await Promise.all([
    sb.rpc('passport_cards', { ids }),
    sb.from('dispatches').select('*').in('user_id', ids).order('updated_at', { ascending: false }).limit(200),
  ]);
  if (cards.error || rows.error) return;
  const items: Record<string, Item> = {};
  const ratings: Record<string, Record<string, number>> = {};
  const dispatches: Dispatch[] = ((rows.data ?? []) as DispatchRow[]).map((r) => {
    if (r.item) items[r.item_id] = { ...r.item, id: r.item_id, custom: true };
    (ratings[r.user_id] ??= {})[r.item_id] = r.rating;
    return { id: r.id, p: r.user_id, item: r.item_id, rating: r.rating, place: r.place, date: r.date, ago: ago(Date.parse(r.updated_at)), note: r.note ?? '' };
  });
  const people = ((cards.data ?? []) as Card[]).map((c) => toPerson(c, ratings[c.id] ?? {}));
  setState({ remote: { people, dispatches, items } });
}

export type FindResult = { status: 'found'; person: Person } | { status: 'none' } | { status: 'self' } | { status: 'offline' };

export async function findPassportByCode(code: string): Promise<FindResult> {
  const sb = supabase();
  const d = getState().data;
  if (!sb || !d) return { status: 'none' };
  if (d.passport?.passportNo.toUpperCase() === code.toUpperCase()) return { status: 'self' };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { status: 'offline' };
  const { data, error } = await sb.rpc('find_passport', { code });
  if (error) return { status: 'none' };
  const row = ((data ?? []) as Card[])[0];
  if (!row) return { status: 'none' };
  return { status: 'found', person: toPerson({ ...row, canon: [] }, {}) };
}

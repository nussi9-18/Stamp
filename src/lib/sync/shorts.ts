'use client';

// The indie shorts room over Supabase: approved films are public, your own submissions are
// visible only to you, and approval happens in the dashboard (see the shorts migration).

import { supabase } from '../supabase/client';
import { getState, setState, type ShortsState } from '../store/store';
import type { NewShort, Short, ShortGenre, ShortStatus } from '../shorts';
import type { HeatVector } from '../types';

type Row = {
  id: string;
  user_id: string;
  title: string;
  filmmaker: string;
  url: string;
  mins: number;
  year: number | null;
  cc: string | null;
  genre: ShortGenre;
  logline: string;
  v: number[] | null;
  maker_link: string | null;
  status: ShortStatus;
  created_at: string;
};

const COLS = 'id,user_id,title,filmmaker,url,mins,year,cc,genre,logline,v,maker_link,status,created_at';

function toShort(r: Row, me: string | null): Short {
  return {
    id: r.id,
    title: r.title,
    filmmaker: r.filmmaker,
    url: r.url,
    mins: r.mins,
    year: r.year ?? undefined,
    cc: r.cc ?? undefined,
    genre: r.genre,
    logline: r.logline,
    v: r.v?.length === 8 ? (r.v as HeatVector) : null,
    makerLink: r.maker_link ?? undefined,
    status: r.status,
    createdAt: r.created_at,
    mine: !!me && r.user_id === me,
  };
}

function patch(p: Partial<ShortsState> | ((s: ShortsState) => Partial<ShortsState>)) {
  setState((st) => ({ shorts: { ...st.shorts, ...(typeof p === 'function' ? p(st.shorts) : p) } }));
}

function me(): string | null {
  const d = getState().data;
  return d?.mode === 'account' ? d.userId : null;
}

const offline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

let inflight: Promise<void> | null = null;

/** Load the approved films (anyone) and your own submissions (with an account). */
export function loadShorts(): Promise<void> {
  inflight ??= (async () => {
    const sb = supabase();
    if (!sb) return patch({ status: 'local' });
    if (offline()) return patch({ status: 'offline' });
    patch({ status: 'loading' });
    const uid = me();
    const [live, mine] = await Promise.all([
      sb.from('shorts').select(COLS).eq('status', 'live').order('created_at', { ascending: false }).limit(300),
      uid ? sb.from('shorts').select(COLS).eq('user_id', uid).order('created_at', { ascending: false }).limit(50) : null,
    ]);
    if (live.error) return patch({ status: 'error' });
    const liveShorts = ((live.data ?? []) as Row[]).map((r) => toShort(r, uid));
    const applause = await fetchApplause(liveShorts.map((s) => s.id));
    patch({
      status: 'ok',
      live: liveShorts,
      mine: mine && !mine.error ? ((mine.data ?? []) as Row[]).map((r) => toShort(r, uid)) : [],
      applause,
    });
  })()
    .catch(() => patch({ status: offline() ? 'offline' : 'error' }))
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

async function fetchApplause(ids: string[]): Promise<Record<string, number>> {
  const sb = supabase();
  if (!sb || !ids.length) return {};
  const { data, error } = await sb.rpc('short_applause', { ids });
  if (error) return getState().shorts.applause;
  return Object.fromEntries(((data ?? []) as { short_id: string; others: number }[]).map((r) => [r.short_id, Number(r.others)]));
}

export type SendResult = { ok: true; short: Short } | { ok: false; error: string };

export async function submitShort(v: NewShort): Promise<SendResult> {
  const sb = supabase();
  const uid = me();
  if (!sb || !uid) return { ok: false, error: 'Sending a film needs an account.' };
  if (offline()) return { ok: false, error: 'You’re offline. Send it again once you’re back online.' };
  const { data, error } = await sb
    .from('shorts')
    .insert({
      user_id: uid,
      title: v.title,
      filmmaker: v.filmmaker,
      url: v.url,
      mins: v.mins,
      year: v.year ?? null,
      cc: v.cc ?? null,
      genre: v.genre,
      logline: v.logline,
      v: v.v,
      maker_link: v.makerLink ?? null,
    })
    .select(COLS)
    .single();
  if (error || !data) {
    if (error?.code === '23505') return { ok: false, error: 'This film is already in the room or waiting for review.' };
    if (error?.code === 'P0001') return { ok: false, error: 'You have 5 films waiting for review. Send more once those are checked.' };
    return { ok: false, error: 'Couldn’t send it just now. Try again in a minute.' };
  }
  const short = toShort(data as Row, uid);
  patch((s) => ({ mine: [short, ...s.mine.filter((x) => x.id !== short.id)] }));
  return { ok: true, short };
}

export async function withdrawShort(id: string): Promise<boolean> {
  const sb = supabase();
  if (!sb || !me()) return false;
  const { error } = await sb.from('shorts').delete().eq('id', id);
  if (error) return false;
  patch((s) => ({ mine: s.mine.filter((x) => x.id !== id), live: s.live.filter((x) => x.id !== id) }));
  return true;
}

export type ReportReason = 'not-theirs' | 'harmful' | 'broken' | 'spam';

export async function reportShort(id: string, reason: ReportReason): Promise<boolean> {
  const sb = supabase();
  const uid = me();
  if (!sb || !uid) return false;
  const { error } = await sb.from('short_reports').insert({ short_id: id, user_id: uid, reason });
  // Reporting twice is still a report.
  return !error || error.code === '23505';
}

'use client';

// Offline-first sync with Supabase: IndexedDB is the source of truth for the UI; changes are pushed
// on edit (debounced), on reconnect and on app focus. Conflicts resolve last-write-wins by updated_at.
// Pulls use a server-stamped `synced_at` watermark so a device with a slow clock is never skipped.

import { DEFAULT_SHIELD } from '../shield';
import { supabase } from '../supabase/client';
import type { Item, Mood, Place, Rating, Shield, Theme } from '../types';
import {
  applyTheme,
  emptyData,
  getState,
  onDataChange,
  persistNow,
  replaceData,
  setState,
  type CustomRec,
  type Flag,
  type PassportCore,
  type StampRec,
  type UserData,
} from '../store/store';
import { refreshSocial } from './social';

const iso = (t: number) => new Date(t).toISOString();
const ms = (s: string | null | undefined) => (s ? Date.parse(s) : 0);

type ProfileRow = {
  id: string;
  name: string;
  passport_no: string;
  issued: string;
  affinities: string[] | null;
  shield: Shield | null;
  theme: Theme | null;
  prefs: Partial<UserData['prefs']> | null;
  updated_at: string;
  synced_at?: string;
};
type StampRow = {
  user_id: string;
  item_id: string;
  rating: number;
  tags: string[] | null;
  date: string;
  place: Place;
  note: string | null;
  created_at: string;
  updated_at: string;
  deleted: boolean;
  synced_at?: string;
};
type CanonRow = { user_id: string; position: number; item_id: string | null; updated_at: string; synced_at?: string };
type FlagRow = { user_id: string; key: string; deleted: boolean; updated_at: string; synced_at?: string };
type CustomRow = { user_id: string; id: string; item: Item; updated_at: string; deleted: boolean; synced_at?: string };
export type PresenceRow = {
  user_id: string;
  item_id: string;
  item: Item | null;
  label: string;
  pct: number | null;
  started_at: string;
  expires_at: string;
  cleared: boolean;
  updated_at: string;
  synced_at?: string;
};

const FLAG_TABLES = {
  wishlist: { table: 'wishlist', col: 'item_id' },
  follows: { table: 'follows', col: 'target' },
  likes: { table: 'likes', col: 'dispatch_id' },
} as const;

export function profileToCore(r: ProfileRow): PassportCore {
  return {
    name: r.name,
    passportNo: r.passport_no,
    issued: r.issued,
    affinities: r.affinities ?? [],
    shield: r.shield ?? { ...DEFAULT_SHIELD },
    theme: r.theme ?? 'day',
    updatedAt: ms(r.updated_at),
  };
}

function coreToRow(userId: string, p: PassportCore, prefs: UserData['prefs']) {
  return {
    id: userId,
    name: p.name,
    passport_no: p.passportNo,
    issued: p.issued,
    affinities: p.affinities,
    shield: p.shield,
    theme: p.theme,
    prefs,
    updated_at: iso(p.updatedAt),
  };
}

export type ProfileFetch = { status: 'found'; core: PassportCore; prefs: Partial<UserData['prefs']> } | { status: 'none' } | { status: 'error' };

export async function fetchProfile(userId: string): Promise<ProfileFetch> {
  const sb = supabase();
  if (!sb) return { status: 'none' };
  const { data, error } = await sb.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) return { status: 'error' };
  if (!data) return { status: 'none' };
  return { status: 'found', core: profileToCore(data as ProfileRow), prefs: (data as ProfileRow).prefs ?? {} };
}

/** Insert the new passport, retrying with a fresh number if STMP-#### is taken. */
export async function createProfile(userId: string, core: PassportCore, prefs: UserData['prefs']): Promise<PassportCore> {
  const sb = supabase();
  if (!sb) return core;
  let p = core;
  for (let attempt = 0; attempt < 6; attempt++) {
    const { error } = await sb.from('profiles').upsert(coreToRow(userId, p, prefs), { onConflict: 'id' });
    if (!error) return p;
    if (error.code === '23505' && /passport_no/.test(error.message + (error.details ?? ''))) {
      p = { ...p, passportNo: `STMP-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}` };
      continue;
    }
    throw error;
  }
  throw new Error('Could not issue a unique passport number');
}

type Remote = {
  profile: ProfileRow | null;
  stamps: StampRow[];
  canon: CanonRow[];
  flags: Record<keyof typeof FLAG_TABLES, FlagRow[]>;
  custom: CustomRow[];
  presence?: PresenceRow | null;
};

async function fetchRemote(userId: string, since: string | null): Promise<Remote> {
  const sb = supabase()!;
  const q = <T,>(table: string, select = '*') => {
    let b = sb.from(table).select(select).eq(table === 'profiles' ? 'id' : 'user_id', userId);
    if (since) b = b.gt('synced_at', since);
    return b as unknown as Promise<{ data: T[] | null; error: { message: string } | null }>;
  };
  const [profile, stamps, canon, wish, follows, likes, custom, presence] = await Promise.all([
    q<ProfileRow>('profiles'),
    q<StampRow>('stamps'),
    q<CanonRow>('canon'),
    q<{ user_id: string; item_id: string; deleted: boolean; updated_at: string; synced_at: string }>('wishlist'),
    q<{ user_id: string; target: string; deleted: boolean; updated_at: string; synced_at: string }>('follows'),
    q<{ user_id: string; dispatch_id: string; deleted: boolean; updated_at: string; synced_at: string }>('likes'),
    q<CustomRow>('custom_items'),
    q<PresenceRow>('presence'),
  ]);
  for (const r of [profile, stamps, canon, wish, follows, likes, custom]) if (r.error) throw new Error(r.error.message);
  // presence is optional: older databases without the table keep syncing everything else
  return {
    profile: profile.data?.[0] ?? null,
    stamps: stamps.data ?? [],
    canon: canon.data ?? [],
    flags: {
      wishlist: (wish.data ?? []).map((r) => ({ user_id: r.user_id, key: r.item_id, deleted: r.deleted, updated_at: r.updated_at, synced_at: r.synced_at })),
      follows: (follows.data ?? []).map((r) => ({ user_id: r.user_id, key: r.target, deleted: r.deleted, updated_at: r.updated_at, synced_at: r.synced_at })),
      likes: (likes.data ?? []).map((r) => ({ user_id: r.user_id, key: r.dispatch_id, deleted: r.deleted, updated_at: r.updated_at, synced_at: r.synced_at })),
    },
    custom: custom.data ?? [],
    presence: presence.error ? null : (presence.data?.[0] ?? null),
  };
}

function maxSynced(r: Remote, prev: string | null): string | null {
  let best = prev ? ms(prev) : 0;
  let bestIso = prev;
  const all: { synced_at?: string }[] = [
    ...(r.profile ? [r.profile] : []),
    ...r.stamps,
    ...r.canon,
    ...r.flags.wishlist,
    ...r.flags.follows,
    ...r.flags.likes,
    ...r.custom,
    ...(r.presence ? [r.presence] : []),
  ];
  for (const x of all) {
    const t = ms(x.synced_at);
    if (t > best) {
      best = t;
      bestIso = x.synced_at ?? bestIso;
    }
  }
  return bestIso;
}

/** Merge server rows into local data, last-write-wins by updated_at. */
export function mergeRemote(d: UserData, r: Remote): UserData {
  const next: UserData = { ...d, stamps: { ...d.stamps }, wishlist: { ...d.wishlist }, follows: { ...d.follows }, likes: { ...d.likes }, custom: { ...d.custom } };
  if (r.profile) {
    const t = ms(r.profile.updated_at);
    if (!d.passport || d.passport.updatedAt < t) {
      next.passport = profileToCore(r.profile);
      if (r.profile.prefs) next.prefs = { ...d.prefs, ...r.profile.prefs };
    }
  }
  for (const s of r.stamps) {
    const t = ms(s.updated_at);
    const local = d.stamps[s.item_id];
    if (!local || local.updatedAt < t) {
      next.stamps[s.item_id] = {
        itemId: s.item_id,
        rating: Math.max(0, Math.min(5, s.rating)) as Rating,
        tags: (s.tags ?? []) as Mood[],
        date: s.date,
        place: s.place,
        note: s.note ?? '',
        createdAt: ms(s.created_at),
        updatedAt: t,
        deleted: s.deleted,
      } satisfies StampRec;
    }
  }
  if (r.canon.length) {
    const t = Math.max(...r.canon.map((c) => ms(c.updated_at)));
    if (t > d.canon.updatedAt) {
      const ids = r.canon
        .filter((c) => c.item_id && ms(c.updated_at) === t)
        .sort((a, b) => a.position - b.position)
        .map((c) => c.item_id as string);
      next.canon = { ids, updatedAt: t };
    }
  }
  (Object.keys(FLAG_TABLES) as (keyof typeof FLAG_TABLES)[]).forEach((k) => {
    for (const f of r.flags[k]) {
      const t = ms(f.updated_at);
      const local: Flag | undefined = d[k][f.key];
      if (!local || local.updatedAt < t) next[k][f.key] = { on: !f.deleted, updatedAt: t };
    }
  });
  if (r.presence) {
    const p = r.presence;
    const t = ms(p.updated_at);
    if (!d.now || d.now.updatedAt < t) {
      next.now = { itemId: p.item_id, label: p.label, pct: p.pct, startedAt: ms(p.started_at), expiresAt: ms(p.expires_at), updatedAt: t, cleared: p.cleared };
      if (p.item && !next.custom[p.item_id]) next.custom[p.item_id] = { ...p.item, id: p.item_id, custom: true, updatedAt: t };
    }
  }
  for (const c of r.custom) {
    const t = ms(c.updated_at);
    const local = d.custom[c.id];
    if (!local || local.updatedAt < t) next.custom[c.id] = { ...c.item, id: c.id, custom: true, updatedAt: t, deleted: c.deleted } satisfies CustomRec;
  }
  return next;
}

/** First sign-in on a device: everything the account has. */
export async function pullAll(userId: string, email?: string): Promise<UserData> {
  const base = emptyData(userId, 'account', email);
  const r = await fetchRemote(userId, null);
  const merged = mergeRemote(base, r);
  merged.sync = { lastPullAt: maxSynced(r, null), dirtyAt: 0, pushedAt: Date.now() };
  return merged;
}

async function push(d: UserData): Promise<number> {
  const sb = supabase()!;
  const since = d.sync.pushedAt;
  const startedAt = Date.now() - 1;
  const uid = d.userId;
  const ops: PromiseLike<{ error: { message: string } | null }>[] = [];

  if (d.passport && d.passport.updatedAt > since) {
    ops.push(sb.from('profiles').upsert(coreToRow(uid, d.passport, d.prefs), { onConflict: 'id' }));
  }
  const stamps = Object.values(d.stamps).filter((s) => s.updatedAt > since);
  if (stamps.length) {
    ops.push(
      sb.from('stamps').upsert(
        stamps.map((s) => ({
          user_id: uid,
          item_id: s.itemId,
          rating: s.rating,
          tags: s.tags,
          date: s.date,
          place: s.place,
          note: s.note,
          created_at: iso(s.createdAt || s.updatedAt),
          updated_at: iso(s.updatedAt),
          deleted: !!s.deleted,
        })),
        { onConflict: 'user_id,item_id' },
      ),
    );
    // Public stamp events for followers' feeds.
    const live = stamps.filter((s) => !s.deleted);
    const gone = stamps.filter((s) => s.deleted).map((s) => s.itemId);
    if (live.length) {
      ops.push(
        sb.from('dispatches').upsert(
          live.map((s) => {
            const custom = d.custom[s.itemId];
            return {
              user_id: uid,
              item_id: s.itemId,
              item: custom ? { id: custom.id, kind: custom.kind, title: custom.title, year: custom.year, by: custom.by, mins: custom.mins, cc: custom.cc, v: null, log: custom.log } : null,
              rating: s.rating,
              place: s.place,
              note: s.note,
              date: s.date,
              updated_at: iso(s.updatedAt),
            };
          }),
          { onConflict: 'user_id,item_id' },
        ),
      );
    }
    if (gone.length) ops.push(sb.from('dispatches').delete().eq('user_id', uid).in('item_id', gone));
  }
  if (d.canon.updatedAt > since) {
    ops.push(
      sb.from('canon').upsert(
        Array.from({ length: 9 }, (_, i) => ({ user_id: uid, position: i + 1, item_id: d.canon.ids[i] ?? null, updated_at: iso(d.canon.updatedAt) })),
        { onConflict: 'user_id,position' },
      ),
    );
  }
  (Object.keys(FLAG_TABLES) as (keyof typeof FLAG_TABLES)[]).forEach((k) => {
    const { table, col } = FLAG_TABLES[k];
    const rows = Object.entries(d[k]).filter(([, f]) => f.updatedAt > since);
    if (rows.length) {
      ops.push(
        sb.from(table).upsert(
          rows.map(([key, f]) => ({ user_id: uid, [col]: key, deleted: !f.on, updated_at: iso(f.updatedAt) })),
          { onConflict: `user_id,${col}` },
        ),
      );
    }
  });
  const custom = Object.values(d.custom).filter((c) => c.updatedAt > since);
  if (custom.length) {
    ops.push(
      sb.from('custom_items').upsert(
        custom.map(({ updatedAt, deleted, ...item }) => ({ user_id: uid, id: item.id, item, updated_at: iso(updatedAt), deleted: !!deleted })),
        { onConflict: 'user_id,id' },
      ),
    );
  }
  if (d.now && d.now.updatedAt > since) {
    const n = d.now;
    const custom = d.custom[n.itemId];
    ops.push(
      sb.from('presence').upsert(
        {
          user_id: uid,
          item_id: n.itemId,
          item: custom ? { id: custom.id, kind: custom.kind, title: custom.title, year: custom.year, by: custom.by, mins: custom.mins, cc: custom.cc, v: null, log: custom.log } : null,
          label: n.label,
          pct: n.pct,
          started_at: iso(n.startedAt),
          expires_at: iso(n.expiresAt),
          cleared: !!n.cleared,
          updated_at: iso(n.updatedAt),
        },
        { onConflict: 'user_id' },
      ),
    );
  }
  const results = await Promise.all(ops);
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);
  return startedAt;
}

let running: Promise<void> | null = null;
let again = false;

/** Pull then push. Safe to call often; concurrent calls coalesce. */
export async function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      const d0 = getState().data;
      if (!d0 || d0.mode !== 'account' || !supabase()) return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setState({ syncState: 'offline' });
        return;
      }
      setState({ syncState: 'syncing' });
      try {
        const r = await fetchRemote(d0.userId, d0.sync.lastPullAt);
        const cur = getState().data;
        if (!cur || cur.userId !== d0.userId) return;
        const merged = mergeRemote(cur, r);
        merged.sync = { ...cur.sync, lastPullAt: maxSynced(r, cur.sync.lastPullAt) };
        replaceData(merged);
        if (merged.passport) applyTheme(merged.passport.theme);
        const pushedAt = await push(merged);
        const after = getState().data;
        if (after && after.userId === d0.userId) {
          replaceData({ ...after, sync: { ...after.sync, pushedAt } });
          await persistNow();
        }
        setState({ syncState: 'synced' });
        void refreshSocial();
      } catch {
        setState({ syncState: typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'error' });
      }
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
}

let stopFn: (() => void) | null = null;

export function startSync(): () => void {
  stopFn?.();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const schedule = (ms = 1500) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void syncNow(), ms);
  };
  const offChange = onDataChange((d) => {
    if (d.mode === 'account') schedule();
  });
  const onOnline = () => {
    setState({ online: true });
    void syncNow();
  };
  const onOffline = () => setState({ online: false, syncState: getState().data?.mode === 'account' ? 'offline' : 'local' });
  const onVisible = () => {
    if (document.visibilityState === 'visible') void syncNow();
  };
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  window.addEventListener('focus', onVisible);
  document.addEventListener('visibilitychange', onVisible);
  const interval = setInterval(() => {
    if (document.visibilityState === 'visible') void syncNow();
  }, 120_000);
  void syncNow();
  stopFn = () => {
    offChange();
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
    window.removeEventListener('focus', onVisible);
    document.removeEventListener('visibilitychange', onVisible);
    clearInterval(interval);
    if (timer) clearTimeout(timer);
    stopFn = null;
  };
  return stopFn;
}

export function stopSync() {
  stopFn?.();
}

'use client';

import { flushSync } from 'react-dom';
import { PEOPLE } from '../catalog';
import {
  applyTheme,
  closeAllSheets,
  currentUserId,
  emptyData,
  getState,
  loadUser,
  makePassport,
  openSheet,
  persistNow,
  replaceData,
  restoreRevealed,
  setCurrentUser,
  setState,
  type Mode,
  type UserData,
} from '../store/store';
import { idbDel, idbSet, lsGet } from '../store/idb';
import { hasSupabase } from '../supabase/client';
import { createProfile, fetchProfile, pullAll, startSync, stopSync } from '../sync/sync';
import { refreshSocial } from '../sync/social';
import { auth, type AuthUser } from './adapter';

export const LOCAL_ID = 'local';

export type Resolution =
  | { kind: 'returning'; data: UserData }
  | { kind: 'new'; user: { id: string; email?: string }; mode: Mode }
  | { kind: 'error'; code: 'network' };

/* ── Boot ──────────────────────────────────────────────────────────────── */

let booted = false;

export async function bootApp(): Promise<void> {
  if (booted) return;
  booted = true;
  restoreRevealed();
  setState({ online: typeof navigator === 'undefined' ? true : navigator.onLine });

  let user: AuthUser | null = null;
  try {
    user = hasSupabase() ? await auth().current() : null;
  } catch {
    user = null;
  }

  if (user) {
    const local = await loadUser(user.id);
    if (local?.passport) {
      enter(local);
      return;
    }
    // Back from a magic link or OAuth: resolve inside Passport Control, with the animation.
    setState({ boot: 'ready', auth: 'signed-out', control: { kind: 'oauth-return' } });
    return;
  }

  const pointer = currentUserId();
  if (pointer && !pointer.match(/^[0-9a-f-]{36}$/i)) {
    const d = await loadUser(pointer);
    if (d?.passport) {
      enter(d);
      return;
    }
  }
  applyTheme('day');
  setState({ boot: 'ready', auth: 'signed-out' });
}

/** Commit a signed-in passport to the app. */
export function enter(d: UserData) {
  replaceData(d);
  setCurrentUser(d.userId);
  if (d.passport) applyTheme(d.passport.theme);
  setState({ boot: 'ready', auth: 'signed-in', control: null, syncState: d.mode === 'account' ? 'syncing' : 'local' });
  void persistNow();
  if (d.mode === 'account') {
    startSync();
    void refreshSocial();
  }
}

/* ── Sign-in resolution ───────────────────────────────────────────────── */

export async function resolveUser(u: AuthUser, mode: Mode): Promise<Resolution> {
  if (mode !== 'account') {
    const d = await loadUser(u.id);
    if (d?.passport) return { kind: 'returning', data: d };
    return { kind: 'new', user: u, mode };
  }
  const local = await loadUser(u.id);
  const prof = await fetchProfile(u.id);
  if (prof.status === 'error') {
    if (local?.passport) return { kind: 'returning', data: local };
    return { kind: 'error', code: 'network' };
  }
  if (prof.status === 'found') {
    if (local?.passport) return { kind: 'returning', data: local };
    try {
      return { kind: 'returning', data: await pullAll(u.id, u.email) };
    } catch {
      return { kind: 'error', code: 'network' };
    }
  }
  return { kind: 'new', user: u, mode };
}

/** "Continue without an account": open the passport kept on this device, or issue one. */
export async function resolveLocal(): Promise<Resolution> {
  const d = await loadUser(LOCAL_ID);
  if (d?.passport) return { kind: 'returning', data: d };
  return { kind: 'new', user: { id: LOCAL_ID }, mode: 'local' };
}

/** Issue a brand-new passport (§9.4). */
export async function issuePassport(res: Extract<Resolution, { kind: 'new' }>, name: string, affinities: string[]): Promise<UserData> {
  const theme = (lsGet('stamp:theme') as 'day' | 'night' | null) ?? 'day';
  const d = emptyData(res.user.id, res.mode, res.user.email);
  const now = Date.now();
  d.passport = makePassport(name, affinities, theme === 'night' ? 'night' : 'day');
  // New passports follow the six sample citizens so the feed has dispatches from day one.
  for (const p of PEOPLE) d.follows[p.id] = { on: true, updatedAt: now };
  d.sync = { lastPullAt: null, dirtyAt: now, pushedAt: 0 };
  if (res.mode === 'account') d.passport = await createProfile(res.user.id, d.passport, d.prefs);
  await idbSet(`user:${d.userId}`, d);
  return d;
}

/** Save a local passport into an account (from the banner / Settings). */
export async function migrateLocal(u: AuthUser): Promise<Resolution> {
  const local = getState().data ?? (await loadUser(LOCAL_ID));
  if (!local?.passport || local.mode !== 'local') return resolveUser(u, 'account');
  const prof = await fetchProfile(u.id);
  if (prof.status === 'error') return { kind: 'error', code: 'network' };
  let data: UserData;
  const asAccount: UserData = { ...local, userId: u.id, mode: 'account', email: u.email, sync: { lastPullAt: null, dirtyAt: Date.now(), pushedAt: 0 } };
  if (prof.status === 'none') {
    const passport = await createProfile(u.id, asAccount.passport!, asAccount.prefs);
    data = { ...asAccount, passport };
  } else {
    // The account already has a passport: keep it, and fold this device's stamps in (last write wins).
    const remote = await pullAll(u.id, u.email);
    data = {
      ...asAccount,
      passport: remote.passport,
      prefs: remote.prefs,
      stamps: { ...asAccount.stamps },
      custom: { ...asAccount.custom },
      wishlist: { ...asAccount.wishlist },
      follows: { ...asAccount.follows },
      likes: { ...asAccount.likes },
    };
    for (const [id, s] of Object.entries(remote.stamps)) if (!data.stamps[id] || data.stamps[id].updatedAt < s.updatedAt) data.stamps[id] = s;
    for (const [id, c] of Object.entries(remote.custom)) if (!data.custom[id] || data.custom[id].updatedAt < c.updatedAt) data.custom[id] = c;
    for (const k of ['wishlist', 'follows', 'likes'] as const) {
      for (const [id, f] of Object.entries(remote[k])) if (!data[k][id] || data[k][id].updatedAt < f.updatedAt) data[k][id] = f;
    }
    if (remote.canon.updatedAt > data.canon.updatedAt) data.canon = remote.canon;
  }
  await idbSet(`user:${u.id}`, data);
  await idbDel(`user:${LOCAL_ID}`);
  return { kind: 'returning', data };
}

/* ── Leaving ───────────────────────────────────────────────────────────── */

function withViewTransition(cls: string, update: () => void): Promise<void> {
  const doc = document as Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } };
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!doc.startViewTransition || reduce) {
    update();
    return Promise.resolve();
  }
  document.documentElement.classList.add(cls);
  const vt = doc.startViewTransition(() => flushSync(update));
  return vt.finished.finally(() => document.documentElement.classList.remove(cls));
}

/** Settings → Sign out: the app shell fades to the open passport, EXIT, the cover closes. */
export function beginSignOut() {
  closeAllSheets();
  void withViewTransition('vt-exit', () => setState({ control: { kind: 'exit' } }));
}

/** Called by Passport Control once the EXIT sequence starts. */
export async function completeSignOut() {
  stopSync();
  await persistNow();
  const d = getState().data;
  if (d?.mode === 'account') await auth().signOut();
  setCurrentUser(null);
  applyTheme('day');
  replaceData(null, { persist: false });
  setState({ auth: 'signed-out', remote: { people: [], dispatches: [], items: {}, live: [] }, sheets: [], syncState: 'local', revealed: {} });
  try {
    sessionStorage.removeItem('stamp:revealed');
  } catch {
    /* ignore */
  }
}

export function beginSaveAccount() {
  closeAllSheets();
  setState({ control: { kind: 'save' } });
}

export function cancelControl() {
  setState({ control: null });
}

/** Walk through passport control into the app (§9.3, last step). */
export function walkThrough(data: UserData, isNew: boolean): Promise<void> {
  const finish = () => {
    enter(data);
  };
  return withViewTransition('vt-walk', finish).then(() => {
    if (isNew) setTimeout(() => openSheet({ type: 'manual' }), 120);
  });
}

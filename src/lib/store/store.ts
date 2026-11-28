'use client';

import { useSyncExternalStore } from 'react';
import { CATALOG, CATALOG_BY_ID, SEED, SEED_CANON } from '../catalog';
import { todayISO } from '../format';
import { newPassportNo } from '../mrz';
import { DEFAULT_SHIELD, detectPreset, PRESETS } from '../shield';
import type { Dispatch, Item, LiveSession, Look, Mood, Passport, Person, Place, Rating, Shield, ShieldAction, ShieldPreset, Stamp, Theme } from '../types';
import { idbGet, idbSet, lsGet, lsSet } from './idb';
import { liveNow, makeNow, nowVerb, type NowStatus } from '../now';
import type { Short } from '../shorts';

/* ── Types ─────────────────────────────────────────────────────────────── */

export type Mode = 'local' | 'account' | 'demo';
export type PassportCore = {
  name: string;
  passportNo: string;
  issued: string;
  affinities: string[];
  shield: Shield;
  theme: Theme;
  updatedAt: number;
};
export type StampRec = Stamp & { updatedAt: number; deleted?: boolean };
export type Flag = { on: boolean; updatedAt: number };
export type CustomRec = Item & { updatedAt: number; deleted?: boolean };

export type UserData = {
  v: 1;
  userId: string;
  mode: Mode;
  email?: string;
  passport: PassportCore | null;
  stamps: Record<string, StampRec>;
  canon: { ids: string[]; updatedAt: number };
  wishlist: Record<string, Flag>;
  follows: Record<string, Flag>;
  likes: Record<string, Flag>;
  custom: Record<string, CustomRec>;
  /** sound: legacy stamp-thunk switch; sfx: all interface sounds ('on' unless turned off) */
  prefs: { sound: boolean; manualSeen: boolean; bannerDismissed: boolean; dispatchInterest?: boolean; look?: Look; sfx?: 'on' | 'off' };
  /** what this passport is watching / reading / playing / listening to right now */
  now?: NowStatus | null;
  sync: { lastPullAt: string | null; dirtyAt: number; pushedAt: number };
};

export type SheetSpec =
  | { type: 'record'; id: string }
  | { type: 'settings' }
  | { type: 'manual' }
  | { type: 'canon-picker' }
  | { type: 'canon-slot'; index: number }
  | { type: 'person'; id: string }
  | { type: 'add-own'; title?: string; kind?: Item['kind']; by?: string; year?: number }
  | { type: 'passport-code' }
  | { type: 'look'; next?: 'manual' }
  | { type: 'short'; id: string }
  | { type: 'submit-short' };

export type ControlIntent = { kind: 'exit' } | { kind: 'save' } | { kind: 'oauth-return' };

export type SyncState = 'local' | 'synced' | 'syncing' | 'offline' | 'error';

export type AppState = {
  boot: 'loading' | 'ready';
  auth: 'signed-out' | 'signed-in';
  data: UserData | null;
  sheets: { spec: SheetSpec; key: number; opener: HTMLElement | null }[];
  toast: { text: string; key: number } | null;
  moment: { itemId: string; update: boolean; key: number } | null;
  landing: string | null;
  revealed: Record<string, true>;
  searchFocus: number;
  online: boolean;
  syncState: SyncState;
  remote: { people: Person[]; dispatches: Dispatch[]; items: Record<string, Item>; live: LiveSession[] };
  /** works found in the world archives this session (TMDB, Open Library, AniList, RAWG, MusicBrainz) */
  world: Record<string, Item>;
  control: ControlIntent | null;
  /** the current look (Modern / Retro); mirrors data-look on <html> */
  look: Look;
  /** set while a passport is being issued / admitted so the shell can play the field manual after */
  justIssued: boolean;
  /** the indie shorts room: approved films, your own submissions, applause from others */
  shorts: ShortsState;
};

export type ShortsState = {
  status: 'idle' | 'loading' | 'ok' | 'offline' | 'local' | 'error';
  live: Short[];
  mine: Short[];
  /** short id → how many other people applauded it */
  applause: Record<string, number>;
};

export const EMPTY_SHORTS: ShortsState = { status: 'idle', live: [], mine: [], applause: {} };

const initial: AppState = {
  boot: 'loading',
  auth: 'signed-out',
  data: null,
  sheets: [],
  toast: null,
  moment: null,
  landing: null,
  revealed: {},
  searchFocus: 0,
  online: true,
  syncState: 'local',
  remote: { people: [], dispatches: [], items: {}, live: [] },
  world: {},
  control: null,
  look: 'retro',
  justIssued: false,
  shorts: EMPTY_SHORTS,
};

/* ── Store core ────────────────────────────────────────────────────────── */

let state: AppState = initial;
const listeners = new Set<() => void>();
let seq = 1;

export function getState(): AppState {
  return state;
}

export function setState(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)): void {
  const next = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

export function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(initial),
  );
}

/* ── Persistence ───────────────────────────────────────────────────────── */

let saveTimer: ReturnType<typeof setTimeout> | null = null;
const changeHooks = new Set<(d: UserData) => void>();

/** Sync engine registers here to hear about local changes. */
export function onDataChange(fn: (d: UserData) => void): () => void {
  changeHooks.add(fn);
  return () => changeHooks.delete(fn);
}

export function userKey(userId: string) {
  return `user:${userId}`;
}

export async function persistNow(): Promise<void> {
  const d = state.data;
  if (!d) return;
  await idbSet(userKey(d.userId), d);
}

function schedulePersist() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void persistNow();
  }, 200);
}

/** Replace the user's data (no "dirty" mark) — used by boot and sync merges. */
export function replaceData(d: UserData | null, opts: { persist?: boolean } = {}) {
  setState({ data: d });
  if (d && opts.persist !== false) schedulePersist();
}

/** Mutate user data, stamp it dirty, persist and notify the sync engine. */
function mutate(fn: (d: UserData, now: number) => UserData) {
  const d = state.data;
  if (!d) return;
  const now = Date.now();
  const next = fn(d, now);
  next.sync = { ...next.sync, dirtyAt: now };
  setState({ data: next });
  schedulePersist();
  changeHooks.forEach((h) => h(next));
}

export function emptyData(userId: string, mode: Mode, email?: string): UserData {
  return {
    v: 1,
    userId,
    mode,
    email,
    passport: null,
    stamps: {},
    canon: { ids: [], updatedAt: 0 },
    wishlist: {},
    follows: {},
    likes: {},
    custom: {},
    prefs: { sound: false, manualSeen: false, bannerDismissed: false },
    sync: { lastPullAt: null, dirtyAt: 0, pushedAt: 0 },
  };
}

export async function loadUser(userId: string): Promise<UserData | null> {
  const d = await idbGet<UserData>(userKey(userId));
  return d && d.v === 1 ? d : null;
}

export function setCurrentUser(userId: string | null) {
  lsSet('stamp:current', userId);
}

export function currentUserId(): string | null {
  return lsGet('stamp:current');
}

/* ── Selectors / helpers ───────────────────────────────────────────────── */

export function getItem(id: string, s: AppState = state): Item | undefined {
  return CATALOG_BY_ID[id] ?? (s.data?.custom[id] && !s.data.custom[id].deleted ? s.data.custom[id] : undefined) ?? s.world[id] ?? s.remote.items[id];
}

/** Keep archive results around so their records open; they are saved only when stamped or wishlisted. */
export function rememberWorld(items: Item[]) {
  if (!items.length) return;
  setState((s) => ({ world: { ...s.world, ...Object.fromEntries(items.map((i) => [i.id, i])) } }));
}

/** Copy an archive work into the passport's own list so it survives reloads and syncs. */
function keepWorld(d: UserData, id: string, now: number): UserData {
  if (CATALOG_BY_ID[id] || (d.custom[id] && !d.custom[id].deleted)) return d;
  const w = state.world[id] ?? state.remote.items[id];
  if (!w) return d;
  return { ...d, custom: { ...d.custom, [id]: { ...w, custom: true, updatedAt: now } } };
}

export function allItems(s: AppState = state): Item[] {
  const custom = s.data ? Object.values(s.data.custom).filter((c) => !c.deleted) : [];
  return [...CATALOG, ...custom];
}

export function liveStamps(d: UserData | null): Stamp[] {
  if (!d) return [];
  return Object.values(d.stamps).filter((s) => !s.deleted);
}

export function onIds(map: Record<string, Flag>): string[] {
  return Object.entries(map)
    .filter(([, f]) => f.on)
    .sort((a, b) => b[1].updatedAt - a[1].updatedAt)
    .map(([id]) => id);
}

export function toPassport(d: UserData): Passport | null {
  if (!d.passport) return null;
  const p = d.passport;
  return {
    userId: d.userId,
    name: p.name,
    passportNo: p.passportNo,
    issued: p.issued,
    affinities: p.affinities,
    canon: d.canon.ids,
    wishlist: onIds(d.wishlist),
    follows: onIds(d.follows),
    likes: onIds(d.likes),
    shield: p.shield,
    theme: p.theme,
  };
}

/* ── UI actions ────────────────────────────────────────────────────────── */

let toastTimer: ReturnType<typeof setTimeout> | null = null;
export function toast(text: string) {
  if (toastTimer) clearTimeout(toastTimer);
  setState({ toast: { text, key: seq++ } });
  toastTimer = setTimeout(() => setState({ toast: null }), 2400);
}

export function openSheet(spec: SheetSpec) {
  const opener = typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;
  setState((s) => ({ sheets: [...s.sheets, { spec, key: seq++, opener }] }));
}

export function replaceSheet(spec: SheetSpec) {
  setState((s) => {
    const prev = s.sheets[s.sheets.length - 1];
    return { sheets: [...s.sheets.slice(0, -1), { spec, key: seq++, opener: prev?.opener ?? null }] };
  });
}

export function closeSheet() {
  const top = state.sheets[state.sheets.length - 1];
  setState((s) => ({ sheets: s.sheets.slice(0, -1) }));
  const opener = top?.opener;
  if (opener && typeof document !== 'undefined' && document.contains(opener)) {
    requestAnimationFrame(() => opener.focus({ preventScroll: true }));
  }
}

export function closeAllSheets() {
  setState({ sheets: [] });
}

export function reveal(id: string) {
  setState((s) => ({ revealed: { ...s.revealed, [id]: true } }));
  try {
    const raw = sessionStorage.getItem('stamp:revealed');
    const set = new Set<string>(raw ? JSON.parse(raw) : []);
    set.add(id);
    sessionStorage.setItem('stamp:revealed', JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

export function restoreRevealed() {
  try {
    const raw = sessionStorage.getItem('stamp:revealed');
    if (raw) setState({ revealed: Object.fromEntries((JSON.parse(raw) as string[]).map((id) => [id, true as const])) });
  } catch {
    /* ignore */
  }
}

export function requestSearchFocus() {
  setState((s) => ({ searchFocus: s.searchFocus + 1 }));
}

export function clearLanding() {
  setState({ landing: null });
}

/* ── Passport actions ──────────────────────────────────────────────────── */

export function makePassport(name: string, affinities: string[], theme: Theme = 'day'): PassportCore {
  return {
    name: name.trim(),
    passportNo: newPassportNo(),
    issued: todayISO(),
    affinities: affinities.slice(0, 3),
    shield: { ...DEFAULT_SHIELD, limits: [...DEFAULT_SHIELD.limits] },
    theme,
    updatedAt: Date.now(),
  };
}

export function updatePassport(patch: Partial<Pick<PassportCore, 'name' | 'affinities' | 'passportNo'>>) {
  mutate((d, now) => (d.passport ? { ...d, passport: { ...d.passport, ...patch, updatedAt: now } } : d));
}

/* ── Look (Modern / Retro) × mode (light / dark) ───────────────────────── */

export const DEFAULT_LOOK: Look = 'retro';

/** The look last used on this device (before a passport is open), else the default. */
export function deviceLook(): Look {
  const v = lsGet('stamp:look');
  return v === 'modern' || v === 'retro' ? v : DEFAULT_LOOK;
}

/** The mode last used on this device, else the system preference. */
export function deviceTheme(): Theme {
  const v = lsGet('stamp:theme');
  if (v === 'day' || v === 'night') return v;
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'day';
  } catch {
    return 'day';
  }
}

/** Status-bar colour follows the page background of the current look + mode. */
function syncMetaColor() {
  if (typeof document === 'undefined') return;
  const meta = document.querySelector('meta[name="theme-color"]');
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--meta').trim();
  if (meta && bg) meta.setAttribute('content', bg);
}

export function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', theme);
  lsSet('stamp:theme', theme);
  syncMetaColor();
}

export function applyLook(look: Look) {
  if (state.look !== look) setState({ look });
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-look', look);
  lsSet('stamp:look', look);
  syncMetaColor();
}

/** Choose a look; saved with the passport so it follows you to other devices. */
export function setLook(look: Look) {
  applyLook(look);
  mutate((d, now) => ({ ...d, prefs: { ...d.prefs, look }, passport: d.passport ? { ...d.passport, updatedAt: now } : d.passport }));
}

export function useLook(): Look {
  return useStore((s) => s.look);
}

let lookPrompted = false;
/** The "choose your look" sheet shows once, for passports that haven't picked one yet. */
export function claimLookPrompt(): boolean {
  if (lookPrompted) return false;
  lookPrompted = true;
  return true;
}

export function setTheme(theme: Theme) {
  applyTheme(theme);
  mutate((d, now) => (d.passport ? { ...d, passport: { ...d.passport, theme, updatedAt: now } } : d));
}

export function toggleTheme() {
  const cur = state.data?.passport?.theme ?? 'day';
  setTheme(cur === 'night' ? 'day' : 'night');
}

export function setShieldPreset(preset: Exclude<ShieldPreset, 'custom'>) {
  const def = PRESETS.find((p) => p.id === preset)!;
  mutate((d, now) =>
    d.passport ? { ...d, passport: { ...d.passport, shield: { ...d.passport.shield, preset, limits: [...def.limits] }, updatedAt: now } } : d,
  );
}

export function setShieldLimit(index: number, level: number) {
  mutate((d, now) => {
    if (!d.passport) return d;
    const limits = [...d.passport.shield.limits];
    limits[index] = level;
    return { ...d, passport: { ...d.passport, shield: { ...d.passport.shield, limits, preset: detectPreset(limits) }, updatedAt: now } };
  });
}

export function setShieldAction(action: ShieldAction) {
  mutate((d, now) => (d.passport ? { ...d, passport: { ...d.passport, shield: { ...d.passport.shield, action }, updatedAt: now } } : d));
}

export function setPref<K extends keyof UserData['prefs']>(key: K, value: UserData['prefs'][K]) {
  // Prefs travel on the profile row, so bump the passport too or the change never syncs.
  mutate((d, now) => ({ ...d, prefs: { ...d.prefs, [key]: value }, passport: d.passport ? { ...d.passport, updatedAt: now } : d.passport }));
}

/* ── Stamps ────────────────────────────────────────────────────────────── */

export type StampInput = { rating: Rating; tags: Mood[]; date: string; place: Place; note: string };

export function stampItem(itemId: string, input: StampInput) {
  const existing = state.data?.stamps[itemId];
  const update = !!existing && !existing.deleted;
  mutate((d0, now) => {
    const d = keepWorld(d0, itemId, now);
    const prev = d.stamps[itemId];
    const rec: StampRec = {
      itemId,
      rating: input.rating,
      tags: input.tags,
      date: input.date,
      place: input.place,
      note: input.note.slice(0, 240),
      createdAt: prev && !prev.deleted ? prev.createdAt : now,
      updatedAt: now,
      deleted: false,
    };
    const wishlist = d.wishlist[itemId]?.on ? { ...d.wishlist, [itemId]: { on: false, updatedAt: now } } : d.wishlist;
    // Finishing a work ends its "now" status.
    const nowStatus = d.now && d.now.itemId === itemId && !d.now.cleared ? { ...d.now, cleared: true, updatedAt: now } : d.now;
    return { ...d, stamps: { ...d.stamps, [itemId]: rec }, wishlist, now: nowStatus };
  });
  setState({ moment: { itemId, update, key: seq++ } });
}

export function endMoment() {
  const m = state.moment;
  if (!m) return;
  setState({ moment: null, landing: m.itemId });
  toast(m.update ? 'Stamp updated' : 'Passport stamped');
  setTimeout(() => {
    if (getState().landing === m.itemId) setState({ landing: null });
  }, 60_000);
}

export function removeStamp(itemId: string) {
  mutate((d, now) => {
    const prev = d.stamps[itemId];
    if (!prev) return d;
    const canonIds = d.canon.ids.filter((id) => id !== itemId);
    return {
      ...d,
      stamps: { ...d.stamps, [itemId]: { ...prev, deleted: true, updatedAt: now } },
      canon: canonIds.length !== d.canon.ids.length ? { ids: canonIds, updatedAt: now } : d.canon,
    };
  });
  toast('Stamp removed');
}

export function clearAllStamps() {
  const n = liveStamps(state.data).length;
  mutate((d, now) => {
    const stamps = Object.fromEntries(Object.entries(d.stamps).map(([id, s]) => [id, { ...s, deleted: true, updatedAt: now }]));
    return { ...d, stamps, canon: { ids: [], updatedAt: now } };
  });
  toast(`Cleared ${n} ${n === 1 ? 'stamp' : 'stamps'}`);
}

export function addSampleStamps() {
  let added = 0;
  mutate((d, now) => {
    const stamps = { ...d.stamps };
    let i = 0;
    for (const [id, s] of Object.entries(SEED)) {
      if (stamps[id] && !stamps[id].deleted) continue;
      stamps[id] = { itemId: id, ...s, tags: [...s.tags], createdAt: now + i, updatedAt: now + i, deleted: false };
      i++;
      added++;
    }
    const canon = d.canon.ids.length === 0 ? { ids: [...SEED_CANON], updatedAt: now } : d.canon;
    return { ...d, stamps, canon };
  });
  toast(added ? `Added ${added} sample stamps` : 'Sample stamps are already in');
}

export function importStamps(stamps: Stamp[], newItems: Item[]) {
  mutate((d, now) => {
    const custom = { ...d.custom };
    for (const it of newItems) custom[it.id] = { ...it, custom: true, updatedAt: now };
    const next = { ...d.stamps };
    for (const s of stamps) next[s.itemId] = { ...s, updatedAt: now, deleted: false };
    return { ...d, custom, stamps: next };
  });
}

/* ── Canon ─────────────────────────────────────────────────────────────── */

export function setCanon(ids: string[]) {
  mutate((d, now) => ({ ...d, canon: { ids: ids.slice(0, 9), updatedAt: now } }));
}

export function toggleCanon(id: string): boolean {
  const ids = state.data?.canon.ids ?? [];
  if (ids.includes(id)) {
    setCanon(ids.filter((x) => x !== id));
    return true;
  }
  if (ids.length >= 9) {
    toast('Your canon is full. Remove one first.');
    return false;
  }
  setCanon([...ids, id]);
  return true;
}

export function moveCanon(index: number, delta: -1 | 1) {
  const ids = [...(state.data?.canon.ids ?? [])];
  const j = index + delta;
  if (j < 0 || j >= ids.length) return;
  [ids[index], ids[j]] = [ids[j], ids[index]];
  setCanon(ids);
}

/* ── Wishlist, follows, likes ──────────────────────────────────────────── */

function toggleFlag(key: 'wishlist' | 'follows' | 'likes', id: string, on?: boolean): boolean {
  const cur = !!state.data?.[key][id]?.on;
  const next = on ?? !cur;
  mutate((d, now) => ({ ...d, [key]: { ...d[key], [id]: { on: next, updatedAt: now } } }));
  return next;
}

export function toggleWishlist(id: string): boolean {
  mutate((d, now) => keepWorld(d, id, now));
  const on = toggleFlag('wishlist', id);
  toast(on ? 'Saved to wishlist' : 'Removed from wishlist');
  return on;
}

export function toggleFollow(id: string, name?: string): boolean {
  const on = toggleFlag('follows', id);
  if (name) toast(on ? `Following ${name}` : `Unfollowed ${name}`);
  return on;
}

export function toggleLike(id: string): boolean {
  return toggleFlag('likes', id);
}

/* ── Now ─────────────────────────────────────────────────────────────── */

/** Share what you're watching / reading / playing / listening to right now. */
export function setNow(itemId: string, label: string, pct: number | null) {
  const item = getItem(itemId);
  if (!item) return;
  mutate((d0, now) => {
    const d = keepWorld(d0, itemId, now);
    return { ...d, now: makeNow(itemId, item.kind, label, pct, now, d.now) };
  });
  toast(`${nowVerb(item.kind)} ${item.title}`);
}

export function clearNow() {
  if (!liveNow(state.data?.now)) return;
  mutate((d, now) => (d.now ? { ...d, now: { ...d.now, cleared: true, updatedAt: now } } : d));
  toast('Status cleared');
}

/* ── Custom items ──────────────────────────────────────────────────────── */

export function addCustomItem(input: { title: string; kind: Item['kind']; by: string; year?: number; mins?: number; cc?: string }): Item {
  const base = input.title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const id = `u-${base || 'work'}-${Date.now().toString(36)}`;
  const item: Item = {
    id,
    kind: input.kind,
    title: input.title.trim(),
    year: input.year,
    by: input.by.trim(),
    mins: input.mins,
    cc: input.cc ? input.cc.toUpperCase() : undefined,
    v: null,
    log: 'Added by you.',
    custom: true,
  };
  mutate((d, now) => ({ ...d, custom: { ...d.custom, [id]: { ...item, updatedAt: now } } }));
  return item;
}

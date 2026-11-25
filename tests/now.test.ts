import { describe, expect, it } from 'vitest';
import { liveNow, makeNow, NOW_TTL, nowVerb, since } from '../src/lib/now';
import { isMissingTable, mergeRemote } from '../src/lib/sync/sync';
import { emptyData } from '../src/lib/store/store';

describe('now status', () => {
  it('uses the right verb and lifetime per kind', () => {
    expect(nowVerb('series')).toBe('Watching');
    expect(nowVerb('manga')).toBe('Reading');
    expect(nowVerb('game')).toBe('Playing');
    expect(nowVerb('album')).toBe('Listening to');
    const s = makeNow('severance', 'series', '  S2 · E6 ', 142, 1000);
    expect(s).toMatchObject({ label: 'S2 · E6', pct: 100, startedAt: 1000, expiresAt: 1000 + NOW_TTL.series });
  });
  it('expires, clears, and keeps the start time on update', () => {
    const s = makeNow('x', 'album', '', null, 0);
    expect(liveNow(s, 10)).toBe(s);
    expect(liveNow(s, NOW_TTL.album + 1)).toBeNull();
    expect(liveNow({ ...s, cleared: true }, 10)).toBeNull();
    const again = makeNow('x', 'album', 'Track 3', 30, 60_000, s);
    expect(again.startedAt).toBe(0);
    expect(makeNow('y', 'album', '', null, 60_000, s).startedAt).toBe(60_000);
    expect(since(0, 2 * 3_600_000)).toBe('2 h');
  });
  it('syncs across devices last-write-wins', () => {
    const d = emptyData('u1', 'account');
    d.now = makeNow('cure', 'film', '', null, Date.parse('2026-11-25T09:00:00Z'));
    const row = {
      user_id: 'u1',
      item_id: 'severance',
      item: null,
      label: 'S2 · E6',
      pct: 42,
      started_at: '2026-11-25T10:00:00Z',
      expires_at: '2026-11-25T13:00:00Z',
      cleared: false,
      updated_at: '2026-11-25T10:00:00Z',
    };
    const m = mergeRemote(d, { profile: null, stamps: [], canon: [], flags: { wishlist: [], follows: [], likes: [] }, custom: [], presence: row });
    expect(m.now?.itemId).toBe('severance');
    const older = mergeRemote(m, { profile: null, stamps: [], canon: [], flags: { wishlist: [], follows: [], likes: [] }, custom: [], presence: { ...row, item_id: 'cure', updated_at: '2026-11-25T08:00:00Z' } });
    expect(older.now?.itemId).toBe('severance');
  });
  it('treats only a missing presence table as optional when pushing', () => {
    expect(isMissingTable({ code: 'PGRST205' })).toBe(true);
    expect(isMissingTable({ code: '42P01' })).toBe(true);
    expect(isMissingTable({ code: '42501' })).toBe(false); // an RLS violation still fails the sync
    expect(isMissingTable(null)).toBe(false);
  });
});

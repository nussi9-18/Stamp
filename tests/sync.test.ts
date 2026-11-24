import { describe, expect, it } from 'vitest';
import { mergeRemote } from '../src/lib/sync/sync';
import { emptyData } from '../src/lib/store/store';
import { normalizeDiplomat } from '../src/lib/ai/diplomat';
import { normalizeArchivist } from '../src/lib/ai/archivist';
import { CATALOG } from '../src/lib/catalog';

const T = (iso: string) => Date.parse(iso);
const remote = (over: Partial<Parameters<typeof mergeRemote>[1]> = {}) => ({
  profile: null,
  stamps: [],
  canon: [],
  flags: { wishlist: [], follows: [], likes: [] },
  custom: [],
  ...over,
});

describe('sync merge (last-write-wins)', () => {
  const base = () => {
    const d = emptyData('u1', 'account');
    d.stamps.chungking = { itemId: 'chungking', rating: 5, tags: [], date: '2026-01-14', place: 'home', note: '', createdAt: 1, updatedAt: T('2026-11-24T10:00:00Z') };
    d.canon = { ids: ['chungking'], updatedAt: T('2026-11-24T10:00:00Z') };
    return d;
  };
  it('takes newer remote rows and ignores older ones', () => {
    const r = remote({
      stamps: [
        { user_id: 'u1', item_id: 'chungking', rating: 2, tags: [], date: '2026-01-14', place: 'home', note: '', created_at: '2026-01-14T00:00:00Z', updated_at: '2026-11-24T09:00:00Z', deleted: false },
        { user_id: 'u1', item_id: 'cure', rating: 4, tags: ['Unsettling'], date: '2026-02-01', place: 'out', note: 'late', created_at: '2026-02-01T00:00:00Z', updated_at: '2026-11-24T12:00:00Z', deleted: false },
      ],
    });
    const m = mergeRemote(base(), r);
    expect(m.stamps.chungking.rating).toBe(5);
    expect(m.stamps.cure.rating).toBe(4);
    expect(m.stamps.cure.place).toBe('out');
  });
  it('applies remote deletions that are newer', () => {
    const r = remote({
      stamps: [{ user_id: 'u1', item_id: 'chungking', rating: 5, tags: [], date: '2026-01-14', place: 'home', note: '', created_at: '2026-01-14T00:00:00Z', updated_at: '2026-11-24T11:00:00Z', deleted: true }],
    });
    expect(mergeRemote(base(), r).stamps.chungking.deleted).toBe(true);
  });
  it('replaces the canon as a whole when the remote list is newer', () => {
    const rows = Array.from({ length: 9 }, (_, i) => ({ user_id: 'u1', position: i + 1, item_id: i < 2 ? ['aftersun', 'cure'][i] : null, updated_at: '2026-11-24T11:00:00Z' }));
    expect(mergeRemote(base(), remote({ canon: rows })).canon.ids).toEqual(['aftersun', 'cure']);
    const old = rows.map((r) => ({ ...r, updated_at: '2026-11-24T08:00:00Z' }));
    expect(mergeRemote(base(), remote({ canon: old })).canon.ids).toEqual(['chungking']);
  });
  it('merges flags and the passport', () => {
    const r = remote({
      flags: { wishlist: [{ user_id: 'u1', key: 'stalker', deleted: false, updated_at: '2026-11-24T11:00:00Z' }], follows: [{ user_id: 'u1', key: 'lina', deleted: true, updated_at: '2026-11-24T11:00:00Z' }], likes: [] },
      profile: { id: 'u1', name: 'Nussi', passport_no: 'STMP-9182', issued: '2026-11-18', affinities: ['Slow cinema'], shield: null, theme: 'night', prefs: { sound: true }, updated_at: '2026-11-24T11:00:00Z' },
    });
    const m = mergeRemote(base(), r);
    expect(m.wishlist.stalker.on).toBe(true);
    expect(m.follows.lina.on).toBe(false);
    expect(m.passport?.passportNo).toBe('STMP-9182');
    expect(m.passport?.theme).toBe('night');
    expect(m.prefs.sound).toBe(true);
  });
});

describe('AI output normalisation', () => {
  it('drops picks above the lowest ceiling and resolves titles to catalog ids', () => {
    const out = {
      pick: { title: 'Cure', year: 1997, creator: 'Kiyoshi Kurosawa', kind: 'film' as const, catalog_id: 'cure' },
      concordance: 140,
      friction: 'x',
      reasons: [{ name: 'Ana', why: 'a' }],
      alternates: [{ title: 'Past Lives', year: 2023, creator: 'Celine Song', catalog_id: null }],
    };
    const people = [
      { name: 'Ana', likes: 'x', favourites: '', ceiling: 3 },
      { name: 'Ben', likes: 'y', favourites: '', ceiling: 1 },
    ];
    const r = normalizeDiplomat(out, { people }, CATALOG)!;
    expect(r.pick?.catalog_id).toBe('past-lives');
    expect(r.concordance).toBe(100);
    expect(r.reasons.map((x) => x.name)).toEqual(['Ana', 'Ben']);
  });
  it('clamps archivist numbers and drops unknown ids', () => {
    const r = normalizeArchivist(
      {
        match: { title: 'Chungking Express', year: 1994, creator: 'Wong Kar-wai', kind: 'film', catalog_id: 'nope', confidence: 120, why: 'w', factors: [{ clue: 'c', kind: 'Sound', weight: -5 }] },
        alternates: [],
      },
      CATALOG,
    );
    expect(r.match?.catalog_id).toBe('chungking');
    expect(r.match?.confidence).toBe(100);
    expect(r.match?.factors[0].weight).toBe(0);
  });
});

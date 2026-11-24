import { describe, expect, it } from 'vitest';
import { CATALOG, CATALOG_BY_ID, PEOPLE, SEED, SEED_CANON, FEED, LIVE } from '../src/lib/catalog';
import { heatOf, heatScore, tierName, formatTime } from '../src/lib/heat';
import { detectPreset, over, PRESETS } from '../src/lib/shield';
import { tasteMatch } from '../src/lib/match';
import { mrzLines } from '../src/lib/mrz';
import { formatDate, formatHours } from '../src/lib/format';
import { searchItems } from '../src/lib/search';
import { computeWrapped, wrappedYears, pctChange } from '../src/lib/wrapped';
import { parseCSV, readLetterboxd, planImport, lbRating, LB_EMPTY, LB_NOT_EXPORT } from '../src/lib/letterboxd';
import { archivistFallback, ARCHIVIST_EXAMPLE } from '../src/lib/ai/archivist';
import { diplomatFallback, withinLimits } from '../src/lib/ai/diplomat';
import type { Stamp } from '../src/lib/types';

const seedStamps: Stamp[] = Object.entries(SEED).map(([itemId, s], i) => ({ itemId, ...s, createdAt: i }));
const mine = Object.fromEntries(seedStamps.map((s) => [s.itemId, s.rating]));

describe('seed data', () => {
  it('has the full catalog, people, feed and live sessions', () => {
    expect(CATALOG).toHaveLength(50);
    expect(PEOPLE).toHaveLength(6);
    expect(FEED).toHaveLength(8);
    expect(LIVE).toHaveLength(4);
    expect(Object.keys(SEED)).toHaveLength(15);
    for (const id of [...Object.keys(SEED), ...SEED_CANON]) expect(CATALOG_BY_ID[id]).toBeDefined();
    for (const p of PEOPLE) for (const id of Object.keys(p.r)) expect(CATALOG_BY_ID[id], id).toBeDefined();
  });
  it('matches the prototype passport stats (15 stamps, 43 hours, 4.6)', () => {
    const mins = seedStamps.reduce((a, s) => a + (CATALOG_BY_ID[s.itemId].mins ?? 0), 0);
    expect(formatHours(mins)).toBe('43');
    const avg = seedStamps.reduce((a, s) => a + s.rating, 0) / seedStamps.length;
    expect(avg.toFixed(1)).toBe('4.6');
  });
});

describe('heat', () => {
  it('scores and tiers', () => {
    expect(heatScore([0, 2, 3, 3, 0, 2, 1, 0])!.toFixed(1)).toBe('9.6');
    expect(tierName(9.6)).toBe('Peak');
    expect(tierName(3.59)).toBe('Clear');
    expect(tierName(6.5)).toBe('Mild');
    expect(tierName(8.8)).toBe('Strong');
    expect(heatOf(CATALOG_BY_ID['berserk'])!.label).toBe('Peak 10.0');
    expect(heatOf({ v: null })).toBeNull();
  });
  it('formats time', () => {
    expect(formatTime(CATALOG_BY_ID['chungking'])).toBe('98 min');
    expect(formatTime(CATALOG_BY_ID['satantango'])).toBe('439 min');
    expect(formatTime(CATALOG_BY_ID['elden-ring'])).toBe('≈100 h');
    expect(formatTime(CATALOG_BY_ID['the-prophet'])).toBe('≈2 h');
  });
});

describe('shield', () => {
  it('detects presets and custom', () => {
    expect(detectPreset([3, 2, 1, 1, 3, 3, 3, 1])).toBe('sanctuary');
    expect(detectPreset([3, 2, 1, 2, 3, 3, 3, 1])).toBe('custom');
    expect(PRESETS).toHaveLength(4);
  });
  it('gates by vector', () => {
    expect(over(CATALOG_BY_ID['cure'], [3, 2, 1, 1, 3, 3, 3, 1])).toEqual([2, 3]);
    expect(over({ v: null }, [0, 0, 0, 0, 0, 0, 0, 0])).toEqual([]);
  });
});

describe('taste match', () => {
  it('reproduces Lina 90, Marcus 88, Omar 73 for the seed passport', () => {
    const by = Object.fromEntries(PEOPLE.map((p) => [p.id, tasteMatch(mine, p.r)]));
    expect(by.lina.pct).toBe(90);
    expect(by.lina.shared).toHaveLength(7);
    expect(by.lina.bothFive.sort()).toEqual(['aftersun', 'raasuk']);
    expect(by.marcus.pct).toBe(88);
    expect(by.omar.pct).toBe(73);
    expect(tasteMatch({}, PEOPLE[0].r).pct).toBeNull();
  });
});

describe('MRZ', () => {
  it('builds two 44-char lines', () => {
    const [l1, l2] = mrzLines('Nussi', 'STMP-9182', 15, '2026-11-18');
    expect(l1).toBe('P<STMPNUSSI<<'.padEnd(44, '<'));
    expect(l2).toBe('STMP9182<015MEDIA261118<<TASTE'.padEnd(44, '<'));
    const [a] = mrzLines('Lina Haddad', 'STMP-0001', 0, '2026-01-02');
    expect(a.startsWith('P<STMPHADDAD<<LINA<')).toBe(true);
    expect(a).toHaveLength(44);
  });
  it('formats dates', () => {
    expect(formatDate('2026-11-18')).toBe('18 NOV 2026');
  });
});

describe('search', () => {
  it('is accent-insensitive and matches creator, country, type', () => {
    expect(searchItems(CATALOG, 'satantango').map((i) => i.id)).toEqual(['satantango']);
    expect(searchItems(CATALOG, 'Kiarostami').map((i) => i.id).sort()).toEqual(['close-up', 'taste-of-cherry']);
    expect(searchItems(CATALOG, 'manga')).toHaveLength(3);
    expect(searchItems(CATALOG, 'lebanon').length).toBeGreaterThan(2);
    expect(searchItems(CATALOG, '1994').map((i) => i.id).sort()).toEqual(['chungking', 'satantango']);
  });
});

describe('wrapped', () => {
  const get = (id: string) => CATALOG_BY_ID[id];
  it('computes 2026 from seed: 9 stamps, 31 hours, +50% vs 2025', () => {
    const w = computeWrapped(2026, seedStamps, get);
    expect(w.stamps).toBe(9);
    expect(Math.round(w.mins / 60)).toBe(31);
    expect(w.prev?.stamps).toBe(6);
    expect(pctChange(6, 9)).toBe('+50%');
    expect(w.perMonth.reduce((a, b) => a + b, 0)).toBe(9);
    expect(w.mediaMix.film + w.mediaMix.series + w.mediaMix.album).toBe(9);
    expect(w.countries.length).toBeGreaterThan(3);
    expect(w.moods).toHaveLength(3);
  });
  it('lists years with stamps plus current, last four', () => {
    expect(wrappedYears(seedStamps, 2026)).toEqual([2025, 2026]);
    expect(wrappedYears([], 2026)).toEqual([2026]);
  });
});

describe('letterboxd', () => {
  it('parses quoted CSV', () => {
    expect(parseCSV('a,b\n"x, y","he said ""hi"""\r\n')).toEqual([['a', 'b'], ['x, y', 'he said "hi"']]);
  });
  it('rounds ratings', () => {
    expect(lbRating('0.5')).toBe(1);
    expect(lbRating('3.5')).toBe(4);
    expect(lbRating('')).toBe(0);
  });
  it('reads diary.csv and plans an import', () => {
    const csv = [
      'Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date',
      '2026-03-01,Chungking Express,1994,https://boxd.it/x,4.5,,,2026-02-27',
      '2026-03-02,"Paris, Texas",1984,https://boxd.it/y,5,,,2026-03-02',
      '2026-03-03,Some Obscure Film,2011,https://boxd.it/z,,,,2026-03-03',
    ].join('\n');
    const read = readLetterboxd(csv, '2026-11-24');
    expect('rows' in read).toBe(true);
    if (!('rows' in read)) return;
    const plan = planImport(read.rows, CATALOG, new Set(['chungking']));
    expect(plan.stamps.map((s) => s.itemId)).toEqual(['paris-texas', 'lb-some-obscure-film-2011']);
    expect(plan.newItems).toHaveLength(1);
    expect(plan.newItems[0].mins).toBe(100);
    expect(plan.stamps[1].rating).toBe(0);
  });
  it('rejects empty files and other exports', () => {
    expect(readLetterboxd('')).toEqual({ error: LB_EMPTY });
    expect(readLetterboxd('Date,Name,Year,Letterboxd URI\n2026-01-01,X,2000,u')).toEqual({ error: LB_NOT_EXPORT });
    expect(readLetterboxd('Date,Name,Year,Letterboxd URI,Rating\n')).toEqual({ error: LB_EMPTY });
  });
});

describe('AI fallbacks', () => {
  it('archivist keyword match finds Chungking Express from the example', () => {
    const r = archivistFallback(ARCHIVIST_EXAMPLE);
    expect(r.match?.catalog_id).toBe('chungking');
    expect(r.alternates.length).toBeGreaterThan(0);
    expect(r.match!.factors.length).toBeGreaterThan(2);
  });
  it('diplomat fallback respects the lowest ceiling', () => {
    const r = diplomatFallback([
      { name: 'Nussi', likes: 'Slow cinema, tender films', favourites: 'Perfect Days', ceiling: 3 },
      { name: 'Marcus', likes: 'Fast thrillers, sharp dialogue, no gore', favourites: 'Cure', ceiling: 1 },
    ]);
    expect(r.pick).not.toBeNull();
    const item = CATALOG_BY_ID[r.pick!.catalog_id!];
    expect(withinLimits(item, 1)).toBe(true);
    expect(r.pick!.catalog_id).not.toBe('perfect-days');
    expect(r.reasons).toHaveLength(2);
  });
});

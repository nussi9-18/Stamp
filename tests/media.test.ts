import { afterEach, describe, expect, it, vi } from 'vitest';
import { logline, searchWorld } from '../src/lib/media/sources';

const payloads: Record<string, unknown> = {
  'api.themoviedb.org': {
    results: [
      { id: 438631, media_type: 'movie', title: 'Dune', release_date: '2021-09-15', overview: 'Paul Atreides travels to Arrakis. Danger follows.', origin_country: ['US'] },
      { id: 90228, media_type: 'tv', name: 'Dune: Prophecy', first_air_date: '2024-11-17', overview: '' },
      { id: 1, media_type: 'person', name: 'Someone' },
    ],
  },
  'openlibrary.org': { docs: [{ key: '/works/OL893415W', title: 'Dune', author_name: ['Frank Herbert'], first_publish_year: 1965, number_of_pages_median: 600 }] },
  'graphql.anilist.co': {
    data: { Page: { media: [{ id: 30002, type: 'MANGA', format: 'MANGA', title: { english: 'Berserk', romaji: 'Berserk' }, startDate: { year: 1989 }, countryOfOrigin: 'JP', chapters: 380, description: 'Guts, a former mercenary.<br>He fights.', staff: { nodes: [{ name: { full: 'Kentarou Miura' } }] }, studios: { nodes: [] } }] } },
  },
  'api.rawg.io': { results: [{ id: 3498, name: 'Grand Theft Auto V', released: '2013-09-17', playtime: 74 }] },
  'musicbrainz.org': { 'release-groups': [{ id: 'b1392450-e666-3926-a536-22c65f834433', title: 'OK Computer', 'primary-type': 'Album', 'first-release-date': '1997-05-21', 'artist-credit': [{ name: 'Radiohead' }] }] },
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function stubFetch() {
  const calls: string[] = [];
  vi.stubGlobal('fetch', async (url: string) => {
    calls.push(url);
    const host = new URL(url).host;
    return new Response(JSON.stringify(payloads[host]), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  return calls;
}

describe('world archive search', () => {
  it('maps every source to STAMP items and skips sources without keys', async () => {
    const calls = stubFetch();
    const items = await searchWorld('dune');
    expect(calls.some((u) => u.includes('themoviedb'))).toBe(false);
    expect(calls.some((u) => u.includes('rawg'))).toBe(false);
    const book = items.find((i) => i.id === 'ol-OL893415W')!;
    expect(book).toMatchObject({ kind: 'book', title: 'Dune', by: 'Frank Herbert', year: 1965, mins: 900, v: null });
    expect(items.find((i) => i.id === 'al-30002')).toMatchObject({ kind: 'manga', by: 'Kentarou Miura', cc: 'JP', mins: 1900 });
    expect(items.find((i) => i.id.startsWith('mb-'))).toMatchObject({ kind: 'album', title: 'OK Computer', by: 'Radiohead', year: 1997 });
  });
  it('uses TMDB and RAWG when keys are set, and filters by kind', async () => {
    vi.stubEnv('TMDB_API_KEY', 'abc123');
    vi.stubEnv('RAWG_API_KEY', 'k');
    stubFetch();
    const films = await searchWorld('dune', 'film');
    expect(films.map((i) => i.id)).toEqual(['tmdb-movie-438631']);
    expect(films[0].log).toBe('Paul Atreides travels to Arrakis.');
    const series = await searchWorld('dune', 'series');
    expect(series.map((i) => i.id)).toContain('tmdb-tv-90228');
    const games = await searchWorld('gta', 'game');
    expect(games[0]).toMatchObject({ id: 'rawg-3498', mins: 74 * 60, year: 2013 });
  });
  it('survives a failing source', async () => {
    vi.stubGlobal('fetch', async (url: string) => (url.includes('openlibrary') ? new Response('nope', { status: 500 }) : new Response(JSON.stringify(payloads[new URL(url).host]))));
    const items = await searchWorld('x');
    expect(items.some((i) => i.source === 'openlibrary')).toBe(false);
    expect(items.some((i) => i.source === 'anilist')).toBe(true);
  });
  it('cleans loglines', () => {
    expect(logline('<b>Hi</b> there. More text.')).toBe('Hi there.');
  });
});

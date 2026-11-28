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
  'api.tvmaze.com': [
    { score: 0.9, show: { id: 17861, name: 'Dark', premiered: '2017-12-01', averageRuntime: 56, network: null, webChannel: { name: 'Netflix', country: null }, summary: '<p>A family saga with a supernatural twist, <b>Dark</b> is set in a German town &amp; its caves. More.</p>' } },
    { score: 0.7, show: { id: 1819, name: 'Dark Matter', premiered: '2015-06-12', network: { name: 'Syfy', country: { code: 'US' } }, summary: null } },
  ],
  'www.wikidata.org': {
    search: [
      { id: 'Q63985561', label: 'Dune', description: '2021 American epic science fiction film directed by Denis Villeneuve' },
      { id: 'Q190192', label: 'Dune', description: '1965 novel by Frank Herbert' },
      { id: 'Q114819', label: 'Dune', description: '1984 film by David Lynch' },
      { id: 'Q1', label: 'Dune: Part Two', description: '2024 film based on the novel by Frank Herbert, directed by Denis Villeneuve' },
      { id: 'Q2', label: 'Dune', description: 'film series' },
      { id: 'Q3', label: 'Dune II', description: '1992 real-time strategy video game developed by Westwood Studios' },
      { id: 'Q4', label: 'Dune Online', description: 'cancelled multiplayer video game developed by Someone' },
      { id: 'Q5', label: 'Dune', description: '2023 American TV series based on the video game' },
    ],
  },
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
    // Without keys, films and games come from Wikidata and series from TVmaze.
    expect(items.find((i) => i.id === 'wd-Q63985561')).toMatchObject({ kind: 'film', title: 'Dune', year: 2021, by: 'Denis Villeneuve', cc: 'US', source: 'wikidata' });
    expect(items.find((i) => i.id === 'wd-Q3')).toMatchObject({ kind: 'game', year: 1992, by: 'Westwood Studios' });
    expect(items.find((i) => i.id === 'tvmaze-17861')).toMatchObject({ kind: 'series', title: 'Dark', year: 2017, by: 'Netflix', log: 'A family saga with a supernatural twist, Dark is set in a German town & its caves.' });
    expect(items.find((i) => i.id === 'tvmaze-1819')).toMatchObject({ by: 'Syfy', cc: 'US' });
  });

  it('reads Wikidata descriptions carefully', async () => {
    stubFetch();
    const films = await searchWorld('dune', 'film');
    const wd = films.filter((i) => i.source === 'wikidata');
    expect(wd.map((i) => [i.id, i.year, i.by])).toEqual([
      ['wd-Q63985561', 2021, 'Denis Villeneuve'],
      ['wd-Q114819', 1984, 'David Lynch'],
      ['wd-Q1', 2024, 'Denis Villeneuve'],
    ]);
    const games = await searchWorld('dune', 'game');
    expect(games.map((i) => i.id)).toEqual(['wd-Q3']);
    const series = await searchWorld('dark', 'series');
    expect(series.map((i) => i.source)).toContain('tvmaze');
  });
  it('uses TMDB and RAWG when keys are set, and filters by kind', async () => {
    vi.stubEnv('TMDB_API_KEY', 'abc123');
    vi.stubEnv('RAWG_API_KEY', 'k');
    const calls = stubFetch();
    const films = await searchWorld('dune', 'film');
    expect(films.map((i) => i.id)).toEqual(['tmdb-movie-438631']);
    expect(films[0].log).toBe('Paul Atreides travels to Arrakis.');
    const series = await searchWorld('dune', 'series');
    expect(series.map((i) => i.id)).toContain('tmdb-tv-90228');
    const games = await searchWorld('gta', 'game');
    expect(games[0]).toMatchObject({ id: 'rawg-3498', mins: 74 * 60, year: 2013 });
    // With keys, the keyless fallbacks stay quiet.
    expect(calls.some((u) => u.includes('wikidata') || u.includes('tvmaze'))).toBe(false);
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

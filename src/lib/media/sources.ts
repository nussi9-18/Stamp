// Server-only: searches the world archives (TMDB, Open Library, AniList, RAWG, MusicBrainz)
// and maps every result to a STAMP Item. External works carry no heat data.

import type { Item, Kind } from '../types';

export type ExternalItem = Item & { source: Source };
export type Source = 'tmdb' | 'openlibrary' | 'anilist' | 'rawg' | 'musicbrainz';

const TIMEOUT = 4500;
const UA = 'STAMP/1.0 (media passport; https://github.com/nussi9-18/Stamp)';

async function getJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal, headers: { 'user-agent': UA, accept: 'application/json', ...(init.headers ?? {}) } });
    if (!res.ok) throw new Error(`${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

const yearOf = (s?: string | null) => {
  const y = Number((s ?? '').slice(0, 4));
  return Number.isFinite(y) && y > 1000 ? y : undefined;
};

/** First sentence, plain text, ≤ 180 chars. */
export function logline(s?: string | null): string {
  const text = (s ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const first = text.match(/^.+?[.!?](\s|$)/)?.[0]?.trim() ?? text;
  return first.length > 180 ? first.slice(0, 177).trimEnd() + '…' : first;
}

/* ── TMDB: films & series ─────────────────────────────────────────────── */

type TmdbResult = {
  id: number;
  media_type?: 'movie' | 'tv' | 'person';
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  overview?: string;
  origin_country?: string[];
  original_language?: string;
};

export function mapTmdb(r: TmdbResult): ExternalItem | null {
  const type = r.media_type;
  if (type !== 'movie' && type !== 'tv') return null;
  const title = (type === 'movie' ? r.title : r.name)?.trim();
  if (!title) return null;
  return {
    id: `tmdb-${type}-${r.id}`,
    kind: type === 'movie' ? 'film' : 'series',
    title,
    year: yearOf(type === 'movie' ? r.release_date : r.first_air_date),
    by: '',
    cc: r.origin_country?.[0],
    v: null,
    log: logline(r.overview),
    source: 'tmdb',
  };
}

async function tmdb(q: string): Promise<ExternalItem[]> {
  const key = process.env.TMDB_API_KEY;
  if (!key) return [];
  // Accept either a v3 API key or a v4 read-access token.
  const isToken = key.length > 40;
  const url = `https://api.themoviedb.org/3/search/multi?include_adult=false&page=1&query=${encodeURIComponent(q)}${isToken ? '' : `&api_key=${key}`}`;
  const data = await getJson<{ results: TmdbResult[] }>(url, isToken ? { headers: { authorization: `Bearer ${key}` } } : {});
  return data.results.map(mapTmdb).filter((x): x is ExternalItem => !!x).slice(0, 12);
}

/* ── Open Library: books ──────────────────────────────────────────────── */

type OlDoc = { key: string; title?: string; author_name?: string[]; first_publish_year?: number; number_of_pages_median?: number; first_sentence?: string[] };

export function mapOpenLibrary(d: OlDoc): ExternalItem | null {
  if (!d.title) return null;
  return {
    id: `ol-${d.key.replace('/works/', '')}`,
    kind: 'book',
    title: d.title,
    year: d.first_publish_year,
    by: d.author_name?.[0] ?? '',
    mins: d.number_of_pages_median ? Math.round(d.number_of_pages_median * 1.5) : undefined,
    v: null,
    log: logline(d.first_sentence?.[0]),
    source: 'openlibrary',
  };
}

async function openLibrary(q: string): Promise<ExternalItem[]> {
  const fields = 'key,title,author_name,first_publish_year,number_of_pages_median,first_sentence';
  const data = await getJson<{ docs: OlDoc[] }>(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=10&fields=${fields}`);
  return data.docs.map(mapOpenLibrary).filter((x): x is ExternalItem => !!x);
}

/* ── AniList: manga & anime ───────────────────────────────────────────── */

type AlMedia = {
  id: number;
  type: 'MANGA' | 'ANIME';
  format?: string | null;
  title: { english?: string | null; romaji?: string | null };
  startDate?: { year?: number | null };
  countryOfOrigin?: string | null;
  chapters?: number | null;
  episodes?: number | null;
  duration?: number | null;
  description?: string | null;
  staff?: { nodes: { name: { full: string } }[] };
  studios?: { nodes: { name: string }[] };
};

export function mapAniList(m: AlMedia): ExternalItem | null {
  const title = m.title.english || m.title.romaji;
  if (!title) return null;
  const manga = m.type === 'MANGA';
  const movie = m.format === 'MOVIE';
  const kind: Kind = manga ? 'manga' : movie ? 'film' : 'series';
  const mins = manga ? (m.chapters ? m.chapters * 5 : undefined) : m.episodes && m.duration ? m.episodes * m.duration : undefined;
  return {
    id: `al-${m.id}`,
    kind,
    title,
    year: m.startDate?.year ?? undefined,
    by: (manga ? m.staff?.nodes?.[0]?.name.full : m.studios?.nodes?.[0]?.name) ?? '',
    mins,
    cc: m.countryOfOrigin ?? undefined,
    v: null,
    log: logline(m.description),
    source: 'anilist',
  };
}

const AL_QUERY = `query ($q: String) {
  Page(perPage: 10) {
    media(search: $q, isAdult: false, sort: SEARCH_MATCH) {
      id type format title { english romaji } startDate { year } countryOfOrigin
      chapters episodes duration description(asHtml: false)
      staff(perPage: 1, sort: RELEVANCE) { nodes { name { full } } }
      studios(isMain: true) { nodes { name } }
    }
  }
}`;

async function aniList(q: string): Promise<ExternalItem[]> {
  const data = await getJson<{ data: { Page: { media: AlMedia[] } } }>('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: AL_QUERY, variables: { q } }),
  });
  return data.data.Page.media.map(mapAniList).filter((x): x is ExternalItem => !!x);
}

/* ── RAWG: games ──────────────────────────────────────────────────────── */

type RawgGame = { id: number; name: string; released?: string | null; playtime?: number | null };

export function mapRawg(g: RawgGame): ExternalItem {
  return {
    id: `rawg-${g.id}`,
    kind: 'game',
    title: g.name,
    year: yearOf(g.released),
    by: '',
    mins: g.playtime ? g.playtime * 60 : undefined,
    v: null,
    log: '',
    source: 'rawg',
  };
}

async function rawg(q: string): Promise<ExternalItem[]> {
  const key = process.env.RAWG_API_KEY;
  if (!key) return [];
  const data = await getJson<{ results: RawgGame[] }>(`https://api.rawg.io/api/games?key=${key}&page_size=10&search=${encodeURIComponent(q)}`);
  return data.results.map(mapRawg);
}

/* ── MusicBrainz: albums ──────────────────────────────────────────────── */

type MbGroup = { id: string; title: string; 'primary-type'?: string; 'first-release-date'?: string; 'artist-credit'?: { name: string }[] };

export function mapMusicBrainz(g: MbGroup): ExternalItem | null {
  if (g['primary-type'] && g['primary-type'] !== 'Album' && g['primary-type'] !== 'EP') return null;
  return {
    id: `mb-${g.id}`,
    kind: 'album',
    title: g.title,
    year: yearOf(g['first-release-date']),
    by: g['artist-credit']?.map((a) => a.name).join(' & ') ?? '',
    v: null,
    log: '',
    source: 'musicbrainz',
  };
}

async function musicBrainz(q: string): Promise<ExternalItem[]> {
  const data = await getJson<{ 'release-groups': MbGroup[] }>(
    `https://musicbrainz.org/ws/2/release-group?fmt=json&limit=10&query=${encodeURIComponent(`${q} AND primarytype:album`)}`,
  );
  return data['release-groups'].map(mapMusicBrainz).filter((x): x is ExternalItem => !!x);
}

/* ── Fan-out ──────────────────────────────────────────────────────────── */

const BY_KIND: Record<Kind, ((q: string) => Promise<ExternalItem[]>)[]> = {
  film: [tmdb, aniList],
  series: [tmdb, aniList],
  book: [openLibrary],
  manga: [aniList],
  game: [rawg],
  album: [musicBrainz],
};

export function configured() {
  return { tmdb: !!process.env.TMDB_API_KEY, rawg: !!process.env.RAWG_API_KEY, openlibrary: true, anilist: true, musicbrainz: true };
}

export async function searchWorld(q: string, kind?: Kind): Promise<ExternalItem[]> {
  const fns = kind ? BY_KIND[kind] : [tmdb, openLibrary, aniList, rawg, musicBrainz];
  const settled = await Promise.allSettled([...new Set(fns)].map((f) => f(q)));
  const out: ExternalItem[] = [];
  const seen = new Set<string>();
  // Interleave sources so one archive doesn't drown the others.
  const lists = settled.map((s) => (s.status === 'fulfilled' ? s.value : []));
  for (let i = 0; lists.some((l) => i < l.length); i++) {
    for (const l of lists) {
      const it = l[i];
      if (!it || (kind && it.kind !== kind)) continue;
      const key = `${it.kind}|${it.title.toLowerCase()}|${it.year ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(it);
    }
  }
  return out.slice(0, 40);
}

// Server-only: searches the world archives and maps every result to a STAMP Item.
// Films & series: TMDB when TMDB_API_KEY is set; otherwise Wikidata (films) and TVmaze (series).
// Games: RAWG when RAWG_API_KEY is set; otherwise Wikidata. Books: Open Library. Manga & anime:
// AniList. Albums: MusicBrainz. External works carry no heat data.

import type { Item, Kind } from '../types';

export type ExternalItem = Item & { source: Source };
export type Source = 'tmdb' | 'tvmaze' | 'wikidata' | 'openlibrary' | 'anilist' | 'rawg' | 'musicbrainz';

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

const ENTITIES: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', mdash: '—', ndash: '–' };

function decodeEntities(s: string): string {
  return s.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** First sentence, plain text, ≤ 180 chars. */
export function logline(s?: string | null): string {
  const text = decodeEntities((s ?? '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
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

/* ── TVmaze: series without a key ─────────────────────────────────────── */

type TvmazeShow = {
  id: number;
  name: string;
  premiered?: string | null;
  averageRuntime?: number | null;
  summary?: string | null;
  network?: { name: string; country?: { code: string } | null } | null;
  webChannel?: { name: string; country?: { code: string } | null } | null;
};

export function mapTvmaze(s: TvmazeShow): ExternalItem | null {
  if (!s.name) return null;
  const outlet = s.network ?? s.webChannel;
  return {
    id: `tvmaze-${s.id}`,
    kind: 'series',
    title: s.name,
    year: yearOf(s.premiered),
    by: outlet?.name ?? '',
    cc: outlet?.country?.code ?? undefined,
    v: null,
    log: logline(s.summary),
    source: 'tvmaze',
  };
}

async function tvmaze(q: string): Promise<ExternalItem[]> {
  const data = await getJson<{ show: TvmazeShow }[]>(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`);
  return data.map((r) => mapTvmaze(r.show)).filter((x): x is ExternalItem => !!x).slice(0, 10);
}

/* ── Wikidata: films and games without a key ──────────────────────────── */
// One light request (the search box API). Each hit's English description, kept tidy by Wikidata's
// bots ("2021 film directed by Denis Villeneuve", "2017 action-adventure video game developed by
// Nintendo"), gives the kind, year, director or studio and often the country.

type WdHit = { id: string; label?: string; description?: string };

const DEMONYMS: Record<string, string> = {
  american: 'US', british: 'GB', english: 'GB', french: 'FR', german: 'DE', 'west german': 'DE', italian: 'IT', spanish: 'ES',
  japanese: 'JP', 'south korean': 'KR', korean: 'KR', chinese: 'CN', 'hong kong': 'HK', taiwanese: 'TW', indian: 'IN',
  iranian: 'IR', lebanese: 'LB', egyptian: 'EG', 'saudi arabian': 'SA', saudi: 'SA', moroccan: 'MA', tunisian: 'TN',
  algerian: 'DZ', jordanian: 'JO', syrian: 'SY', palestinian: 'PS', iraqi: 'IQ', turkish: 'TR', israeli: 'IL', sudanese: 'SD',
  soviet: 'SU', russian: 'RU', swedish: 'SE', danish: 'DK', norwegian: 'NO', finnish: 'FI', polish: 'PL', hungarian: 'HU',
  czech: 'CZ', belgian: 'BE', dutch: 'NL', irish: 'IE', portuguese: 'PT', greek: 'GR', estonian: 'EE', mexican: 'MX',
  brazilian: 'BR', argentine: 'AR', argentinian: 'AR', chilean: 'CL', colombian: 'CO', canadian: 'CA', australian: 'AU',
  'new zealand': 'NZ', nigerian: 'NG', 'south african': 'ZA', thai: 'TH', filipino: 'PH', indonesian: 'ID', vietnamese: 'VN',
};
const DEMONYM_RE = new RegExp(`\\b(${Object.keys(DEMONYMS).sort((a, b) => b.length - a.length).join('|')})\\b`, 'i');
const NOT_A_WORK = /\b(series|franchise|festival|soundtrack|score|character|director|producer|actor|actress|studio|company|award|project|trilogy|genre|filmmaker|edition|expansion|engine|console|developer|publisher|cancell?ed|upcoming|unreleased|season|episode)\b/i;

export function mapWikidata(h: WdHit): ExternalItem | null {
  const d = h.description ?? '';
  const title = h.label?.trim();
  if (!title || !d || NOT_A_WORK.test(d)) return null;
  const kind: Kind | null = /\bvideo game\b/i.test(d) ? 'game' : /\b(film|movie)\b/i.test(d) ? 'film' : null;
  if (!kind) return null;
  const year = d.match(/\b(18[89]\d|19\d\d|20\d\d)\b/)?.[1];
  // "directed by" wins; a plain "by" only when the film isn't "based on" someone else's book.
  const raw =
    kind === 'game'
      ? (d.match(/\b(?:developed|published) by (.+)$/i) ?? d.match(/\bgame by (.+)$/i))?.[1]
      : (d.match(/\bdirected by (.+)$/i) ?? (/\bbased on\b/i.test(d) ? null : d.match(/\b(?:film|movie) by (.+)$/i)))?.[1];
  const by = raw?.replace(/\s*\(.*$/, '').replace(/,.*$/, '').trim();
  const demonym = d.match(DEMONYM_RE)?.[1]?.toLowerCase();
  return {
    id: `wd-${h.id}`,
    kind,
    title,
    year: year ? Number(year) : undefined,
    by: by && by.length <= 80 ? by : '',
    cc: demonym ? DEMONYMS[demonym] : undefined,
    v: null,
    log: '',
    source: 'wikidata',
  };
}

async function wikidata(q: string, kinds: Kind[]): Promise<ExternalItem[]> {
  const data = await getJson<{ search?: WdHit[] }>(
    `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(q)}&language=en&uselang=en&type=item&limit=50&format=json`,
  );
  return (data.search ?? []).map(mapWikidata).filter((x): x is ExternalItem => !!x && kinds.includes(x.kind)).slice(0, 12);
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

type Search = (q: string) => Promise<ExternalItem[]>;

/** Which archives answer a search, depending on the kind and on which keys are set. */
function sourcesFor(kind?: Kind): Search[] {
  const hasTmdb = !!process.env.TMDB_API_KEY;
  const hasRawg = !!process.env.RAWG_API_KEY;
  const wd = (kinds: Kind[]): Search => (q) => wikidata(q, kinds);
  switch (kind) {
    case 'film':
      return [hasTmdb ? tmdb : wd(['film']), aniList];
    case 'series':
      return [hasTmdb ? tmdb : tvmaze, aniList];
    case 'game':
      return [hasRawg ? rawg : wd(['game'])];
    case 'book':
      return [openLibrary];
    case 'manga':
      return [aniList];
    case 'album':
      return [musicBrainz];
    default: {
      const wdKinds: Kind[] = [...(hasTmdb ? [] : (['film'] as Kind[])), ...(hasRawg ? [] : (['game'] as Kind[]))];
      return [
        ...(hasTmdb ? [tmdb] : [tvmaze]),
        ...(wdKinds.length ? [wd(wdKinds)] : []),
        openLibrary,
        aniList,
        ...(hasRawg ? [rawg] : []),
        musicBrainz,
      ];
    }
  }
}

export function configured() {
  const tmdbKey = !!process.env.TMDB_API_KEY;
  const rawgKey = !!process.env.RAWG_API_KEY;
  return { tmdb: tmdbKey, rawg: rawgKey, tvmaze: !tmdbKey, wikidata: !tmdbKey || !rawgKey, openlibrary: true, anilist: true, musicbrainz: true };
}

export async function searchWorld(q: string, kind?: Kind): Promise<ExternalItem[]> {
  const settled = await Promise.allSettled(sourcesFor(kind).map((f) => f(q)));
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

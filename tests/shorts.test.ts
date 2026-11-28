import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  countryOptions,
  embedUrl,
  emptyShortForm,
  inBand,
  parseVideo,
  SAMPLE_SHORTS,
  shortOfTheDay,
  shortToItem,
  thumbUrl,
  validateShort,
  type ShortForm,
} from '../src/lib/shorts';

/* ── A fake Supabase client: records each query and answers from `answer`. ── */

type Op = [string, unknown[]];
type Query = { table: string; ops: Op[] };
let answer: (q: Query) => { data: unknown; error: { code: string; message: string } | null } = () => ({ data: [], error: null });
const queries: Query[] = [];
let rpcAnswer: { data: unknown; error: unknown } = { data: [], error: null };

function builder(table: string) {
  const q: Query = { table, ops: [] };
  queries.push(q);
  const b: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'order', 'limit', 'insert', 'delete', 'single']) {
    b[m] = (...args: unknown[]) => {
      q.ops.push([m, args]);
      return b;
    };
  }
  b.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(answer(q)).then(res, rej);
  return b;
}

vi.mock('../src/lib/supabase/client', () => ({
  hasSupabase: () => true,
  supabase: () => ({ from: (t: string) => builder(t), rpc: async () => rpcAnswer }),
}));

const { emptyData, getState, replaceData } = await import('../src/lib/store/store');
const { loadShorts, reportShort, submitShort, withdrawShort } = await import('../src/lib/sync/shorts');

const row = (over: Record<string, unknown> = {}) => ({
  id: '11111111-1111-4111-8111-111111111111',
  user_id: 'someone',
  title: 'Night Bus',
  filmmaker: 'Lea Haddad',
  url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  mins: 12,
  year: 2026,
  cc: 'LB',
  genre: 'drama',
  logline: 'The last bus home.',
  v: [0, 0, 0, 2, 0, 0, 0, 0],
  maker_link: null,
  status: 'live',
  created_at: '2026-11-20T10:00:00Z',
  ...over,
});

const goodForm = (over: Partial<ShortForm> = {}): ShortForm => ({
  ...emptyShortForm('Lea Haddad'),
  url: 'youtu.be/dQw4w9WgXcQ',
  title: ' Night Bus ',
  mins: '12',
  genre: 'drama',
  logline: 'The last bus home.',
  rights: true,
  ...over,
});

function good() {
  const r = validateShort(goodForm(), 2026);
  if (!r.ok) throw new Error('the sample form should be valid');
  return r.value;
}

describe('video links', () => {
  it('reads every common YouTube and Vimeo form into one canonical link', () => {
    const yt = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    for (const s of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s',
      'youtube.com/watch?v=dQw4w9WgXcQ',
      'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ?si=abc',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
      'http://youtube.com/live/dQw4w9WgXcQ',
    ]) {
      expect(parseVideo(s)?.url, s).toBe(yt);
    }
    expect(parseVideo('https://vimeo.com/123456789')?.url).toBe('https://vimeo.com/123456789');
    expect(parseVideo('https://vimeo.com/123456789/abcdef1234')).toMatchObject({ host: 'vimeo', id: '123456789', hash: 'abcdef1234' });
    expect(parseVideo('https://player.vimeo.com/video/123456789?h=abcdef1234')?.url).toBe('https://vimeo.com/123456789/abcdef1234');
    expect(parseVideo('https://vimeo.com/channels/staffpicks/123456789')?.id).toBe('123456789');
  });

  it('refuses anything that is not a YouTube or Vimeo film', () => {
    for (const s of ['', 'hello', 'https://evil.example/watch?v=dQw4w9WgXcQ', 'https://youtube.com/watch?v=short', 'https://www.youtube.com/@channel', 'javascript:alert(1)', 'https://vimeo.com/about']) {
      expect(parseVideo(s), s).toBeNull();
    }
  });

  it('plays from the privacy-friendly players and shows YouTube stills only', () => {
    expect(embedUrl(parseVideo('youtu.be/dQw4w9WgXcQ')!)).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?/);
    expect(embedUrl(parseVideo('vimeo.com/123456789/abcdef1234')!)).toContain('h=abcdef1234');
    expect(thumbUrl(parseVideo('youtu.be/dQw4w9WgXcQ'))).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg');
    expect(thumbUrl(parseVideo('vimeo.com/123456789'))).toBeNull();
  });
});

describe('sending a film', () => {
  it('cleans a good form into a canonical film', () => {
    const r = validateShort(goodForm({ notes: [3, 6], cc: 'LB', makerLink: 'https://lea.example/films' }), 2026);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toMatchObject({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: 'Night Bus', mins: 12, year: 2026, cc: 'LB', genre: 'drama' });
    expect(r.value.v).toEqual([0, 0, 0, 2, 0, 0, 2, 0]);
  });

  it('names every missing or wrong field in plain words', () => {
    const r = validateShort({ ...emptyShortForm(), year: '1890', makerLink: 'http://x' }, 2026);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.errors).sort()).toEqual(['filmmaker', 'genre', 'logline', 'makerLink', 'mins', 'rights', 'title', 'url', 'year'].sort());
    expect(validateShort(goodForm({ mins: '41' }), 2026)).toMatchObject({ ok: false, errors: { mins: 'Shorts here run 1 to 40 minutes.' } });
  });
});

describe('browsing', () => {
  it('filters by running time and picks the same short all day', () => {
    expect([3, 5, 15, 16].map((m) => inBand(m, 'u5'))).toEqual([true, false, false, false]);
    expect([4, 5, 15, 16].map((m) => inBand(m, '5-15'))).toEqual([false, true, true, false]);
    expect(inBand(16, '15+') && !inBand(15, '15+')).toBe(true);
    const a = shortOfTheDay(SAMPLE_SHORTS, '2026-11-28');
    expect(shortOfTheDay([...SAMPLE_SHORTS].reverse(), '2026-11-28')).toBe(a);
    expect(shortOfTheDay([], '2026-11-28')).toBeNull();
  });

  it('turns a short into a stampable film', () => {
    expect(shortToItem(SAMPLE_SHORTS[0])).toMatchObject({ id: 'short:sample-ferryman', kind: 'film', by: 'Rania Saab', mins: 11, source: 'shorts' });
  });

  it('lists countries by name', () => {
    const list = countryOptions();
    expect(list.find((c) => c.cc === 'LB')?.name).toBe('Lebanon');
    expect(list.map((c) => c.name)).toEqual([...list.map((c) => c.name)].sort((x, y) => x.localeCompare(y)));
  });
});

describe('the room over Supabase', () => {
  beforeEach(() => {
    queries.length = 0;
    replaceData(emptyData('me-1', 'account'), { persist: false });
  });

  it('loads approved films, your own submissions and applause', async () => {
    answer = (q) => {
      const byUser = q.ops.some(([m, a]) => m === 'eq' && a[0] === 'user_id');
      return { data: byUser ? [row({ id: 'mine-1', user_id: 'me-1', status: 'pending' })] : [row()], error: null };
    };
    rpcAnswer = { data: [{ short_id: row().id, others: 4 }], error: null };
    await loadShorts();
    const s = getState().shorts;
    expect(s.status).toBe('ok');
    expect(s.live.map((x) => x.title)).toEqual(['Night Bus']);
    expect(s.live[0]).toMatchObject({ cc: 'LB', v: [0, 0, 0, 2, 0, 0, 0, 0], mine: false });
    expect(s.mine).toMatchObject([{ id: 'mine-1', status: 'pending', mine: true }]);
    expect(s.applause[row().id]).toBe(4);
    // Only approved films in the public query.
    expect(queries[0].ops).toContainEqual(['eq', ['status', 'live']]);
  });

  it('explains a duplicate or a full queue, and adds a sent film to yours', async () => {
    answer = () => ({ data: null, error: { code: '23505', message: 'duplicate' } });
    expect(await submitShort(good())).toEqual({ ok: false, error: 'This film is already in the room or waiting for review.' });
    answer = () => ({ data: null, error: { code: 'P0001', message: 'quota' } });
    expect(await submitShort(good())).toMatchObject({ ok: false, error: expect.stringContaining('5 films waiting') });
    answer = () => ({ data: row({ id: 'new-1', user_id: 'me-1', status: 'pending' }), error: null });
    const sent = await submitShort(good());
    expect(sent).toMatchObject({ ok: true, short: { id: 'new-1', mine: true, status: 'pending' } });
    expect(getState().shorts.mine[0].id).toBe('new-1');
    const insert = queries.at(-1)!.ops.find(([m]) => m === 'insert')![1][0] as Record<string, unknown>;
    expect(insert).toMatchObject({ user_id: 'me-1', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: 'Night Bus' });
    expect(insert).not.toHaveProperty('status');
  });

  it('withdraws your film and treats a second report as sent', async () => {
    answer = () => ({ data: null, error: null });
    expect(await withdrawShort('new-1')).toBe(true);
    expect(getState().shorts.mine.find((x) => x.id === 'new-1')).toBeUndefined();
    answer = () => ({ data: null, error: { code: '23505', message: 'dup' } });
    expect(await reportShort(row().id, 'broken')).toBe(true);
  });

  it('needs an account to send', async () => {
    replaceData(emptyData('local-1', 'local'), { persist: false });
    expect(await submitShort(good())).toEqual({ ok: false, error: 'Sending a film needs an account.' });
  });
});

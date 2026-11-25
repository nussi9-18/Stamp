import { allow, clientIp, json } from '@/lib/ai/server';
import { configured, searchWorld } from '@/lib/media/sources';
import { KINDS } from '@/lib/catalog';
import type { Kind } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/media/search?q=dune&kind=book — films, series, books, manga, games and albums from the world archives. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim().slice(0, 80);
  const k = url.searchParams.get('kind');
  const kind = KINDS.includes(k as Kind) ? (k as Kind) : undefined;
  if (q.length < 2) return json({ items: [], sources: configured() });
  if (!allow(`media:${clientIp(req)}`, 40)) return json({ error: 'rate_limited' }, 429, { 'retry-after': '30' });
  const items = await searchWorld(q, kind);
  return json({ items, sources: configured() }, 200, { 'cache-control': 'public, s-maxage=86400, stale-while-revalidate=604800' });
}

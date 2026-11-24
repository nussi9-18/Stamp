import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { CATALOG } from '@/lib/catalog';
import { archivistSystemPrompt, archivistUserPrompt, normalizeArchivist } from '@/lib/ai/archivist';
import { ArchivistModelOutput, ArchivistRequest } from '@/lib/ai/schemas';
import { aiError, allow, anthropic, clientIp, EFFORT, extraLines, json, mapAnthropicError, MODEL, readJson } from '@/lib/ai/server';
import type { Item } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// The catalog part of the system prompt never changes, so it is cached across requests.
const SYSTEM = archivistSystemPrompt(CATALOG);

/** POST /api/archivist — identify a half-remembered work from clues. */
export async function POST(req: Request) {
  const client = anthropic();
  if (!client) return aiError('unavailable', 503);
  if (!allow(clientIp(req))) return aiError('rate_limited', 429, { 'retry-after': '60' });

  let body: ReturnType<typeof ArchivistRequest.parse>;
  try {
    body = ArchivistRequest.parse(await readJson(req));
  } catch {
    return aiError('invalid', 400);
  }
  const extra: Item[] = (body.extra ?? []).map((x) => ({ ...x, v: null, log: '', custom: true }));

  try {
    const msg = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 8000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: EFFORT, format: betaZodOutputFormat(ArchivistModelOutput) },
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: extraLines(extra) + archivistUserPrompt(body.clues) }],
    });
    if (msg.stop_reason === 'refusal' || msg.stop_reason === 'max_tokens' || !msg.parsed_output) return aiError('failed', 502);
    return json(normalizeArchivist(msg.parsed_output, [...CATALOG, ...extra]));
  } catch (e) {
    const { error, status } = mapAnthropicError(e);
    return aiError(error, status, status === 429 ? { 'retry-after': '60' } : {});
  }
}

// Server-only helpers for the AI routes. Never import this from a client component:
// it reads ANTHROPIC_API_KEY, which must never reach the browser.

import Anthropic from '@anthropic-ai/sdk';
import type { Item } from '../types';
import type { AiError } from './schemas';

/** A current Claude model; override with ANTHROPIC_MODEL. */
export const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5-5';

type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';
const EFFORTS: Effort[] = ['low', 'medium', 'high', 'xhigh', 'max'];
/** Thinking depth. Medium is the model default; set ANTHROPIC_EFFORT=low for faster answers. */
export const EFFORT: Effort = EFFORTS.includes(process.env.ANTHROPIC_EFFORT as Effort) ? (process.env.ANTHROPIC_EFFORT as Effort) : 'medium';

let client: Anthropic | null = null;
export function anthropic(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  client ??= new Anthropic({ timeout: 45_000, maxRetries: 1 });
  return client;
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

export function aiError(error: AiError['error'], status: number, headers: Record<string, string> = {}) {
  return json({ error } satisfies AiError, status, headers);
}

/* ── Best-effort per-IP rate limit (per server instance) ──────────────── */

const WINDOW_MS = 60_000;
const PER_IP = 8;
const hits = new Map<string, number[]>();

export function clientIp(req: Request): string {
  return (req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'local').trim();
}

export function allow(ip: string): boolean {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= PER_IP) {
    hits.set(ip, list);
    return false;
  }
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return true;
}

export async function readJson(req: Request, maxBytes = 48_000): Promise<unknown> {
  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > maxBytes) throw new Error('too large');
  const text = await req.text();
  if (text.length > maxBytes) throw new Error('too large');
  return JSON.parse(text);
}

/** The user's own works (custom / imported), listed in the user turn so the cached system prompt stays stable. */
export function extraLines(extra: Pick<Item, 'id' | 'title' | 'year' | 'by' | 'kind'>[]): string {
  if (!extra.length) return '';
  return (
    'Also on this user’s own list (no heat data), usable as catalog_id:\n' +
    extra.map((i) => `${i.id}: ${i.title} (${i.year ?? '?'}, ${i.by || 'unknown'}, ${i.kind})`).join('\n') +
    '\n\n'
  );
}

/** Map SDK errors to our small error vocabulary. */
export function mapAnthropicError(e: unknown): { error: AiError['error']; status: number } {
  // Most specific first: busy (retry later) vs. misconfigured vs. transient failure.
  if (e instanceof Anthropic.RateLimitError) return { error: 'rate_limited', status: 429 };
  if (e instanceof Anthropic.OverloadedError || e instanceof Anthropic.ServiceUnavailableError) return { error: 'rate_limited', status: 429 };
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return { error: 'unavailable', status: 503 };
  if (e instanceof Anthropic.APIConnectionTimeoutError || e instanceof Anthropic.APIConnectionError) return { error: 'failed', status: 504 };
  if (e instanceof Anthropic.APIError) return { error: 'failed', status: 502 };
  return { error: 'failed', status: 502 };
}

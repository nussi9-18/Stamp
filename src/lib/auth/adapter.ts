'use client';

import { hash } from '../hash';
import { hasSupabase, siteOrigin, supabase } from '../supabase/client';

export type AuthUser = { id: string; email?: string };
export type AuthErrorCode = 'bad-code' | 'rate' | 'network' | 'invalid-email' | 'unknown';

export class AuthError extends Error {
  constructor(
    public code: AuthErrorCode,
    message?: string,
  ) {
    super(message ?? code);
  }
}

export interface AuthAdapter {
  kind: 'supabase' | 'demo';
  sendCode(email: string): Promise<void>;
  sendLink(email: string): Promise<void>;
  verify(email: string, code: string): Promise<AuthUser>;
  /** Supabase redirects away to the provider; demo resolves straight away. */
  oauth(provider: 'apple' | 'google'): Promise<AuthUser | 'redirect'>;
  current(): Promise<AuthUser | null>;
  signOut(): Promise<void>;
  onSignIn(cb: (u: AuthUser) => void): () => void;
  /** Demo only: the code to show on screen. */
  demoCode?(): string | null;
  /** Demo only: behave as if the emailed link was opened. */
  demoLink?(email: string): Promise<AuthUser>;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function mapError(e: unknown): AuthError {
  const err = e as { status?: number; code?: string; message?: string; name?: string };
  if (err?.status === 429 || /rate|too many/i.test(err?.message ?? '')) return new AuthError('rate');
  if (err?.name === 'AuthRetryableFetchError' || err?.status === 0 || /fetch|network|failed to fetch/i.test(err?.message ?? '')) return new AuthError('network');
  if (/expired|invalid|otp|token/i.test(`${err?.code ?? ''} ${err?.message ?? ''}`)) return new AuthError('bad-code');
  if (/email/i.test(err?.message ?? '')) return new AuthError('invalid-email');
  return new AuthError('unknown', err?.message);
}

/* ── Supabase ─────────────────────────────────────────────────────────── */

function supabaseAdapter(): AuthAdapter {
  const sb = supabase()!;
  let lastSend = 0;
  const send = async (email: string) => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new AuthError('network');
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, emailRedirectTo: `${siteOrigin()}/app` },
    });
    if (error) throw mapError(error);
    lastSend = Date.now();
  };
  return {
    kind: 'supabase',
    sendCode: send,
    // One email carries both the code and the link (see README → email template).
    // Only re-send when the first email is older than a minute.
    async sendLink(email) {
      if (Date.now() - lastSend > 60_000) await send(email);
    },
    async verify(email, code) {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new AuthError('network');
      const { data, error } = await sb.auth.verifyOtp({ email, token: code, type: 'email' });
      if (error || !data.user) throw mapError(error ?? new Error('invalid otp'));
      return { id: data.user.id, email: data.user.email ?? email };
    },
    async oauth(provider) {
      try {
        sessionStorage.setItem('stamp:oauth', provider);
      } catch {
        /* ignore */
      }
      const { error } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo: `${siteOrigin()}/app` } });
      if (error) throw mapError(error);
      return 'redirect';
    },
    async current() {
      const { data } = await sb.auth.getSession();
      const u = data.session?.user;
      return u ? { id: u.id, email: u.email ?? undefined } : null;
    },
    async signOut() {
      try {
        await sb.auth.signOut();
      } catch {
        /* still clear locally */
      }
    },
    onSignIn(cb) {
      const { data } = sb.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session?.user) cb({ id: session.user.id, email: session.user.email ?? undefined });
      });
      return () => data.subscription.unsubscribe();
    },
  };
}

/* ── Demo (no Supabase keys): the whole flow runs on this device ──────── */

function demoAdapter(): AuthAdapter {
  let code: string | null = null;
  let tries = 0;
  let lockedUntil = 0;
  const listeners = new Set<(u: AuthUser) => void>();
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const idFor = (email: string) => `demo:${hash(email.trim().toLowerCase()).toString(36)}`;
  return {
    kind: 'demo',
    async sendCode(email) {
      await wait(900);
      if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new AuthError('network');
      code = String(Math.floor(100000 + Math.random() * 900000));
      tries = 0;
    },
    async sendLink() {
      await wait(500);
    },
    async verify(email, entered) {
      await wait(900);
      if (Date.now() < lockedUntil) throw new AuthError('rate');
      if (!code || entered !== code) {
        tries++;
        if (tries >= 5) {
          lockedUntil = Date.now() + 60_000;
          throw new AuthError('rate');
        }
        throw new AuthError('bad-code');
      }
      code = null;
      return { id: idFor(email), email: email.trim().toLowerCase() };
    },
    async oauth(provider) {
      await wait(1100);
      return { id: `demo:${provider}`, email: `${provider}-user@example.com` };
    },
    async current() {
      return null;
    },
    async signOut() {},
    onSignIn(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    demoCode: () => code,
    async demoLink(email) {
      await wait(700);
      code = null;
      return { id: idFor(email), email: email.trim().toLowerCase() };
    },
  };
}

let adapter: AuthAdapter | null = null;
export function auth(): AuthAdapter {
  if (!adapter) adapter = hasSupabase() ? supabaseAdapter() : demoAdapter();
  return adapter;
}

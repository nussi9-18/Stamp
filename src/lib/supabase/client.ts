'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
// The Supabase ↔ Vercel integration sets the newer publishable key (sb_publishable_…);
// older projects and hand-made .env files use the legacy anon key. Either works here.
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

let client: SupabaseClient | null = null;

export function hasSupabase(): boolean {
  return Boolean(URL && ANON);
}

/** The browser Supabase client (auth + Postgres with RLS), or null in local-only mode. */
export function supabase(): SupabaseClient | null {
  if (!hasSupabase()) return null;
  if (!client) {
    client = createClient(URL, ANON, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
        storageKey: 'stamp-auth',
      },
    });
  }
  return client;
}

export function siteOrigin(): string {
  if (typeof window !== 'undefined') return window.location.origin;
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
}

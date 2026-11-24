import { z } from 'zod';

export const KIND_ENUM = z.enum(['film', 'series', 'book', 'manga', 'game', 'album']);
export const FACTOR_KIND = z.enum(['Visual', 'Sound', 'Character', 'Object', 'Setting', 'Time', 'Story']);
export type FactorKind = z.infer<typeof FACTOR_KIND>;

/* ── Archivist ─────────────────────────────────────────────────────────── */

/** What we ask Claude to return (numeric bounds are clamped in code, not in the schema). */
export const ArchivistModelOutput = z.object({
  match: z.object({
    title: z.string(),
    year: z.number().nullable(),
    creator: z.string(),
    kind: KIND_ENUM,
    catalog_id: z.string().nullable(),
    confidence: z.number(),
    why: z.string(),
    factors: z.array(
      z.object({
        clue: z.string(),
        kind: FACTOR_KIND,
        weight: z.number(),
      }),
    ),
  }),
  alternates: z.array(
    z.object({
      title: z.string(),
      year: z.number().nullable(),
      creator: z.string(),
      kind: z.string(),
      catalog_id: z.string().nullable(),
    }),
  ),
});
export type ArchivistModelOutput = z.infer<typeof ArchivistModelOutput>;

export type ArchivistFactor = { clue: string; kind: FactorKind; weight: number };
export type ArchivistAlt = { title: string; year?: number; creator: string; kind: string; catalog_id: string | null };
export type ArchivistResult = {
  source: 'ai' | 'keyword';
  match: {
    title: string;
    year?: number;
    creator: string;
    kind: z.infer<typeof KIND_ENUM>;
    catalog_id: string | null;
    confidence: number;
    why: string;
    factors: ArchivistFactor[];
  } | null;
  alternates: ArchivistAlt[];
};

export const ExtraItem = z.object({
  id: z.string().max(80),
  title: z.string().max(160),
  year: z.number().int().optional(),
  by: z.string().max(120),
  kind: KIND_ENUM,
});

export const ArchivistRequest = z.object({
  clues: z.string().trim().min(8).max(2000),
  extra: z.array(ExtraItem).max(200).optional(),
});

/* ── Diplomat ──────────────────────────────────────────────────────────── */

export const DiplomatPerson = z.object({
  name: z.string().trim().min(1).max(60),
  likes: z.string().max(400).default(''),
  favourites: z.string().max(400).default(''),
  /** 0 Clear · 1 Mild · 2 Strong · 3 Peak */
  ceiling: z.number().int().min(0).max(3),
});
export type DiplomatPerson = z.infer<typeof DiplomatPerson>;

export const DiplomatRequest = z.object({
  people: z.array(DiplomatPerson).min(2).max(4),
  /** Person 1's own comfort shield (per-vector limits), kept as a hard limit on the pick. */
  shield: z.array(z.number().int().min(0).max(3)).length(8).optional(),
  extra: z.array(ExtraItem).max(200).optional(),
});

export const DiplomatModelOutput = z.object({
  pick: z.object({
    title: z.string(),
    year: z.number().nullable(),
    creator: z.string(),
    kind: KIND_ENUM,
    catalog_id: z.string().nullable(),
  }),
  concordance: z.number(),
  friction: z.string(),
  reasons: z.array(z.object({ name: z.string(), why: z.string() })),
  alternates: z.array(
    z.object({
      title: z.string(),
      year: z.number().nullable(),
      creator: z.string(),
      catalog_id: z.string().nullable(),
    }),
  ),
});
export type DiplomatModelOutput = z.infer<typeof DiplomatModelOutput>;

export type DiplomatPick = { title: string; year?: number; creator: string; kind: z.infer<typeof KIND_ENUM>; catalog_id: string | null };
export type DiplomatResult = {
  source: 'ai' | 'keyword';
  pick: DiplomatPick | null;
  concordance: number;
  friction: string;
  reasons: { name: string; why: string }[];
  alternates: { title: string; year?: number; creator: string; catalog_id: string | null }[];
};

/** Shape of an error body from the AI routes. */
export type AiError = { error: 'rate_limited' | 'unavailable' | 'failed' | 'invalid'; message?: string };

import { VECTOR_NAMES, LEVEL_NAMES } from './heat';
import type { Item, Shield, ShieldAction, ShieldPreset } from './types';

export type PresetDef = { id: Exclude<ShieldPreset, 'custom'>; name: string; copy: string; limits: number[] };

export const PRESETS: PresetDef[] = [
  { id: 'open', name: 'No limits', copy: 'Everything shows. Heat scores stay visible.', limits: [3, 3, 3, 3, 3, 3, 3, 3] },
  { id: 'sanctuary', name: 'Sanctuary', copy: 'Caps violence at Strong, gore, dread and animal harm at Mild.', limits: [3, 2, 1, 1, 3, 3, 3, 1] },
  { id: 'family', name: 'Family', copy: 'For watching with kids: no sex or gore, only mild violence and language.', limits: [0, 1, 0, 1, 1, 1, 3, 1] },
  { id: 'sensory', name: 'Sensory safe', copy: 'No flashing lights. Everything else allowed.', limits: [3, 3, 3, 3, 3, 3, 0, 3] },
];

export const DEFAULT_SHIELD: Shield = { preset: 'open', limits: [3, 3, 3, 3, 3, 3, 3, 3], action: 'blur' };

export const ACTIONS: { id: ShieldAction; name: string; copy: string }[] = [
  { id: 'hide', name: 'Hide it', copy: 'Remove it from Discover and the feed.' },
  { id: 'blur', name: 'Blur the poster', copy: 'Keep it listed, cover the poster and ask before showing details.' },
  { id: 'warn', name: 'Warn only', copy: 'Show everything with a warning label.' },
];

export function presetName(preset: ShieldPreset): string {
  if (preset === 'custom') return 'Custom';
  return PRESETS.find((p) => p.id === preset)?.name ?? 'Custom';
}

/** Editing any single limit switches the preset to "Custom" unless it matches a preset exactly. */
export function detectPreset(limits: number[]): ShieldPreset {
  const hit = PRESETS.find((p) => p.limits.every((l, i) => l === limits[i]));
  return hit ? hit.id : 'custom';
}

/** over(item) = indexes where item.v[i] > limits[i]. */
export function over(item: Pick<Item, 'v'>, limits: number[]): number[] {
  if (!item.v) return [];
  const out: number[] = [];
  item.v.forEach((level, i) => {
    if (level > (limits[i] ?? 3)) out.push(i);
  });
  return out;
}

/** "Gore", "Violence: Strong · Gore: Peak" etc. */
export function overNames(item: Pick<Item, 'v'>, limits: number[]): string[] {
  return over(item, limits).map((i) => VECTOR_NAMES[i]);
}

export function overDetail(item: Pick<Item, 'v'>, limits: number[]): string {
  if (!item.v) return '';
  return over(item, limits)
    .map((i) => `${VECTOR_NAMES[i]}: ${LEVEL_NAMES[item.v![i]]}`)
    .join(' · ');
}

export type Gate = { gated: boolean; action: ShieldAction; over: number[] };

export function gate(item: Pick<Item, 'v'>, shield: Shield): Gate {
  const o = over(item, shield.limits);
  return { gated: o.length > 0, action: shield.action, over: o };
}

/** A single overall ceiling (0–3) that best describes a shield, for the Diplomat's "highest intensity". */
export function shieldCeiling(shield: Shield): number {
  switch (shield.preset) {
    case 'open':
    case 'sensory':
      return 3;
    case 'sanctuary':
      return 2;
    case 'family':
      return 1;
    default: {
      const capped = shield.limits.filter((l) => l < 3);
      return capped.length ? Math.max(...capped) : 3;
    }
  }
}

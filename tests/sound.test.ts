import { describe, expect, it } from 'vitest';
import { LEVEL, SOUND_BANK, type Sfx } from '@/lib/sound';

describe('sound bank', () => {
  it('gives every sound a level in both looks', () => {
    for (const look of ['retro', 'modern'] as const) {
      for (const name of Object.keys(SOUND_BANK[look]) as Sfx[]) {
        expect(LEVEL[look][name], `${look}:${name}`).toBeGreaterThan(0);
      }
    }
  });

  it('keeps the shared UI sounds in both looks', () => {
    const shared: Sfx[] = ['key', 'piano', 'select', 'punch', 'stamp', 'stamp-soft', 'toggle', 'slide', 'page', 'toast', 'error', 'success', 'open', 'applause'];
    for (const name of shared) {
      expect(SOUND_BANK.retro[name], `retro:${name}`).toBeTypeOf('function');
      expect(SOUND_BANK.modern[name], `modern:${name}`).toBeTypeOf('function');
    }
  });
});

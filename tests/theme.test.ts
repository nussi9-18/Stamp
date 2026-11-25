import { describe, expect, it } from 'vitest';
import { emptyData, getState, makePassport, replaceData, setLook, setPref } from '../src/lib/store/store';

function seed() {
  const d = emptyData('u-theme', 'local');
  d.passport = { ...makePassport('Nussi', ['Slow cinema'], 'day'), updatedAt: 1 };
  replaceData(d, { persist: false });
}

describe('look and prefs', () => {
  it('saves the look with the passport so it syncs', () => {
    seed();
    setLook('modern');
    const d = getState().data!;
    expect(getState().look).toBe('modern');
    expect(d.prefs.look).toBe('modern');
    expect(d.passport!.updatedAt).toBeGreaterThan(1);
    setLook('retro');
    expect(getState().data!.prefs.look).toBe('retro');
  });
  it('bumps the passport when a pref changes, so the profile row is pushed', () => {
    seed();
    setPref('sound', true);
    const d = getState().data!;
    expect(d.prefs.sound).toBe(true);
    expect(d.passport!.updatedAt).toBeGreaterThan(1);
    expect(d.sync.dirtyAt).toBeGreaterThan(0);
  });
});

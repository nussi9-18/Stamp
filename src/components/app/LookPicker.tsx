'use client';

import { closeSheet, getState, replaceSheet, setLook, setTheme, useLook, useStore } from '@/lib/store/store';

/** Two big cards with a tiny preview of each look. */
export function LookChoice() {
  const look = useLook();
  return (
    <div className="looks" role="group" aria-label="Look">
      <button type="button" className="look-card" data-sfx="success" aria-pressed={look === 'modern'} onClick={() => setLook('modern')}>
        <span className="look-mini is-modern" aria-hidden="true">
          <i className="m-title" />
          <span className="m-row">
            <b />
            <b />
            <b />
          </span>
          <i className="m-pill" />
        </span>
        <strong>Modern</strong>
        <span className="look-note">Clean and calm.</span>
      </button>
      <button type="button" className="look-card" data-sfx="success" aria-pressed={look === 'retro'} onClick={() => setLook('retro')}>
        <span className="look-mini is-retro" aria-hidden="true">
          <i className="r-band" />
          <b className="r-poster" />
          <i className="r-stamp" />
          <i className="r-key" />
        </span>
        <strong>Retro</strong>
        <span className="look-note">VHS nights and real buttons.</span>
      </button>
    </div>
  );
}

export function ModeChoice() {
  const night = useStore((s) => (s.data?.passport?.theme ?? 'day') === 'night');
  return (
    <div className="seg seg-block" role="group" aria-label="Light or dark">
      <button type="button" aria-pressed={!night} onClick={() => setTheme('day')}>
        Light
      </button>
      <button type="button" aria-pressed={night} onClick={() => setTheme('night')}>
        Dark
      </button>
    </div>
  );
}

/** Accept the look on screen if the passport hasn't chosen one yet. */
export function acceptLook() {
  const s = getState();
  if (s.data && !s.data.prefs.look) setLook(s.look);
}

export function leaveLookSheet(next?: 'manual') {
  acceptLook();
  if (next === 'manual') replaceSheet({ type: 'manual' });
  else closeSheet();
}

/** Shown once: pick a look (and light or dark), then carry on. */
export function LookSheet({ next }: { next?: 'manual' }) {
  return (
    <div className="look-sheet">
      <h2 className="h2">Choose your look</h2>
      <p className="body2">Change it any time in Settings.</p>
      <LookChoice />
      <ModeChoice />
      <button type="button" className="btn btn-pri btn-block" data-autofocus onClick={() => leaveLookSheet(next)}>
        Continue
      </button>
    </div>
  );
}

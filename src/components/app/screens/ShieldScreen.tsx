'use client';

import { useMemo } from 'react';
import { LEVEL_NAMES, VECTOR_NAMES } from '@/lib/heat';
import { ACTIONS, DEFAULT_SHIELD, over, PRESETS } from '@/lib/shield';
import { allItems, setShieldAction, setShieldLimit, setShieldPreset, useStore } from '@/lib/store/store';
import { PageTitle } from '../PageTitle';

export function ShieldScreen() {
  const shield = useStore((s) => s.data?.passport?.shield ?? DEFAULT_SHIELD);
  const data = useStore((s) => s.data);
  const pastCount = useMemo(() => allItems().filter((i) => over(i, shield.limits).length > 0).length, [shield.limits, data]);

  return (
    <>
      <PageTitle
        retro={<>COMFORT <em>shield</em></>}
        modern="Shield"
        sub="Set your own limit for eight kinds of content, and choose what happens when something goes past it."
        keepSub
      />

      <section className="section" style={{ marginTop: 0 }} aria-labelledby="presets-h">
        <div className="section-head">
          <h2 className="h2" id="presets-h">
            Presets
          </h2>
          <span className="label">
            {pastCount} {pastCount === 1 ? 'work' : 'works'} past your limits
          </span>
        </div>
        <div className="presets">
          {PRESETS.map((p) => (
            <button key={p.id} type="button" className="preset" aria-pressed={shield.preset === p.id} onClick={() => setShieldPreset(p.id)}>
              <h3>{p.name}</h3>
              <p>{p.copy}</p>
            </button>
          ))}
        </div>
        {shield.preset === 'custom' ? <p className="label">Custom limits</p> : null}
      </section>

      <section className="section" aria-labelledby="limits-h">
        <div className="section-head">
          <h2 className="h2" id="limits-h">
            Your limits
          </h2>
        </div>
        <p className="body2">Pick the strongest level you’re OK with. Anything above it triggers the shield.</p>
        <div className="limits">
          {VECTOR_NAMES.map((name, i) => (
            <div key={name} className="limit-row">
              <span className="label" style={{ color: 'var(--ink)' }} id={`lim-${i}`}>
                {name}
              </span>
              <div className="seg seg-block" role="group" aria-labelledby={`lim-${i}`}>
                {LEVEL_NAMES.map((lvl, l) => (
                  <button key={lvl} type="button" aria-pressed={shield.limits[i] === l} onClick={() => setShieldLimit(i, l)}>
                    {lvl}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section" aria-labelledby="action-h">
        <div className="section-head">
          <h2 className="h2" id="action-h">
            When something goes past it
          </h2>
        </div>
        <div className="radio-cards" role="radiogroup" aria-labelledby="action-h">
          {ACTIONS.map((a) => (
            <label key={a.id} className="radio-card">
              <input type="radio" name="shield-action" value={a.id} checked={shield.action === a.id} onChange={() => setShieldAction(a.id)} />
              <span>
                <strong>{a.name}</strong>
                <span>{a.copy}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <p className="inline-note" style={{ marginTop: 28 }}>
        Heat scores are sample ratings for this prototype. Your own stamps always stay in your passport.
      </p>
    </>
  );
}

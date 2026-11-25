'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { countryName, KIND_LABEL, KINDS } from '@/lib/catalog';
import { MONTH_SHORT } from '@/lib/format';
import { LEVEL_NAMES, LEVEL_VARS } from '@/lib/heat';
import { renderShareCard, shareOrDownload } from '@/lib/sharecard';
import { getItem, liveStamps, requestSearchFocus, toast, useStore } from '@/lib/store/store';
import { computeWrapped, pctChange, wrappedYears } from '@/lib/wrapped';
import type { Kind } from '@/lib/types';
import { Icon } from '../../brand/Icon';
import { PageTitle } from '../PageTitle';

const MIX_COLORS: Record<Kind, string> = {
  film: 'var(--ink)',
  series: 'var(--rose)',
  book: 'var(--sky)',
  manga: 'var(--brass)',
  game: 'var(--game)',
  album: 'var(--pink)',
};

export function WrappedScreen() {
  const router = useRouter();
  const data = useStore((s) => s.data);
  const p = data?.passport;
  const stamps = useMemo(() => liveStamps(data), [data]);
  const now = new Date().getFullYear();
  const years = useMemo(() => wrappedYears(stamps, now), [stamps, now]);
  const [year, setYear] = useState(now);
  const w = useMemo(() => computeWrapped(year, stamps, (id) => getItem(id)), [year, stamps]);
  const [busy, setBusy] = useState(false);
  if (!p) return null;

  const hours = Math.round(w.mins / 60);
  const prevHours = w.prev ? Math.round(w.prev.mins / 60) : 0;
  const maxMonth = Math.max(...w.perMonth);
  const topMonth = maxMonth > 0 && w.perMonth.filter((x) => x === maxMonth).length === 1 ? w.perMonth.indexOf(maxMonth) : -1;
  const mixTotal = KINDS.reduce((a, k) => a + w.mediaMix[k], 0);
  const heatTotal = w.heatMix.reduce((a, b) => a + b, 0);

  const share = async () => {
    setBusy(true);
    try {
      const blob = await renderShareCard({
        year,
        name: p.name,
        passportNo: p.passportNo,
        stamps: w.stamps,
        hours,
        stats: [
          { value: String(w.countries.length), label: w.countries.length === 1 ? 'Country visited' : 'Countries visited' },
          { value: String(w.fiveStars), label: w.fiveStars === 1 ? 'Five-star work' : 'Five-star works' },
          { value: w.avg ? w.avg.toFixed(1) : '—', label: 'Avg rating' },
        ],
      });
      const res = await shareOrDownload(blob, `stamp-wrapped-${year}.png`);
      if (res === 'downloaded') toast('Share card saved');
    } catch {
      toast('Couldn’t make the share card. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageTitle retro={<>{year} <em>wrapped</em></>} modern={`${year} Wrapped`}>
        <div className="seg" role="group" aria-label="Year" style={{ justifySelf: 'start' }}>
          {years.map((y) => (
            <button key={y} type="button" aria-pressed={y === year} onClick={() => setYear(y)}>
              {y}
            </button>
          ))}
        </div>
      </PageTitle>

      {w.stamps === 0 ? (
        <div className="empty-state">
          <p>Your year appears here once you stamp your first piece of {year}.</p>
          <button
            type="button"
            className="btn btn-pri"
            onClick={() => {
              requestSearchFocus();
              router.push('/app/discover');
            }}
          >
            Stamp something
          </button>
        </div>
      ) : (
        <div className="wrapped">
          <section className="w-hero" aria-label={`${year} in stamps`}>
            <div className="w-year" aria-hidden="true">
              {String(year).slice(-2)}
            </div>
            <span className="label">
              {p.name} / {p.passportNo}
            </span>
            <h2>
              {w.stamps} {w.stamps === 1 ? 'stamp' : 'stamps'}. <em>{hours} {hours === 1 ? 'hour' : 'hours'}</em> well spent.
            </h2>
            <p>Your {year} in stamps, counted from everything you logged this year.</p>
            <div>
              <button type="button" className="btn" onClick={share} disabled={busy}>
                <Icon name="share" size={16} /> {busy ? 'Making the card…' : 'Share card'}
              </button>
            </div>
          </section>

          {w.prev ? (
            <section className="w-tile w-span6" aria-label={`${year - 1} vs ${year}`}>
              <span className="label">
                {year - 1} vs {year}
              </span>
              <div className="vs-grid">
                <div className="vs-cell">
                  <span className="label">Stamps</span>
                  <div className="display">
                    {w.prev.stamps} → {w.stamps}
                  </div>
                  <span className="label" style={{ color: 'var(--rose-d)' }}>
                    {pctChange(w.prev.stamps, w.stamps)} vs {year - 1}
                  </span>
                </div>
                <div className="vs-cell">
                  <span className="label">Hours</span>
                  <div className="display">
                    {prevHours} → {hours}
                  </div>
                  <span className="label" style={{ color: 'var(--rose-d)' }}>
                    {pctChange(prevHours, hours)}
                  </span>
                </div>
                <div className="vs-cell">
                  <span className="label">Avg rating</span>
                  <div className="display">
                    {w.prev.avg ? w.prev.avg.toFixed(1) : '—'} → {w.avg ? w.avg.toFixed(1) : '—'}
                  </div>
                </div>
                <div className="vs-cell">
                  <span className="label">Five stars</span>
                  <div className="display">
                    {w.prev.fiveStars} → {w.fiveStars}
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          <section className="w-tile w-span2">
            <span className="label">Countries visited</span>
            <div className="w-big w-outline">{w.countries.length}</div>
            <div className="visa-chips">
              {w.countries.map((cc, i) => (
                <span key={cc} className="visa-chip" title={countryName(cc)} style={{ transform: `rotate(${((i * 37) % 9) - 4}deg)` }}>
                  {cc}
                </span>
              ))}
            </div>
          </section>
          <section className="w-tile w-span2">
            <span className="label">Most stamped creator</span>
            <div className="display" style={{ fontSize: 28, lineHeight: 1 }}>
              {w.topCreator?.name ?? '—'}
            </div>
            {w.topCreator ? (
              <span className="label">
                {w.topCreator.count} {w.topCreator.count === 1 ? 'stamp' : 'stamps'}
              </span>
            ) : null}
          </section>
          <section className="w-tile w-span2">
            <span className="label">Five-star works</span>
            <div className="w-big">{w.fiveStars}</div>
            <span className="label">of {w.stamps}</span>
          </section>

          <section className="w-tile w-span6" aria-label="Stamps per month">
            <span className="label">Stamps per month</span>
            <div className="bars">
              {w.perMonth.map((n, i) => (
                <div key={i} className={`bar${i === topMonth ? ' is-top' : ''}`}>
                  <i style={{ height: `${maxMonth ? (n / maxMonth) * 100 : 0}%`, animationDelay: `${i * 40}ms` }} aria-hidden="true" />
                  <span>
                    {MONTH_SHORT[i]}
                    <span className="sr-only">: {n}</span>
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="w-tile w-span3">
            <span className="label">Media mix</span>
            <div className="mix-bar" role="img" aria-label={KINDS.filter((k) => w.mediaMix[k]).map((k) => `${KIND_LABEL[k]} ${w.mediaMix[k]}`).join(', ')}>
              {KINDS.map((k) => (w.mediaMix[k] ? <i key={k} style={{ width: `${(w.mediaMix[k] / mixTotal) * 100}%`, background: MIX_COLORS[k] }} /> : null))}
            </div>
            <div className="mix-legend">
              {KINDS.filter((k) => w.mediaMix[k]).map((k) => (
                <span key={k}>
                  <i style={{ background: MIX_COLORS[k] }} />
                  {KIND_LABEL[k]} {w.mediaMix[k]}
                </span>
              ))}
            </div>
          </section>
          <section className="w-tile w-span3">
            <span className="label">Heat mix</span>
            {heatTotal ? (
              <>
                <div className="mix-bar" role="img" aria-label={LEVEL_NAMES.map((n, i) => `${n} ${w.heatMix[i]}`).join(', ')}>
                  {w.heatMix.map((n, i) => (n ? <i key={i} style={{ width: `${(n / heatTotal) * 100}%`, background: LEVEL_VARS[i] }} /> : null))}
                </div>
                <div className="mix-legend">
                  {LEVEL_NAMES.map((n, i) => (
                    <span key={n}>
                      <i style={{ background: LEVEL_VARS[i] }} />
                      {n} {w.heatMix[i]}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p className="body2">No heat data</p>
            )}
            {w.moods.length ? (
              <p style={{ marginTop: 6 }}>
                Your moods: <span className="italic">{w.moods.map((m) => m.toLowerCase()).join(', ')}</span>
              </p>
            ) : null}
          </section>
        </div>
      )}
    </>
  );
}

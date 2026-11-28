'use client';

import { useEffect, useMemo, useState } from 'react';
import { todayISO } from '@/lib/format';
import { GENRE_LABEL, inBand, LENGTH_BANDS, regionName, SAMPLE_SHORTS, SHORT_GENRES, shortOfTheDay, STATUS_LABEL, type LengthBand, type Short, type ShortGenre } from '@/lib/shorts';
import { openSheet, useStore } from '@/lib/store/store';
import { loadShorts } from '@/lib/sync/shorts';
import { Icon } from '../../brand/Icon';
import { PageTitle } from '../PageTitle';
import { ShortThumb } from '../ShortThumb';

function byLine(s: Short) {
  return [s.filmmaker, regionName(s.cc)].filter(Boolean).join(' · ');
}

export function ShortsScreen() {
  const st = useStore((s) => s.shorts);
  const uid = useStore((s) => (s.data?.mode === 'account' ? s.data.userId : null));
  const [band, setBand] = useState<LengthBand>('any');
  const [genre, setGenre] = useState<ShortGenre | 'all'>('all');

  useEffect(() => {
    void loadShorts();
  }, [uid]);

  const waiting = !st.live.length && (st.status === 'idle' || st.status === 'loading');
  const samples = !st.live.length;
  const list = samples ? SAMPLE_SHORTS : st.live;
  const pick = useMemo(() => shortOfTheDay(list, todayISO()), [list]);
  const genres = useMemo(() => SHORT_GENRES.filter((g) => list.some((s) => s.genre === g)), [list]);
  const shown = list.filter((s) => inBand(s.mins, band) && (genre === 'all' || s.genre === genre));
  const watch = (s: Short) => openSheet({ type: 'short', id: s.id });

  return (
    <>
      <PageTitle retro={<>INDIE <em>shorts</em></>} modern="Shorts" sub="Short films by new filmmakers. Free to watch." />

      {waiting ? (
        <div className="shorts-skel" aria-busy="true" aria-label="Loading shorts">
          <span className="skel skel-hero" />
          <span className="skel" />
          <span className="skel" />
        </div>
      ) : (
        <>
          {pick ? (
            <button type="button" className="short-pick" onClick={() => watch(pick)}>
              <span className="short-pick-media">
                <ShortThumb short={pick} hero />
                <span className="short-pick-tag">Short of the day</span>
              </span>
              <span className="short-pick-body">
                <span className="short-pick-title">{pick.title}</span>
                <span className="short-pick-by">{byLine(pick)}</span>
                <span className="short-pick-play">
                  <Icon name="play" size={15} /> Play · {pick.mins} min
                </span>
              </span>
            </button>
          ) : null}

          <div className="shorts-filters">
            <div className="field">
              <span className="label" id="shorts-len">
                Minutes
              </span>
              <div className="seg" role="group" aria-labelledby="shorts-len">
                {LENGTH_BANDS.map((b) => (
                  <button key={b.id} type="button" aria-pressed={band === b.id} onClick={() => setBand(b.id)}>
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="chip-row" role="group" aria-label="Genre">
              <button type="button" className="chip" aria-pressed={genre === 'all'} onClick={() => setGenre('all')}>
                All
              </button>
              {genres.map((g) => (
                <button key={g} type="button" className="chip" aria-pressed={genre === g} onClick={() => setGenre(g)}>
                  {GENRE_LABEL[g]}
                </button>
              ))}
            </div>
          </div>

          {samples ? (
            <p className="shorts-note">
              <span className="label">{st.status === 'error' || st.status === 'offline' ? 'Can’t reach the room · samples' : 'Samples'}</span>
              Real films appear here once they’re approved.
            </p>
          ) : null}

          {shown.length ? (
            <ul className="shorts-grid">
              {shown.map((s) => (
                <li key={s.id}>
                  <button type="button" className="short-card" onClick={() => watch(s)}>
                    <ShortThumb short={s} />
                    <span className="short-card-title">{s.title}</span>
                    <span className="short-card-by">{byLine(s)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state" style={{ justifyItems: 'start', textAlign: 'left' }}>
              <p>No shorts match that length and genre yet.</p>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setBand('any');
                  setGenre('all');
                }}
              >
                Show all shorts
              </button>
            </div>
          )}

          {st.mine.length ? (
            <section className="shorts-mine" aria-labelledby="shorts-mine-h">
              <h2 id="shorts-mine-h" className="label">
                Your films
              </h2>
              <ul>
                {st.mine.map((s) => (
                  <li key={s.id}>
                    <button type="button" className="mine-row" onClick={() => watch(s)}>
                      <ShortThumb short={s} />
                      <span className="mine-title">{s.title}</span>
                      <span className={`status-tag is-${s.status}`}>{STATUS_LABEL[s.status]}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}

      <section className="shorts-send" aria-labelledby="shorts-send-h">
        <Icon name="clapper" size={28} />
        <div>
          <h2 id="shorts-send-h">Made a short?</h2>
          <p>Up to 40 minutes, on YouTube or Vimeo.</p>
        </div>
        <button type="button" className="btn btn-pri" onClick={() => openSheet({ type: 'submit-short' })}>
          Send your film
        </button>
      </section>
    </>
  );
}

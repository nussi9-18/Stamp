'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { formatAvg, formatDate, formatHours, initials, pad2 } from '@/lib/format';
import { presetName } from '@/lib/shield';
import { clearLanding, getItem, liveStamps, openSheet, requestSearchFocus, setPref, useStore } from '@/lib/store/store';
import { beginSaveAccount } from '@/lib/auth/session';
import { Icon } from '../../brand/Icon';
import { MRZ } from '../../brand/MRZ';
import { Poster } from '../../brand/Poster';
import { Seal } from '../../brand/Seal';
import { ItemStamp } from '../../brand/Stamp';
import { DispatchSoon } from '../DispatchSoon';
import { NowCard } from '../Now';

const PER_PAGE = 12;

export function PassportScreen() {
  const data = useStore((s) => s.data);
  const p = data?.passport;
  const stamps = useMemo(
    () => liveStamps(data).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt)),
    [data],
  );
  if (!data || !p) return null;
  const showBanner = data.mode === 'local' && !data.prefs.bannerDismissed && stamps.length > 0;

  return (
    <>
      <header className="page-head">
        <h1 className="page-title">
          MY <em>passport</em>
        </h1>
        <p className="subtitle page-sub">Every film, series, book, game or album you finish gets a stamp.</p>
      </header>

      <NowCard />

      {showBanner ? (
        <div className="banner" role="region" aria-label="Save your passport">
          <p>Save your passport — create an account to sync it to your iPad.</p>
          <div className="banner-actions">
            <button type="button" className="btn btn-pri btn-sm" onClick={beginSaveAccount}>
              Create account
            </button>
            <button type="button" className="icon-btn" aria-label="Dismiss" onClick={() => setPref('bannerDismissed', true)}>
              <Icon name="close" />
            </button>
          </div>
        </div>
      ) : null}

      <div className="booklet">
        <HolderCard stamps={stamps} />
        <div className="booklet-right">
          <CanonPanel />
          <VisaPanel stamps={stamps} />
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <DispatchSoon compact />
      </div>
    </>
  );
}

export function HolderCard({ stamps }: { stamps: ReturnType<typeof liveStamps> }) {
  const p = useStore((s) => s.data?.passport);
  const custom = useStore((s) => s.data?.custom);
  if (!p) return null;
  const mins = stamps.reduce((acc, s) => acc + (getItem(s.itemId)?.mins ?? 0), 0);
  const year = new Date().getFullYear();
  void custom;
  return (
    <section className="holder" aria-label="Passport holder">
      <div className="holder-band">
        <span className="display">STAMP</span>
        <span className="mono">Media passport / Passeport culturel</span>
      </div>
      <div className="holder-top">
        <Seal className="holder-watermark" size={112} />
        <div className="photo" aria-hidden="true">
          <span>{initials(p.name)}</span>
        </div>
        <dl className="holder-fields">
          <div>
            <dt className="label">Holder</dt>
            <dd className="holder-name">{p.name}</dd>
          </div>
          <div>
            <dt className="label">Passport no.</dt>
            <dd>{p.passportNo}</dd>
          </div>
          <div>
            <dt className="label">Issued</dt>
            <dd>{formatDate(p.issued)}</dd>
          </div>
        </dl>
      </div>
      {p.affinities.length ? (
        <div className="holder-aff">
          {p.affinities.map((a) => (
            <span key={a} className="chip-italic">
              {a}
            </span>
          ))}
        </div>
      ) : null}
      <div className="holder-stats">
        <div>
          <b>{stamps.length}</b>
          <span className="label">Stamps</span>
        </div>
        <div>
          <b>{formatHours(mins)}</b>
          <span className="label">Hours</span>
        </div>
        <div>
          <b>{formatAvg(stamps.map((s) => s.rating))}</b>
          <span className="label">Avg rating</span>
        </div>
      </div>
      <div className="legend" aria-label="Ink legend">
        <span>
          <i style={{ background: 'var(--ink-home)' }} /> Home
        </span>
        <span>
          <i style={{ background: 'var(--ink-out)' }} /> Theater / out
        </span>
        <span>
          <i style={{ background: 'var(--ink-event)' }} /> Festival / event
        </span>
      </div>
      <Link href="/app/wrapped" className="wrapped-bar">
        <span className="display">{year} WRAPPED</span>
        <span className="mono">Open</span>
      </Link>
      <div className="holder-btns">
        <button type="button" className="btn" onClick={() => openSheet({ type: 'settings' })}>
          Settings
        </button>
        <Link href="/app/shield" className="btn">
          Shield: {presetName(p.shield.preset)}
        </Link>
      </div>
      <div className="holder-mrz">
        <MRZ name={p.name} passportNo={p.passportNo} stamps={stamps.length} issued={p.issued} />
      </div>
    </section>
  );
}

function CanonPanel() {
  const canon = useStore((s) => s.data?.canon.ids ?? []);
  const data = useStore((s) => s.data);
  void data;
  return (
    <section className="panel" aria-labelledby="canon-h">
      <div className="panel-head">
        <h2 className="h2" id="canon-h">
          Canonical nine
        </h2>
        <span className="label">{canon.length} of 9</span>
      </div>
      <p className="helper">The nine works that define your taste. Tap an empty slot to add one; tap a work to move or remove it.</p>
      <ol className="canon-grid">
        {Array.from({ length: 9 }, (_, i) => {
          const id = canon[i];
          const item = id ? getItem(id) : undefined;
          return (
            <li key={i}>
              {item ? (
                <button type="button" className="canon-slot" onClick={() => openSheet({ type: 'canon-slot', index: i })} aria-label={`${i + 1}. ${item.title} — move or remove`}>
                  <Poster item={item} tag={i + 1} />
                </button>
              ) : (
                <button type="button" className="canon-empty" onClick={() => openSheet({ type: 'canon-picker' })} aria-label={`Add to canonical nine, slot ${i + 1}`}>
                  +
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function VisaPanel({ stamps }: { stamps: ReturnType<typeof liveStamps> }) {
  const router = useRouter();
  const landing = useStore((s) => s.landing);
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(stamps.length / PER_PAGE));
  const cur = Math.min(page, pages - 1);
  const slice = stamps.slice(cur * PER_PAGE, cur * PER_PAGE + PER_PAGE);

  useEffect(() => {
    if (!landing) return;
    const idx = stamps.findIndex((s) => s.itemId === landing);
    if (idx >= 0) setPage(Math.floor(idx / PER_PAGE));
    const t = setTimeout(clearLanding, 900);
    return () => clearTimeout(t);
  }, [landing, stamps]);

  return (
    <section className="panel" aria-labelledby="visa-h">
      <div className="panel-head">
        <h2 className="h2" id="visa-h">
          Visa pages
        </h2>
        <span className="label">
          {stamps.length} {stamps.length === 1 ? 'stamp' : 'stamps'}
        </span>
      </div>
      {stamps.length === 0 ? (
        <div className="visa-empty">
          <p>No stamps yet. Find something you’ve watched, read or played and stamp it.</p>
          <button
            type="button"
            className="btn"
            onClick={() => {
              requestSearchFocus();
              router.push('/app/discover');
            }}
          >
            Find something
          </button>
        </div>
      ) : (
        <div className="visa-wrap">
          <ul className="visa-grid ruled" style={{ listStyle: 'none', margin: 0 }}>
            {slice.map((s) => {
              const item = getItem(s.itemId);
              if (!item) return null;
              return (
                <li key={s.itemId}>
                  <button
                    type="button"
                    className={`visa-stamp${landing === s.itemId ? ' is-landing' : ''}`}
                    onClick={() => openSheet({ type: 'record', id: s.itemId })}
                  >
                    <ItemStamp item={item} stamp={s} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <div className="visa-foot">
        {pages > 1 ? (
          <button type="button" className="icon-btn" aria-label="Previous page" disabled={cur === 0} onClick={() => setPage(cur - 1)}>
            <Icon name="chevron-left" />
          </button>
        ) : null}
        <span className="label" aria-live="polite">
          Page {pad2(cur + 1)} / {pad2(pages)}
        </span>
        {pages > 1 ? (
          <button type="button" className="icon-btn" aria-label="Next page" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>
            <Icon name="chevron-right" />
          </button>
        ) : null}
      </div>
    </section>
  );
}

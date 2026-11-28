'use client';

import Link from 'next/link';
import { useId, useRef, useState } from 'react';
import { countryName, KIND_LABEL } from '@/lib/catalog';
import { formatDate, todayISO } from '@/lib/format';
import { formatTime, LEVEL_NAMES, timeLabel, VECTOR_NAMES } from '@/lib/heat';
import { DEFAULT_SHIELD, gate } from '@/lib/shield';
import { getItem, removeStamp, reveal, stampItem, toggleCanon, toggleWishlist, useLook, useStore } from '@/lib/store/store';
import { MOODS, type Mood, type Place, type Rating } from '@/lib/types';
import { ItemStamp, placeLabel } from '../brand/Stamp';
import { Poster } from '../brand/Poster';
import { HeatBox, StarsInput } from '../ui/bits';
import { NowControl } from './Now';
import { SlideAction } from './SlideAction';
import { sfx } from '@/lib/sound';

export function RecordView({ id, onNavigate }: { id: string; onNavigate?: () => void }) {
  const item = useStore((s) => getItem(id, s));
  const rec = useStore((s) => s.data?.stamps[id]);
  const shield = useStore((s) => s.data?.passport?.shield ?? DEFAULT_SHIELD);
  const revealed = useStore((s) => !!s.revealed[id]);
  const inCanon = useStore((s) => !!s.data?.canon.ids.includes(id));
  const canonFull = useStore((s) => (s.data?.canon.ids.length ?? 0) >= 9);
  const saved = useStore((s) => !!s.data?.wishlist[id]?.on);

  if (!item) {
    return (
      <div className="empty-state">
        <p>This work isn’t in the catalog on this device.</p>
      </div>
    );
  }

  const live = rec && !rec.deleted ? rec : undefined;
  const g = gate(item, shield);
  const gatedView = g.gated && shield.action !== 'warn' && !live && !revealed;

  return (
    <article className="record" aria-label={item.title}>
      <div className="record-top">
        <Poster item={item} gated={gatedView} />
        <div>
          <h2 className="record-title">{item.title}</h2>
          {item.by ? (
            <p className="record-by italic">
              by {item.by}
            </p>
          ) : null}
          <dl className="facts">
            <div>
              <dt className="label">Type</dt>
              <dd>{KIND_LABEL[item.kind]}</dd>
            </div>
            <div>
              <dt className="label">Year</dt>
              <dd>{item.year ?? '—'}</dd>
            </div>
            <div>
              <dt className="label">{timeLabel(item.kind)}</dt>
              <dd>{formatTime(item)}</dd>
            </div>
            <div>
              <dt className="label">Country</dt>
              <dd>{item.cc ? countryName(item.cc) : '—'}</dd>
            </div>
          </dl>
        </div>
      </div>

      {gatedView ? (
        <div className="gate-card" role="region" aria-label="Comfort shield">
          <span className="label" style={{ color: 'var(--rose-d)' }}>
            Comfort shield
          </span>
          <h3>Above your comfort shield</h3>
          <ul>
            {g.over.map((i) => (
              <li key={i} className="warn-line">
                {VECTOR_NAMES[i]}: {LEVEL_NAMES[item.v![i]]}
              </li>
            ))}
          </ul>
          <div className="btn-row">
            <button type="button" className="btn btn-pri" onClick={() => reveal(item.id)}>
              Show details
            </button>
            <Link href="/app/shield" className="btn" onClick={onNavigate}>
              Change shield
            </Link>
          </div>
        </div>
      ) : (
        <>
          <p className="logline">{item.log}</p>
          {shield.action === 'warn' && g.gated ? (
            <p className="warn-line">Shield: {g.over.map((i) => VECTOR_NAMES[i]).join(', ')}</p>
          ) : null}
          <HeatBox item={item} limits={shield.limits} />

          {live ? (
            <div className="in-passport">
              <ItemStamp item={item} stamp={live} />
              <div style={{ display: 'grid', gap: 8 }}>
                <span className="label">In your passport</span>
                <span className="display">Stamped {formatDate(live.date)}</span>
                {inCanon ? (
                  <button type="button" className="btn btn-sm" aria-pressed="true" onClick={() => toggleCanon(item.id)}>
                    In your canon ✓
                  </button>
                ) : (
                  <button type="button" className="btn btn-sm" onClick={() => toggleCanon(item.id)} aria-disabled={canonFull || undefined}>
                    Add to canonical nine
                  </button>
                )}
              </div>
            </div>
          ) : null}

          <NowControl itemId={item.id} kind={item.kind} />

          <StampForm key={`${item.id}:${live?.updatedAt ?? 0}`} itemId={item.id} title={item.title} kind={item.kind} live={live} saved={saved} />
        </>
      )}
    </article>
  );
}

function StampForm({
  itemId,
  title,
  kind,
  live,
  saved,
}: {
  itemId: string;
  title: string;
  kind: Parameters<typeof placeLabel>[0];
  live?: { rating: Rating; tags: Mood[]; date: string; place: Place; note: string };
  saved: boolean;
}) {
  const [rating, setRating] = useState<Rating>(live?.rating ?? 0);
  const [tags, setTags] = useState<Mood[]>(live?.tags ?? []);
  const [date, setDate] = useState(live?.date ?? todayISO());
  const [place, setPlace] = useState<Place>(live?.place ?? 'home');
  const [note, setNote] = useState(live?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const errId = useId();
  const noteId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const look = useLook();
  const today = todayISO();

  /** Validate and stamp; false when something is missing (the Retro slider slides back). */
  const attempt = (): boolean => {
    let ok = true;
    if (!rating) {
      setError('Pick a rating from 1 to 5 stars to stamp this.');
      ok = false;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today) {
      setDateError('Pick the day you finished it, up to today.');
      ok = false;
    }
    if (!ok) {
      if (look !== 'retro') sfx('error');
      return false;
    }
    stampItem(itemId, { rating, tags, date, place, note: note.trim() });
    // Bring "In your passport" into view once the overlay clears.
    const scroller = formRef.current?.closest('.sheet-body, .split-pane');
    setTimeout(() => scroller?.scrollTo({ top: 0, behavior: 'smooth' }), 1300);
    return true;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    attempt();
  };

  return (
    <form ref={formRef} className="stamp-form" onSubmit={submit} noValidate>
      <h3>{live ? 'Change your stamp' : 'Your stamp'}</h3>

      <div className="form-section">
        <span className="label">Rating</span>
        <StarsInput
          value={rating}
          onChange={(r) => {
            setRating(r);
            if (r) setError(null);
          }}
          invalid={!!error}
          describedBy={error ? errId : undefined}
        />
        {error ? (
          <p id={errId} className="field-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <div className="form-section">
        <span className="label">How it felt</span>
        <div className="chips">
          {MOODS.map((m) => (
            <button
              key={m}
              type="button"
              className="chip"
              aria-pressed={tags.includes(m)}
              onClick={() => setTags((t) => (t.includes(m) ? t.filter((x) => x !== m) : [...t, m]))}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="form-grid form-grid-2">
        <label className="field">
          <span className="label">Date finished</span>
          <input
            className="input"
            type="date"
            value={date}
            max={today}
            onChange={(e) => {
              setDate(e.target.value);
              setDateError(null);
            }}
            aria-invalid={!!dateError || undefined}
          />
          {dateError ? <span className="field-error">{dateError}</span> : null}
        </label>
        <div className="field">
          <span className="label">Where</span>
          <div className="seg seg-block" role="group" aria-label="Where">
            {(['home', 'out', 'event'] as Place[]).map((p) => (
              <button key={p} type="button" aria-pressed={place === p} onClick={() => setPlace(p)}>
                {placeLabel(kind, p)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <label className="field">
        <span className="label">Note (optional)</span>
        <input
          className="input"
          type="text"
          value={note}
          maxLength={240}
          onChange={(e) => setNote(e.target.value)}
          placeholder="One line you’ll want to remember"
          aria-describedby={noteId}
          style={{ fontFamily: 'var(--f-body)', fontSize: 17 }}
        />
        <span id={noteId} className="label note-count">
          {note.length}/240
        </span>
      </label>

      {look === 'retro' ? (
        <SlideAction label={live ? 'Update stamp' : 'Stamp passport'} hint={live ? 'Slide to restamp' : 'Slide to stamp'} onAction={attempt} />
      ) : null}

      <div className="btn-row">
        {look === 'retro' ? null : (
          <button type="submit" className="btn btn-pri" style={{ flex: '1 1 200px' }}>
            {live ? 'Update stamp' : 'Stamp passport'}
          </button>
        )}
        {!live ? (
          <button type="button" className="btn" onClick={() => toggleWishlist(itemId)} aria-pressed={saved}>
            {saved ? 'Remove from wishlist' : 'Add to wishlist'}
          </button>
        ) : null}
        {live && !confirming ? (
          <button type="button" className="btn btn-danger" onClick={() => setConfirming(true)}>
            Remove stamp
          </button>
        ) : null}
      </div>

      {confirming ? (
        <div className="confirm" role="alertdialog" aria-label="Remove stamp">
          <p>
            Remove the {title} stamp from your passport? Your rating and note go with it.
          </p>
          <div className="btn-row">
            <button type="button" className="btn" onClick={() => setConfirming(false)} autoFocus>
              Keep it
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                setConfirming(false);
                removeStamp(itemId);
              }}
            >
              Remove stamp
            </button>
          </div>
        </div>
      ) : null}
    </form>
  );
}

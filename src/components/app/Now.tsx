'use client';

import { useId, useState } from 'react';
import { liveNow, NOW_TTL, nowPlaceholder, nowVerb, since } from '@/lib/now';
import { clearNow, getItem, openSheet, setNow, useStore } from '@/lib/store/store';
import type { Kind } from '@/lib/types';
import { Poster } from '../brand/Poster';

/** In a record: share that you're watching / reading / playing / listening to it right now. */
export function NowControl({ itemId, kind }: { itemId: string; kind: Kind }) {
  const now = useStore((s) => liveNow(s.data?.now));
  const mine = !!now && now.itemId === itemId;
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(mine ? now!.label : '');
  const [pct, setPct] = useState<number | null>(mine ? now!.pct : null);
  const labelId = useId();
  const verb = nowVerb(kind);
  const hours = NOW_TTL[kind] / 3_600_000;

  if (!open) {
    return (
      <div className="now-row">
        {mine ? (
          <p className="now-line">
            <span className="live-dot" aria-hidden="true" /> You’re {verb.toLowerCase()} this now
            {now!.label ? ` · ${now!.label}` : ''}
          </p>
        ) : null}
        <div className="btn-row">
          <button
            type="button"
            className="btn"
            onClick={() => {
              setLabel(mine ? now!.label : '');
              setPct(mine ? now!.pct : null);
              setOpen(true);
            }}
          >
            {mine ? 'Update status' : `I’m ${verb.toLowerCase()} this`}
          </button>
          {mine ? (
            <button type="button" className="btn" onClick={clearNow}>
              Stop
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <form
      className="now-form"
      onSubmit={(e) => {
        e.preventDefault();
        setNow(itemId, label, pct);
        setOpen(false);
      }}
    >
      <span className="label" style={{ color: 'var(--ink)' }}>
        <span className="live-dot" aria-hidden="true" /> {verb} now
      </span>
      <label className="field">
        <span className="label" id={labelId}>
          Where you are (optional)
        </span>
        <input className="input" value={label} maxLength={40} placeholder={nowPlaceholder(kind)} onChange={(e) => setLabel(e.target.value)} aria-labelledby={labelId} />
      </label>
      <label className="field">
        <span className="label">Progress {pct === null ? '(optional)' : `· ${pct}%`}</span>
        <input type="range" min={0} max={100} step={5} value={pct ?? 0} onChange={(e) => setPct(Number(e.target.value))} className="now-range" />
      </label>
      <p className="field-hint">People who follow you see this. It fades on its own after {hours} {hours === 1 ? 'hour' : 'hours'}, or when you stamp it.</p>
      <div className="btn-row">
        <button type="submit" className="btn btn-pri">
          Share status
        </button>
        <button type="button" className="btn" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/** On the passport: your live status, with Update and Stop. */
export function NowCard() {
  const now = useStore((s) => liveNow(s.data?.now));
  const item = useStore((s) => (now ? getItem(now.itemId, s) : undefined));
  if (!now || !item) return null;
  return (
    <section className="now-card" aria-label="Right now">
      <div className="now-poster">
        <Poster item={item} />
      </div>
      <div style={{ minWidth: 0 }}>
        <span className="label now-kicker">
          <span className="live-dot" aria-hidden="true" /> Now {nowVerb(item.kind).toLowerCase()}
        </span>
        <div className="now-title">{item.title}</div>
        <span className="label">{[now.label, `for ${since(now.startedAt)}`].filter(Boolean).join(' · ')}</span>
        {now.pct !== null ? (
          <span className="progress" role="progressbar" aria-valuenow={now.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${now.pct}% through`} style={{ display: 'block' }}>
            <i style={{ width: `${now.pct}%` }} />
          </span>
        ) : null}
      </div>
      <div className="now-actions">
        <button type="button" className="btn btn-sm" onClick={() => openSheet({ type: 'record', id: item.id })}>
          Update
        </button>
        <button type="button" className="btn btn-sm" onClick={clearNow}>
          Stop
        </button>
      </div>
    </section>
  );
}

/** One line for a person's live status: "● Watching Severance · S2 · E6". */
export function NowLine({ itemId, label }: { itemId: string; label: string }) {
  const item = useStore((s) => getItem(itemId, s));
  if (!item) return null;
  return (
    <p className="now-line">
      <span className="live-dot" aria-hidden="true" /> {nowVerb(item.kind)} {item.title}
      {label ? ` · ${label}` : ''}
    </p>
  );
}

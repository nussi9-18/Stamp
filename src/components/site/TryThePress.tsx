'use client';

import { useState } from 'react';
import { CATALOG_BY_ID, countryName } from '@/lib/catalog';
import { formatDate, todayISO } from '@/lib/format';
import type { Place } from '@/lib/types';
import { ItemStamp, placeLabel } from '../brand/Stamp';

const TICKETS: { id: string; rating: 1 | 2 | 3 | 4 | 5; place: Place }[] = [
  { id: 'chungking', rating: 5, place: 'home' },
  { id: 'perfect-days', rating: 5, place: 'out' },
  { id: 'wadjda', rating: 4, place: 'home' },
  { id: 'stalker', rating: 4, place: 'event' },
  { id: 'caramel', rating: 4, place: 'out' },
];

/** Fixed spots on "Visa page 01" (left %, top %, rotation handled by the stamp). */
const SPOTS = [
  { left: 4, top: 4 },
  { left: 36, top: 14 },
  { left: 64, top: 2 },
  { left: 12, top: 50 },
  { left: 52, top: 52 },
];

/** 7.4 Try the press — tap a ticket to slam its stamp onto the page; tap again to lift it off. */
export function TryThePress() {
  const [on, setOn] = useState<string[]>([]);
  const [lifting, setLifting] = useState<string | null>(null);
  const date = todayISO();

  const toggle = (id: string) => {
    if (on.includes(id)) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      setLifting(id);
      setTimeout(() => {
        setOn((cur) => cur.filter((x) => x !== id));
        setLifting(null);
      }, reduce ? 0 : 340);
      return;
    }
    setOn((cur) => [...cur, id]);
    try {
      navigator.vibrate?.([18, 40, 30]);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="press">
      <div className="tickets" role="group" aria-label="Tickets">
        {TICKETS.map((t) => {
          const item = CATALOG_BY_ID[t.id];
          const pressed = on.includes(t.id);
          return (
            <button key={t.id} type="button" className="ticket" aria-pressed={pressed} onClick={() => toggle(t.id)}>
              <span className="ticket-main">
                <span className="ticket-title">{item.title}</span>
                <span className="label">
                  {item.cc} / {placeLabel(item.kind, t.place)} / {'★'.repeat(t.rating)}
                </span>
              </span>
              <span className="ticket-stub">{pressed ? 'Lift' : 'Stamp'}</span>
            </button>
          );
        })}
      </div>
      <div className="visa-page">
        <div className="visa-page-head">
          <h3 className="display">Visa page 01</h3>
          <span className="label" aria-live="polite">
            {on.length} {on.length === 1 ? 'stamp' : 'stamps'}
          </span>
        </div>
        <div className="visa-sheet">
          {on.length === 0 ? <div className="visa-hint">Your stamps land here.</div> : null}
          {TICKETS.map((t, i) => {
            if (!on.includes(t.id)) return null;
            const item = CATALOG_BY_ID[t.id];
            return (
              <div key={t.id} className={`visa-spot${lifting === t.id ? ' lifting' : ''}`} style={{ left: `${SPOTS[i].left}%`, top: `${SPOTS[i].top}%` }}>
                <div className="stamp-wrap" style={{ '--r': '0deg' } as React.CSSProperties}>
                  <ItemStamp item={item} stamp={{ date, rating: t.rating, place: t.place }} />
                </div>
              </div>
            );
          })}
        </div>
        <p className="sr-only">
          {on.map((id) => `${CATALOG_BY_ID[id].title}, ${countryName(CATALOG_BY_ID[id].cc)}, ${formatDate(date)}`).join('; ')}
        </p>
      </div>
    </div>
  );
}

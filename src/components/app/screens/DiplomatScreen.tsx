'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { PEOPLE_BY_ID } from '@/lib/catalog';
import { askDiplomat } from '@/lib/ai/client';
import { intensityOf } from '@/lib/ai/diplomat';
import type { DiplomatResult } from '@/lib/ai/schemas';
import { LEVEL_NAMES } from '@/lib/heat';
import { hash } from '@/lib/hash';
import { shieldCeiling } from '@/lib/shield';
import { addCustomItem, getItem, getState, liveStamps, openSheet, toast, toggleWishlist, useStore } from '@/lib/store/store';
import type { Kind, Person } from '@/lib/types';
import { Icon } from '../../brand/Icon';
import { Poster } from '../../brand/Poster';
import { Seal } from '../../brand/Seal';
import { PageTitle } from '../PageTitle';

type Draft = { name: string; likes: string; favourites: string; ceiling: number };
const EMPTY: Draft = { name: '', likes: '', favourites: '', ceiling: 3 };

function fromMe(): Draft {
  const d = getState().data;
  const p = d?.passport;
  if (!d || !p) return { ...EMPTY };
  const top = liveStamps(d)
    .filter((s) => s.rating > 0)
    .sort((a, b) => b.rating - a.rating || (a.date < b.date ? 1 : -1))
    .slice(0, 3)
    .map((s) => getItem(s.itemId)?.title)
    .filter(Boolean)
    .join(', ');
  return { name: p.name, likes: p.affinities.join(', '), favourites: top, ceiling: shieldCeiling(p.shield) };
}

function fromPerson(p: Person): Draft {
  const rated = Object.entries(p.r).sort((a, b) => b[1] - a[1]);
  const favourites = rated
    .slice(0, 3)
    .map(([id]) => getItem(id)?.title)
    .filter(Boolean)
    .join(', ');
  const maxLevel = Math.max(1, ...rated.map(([id]) => intensityOf(getItem(id) ?? { v: null }) ?? 0));
  return { name: p.name, likes: p.bio, favourites, ceiling: Math.min(3, maxLevel) };
}

function verbFor(kind: Kind) {
  if (kind === 'book' || kind === 'manga') return 'read';
  if (kind === 'game') return 'play';
  if (kind === 'album') return 'listen to';
  return 'watch';
}

export function DiplomatScreen() {
  const params = useSearchParams();
  const withId = params?.get('with');
  const shieldLimits = useStore((s) => s.data?.passport?.shield.limits);
  const [people, setPeople] = useState<Draft[]>(() => [fromMe(), { ...EMPTY }]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiplomatResult | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!withId) return;
    const remote = getState().remote.people.find((p) => p.id === withId);
    const p = PEOPLE_BY_ID[withId] ?? remote;
    if (p) setPeople([fromMe(), fromPerson(p)]);
  }, [withId]);

  const update = (i: number, patch: Partial<Draft>) => {
    setPeople((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));
    setError(null);
  };

  const find = async (e: React.FormEvent) => {
    e.preventDefault();
    const valid = people.filter((p) => p.name.trim() && (p.likes.trim() || p.favourites.trim()));
    if (valid.length < 2) {
      setError('Add at least two people, each with a name and what they like or a favourite.');
      return;
    }
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setLoading(true);
    setResult(null);
    setNote(null);
    try {
      const out = await askDiplomat(
        valid.map((p) => ({ name: p.name.trim().slice(0, 60), likes: p.likes.trim().slice(0, 400), favourites: p.favourites.trim().slice(0, 400), ceiling: p.ceiling })),
        people[0] === valid[0] ? shieldLimits : undefined,
        ctrl.signal,
      );
      setResult(out.result);
      setNote(out.note);
    } catch {
      /* aborted */
    } finally {
      if (abort.current === ctrl) setLoading(false);
    }
  };

  return (
    <>
      <PageTitle
        retro={<>ONE PICK <em>for all of you</em></>}
        modern="Diplomat"
        sub="Add each person’s taste. The Diplomat finds one pick everyone will like, and says why."
        keepSub
      />

      <form onSubmit={find} noValidate style={{ display: 'grid', gap: 14 }}>
        <div className="people-forms">
          {people.map((p, i) => (
            <fieldset key={i} className="pcard" style={{ margin: 0 }}>
              <legend className="sr-only">Person {i + 1}</legend>
              <div className="pcard-head">
                <span className="label">Person {i + 1}</span>
                {i >= 2 ? (
                  <button type="button" className="btn-link" onClick={() => setPeople((ps) => ps.filter((_, j) => j !== i))}>
                    Remove
                  </button>
                ) : null}
              </div>
              <label className="field">
                <span className="label">Name</span>
                <input className="input" value={p.name} maxLength={60} onChange={(e) => update(i, { name: e.target.value })} />
              </label>
              <label className="field">
                <span className="label">What they like</span>
                <input className="input" value={p.likes} maxLength={400} onChange={(e) => update(i, { likes: e.target.value })} placeholder="Fast thrillers, sharp dialogue, no gore" style={{ fontFamily: 'var(--f-body)', fontSize: 17 }} />
              </label>
              <label className="field">
                <span className="label">Favourites</span>
                <input className="input" value={p.favourites} maxLength={400} onChange={(e) => update(i, { favourites: e.target.value })} placeholder="Two or three titles" style={{ fontFamily: 'var(--f-body)', fontSize: 17 }} />
              </label>
              <div className="field">
                <span className="label">Highest intensity they’re OK with</span>
                <div className="seg seg-block" role="group" aria-label={`Highest intensity for person ${i + 1}`}>
                  {LEVEL_NAMES.map((n, lvl) => (
                    <button key={n} type="button" aria-pressed={p.ceiling === lvl} onClick={() => update(i, { ceiling: lvl })}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </fieldset>
          ))}
        </div>
        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="btn-row">
          <button type="submit" className="btn btn-pri" disabled={loading}>
            Find our pick
          </button>
          {people.length < 4 ? (
            <button type="button" className="btn" onClick={() => setPeople((ps) => [...ps, { ...EMPTY }])}>
              <Icon name="plus" size={16} /> Add a person
            </button>
          ) : null}
        </div>
      </form>

      <div aria-live="polite" style={{ marginTop: 18, maxWidth: 760 }}>
        {loading ? (
          <div className="loading">
            <Seal size={96} className="seal-wobble" />
            <p className="label">Looking for common ground…</p>
          </div>
        ) : result ? (
          <Treaty result={result} note={note} people={people.map((p) => p.name)} />
        ) : null}
      </div>
    </>
  );
}

function Treaty({ result, note, people }: { result: DiplomatResult; note: string | null; people: string[] }) {
  const saved = useStore((s) => (result.pick?.catalog_id ? !!s.data?.wishlist[result.pick.catalog_id]?.on : false));
  if (!result.pick) {
    return (
      <div className="verdict">
        <div className="verdict-head">
          <span className="mono">No treaty yet</span>
        </div>
        <div className="verdict-section">
          {note ? <p className="inline-note">{note}</p> : null}
          <p>{result.friction}</p>
        </div>
      </div>
    );
  }
  const pick = result.pick;
  const item = pick.catalog_id ? getItem(pick.catalog_id) : undefined;
  const posterItem = item ?? { id: `ai-${pick.title}`, title: pick.title, year: pick.year, by: pick.creator, kind: pick.kind };
  const no = 100 + (hash(pick.title + people.join('|')) % 900);

  const ensureItem = () => {
    if (item) return item.id;
    return addCustomItem({ title: pick.title, kind: pick.kind, by: pick.creator, year: pick.year }).id;
  };

  return (
    <article className="treaty" aria-label="Treaty pass">
      <div className="verdict-head">
        <span className="display" style={{ fontSize: 22 }}>
          Treaty pass № {no}
        </span>
        <span className="mono">{result.concordance}% agreement</span>
      </div>
      <Seal className="treaty-seal" size={96} />
      {note ? (
        <div className="verdict-section">
          <p className="inline-note">{note}</p>
        </div>
      ) : null}
      <div className="treaty-pick">
        <Poster item={posterItem} />
        <div style={{ minWidth: 0 }}>
          <span className="label">You’ll all {verbFor(pick.kind)}</span>
          <div className="verdict-title">{pick.title}</div>
          <div className="italic body2">{[pick.creator, pick.year].filter(Boolean).join(', ')}</div>
        </div>
      </div>
      <div className="verdict-section">
        <span className="label">Where you differ</span>
        <p>{result.friction}</p>
      </div>
      <div className="verdict-section">
        <ul className="reasons">
          {result.reasons.map((r, i) => (
            <li key={i}>
              <span className="label">{r.name}</span>
              <p>{r.why}</p>
            </li>
          ))}
        </ul>
        <div className="btn-row">
          <button type="button" className="btn btn-pri" onClick={() => openSheet({ type: 'record', id: ensureItem() })}>
            {item ? 'Open' : 'Add to my list'}
          </button>
          <button
            type="button"
            className="btn"
            aria-pressed={saved}
            onClick={() => {
              const id = ensureItem();
              const on = getState().data?.wishlist[id]?.on;
              if (!on) toggleWishlist(id);
              else toast('Already on your wishlist');
            }}
          >
            <Icon name="bookmark" size={16} /> Save to wishlist
          </button>
        </div>
      </div>
      {result.alternates.length ? (
        <div className="verdict-section">
          <span className="label">Backup picks</span>
          <ul className="alt-list">
            {result.alternates.map((a, i) => (
              <li key={i}>
                <span>
                  <span className="display" style={{ fontSize: 18 }}>
                    {a.title}
                  </span>{' '}
                  <span className="italic body2">{[a.creator, a.year].filter(Boolean).join(', ')}</span>
                </span>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    const id = a.catalog_id && getItem(a.catalog_id) ? a.catalog_id : addCustomItem({ title: a.title, kind: 'film', by: a.creator, year: a.year }).id;
                    openSheet({ type: 'record', id });
                  }}
                >
                  Open
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { FEED, KIND_LABEL, LIVE, PEOPLE_BY_ID } from '@/lib/catalog';
import { LEVEL_NAMES, VECTOR_NAMES } from '@/lib/heat';
import { DEFAULT_SHIELD, gate } from '@/lib/shield';
import { getItem, openSheet, reveal, toggleLike, toggleWishlist, useStore } from '@/lib/store/store';
import type { Dispatch, Person } from '@/lib/types';
import { Icon } from '../../brand/Icon';
import { Poster } from '../../brand/Poster';
import { ItemStamp, placeLabel } from '../../brand/Stamp';
import { Avatar } from '../../ui/bits';

type Filter = 'all' | 'reviews' | 'five' | 'heat';

export function FeedScreen() {
  const follows = useStore((s) => s.data?.follows);
  const likes = useStore((s) => s.data?.likes);
  const wishlist = useStore((s) => s.data?.wishlist);
  const shield = useStore((s) => s.data?.passport?.shield ?? DEFAULT_SHIELD);
  const revealed = useStore((s) => s.revealed);
  const remote = useStore((s) => s.remote);
  const [filter, setFilter] = useState<Filter>('all');

  const people = useMemo(() => {
    const map: Record<string, Person> = { ...PEOPLE_BY_ID };
    for (const p of remote.people) map[p.id] = p;
    return map;
  }, [remote.people]);

  const followed = (id: string) => !!follows?.[id]?.on;
  const all: Dispatch[] = useMemo(
    () => [...remote.dispatches, ...FEED].filter((d) => followed(d.p)).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [remote.dispatches, follows],
  );
  const live = LIVE.filter((l) => followed(l.p));
  const anyFollow = Object.values(follows ?? {}).some((f) => f.on);

  const withGate = all.map((d) => {
    const item = getItem(d.item);
    return { d, item, g: item ? gate(item, shield) : { gated: false, over: [] as number[], action: shield.action } };
  });
  const filtered = withGate.filter(({ d, g }) => {
    if (filter === 'reviews') return !!d.note;
    if (filter === 'five') return d.rating === 5;
    if (filter === 'heat') return g.gated;
    return true;
  });
  const hiddenByShield = shield.action === 'hide' && filter !== 'heat' ? filtered.filter((x) => x.g.gated) : [];
  const visible = shield.action === 'hide' && filter !== 'heat' ? filtered.filter((x) => !x.g.gated) : filtered;

  return (
    <>
      <header className="page-head">
        <h1 className="page-title">
          FRIENDS’ <em>dispatches</em>
        </h1>
        <p className="subtitle page-sub">What the people you follow stamped this week.</p>
      </header>

      {FEED.some((d) => followed(d.p)) ? <p className="label sample-note">Sample dispatches — these citizens are fictional until real friends join.</p> : null}

      {live.length ? (
        <section className="live" aria-label="Right now">
          <div className="live-head">
            <span className="live-dot" aria-hidden="true" />
            <span className="label" style={{ color: 'var(--ink)' }}>
              Right now · {live.length} live
            </span>
          </div>
          <div className="live-strip">
            {live.map((l) => {
              const item = getItem(l.item);
              const p = people[l.p];
              if (!item || !p) return null;
              return (
                <button key={l.p} type="button" className="live-card" onClick={() => openSheet({ type: 'record', id: item.id })}>
                  <Poster item={item} />
                  <span style={{ minWidth: 0 }}>
                    <span className="label" style={{ display: 'block' }}>
                      {p.name.split(' ')[0]} · {l.label}
                    </span>
                    <span className="display" style={{ display: 'block', marginTop: 6 }}>
                      {item.title}
                    </span>
                    <span className="progress" role="progressbar" aria-valuenow={l.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${l.pct}% through`} style={{ display: 'block' }}>
                      <i style={{ width: `${l.pct}%` }} />
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="chips" role="group" aria-label="Filter">
        {(
          [
            ['all', 'All activity'],
            ['reviews', 'Reviews'],
            ['five', '5 stars'],
            ['heat', 'Heat alerts'],
          ] as [Filter, string][]
        ).map(([f, label]) => (
          <button key={f} type="button" className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {label}
          </button>
        ))}
      </div>

      {hiddenByShield.length ? (
        <p className="label" style={{ marginTop: 14 }}>
          {hiddenByShield.length} {hiddenByShield.length === 1 ? 'dispatch' : 'dispatches'} hidden by your shield
        </p>
      ) : null}

      {!anyFollow ? (
        <div className="empty-state" style={{ marginTop: 14 }}>
          <p>Follow someone in People to see what they stamp here.</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 14 }}>
          <p>{filter === 'heat' ? 'Nothing in your feed goes past your comfort shield.' : 'No dispatches match this filter.'}</p>
        </div>
      ) : (
        <div className="feed-list">
          {visible.map(({ d, item, g }) => {
            const p = people[d.p];
            if (!item || !p) return null;
            const covered = g.gated && shield.action === 'blur' && !revealed[`d:${d.id}`];
            const liked = !!likes?.[d.id]?.on;
            const onWish = !!wishlist?.[item.id]?.on;
            return (
              <article key={d.id} className="dispatch">
                <header className="dispatch-head">
                  <Avatar name={p.name} color={p.av} size={40} />
                  <div className="dispatch-who">
                    <button type="button" className="dispatch-name" onClick={() => openSheet({ type: 'person', id: p.id })}>
                      {p.name}
                    </button>
                    <span className="label">
                      @{p.handle} · {placeLabel(item.kind, d.place)} · {d.ago}
                    </span>
                  </div>
                </header>
                <div className="dispatch-body">
                  <div style={{ minWidth: 0 }}>
                    <button type="button" className="dispatch-title" onClick={() => openSheet({ type: 'record', id: item.id })}>
                      {item.title}
                    </button>
                    <div className="label" style={{ marginTop: 6 }}>
                      {KIND_LABEL[item.kind]} · {[item.by, item.year].filter(Boolean).join(', ')}
                    </div>
                    {d.note ? <p className="dispatch-note italic">“{d.note}”</p> : null}
                    {g.gated && shield.action === 'warn' ? (
                      <p className="warn-line" style={{ marginTop: 8 }}>
                        Shield warning: {g.over.map((i) => VECTOR_NAMES[i]).join(', ')}
                      </p>
                    ) : null}
                  </div>
                  <ItemStamp item={item} stamp={{ date: d.date, rating: d.rating as 0, place: d.place }} />
                  {covered ? (
                    <div className="heat-alert">
                      <span className="mono">
                        Heat alert — {g.over.map((i) => `${VECTOR_NAMES[i]}: ${LEVEL_NAMES[item.v![i]]}`).join(' · ')}
                      </span>
                      <button type="button" className="btn btn-sm" style={{ borderColor: 'currentColor', color: 'inherit' }} onClick={() => reveal(`d:${d.id}`)}>
                        Show anyway
                      </button>
                    </div>
                  ) : null}
                </div>
                <footer className="dispatch-foot">
                  <button type="button" className="btn-link" aria-pressed={liked} onClick={() => toggleLike(d.id)}>
                    <Icon name={liked ? 'heart-fill' : 'heart'} size={16} /> {liked ? 'Liked' : 'Like'}
                  </button>
                  <button type="button" className="btn-link" aria-pressed={onWish} onClick={() => toggleWishlist(item.id)}>
                    <Icon name={onWish ? 'bookmark-fill' : 'bookmark'} size={16} /> {onWish ? 'On wishlist' : 'Wishlist'}
                  </button>
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

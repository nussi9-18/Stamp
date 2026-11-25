'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { KIND_LABEL, KINDS } from '@/lib/catalog';
import { formatTime } from '@/lib/heat';
import { gate, presetName, overNames, DEFAULT_SHIELD } from '@/lib/shield';
import { norm, searchItems } from '@/lib/search';
import { allItems, onIds, openSheet, rememberWorld, useStore } from '@/lib/store/store';
import type { Item, Kind } from '@/lib/types';
import { Icon } from '../../brand/Icon';
import { Poster } from '../../brand/Poster';
import { Seal } from '../../brand/Seal';
import { AiLabel, HeatChip } from '../../ui/bits';
import { RecordView } from '../RecordView';

function useWide(min = 1024) {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${min}px)`);
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [min]);
  return wide;
}

/** Lazy-render long lists in chunks of 60 as the end comes into view. */
function useIncremental<T>(list: T[], step = 60) {
  const [n, setN] = useState(step);
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => setN(step), [list, step]);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || n >= list.length) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setN((x) => x + step);
    }, { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [n, list.length, step]);
  return { visible: list.slice(0, n), sentinel, more: n < list.length };
}

/** Debounced search of the world archives through /api/media/search. */
function useWorldSearch(q: string, kind?: Kind) {
  const [state, setState] = useState<{ items: Item[]; loading: boolean; offline: boolean }>({ items: [], loading: false, offline: false });
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setState({ items: [], loading: false, offline: false });
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setState({ items: [], loading: false, offline: true });
      return;
    }
    const ctrl = new AbortController();
    setState((s) => ({ ...s, loading: true, offline: false }));
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/media/search?q=${encodeURIComponent(term)}${kind ? `&kind=${kind}` : ''}`, { signal: ctrl.signal });
        const body = res.ok ? ((await res.json()) as { items: Item[] }) : { items: [] };
        rememberWorld(body.items);
        setState({ items: body.items, loading: false, offline: false });
      } catch (e) {
        if ((e as DOMException)?.name !== 'AbortError') setState({ items: [], loading: false, offline: !navigator.onLine });
      }
    }, 400);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, kind]);
  return state;
}

export function DiscoverScreen() {
  const data = useStore((s) => s.data);
  const shield = useStore((s) => s.data?.passport?.shield ?? DEFAULT_SHIELD);
  const revealed = useStore((s) => s.revealed);
  const focusReq = useStore((s) => s.searchFocus);
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<Kind | 'all'>('all');
  const [mode, setMode] = useState<'all' | 'wish'>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const wide = useWide();

  useEffect(() => {
    if (focusReq) {
      inputRef.current?.focus();
      inputRef.current?.scrollIntoView({ block: 'center' });
    }
  }, [focusReq]);

  const wishIds = useMemo(() => (data ? onIds(data.wishlist) : []), [data]);
  const items = useMemo(() => allItems(), [data]);

  const { shown, hidden } = useMemo(() => {
    let list: Item[] = items;
    if (mode === 'wish') {
      const set = new Set(wishIds);
      list = list.filter((i) => set.has(i.id));
    }
    if (kind !== 'all') list = list.filter((i) => i.kind === kind);
    list = searchItems(list, q);
    let hiddenCount = 0;
    if (shield.action === 'hide') {
      list = list.filter((i) => {
        const own = data?.stamps[i.id] && !data.stamps[i.id].deleted;
        const g = gate(i, shield);
        if (g.gated && !own) {
          hiddenCount++;
          return false;
        }
        return true;
      });
    }
    return { shown: list, hidden: hiddenCount };
  }, [items, mode, wishIds, kind, q, shield, data]);

  const { visible, sentinel, more } = useIncremental(shown);

  const worldOn = mode === 'all' && q.trim().length >= 2;
  const world = useWorldSearch(worldOn ? q : '', kind === 'all' ? undefined : kind);
  const worldItems = useMemo(() => {
    const local = new Set(items.map((i) => `${i.kind}|${norm(i.title)}|${i.year ?? ''}`));
    return world.items.filter((i) => !local.has(`${i.kind}|${norm(i.title)}|${i.year ?? ''}`) && !items.some((x) => x.id === i.id));
  }, [world.items, items]);

  const open = (id: string) => {
    if (wide) setSelected(id);
    else openSheet({ type: 'record', id });
  };

  const renderRow = (item: Item) => {
    const rec = data?.stamps[item.id];
    const stamped = !!rec && !rec.deleted;
    const saved = !!data?.wishlist[item.id]?.on;
    const g = gate(item, shield);
    const blurred = g.gated && shield.action === 'blur' && !stamped && !revealed[item.id];
    return (
      <li key={item.id}>
        <button type="button" className="drow" onClick={() => open(item.id)} aria-current={wide && selected === item.id ? 'true' : undefined}>
          <Poster item={item} gated={blurred} />
          <span style={{ minWidth: 0 }}>
            <span className="drow-title" style={{ display: 'block' }}>
              {item.title}
            </span>
            <span className="drow-by italic" style={{ display: 'block' }}>
              {[item.by, item.year].filter(Boolean).join(', ')}
            </span>
            <span className="drow-meta">
              <span className="tag">{KIND_LABEL[item.kind]}</span>
              {item.mins ? <span className="mono">{formatTime(item)}</span> : null}
              <HeatChip item={item} />
              {g.gated && shield.action === 'warn' ? <span className="warn-line">Shield: {overNames(item, shield.limits).join(', ')}</span> : null}
            </span>
          </span>
          <span>{stamped ? <span className="badge-stamped">Stamped</span> : saved ? <span className="badge-saved">Saved</span> : null}</span>
        </button>
      </li>
    );
  };

  return (
    <>
      <header className="page-head">
        <h1 className="page-title">
          FIND &amp; <em>stamp</em>
        </h1>
        <p className="subtitle page-sub">Films, series, books, manga, games and albums.</p>
      </header>

      <div className="tools">
        <Link href="/app/archivist" className="tool-card">
          <AiLabel />
          <h2>Forgot the title?</h2>
          <p>Describe a scene and the Archivist finds it.</p>
        </Link>
        <Link href="/app/diplomat" className="tool-card">
          <AiLabel />
          <h2>Watching with someone?</h2>
          <p>The Diplomat finds one pick you’ll both like.</p>
        </Link>
      </div>

      <div className="split">
        <div style={{ minWidth: 0 }}>
          <div className="search" role="search">
            <Icon name="discover" />
            <label htmlFor="discover-q" className="sr-only">
              Search films, series, books, manga, games and albums
            </label>
            <input
              id="discover-q"
              ref={inputRef}
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Try “Kiarostami” or “manga”"
              autoComplete="off"
              enterKeyHint="search"
            />
            {q ? (
              <button type="button" className="icon-btn" aria-label="Clear search" onClick={() => { setQ(''); inputRef.current?.focus(); }}>
                <Icon name="close" />
              </button>
            ) : null}
          </div>

          <div className="chip-row" role="group" aria-label="Type">
            <button type="button" className="chip" aria-pressed={kind === 'all'} onClick={() => setKind('all')}>
              All
            </button>
            {KINDS.map((k) => (
              <button key={k} type="button" className="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>

          <div className="discover-bar">
            <div className="seg" role="group" aria-label="List">
              <button type="button" aria-pressed={mode === 'all'} onClick={() => setMode('all')}>
                Everything
              </button>
              <button type="button" aria-pressed={mode === 'wish'} onClick={() => setMode('wish')}>
                Wishlist ({wishIds.length})
              </button>
            </div>
            <Link href="/app/shield" className="chip chip-link">
              <Icon name="shield" size={15} /> Shield: {presetName(shield.preset)}
            </Link>
          </div>

          <div className="result-count">
            <span className="label" aria-live="polite">
              {shown.length} {worldOn ? 'in the catalog' : shown.length === 1 ? 'result' : 'results'}
            </span>
            {hidden > 0 ? (
              <span className="label">
                {hidden} hidden by your shield ·{' '}
                <Link href="/app/shield" className="btn-link" style={{ display: 'inline-flex' }}>
                  Change
                </Link>
              </span>
            ) : null}
          </div>

          {shown.length === 0 && !world.loading && worldItems.length === 0 ? (
            <div className="empty-state" style={{ justifyItems: 'start', textAlign: 'left' }}>
              {mode === 'wish' && !q ? (
                <p>Your wishlist is empty. Save something from its record and it lands here.</p>
              ) : (
                <p>
                  Nothing matches “{q || KIND_LABEL[kind as Kind] || ''}”. Try a director, a year or a country — or add it yourself.
                </p>
              )}
              <button type="button" className="btn btn-pri" onClick={() => openSheet({ type: 'add-own', title: q || undefined })}>
                Add it yourself
              </button>
            </div>
          ) : (
            <>
              {shown.length ? <ul className="dlist">{visible.map(renderRow)}</ul> : null}
              {more ? <div ref={sentinel} style={{ height: 1 }} /> : null}
              {worldOn ? (
                <section aria-label="From the world archive" style={{ marginTop: shown.length ? 26 : 0 }}>
                  <div className="result-count">
                    <span className="label" style={{ color: 'var(--ink)' }}>
                      From the world archive
                    </span>
                    <span className="label" aria-live="polite">
                      {world.loading ? 'Searching the archives…' : world.offline ? 'Needs a connection' : `${worldItems.length} ${worldItems.length === 1 ? 'result' : 'results'}`}
                    </span>
                  </div>
                  {worldItems.length ? <ul className="dlist">{worldItems.map(renderRow)}</ul> : null}
                </section>
              ) : null}
              <div className="list-end">
                <p>Can’t find it?</p>
                <button type="button" className="btn" onClick={() => openSheet({ type: 'add-own', title: q || undefined })}>
                  <Icon name="plus" size={16} /> Add it yourself
                </button>
              </div>
            </>
          )}
        </div>

        <aside className="split-pane" aria-label="Record">
          {selected ? (
            <div className="split-pane-inner">
              <RecordView key={selected} id={selected} />
            </div>
          ) : (
            <div className="pane-empty">
              <Seal size={120} />
              <p>Pick something from the list to see its details and stamp it.</p>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

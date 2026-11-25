'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useMemo, useRef, useState } from 'react';
import { CATALOG_BY_ID, KIND_LABEL, KINDS, LIVE } from '@/lib/catalog';
import { firstName, formatDate } from '@/lib/format';
import { LB_EMPTY, planImport, readLetterboxd } from '@/lib/letterboxd';
import { tasteMatch } from '@/lib/match';
import { presetName } from '@/lib/shield';
import {
  addCustomItem,
  addSampleStamps,
  allItems,
  clearAllStamps,
  closeAllSheets,
  closeSheet,
  getItem,
  getState,
  importStamps,
  liveStamps,
  moveCanon,
  openSheet,
  replaceSheet,
  requestSearchFocus,
  setCanon,
  setPref,
  toast,
  toggleCanon,
  toggleFollow,
  updatePassport,
  useStore,
  type SheetSpec,
} from '@/lib/store/store';
import { beginSaveAccount, beginSignOut } from '@/lib/auth/session';
import { AFFINITIES, type Item, type Person } from '@/lib/types';
import { Icon } from '../../brand/Icon';
import { MatchRing } from '../../brand/MatchRing';
import { MRZ } from '../../brand/MRZ';
import { Poster } from '../../brand/Poster';
import { Avatar, StarsText } from '../../ui/bits';
import { DispatchSoon } from '../DispatchSoon';
import { LookChoice, ModeChoice } from '../LookPicker';
import { NowLine } from '../Now';

/* ── Settings (5.11) ─────────────────────────────────────────────────────── */

export function SettingsSheet() {
  const d = useStore((s) => s.data);
  const syncState = useStore((s) => s.syncState);
  const p = d?.passport;
  const [name, setName] = useState(p?.name ?? '');
  const [aff, setAff] = useState<string[]>(p?.affinities ?? []);
  const [nameErr, setNameErr] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);
  const [lbError, setLbError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const nameId = useId();
  const lbId = useId();
  const n = liveStamps(d).length;
  if (!d || !p) return null;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setNameErr('Type the name to print on your passport.');
      return;
    }
    updatePassport({ name: name.trim().slice(0, 40), affinities: aff });
    toast('Passport saved');
  };

  const onFile = async (file: File | undefined) => {
    setLbError(null);
    if (!file) return;
    let text = '';
    try {
      text = await file.text();
    } catch {
      setLbError(LB_EMPTY);
      return;
    }
    const res = readLetterboxd(text);
    if ('error' in res) {
      setLbError(res.error);
      return;
    }
    const st = getState();
    const stamped = new Set(liveStamps(st.data).map((s) => s.itemId));
    const plan = planImport(res.rows, allItems(st), stamped);
    importStamps(plan.stamps, plan.newItems);
    const a = plan.stamps.length;
    const b = plan.newItems.length;
    toast(`Imported ${a} ${a === 1 ? 'stamp' : 'stamps'} (${b} new ${b === 1 ? 'title' : 'titles'})`);
    if (fileRef.current) fileRef.current.value = '';
  };

  const syncLine =
    d.mode === 'account'
      ? syncState === 'synced'
        ? 'Synced'
        : syncState === 'syncing'
          ? 'Syncing…'
          : syncState === 'offline'
            ? 'Saved on this device — syncs when you’re back online'
            : syncState === 'error'
              ? 'Saved on this device — sync will retry'
              : 'Saved on this device'
      : 'Saved on this device';

  return (
    <div className="settings">
      <form className="settings-group" onSubmit={save} noValidate>
        <label className="field">
          <span className="label">Name on passport</span>
          <input
            id={nameId}
            className="input"
            value={name}
            maxLength={40}
            autoComplete="name"
            onChange={(e) => {
              setName(e.target.value);
              if (e.target.value.trim()) setNameErr(null);
            }}
            onBlur={() => !name.trim() && setNameErr('Type the name to print on your passport.')}
            aria-invalid={!!nameErr || undefined}
          />
          {nameErr ? <span className="field-error">{nameErr}</span> : null}
        </label>
        <div className="field">
          <span className="label">Your tastes (up to 3)</span>
          <div className="chips">
            {AFFINITIES.map((a) => (
              <button
                key={a}
                type="button"
                className="chip"
                aria-pressed={aff.includes(a)}
                onClick={() => setAff((cur) => (cur.includes(a) ? cur.filter((x) => x !== a) : cur.length >= 3 ? cur : [...cur, a]))}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
        <button type="submit" className="btn btn-pri">
          Save
        </button>
      </form>

      <div className="settings-group">
        <span className="label">Look</span>
        <LookChoice />
        <ModeChoice />
        <span className="label">Stamp sound</span>
        <div className="seg seg-block" role="group" aria-label="Stamp sound">
          <button type="button" aria-pressed={!d.prefs.sound} onClick={() => setPref('sound', false)}>
            Off
          </button>
          <button type="button" aria-pressed={d.prefs.sound} onClick={() => setPref('sound', true)}>
            Soft thunk
          </button>
        </div>
        <Link href="/app/shield" className="btn" onClick={closeAllSheets}>
          <Icon name="shield" size={16} /> Comfort shield: {presetName(p.shield.preset)}
        </Link>
      </div>

      <div className="settings-group">
        <span className="label">Import from Letterboxd</span>
        <p className="body2" id={lbId}>
          Export your data on letterboxd.com (Settings → Data → Export), unzip it, then pick diary.csv or ratings.csv.
        </p>
        <label className="btn" style={{ cursor: 'pointer' }}>
          <Icon name="upload" size={16} /> Pick a CSV file
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            aria-describedby={lbId}
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </label>
        {lbError ? (
          <p className="field-error" role="alert">
            {lbError}
          </p>
        ) : null}
      </div>

      <div className="settings-group">
        <button type="button" className="btn" onClick={() => replaceSheet({ type: 'manual' })}>
          <Icon name="book" size={16} /> How to use STAMP
        </button>
        <button type="button" className="btn" onClick={addSampleStamps}>
          Add sample stamps
        </button>
        {!confirmClear ? (
          <button type="button" className="btn btn-danger" onClick={() => setConfirmClear(true)} disabled={n === 0}>
            Clear all stamps
          </button>
        ) : (
          <div className="confirm" role="alertdialog" aria-label="Clear all stamps">
            <p>Remove all {n} stamps from your passport? This can’t be undone.</p>
            <div className="btn-row">
              <button type="button" className="btn" onClick={() => setConfirmClear(false)} autoFocus>
                Keep them
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  clearAllStamps();
                  setConfirmClear(false);
                }}
              >
                Clear {n} stamps
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="settings-group">
        <DispatchSoon />
      </div>

      <div className="settings-group">
        <span className="label">Account</span>
        {d.mode === 'local' ? (
          <>
            <p className="body2">Local passport — no account. Save your passport — create an account to sync it to your iPad.</p>
            <button type="button" className="btn btn-rose" onClick={beginSaveAccount}>
              Save my passport
            </button>
          </>
        ) : (
          <p className="body2">
            {d.email ?? 'Signed in'}
            {d.mode === 'demo' ? ' · demo account on this device' : ''}
          </p>
        )}
        {!confirmOut ? (
          <button type="button" className="btn" onClick={() => setConfirmOut(true)}>
            Sign out
          </button>
        ) : (
          <div className="confirm" role="alertdialog" aria-label="Sign out">
            <p>
              {d.mode === 'local'
                ? 'Sign out of this passport? It stays on this device; continue without an account to open it again.'
                : 'Sign out of STAMP on this device? Your passport stays in your account.'}
            </p>
            <div className="btn-row">
              <button type="button" className="btn" onClick={() => setConfirmOut(false)} autoFocus>
                Stay signed in
              </button>
              <button type="button" className="btn btn-pri" onClick={beginSignOut}>
                Sign out
              </button>
            </div>
          </div>
        )}
        <p className="label" role="status" aria-live="polite">
          {syncLine}
        </p>
      </div>
    </div>
  );
}

/* ── Field manual (5.13) ─────────────────────────────────────────────────── */

export function ManualSheet() {
  const router = useRouter();
  const items = [
    ['Stamp what you finish', 'Search, or describe a scene to the Archivist. Rate it, pick how it felt, and press it into your passport.'],
    ['Set your comfort shield', 'Choose your limits for eight kinds of content. Anything past them is hidden, blurred or flagged.'],
    ['Find your kin', 'People shows whose ratings match yours. The Diplomat finds one pick for a group.'],
    ['Open your Wrapped', 'Your year in stamps: hours, countries, creators, and how it compares to last year.'],
  ];
  return (
    <div className="manual">
      <h2>How it works</h2>
      <ol>
        {items.map(([t, d], i) => (
          <li key={t}>
            <span className="manual-num" aria-hidden="true">
              {i + 1}
            </span>
            <div>
              <strong>{t}</strong>
              <p className="body2">{d}</p>
            </div>
          </li>
        ))}
      </ol>
      <button
        type="button"
        className="btn btn-pri btn-block"
        data-autofocus
        onClick={() => {
          setPref('manualSeen', true);
          closeAllSheets();
          requestSearchFocus();
          router.push('/app/discover');
        }}
      >
        Start stamping
      </button>
    </div>
  );
}

/* ── Canon picker / slot ─────────────────────────────────────────────────── */

export function CanonPickerSheet() {
  const router = useRouter();
  const data = useStore((s) => s.data);
  const canon = useStore((s) => s.data?.canon.ids ?? []);
  const stamps = useMemo(
    () => liveStamps(data).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt)),
    [data],
  );
  if (!stamps.length) {
    return (
      <div className="empty-state">
        <p>Your canon is picked from your passport. Stamp something first.</p>
        <button
          type="button"
          className="btn btn-pri"
          onClick={() => {
            closeAllSheets();
            requestSearchFocus();
            router.push('/app/discover');
          }}
        >
          Find something
        </button>
      </div>
    );
  }
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <p className="body2">
        Pick up to nine works from your passport. {canon.length} of 9 chosen.
      </p>
      <ul className="picker">
        {stamps.map((s) => {
          const item = getItem(s.itemId);
          if (!item) return null;
          const pos = canon.indexOf(s.itemId);
          return (
            <li key={s.itemId}>
              <button type="button" role="checkbox" aria-checked={pos >= 0} className="pick-row" onClick={() => toggleCanon(s.itemId)}>
                <span className="pick-box" aria-hidden="true">
                  {pos >= 0 ? pos + 1 : ''}
                </span>
                <Poster item={item} />
                <span>
                  <span className="display" style={{ fontSize: 17, display: 'block' }}>
                    {item.title}
                  </span>
                  <span className="label">
                    {[item.by, item.year].filter(Boolean).join(', ')}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <button type="button" className="btn btn-pri" onClick={closeSheet}>
        Done
      </button>
    </div>
  );
}

export function CanonSlotSheet({ index }: { index: number }) {
  const canon = useStore((s) => s.data?.canon.ids ?? []);
  const id = canon[index];
  const item = id ? getItem(id) : undefined;
  if (!id || !item) return <p>This slot is empty.</p>;
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 14, alignItems: 'center' }}>
        <Poster item={item} tag={index + 1} />
        <div>
          <div className="display" style={{ fontSize: 24 }}>
            {item.title}
          </div>
          <div className="italic body2">{item.by}</div>
        </div>
      </div>
      <div className="menu-list">
        <button type="button" className="btn" disabled={index === 0} onClick={() => { moveCanon(index, -1); replaceSheet({ type: 'canon-slot', index: index - 1 }); }}>
          <Icon name="chevron-left" size={16} /> Move earlier
        </button>
        <button type="button" className="btn" disabled={index >= canon.length - 1} onClick={() => { moveCanon(index, 1); replaceSheet({ type: 'canon-slot', index: index + 1 }); }}>
          <Icon name="chevron-right" size={16} /> Move later
        </button>
        <button type="button" className="btn" onClick={() => replaceSheet({ type: 'record', id })}>
          <Icon name="eye" size={16} /> Open record
        </button>
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => {
            setCanon(canon.filter((x) => x !== id));
            toast('Removed from your canon');
            closeSheet();
          }}
        >
          <Icon name="close" size={16} /> Remove from canon
        </button>
      </div>
    </div>
  );
}

/* ── Person passport ─────────────────────────────────────────────────────── */

export function PersonSheet({ person }: { person: Person }) {
  const router = useRouter();
  const data = useStore((s) => s.data);
  const following = useStore((s) => !!s.data?.follows[person.id]?.on);
  const mine = useMemo(() => Object.fromEntries(liveStamps(data).map((s) => [s.itemId, s.rating])), [data]);
  const m = tasteMatch(mine, person.r);
  const fn = firstName(person.name);
  const canon = person.canon ?? [];
  const remoteLive = useStore((s) => s.remote.live);
  const live = following ? (remoteLive.find((l) => l.p === person.id) ?? LIVE.find((l) => l.p === person.id)) : undefined;
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 14, alignItems: 'center' }}>
        <Avatar name={person.name} color={person.av} size={64} />
        <div style={{ minWidth: 0 }}>
          <div className="display" style={{ fontSize: 26 }}>
            {person.name}
          </div>
          <div className="label">
            @{person.handle} · {person.city}
          </div>
        </div>
        <MatchRing pct={m.pct} />
      </div>
      {live ? <NowLine itemId={live.item} label={live.label} /> : null}
      <p className="body2">{person.bio}</p>
      {person.sample ? <p className="label">Sample citizen — fictional</p> : null}

      <section style={{ display: 'grid', gap: 10 }}>
        <h3 className="h2">Their canonical nine</h3>
        <div className="mini-canon">
          {canon.slice(0, 9).map((id, i) => {
            const item = getItem(id) ?? CATALOG_BY_ID[id];
            if (!item) return null;
            return (
              <button key={id} type="button" className="canon-slot" onClick={() => openSheet({ type: 'record', id })} aria-label={`${i + 1}. ${item.title}`}>
                <Poster item={item} tag={i + 1} />
              </button>
            );
          })}
        </div>
      </section>

      <section style={{ display: 'grid', gap: 10 }}>
        <h3 className="h2">You vs {fn}</h3>
        {m.shared.length ? (
          <ul className="vs-list">
            {m.shared.map((id) => {
              const item = getItem(id);
              return (
                <li key={id}>
                  <button type="button" className="btn-link" style={{ justifySelf: 'start', textTransform: 'none', letterSpacing: 0, fontFamily: 'var(--f-body)', fontSize: 16 }} onClick={() => openSheet({ type: 'record', id })}>
                    {item?.title ?? id}
                  </button>
                  <span className="vs-scores">
                    <span>
                      You <StarsText rating={mine[id]} />
                    </span>
                    <span>
                      {fn} <StarsText rating={person.r[id]} />
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="body2">No shared stamps yet. Stamp something you’ve both finished and it shows up here.</p>
        )}
      </section>

      <div className="btn-row">
        <button
          type="button"
          className="btn btn-pri"
          style={{ flex: '1 1 auto' }}
          onClick={() => {
            closeAllSheets();
            router.push(`/app/diplomat?with=${encodeURIComponent(person.id)}`);
          }}
        >
          Find a pick together
        </button>
        <button type="button" className="btn" aria-pressed={following} onClick={() => toggleFollow(person.id, fn)} style={{ flex: '1 1 auto' }}>
          {following ? 'Following' : 'Follow'}
        </button>
      </div>
    </div>
  );
}

/* ── Add it yourself (5.12) ──────────────────────────────────────────────── */

export function AddOwnSheet({ initial }: { initial: Extract<SheetSpec, { type: 'add-own' }> }) {
  const [title, setTitle] = useState(initial.title ?? '');
  const [kind, setKind] = useState<Item['kind']>(initial.kind ?? 'film');
  const [by, setBy] = useState(initial.by ?? '');
  const [year, setYear] = useState(initial.year ? String(initial.year) : '');
  const [mins, setMins] = useState('');
  const [cc, setCc] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const thisYear = new Date().getFullYear();

  const validate = () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'Type the title of the work.';
    if (year && (!/^\d{4}$/.test(year) || +year < 1000 || +year > thisYear + 1)) e.year = `Use a four-digit year up to ${thisYear + 1}.`;
    if (mins && (!/^\d{1,5}$/.test(mins) || +mins < 1)) e.mins = 'Use whole minutes, like 98.';
    if (cc && !/^[a-zA-Z]{2}$/.test(cc)) e.cc = 'Use two letters, like JP or LB.';
    return e;
  };

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    const item = addCustomItem({
      title,
      kind,
      by,
      year: year ? +year : undefined,
      mins: mins ? +mins : undefined,
      cc: cc || undefined,
    });
    replaceSheet({ type: 'record', id: item.id });
  };

  const byLabel = kind === 'book' || kind === 'manga' ? 'Author' : kind === 'album' ? 'Artist' : kind === 'game' ? 'Studio' : 'Director';

  return (
    <form className="form-grid" onSubmit={submit} noValidate>
      <label className="field">
        <span className="label">Title</span>
        <input
          className="input"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (errors.title) setErrors(({ title: _t, ...rest }) => rest);
          }}
          onBlur={() => !title.trim() && setErrors((x) => ({ ...x, title: 'Type the title of the work.' }))}
          aria-invalid={!!errors.title || undefined}
          data-autofocus
        />
        {errors.title ? <span className="field-error">{errors.title}</span> : null}
      </label>
      <div className="field">
        <span className="label">Type</span>
        <div className="chips">
          {KINDS.map((k) => (
            <button key={k} type="button" className="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
      </div>
      <label className="field">
        <span className="label">{byLabel} (director, author or artist)</span>
        <input className="input" value={by} onChange={(e) => setBy(e.target.value)} />
      </label>
      <div className="form-grid form-grid-2">
        <label className="field">
          <span className="label">Year</span>
          <input
            className="input"
            inputMode="numeric"
            value={year}
            maxLength={4}
            placeholder="e.g. 1994"
            onChange={(e) => {
              setYear(e.target.value.replace(/\D/g, ''));
              setErrors(({ year: _y, ...rest }) => rest);
            }}
            aria-invalid={!!errors.year || undefined}
          />
          {errors.year ? <span className="field-error">{errors.year}</span> : null}
        </label>
        <label className="field">
          <span className="label">Length in minutes (optional)</span>
          <input
            className="input"
            inputMode="numeric"
            value={mins}
            maxLength={5}
            onChange={(e) => {
              setMins(e.target.value.replace(/\D/g, ''));
              setErrors(({ mins: _m, ...rest }) => rest);
            }}
            aria-invalid={!!errors.mins || undefined}
          />
          {errors.mins ? <span className="field-error">{errors.mins}</span> : null}
        </label>
      </div>
      <label className="field">
        <span className="label">Country code (optional, 2 letters)</span>
        <input
          className="input"
          value={cc}
          maxLength={2}
          placeholder="e.g. JP"
          style={{ textTransform: 'uppercase' }}
          onChange={(e) => {
            setCc(e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase());
            setErrors(({ cc: _c, ...rest }) => rest);
          }}
          aria-invalid={!!errors.cc || undefined}
        />
        {errors.cc ? <span className="field-error">{errors.cc}</span> : null}
      </label>
      <button type="submit" className="btn btn-pri">
        Add and stamp it
      </button>
    </form>
  );
}

/* ── Passport code ──────────────────────────────────────────────────────── */

export function PassportCodeSheet() {
  const p = useStore((s) => s.data?.passport);
  const count = useStore((s) => liveStamps(s.data).length);
  if (!p) return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(p.passportNo);
      toast('Code copied');
    } catch {
      toast(`Your code is ${p.passportNo}`);
    }
  };
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <p className="body2">Show this to someone at the screening. They can find you by typing it into People.</p>
      <div className="card" style={{ padding: '6px 16px 16px' }}>
        <div className="big-code">{p.passportNo}</div>
        <MRZ name={p.name} passportNo={p.passportNo} stamps={count} issued={p.issued} />
      </div>
      <button type="button" className="btn btn-pri" onClick={copy}>
        <Icon name="copy" size={16} /> Copy code
      </button>
      <p className="label">Tap-to-exchange with NFC needs the native app.</p>
      <p className="label">Issued {formatDate(p.issued)}</p>
    </div>
  );
}

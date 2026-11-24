'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { PEOPLE } from '@/lib/catalog';
import { firstName } from '@/lib/format';
import { tasteMatch } from '@/lib/match';
import { getItem, liveStamps, openSheet, toggleFollow, useStore } from '@/lib/store/store';
import { findPassportByCode } from '@/lib/sync/social';
import type { Person } from '@/lib/types';
import { MatchRing } from '../../brand/MatchRing';
import { Avatar } from '../../ui/bits';

function dayOfYear() {
  const now = new Date();
  return Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
}

export function PeopleScreen() {
  const router = useRouter();
  const data = useStore((s) => s.data);
  const remotePeople = useStore((s) => s.remote.people);
  const follows = useStore((s) => s.data?.follows);
  const mine = useMemo(() => Object.fromEntries(liveStamps(data).map((s) => [s.itemId, s.rating])), [data]);
  const people: Person[] = useMemo(() => [...remotePeople, ...PEOPLE], [remotePeople]);
  const scored = useMemo(() => people.map((p) => ({ p, m: tasteMatch(mine, p.r) })), [people, mine]);
  const ranked = [...scored].filter((x) => x.m.pct !== null).sort((a, b) => b.m.pct! - a.m.pct! || b.m.shared.length - a.m.shared.length);
  const twin = ranked[0] ?? scored[dayOfYear() % Math.max(1, scored.length)];

  const titles = (ids: string[]) => ids.map((id) => getItem(id)?.title ?? id);
  const joinList = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

  return (
    <>
      <header className="page-head">
        <h1 className="page-title">
          KINDRED <em>spirits</em>
        </h1>
        <p className="subtitle page-sub">People whose ratings line up with yours, based on what you’ve both stamped.</p>
      </header>
      <p className="label sample-note">Sample citizens — fictional until real friends join.</p>

      {twin ? (
        <section className="twin" aria-label="Taste twin of the day">
          <div className="twin-pct" aria-hidden="true">
            {twin.m.pct !== null ? `${twin.m.pct}%` : '%'}
          </div>
          <span className="label">Taste twin of the day</span>
          <h2>{twin.p.name}</h2>
          <p>
            {twin.m.shared.length === 0
              ? 'No shared stamps yet. Stamp a few works and see whose ratings line up with yours.'
              : twin.m.bothFive.length
                ? `${twin.m.shared.length} shared ${twin.m.shared.length === 1 ? 'stamp' : 'stamps'}, and you both gave five stars to ${joinList(titles(twin.m.bothFive).slice(0, 3))}.`
                : `${twin.m.shared.length} shared ${twin.m.shared.length === 1 ? 'stamp' : 'stamps'}, and your ratings line up.`}
          </p>
          <div className="btn-row">
            <button type="button" className="btn" onClick={() => openSheet({ type: 'person', id: twin.p.id })}>
              Open passport
            </button>
            <button type="button" className="btn btn-rose" onClick={() => router.push(`/app/diplomat?with=${encodeURIComponent(twin.p.id)}`)}>
              Find a pick together
            </button>
          </div>
        </section>
      ) : null}

      <div className="people-list">
        {scored.map(({ p, m }) => {
          const following = !!follows?.[p.id]?.on;
          return (
            <article key={p.id} className="person">
              <div className="person-head">
                <Avatar name={p.name} color={p.av} />
                <div style={{ minWidth: 0 }}>
                  <div className="person-name">{p.name}</div>
                  <div className="label">
                    @{p.handle} · {p.city}
                  </div>
                </div>
                <MatchRing pct={m.pct} />
              </div>
              <p className="body2">
                {p.bio} {m.shared.length} shared {m.shared.length === 1 ? 'stamp' : 'stamps'}.
              </p>
              <div className="btn-row">
                <button type="button" className="btn btn-sm" onClick={() => openSheet({ type: 'person', id: p.id })}>
                  Passport
                </button>
                <button type="button" className="btn btn-sm" aria-pressed={following} onClick={() => toggleFollow(p.id, firstName(p.name))}>
                  {following ? 'Following' : 'Follow'}
                </button>
                <button type="button" className="btn btn-sm" onClick={() => router.push(`/app/diplomat?with=${encodeURIComponent(p.id)}`)}>
                  Pick together
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <PassportExchange />
    </>
  );
}

function PassportExchange() {
  const mode = useStore((s) => s.data?.mode);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<Person | null>(null);
  const follows = useStore((s) => s.data?.follows);

  const find = async (e: React.FormEvent) => {
    e.preventDefault();
    setFound(null);
    const norm = code.trim().toUpperCase().replace(/^STMP-?/, '');
    if (!/^\d{4}$/.test(norm)) {
      setMsg('Type a passport code like STMP-1234.');
      return;
    }
    if (mode !== 'account') {
      setMsg('Finding passports by code needs an account. Save your passport from Settings first.');
      return;
    }
    setBusy(true);
    setMsg(null);
    const res = await findPassportByCode(`STMP-${norm}`);
    setBusy(false);
    if (res.status === 'found') setFound(res.person);
    else if (res.status === 'self') setMsg('That’s your own passport code.');
    else if (res.status === 'offline') setMsg('You’re offline. Try again when you’re back online.');
    else setMsg(`No passport with the code STMP-${norm}. Check the digits and try again.`);
  };

  return (
    <section className="exchange" aria-labelledby="exchange-h">
      <h3 id="exchange-h">Passport exchange</h3>
      <p className="body2">Meet someone at a screening? Show them your passport code so they can find you.</p>
      <div className="btn-row">
        <button type="button" className="btn btn-pri" onClick={() => openSheet({ type: 'passport-code' })}>
          Show my code
        </button>
      </div>
      <form className="code-form" onSubmit={find} noValidate>
        <label className="sr-only" htmlFor="code-q">
          Passport code
        </label>
        <input
          id="code-q"
          className="input"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setMsg(null);
          }}
          placeholder="STMP-1234"
          autoComplete="off"
          autoCapitalize="characters"
        />
        <button type="submit" className="btn" disabled={busy}>
          {busy ? 'Looking…' : 'Find passport'}
        </button>
      </form>
      {msg ? (
        <p className="field-error" role="status">
          {msg}
        </p>
      ) : null}
      {found ? (
        <div className="person">
          <div className="person-head">
            <Avatar name={found.name} color={found.av} />
            <div>
              <div className="person-name">{found.name}</div>
              <div className="label">{found.handle}</div>
            </div>
            <span />
          </div>
          <button type="button" className="btn btn-pri" aria-pressed={!!follows?.[found.id]?.on} onClick={() => toggleFollow(found.id, firstName(found.name))}>
            {follows?.[found.id]?.on ? 'Following' : 'Follow'}
          </button>
        </div>
      ) : null}
    </section>
  );
}

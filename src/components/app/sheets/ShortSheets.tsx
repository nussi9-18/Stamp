'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { beginSaveAccount } from '@/lib/auth/session';
import { VECTOR_NAMES } from '@/lib/heat';
import { DEFAULT_SHIELD, gate } from '@/lib/shield';
import {
  applauseKey,
  countryOptions,
  embedUrl,
  emptyShortForm,
  FIELD_ORDER,
  GENRE_LABEL,
  MAX_SHORT_MINS,
  parseVideo,
  regionName,
  SHORT_GENRES,
  STATUS_LABEL,
  shortFieldError,
  shortToItem,
  validateShort,
  type Short,
  type ShortField,
  type ShortForm,
} from '@/lib/shorts';
import { sfx } from '@/lib/sound';
import { closeSheet, openSheet, rememberWorld, toast, toggleLike, toggleWishlist, useLook, useStore } from '@/lib/store/store';
import { hasSupabase } from '@/lib/supabase/client';
import { reportShort, submitShort, withdrawShort, type ReportReason } from '@/lib/sync/shorts';
import { Icon } from '../../brand/Icon';
import { HeatChip } from '../../ui/bits';
import { ShortThumb } from '../ShortThumb';

/* ── Watching ─────────────────────────────────────────────────────────── */

export function ShortSheet({ short: s }: { short: Short }) {
  const item = useMemo(() => shortToItem(s), [s]);
  const key = applauseKey(s.id);
  const liked = useStore((st) => !!st.data?.likes[key]?.on);
  const others = useStore((st) => st.shorts.applause[s.id] ?? 0);
  const saved = useStore((st) => !!st.data?.wishlist[item.id]?.on);
  const stamped = useStore((st) => {
    const r = st.data?.stamps[item.id];
    return !!r && !r.deleted;
  });
  const shield = useStore((st) => st.data?.passport?.shield ?? DEFAULT_SHIELD);
  const look = useLook();
  const video = s.url ? parseVideo(s.url) : null;
  const g = gate(item, shield);
  const [revealed, setRevealed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [panel, setPanel] = useState<null | 'report' | 'withdraw'>(null);
  const blocked = g.gated && shield.action !== 'warn' && !revealed;

  const play = () => {
    sfx(look === 'retro' ? 'tape' : 'open');
    setPlaying(true);
  };
  const applaud = () => {
    if (toggleLike(key)) sfx('applause');
  };
  const stampIt = () => {
    rememberWorld([item]);
    openSheet({ type: 'record', id: item.id });
  };
  const save = () => {
    rememberWorld([item]);
    toggleWishlist(item.id);
  };

  return (
    <article className="short-view" aria-label={s.title}>
      <div className={`player${playing ? ' is-playing' : ''}`}>
        {s.sample ? (
          <div className="player-cover">
            <ShortThumb short={s} hero />
            <p className="player-msg">Sample film · real shorts play right here</p>
          </div>
        ) : blocked ? (
          <div className="player-cover is-gated">
            <p className="player-msg">Above your comfort shield: {g.over.map((i) => VECTOR_NAMES[i]).join(', ')}</p>
            <button type="button" className="btn btn-sm" onClick={() => setRevealed(true)}>
              Show anyway
            </button>
          </div>
        ) : playing && video ? (
          <iframe
            src={embedUrl(video)}
            title={`${s.title} — player`}
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button type="button" className="player-cover player-start" data-sfx="none" onClick={play} aria-label={`Play ${s.title}`}>
            <ShortThumb short={s} hero />
            <span className="player-play">
              <Icon name="play" size={20} /> Play
            </span>
          </button>
        )}
      </div>

      <div className="short-head">
        <h2 className="record-title">{s.title}</h2>
        <p className="record-by italic">by {s.filmmaker}</p>
        <p className="short-facts">{[`${s.mins} min`, GENRE_LABEL[s.genre], regionName(s.cc), s.year].filter(Boolean).join(' · ')}</p>
      </div>

      <p className="logline">{s.logline}</p>
      {g.gated && shield.action === 'warn' ? <p className="warn-line">Shield: {g.over.map((i) => VECTOR_NAMES[i]).join(', ')}</p> : null}
      {s.v?.some(Boolean) ? <HeatChip item={item} /> : null}

      <div className="short-actions">
        <button type="button" className="btn btn-pri" onClick={stampIt}>
          {stamped ? (
            <>
              <Icon name="check" size={16} /> Stamped
            </>
          ) : (
            'Stamp it'
          )}
        </button>
        <button type="button" className="btn applaud" data-sfx="none" aria-pressed={liked} onClick={applaud}>
          Applaud <span className="applaud-n">{others + (liked ? 1 : 0)}</span>
        </button>
        <button type="button" className="btn" aria-pressed={saved} onClick={save}>
          <Icon name={saved ? 'bookmark-fill' : 'bookmark'} size={16} /> {saved ? 'Saved' : 'Save'}
        </button>
      </div>

      {s.makerLink ? (
        <a className="btn-link short-maker" href={s.makerLink} target="_blank" rel="noopener noreferrer nofollow ugc">
          More from {s.filmmaker} <Icon name="external" size={14} />
        </a>
      ) : null}

      {s.mine ? (
        <div className="short-own">
          <span className={`status-tag is-${s.status}`}>{STATUS_LABEL[s.status]}</span>
          {panel === 'withdraw' ? (
            <div className="confirm" role="alertdialog" aria-label="Withdraw film">
              <p>Withdraw {s.title}? It leaves the room. You can send it again later.</p>
              <div className="btn-row">
                <button type="button" className="btn" onClick={() => setPanel(null)} autoFocus>
                  Keep it
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={async () => {
                    if (await withdrawShort(s.id)) {
                      toast('Film withdrawn');
                      closeSheet();
                    } else toast('Couldn’t withdraw it. Try again in a minute.');
                  }}
                >
                  Withdraw film
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn btn-sm btn-danger" onClick={() => setPanel('withdraw')}>
              Withdraw
            </button>
          )}
        </div>
      ) : null}

      {!s.sample && !s.mine && s.status === 'live' ? (
        panel === 'report' ? (
          <ReportPanel id={s.id} onClose={() => setPanel(null)} />
        ) : (
          <button type="button" className="btn-link short-report" onClick={() => setPanel('report')}>
            <Icon name="flag" size={14} /> Report
          </button>
        )
      ) : null}
    </article>
  );
}

const REASONS: { id: ReportReason; label: string }[] = [
  { id: 'not-theirs', label: 'Not their film' },
  { id: 'harmful', label: 'Harmful' },
  { id: 'broken', label: 'Won’t play' },
  { id: 'spam', label: 'Spam' },
];

function ReportPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const account = useStore((st) => st.data?.mode === 'account');
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const errId = useId();

  if (!account) {
    return (
      <div className="confirm">
        <p>Reports come from an account, so we can trust them.</p>
        <div className="btn-row">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-pri" onClick={beginSaveAccount}>
            Save my passport
          </button>
        </div>
      </div>
    );
  }

  const send = async () => {
    if (!reason) return setError('Pick what’s wrong.');
    setSending(true);
    const ok = await reportShort(id, reason);
    setSending(false);
    if (ok) {
      toast('Thanks. We’ll take a look.');
      onClose();
    } else setError('Couldn’t send the report. Try again in a minute.');
  };

  return (
    <div className="confirm short-report-panel" role="group" aria-label="Report this film">
      <span className="label">What’s wrong?</span>
      <div className="chips" aria-describedby={error ? errId : undefined}>
        {REASONS.map((r) => (
          <button
            key={r.id}
            type="button"
            className="chip"
            aria-pressed={reason === r.id}
            onClick={() => {
              setReason(r.id);
              setError(null);
            }}
          >
            {r.label}
          </button>
        ))}
      </div>
      {error ? (
        <p id={errId} className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="btn-row">
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn btn-danger" onClick={send} aria-disabled={sending || undefined}>
          {sending ? 'Sending…' : 'Send report'}
        </button>
      </div>
    </div>
  );
}

/* ── Sending a film ───────────────────────────────────────────────────── */

export function SubmitShortSheet() {
  const mode = useStore((s) => s.data?.mode);
  const name = useStore((s) => s.data?.passport?.name ?? '');
  if (!hasSupabase()) {
    return (
      <div className="short-gate">
        <p>Sending films needs accounts, and they aren’t switched on here yet.</p>
      </div>
    );
  }
  if (mode !== 'account') {
    return (
      <div className="short-gate">
        <p>Films are sent from an account, so you can follow yours from review to live.</p>
        <button type="button" className="btn btn-pri" onClick={beginSaveAccount}>
          Save my passport
        </button>
      </div>
    );
  }
  return <SubmitShortForm defaultName={name} />;
}

function SubmitShortForm({ defaultName }: { defaultName: string }) {
  const [f, setF] = useState<ShortForm>(() => emptyShortForm(defaultName));
  const [errors, setErrors] = useState<Partial<Record<ShortField, string>>>({});
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [sent, setSent] = useState<Short | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const year = new Date().getFullYear();
  const video = parseVideo(f.url);
  const countries = useMemo(() => countryOptions(), []);
  const rightsId = useId();
  const loglineId = useId();

  const setErr = (k: ShortField, e: string | null) =>
    setErrors((x) => {
      if (!e) {
        if (!(k in x)) return x;
        const { [k]: _gone, ...rest } = x;
        return rest;
      }
      return { ...x, [k]: e };
    });

  /** Update a field; an error already showing is re-checked right away so it clears once fixed. */
  const set = <K extends keyof ShortForm>(k: K, v: ShortForm[K]) => {
    const next = { ...f, [k]: v };
    setF(next);
    setFailure(null);
    if (k !== 'notes' && errors[k as ShortField]) setErr(k as ShortField, shortFieldError(k as ShortField, next, year));
  };
  const blur = (k: ShortField) => () => setErr(k, shortFieldError(k, f, year));
  const err = (k: ShortField) =>
    errors[k] ? (
      <span className="field-error" id={`short-${k}-err`}>
        {errors[k]}
      </span>
    ) : null;
  const aria = (k: ShortField) => ({ 'aria-invalid': !!errors[k] || undefined, 'aria-describedby': errors[k] ? `short-${k}-err` : undefined, 'data-field': k });

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (sending) return;
    const r = validateShort(f, year);
    if (!r.ok) {
      setErrors(r.errors);
      sfx('error');
      const first = FIELD_ORDER.find((k) => r.errors[k]);
      formRef.current?.querySelector<HTMLElement>(`[data-field="${first}"]`)?.focus();
      return;
    }
    setSending(true);
    const res = await submitShort(r.value);
    setSending(false);
    if (res.ok) {
      sfx('success');
      setSent(res.short);
    } else {
      sfx('error');
      setFailure(res.error);
    }
  };

  if (sent) {
    return (
      <div className="short-sent" role="status">
        <span className="short-sent-stamp" aria-hidden="true">
          Received
        </span>
        <h3>Sent for review</h3>
        <p>{sent.title} goes live once it’s approved. You’ll see it under Your films.</p>
        <button type="button" className="btn btn-pri" onClick={closeSheet} autoFocus>
          Done
        </button>
      </div>
    );
  }

  return (
    <form ref={formRef} className="form-grid short-form" onSubmit={submit} noValidate>
      <label className="field">
        <span className="label">Link to the film</span>
        <input
          className="input"
          type="url"
          inputMode="url"
          autoComplete="off"
          placeholder="https://youtu.be/…"
          value={f.url}
          onChange={(e) => set('url', e.target.value)}
          onBlur={blur('url')}
          data-autofocus
          {...aria('url')}
        />
        {err('url') ?? (video ? <span className="field-ok">{video.host === 'youtube' ? 'YouTube' : 'Vimeo'} film found</span> : <span className="field-hint">YouTube or Vimeo, public or unlisted.</span>)}
      </label>

      <label className="field">
        <span className="label">Title</span>
        <input className="input" value={f.title} maxLength={80} onChange={(e) => set('title', e.target.value)} onBlur={blur('title')} {...aria('title')} />
        {err('title')}
      </label>

      <label className="field">
        <span className="label">Made by</span>
        <input className="input" value={f.filmmaker} maxLength={60} autoComplete="name" onChange={(e) => set('filmmaker', e.target.value)} onBlur={blur('filmmaker')} {...aria('filmmaker')} />
        {err('filmmaker')}
      </label>

      <div className="form-grid form-grid-2">
        <label className="field">
          <span className="label">Minutes</span>
          <input
            className="input"
            inputMode="numeric"
            maxLength={2}
            placeholder={`1–${MAX_SHORT_MINS}`}
            value={f.mins}
            onChange={(e) => set('mins', e.target.value.replace(/\D/g, ''))}
            onBlur={blur('mins')}
            {...aria('mins')}
          />
          {err('mins')}
        </label>
        <label className="field">
          <span className="label">Year</span>
          <input className="input" inputMode="numeric" maxLength={4} value={f.year} onChange={(e) => set('year', e.target.value.replace(/\D/g, ''))} onBlur={blur('year')} {...aria('year')} />
          {err('year')}
        </label>
      </div>

      <div className="field">
        <span className="label" id="short-genre-l">
          Genre
        </span>
        <div className="chips" role="group" aria-labelledby="short-genre-l" aria-describedby={errors.genre ? 'short-genre-err' : undefined}>
          {SHORT_GENRES.map((g, i) => (
            <button key={g} type="button" className="chip" aria-pressed={f.genre === g} onClick={() => set('genre', g)} data-field={i === 0 ? 'genre' : undefined}>
              {GENRE_LABEL[g]}
            </button>
          ))}
        </div>
        {err('genre')}
      </div>

      <label className="field">
        <span className="label">One line about it</span>
        <input
          className="input short-line"
          value={f.logline}
          maxLength={160}
          onChange={(e) => set('logline', e.target.value)}
          onBlur={blur('logline')}
          {...aria('logline')}
          aria-describedby={[errors.logline ? 'short-logline-err' : '', loglineId].filter(Boolean).join(' ')}
        />
        {err('logline')}
        <span id={loglineId} className="label note-count">
          {f.logline.length}/160
        </span>
      </label>

      <label className="field">
        <span className="label">Country (optional)</span>
        <select className="select" value={f.cc} onChange={(e) => set('cc', e.target.value)} {...aria('cc')}>
          <option value="">—</option>
          {countries.map((c) => (
            <option key={c.cc} value={c.cc}>
              {c.name}
            </option>
          ))}
        </select>
        {err('cc')}
      </label>

      <div className="field">
        <span className="label" id="short-notes-l">
          Contains (optional)
        </span>
        <div className="chips" role="group" aria-labelledby="short-notes-l">
          {VECTOR_NAMES.map((n, i) => (
            <button key={n} type="button" className="chip" aria-pressed={f.notes.includes(i)} onClick={() => set('notes', f.notes.includes(i) ? f.notes.filter((x) => x !== i) : [...f.notes, i])}>
              {n}
            </button>
          ))}
        </div>
        <span className="field-hint">Helps people with a comfort shield.</span>
      </div>

      <label className="field">
        <span className="label">Where to find you (optional)</span>
        <input className="input" type="url" inputMode="url" placeholder="https://" value={f.makerLink} onChange={(e) => set('makerLink', e.target.value)} onBlur={blur('makerLink')} {...aria('makerLink')} />
        {err('makerLink')}
      </label>

      <div className="field">
        <label className="check-row" data-sfx="punch">
          <input type="checkbox" checked={f.rights} onChange={(e) => set('rights', e.target.checked)} {...aria('rights')} aria-describedby={errors.rights ? 'short-rights-err' : rightsId} />
          <span id={rightsId}>I made this film or have the right to share it, and it’s free to watch.</span>
        </label>
        {err('rights')}
      </div>

      {failure ? (
        <p className="field-error short-failure" role="alert">
          {failure}
        </p>
      ) : null}

      <button type="submit" className="btn btn-pri" aria-disabled={sending || undefined}>
        {sending ? 'Sending…' : 'Send for review'}
      </button>
    </form>
  );
}

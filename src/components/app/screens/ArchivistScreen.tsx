'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { KIND_LABEL } from '@/lib/catalog';
import { ARCHIVIST_EXAMPLE, CLUE_CHIPS } from '@/lib/ai/archivist';
import { askArchivist } from '@/lib/ai/client';
import type { ArchivistResult } from '@/lib/ai/schemas';
import { addCustomItem, getItem, openSheet } from '@/lib/store/store';
import type { Kind } from '@/lib/types';
import { Icon } from '../../brand/Icon';
import { Poster } from '../../brand/Poster';
import { Seal } from '../../brand/Seal';

type SR = {
  start: () => void;
  stop: () => void;
  abort: () => void;
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

function getRecognition(): (new () => SR) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Dictation via the Web Speech API; the mic is hidden where unsupported. */
export function useDictation(value: string, setValue: (v: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<SR | null>(null);
  const base = useRef('');
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => setSupported(!!getRecognition()), []);
  useEffect(() => () => rec.current?.abort(), []);

  const start = () => {
    const Ctor = getRecognition();
    if (!Ctor) return;
    setError(null);
    const r = new Ctor();
    r.lang = navigator.language || 'en-US';
    r.continuous = true;
    r.interimResults = true;
    base.current = valueRef.current;
    r.onresult = (e) => {
      let text = '';
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      const b = base.current;
      setValue(b + (b && !/\s$/.test(b) ? ' ' : '') + text.trimStart());
    };
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setError('Allow the microphone to dictate, or type instead.');
      else if (e.error !== 'aborted' && e.error !== 'no-speech') setError('Dictation stopped. Type instead, or try again.');
    };
    r.onend = () => setListening(false);
    rec.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };
  const stop = () => rec.current?.stop();
  return { supported, listening, start, stop, error };
}

export function ArchivistScreen() {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ArchivistResult | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const abort = useRef<AbortController | null>(null);
  const errId = useId();
  const dict = useDictation(text, (v) => {
    setText(v);
    if (v.trim().length >= 8) setError(null);
  });

  const addClue = (prefix: string) => {
    setText((t) => (t.trim() ? `${t.replace(/\s+$/, '')}\n${prefix}` : prefix));
    requestAnimationFrame(() => {
      const ta = taRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    });
  };

  const identify = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (text.trim().length < 8) {
      setError('Write at least a few words about what you remember.');
      taRef.current?.focus();
      return;
    }
    if (dict.listening) dict.stop();
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setLoading(true);
    setResult(null);
    setNote(null);
    try {
      const out = await askArchivist(text.trim(), ctrl.signal);
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
      <header className="page-head">
        <h1 className="page-title">
          FORGOT THE TITLE? <em>Describe it.</em>
        </h1>
        <p className="subtitle page-sub">
          Tell the Archivist anything you remember — a shot, a song, an actor’s face, an object, roughly when. More clues, sharper answer.
        </p>
      </header>

      <div className="tool-layout">
        <form onSubmit={identify} noValidate style={{ display: 'grid', gap: 12 }}>
          <label className="field">
            <span className="label">What you remember</span>
            <textarea
              ref={taRef}
              className="textarea"
              value={text}
              rows={5}
              onChange={(e) => {
                setText(e.target.value);
                if (e.target.value.trim().length >= 8) setError(null);
              }}
              onBlur={() => text.trim() && text.trim().length < 8 && setError('Write at least a few words about what you remember.')}
              placeholder="A rainy alley at night, a green neon sign, a woman in a blonde wig and sunglasses…"
              aria-invalid={!!error || undefined}
              aria-describedby={error ? errId : undefined}
            />
          </label>
          {error ? (
            <p id={errId} className="field-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="clue-chips" role="group" aria-label="Add a clue">
            {CLUE_CHIPS.map((c) => (
              <button key={c.label} type="button" className="chip" onClick={() => addClue(c.prefix)}>
                {c.label}
              </button>
            ))}
          </div>
          <div className="btn-row">
            <button type="submit" className="btn btn-pri" disabled={loading}>
              Identify it
            </button>
            {dict.supported ? (
              dict.listening ? (
                <button type="button" className="btn" onClick={dict.stop} aria-pressed="true">
                  <span className="live-dot" aria-hidden="true" /> Stop
                </button>
              ) : (
                <button type="button" className="btn" onClick={dict.start}>
                  <Icon name="mic" size={16} /> Dictate
                </button>
              )
            ) : null}
            <button
              type="button"
              className="btn"
              onClick={() => {
                setText(ARCHIVIST_EXAMPLE);
                setError(null);
              }}
            >
              Try an example
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                abort.current?.abort();
                setLoading(false);
                setText('');
                setResult(null);
                setNote(null);
                setError(null);
              }}
            >
              Clear
            </button>
          </div>
          {dict.error ? <p className="field-error">{dict.error}</p> : null}
          {dict.listening ? (
            <p className="label" role="status">
              Listening… speak your clues.
            </p>
          ) : null}
        </form>

        <div aria-live="polite">
          {loading ? (
            <div className="loading">
              <Seal size={96} className="seal-wobble" />
              <p className="label">Cross-checking the archive…</p>
            </div>
          ) : result ? (
            <Verdict result={result} note={note} />
          ) : null}
        </div>
      </div>
    </>
  );
}

function openOrAdd(m: { title: string; year?: number; creator: string; kind: string; catalog_id: string | null }) {
  if (m.catalog_id && getItem(m.catalog_id)) {
    openSheet({ type: 'record', id: m.catalog_id });
    return;
  }
  const kind = (['film', 'series', 'book', 'manga', 'game', 'album'].includes(m.kind) ? m.kind : 'film') as Kind;
  const item = addCustomItem({ title: m.title, kind, by: m.creator, year: m.year });
  openSheet({ type: 'record', id: item.id });
}

function Verdict({ result, note }: { result: ArchivistResult; note: string | null }) {
  const m = result.match;
  if (!m) {
    return (
      <div className="verdict">
        <div className="verdict-head">
          <span className="mono">Keyword match · Catalog only</span>
        </div>
        <div className="verdict-section">
          {note ? <p className="inline-note">{note}</p> : null}
          <p>Nothing in the catalog lines up with those clues yet. Add a setting, a year or a name and try again.</p>
        </div>
      </div>
    );
  }
  const poster = m.catalog_id ? getItem(m.catalog_id) : undefined;
  const posterItem = poster ?? { id: `ai-${m.title}`, title: m.title, year: m.year, by: m.creator, kind: m.kind };
  const inCatalog = !!poster;
  return (
    <article className="verdict" aria-label="Verdict">
      <div className="verdict-head">
        <span className="mono">{result.source === 'ai' ? 'Probable match · Verified by AI' : 'Keyword match · Catalog only'}</span>
      </div>
      {note ? (
        <div className="verdict-section">
          <p className="inline-note">{note}</p>
        </div>
      ) : null}
      <div className="verdict-main">
        <Poster item={posterItem} />
        <div style={{ minWidth: 0 }}>
          <div className="verdict-pct">{m.confidence}%</div>
          <div className="verdict-title">{m.title}</div>
          <div className="italic body2">{[m.creator, m.year].filter(Boolean).join(', ')}</div>
          <span className="tag" style={{ marginTop: 6 }}>
            {KIND_LABEL[m.kind]}
          </span>
        </div>
      </div>
      <div className="verdict-section">
        <p>{m.why}</p>
      </div>
      {m.factors.length ? (
        <div className="verdict-section">
          <span className="label">Convergence factors</span>
          <ul className="factors">
            {m.factors.map((f, i) => (
              <li key={i} className="factor">
                <span className="factor-clue">“{f.clue}”</span>
                <span className="factor-bar" role="img" aria-label={`Weight ${f.weight} of 100`}>
                  <i style={{ width: `${f.weight}%` }} />
                </span>
                <span className="label">{f.kind}</span>
                <span className="label" style={{ textAlign: 'right' }}>
                  {f.weight}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="verdict-section">
        <button type="button" className="btn btn-pri" onClick={() => openOrAdd(m)}>
          {inCatalog ? 'Open & stamp' : 'Add to my list & stamp'}
        </button>
      </div>
      {result.alternates.length ? (
        <div className="verdict-section">
          <span className="label">Could also be</span>
          <ul className="alt-list">
            {result.alternates.map((a, i) => (
              <li key={i}>
                <span>
                  <span className="display" style={{ fontSize: 18 }}>
                    {a.title}
                  </span>{' '}
                  <span className="italic body2">{[a.creator, a.year].filter(Boolean).join(', ')}</span>
                </span>
                <button type="button" className="btn btn-sm" onClick={() => openOrAdd(a)}>
                  This one
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

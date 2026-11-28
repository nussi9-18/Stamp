'use client';

import { useRef, useState } from 'react';
import { sfx } from '@/lib/sound';
import { useLook } from '@/lib/store/store';
import { Seal } from '../brand/Seal';

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Retro: slide the rubber stamp along its rail to confirm (tap, Enter or Space also work).
 * Modern: a plain primary button.
 * `onAction` returns false when the action didn't go through (e.g. no rating yet) — the stamp slides back.
 */
export function SlideAction({ label, hint, onAction, className }: { label: string; hint: string; onAction: () => boolean | void; className?: string }) {
  const look = useLook();
  if (look !== 'retro') {
    return (
      <button type="button" className={['btn btn-pri', className].filter(Boolean).join(' ')} onClick={() => onAction()}>
        {label}
      </button>
    );
  }
  return <Slider label={label} hint={hint} onAction={onAction} className={className} />;
}

function Slider({ label, hint, onAction, className }: { label: string; hint: string; onAction: () => boolean | void; className?: string }) {
  const track = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ x0: number; start: number; moved: boolean } | null>(null);
  const busy = useRef(false);
  const [x, setX] = useState(0);
  const [mode, setMode] = useState<'idle' | 'drag' | 'done'>('idle');
  const [shake, setShake] = useState(false);

  const max = () => {
    const t = track.current;
    const k = knob.current;
    if (!t || !k) return 0;
    return Math.max(0, t.clientWidth - k.offsetWidth - 14);
  };

  const finish = () => {
    if (busy.current) return;
    busy.current = true;
    setMode('done');
    setX(max());
    sfx('slide');
    try {
      navigator.vibrate?.(15);
    } catch {
      /* ignore */
    }
    window.setTimeout(
      () => {
        const ok = onAction();
        if (ok === false) {
          sfx('error');
          setMode('idle');
          setX(0);
          setShake(true);
          window.setTimeout(() => setShake(false), 260);
          busy.current = false;
          return;
        }
        window.setTimeout(() => {
          setMode('idle');
          setX(0);
          busy.current = false;
        }, 900);
      },
      reduceMotion() ? 0 : 220,
    );
  };

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (busy.current || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x0: e.clientX, start: x, moved: false };
    setMode('drag');
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x0;
    if (Math.abs(dx) > 4) d.moved = true;
    setX(Math.min(max(), Math.max(0, d.start + dx)));
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved) {
      // A tap slides it all the way for you.
      setMode('idle');
      finish();
      return;
    }
    if (x >= max() * 0.82) finish();
    else {
      setMode('idle');
      setX(0);
    }
  };

  return (
    <div ref={track} className={['slide', mode === 'drag' ? 'is-drag' : '', mode === 'done' ? 'is-done' : '', shake ? 'is-shake' : '', className].filter(Boolean).join(' ')}>
      <span className="slide-ink" style={{ width: x + 30 }} aria-hidden="true" />
      <span className="slide-text" aria-hidden="true">
        {hint} <span className="slide-arrows">›››</span>
      </span>
      <button
        ref={knob}
        type="button"
        className="slide-knob"
        data-sfx="none"
        aria-label={label}
        style={{ transform: `translateX(${x}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            finish();
          }
        }}
        onClick={(e) => {
          // Pointer taps are handled on pointerup; this catches assistive-tech activation.
          if (e.detail === 0) finish();
        }}
      >
        <Seal size={34} />
      </button>
    </div>
  );
}

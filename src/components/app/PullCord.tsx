'use client';

import { useRef, useState } from 'react';
import { toggleTheme, useStore } from '@/lib/store/store';

const LIMIT = 46;
const TRIGGER = 26;

/** Retro light switch: pull the cord (drag down, or tap / Enter) to switch between light and dark. */
export function PullCord() {
  const night = useStore((s) => (s.data?.passport?.theme ?? 'day') === 'night');
  const [pull, setPull] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ y0: number; moved: boolean; last: number } | null>(null);

  const fire = () => {
    try {
      navigator.vibrate?.(12);
    } catch {
      /* ignore */
    }
    toggleTheme();
  };

  const tug = () => {
    setPull(TRIGGER + 8);
    window.setTimeout(() => {
      setPull(0);
      fire();
    }, 170);
  };

  return (
    <button
      type="button"
      className={`cord${dragging ? ' is-drag' : ''}`}
      aria-label={night ? 'Light mode' : 'Dark mode'}
      aria-pressed={night}
      title={night ? 'Pull for light mode' : 'Pull for dark mode'}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { y0: e.clientY, moved: false, last: 0 };
        setDragging(true);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const dy = Math.min(LIMIT, Math.max(0, e.clientY - d.y0));
        if (dy > 3) d.moved = true;
        d.last = dy;
        setPull(dy);
      }}
      onPointerUp={() => {
        const d = drag.current;
        drag.current = null;
        setDragging(false);
        if (!d) return;
        if (!d.moved) {
          tug();
          return;
        }
        setPull(0);
        if (d.last >= TRIGGER) fire();
      }}
      onPointerCancel={() => {
        drag.current = null;
        setDragging(false);
        setPull(0);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          tug();
        }
      }}
      onClick={(e) => {
        if (e.detail === 0) tug();
      }}
    >
      <span className="cord-line" style={{ height: 26 + pull }} aria-hidden="true" />
      <span className="cord-bead" style={{ transform: `translateY(${pull}px)` }} aria-hidden="true" />
    </button>
  );
}

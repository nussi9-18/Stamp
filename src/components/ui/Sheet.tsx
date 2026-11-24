'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Icon } from '../brand/Icon';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * 2.5.6 Sheet: phone = bottom sheet (max 92dvh, slides up 320ms); ≥768px = right-side drawer
 * min(540px, 64vw), full height. Scrim rgba(14,13,12,.45). Esc / scrim tap closes, focus trapped and restored.
 */
export function Sheet({
  title,
  onClose,
  children,
  hideTitle = false,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  hideTitle?: boolean;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [closing, setClosing] = useState(false);

  const close = useCallback(() => {
    if (closing) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setClosing(true);
    setTimeout(onClose, reduce ? 0 : 220);
  }, [closing, onClose]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const first = el.querySelector<HTMLElement>('[data-autofocus]') ?? el.querySelector<HTMLElement>('.sheet-body ' + FOCUSABLE) ?? el;
    first.focus({ preventScroll: true });
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== 'Tab' || !ref.current) return;
    const nodes = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.offsetParent !== null || n === document.activeElement);
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <>
      <div className={`scrim${closing ? ' is-closing' : ''}`} onClick={close} aria-hidden="true" />
      <div
        ref={ref}
        className={`sheet${closing ? ' is-closing' : ''}${wide ? ' sheet-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <div className="sheet-grip" aria-hidden="true" />
        <div className="sheet-head">
          <h2 id={titleId} className={hideTitle ? 'sr-only' : 'label'} style={{ color: 'var(--ink2)' }}>
            {title}
          </h2>
          {hideTitle ? <span /> : null}
          <button type="button" className="icon-btn" onClick={close} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </>
  );
}

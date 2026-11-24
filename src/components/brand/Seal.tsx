'use client';

import { useId } from 'react';

type SealProps = {
  size?: number | string;
  /** Rotate the text ring, 40s per turn. */
  spin?: boolean;
  className?: string;
  /** Override ring text. */
  ring?: string;
  title?: string;
  style?: React.CSSProperties;
};

export const SEAL_RING = '• MEDIA PASSPORT • REPUBLIC OF TASTE • EST. 2026 ';

/** 2.5.1 Seal logo — SVG, 200×200 viewBox. */
export function Seal({ size = 120, spin = false, className, ring = SEAL_RING, title, style }: SealProps) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const pathId = `seal-ring-${id}`;
  const circumference = 2 * Math.PI * 72;
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={['seal', spin ? 'seal-spin' : '', className].filter(Boolean).join(' ')}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={style}
      focusable="false"
    >
      <defs>
        <path id={pathId} d="M 28,100 a 72,72 0 1,1 144,0 a 72,72 0 1,1 -144,0" fill="none" />
      </defs>
      <circle cx="100" cy="100" r="96" fill="#F9F6F0" stroke="#D95D74" strokeWidth="5" />
      <circle cx="100" cy="100" r="88" fill="none" stroke="#D95D74" strokeWidth="1.2" strokeDasharray="3 3" />
      <g className="seal-ring" style={{ transformBox: 'view-box', transformOrigin: '50% 50%' }}>
        <text
          fill="#181716"
          style={{ fontFamily: 'var(--f-display)', fontSize: 17, letterSpacing: 0 }}
          textLength={circumference - 2}
          lengthAdjust="spacing"
        >
          <textPath href={`#${pathId}`} startOffset="0">
            {ring}
          </textPath>
        </text>
      </g>
      <circle cx="100" cy="100" r="54" fill="#181716" />
      <circle cx="100" cy="100" r="48" fill="none" stroke="#F5F1E8" strokeWidth="1.2" strokeDasharray="4 3" />
      <path
        d="M100,60 L103.5,69.2 L113.3,69.6 L105.6,75.6 L108.2,85 L100,79.6 L91.8,85 L94.4,75.6 L86.7,69.6 L96.5,69.2 Z"
        fill="#D95D74"
      />
      <text
        x="100"
        y="114"
        textAnchor="middle"
        fill="#F5F1E8"
        style={{ fontFamily: 'var(--f-display)', fontSize: 30, letterSpacing: '0.02em' }}
      >
        STMP
      </text>
      <text
        x="100"
        y="126"
        textAnchor="middle"
        fill="#D95D74"
        style={{ fontFamily: 'var(--f-mono)', fontSize: 7, letterSpacing: '0.2em', fontWeight: 700 }}
      >
        PASSPORT
      </text>
    </svg>
  );
}

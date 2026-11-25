'use client';

import { useId } from 'react';
import { countryName, KIND_LABEL } from '@/lib/catalog';
import { formatDate } from '@/lib/format';
import { hash } from '@/lib/hash';
import { useStore } from '@/lib/store/store';
import type { Item, Place, Stamp as StampT } from '@/lib/types';

export type StampShape = 'round' | 'rect' | 'oval' | 'oct';
export const SHAPES: StampShape[] = ['round', 'rect', 'oval', 'oct'];

export const PLACE_INK: Record<Place, string> = {
  home: 'var(--ink-home)',
  out: 'var(--ink-out)',
  event: 'var(--ink-event)',
};

/** Place labels by kind — film: Home / Theater / Festival · album: Home / Out / Concert · others: Home / Out / Event. */
export function placeLabel(kind: Item['kind'], place: Place): string {
  if (place === 'home') return 'Home';
  if (kind === 'film') return place === 'out' ? 'Theater' : 'Festival';
  if (kind === 'album') return place === 'out' ? 'Out' : 'Concert';
  return place === 'out' ? 'Out' : 'Event';
}

export function truncateTitle(t: string, max = 20): string {
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trimEnd() + '…';
}

/** Shape and rotation (−8…+8°) from hash(itemId + date). */
export function stampLook(itemId: string, date: string): { shape: StampShape; rotate: number; seed: number } {
  const h = hash(itemId + date);
  return { shape: SHAPES[h % 4], rotate: ((h >>> 2) % 17) - 8, seed: h % 997 };
}

function fitSize(text: string, maxWidth: number, max: number, min = 8, em = 0.5): number {
  const n = Math.max(1, text.length);
  return Math.max(min, Math.min(max, maxWidth / (n * em)));
}

function StarsRow({ rating, y, size = 7.5, gap = 11 }: { rating: number; y: number; size?: number; gap?: number }) {
  if (!rating) return null;
  const startX = 80 - 2 * gap;
  const pts = (cx: number) => {
    const out: string[] = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? size / 2 : size / 4.6;
      const a = (Math.PI / 5) * i - Math.PI / 2;
      out.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(y + r * Math.sin(a)).toFixed(2)}`);
    }
    return out.join(' ');
  };
  return (
    <g>
      {[0, 1, 2, 3, 4].map((i) => (
        <polygon
          key={i}
          points={pts(startX + i * gap)}
          fill={i < rating ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth={i < rating ? 0 : 0.9}
        />
      ))}
    </g>
  );
}

export type StampArtProps = {
  shape: StampShape;
  /** big title (rect/oval/oct centre, round top arc) */
  title: string;
  /** small line: rect/oval/oct top label */
  top?: string;
  /** round: bottom arc text */
  bottom?: string;
  /** round: big word in the centre (ADMITTED, EXIT…) */
  center?: string;
  date: string;
  rating: number;
  ink: string;
  rotate?: number;
  seed?: number;
  label: string;
  className?: string;
  style?: React.CSSProperties;
};

const MONO: React.CSSProperties = { fontFamily: 'var(--f-mono)', fontWeight: 700 };

/** 2.5.2 Rubber stamp — SVG 160×160 with a worn-ink filter. */
export function StampArt({ shape, title, top, bottom, center, date, rating, ink, rotate = 0, seed = 7, label, className, style }: StampArtProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  // Modern sets stamps in a wide sans (SF / Inter) instead of condensed Anton: fit by a wider glyph.
  const modern = useStore((s) => s.look === 'modern');
  const em = modern ? 0.72 : 0.5;
  const DISPLAY: React.CSSProperties = modern ? { fontFamily: 'var(--f-display)', fontWeight: 800 } : { fontFamily: 'var(--f-display)' };
  const f = `ink-${uid}`;
  const topArc = `ta-${uid}`;
  const botArc = `ba-${uid}`;
  const t = truncateTitle(title).toUpperCase();

  let body: React.ReactNode;
  if (shape === 'round') {
    const arcTitle = (center ? title : t).toUpperCase();
    body = (
      <>
        <circle cx="80" cy="80" r="74" fill="none" stroke="currentColor" strokeWidth="3.4" />
        <circle cx="80" cy="80" r="66" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <path id={topArc} d="M 27,80 a 53,53 0 1,1 106,0" fill="none" />
        <path id={botArc} d="M 18,80 a 62,62 0 0,0 124,0" fill="none" />
        <text fill="currentColor" textAnchor="middle" style={{ ...DISPLAY, fontSize: fitSize(arcTitle, 150, 14, 7, em * 1.04), letterSpacing: '0.06em' }}>
          <textPath href={`#${topArc}`} startOffset="50%">
            {arcTitle}
          </textPath>
        </text>
        {bottom ? (
          <text fill="currentColor" textAnchor="middle" style={{ ...MONO, fontSize: fitSize(bottom, 132, 8.2, 5.5, 0.78), letterSpacing: '0.16em' }}>
            <textPath href={`#${botArc}`} startOffset="50%">
              {bottom.toUpperCase()}
            </textPath>
          </text>
        ) : null}
        {center ? (
          <>
            <text x="80" y="84" textAnchor="middle" fill="currentColor" style={{ ...DISPLAY, fontSize: fitSize(center, 84, 24, 9, em * 1.04), letterSpacing: '0.03em' }}>
              {center.toUpperCase()}
            </text>
            <line x1="44" x2="116" y1="91" y2="91" stroke="currentColor" strokeWidth="1" />
            <text x="80" y="102" textAnchor="middle" fill="currentColor" style={{ ...MONO, fontSize: 8.6, letterSpacing: '0.08em' }}>
              {date}
            </text>
            <StarsRow rating={rating} y={112} size={6.5} gap={9.5} />
          </>
        ) : (
          <>
            <line x1="40" x2="120" y1="70" y2="70" stroke="currentColor" strokeWidth="1" />
            <text x="80" y="85.5" textAnchor="middle" fill="currentColor" style={{ ...MONO, fontSize: 11, letterSpacing: '0.06em' }}>
              {date}
            </text>
            <line x1="40" x2="120" y1="92" y2="92" stroke="currentColor" strokeWidth="1" />
            <StarsRow rating={rating} y={104} />
          </>
        )}
      </>
    );
  } else if (shape === 'rect') {
    body = (
      <>
        <rect x="8" y="28" width="144" height="104" fill="none" stroke="currentColor" strokeWidth="3.4" />
        <rect x="14.5" y="34.5" width="131" height="91" fill="none" stroke="currentColor" strokeWidth="1.1" />
        {top ? (
          <text x="80" y="52" textAnchor="middle" fill="currentColor" style={{ ...MONO, fontSize: fitSize(top, 112, 8, 5.5, 0.8), letterSpacing: '0.2em' }}>
            {top.toUpperCase()}
          </text>
        ) : null}
        <text x="80" y="80" textAnchor="middle" fill="currentColor" style={{ ...DISPLAY, fontSize: fitSize(t, 120, 24, 8, em), letterSpacing: '0.02em' }}>
          {t}
        </text>
        <text x="80" y="100" textAnchor="middle" fill="currentColor" style={{ ...MONO, fontSize: 11, letterSpacing: '0.06em' }}>
          {date}
        </text>
        <StarsRow rating={rating} y={114} />
      </>
    );
  } else if (shape === 'oval') {
    body = (
      <>
        <ellipse cx="80" cy="80" rx="75" ry="54" fill="none" stroke="currentColor" strokeWidth="3.4" />
        <ellipse cx="80" cy="80" rx="67.5" ry="46.5" fill="none" stroke="currentColor" strokeWidth="1.1" />
        {top ? (
          <text x="80" y="57" textAnchor="middle" fill="currentColor" style={{ ...MONO, fontSize: fitSize(top, 96, 7.6, 5, 0.8), letterSpacing: '0.18em' }}>
            {top.toUpperCase()}
          </text>
        ) : null}
        <text x="80" y="83" textAnchor="middle" fill="currentColor" style={{ ...DISPLAY, fontSize: fitSize(t, 112, 22, 7, em), letterSpacing: '0.02em' }}>
          {t}
        </text>
        <text x="80" y="100" textAnchor="middle" fill="currentColor" style={{ ...MONO, fontSize: 10, letterSpacing: '0.06em' }}>
          {date}
        </text>
        <StarsRow rating={rating} y={112} size={6.5} gap={9.5} />
      </>
    );
  } else {
    const oct = (r: number) =>
      Array.from({ length: 8 }, (_, i) => {
        const a = (Math.PI / 4) * i + Math.PI / 8;
        return `${(80 + r * Math.cos(a)).toFixed(2)},${(80 + r * Math.sin(a)).toFixed(2)}`;
      }).join(' ');
    body = (
      <>
        <polygon points={oct(74)} fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinejoin="miter" />
        <polygon points={oct(66.5)} fill="none" stroke="currentColor" strokeWidth="1.1" />
        {top ? (
          <text x="80" y="50" textAnchor="middle" fill="currentColor" style={{ ...MONO, fontSize: fitSize(top, 92, 8, 5, 0.8), letterSpacing: '0.2em' }}>
            {top.toUpperCase()}
          </text>
        ) : null}
        <text x="80" y="81" textAnchor="middle" fill="currentColor" style={{ ...DISPLAY, fontSize: fitSize(t, 116, 22, 7, em), letterSpacing: '0.02em' }}>
          {t}
        </text>
        <text x="80" y="100" textAnchor="middle" fill="currentColor" style={{ ...MONO, fontSize: 10.5, letterSpacing: '0.06em' }}>
          {date}
        </text>
        <StarsRow rating={rating} y={114} />
      </>
    );
  }

  return (
    <svg
      viewBox="0 0 160 160"
      className={['stamp-svg', className].filter(Boolean).join(' ')}
      role="img"
      aria-label={label}
      style={{ color: ink, ...style }}
      focusable="false"
    >
      <defs>
        <filter id={f} x="-6%" y="-6%" width="112%" height="112%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={seed} result="grain" />
          <feDisplacementMap in="SourceGraphic" in2="grain" scale="1.4" xChannelSelector="R" yChannelSelector="G" result="moved" />
          <feTurbulence type="fractalNoise" baseFrequency="0.32" numOctaves="3" seed={seed + 11} result="wear" />
          <feColorMatrix in="wear" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  5.6 0 0 0 -1.32" result="mask" />
          <feComposite in="moved" in2="mask" operator="in" />
        </filter>
      </defs>
      <g transform={`rotate(${rotate} 80 80)`} filter={`url(#${f})`}>
        {body}
      </g>
    </svg>
  );
}

/** A passport stamp for an item. */
export function ItemStamp({ item, stamp, className, style }: { item: Item; stamp: Pick<StampT, 'date' | 'rating' | 'place'>; className?: string; style?: React.CSSProperties }) {
  const look = stampLook(item.id, stamp.date);
  const kind = KIND_LABEL[item.kind].toUpperCase();
  const place = placeLabel(item.kind, stamp.place).toUpperCase();
  const country = countryName(item.cc).toUpperCase();
  const date = formatDate(stamp.date);
  const top =
    look.shape === 'rect'
      ? `ADMITTED • ${kind}`
      : look.shape === 'oct'
        ? `VISA • ${kind}`
        : country
          ? `${place} — ${country}`
          : place;
  const label = `${item.title} stamp, ${stamp.rating ? `${stamp.rating} of 5, ` : ''}${date}`;
  return (
    <StampArt
      shape={look.shape}
      title={item.title}
      top={top}
      bottom={country ? `${place} • ${country}` : place}
      date={date}
      rating={stamp.rating}
      ink={PLACE_INK[stamp.place]}
      rotate={look.rotate}
      seed={look.seed}
      label={label}
      className={className}
      style={style}
    />
  );
}

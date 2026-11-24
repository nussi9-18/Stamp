'use client';

import { LEVEL_NAMES, LEVEL_VARS, VECTOR_NAMES, formatScore, heatOf } from '@/lib/heat';
import { over } from '@/lib/shield';
import type { Item, Rating } from '@/lib/types';
import { Icon } from '../brand/Icon';

/** "★★★★☆" in text with an accessible label. */
export function StarsText({ rating, className }: { rating: number; className?: string }) {
  if (!rating) return <span className={['stars-text', className].filter(Boolean).join(' ')}>—</span>;
  return (
    <span className={['stars-text', className].filter(Boolean).join(' ')} aria-label={`${rating} of 5 stars`}>
      <span aria-hidden="true">{'★'.repeat(rating) + '☆'.repeat(5 - rating)}</span>
    </span>
  );
}

export function StarsInput({ value, onChange, invalid, describedBy }: { value: Rating; onChange: (r: Rating) => void; invalid?: boolean; describedBy?: string }) {
  return (
    <div className="stars-input" role="group" aria-label="Rating" aria-describedby={describedBy} aria-invalid={invalid || undefined}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className="star-btn"
          aria-pressed={value >= n}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          onClick={() => onChange((value === n ? 0 : n) as Rating)}
          style={invalid ? { borderColor: 'var(--rose-d)' } : undefined}
        >
          <Icon name={value >= n ? 'star-fill' : 'star'} />
        </button>
      ))}
    </div>
  );
}

/** Coloured square + tier + score, e.g. "Peak 9.4". */
export function HeatChip({ item }: { item: Pick<Item, 'v'> }) {
  const h = heatOf(item);
  if (!h) return <span className="heat-chip">No heat data</span>;
  return (
    <span className="heat-chip">
      <span className="heat-sq" style={{ background: LEVEL_VARS[h.tier] }} aria-hidden="true" />
      {h.label}
    </span>
  );
}

/** Heat box: big score "9.4/10", tier chip, "Past your shield"; 8 rows with 3 cells. Rows over the shield turn rose. */
export function HeatBox({ item, limits, caption }: { item: Pick<Item, 'v'>; limits?: number[]; caption?: string }) {
  const h = heatOf(item);
  if (!h || !item.v) {
    return (
      <div className="heatbox">
        <div className="heatbox-head">
          <span className="label">Heat index</span>
        </div>
        <p className="body2">No heat data</p>
      </div>
    );
  }
  const o = limits ? over(item, limits) : [];
  return (
    <div className="heatbox">
      <div className="heatbox-head">
        <div className="heatbox-score">
          <span className="display heatbox-num">{formatScore(h.score)}</span>
          <span className="display heatbox-of">/10</span>
        </div>
        <div className="heatbox-meta">
          {caption ? <span className="label">{caption}</span> : <span className="label">Heat index</span>}
          <span className="heat-chip" style={{ fontSize: 12 }}>
            <span className="heat-sq" style={{ background: LEVEL_VARS[h.tier] }} aria-hidden="true" />
            {LEVEL_NAMES[h.tier]}
          </span>
          {o.length ? <span className="warn-line">Past your shield</span> : null}
        </div>
      </div>
      <ul className="heat-rows">
        {item.v.map((lvl, i) => {
          const past = o.includes(i);
          return (
            <li key={i} className={`heat-row${past ? ' is-past' : ''}`}>
              <span className="heat-name">{VECTOR_NAMES[i]}</span>
              <span className="heat-cells" aria-hidden="true">
                {[1, 2, 3].map((c) => (
                  <span key={c} className="heat-cell" style={c <= lvl ? { background: LEVEL_VARS[lvl], borderColor: LEVEL_VARS[lvl] } : undefined} />
                ))}
              </span>
              <span className="heat-level">{LEVEL_NAMES[lvl]}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function Avatar({ name, color, size = 44 }: { name: string; color: string; size?: number }) {
  const parts = name.trim().split(/\s+/);
  const ini = (parts[0]?.[0] ?? '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '');
  return (
    <span className="avatar" style={{ width: size, height: size, background: color, fontSize: size * 0.42 }} aria-hidden="true">
      {ini.toUpperCase()}
    </span>
  );
}

export function AiLabel() {
  return <span className="ai-label">AI</span>;
}

'use client';

import { useLook } from '@/lib/store/store';

/** Page heading: Retro keeps the poster-style title, Modern a short plain one. */
export function PageTitle({ retro, modern, sub, keepSub, children }: { retro: React.ReactNode; modern: string; sub?: string; keepSub?: boolean; children?: React.ReactNode }) {
  const look = useLook();
  return (
    <header className="page-head">
      <h1 className="page-title">{look === 'modern' ? modern : retro}</h1>
      {sub ? <p className={`subtitle page-sub${keepSub ? ' keep' : ''}`}>{sub}</p> : null}
      {children}
    </header>
  );
}

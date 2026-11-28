'use client';

import { useState } from 'react';
import { parseVideo, thumbUrl, type Short } from '@/lib/shorts';
import { posterLook } from '../brand/Poster';

/** 16:9 still for a short: the YouTube frame, or a printed title card (Vimeo, samples). */
export function ShortThumb({ short: s, hero = false }: { short: Short; hero?: boolean }) {
  const [broken, setBroken] = useState(false);
  const src = s.url ? thumbUrl(parseVideo(s.url), hero ? 'hero' : 'card') : null;
  const { palette, pattern } = posterLook(s.id);
  const [bg, fg, ac] = palette;
  return (
    <span className={`sthumb${hero ? ' is-hero' : ''}`} style={{ '--bg': bg, '--fg': fg, '--ac': ac } as React.CSSProperties} aria-hidden="true">
      {src && !broken ? (
        // A remote still frame; next/image would proxy it through our server for no gain.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
      ) : (
        <>
          <span className={`poster-pattern ${pattern}`} />
          <span className="sthumb-title">{s.title}</span>
        </>
      )}
      <span className="sthumb-mins">{s.mins} min</span>
    </span>
  );
}

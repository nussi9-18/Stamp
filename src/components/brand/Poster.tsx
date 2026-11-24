import { KIND_LABEL } from '@/lib/catalog';
import { hash } from '@/lib/hash';
import type { Item } from '@/lib/types';

/** [bg, fg, accent] */
export const PALETTES: [string, string, string][] = [
  ['#181716', '#F5F1E8', '#D95D74'],
  ['#D95D74', '#181716', '#F5C6D0'],
  ['#7EA8BE', '#181716', '#F9F6F0'],
  ['#2F4A3C', '#F5F1E8', '#B8894A'],
  ['#B8894A', '#181716', '#F5F1E8'],
  ['#F5C6D0', '#181716', '#D95D74'],
  ['#24324A', '#F5C6D0', '#7EA8BE'],
  ['#E2DCCE', '#181716', '#7EA8BE'],
];
const PATTERNS = ['p-dots', 'p-circle', 'p-stripes', 'p-split'] as const;

export function posterLook(id: string) {
  const h = hash(id);
  return { palette: PALETTES[h % 8], pattern: PATTERNS[(h >>> 3) % 4] };
}

type PosterProps = {
  item: Pick<Item, 'id' | 'title' | 'year' | 'by' | 'kind'>;
  /** black number tag (1–9) top-left */
  tag?: number;
  gated?: boolean;
  className?: string;
  /** decorative when the title is already next to it */
  decorative?: boolean;
};

/** 2.5.3 Typographic poster — no real posters (copyright). 2:3, albums 1:1. */
export function Poster({ item, tag, gated = false, className, decorative = true }: PosterProps) {
  const { palette, pattern } = posterLook(item.id);
  const [bg, fg, ac] = palette;
  const longest = Math.max(4, ...item.title.split(/\s+/).map((w) => w.length));
  return (
    <div
      className={['poster', item.kind === 'album' ? 'is-square' : '', gated ? 'is-gated' : '', tag ? 'has-tag' : '', className].filter(Boolean).join(' ')}
      style={{ '--bg': bg, '--fg': fg, '--ac': ac, '--lw': longest } as React.CSSProperties}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : `${item.title} poster`}
      aria-hidden={decorative ? true : undefined}
    >
      <div className={`poster-pattern ${pattern}`} />
      {item.year ? <div className="poster-year">{item.year}</div> : null}
      {item.kind !== 'film' ? <div className="poster-kind">{KIND_LABEL[item.kind]}</div> : null}
      <div className="poster-foot">
        <div className="poster-title">{item.title}</div>
        {item.by ? <div className="poster-by">{item.by}</div> : null}
      </div>
      {tag ? <div className="poster-tag">{tag}</div> : null}
      {gated ? (
        <div className="poster-gate">
          <span>Shield</span>
        </div>
      ) : null}
    </div>
  );
}

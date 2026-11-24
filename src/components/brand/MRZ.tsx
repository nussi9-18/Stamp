import { mrzLines } from '@/lib/mrz';

/** 2.5.8 MRZ block — two 44-char lines, JetBrains Mono bold, letter-spacing .16em, fitted to width. */
export function MRZ({
  name,
  passportNo,
  stamps,
  issued,
  lines,
  className,
}: {
  name?: string;
  passportNo?: string;
  stamps?: number;
  issued?: string;
  lines?: [string, string];
  className?: string;
}) {
  const [l1, l2] = lines ?? mrzLines(name ?? '', passportNo ?? 'STMP-0000', stamps ?? 0, issued ?? '2026-01-01');
  return (
    <div className={['mrz', className].filter(Boolean).join(' ')} aria-label="Machine-readable zone" role="img">
      <span className="mrz-line" aria-hidden="true">
        {l1}
      </span>
      <span className="mrz-line" aria-hidden="true">
        {l2}
      </span>
    </div>
  );
}

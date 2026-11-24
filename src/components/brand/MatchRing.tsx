/** 2.5.9 Match ring — 62px SVG ring, rose arc = %, Anton number in the middle. */
export function MatchRing({ pct, size = 62, light = false }: { pct: number | null; size?: number; light?: boolean }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const p = pct === null ? 0 : Math.max(0, Math.min(100, pct));
  const fg = light ? '#F5F1E8' : 'var(--ink)';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 62 62"
      role="img"
      aria-label={pct === null ? 'New — no shared stamps yet' : `${pct}% taste match`}
      style={{ flex: 'none' }}
    >
      <circle cx="31" cy="31" r={r} fill="none" stroke={light ? 'rgba(245,241,232,.25)' : 'var(--rule)'} strokeWidth="5" />
      {pct !== null ? (
        <circle
          cx="31"
          cy="31"
          r={r}
          fill="none"
          stroke="var(--rose)"
          strokeWidth="5"
          strokeDasharray={`${(c * p) / 100} ${c}`}
          transform="rotate(-90 31 31)"
        />
      ) : null}
      <text
        x="31"
        y={pct === null ? 34.5 : 36.5}
        textAnchor="middle"
        fill={fg}
        style={{ fontFamily: pct === null ? 'var(--f-mono)' : 'var(--f-display)', fontSize: pct === null ? 9 : 17, fontWeight: pct === null ? 700 : 400, letterSpacing: pct === null ? '0.1em' : 0 }}
      >
        {pct === null ? 'NEW' : `${pct}`}
      </text>
    </svg>
  );
}

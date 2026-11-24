import { yymmdd } from './format';

const LEN = 44;

/** Uppercase A–Z only; accents folded, everything else becomes a filler. */
export function mrzText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '<')
    .replace(/^<+|<+$/g, '');
}

function fit(line: string): string {
  return line.length >= LEN ? line.slice(0, LEN) : line + '<'.repeat(LEN - line.length);
}

/**
 * Line 1: P<STMP{LASTNAME}<<{FIRSTNAMES} padded with <.
 * Line 2: {PASSPORTNO without dash}<{stampCount 3 digits}MEDIA{issued YYMMDD}<<TASTE padded with <.
 */
export function mrzLines(name: string, passportNo: string, stampCount: number, issued: string): [string, string] {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const last = mrzText(parts.length > 1 ? parts[parts.length - 1] : parts[0] ?? 'HOLDER') || 'HOLDER';
  const first = parts.length > 1 ? parts.slice(0, -1).map(mrzText).filter(Boolean).join('<') : '';
  const l1 = fit(`P<STMP${last}<<${first}`);
  const no = passportNo.replace(/-/g, '').toUpperCase();
  const count = String(Math.max(0, Math.min(999, stampCount))).padStart(3, '0');
  const l2 = fit(`${no}<${count}MEDIA${yymmdd(issued)}<<TASTE`);
  return [l1, l2];
}

export function newPassportNo(): string {
  const n = Math.floor(Math.random() * 10000);
  return `STMP-${String(n).padStart(4, '0')}`;
}

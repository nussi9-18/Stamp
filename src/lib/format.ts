const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
export const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pad(n: number, w = 2): string {
  return String(n).padStart(w, '0');
}

/** Local calendar date as YYYY-MM-DD. */
export function todayISO(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function isISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** "18 NOV 2026" — dates are always DD MMM YYYY uppercase. */
export function formatDate(iso: string): string {
  if (!isISODate(iso)) return iso.toUpperCase();
  const [y, m, d] = iso.split('-').map(Number);
  return `${pad(d)} ${MONTHS[m - 1]} ${y}`;
}

/** "261118" */
export function yymmdd(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${y.slice(2)}${m}${d}`;
}

export function yearOf(iso: string): number {
  return Number(iso.slice(0, 4));
}

export function monthOf(iso: string): number {
  return Number(iso.slice(5, 7)) - 1;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/** Hours from minutes: one decimal under ten hours, whole hours above. */
export function formatHours(mins: number): string {
  const h = mins / 60;
  if (h < 10) return (Math.round(h * 10) / 10).toFixed(1);
  return String(Math.round(h));
}

export function formatAvg(ratings: number[]): string {
  const r = ratings.filter((x) => x > 0);
  if (!r.length) return '—';
  return (Math.round((r.reduce((a, b) => a + b, 0) / r.length) * 10) / 10).toFixed(1);
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function pad2(n: number): string {
  return pad(n);
}

/** Relative time for real dispatches: "2 h", "3 d", "1 w". */
export function ago(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min`;
  if (s < 86400) return `${Math.round(s / 3600)} h`;
  if (s < 86400 * 7) return `${Math.round(s / 86400)} d`;
  return `${Math.round(s / (86400 * 7))} w`;
}

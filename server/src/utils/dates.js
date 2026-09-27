// All leave dates are stored as UTC midnight so a "day" never shifts with time zones.

export function toUTCDate(value) {
  if (!value) return null;
  const d = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + 'T00:00:00Z') : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function todayUTC() {
  const n = new Date();
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
}

export const isoDay = (d) => new Date(d).toISOString().slice(0, 10);

export const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

export const diffDays = (a, b) => Math.round((a.getTime() - b.getTime()) / 86400000);

export function eachDay(start, end, fn) {
  for (let d = new Date(start); d <= end; d = addDays(d, 1)) fn(d);
}

export const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });

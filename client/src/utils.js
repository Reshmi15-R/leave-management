export const ROLE_LABELS = {
  team_member: 'Team Member',
  team_leader: 'Team Leader',
  team_manager: 'Team Manager',
  general_manager: 'General Manager',
  admin: 'Administrator',
};
export const ROLES = Object.keys(ROLE_LABELS);

export const isApprover = (u) => ['team_leader', 'team_manager', 'general_manager', 'admin'].includes(u?.role);
export const canOverride = (u) => ['team_manager', 'general_manager', 'admin'].includes(u?.role);
export const isAdmin = (u) => ['general_manager', 'admin'].includes(u?.role);

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—';

export const fmtShort = (d) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' }) : '—';

export const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export const isoDay = (d) => new Date(d).toISOString().slice(0, 10);

export const localISO = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const dateRange = (l) => {
  if (l.halfDay) return `${fmtDate(l.startDate)} (${l.halfDaySession === 'first' ? '1st' : '2nd'} half)`;
  return isoDay(l.startDate) === isoDay(l.endDate) ? fmtDate(l.startDate) : `${fmtShort(l.startDate)} – ${fmtDate(l.endDate)}`;
};

export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export const yearOptions = () => {
  const y = new Date().getFullYear();
  return [y + 1, y, y - 1, y - 2];
};

export const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');

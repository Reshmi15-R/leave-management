import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api, { errMsg } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { PageHead, Spinner } from '../components/ui.jsx';
import LeaveDetailModal from '../components/LeaveDetail.jsx';
import Icon from '../components/Icon.jsx';
import { isAdmin, isApprover, isoDay, localISO } from '../utils.js';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MAX_CHIPS = 3;

export default function TeamCalendar() {
  const { user } = useAuth();
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [includePending, setIncludePending] = useState(true);
  const [department, setDepartment] = useState('');
  const [departments, setDepartments] = useState([]);
  const [data, setData] = useState(null);
  const [viewing, setViewing] = useState(null);

  const monthKey = `${ym.y}-${String(ym.m + 1).padStart(2, '0')}`;

  useEffect(() => {
    if (isAdmin(user)) api.get('/departments').then((r) => setDepartments(r.data)).catch(() => {});
  }, [user]);

  useEffect(() => {
    setData(null);
    api
      .get('/leaves/calendar', { params: { month: monthKey, includePending, department: department || undefined } })
      .then((r) => setData(r.data))
      .catch((e) => toast.error(errMsg(e)));
  }, [monthKey, includePending, department]);

  const cells = useMemo(() => {
    const first = new Date(Date.UTC(ym.y, ym.m, 1));
    const offset = (first.getUTCDay() + 6) % 7;
    const daysInMonth = new Date(Date.UTC(ym.y, ym.m + 1, 0)).getUTCDate();
    const total = Math.ceil((offset + daysInMonth) / 7) * 7;
    return Array.from({ length: total }, (_, i) => new Date(Date.UTC(ym.y, ym.m, i - offset + 1)));
  }, [ym]);

  const shift = (delta) => {
    const d = new Date(ym.y, ym.m + delta, 1);
    setYm({ y: d.getFullYear(), m: d.getMonth() });
  };

  const today = localISO();
  const legend = data ? [...new Map(data.leaves.map((l) => [l.leaveType._id, l.leaveType])).values()] : [];

  const canOpen = (l) => isApprover(user) || l.employee._id === user._id;
  const openLeave = async (id) => {
    try {
      setViewing((await api.get(`/leaves/${id}`)).data);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div>
      <PageHead
        title="Team calendar"
        subtitle={isApprover(user) ? 'Leave across your reporting line.' : 'Your leave and your teammates’ leave.'}
      />
      <div className="card">
        <div className="card-head">
          <div className="row">
            <button className="icon-btn" onClick={() => shift(-1)} aria-label="Previous month"><Icon name="chevronLeft" /></button>
            <h2 style={{ minWidth: 150, textAlign: 'center' }}>
              {new Date(ym.y, ym.m, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
            </h2>
            <button className="icon-btn" onClick={() => shift(1)} aria-label="Next month"><Icon name="chevronRight" /></button>
            <button className="btn sm" onClick={() => setYm({ y: now.getFullYear(), m: now.getMonth() })}>Today</button>
          </div>
          <div className="row">
            {departments.length > 0 && (
              <select className="input sm" value={department} onChange={(e) => setDepartment(e.target.value)} aria-label="Department">
                <option value="">All departments</option>
                {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
              </select>
            )}
            <label className="check small">
              <input type="checkbox" checked={includePending} onChange={(e) => setIncludePending(e.target.checked)} /> Show pending
            </label>
          </div>
        </div>
        {legend.length > 0 && (
          <div className="row" style={{ padding: '10px 18px', gap: 16 }}>
            {legend.map((t) => (
              <span key={t._id} className="type-chip small"><span className="swatch" style={{ background: t.color }} />{t.name}</span>
            ))}
            {includePending && <span className="small muted"><em>Italic, dashed = pending</em></span>}
          </div>
        )}
        {!data ? (
          <Spinner />
        ) : (
          <div className="table-wrap">
            <div className="cal" style={{ minWidth: 640 }}>
              {DOW.map((d) => <div key={d} className="cal-dow">{d}</div>)}
              {cells.map((d) => {
                const key = isoDay(d);
                const inMonth = d.getUTCMonth() === ym.m;
                const working = data.workingDays.includes(d.getUTCDay());
                const holiday = data.holidays.find((h) => isoDay(h.date) === key);
                const dayLeaves = inMonth && working && !holiday
                  ? data.leaves.filter((l) => isoDay(l.startDate) <= key && isoDay(l.endDate) >= key)
                  : [];
                const cls = ['cal-cell', !inMonth && 'outside', inMonth && !working && 'off', holiday && inMonth && 'holiday', key === today && 'today']
                  .filter(Boolean)
                  .join(' ');
                return (
                  <div key={key} className={cls}>
                    <div className="cal-date">{d.getUTCDate()}</div>
                    {holiday && inMonth && <div className="cal-holiday" title={holiday.name}>{holiday.name}</div>}
                    {dayLeaves.slice(0, MAX_CHIPS).map((l) => (
                      <div
                        key={l._id}
                        className={`cal-chip ${l.status}`}
                        style={{ borderLeftColor: l.leaveType.color, cursor: canOpen(l) ? 'pointer' : 'default' }}
                        title={`${l.employee.name} — ${l.leaveType.name} (${l.status})${l.halfDay ? ', half day' : ''}`}
                        onClick={() => canOpen(l) && openLeave(l._id)}
                      >
                        {l.employee.name.split(' ')[0]}{l.halfDay ? ' ½' : ''}
                      </div>
                    ))}
                    {dayLeaves.length > MAX_CHIPS && (
                      <div className="cal-more" title={dayLeaves.slice(MAX_CHIPS).map((l) => l.employee.name).join(', ')}>
                        +{dayLeaves.length - MAX_CHIPS} more
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {viewing && <LeaveDetailModal leave={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

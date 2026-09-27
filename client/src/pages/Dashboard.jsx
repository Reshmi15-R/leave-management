import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import BalanceCard from '../components/BalanceCard.jsx';
import { Alert, Empty, PageHead, Spinner, Stat, StatusBadge, TypeChip } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { dateRange, fmtDate, initials, plural } from '../utils.js';

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/dashboard').then((r) => setData(r.data)).catch((e) => setError(errMsg(e)));
  }, []);

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!data) return <Spinner />;

  const paid = data.balances.filter((b) => b.leaveType.isPaid);
  const totalAvailable = paid.reduce((s, b) => s + b.available, 0);
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="stack">
      <PageHead title={`${greet}, ${user.name.split(' ')[0]}`} subtitle={`Here's your leave overview for ${data.year}.`}>
        <Link to="/apply" className="btn primary"><Icon name="plus" /> Apply for leave</Link>
      </PageHead>

      <div className="grid grid-4">
        <Stat label="Paid leave available" value={Math.round(totalAvailable * 10) / 10} hint="days across all types" />
        <Stat label="Days taken" value={data.stats.daysTaken} hint={`in ${data.year}`} />
        <Stat label="Pending requests" value={data.stats.pending} hint="awaiting approval" />
        <Stat label="Approved requests" value={data.stats.approved} hint={`${data.stats.rejected} rejected`} />
      </div>

      {data.team && (
        <div className="grid grid-3">
          <div className="card">
            <div className="card-head">
              <h2>Awaiting your approval</h2>
              <Link to="/approvals" className="small">Review →</Link>
            </div>
            <div className="card-body">
              <div className="stat" style={{ padding: 0 }}>
                <div className="value">{data.team.pendingApprovals}</div>
                <div className="hint">{plural(data.team.size, 'team member')} in your reporting line</div>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h2>Out today</h2></div>
            <div className="card-body">
              {data.team.onLeaveToday.length === 0 ? (
                <p className="muted">Everyone is in today.</p>
              ) : (
                data.team.onLeaveToday.map((l) => (
                  <div key={l._id} className="list-item">
                    <div className="avatar sm">{initials(l.employee.name)}</div>
                    <div className="grow">{l.employee.name}</div>
                    <TypeChip type={l.leaveType} />
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="card">
            <div className="card-head">
              <h2>Team: next 14 days</h2>
              <Link to="/calendar" className="small">Calendar →</Link>
            </div>
            <div className="card-body">
              {data.team.upcoming.length === 0 ? (
                <p className="muted">No approved leave coming up.</p>
              ) : (
                data.team.upcoming.map((l) => (
                  <div key={l._id} className="list-item">
                    <span className="swatch" style={{ background: l.leaveType.color }} />
                    <div className="grow">{l.employee.name}</div>
                    <span className="muted small">{dateRange(l)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <div>
        <h2 style={{ marginBottom: 12 }}>Leave balances</h2>
        <div className="tiles">
          {data.balances.map((b) => <BalanceCard key={b._id} balance={b} />)}
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-head">
            <h2>Upcoming & pending leave</h2>
            <Link to="/my-leaves" className="small">All requests →</Link>
          </div>
          {data.upcoming.length === 0 ? (
            <Empty>No upcoming leave. <Link to="/apply">Plan some time off</Link></Empty>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <tbody>
                  {data.upcoming.map((l) => (
                    <tr key={l._id}>
                      <td><TypeChip type={l.leaveType} /></td>
                      <td>{dateRange(l)}</td>
                      <td className="num">{l.days}d</td>
                      <td><StatusBadge status={l.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="card">
          <div className="card-head"><h2>Upcoming holidays</h2></div>
          {data.holidays.length === 0 ? (
            <Empty>No holidays configured.</Empty>
          ) : (
            <div className="card-body" style={{ paddingTop: 6, paddingBottom: 6 }}>
              {data.holidays.map((h) => (
                <div key={h._id} className="list-item">
                  <Icon name="calendar" />
                  <div className="grow">{h.name}</div>
                  <span className="ink-2">
                    {fmtDate(h.date)} · {new Date(h.date).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api, { downloadFile, errMsg } from '../../api.js';
import { Empty, PageHead, Spinner, Stat } from '../../components/ui.jsx';
import { HBars } from '../../components/Charts.jsx';
import Icon from '../../components/Icon.jsx';
import { yearOptions } from '../../utils.js';

export default function TeamReports() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState(null);

  useEffect(() => {
    setData(null);
    api.get('/reports/team', { params: { year } }).then((r) => setData(r.data)).catch((e) => toast.error(errMsg(e)));
  }, [year]);

  const download = (format) =>
    downloadFile('/reports/team', { year, format }, `team-leave-report-${year}.${format}`).catch((e) => toast.error(errMsg(e)));

  return (
    <div className="stack">
      <PageHead title="Team leave report" subtitle="Leave usage across your reporting line.">
        <select className="input sm" value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Year">
          {yearOptions().map((y) => <option key={y}>{y}</option>)}
        </select>
        <button className="btn" onClick={() => download('csv')}><Icon name="download" /> CSV</button>
        <button className="btn primary" onClick={() => download('pdf')}><Icon name="download" /> PDF</button>
      </PageHead>

      {!data ? (
        <Spinner />
      ) : (
        <>
          <div className="grid grid-4">
            <Stat label="Team members" value={data.summary.members} />
            <Stat label="Leave requests" value={data.summary.totalRequests} hint={`in ${year}`} />
            <Stat label="Approved days" value={data.summary.approvedDays} />
            <Stat label="Pending requests" value={data.summary.pending} />
          </div>

          <div className="card">
            <div className="card-head"><h2>Approved days by leave type</h2></div>
            <div className="card-body">
              {data.summary.byType.every((t) => !t.days) ? (
                <p className="muted">No approved leave yet in {year}.</p>
              ) : (
                <HBars items={data.summary.byType.filter((t) => t.days).map((t) => ({ name: t.name, value: t.days, color: t.color }))} />
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h2>By employee</h2></div>
            {data.rows.length === 0 ? (
              <Empty>No team members.</Empty>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Department</th>
                      {data.types.map((t) => <th key={t._id} className="num" title={t.name}>{t.code}</th>)}
                      <th className="num">Total used</th>
                      <th className="num">Paid days left</th>
                      <th className="num">Pending</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((r) => (
                      <tr key={r.user._id}>
                        <td>
                          <div style={{ fontWeight: 550 }}>{r.user.name}</div>
                          <div className="muted small">{r.user.employeeId}</div>
                        </td>
                        <td className="ink-2">{r.user.department}</td>
                        {data.types.map((t) => <td key={t._id} className="num">{r.byType[t.code] || <span className="muted">0</span>}</td>)}
                        <td className="num"><strong>{r.totalUsed}</strong></td>
                        <td className={`num ${r.totalAvailable < 0 ? 'neg' : ''}`}>{r.totalAvailable}</td>
                        <td className="num">{r.pendingRequests}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

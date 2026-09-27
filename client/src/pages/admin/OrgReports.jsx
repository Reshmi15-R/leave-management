import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api, { downloadFile, errMsg } from '../../api.js';
import { Empty, PageHead, Spinner, Stat, StatusBadge } from '../../components/ui.jsx';
import { BarChart, HBars } from '../../components/Charts.jsx';
import Icon from '../../components/Icon.jsx';
import { yearOptions } from '../../utils.js';

export default function OrgReports() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [department, setDepartment] = useState('');
  const [departments, setDepartments] = useState([]);
  const [data, setData] = useState(null);
  const [showMonthTable, setShowMonthTable] = useState(false);

  useEffect(() => {
    api.get('/departments').then((r) => setDepartments(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setData(null);
    api
      .get('/reports/organization', { params: { year, department: department || undefined } })
      .then((r) => setData(r.data))
      .catch((e) => toast.error(errMsg(e)));
  }, [year, department]);

  const download = (format) =>
    downloadFile('/reports/organization', { year, format, department: department || undefined }, `organization-report-${year}.${format}`).catch((e) =>
      toast.error(errMsg(e))
    );

  return (
    <div className="stack">
      <PageHead title="Organization reports" subtitle="Organization-wide leave usage, trends and approvals.">
        <select className="input sm" value={department} onChange={(e) => setDepartment(e.target.value)} aria-label="Department">
          <option value="">All departments</option>
          {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
        </select>
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
            <Stat label="Active employees" value={data.summary.employees} hint={`${data.summary.departments} departments`} />
            <Stat label="Leave requests" value={data.summary.totalRequests} hint={`${data.summary.overrides} policy overrides`} />
            <Stat label="Approved leave days" value={data.summary.approvedDays} hint={`${data.summary.avgDaysPerEmployee} per employee on average`} />
            <Stat label="Approval rate" value={`${data.summary.approvalRate}%`} hint="of decided requests" />
          </div>

          <div className="grid split">
            <div className="card">
              <div className="card-head">
                <h2>Approved leave days by month</h2>
                <button className="btn sm ghost" onClick={() => setShowMonthTable((v) => !v)}>{showMonthTable ? 'Show chart' : 'Show table'}</button>
              </div>
              <div className="card-body">
                {showMonthTable ? (
                  <table className="table">
                    <thead><tr><th>Month</th><th className="num">Requests</th><th className="num">Approved days</th></tr></thead>
                    <tbody>{data.byMonth.map((m) => <tr key={m.month}><td>{m.month}</td><td className="num">{m.requests}</td><td className="num">{m.days}</td></tr>)}</tbody>
                  </table>
                ) : (
                  <BarChart data={data.byMonth.map((m) => ({ label: m.month, value: m.days, detail: `${m.requests} requests` }))} />
                )}
                <p className="muted small" style={{ marginTop: 6 }}>Grouped by the month each leave starts.</p>
              </div>
            </div>
            <div className="card">
              <div className="card-head"><h2>Requests by status</h2></div>
              <div className="card-body">
                {data.byStatus.map((s) => (
                  <div key={s.status} className="list-item">
                    <StatusBadge status={s.status} />
                    <div className="grow" />
                    <strong className="num">{s.count}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-2" style={{ alignItems: 'start' }}>
            <div className="card">
              <div className="card-head"><h2>Approved days by leave type</h2></div>
              <div className="card-body">
                <HBars items={data.byType.map((t) => ({ name: t.name, value: t.approvedDays, color: t.color }))} />
              </div>
            </div>
            <div className="card">
              <div className="card-head"><h2>Top leave takers</h2></div>
              {data.topTakers.length === 0 ? (
                <Empty>No approved leave yet.</Empty>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>Employee</th><th>Department</th><th className="num">Days</th></tr></thead>
                    <tbody>
                      {data.topTakers.map((t) => (
                        <tr key={t.employeeId}>
                          <td>{t.name} <span className="muted small">{t.employeeId}</span></td>
                          <td className="ink-2">{t.department}</td>
                          <td className="num">{t.days}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h2>By department</h2></div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Department</th><th className="num">Employees</th><th className="num">Requests</th><th className="num">Approved days</th><th className="num">Avg days / employee</th></tr>
                </thead>
                <tbody>
                  {data.byDepartment.map((d) => (
                    <tr key={d.department}>
                      <td>{d.department}</td>
                      <td className="num">{d.employees}</td>
                      <td className="num">{d.requests}</td>
                      <td className="num">{d.approvedDays}</td>
                      <td className="num">{d.avgPerEmployee}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

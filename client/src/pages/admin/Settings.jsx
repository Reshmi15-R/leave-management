import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api, { errMsg } from '../../api.js';
import { Alert, Field, PageHead, Spinner } from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';
import { fmtDate, fmtDateTime, isoDay } from '../../utils.js';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Settings() {
  const [tab, setTab] = useState('general');
  const [s, setS] = useState(null);
  const [holiday, setHoliday] = useState({ date: '', name: '' });
  const [audit, setAudit] = useState(null);
  const [initYear, setInitYear] = useState(new Date().getFullYear() + 1);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/settings').then((r) => setS(r.data)).catch((e) => toast.error(errMsg(e)));
  }, []);
  useEffect(() => {
    if (tab === 'audit') api.get('/settings/audit').then((r) => setAudit(r.data)).catch((e) => toast.error(errMsg(e)));
  }, [tab]);

  if (!s) return <Spinner />;

  const persist = async (patch, msg = 'Settings saved') => {
    setBusy(true);
    try {
      const { data } = await api.put('/settings', patch);
      setS(data);
      toast.success(msg);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const saveGeneral = (e) => {
    e.preventDefault();
    const { organizationName, workingDays, allowNegativeBalance, secondLevelApprovalThreshold, maxBackdatedDays, maxFutureDays } = s;
    persist({ organizationName, workingDays, allowNegativeBalance, secondLevelApprovalThreshold, maxBackdatedDays, maxFutureDays });
  };

  const toggleDay = (d) =>
    setS({ ...s, workingDays: s.workingDays.includes(d) ? s.workingDays.filter((x) => x !== d) : [...s.workingDays, d].sort() });

  const holidays = s.holidays.map((h) => ({ date: isoDay(h.date), name: h.name }));
  const addHoliday = (e) => {
    e.preventDefault();
    persist({ holidays: [...holidays, holiday] }, 'Holiday added');
    setHoliday({ date: '', name: '' });
  };
  const removeHoliday = (i) => persist({ holidays: holidays.filter((_, j) => j !== i) }, 'Holiday removed');

  const initialize = async () => {
    setBusy(true);
    try {
      const { data } = await api.post('/balances/initialize', { year: initYear });
      toast.success(data.message);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const num = (k) => (e) => setS({ ...s, [k]: Number(e.target.value) });

  return (
    <div>
      <PageHead title="System settings" subtitle="Organization-wide configuration for leave processing." />
      <div className="tabs">
        {[['general', 'General & workflow'], ['holidays', 'Holidays'], ['year', 'Year-end processing'], ['audit', 'Audit log']].map(([k, l]) => (
          <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'general' && (
        <form className="card card-body form-grid" onSubmit={saveGeneral} style={{ maxWidth: 820 }}>
          <Field label="Organization name" className="full">
            <input className="input" value={s.organizationName} onChange={(e) => setS({ ...s, organizationName: e.target.value })} />
          </Field>
          <div className="field full">
            <span className="label-text">Working days</span>
            <div className="row">
              {DAYS.map((d, i) => (
                <label key={d} className="check" style={{ marginRight: 8 }}>
                  <input type="checkbox" checked={s.workingDays.includes(i)} onChange={() => toggleDay(i)} /> {d}
                </label>
              ))}
            </div>
            <span className="help">Non-working days and holidays are not deducted from leave balances.</span>
          </div>
          <Field label="Second-level approval above (days)" help="Requests longer than this also need the approver's manager. 0 disables.">
            <input className="input" type="number" min={0} value={s.secondLevelApprovalThreshold} onChange={num('secondLevelApprovalThreshold')} />
          </Field>
          <Field label="Max backdated days" help="How far in the past employees may apply">
            <input className="input" type="number" min={0} value={s.maxBackdatedDays} onChange={num('maxBackdatedDays')} />
          </Field>
          <Field label="Max days in advance" help="How far ahead employees may apply">
            <input className="input" type="number" min={1} value={s.maxFutureDays} onChange={num('maxFutureDays')} />
          </Field>
          <div className="field" style={{ justifyContent: 'center' }}>
            <label className="check">
              <input type="checkbox" checked={s.allowNegativeBalance} onChange={(e) => setS({ ...s, allowNegativeBalance: e.target.checked })} />
              Allow negative balances
            </label>
          </div>
          <div className="full row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn primary" disabled={busy}>Save settings</button>
          </div>
        </form>
      )}

      {tab === 'holidays' && (
        <div className="card" style={{ maxWidth: 820 }}>
          <form className="card-head" onSubmit={addHoliday} style={{ justifyContent: 'flex-start' }}>
            <input className="input sm" type="date" required value={holiday.date} onChange={(e) => setHoliday({ ...holiday, date: e.target.value })} aria-label="Date" />
            <input className="input sm grow" required placeholder="Holiday name" value={holiday.name} onChange={(e) => setHoliday({ ...holiday, name: e.target.value })} />
            <button className="btn primary sm" disabled={busy}><Icon name="plus" size={14} /> Add</button>
          </form>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Date</th><th>Day</th><th>Holiday</th><th /></tr></thead>
              <tbody>
                {s.holidays.map((h, i) => (
                  <tr key={h._id || i}>
                    <td>{fmtDate(h.date)}</td>
                    <td className="ink-2">{new Date(h.date).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' })}</td>
                    <td>{h.name}</td>
                    <td><button className="icon-btn" aria-label="Remove" onClick={() => removeHoliday(i)}><Icon name="trash" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'year' && (
        <div className="card card-body stack" style={{ maxWidth: 640 }}>
          <h2>Initialise leave balances</h2>
          <p className="ink-2">
            Creates each active employee's balances for the chosen year: the entitlement for their role, plus carry-forward of unused days for leave
            types that allow it (capped at the type's maximum). Existing balances are left untouched, so it is safe to run more than once.
          </p>
          <Alert kind="info">Balances are also created automatically the first time an employee views or applies for leave in a year.</Alert>
          <div className="row">
            <input className="input sm" type="number" value={initYear} onChange={(e) => setInitYear(Number(e.target.value))} aria-label="Year" />
            <button className="btn primary" onClick={initialize} disabled={busy}>Initialise {initYear}</button>
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <div className="card">
          {!audit ? (
            <Spinner />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>When</th><th>Action</th><th>By</th><th>Employee</th><th>Details</th></tr></thead>
                <tbody>
                  {audit.map((a) => (
                    <tr key={a._id}>
                      <td className="small ink-2" style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(a.createdAt)}</td>
                      <td><span className="badge info">{a.action}</span></td>
                      <td>{a.actor?.name}</td>
                      <td>{a.target?.name || '—'}</td>
                      <td className="small ink-2">
                        {Object.entries(a.details || {})
                          .filter(([k]) => k !== 'leaveId')
                          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
                          .join(' · ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

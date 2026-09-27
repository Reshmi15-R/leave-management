import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api, { downloadFile, errMsg } from '../../api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Alert, Empty, Field, Modal, PageHead, Spinner } from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';
import { canOverride, fmtDateTime, yearOptions } from '../../utils.js';

function AdjustModal({ row, balance, year, onClose, onDone }) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [history, setHistory] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get(`/balances/history/${row.user._id}/${balance.leaveType._id}`, { params: { year } })
      .then((r) => setHistory(r.data?.history || []))
      .catch(() => setHistory([]));
  }, [row, balance, year]);

  const submit = async () => {
    setBusy(true);
    try {
      await api.post('/balances/adjust', { userId: row.user._id, leaveTypeId: balance.leaveType._id, year, amount: Number(amount), reason });
      toast.success('Balance adjusted');
      onDone();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`${balance.leaveType.name} — ${row.user.name}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Close</button>
          <button className="btn primary" onClick={submit} disabled={busy || !Number(amount) || !reason.trim()}>Apply adjustment</button>
        </>
      }
    >
      <dl className="kv" style={{ marginBottom: 16 }}>
        <dt>Entitled</dt><dd className="num">{balance.allocated}</dd>
        <dt>Carried forward</dt><dd className="num">{balance.carriedForward}</dd>
        <dt>Adjustments</dt><dd className="num">{balance.adjusted}</dd>
        <dt>Used / pending</dt><dd className="num">{balance.used} / {balance.pending}</dd>
        <dt>Available</dt><dd className={`num ${balance.available < 0 ? 'neg' : ''}`}><strong>{balance.available}</strong></dd>
      </dl>
      <div className="form-grid">
        <Field label="Adjustment (days)" help="Positive to credit, negative to debit. Steps of 0.5.">
          <input className="input" type="number" step="0.5" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 2 or -1" />
        </Field>
        <Field label="Reason">
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Comp-off for weekend release" />
        </Field>
      </div>
      <h3 style={{ margin: '20px 0 8px' }}>History</h3>
      {!history ? (
        <Spinner />
      ) : history.length === 0 ? (
        <p className="muted">No history.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <tbody>
              {[...history].reverse().map((h, i) => (
                <tr key={i}>
                  <td className="small ink-2">{fmtDateTime(h.date)}</td>
                  <td className="small">{h.kind.replace('_', ' ')}</td>
                  <td className="num">{h.amount > 0 ? '+' : ''}{h.amount}</td>
                  <td className="small">{h.reason}{h.by?.name ? ` — ${h.by.name}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

function OverrideModal({ rows, types, onClose, onDone }) {
  const [form, setForm] = useState({ employeeId: '', leaveTypeId: '', startDate: '', endDate: '', halfDay: false, halfDaySession: 'first', reason: '', overrideReason: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [k]: v, ...(k === 'startDate' && (!f.endDate || f.endDate < v) ? { endDate: v } : {}) }));
  };

  const submit = async () => {
    setBusy(true);
    try {
      const { data } = await api.post('/leaves/override', { ...form, endDate: form.halfDay ? form.startDate : form.endDate });
      toast.success('Leave recorded and approved');
      data.warnings?.forEach((w) => toast(w, { icon: '⚠️' }));
      onDone();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Record leave with policy override"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={submit} disabled={busy}>Record & approve</button>
        </>
      }
    >
      <Alert kind="warn">
        Use this for cases policy doesn't cover — e.g. emergency leave applied late, or leave beyond the balance. It skips notice, backdating,
        document and balance rules, is approved immediately, and is recorded in the audit log.
      </Alert>
      <div className="form-grid" style={{ marginTop: 16 }}>
        <Field label="Employee" className="full">
          <select className="input" value={form.employeeId} onChange={set('employeeId')}>
            <option value="">Select…</option>
            {rows.map((r) => <option key={r.user._id} value={r.user._id}>{r.user.name} ({r.user.employeeId})</option>)}
          </select>
        </Field>
        <Field label="Leave type" className="full">
          <select className="input" value={form.leaveTypeId} onChange={set('leaveTypeId')}>
            <option value="">Select…</option>
            {types.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
          </select>
        </Field>
        <Field label="From"><input className="input" type="date" value={form.startDate} onChange={set('startDate')} /></Field>
        <Field label="To"><input className="input" type="date" value={form.halfDay ? form.startDate : form.endDate} min={form.startDate} disabled={form.halfDay} onChange={set('endDate')} /></Field>
        <div className="full row" style={{ gap: 18 }}>
          <label className="check"><input type="checkbox" checked={form.halfDay} onChange={set('halfDay')} /> Half day</label>
          {form.halfDay && (
            <select className="input sm" value={form.halfDaySession} onChange={set('halfDaySession')}>
              <option value="first">First half</option>
              <option value="second">Second half</option>
            </select>
          )}
        </div>
        <Field label="Leave reason" className="full"><input className="input" value={form.reason} onChange={set('reason')} /></Field>
        <Field label="Override justification (required)" className="full">
          <textarea className="input" value={form.overrideReason} onChange={set('overrideReason')} />
        </Field>
      </div>
    </Modal>
  );
}

export default function TeamBalances() {
  const { user } = useAuth();
  const [year, setYear] = useState(new Date().getFullYear());
  const [rows, setRows] = useState(null);
  const [search, setSearch] = useState('');
  const [adjusting, setAdjusting] = useState(null);
  const [overriding, setOverriding] = useState(false);
  const editable = canOverride(user);

  const load = useCallback(() => {
    setRows(null);
    api.get('/balances/team', { params: { year } }).then((r) => setRows(r.data)).catch((e) => toast.error(errMsg(e)));
  }, [year]);
  useEffect(load, [load]);

  // Union of leave types across the team (gender-specific types vary per person)
  const types = rows
    ? [...new Map(rows.flatMap((r) => r.balances.map((b) => [b.leaveType._id, b.leaveType]))).values()].sort((a, b) => a.name.localeCompare(b.name))
    : [];
  const filtered = rows?.filter((r) => !search || r.user.name.toLowerCase().includes(search.toLowerCase()) || r.user.employeeId?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <PageHead title="Team leave balances" subtitle={editable ? 'Click a balance to adjust it or view its history.' : 'Available days per leave type.'}>
        {editable && (
          <button className="btn primary" onClick={() => setOverriding(true)} disabled={!rows?.length}>
            <Icon name="shield" /> Record leave (override)
          </button>
        )}
      </PageHead>
      <div className="filters">
        <input className="input" placeholder="Search employee…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input" value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Year">
          {yearOptions().map((y) => <option key={y}>{y}</option>)}
        </select>
      </div>
      <div className="card">
        {!rows ? (
          <Spinner />
        ) : filtered.length === 0 ? (
          <Empty>No team members found.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department</th>
                  {types.map((t) => (
                    <th key={t._id} className="num" title={t.name}>
                      <span className="type-chip"><span className="swatch" style={{ background: t.color }} />{t.code}</span>
                    </th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.user._id}>
                    <td>
                      <div style={{ fontWeight: 550 }}>{r.user.name}</div>
                      <div className="muted small">{r.user.employeeId}</div>
                    </td>
                    <td className="ink-2">{r.user.department?.name || '—'}</td>
                    {types.map((t) => {
                      const b = r.balances.find((x) => x.leaveType._id === t._id);
                      if (!b) return <td key={t._id} className="num muted">n/a</td>;
                      const label = t.isPaid ? `${b.available}/${b.total}` : `${b.used} taken`;
                      return (
                        <td key={t._id} className="num">
                          {editable ? (
                            <button className={`cell-link num ${b.available < 0 ? 'neg' : ''}`} onClick={() => setAdjusting({ row: r, balance: b })} title={`Used ${b.used}, pending ${b.pending}`}>
                              {label}
                            </button>
                          ) : (
                            <span className={b.available < 0 ? 'neg' : ''} title={`Used ${b.used}, pending ${b.pending}`}>{label}</span>
                          )}
                        </td>
                      );
                    })}
                    <td>
                      <button
                        className="btn sm ghost"
                        title="Download statement"
                        onClick={() => downloadFile('/reports/statement', { userId: r.user._id, year, format: 'pdf' }, 'statement.pdf').catch((e) => toast.error(errMsg(e)))}
                      >
                        <Icon name="download" size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="muted small" style={{ marginTop: 10 }}>Paid types show available / total entitlement for {year}.</p>

      {adjusting && (
        <AdjustModal
          {...adjusting}
          year={year}
          onClose={() => setAdjusting(null)}
          onDone={() => {
            setAdjusting(null);
            load();
          }}
        />
      )}
      {overriding && (
        <OverrideModal
          rows={rows}
          types={types}
          onClose={() => setOverriding(false)}
          onDone={() => {
            setOverriding(false);
            load();
          }}
        />
      )}
    </div>
  );
}

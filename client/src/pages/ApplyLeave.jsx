import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api, { errMsg } from '../api.js';
import BalanceCard from '../components/BalanceCard.jsx';
import { Alert, Field, PageHead, Spinner } from '../components/ui.jsx';
import { ROLE_LABELS, localISO, plural } from '../utils.js';

const EMPTY = { leaveTypeId: '', startDate: '', endDate: '', halfDay: false, halfDaySession: 'first', reason: '', documentRef: '', contactDuringLeave: '' };

export default function ApplyLeave() {
  const navigate = useNavigate();
  const [balances, setBalances] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/balances/me').then((r) => setBalances(r.data)).catch((e) => setError(errMsg(e)));
  }, []);

  const selected = useMemo(() => balances?.find((b) => b.leaveType._id === form.leaveTypeId), [balances, form.leaveTypeId]);
  const type = selected?.leaveType;
  const sameDay = form.startDate && form.startDate === (form.endDate || form.startDate);

  // Live validation against policy
  useEffect(() => {
    if (!form.leaveTypeId || !form.startDate) {
      setPreview(null);
      return;
    }
    const t = setTimeout(() => {
      api
        .post('/leaves/preview', { ...form, endDate: form.endDate || form.startDate })
        .then((r) => setPreview(r.data))
        .catch(() => setPreview(null));
    }, 250);
    return () => clearTimeout(t);
  }, [form.leaveTypeId, form.startDate, form.endDate, form.halfDay, form.halfDaySession, form.documentRef]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => {
      const next = { ...f, [k]: v };
      if (k === 'startDate' && (!f.endDate || f.endDate < v)) next.endDate = v;
      if (k === 'halfDay' && v) next.endDate = next.startDate;
      return next;
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/leaves', { ...form, endDate: form.endDate || form.startDate });
      toast.success('Leave request submitted');
      navigate('/my-leaves');
    } catch (err) {
      const details = err.response?.data?.details;
      setError(details?.length > 1 ? details.join(' • ') : errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  if (!balances) return error ? <Alert kind="error">{error}</Alert> : <Spinner />;

  const needsDoc = type?.requiresDocument && (preview?.days ?? 0) > type.docRequiredAfterDays;

  return (
    <div>
      <PageHead title="Apply for leave" subtitle="Your request goes to your reporting manager for approval." />
      <div className="grid split" style={{ alignItems: 'start' }}>
        <form className="card card-body form-grid" onSubmit={submit}>
          {error && <div className="full"><Alert kind="error">{error}</Alert></div>}
          <Field label="Leave type" className="full">
            <select className="input" required value={form.leaveTypeId} onChange={set('leaveTypeId')}>
              <option value="">Select a leave type…</option>
              {balances.map((b) => (
                <option key={b.leaveType._id} value={b.leaveType._id}>
                  {b.leaveType.name} {b.leaveType.isPaid ? `— ${b.available} day(s) available` : '— unpaid'}
                </option>
              ))}
            </select>
          </Field>
          {type?.description && <p className="full muted small" style={{ marginTop: -6 }}>{type.description}</p>}

          <Field label="From">
            <input className="input" type="date" required value={form.startDate} onChange={set('startDate')} />
          </Field>
          <Field label="To">
            <input className="input" type="date" required min={form.startDate} value={form.endDate} disabled={form.halfDay} onChange={set('endDate')} />
          </Field>

          {type?.allowHalfDay && sameDay && (
            <div className="full row" style={{ gap: 18 }}>
              <label className="check">
                <input type="checkbox" checked={form.halfDay} onChange={set('halfDay')} /> Half day
              </label>
              {form.halfDay && (
                <>
                  <label className="check">
                    <input type="radio" name="session" value="first" checked={form.halfDaySession === 'first'} onChange={set('halfDaySession')} /> First half
                  </label>
                  <label className="check">
                    <input type="radio" name="session" value="second" checked={form.halfDaySession === 'second'} onChange={set('halfDaySession')} /> Second half
                  </label>
                </>
              )}
            </div>
          )}

          <Field label="Reason" className="full">
            <textarea className="input" required maxLength={1000} value={form.reason} onChange={set('reason')} placeholder="Briefly describe why you need this leave" />
          </Field>
          {type?.requiresDocument && (
            <Field
              label={`Supporting document ${needsDoc ? '(required)' : '(optional)'}`}
              className="full"
              help={`Link or reference to a certificate. Required when leave exceeds ${plural(type.docRequiredAfterDays, 'day')}.`}
            >
              <input className="input" required={needsDoc} value={form.documentRef} onChange={set('documentRef')} placeholder="https://drive… or certificate number" />
            </Field>
          )}
          <Field label="Contact during leave (optional)" className="full">
            <input className="input" value={form.contactDuringLeave} onChange={set('contactDuringLeave')} placeholder="Phone or alternate email" />
          </Field>

          {preview && (
            <div className="full stack">
              {preview.errors.length > 0 && (
                <Alert kind="error">
                  <ul>{preview.errors.map((e) => <li key={e}>{e}</li>)}</ul>
                </Alert>
              )}
              {preview.warnings.length > 0 && (
                <Alert kind="warn">
                  <ul>{preview.warnings.map((e) => <li key={e}>{e}</li>)}</ul>
                </Alert>
              )}
              {preview.errors.length === 0 && (
                <Alert kind="info">
                  <strong>{plural(preview.days, 'working day')}</strong> will be deducted
                  {type?.isPaid ? ` (${preview.available} available)` : ' (unpaid)'}.{' '}
                  Approval: {preview.approvalChain.map((c) => (c.approver ? `${c.approver.name} (${ROLE_LABELS[c.approver.role]})` : 'HR / General Manager')).join(' → ')}
                </Alert>
              )}
            </div>
          )}

          <div className="full row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={() => setForm(EMPTY)}>Reset</button>
            <button className="btn primary" disabled={busy || (preview && preview.errors.length > 0)}>
              {busy ? 'Submitting…' : 'Submit request'}
            </button>
          </div>
        </form>

        <div className="stack">
          {selected ? <BalanceCard balance={selected} /> : <div className="card card-pad muted">Select a leave type to see its balance and policy.</div>}
          {type && (
            <div className="card card-pad">
              <h3 style={{ marginBottom: 10 }}>Policy</h3>
              <dl className="kv small">
                <dt>Paid</dt><dd>{type.isPaid ? 'Yes' : 'No'}</dd>
                <dt>Half day</dt><dd>{type.allowHalfDay ? 'Allowed' : 'Not allowed'}</dd>
                <dt>Advance notice</dt><dd>{type.minNoticeDays ? plural(type.minNoticeDays, 'day') : 'None'}</dd>
                <dt>Max at a time</dt><dd>{type.maxConsecutiveDays ? plural(type.maxConsecutiveDays, 'day') : 'No limit'}</dd>
                <dt>Carry forward</dt><dd>{type.carryForward ? `Up to ${type.maxCarryForward} days` : 'No'}</dd>
                <dt>Document</dt><dd>{type.requiresDocument ? `Needed beyond ${plural(type.docRequiredAfterDays, 'day')}` : 'Not needed'}</dd>
              </dl>
            </div>
          )}
          <p className="muted small">Weekends and public holidays inside your dates are not counted. Today is {localISO()}.</p>
        </div>
      </div>
    </div>
  );
}

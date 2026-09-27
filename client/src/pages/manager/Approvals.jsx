import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api, { errMsg } from '../../api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import LeaveDetailModal from '../../components/LeaveDetail.jsx';
import { Empty, Field, Modal, PageHead, Spinner, StatusBadge, TypeChip } from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';
import { canOverride, dateRange, fmtDate, initials, isAdmin, localISO } from '../../utils.js';

function DecisionModal({ leave, action, onClose, onDone }) {
  const { user } = useAuth();
  const [comment, setComment] = useState('');
  const [override, setOverride] = useState(false);
  const [busy, setBusy] = useState(false);
  const approve = action === 'approve';
  const lowBalance = leave.leaveType.isPaid && leave.balanceAvailable !== null && leave.balanceAvailable < 0;

  const submit = async () => {
    setBusy(true);
    try {
      await api.put(`/leaves/${leave._id}/${action}`, { comment, override });
      toast.success(approve ? 'Request approved' : 'Request rejected');
      onDone();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={approve ? 'Approve leave' : 'Reject leave'}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Back</button>
          <button className={`btn ${approve ? 'success' : 'danger'}`} onClick={submit} disabled={busy || (!approve && !comment.trim())}>
            {approve ? 'Approve' : 'Reject'}
          </button>
        </>
      }
    >
      <p style={{ marginBottom: 14 }}>
        <strong>{leave.employee.name}</strong> — {leave.leaveType.name}, {dateRange(leave)} ({leave.days} day(s))
      </p>
      <Field label={approve ? 'Comment (optional)' : 'Reason for rejection (required)'}>
        <textarea className="input" value={comment} onChange={(e) => setComment(e.target.value)} autoFocus />
      </Field>
      {approve && canOverride(user) && (
        <div style={{ marginTop: 14 }}>
          <label className="check">
            <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
            Override leave policy (e.g. allow a negative balance)
          </label>
          {lowBalance && <p className="small neg" style={{ marginTop: 6 }}>This employee's balance is already negative — approval needs an override.</p>}
          <p className="small muted" style={{ marginTop: 4 }}>Overrides are recorded in the audit log.</p>
        </div>
      )}
      {approve && leave.approvals.some((a) => a.level > leave.currentLevel) && !isAdmin(user) && (
        <p className="small muted" style={{ marginTop: 12 }}>After your approval this request moves to the next approval level.</p>
      )}
    </Modal>
  );
}

export default function Approvals() {
  const { user } = useAuth();
  const [tab, setTab] = useState('mine');
  const [pending, setPending] = useState(null);
  const [history, setHistory] = useState(null);
  const [histStatus, setHistStatus] = useState('');
  const [viewing, setViewing] = useState(null);
  const [deciding, setDeciding] = useState(null);

  const loadPending = useCallback(() => {
    setPending(null);
    api
      .get('/leaves/approvals', { params: { scope: tab === 'all' ? 'all' : undefined } })
      .then((r) => setPending(r.data))
      .catch((e) => toast.error(errMsg(e)));
  }, [tab]);

  const loadHistory = useCallback(() => {
    setHistory(null);
    api
      .get('/leaves/team', { params: { status: histStatus || undefined, year: new Date().getFullYear() } })
      .then((r) => setHistory(r.data))
      .catch((e) => toast.error(errMsg(e)));
  }, [histStatus]);

  useEffect(() => {
    if (tab === 'history') loadHistory();
    else loadPending();
  }, [tab, loadPending, loadHistory]);

  const today = localISO();
  const rows = tab === 'history' ? history : pending;

  return (
    <div>
      <PageHead title="Leave approvals" subtitle="Review requests from your team. Requests over the threshold go to a second approver." />
      <div className="tabs">
        <button className={tab === 'mine' ? 'active' : ''} onClick={() => setTab('mine')}>Awaiting me</button>
        {isAdmin(user) && <button className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>All pending (organization)</button>}
        <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>Team requests</button>
      </div>

      {tab === 'history' && (
        <div className="filters">
          <select className="input" value={histStatus} onChange={(e) => setHistStatus(e.target.value)} aria-label="Status">
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      )}

      <div className="card">
        {!rows ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <Empty>{tab === 'history' ? 'No requests found.' : 'All caught up — nothing waiting for approval.'}</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Type</th>
                  <th>Dates</th>
                  <th className="num">Days</th>
                  {tab !== 'history' && <th className="num">Balance after</th>}
                  <th>{tab === 'history' ? 'Status' : 'Stage'}</th>
                  <th>Applied</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => {
                  const step = l.approvals.find((a) => a.level === l.currentLevel);
                  const startsSoon = l.status === 'pending' && l.startDate.slice(0, 10) <= today;
                  return (
                    <tr key={l._id} className="clickable" onClick={() => setViewing(l)}>
                      <td>
                        <div className="row" style={{ flexWrap: 'nowrap' }}>
                          <div className="avatar sm">{initials(l.employee.name)}</div>
                          <div>
                            <div style={{ fontWeight: 550 }}>{l.employee.name}</div>
                            <div className="muted small">{l.employee.department?.name || l.employee.employeeId}</div>
                          </div>
                        </div>
                      </td>
                      <td><TypeChip type={l.leaveType} /></td>
                      <td>
                        {dateRange(l)}
                        {startsSoon && <div className="small neg">Starts today / already started</div>}
                      </td>
                      <td className="num">{l.days}</td>
                      {tab !== 'history' && (
                        <td className={`num ${l.balanceAvailable < 0 ? 'neg' : ''}`}>{l.leaveType.isPaid ? l.balanceAvailable ?? '—' : 'Unpaid'}</td>
                      )}
                      <td>
                        {tab === 'history' ? (
                          <StatusBadge status={l.status} />
                        ) : (
                          <span className="small">
                            Level {l.currentLevel}/{l.approvals.length}
                            {step?.approver && String(step.approver._id) !== String(user._id) ? ` · ${step.approver.name}` : ''}
                            {!step?.approver ? ' · HR pool' : ''}
                          </span>
                        )}
                      </td>
                      <td className="ink-2 small">{fmtDate(l.createdAt)}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {tab !== 'history' && l.canAct && (
                          <div className="row" style={{ flexWrap: 'nowrap' }}>
                            <button className="btn sm success" onClick={() => setDeciding({ leave: l, action: 'approve' })}>
                              <Icon name="check" size={14} /> Approve
                            </button>
                            <button className="btn sm" onClick={() => setDeciding({ leave: l, action: 'reject' })}>
                              <Icon name="x" size={14} /> Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {viewing && (
        <LeaveDetailModal
          leave={viewing}
          onClose={() => setViewing(null)}
          footer={
            viewing.canAct && (
              <>
                <button className="btn" onClick={() => { setDeciding({ leave: viewing, action: 'reject' }); setViewing(null); }}>Reject</button>
                <button className="btn success" onClick={() => { setDeciding({ leave: viewing, action: 'approve' }); setViewing(null); }}>Approve</button>
              </>
            )
          }
        />
      )}
      {deciding && (
        <DecisionModal
          leave={deciding.leave}
          action={deciding.action}
          onClose={() => setDeciding(null)}
          onDone={() => {
            setDeciding(null);
            loadPending();
          }}
        />
      )}
    </div>
  );
}

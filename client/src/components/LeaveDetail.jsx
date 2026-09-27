import { Modal, StatusBadge, TypeChip } from './ui.jsx';
import { ROLE_LABELS, dateRange, fmtDateTime, plural } from '../utils.js';

export function ApprovalTrail({ leave }) {
  return (
    <ul className="timeline">
      <li>
        <span className="dot approved" />
        <div style={{ fontWeight: 600 }}>{leave.isOverride && leave.appliedBy ? `Recorded by ${leave.appliedBy.name}` : 'Applied'}</div>
        <div className="muted small">{fmtDateTime(leave.createdAt)}</div>
      </li>
      {leave.approvals.map((a) => (
        <li key={a.level}>
          <span className={`dot ${a.status}`} />
          <div className="row">
            <strong>Level {a.level}</strong>
            <span className="ink-2">{a.approver ? `${a.approver.name} (${ROLE_LABELS[a.approver.role]})` : 'HR / General Manager'}</span>
            <span className={`badge ${a.status === 'approved' ? 'approved' : a.status === 'rejected' ? 'rejected' : a.status === 'pending' ? 'pending' : 'neutral'}`}>
              {a.status === 'waiting' ? 'Awaiting previous level' : a.status}
            </span>
          </div>
          {a.actedBy && (
            <div className="muted small">
              {a.status} by {a.actedBy.name}
              {a.overridden ? ' (override)' : ''} · {fmtDateTime(a.actedAt)}
            </div>
          )}
          {a.comment && <div style={{ marginTop: 4 }}>“{a.comment}”</div>}
        </li>
      ))}
      {leave.status === 'cancelled' && (
        <li>
          <span className="dot" />
          <div style={{ fontWeight: 600 }}>Cancelled by employee</div>
          <div className="muted small">{fmtDateTime(leave.cancelledAt)}</div>
        </li>
      )}
    </ul>
  );
}

export default function LeaveDetailModal({ leave, onClose, footer }) {
  return (
    <Modal title="Leave request" onClose={onClose} footer={footer} size="lg">
      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <dl className="kv">
          {leave.employee?.name && (
            <>
              <dt>Employee</dt>
              <dd>
                {leave.employee.name} <span className="muted">({leave.employee.employeeId})</span>
              </dd>
            </>
          )}
          <dt>Leave type</dt>
          <dd><TypeChip type={leave.leaveType} /></dd>
          <dt>Dates</dt>
          <dd>{dateRange(leave)}</dd>
          <dt>Duration</dt>
          <dd>{plural(leave.days, 'working day')}</dd>
          <dt>Status</dt>
          <dd><StatusBadge status={leave.status} /> {leave.isOverride && <span className="badge info">Policy override</span>}</dd>
          <dt>Reason</dt>
          <dd style={{ whiteSpace: 'pre-wrap' }}>{leave.reason}</dd>
          {leave.overrideReason && (
            <>
              <dt>Override reason</dt>
              <dd>{leave.overrideReason}</dd>
            </>
          )}
          {leave.documentRef && (
            <>
              <dt>Document</dt>
              <dd style={{ wordBreak: 'break-all' }}>{leave.documentRef}</dd>
            </>
          )}
          {leave.contactDuringLeave && (
            <>
              <dt>Contact</dt>
              <dd>{leave.contactDuringLeave}</dd>
            </>
          )}
          {leave.balanceAvailable !== undefined && leave.balanceAvailable !== null && (
            <>
              <dt>Balance left</dt>
              <dd className={leave.balanceAvailable < 0 ? 'neg' : ''}>{leave.balanceAvailable} days (after this request)</dd>
            </>
          )}
        </dl>
        <div>
          <h3 style={{ marginBottom: 12 }}>Approval workflow</h3>
          <ApprovalTrail leave={leave} />
        </div>
      </div>
    </Modal>
  );
}

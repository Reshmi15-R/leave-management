import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api, { downloadFile, errMsg } from '../api.js';
import LeaveDetailModal from '../components/LeaveDetail.jsx';
import { Empty, Modal, PageHead, Spinner, StatusBadge, TypeChip, Field } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';
import { dateRange, fmtDate, yearOptions } from '../utils.js';

export default function MyLeaves() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [status, setStatus] = useState('');
  const [leaves, setLeaves] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [cancelReason, setCancelReason] = useState('');

  const load = useCallback(() => {
    setLeaves(null);
    api
      .get('/leaves/my', { params: { year, status: status || undefined } })
      .then((r) => setLeaves(r.data))
      .catch((e) => toast.error(errMsg(e)));
  }, [year, status]);

  useEffect(load, [load]);

  const cancel = async () => {
    try {
      await api.put(`/leaves/${cancelling._id}/cancel`, { reason: cancelReason });
      toast.success('Request cancelled and balance restored');
      setCancelling(null);
      setCancelReason('');
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const download = (format) =>
    downloadFile('/reports/statement', { year, format }, `leave-statement-${year}.${format}`).catch((e) => toast.error(errMsg(e)));

  return (
    <div>
      <PageHead title="My leaves" subtitle="Track your applications and their approval status.">
        <button className="btn" onClick={() => download('pdf')}><Icon name="download" /> Statement (PDF)</button>
        <button className="btn" onClick={() => download('csv')}><Icon name="download" /> CSV</button>
        <Link to="/apply" className="btn primary"><Icon name="plus" /> Apply</Link>
      </PageHead>

      <div className="filters">
        <select className="input" value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Year">
          {yearOptions().map((y) => <option key={y}>{y}</option>)}
        </select>
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="card">
        {!leaves ? (
          <Spinner />
        ) : leaves.length === 0 ? (
          <Empty>No leave requests for {year}.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Dates</th>
                  <th className="num">Days</th>
                  <th>Applied</th>
                  <th>Status</th>
                  <th>Current stage</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {leaves.map((l) => {
                  const step = l.approvals.find((a) => a.level === l.currentLevel);
                  const lastComment = [...l.approvals].reverse().find((a) => a.comment)?.comment;
                  return (
                    <tr key={l._id} className="clickable" onClick={() => setViewing(l)}>
                      <td><TypeChip type={l.leaveType} /></td>
                      <td>{dateRange(l)}</td>
                      <td className="num">{l.days}</td>
                      <td className="ink-2">{fmtDate(l.createdAt)}</td>
                      <td><StatusBadge status={l.status} /></td>
                      <td className="ink-2 small">
                        {l.status === 'pending'
                          ? `Level ${l.currentLevel}: ${step?.approver?.name || 'HR / GM'}`
                          : lastComment
                            ? `“${lastComment.length > 40 ? lastComment.slice(0, 40) + '…' : lastComment}”`
                            : '—'}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {l.status === 'pending' && (
                          <button className="btn sm" onClick={() => setCancelling(l)}>Cancel</button>
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

      {viewing && <LeaveDetailModal leave={viewing} onClose={() => setViewing(null)} />}
      {cancelling && (
        <Modal
          title="Cancel leave request?"
          onClose={() => setCancelling(null)}
          footer={
            <>
              <button className="btn" onClick={() => setCancelling(null)}>Keep request</button>
              <button className="btn danger" onClick={cancel}>Cancel request</button>
            </>
          }
        >
          <p style={{ marginBottom: 14 }}>
            {cancelling.leaveType.name}, {dateRange(cancelling)} ({cancelling.days} day(s)). The days will return to your balance.
          </p>
          <Field label="Reason (optional)">
            <input className="input" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
          </Field>
        </Modal>
      )}
    </div>
  );
}

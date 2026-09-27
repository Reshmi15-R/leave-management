import { useEffect } from 'react';
import Icon from './Icon.jsx';

const STATUS_ICON = { approved: 'check', pending: 'clock', rejected: 'x', cancelled: 'ban' };

export function StatusBadge({ status }) {
  return (
    <span className={`badge ${status}`}>
      <Icon name={STATUS_ICON[status] || 'clock'} strokeWidth={3} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export function TypeChip({ type }) {
  if (!type) return <span className="muted">—</span>;
  return (
    <span className="type-chip">
      <span className="swatch" style={{ background: type.color }} />
      {type.name}
    </span>
  );
}

export function Spinner() {
  return <div className="spinner" role="status" aria-label="Loading" />;
}

export function Empty({ children = 'Nothing to show yet.' }) {
  return <div className="empty">{children}</div>;
}

export function Modal({ title, onClose, children, footer, size }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size || ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, help, children, className = '' }) {
  return (
    <div className={`field ${className}`}>
      {label && <label>{label}</label>}
      {children}
      {help && <span className="help">{help}</span>}
    </div>
  );
}

export function PageHead({ title, subtitle, children }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children && <div className="row">{children}</div>}
    </div>
  );
}

export function Stat({ label, value, hint }) {
  return (
    <div className="card stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function Alert({ kind = 'info', children }) {
  return (
    <div className={`alert ${kind}`} role={kind === 'error' ? 'alert' : undefined}>
      <Icon name={kind === 'success' ? 'check' : kind === 'info' ? 'eye' : 'alert'} />
      <div>{children}</div>
    </div>
  );
}

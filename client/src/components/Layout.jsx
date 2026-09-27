import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api.js';
import Icon from './Icon.jsx';
import { ROLE_LABELS, isApprover, isAdmin, initials } from '../utils.js';

export default function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [org, setOrg] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    api.get('/settings').then((r) => setOrg(r.data.organizationName)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isApprover(user)) return;
    api.get('/leaves/approvals').then((r) => setPendingCount(r.data.length)).catch(() => {});
  }, [user, location.pathname]);

  const link = (to, icon, label, extra) => (
    <NavLink to={to} end={to === '/'}>
      <Icon name={icon} />
      {label}
      {extra}
    </NavLink>
  );

  return (
    <div className="shell">
      {open && <div className="backdrop" onClick={() => setOpen(false)} />}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">
            <Icon name="calendar" size={16} />
          </div>
          LeaveDesk
        </div>
        <nav className="nav">
          <div className="nav-section">My Leave</div>
          {link('/', 'dashboard', 'Dashboard')}
          {link('/apply', 'plus', 'Apply for Leave')}
          {link('/my-leaves', 'list', 'My Leaves')}
          {link('/calendar', 'calendar', 'Team Calendar')}

          {isApprover(user) && (
            <>
              <div className="nav-section">Team</div>
              {link('/approvals', 'check', 'Approvals', pendingCount > 0 && <span className="count">{pendingCount}</span>)}
              {link('/team-balances', 'scale', 'Team Balances')}
              {link('/team-reports', 'chart', 'Team Reports')}
            </>
          )}

          {isAdmin(user) && (
            <>
              <div className="nav-section">Administration</div>
              {link('/admin/employees', 'users', 'Employees')}
              {link('/admin/departments', 'building', 'Departments')}
              {link('/admin/leave-types', 'tag', 'Leave Types & Policies')}
              {link('/admin/reports', 'chart', 'Organization Reports')}
              {link('/admin/settings', 'settings', 'System Settings')}
            </>
          )}
        </nav>
        <div className="sidebar-foot">{org}</div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setOpen(true)} aria-label="Open menu">
            <Icon name="menu" size={20} />
          </button>
          <div className="grow" />
          <button className="row btn ghost" onClick={() => navigate('/profile')} style={{ gap: 10 }}>
            <div className="avatar">{initials(user.name)}</div>
            <div style={{ textAlign: 'left', lineHeight: 1.2 }}>
              <div style={{ fontWeight: 600 }}>{user.name}</div>
              <div className="muted small">{ROLE_LABELS[user.role]}</div>
            </div>
          </button>
          <button className="icon-btn" onClick={logout} title="Log out" aria-label="Log out">
            <Icon name="logout" size={18} />
          </button>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

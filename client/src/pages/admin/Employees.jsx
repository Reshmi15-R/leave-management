import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api, { errMsg } from '../../api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Empty, Field, Modal, PageHead, Spinner } from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';
import { ROLES, ROLE_LABELS, isoDay, initials } from '../../utils.js';

const blank = { name: '', email: '', password: '', employeeId: '', role: 'team_member', department: '', reportsTo: '', designation: '', phone: '', gender: '', joinDate: isoDay(new Date()), isActive: true };

function EmployeeModal({ employee, departments, people, onClose, onSaved }) {
  const { user } = useAuth();
  const editing = !!employee;
  const [form, setForm] = useState(
    editing
      ? {
          ...blank,
          ...employee,
          password: '',
          department: employee.department?._id || '',
          reportsTo: employee.reportsTo?._id || '',
          joinDate: employee.joinDate ? isoDay(employee.joinDate) : '',
        }
      : blank
  );
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = { ...form };
      if (editing && !payload.password) delete payload.password;
      delete payload._id;
      if (editing) await api.put(`/users/${employee._id}`, payload);
      else await api.post('/users', payload);
      toast.success(editing ? 'Employee updated' : 'Employee added');
      onSaved();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const managers = people.filter((p) => p.isActive && p.role !== 'team_member' && p._id !== employee?._id);
  const roleChoices = user.role === 'admin' ? ROLES : ROLES.filter((r) => r !== 'admin' || employee?.role === 'admin');

  return (
    <Modal
      title={editing ? `Edit ${employee.name}` : 'Add employee'}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" form="emp-form" disabled={busy}>{editing ? 'Save changes' : 'Add employee'}</button>
        </>
      }
    >
      <form id="emp-form" className="form-grid" onSubmit={submit}>
        <Field label="Full name"><input className="input" required value={form.name} onChange={set('name')} /></Field>
        <Field label="Email"><input className="input" type="email" required value={form.email} onChange={set('email')} /></Field>
        <Field label="Employee ID" help="Leave blank to auto-generate"><input className="input" value={form.employeeId || ''} onChange={set('employeeId')} /></Field>
        <Field label={editing ? 'Reset password' : 'Password'} help={editing ? 'Leave blank to keep current password' : 'At least 6 characters'}>
          <input className="input" type="password" required={!editing} minLength={6} value={form.password} onChange={set('password')} />
        </Field>
        <Field label="Role">
          <select className="input" value={form.role} onChange={set('role')} disabled={employee?.role === 'admin' && user.role !== 'admin'}>
            {roleChoices.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        </Field>
        <Field label="Department">
          <select className="input" value={form.department} onChange={set('department')}>
            <option value="">— None —</option>
            {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
          </select>
        </Field>
        <Field label="Reports to" help="First-level leave approver">
          <select className="input" value={form.reportsTo} onChange={set('reportsTo')}>
            <option value="">— None (HR / GM pool) —</option>
            {managers.map((m) => <option key={m._id} value={m._id}>{m.name} — {ROLE_LABELS[m.role]}</option>)}
          </select>
        </Field>
        <Field label="Designation"><input className="input" value={form.designation} onChange={set('designation')} /></Field>
        <Field label="Phone"><input className="input" value={form.phone} onChange={set('phone')} /></Field>
        <Field label="Gender">
          <select className="input" value={form.gender} onChange={set('gender')}>
            <option value="">Not specified</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
          </select>
        </Field>
        <Field label="Join date"><input className="input" type="date" value={form.joinDate} onChange={set('joinDate')} /></Field>
        {editing && (
          <div className="field" style={{ justifyContent: 'flex-end' }}>
            <label className="check"><input type="checkbox" checked={form.isActive} onChange={set('isActive')} /> Active</label>
          </div>
        )}
      </form>
    </Modal>
  );
}

export default function Employees() {
  const [people, setPeople] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [filters, setFilters] = useState({ search: '', role: '', department: '', status: 'active' });
  const [editing, setEditing] = useState(undefined); // undefined = closed, null = new
  const [all, setAll] = useState([]);

  const load = useCallback(() => {
    api
      .get('/users', { params: Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) })
      .then((r) => setPeople(r.data))
      .catch((e) => toast.error(errMsg(e)));
  }, [filters]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  const loadAll = () => api.get('/users').then((r) => setAll(r.data));
  useEffect(() => {
    api.get('/departments').then((r) => setDepartments(r.data));
    loadAll();
  }, []);

  const deactivate = async (u) => {
    try {
      await api.delete(`/users/${u._id}`);
      toast.success(`${u.name} deactivated`);
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const f = (k) => (e) => setFilters({ ...filters, [k]: e.target.value });

  return (
    <div>
      <PageHead title="Employees" subtitle="Add employees, assign roles, departments and reporting managers.">
        <button className="btn primary" onClick={() => setEditing(null)}><Icon name="plus" /> Add employee</button>
      </PageHead>
      <div className="filters">
        <input className="input" placeholder="Search name, email, ID…" value={filters.search} onChange={f('search')} />
        <select className="input" value={filters.role} onChange={f('role')} aria-label="Role">
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
        <select className="input" value={filters.department} onChange={f('department')} aria-label="Department">
          <option value="">All departments</option>
          {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
        </select>
        <select className="input" value={filters.status} onChange={f('status')} aria-label="Status">
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="">All</option>
        </select>
      </div>
      <div className="card">
        {!people ? (
          <Spinner />
        ) : people.length === 0 ? (
          <Empty>No employees match these filters.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Employee</th><th>ID</th><th>Role</th><th>Department</th><th>Reports to</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {people.map((u) => (
                  <tr key={u._id}>
                    <td>
                      <div className="row" style={{ flexWrap: 'nowrap' }}>
                        <div className="avatar sm">{initials(u.name)}</div>
                        <div>
                          <div style={{ fontWeight: 550 }}>{u.name}</div>
                          <div className="muted small">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="ink-2">{u.employeeId}</td>
                    <td>{ROLE_LABELS[u.role]}</td>
                    <td className="ink-2">{u.department?.name || '—'}</td>
                    <td className="ink-2">{u.reportsTo?.name || '—'}</td>
                    <td>{u.isActive ? <span className="badge approved">Active</span> : <span className="badge neutral">Inactive</span>}</td>
                    <td>
                      <div className="row" style={{ flexWrap: 'nowrap' }}>
                        <button className="icon-btn" title="Edit" aria-label="Edit" onClick={() => setEditing(u)}><Icon name="edit" /></button>
                        {u.isActive && (
                          <button className="icon-btn" title="Deactivate" aria-label="Deactivate" onClick={() => deactivate(u)}><Icon name="ban" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {editing !== undefined && (
        <EmployeeModal
          employee={editing}
          departments={departments}
          people={all}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            load();
            loadAll();
          }}
        />
      )}
    </div>
  );
}

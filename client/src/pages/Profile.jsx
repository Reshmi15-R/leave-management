import { useState } from 'react';
import toast from 'react-hot-toast';
import api, { errMsg } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Field, PageHead } from '../components/ui.jsx';
import { ROLE_LABELS, fmtDate, initials } from '../utils.js';

export default function Profile() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({ name: user.name, phone: user.phone || '', designation: user.designation || '' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });

  const save = async (e) => {
    e.preventDefault();
    try {
      setUser((await api.put('/auth/me', form)).data);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  const changePw = async (e) => {
    e.preventDefault();
    if (pw.newPassword !== pw.confirm) return toast.error('New passwords do not match');
    try {
      await api.put('/auth/me/password', pw);
      toast.success('Password changed');
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  return (
    <div className="stack">
      <PageHead title="My profile" />
      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <div className="card card-body">
          <div className="row" style={{ gap: 14, marginBottom: 18 }}>
            <div className="avatar" style={{ width: 52, height: 52, fontSize: 16 }}>{initials(user.name)}</div>
            <div>
              <h2>{user.name}</h2>
              <div className="ink-2">{user.email}</div>
            </div>
          </div>
          <dl className="kv">
            <dt>Employee ID</dt><dd>{user.employeeId}</dd>
            <dt>Role</dt><dd>{ROLE_LABELS[user.role]}</dd>
            <dt>Department</dt><dd>{user.department?.name || '—'}</dd>
            <dt>Reports to</dt><dd>{user.reportsTo?.name || '—'}</dd>
            <dt>Joined</dt><dd>{fmtDate(user.joinDate)}</dd>
          </dl>
          <form className="stack" style={{ marginTop: 22 }} onSubmit={save}>
            <Field label="Name"><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Designation"><input className="input" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></Field>
            <Field label="Phone"><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <button className="btn primary">Save profile</button>
          </form>
        </div>
        <form className="card card-body stack" onSubmit={changePw}>
          <h2>Change password</h2>
          <Field label="Current password"><input className="input" type="password" required value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></Field>
          <Field label="New password"><input className="input" type="password" required minLength={6} value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></Field>
          <Field label="Confirm new password"><input className="input" type="password" required value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></Field>
          <button className="btn primary">Update password</button>
        </form>
      </div>
    </div>
  );
}

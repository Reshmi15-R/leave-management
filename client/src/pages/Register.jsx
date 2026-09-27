import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api, { errMsg } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Alert, Field } from '../components/ui.jsx';
import { AuthHero } from './Login.jsx';
import { ROLE_LABELS } from '../utils.js';

export default function Register() {
  const { register } = useAuth();
  const [meta, setMeta] = useState({ departments: [], approvers: [] });
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', department: '', reportsTo: '', designation: '', phone: '', gender: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/auth/meta').then((r) => setMeta(r.data)).catch(() => {});
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) return setError('Passwords do not match');
    setBusy(true);
    setError('');
    try {
      const { confirm, ...data } = form;
      await register(data);
      toast.success('Account created');
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const approvers = form.department ? meta.approvers.filter((a) => !a.department || a.department === form.department).concat(meta.approvers.filter((a) => a.department && a.department !== form.department)) : meta.approvers;

  return (
    <div className="auth-page">
      <AuthHero />
      <div className="auth-form">
        <div className="auth-card" style={{ maxWidth: 520 }}>
          <h1>Create your account</h1>
          <p className="ink-2" style={{ margin: '6px 0 22px' }}>
            New accounts start as Team Members. An administrator can change your role later.
          </p>
          <form onSubmit={submit} className="form-grid">
            {error && <div className="full"><Alert kind="error">{error}</Alert></div>}
            <Field label="Full name" className="full">
              <input className="input" required value={form.name} onChange={set('name')} />
            </Field>
            <Field label="Work email" className="full">
              <input className="input" type="email" required value={form.email} onChange={set('email')} />
            </Field>
            <Field label="Password" help="At least 6 characters">
              <input className="input" type="password" required minLength={6} value={form.password} onChange={set('password')} />
            </Field>
            <Field label="Confirm password">
              <input className="input" type="password" required value={form.confirm} onChange={set('confirm')} />
            </Field>
            <Field label="Department">
              <select className="input" value={form.department} onChange={set('department')}>
                <option value="">Select…</option>
                {meta.departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
              </select>
            </Field>
            <Field label="Reporting manager" help="Approves your leave">
              <select className="input" value={form.reportsTo} onChange={set('reportsTo')}>
                <option value="">Select…</option>
                {approvers.map((a) => <option key={a._id} value={a._id}>{a.name} — {ROLE_LABELS[a.role]}</option>)}
              </select>
            </Field>
            <Field label="Designation">
              <input className="input" value={form.designation} onChange={set('designation')} />
            </Field>
            <Field label="Gender" help="Used for gender-specific leave types">
              <select className="input" value={form.gender} onChange={set('gender')}>
                <option value="">Prefer not to say</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <div className="full">
              <button className="btn primary block" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
            </div>
          </form>
          <p style={{ marginTop: 18 }} className="ink-2">
            Already registered? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

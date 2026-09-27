import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext.jsx';
import { errMsg } from '../api.js';
import { Alert, Field } from '../components/ui.jsx';
import Icon from '../components/Icon.jsx';

const DEMO = [
  ['admin@company.com', 'Admin'],
  ['gm@company.com', 'General Manager'],
  ['manager@company.com', 'Team Manager'],
  ['leader@company.com', 'Team Leader'],
  ['member@company.com', 'Team Member'],
];

export function AuthHero() {
  return (
    <div className="auth-hero">
      <div className="row" style={{ fontWeight: 700, fontSize: 18 }}>
        <div className="brand-mark" style={{ background: 'rgba(255,255,255,0.18)' }}>
          <Icon name="calendar" />
        </div>
        LeaveDesk
      </div>
      <div>
        <h1>Leave management for your whole organization</h1>
        <ul>
          <li>Apply for casual, medical, earned and more</li>
          <li>Multi-level approval workflow</li>
          <li>Live balances, team calendar & reports</li>
          <li>Configurable policies and entitlements</li>
        </ul>
      </div>
      <div style={{ opacity: 0.7, fontSize: 12 }}>MERN stack · MongoDB · Express · React · Node</div>
    </div>
  );
}

export default function Login() {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const user = await login(form.email, form.password);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}`);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <AuthHero />
      <div className="auth-form">
        <div className="auth-card">
          <h1>Sign in</h1>
          <p className="ink-2" style={{ margin: '6px 0 22px' }}>Use your work email to continue.</p>
          <form onSubmit={submit} className="stack">
            {error && <Alert kind="error">{error}</Alert>}
            <Field label="Email">
              <input className="input" type="email" required autoFocus value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Password">
              <input className="input" type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </Field>
            <button className="btn primary block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          </form>
          <p style={{ marginTop: 18 }} className="ink-2">
            New employee? <Link to="/register">Create an account</Link>
          </p>
          <div className="demo-list card card-pad">
            <div className="label-text" style={{ marginBottom: 6 }}>Demo accounts (password: password123)</div>
            {DEMO.map(([email, label]) => (
              <button key={email} type="button" onClick={() => setForm({ email, password: 'password123' })}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

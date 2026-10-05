import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { errorMessage } from '../services/api.js';

export default function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const user = await login(form);
      toast.success(`Welcome back, ${user.name}`);
      navigate(location.state?.from || '/theatres', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card mx-auto max-w-md p-6">
      <h1 className="text-2xl font-bold">Log in</h1>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <div><label className="label" htmlFor="email">Email</label>
          <input id="email" className="input" type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div><label className="label" htmlFor="password">Password</label>
          <input id="password" className="input" type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
        {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Logging in...' : 'Log in'}</button>
      </form>
      <p className="mt-4 text-sm text-ink/70">New here? <Link className="font-semibold text-velvet" to="/register">Create an account</Link></p>
      <p className="mt-3 rounded-lg bg-paper p-3 text-xs text-ink/60">Demo accounts: alice@example.com / User@123, admin@cineopt.com / Admin@123</p>
    </div>
  );
}

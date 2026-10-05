import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { errorMessage } from '../services/api.js';

export default function Register() {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) {
      return setError('Use at least 8 characters with a letter and a number.');
    }
    setBusy(true); setError('');
    try {
      await register(form);
      toast.success('Account created');
      navigate('/theatres', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  return (
    <div className="card mx-auto max-w-md p-6">
      <h1 className="text-2xl font-bold">Create your account</h1>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <div><label className="label" htmlFor="name">Name</label><input id="name" className="input" required minLength={2} value={form.name} onChange={set('name')} autoComplete="name" /></div>
        <div><label className="label" htmlFor="email">Email</label><input id="email" className="input" type="email" required value={form.email} onChange={set('email')} autoComplete="email" /></div>
        <div><label className="label" htmlFor="password">Password</label><input id="password" className="input" type="password" required value={form.password} onChange={set('password')} autoComplete="new-password" />
          <p className="mt-1 text-xs text-ink/50">At least 8 characters, with a letter and a number.</p></div>
        {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Creating account...' : 'Register'}</button>
      </form>
      <p className="mt-4 text-sm text-ink/70">Already registered? <Link className="font-semibold text-velvet" to="/login">Log in</Link></p>
    </div>
  );
}

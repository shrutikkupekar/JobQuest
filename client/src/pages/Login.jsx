import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE } from '../api.js';

export default function Login({ onAuth }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem('jq_remember_me') !== 'false');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || 'Login failed');
      }

      onAuth(data.token, rememberMe);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Unable to log in.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-form">
      <h1>Welcome back</h1>
      <p className="muted">Sign in to keep tracking your job search.</p>

      {error && <div className="error">{error}</div>}

      <form onSubmit={handleSubmit} className="auth-fields">
        <label>
          Email
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            required
          />
        </label>

        <label>
          Password
          <div className="password-input-wrap">
            <input
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              required
            />
            <button
              type="button"
              className="password-toggle"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 3l18 18" />
                  <path d="M10.6 10.6A2 2 0 0 0 13.4 13.4" />
                  <path d="M9.1 5.5A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a16.3 16.3 0 0 1-4.1 5.2" />
                  <path d="M6.5 6.5A15.5 15.5 0 0 0 2 12s3.5 7 10 7a10.7 10.7 0 0 0 5.4-1.5" />
                </svg>
              )}
            </button>
          </div>
        </label>

        <label className="remember-row">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
          />
          <span>Keep me signed in</span>
        </label>

        <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Log in'}
        </button>
      </form>

      <p className="auth-switch">
        Need an account? <Link to="/signup">Create one</Link>
      </p>
    </div>
  );
}

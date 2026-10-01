import { useState } from 'react';
import { LogIn, Eye, EyeOff } from 'lucide-react';
import { api, setToken } from '../api.js';
import { BrandMark } from '../components/ui.jsx';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { token, username: name } = await api('/auth/login', { method: 'POST', body: { username, password } });
      setToken(token);
      onLogin(name);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <form className="card login-card" onSubmit={submit}>
        <div className="brand">
          <BrandMark />
          <span className="brand-name">DEPOT ISSUE CONTROL</span>
        </div>
        <p className="muted" style={{ margin: '4px 0 8px', fontSize: 14 }}>
          Sign in to the supply depot control board.
        </p>
        <div className="field">
          <label htmlFor="u">Username</label>
          <input id="u" className="input" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="p">Password</label>
          <div className="password-field">
            <input
              id="p"
              className="input"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="reveal"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
        {error && (
          <div className="alert tone-crit form-error" role="alert">
            <span />
            <div>{error}</div>
          </div>
        )}
        <button className="btn btn-primary" style={{ width: '100%', marginTop: 20 }} disabled={busy}>
          <LogIn size={18} aria-hidden="true" />
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <div className="classification">For authorised users only</div>
      </form>
    </div>
  );
}

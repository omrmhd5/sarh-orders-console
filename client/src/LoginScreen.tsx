import { FormEvent, useState } from 'react';
import { ApiError, api } from './api';
import type { SessionUser } from './types';

type LoginProps = {
  onSuccess: (user: SessionUser) => void;
};

const DEMO_ACCOUNTS = [
  { role: 'Agent', email: 'agent@sarh.test', password: 'SarhAgent-2026' },
  { role: 'Admin', email: 'admin@sarh.test', password: 'SarhAdmin-2026' },
] as const;

export function LoginScreen({ onSuccess }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const nextEmail = email.trim();
    if (!nextEmail.includes('@') || password.length === 0) {
      setError('Enter the email and password from the seed.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const body = await api<{ user: SessionUser }>('/api/login', {
        method: 'POST',
        body: JSON.stringify({ email: nextEmail, password }),
      });
      onSuccess(body.user);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Sign-in did not complete');
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="login">
      <form className="login-panel" onSubmit={onSubmit}>
        <div className="brand">
          <TicketMark />
          <div>
            <p className="brand-name">SARH</p>
            <p className="scope">Operations</p>
          </div>
        </div>
        <h1>Sign in</h1>
        <p className="sub">Find an order, or register a phone order once.</p>
        <label className="field">
          Email
          <input
            className="input"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="field">
          Password
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <button className="btn primary" type="submit" disabled={pending}>
          {pending ? 'Signing in' : 'Sign in'}
        </button>
        <div className="login-demo">
          <p className="login-demo-label">Demo logins</p>
          <ul className="login-demo-list">
            {DEMO_ACCOUNTS.map((account) => (
              <li key={account.role}>
                <button
                  type="button"
                  className="login-demo-row"
                  disabled={pending}
                  onClick={() => {
                    setEmail(account.email);
                    setPassword(account.password);
                    setError(null);
                  }}
                >
                  <span className="login-demo-role">{account.role}</span>
                  <span className="login-demo-creds">
                    {account.email}
                    <span className="login-demo-sep" aria-hidden="true">·</span>
                    {account.password}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="login-demo-hint">Tap a row to fill the form.</p>
        </div>
      </form>
    </main>
  );
}

export function TicketMark() {
  return (
    <svg className="mark-svg" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="2.5" width="12" height="16" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6.5 7h6M6.5 10.5h6M6.5 14h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M10 8.5h10.5V21H8" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

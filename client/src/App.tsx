import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { LoginScreen } from './LoginScreen';
import { OrdersScreen } from './OrdersScreen';
import { Shell } from './Shell';
import type { SessionUser } from './types';

export function App() {
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
  const onUnauthorized = useCallback(() => setUser(null), []);

  useEffect(() => {
    let gone = false;
    api<{ user: SessionUser }>('/api/me')
      .then((body) => {
        if (!gone) setUser(body.user);
      })
      .catch(() => {
        if (!gone) setUser(null);
      });
    return () => {
      gone = true;
    };
  }, []);

  async function onLogout() {
    await api('/api/logout', { method: 'POST' }).catch(() => undefined);
    setUser(null);
  }

  if (user === undefined) {
    return (
      <main className="login">
        <h1>SARH Orders</h1>
        <p className="sub">Checking the session</p>
      </main>
    );
  }

  if (!user) return <LoginScreen onSuccess={setUser} />;

  return (
    <Shell
      user={user}
      title="Orders"
      sub="Search before you register a phone order."
      onLogout={onLogout}
      action={
        <button className="btn primary" type="button" onClick={() => undefined}>
          Register phone order
        </button>
      }
    >
      <OrdersScreen onUnauthorized={onUnauthorized} />
    </Shell>
  );
}

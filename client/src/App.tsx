import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { CreateOrder } from './CreateOrder';
import { LoginScreen } from './LoginScreen';
import { OrdersScreen } from './OrdersScreen';
import { Shell } from './Shell';
import type { SessionUser } from './types';

export function App() {
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
  const [view, setView] = useState<'list' | 'create'>('list');
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
      title={view === 'list' ? 'Orders' : 'Phone order'}
      sub={view === 'list' ? 'Search before you register a phone order.' : 'One submission is one order.'}
      onLogout={onLogout}
      action={
        view === 'list' ? (
          <button className="btn primary" type="button" onClick={() => setView('create')}>
            Register phone order
          </button>
        ) : (
          <button className="btn" type="button" onClick={() => setView('list')}>
            Back to orders
          </button>
        )
      }
    >
      {view === 'list' ? <OrdersScreen onUnauthorized={onUnauthorized} /> : <CreateOrder />}
    </Shell>
  );
}

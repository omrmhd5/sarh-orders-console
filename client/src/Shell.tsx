import { useState, type ReactNode } from 'react';
import { TicketMark } from './LoginScreen';
import type { SessionUser } from './types';

type ShellProps = {
  user: SessionUser;
  title: string;
  sub: string;
  action: ReactNode;
  onLogout: () => void;
  children: ReactNode;
};

export function Shell({ user, title, sub, action, onLogout, children }: ShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="app">
      <aside className={menuOpen ? 'sidebar open' : 'sidebar'}>
        <div className="brand">
          <TicketMark />
          <div>
            <p className="brand-name">SARH</p>
            <p className="scope">Operations</p>
          </div>
        </div>
        <button className="menu-toggle close-menu" type="button" onClick={() => setMenuOpen(false)}>
          Close
        </button>
        <nav aria-label="Console">
          <a className="nav-item" href="#orders" aria-current="page" onClick={() => setMenuOpen(false)}>
            Orders
          </a>
        </nav>
        <div className="bottom">
          <p className="user-name">{user.name}</p>
          <p className="scope">{user.role === 'admin' ? 'Admin' : 'Agent'}</p>
          <button className="btn ghost" type="button" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </aside>
      <div className="canvas">
        <div className="title-row">
          <button
            className="menu-toggle"
            type="button"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? 'Close' : 'Menu'}
          </button>
          <div className="title-copy">
            <h1>{title}</h1>
            <p className="sub">{sub}</p>
          </div>
          {action}
        </div>
        {children}
      </div>
    </div>
  );
}

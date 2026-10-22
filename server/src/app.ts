import express, { type Express } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { login, logout, me, requireAuth, requireRole } from './auth.js';

export function createApp(db: DatabaseSync): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/login', (req, res) => login(db, req, res));
  app.post('/api/logout', (req, res) => logout(req, res));
  app.get('/api/me', requireAuth(db), (req, res) => me(req, res));

  app.delete('/api/orders/:id', requireAuth(db), requireRole('admin'), (req, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'missing id' });
      return;
    }
    const result = db.prepare('DELETE FROM orders WHERE id = ?').run(id);
    if (result.changes === 0) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json({ ok: true });
  });

  return app;
}

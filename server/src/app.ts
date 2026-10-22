import express, { type Express } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { login, logout, me, requireAuth, requireRole } from './auth.js';
import { createOrder, readIdempotencyKey } from './createOrder.js';
import { listOrders } from './orders.js';

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

  app.get('/api/orders', requireAuth(db), (req, res) => {
    const result = listOrders(db, req.query);
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result.page);
  });

  app.post('/api/orders', requireAuth(db), (req, res) => {
    const key = readIdempotencyKey(req.get('idempotency-key'));
    if (!key) {
      res.status(400).json({ error: 'Send an Idempotency-Key for this submission' });
      return;
    }
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'no token' });
      return;
    }
    try {
      const result = createOrder(db, key, req.body, user.id);
      if (!result.ok) {
        res.status(400).json({ errors: result.errors });
        return;
      }
      res.status(result.replayed ? 200 : 201).json({ order: result.order, replayed: result.replayed });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'The order could not be saved' });
    }
  });

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

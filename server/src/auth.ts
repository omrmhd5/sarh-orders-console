import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import { verifyPassword } from './password.js';

const FORBIDDEN_SECRET = 'sarh-secret-2026';
const SESSION_COOKIE = 'sarh_session';
const SESSION_SECONDS = 60 * 60 * 8;

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'agent';
};

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

const loginBody = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export function assertSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16 || secret === FORBIDDEN_SECRET) {
    throw new Error('Set JWT_SECRET in .env. The old hardcoded secret is refused.');
  }
  return secret;
}

function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    if (trimmed.slice(0, eq) !== name) continue;
    return decodeURIComponent(trimmed.slice(eq + 1));
  }
  return null;
}

function sessionCookie(token: string, maxAge: number): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

type UserRow = SessionUser & { password_hash: string };

function findUserByEmail(db: DatabaseSync, email: string): UserRow | undefined {
  return db
    .prepare(
      `SELECT id, email, name, role, password_hash FROM users WHERE email = ?`,
    )
    .get(email) as UserRow | undefined;
}

function findUserById(db: DatabaseSync, id: string): SessionUser | undefined {
  return db
    .prepare(`SELECT id, email, name, role FROM users WHERE id = ?`)
    .get(id) as SessionUser | undefined;
}

export function login(db: DatabaseSync, req: Request, res: Response): void {
  const parsed = loginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Enter an email and a password' });
    return;
  }
  const user = findUserByEmail(db, parsed.data.email.toLowerCase());
  if (!user || !verifyPassword(parsed.data.password, user.password_hash)) {
    res.status(401).json({ error: 'wrong email or password' });
    return;
  }
  const token = jwt.sign({ sub: user.id }, assertSecret(), {
    algorithm: 'HS256',
    expiresIn: SESSION_SECONDS,
  });
  res.setHeader('Set-Cookie', sessionCookie(token, SESSION_SECONDS));
  res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
}

export function logout(_req: Request, res: Response): void {
  res.setHeader('Set-Cookie', sessionCookie('', 0));
  res.json({ ok: true });
}

export function me(req: Request, res: Response): void {
  res.json({ user: req.user });
}

export function requireAuth(db: DatabaseSync) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Cookie only. A query-string token is left unread on purpose.
    const token = readCookie(req.headers.cookie, SESSION_COOKIE);
    if (!token) {
      res.status(401).json({ error: 'no token' });
      return;
    }
    try {
      const decoded = jwt.verify(token, assertSecret(), { algorithms: ['HS256'] });
      if (typeof decoded === 'string' || typeof decoded.sub !== 'string') {
        res.status(401).json({ error: 'bad token' });
        return;
      }
      const user = findUserById(db, decoded.sub);
      if (!user || (user.role !== 'admin' && user.role !== 'agent')) {
        res.status(401).json({ error: 'bad token' });
        return;
      }
      req.user = user;
      next();
    } catch {
      res.status(401).json({ error: 'bad token' });
    }
  };
}

export function requireRole(role: SessionUser['role']) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.user?.role !== role) {
      res.status(403).json({ error: 'admin only' });
      return;
    }
    next();
  };
}

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { repoRoot } from './env.js';

export const databasePath = path.join(repoRoot, 'data', 'orders.sqlite');

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'agent'))
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('new', 'confirmed', 'fulfilled', 'cancelled')),
  total_halalas INTEGER NOT NULL CHECK (total_halalas >= 0),
  created_at TEXT NOT NULL,
  created_by TEXT REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_halalas INTEGER NOT NULL CHECK (unit_halalas >= 0)
);

CREATE INDEX IF NOT EXISTS orders_status_created_id ON orders (status, created_at, id);
CREATE INDEX IF NOT EXISTS orders_status_total_id ON orders (status, total_halalas, id);
CREATE INDEX IF NOT EXISTS orders_created_id ON orders (created_at, id);
CREATE INDEX IF NOT EXISTS orders_total_id ON orders (total_halalas, id);

CREATE VIRTUAL TABLE IF NOT EXISTS orders_fts USING fts5(
  customer_name,
  customer_email,
  content='orders',
  content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS orders_fts_insert AFTER INSERT ON orders BEGIN
  INSERT INTO orders_fts(rowid, customer_name, customer_email)
  VALUES (new.rowid, new.customer_name, new.customer_email);
END;

CREATE TRIGGER IF NOT EXISTS orders_fts_delete AFTER DELETE ON orders BEGIN
  INSERT INTO orders_fts(orders_fts, rowid, customer_name, customer_email)
  VALUES ('delete', old.rowid, old.customer_name, old.customer_email);
END;

CREATE TRIGGER IF NOT EXISTS orders_fts_update AFTER UPDATE OF customer_name, customer_email ON orders BEGIN
  INSERT INTO orders_fts(orders_fts, rowid, customer_name, customer_email)
  VALUES ('delete', old.rowid, old.customer_name, old.customer_email);
  INSERT INTO orders_fts(rowid, customer_name, customer_email)
  VALUES (new.rowid, new.customer_name, new.customer_email);
END;
`;

export function openDatabase(): DatabaseSync {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec(SCHEMA);
  return db;
}

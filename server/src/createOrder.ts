import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { validateOrder, type OrderInput } from '../../shared/orderInput.ts';

export type CreatedOrder = {
  id: string;
  customerName: string;
  customerEmail: string;
  status: 'new';
  totalHalalas: number;
  createdAt: string;
  idempotencyKey: string;
  items: Array<{ id: string; name: string; quantity: number; unitHalalas: number }>;
};

type OrderRow = {
  id: string;
  customer_name: string;
  customer_email: string;
  status: 'new';
  total_halalas: number;
  created_at: string;
  idempotency_key: string;
};

const KEY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readIdempotencyKey(header: string | undefined): string | null {
  if (!header || !KEY.test(header.trim())) return null;
  return header.trim().toLowerCase();
}

function isUnique(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as { errcode?: number; message?: string };
  return err.errcode === 2067 || (err.message?.includes('UNIQUE') ?? false);
}

function readOrder(db: DatabaseSync, key: string): CreatedOrder | null {
  const order = db
    .prepare(
      `SELECT id, customer_name, customer_email, status, total_halalas, created_at, idempotency_key
       FROM orders WHERE idempotency_key = ?`,
    )
    .get(key) as OrderRow | undefined;
  if (!order) return null;
  const items = db
    .prepare(
      `SELECT id, name, quantity, unit_halalas AS unitHalalas
       FROM order_items WHERE order_id = ? ORDER BY id`,
    )
    .all(order.id) as CreatedOrder['items'];
  return {
    id: order.id,
    customerName: order.customer_name,
    customerEmail: order.customer_email,
    status: 'new',
    totalHalalas: order.total_halalas,
    createdAt: order.created_at,
    idempotencyKey: order.idempotency_key,
    items,
  };
}

export function createOrder(
  db: DatabaseSync,
  key: string,
  raw: unknown,
  createdBy: string,
): { ok: true; order: CreatedOrder; replayed: boolean } | { ok: false; errors: string[] } {
  const parsed = validateOrder(raw);
  if (!parsed.ok) return parsed;
  const existing = readOrder(db, key);
  if (existing) return { ok: true, order: existing, replayed: true };

  const value: OrderInput = parsed.value;
  const id = `ord_${randomUUID()}`;
  const createdAt = new Date().toISOString();
  try {
    db.exec('BEGIN IMMEDIATE');
    db.prepare(
      `INSERT INTO orders (
         id, idempotency_key, customer_name, customer_email, status, total_halalas, created_at, created_by
       ) VALUES (?, ?, ?, ?, 'new', ?, ?, ?)`,
    ).run(id, key, value.customerName, value.customerEmail, value.totalHalalas, createdAt, createdBy);
    const insertItem = db.prepare(
      `INSERT INTO order_items (id, order_id, name, quantity, unit_halalas) VALUES (?, ?, ?, ?, ?)`,
    );
    value.items.forEach((item, index) => {
      insertItem.run(`${id}_${index + 1}`, id, item.name, item.quantity, item.unitHalalas);
    });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    if (!isUnique(error)) throw error;
  }

  const order = readOrder(db, key);
  if (!order) throw new Error('The order insert did not persist');
  return { ok: true, order, replayed: order.id !== id };
}

import type { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';

const PAGE_SIZE = 50;

const querySchema = z.object({
  q: z.string().optional(),
  status: z.enum(['new', 'confirmed', 'fulfilled', 'cancelled']).optional(),
  sort: z.enum(['created_at', 'total']).default('created_at'),
  dir: z.enum(['asc', 'desc']).default('desc'),
  cursor: z.string().min(1).optional(),
});

export type OrderSummary = {
  id: string;
  customerName: string;
  customerEmail: string;
  status: 'new' | 'confirmed' | 'fulfilled' | 'cancelled';
  totalHalalas: number;
  createdAt: string;
};

export type OrderPage = {
  orders: OrderSummary[];
  nextCursor: string | null;
  total: number;
};

type Cursor = {
  sort: 'created_at' | 'total';
  dir: 'asc' | 'desc';
  v: string | number;
  id: string;
};

type OrderRow = {
  id: string;
  customer_name: string;
  customer_email: string;
  status: OrderSummary['status'];
  total_halalas: number;
  created_at: string;
};

function one(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

function ftsMatch(raw: string | undefined): string | null {
  if (!raw) return null;
  const terms = raw
    .trim()
    .split(/\s+/)
    .map((term) => term.replace(/[^0-9A-Za-z\u0600-\u06FF@._+-]/g, ''))
    .filter((term) => term.length > 0);
  if (terms.length === 0) return null;
  return terms.map((term) => `"${term.replaceAll('"', '')}"*`).join(' AND ');
}

function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

function decodeCursor(raw: string): Cursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Partial<Cursor>;
    if (parsed.sort !== 'created_at' && parsed.sort !== 'total') return null;
    if (parsed.dir !== 'asc' && parsed.dir !== 'desc') return null;
    if (typeof parsed.id !== 'string' || parsed.id.length === 0) return null;
    if (typeof parsed.v !== 'string' && typeof parsed.v !== 'number') return null;
    return { sort: parsed.sort, dir: parsed.dir, v: parsed.v, id: parsed.id };
  } catch {
    return null;
  }
}

function toSummary(row: OrderRow): OrderSummary {
  return {
    id: row.id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    status: row.status,
    totalHalalas: row.total_halalas,
    createdAt: row.created_at,
  };
}

export function listOrders(
  db: DatabaseSync,
  rawQuery: Record<string, unknown>,
): { ok: true; page: OrderPage } | { ok: false; error: string } {
  const status = one(rawQuery.status);
  const parsed = querySchema.safeParse({
    q: one(rawQuery.q) || undefined,
    status: status === '' || status === undefined ? undefined : status,
    sort: one(rawQuery.sort) || undefined,
    dir: one(rawQuery.dir) || undefined,
    cursor: one(rawQuery.cursor) || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: 'Check the status, sort, and cursor' };
  }

  const { q, status: orderStatus, sort, dir, cursor: rawCursor } = parsed.data;
  const match = ftsMatch(q);
  const cursor = rawCursor ? decodeCursor(rawCursor) : null;
  if (rawCursor && !cursor) return { ok: false, error: 'That page cursor is not valid' };
  if (cursor && (cursor.sort !== sort || cursor.dir !== dir)) {
    return { ok: false, error: 'The cursor belongs to a different sort' };
  }
  if (cursor && sort === 'total' && typeof cursor.v !== 'number') {
    return { ok: false, error: 'That page cursor is not valid' };
  }
  if (cursor && sort === 'created_at' && typeof cursor.v !== 'string') {
    return { ok: false, error: 'That page cursor is not valid' };
  }

  const column = sort === 'total' ? 'o.total_halalas' : 'o.created_at';
  const direction = dir === 'asc' ? 'ASC' : 'DESC';
  const comparator = dir === 'asc' ? '>' : '<';
  const where: string[] = [];
  const params: Array<string | number> = [];

  if (match) {
    where.push('orders_fts MATCH ?');
    params.push(match);
  }
  if (orderStatus) {
    where.push('o.status = ?');
    params.push(orderStatus);
  }
  if (cursor) {
    where.push(`(${column}, o.id) ${comparator} (?, ?)`);
    params.push(cursor.v, cursor.id);
  }

  const join = match ? 'JOIN orders_fts ON orders_fts.rowid = o.rowid' : '';
  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db
    .prepare(
      `SELECT o.id, o.customer_name, o.customer_email, o.status, o.total_halalas, o.created_at
       FROM orders o
       ${join}
       ${whereSql}
       ORDER BY ${column} ${direction}, o.id ${direction}
       LIMIT ?`,
    )
    .all(...params, PAGE_SIZE + 1) as OrderRow[];

  const countParams = cursor ? params.slice(0, -2) : params;
  const countWhere = where.filter((clause) => !clause.startsWith('('));
  const count = db
    .prepare(
      `SELECT COUNT(*) AS n
       FROM orders o
       ${join}
       ${countWhere.length > 0 ? `WHERE ${countWhere.join(' AND ')}` : ''}`,
    )
    .get(...countParams) as { n: number };

  const pageRows = rows.slice(0, PAGE_SIZE);
  const last = pageRows[pageRows.length - 1];
  const nextCursor =
    rows.length > PAGE_SIZE && last
      ? encodeCursor({
          sort,
          dir,
          v: sort === 'total' ? last.total_halalas : last.created_at,
          id: last.id,
        })
      : null;

  return {
    ok: true,
    page: {
      orders: pageRows.map(toSummary),
      nextCursor,
      total: count.n,
    },
  };
}

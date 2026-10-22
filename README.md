# SARH Orders Console

A local console for an operations team that has to find an order in a large queue and register a phone order without creating a duplicate.

## Setup

Node.js 22.13 or newer.

```bash
npm install
copy .env.example .env
npm run seed
npm run dev
```

On macOS or Linux, use `cp .env.example .env`.

The client runs at http://localhost:5173 and proxies `/api` to the API on http://127.0.0.1:3001.

`GET /api/health` returns `{ "ok": true }`.

## Seed

`npm run seed` deletes `data/orders.sqlite` and writes it again. The file is gitignored. The load is 50,000 orders, each with 1–5 line items, plus two users:

| Email | Password | Role |
| --- | --- | --- |
| admin@sarh.test | SarhAdmin-2026 | admin |
| agent@sarh.test | SarhAgent-2026 | agent |

Amounts are integer halalas (1 SAR = 100). Statuses are `new`, `confirmed`, `fulfilled`, and `cancelled`.

Indexes the list query is built for:

- `orders_status_created_id` on `(status, created_at, id)`
- `orders_status_total_id` on `(status, total_halalas, id)`
- `orders_created_id` on `(created_at, id)`
- `orders_total_id` on `(total_halalas, id)`
- unique `orders.idempotency_key`
- FTS5 `orders_fts` on customer name and email

Login, the orders list, and the duplicate-order proof land in the commits after the seed. The finished README adds the auth review and what was left out.

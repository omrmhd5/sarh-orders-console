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

## Auth review

The contractor middleware was the starting point for `/api/orders`. These are the problems in it, and what the server does instead.

- `jwt.decode` never checks the signature or `exp`, so anyone can invent `{ sub, role }`. Login now signs with `jwt.verify` restricted to HS256, and the token expires after 8 hours.
- The secret `sarh-secret-2026` was in source. `JWT_SECRET` comes from the environment, and the process refuses to boot if it is missing or still that string.
- The token was also read from `?token=`, which leaks into logs, history, and Referer. That parameter is ignored.
- `Authorization` was split on a space and the second piece was trusted for any scheme. The API does not accept a bearer header.
- Login looked up email and password together, which only works if the password is stored in the clear. The lookup is by email, and the check is `scrypt`.
- `DELETE /api/orders/:id` trusted a React `AdminOnly` component. The route now reloads the user from the database and returns 403 unless the role is still `admin`. Reloading means a demotion takes effect before the cookie expires.

The browser stores the session in an httpOnly, SameSite=Lax cookie named `sarh_session`. Page script cannot read it, so a typical XSS cannot steal the token and reuse it elsewhere. Script that is already running in the page can still call the API as the signed-in user. A cross-site POST does not send this cookie. A future GET that changed data would not have that protection; this API does not do that.

`POST /api/login` with `{ "email", "password" }` sets the cookie and returns the user, not the token. `POST /api/logout` clears it. `GET /api/me` returns the current user.

Seeded passwords are in the table above.

## Orders list

`GET /api/orders` is authenticated. It never returns the full table. The client aborts the request already in flight when the search, status, or sort changes, and it ignores a response that is no longer the latest one. Each response is at most 50 rows:

`q` searches customer name and email, `status` is one of the four statuses, `sort` is `created_at` or `total`, `dir` is `asc` or `desc`, and `cursor` is the `nextCursor` from the previous page. The response is `{ orders, nextCursor, total }`. A request cannot raise the page size.

## Create an order

`POST /api/orders` requires the session cookie and an `Idempotency-Key` header (a UUID, one per submission). The same key, including two requests in flight together, inserts one row. The unique index on `orders.idempotency_key` is the guarantee. The button being disabled is only a convenience.

The body is `customerName`, `customerEmail`, `items` (1 to 5 of `name`, `quantity`, `unitHalalas`), and `totalHalalas`. Client and server both check the fields. The server adds the line items again and rejects the request when the amount does not match. A new order is status `new`. A repeated key returns the original order with `replayed: true` and does not write a second row.

The duplicate-order proof, the product question, and `DECISIONS.md` come next.

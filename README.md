# SARH Orders Console

A local console for an operations team that has to find an order in a large queue and register a phone order without creating a duplicate.

## Setup

Node.js 22.13 or newer.

```bash
npm install
copy .env.example .env
npm run dev
```

On macOS or Linux, use `cp .env.example .env`.

The client runs at http://localhost:5173 and proxies `/api` to the API on http://127.0.0.1:3001.

`GET /api/health` returns `{ "ok": true }`.

Seed, login, the orders list, and the duplicate-order proof are added in the commits after this one. The finished README lists every command, the auth review, and what was left out.

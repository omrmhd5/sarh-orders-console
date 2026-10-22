# Decisions

## One submission is one order

The phone-order form makes an idempotency key when it opens and sends that same key on a double-click or a retry. The server stores it in `orders.idempotency_key`, which is unique, and inserts the order and its items in one transaction. If two requests race, one insert wins and the other reads that row and returns it. `npm test` posts the same body twice with `Promise.all` and checks that one row exists.
I considered disabling the button, and a lock inside the Node process. The button does nothing when the browser resends a request after a timeout, and a process lock does not cover two requests already in flight. The unique index does.
This stops a repeated submission, not two intentional orders. A new form gets a new key. Keys are not expired in this build.

## Pages come from a keyset cursor

`GET /api/orders` returns 50 rows and a cursor made of the sort value plus the id. The next page asks for rows strictly after that pair, so it does not walk the rows it skips. Name and email search uses the FTS5 table; status and sort use the indexes listed in the README. The client aborts the previous fetch and drops a response that is no longer the latest, so a slow filter cannot paint over a newer one.
I considered `OFFSET`, and I considered shipping the table into a virtualised list. Offset still steps through every skipped row. A virtual list only helps after the rows are already in the browser, which the brief rules out.
The cursor belongs to the current sort. Changing sort starts from the first page again.

## A SQLite file, opened with node:sqlite

The database is `data/orders.sqlite`, opened with Node's built-in `node:sqlite`. The indexes and the unique idempotency key are ordinary SQLite, and nothing else has to be installed, so setup stays inside the five minutes the brief allows. The README asks for Node 22.13 or newer because that is where this module exists.
I considered Postgres. It is what I would pick for a shared deployment, and it is the wrong dependency here: a hosted database is forbidden, and the reviewer should not install a server before the list will load.
The limit is one file and one writer. That fits a local console. I would not pretend this file is the design for millions of orders.

## What I used AI for

I used Cursor, with Grok, to scaffold the repo, implement the API and the screen, and draft this file and the README. The three decisions above are the ones I can walk through and change in the interview. Libraries added for the app are Express, Vite, React 18, TypeScript, jsonwebtoken, zod, tsx, and concurrently.

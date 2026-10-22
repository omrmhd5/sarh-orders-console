import jwt from 'jsonwebtoken';
import type { AddressInfo } from 'node:net';
import { createRequestGate } from '../../shared/requestGate.ts';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/db.js';

const db = openDatabase();
const app = createApp(db);
const server = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', () => resolve()));
const { port } = server.address() as AddressInfo;
const base = `http://127.0.0.1:${port}`;

let failed = 0;
function check(name: string, ok: boolean, detail = '') {
  if (ok) {
    console.log(`ok  ${name}`);
    return;
  }
  failed += 1;
  console.error(`FAIL ${name}${detail ? ` — ${detail}` : ''}`);
}

async function login(email: string, password: string) {
  const response = await fetch(`${base}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const cookie = response.headers.get('set-cookie')?.split(';')[0] ?? '';
  return { status: response.status, cookie };
}

const orderBody = {
  customerName: 'Reem Alenezi',
  customerEmail: 'reem.alenezi@example.com',
  items: [
    { name: 'Dates gift box', quantity: 1, unitHalalas: 7600 },
    { name: 'Cardamom tin', quantity: 2, unitHalalas: 2800 },
  ],
  totalHalalas: 13200,
};

const agent = await login('agent@sarh.test', 'SarhAgent-2026');
check('agent login', agent.status === 200 && agent.cookie.startsWith('sarh_session='));

const key = crypto.randomUUID();
const headers = {
  'content-type': 'application/json',
  cookie: agent.cookie,
  'idempotency-key': key,
};
const [first, second] = await Promise.all([
  fetch(`${base}/api/orders`, { method: 'POST', headers, body: JSON.stringify(orderBody) }),
  fetch(`${base}/api/orders`, { method: 'POST', headers, body: JSON.stringify(orderBody) }),
]);
const firstBody = (await first.json()) as { order?: { id: string }; replayed?: boolean };
const secondBody = (await second.json()) as { order?: { id: string }; replayed?: boolean };
const stored = db.prepare('SELECT COUNT(*) AS n FROM orders WHERE idempotency_key = ?').get(key) as { n: number };
check(
  'parallel create inserts one order',
  firstBody.order?.id === secondBody.order?.id && stored.n === 1,
  `statuses ${first.status}/${second.status} ids ${firstBody.order?.id}/${secondBody.order?.id} rows ${stored.n}`,
);

const otherKey = crypto.randomUUID();
const other = await fetch(`${base}/api/orders`, {
  method: 'POST',
  headers: { ...headers, 'idempotency-key': otherKey },
  body: JSON.stringify({
    ...orderBody,
    customerEmail: 'reem.alenezi.second@example.com',
  }),
});
const otherBody = (await other.json()) as { order?: { id: string } };
const otherStored = db.prepare('SELECT COUNT(*) AS n FROM orders WHERE idempotency_key = ?').get(otherKey) as {
  n: number;
};
check(
  'a new key is a new order',
  other.status === 201 && otherBody.order?.id !== firstBody.order?.id && otherStored.n === 1,
);

const forged = jwt.sign({ sub: 'user_admin', role: 'admin' }, 'sarh-secret-2026', { algorithm: 'HS256' });
const forgedMe = await fetch(`${base}/api/me`, {
  headers: { cookie: `sarh_session=${encodeURIComponent(forged)}` },
});
check('forged token is rejected', forgedMe.status === 401);

const queryToken = await fetch(`${base}/api/orders?token=${encodeURIComponent(forged)}`);
check('query token is ignored', queryToken.status === 401);

const agentDelete = await fetch(`${base}/api/orders/${otherBody.order?.id}`, {
  method: 'DELETE',
  headers: { cookie: agent.cookie },
});
check('agent cannot delete', agentDelete.status === 403);

const admin = await login('admin@sarh.test', 'SarhAdmin-2026');
const adminDelete = await fetch(`${base}/api/orders/${otherBody.order?.id}`, {
  method: 'DELETE',
  headers: { cookie: admin.cookie },
});
const gone = db.prepare('SELECT COUNT(*) AS n FROM orders WHERE id = ?').get(otherBody.order?.id) as { n: number };
check('admin delete removes the order', admin.status === 200 && adminDelete.status === 200 && gone.n === 0);

const gate = createRequestGate();
const older = gate.start();
const newer = gate.start();
check('an older filter request is not current', older.isCurrent() === false && newer.isCurrent() === true);

server.close();
db.close();

if (failed > 0) {
  console.error(`${failed} check(s) failed`);
  process.exit(1);
}
console.log('all checks passed');

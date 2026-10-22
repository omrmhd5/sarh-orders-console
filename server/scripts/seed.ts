import fs from 'node:fs';
import { databasePath, openDatabase } from '../src/db.js';
import { hashPassword } from '../src/password.js';

const ORDER_COUNT = 50_000;
const FIRST_NAMES = [
  'Layla', 'Omar', 'Noura', 'Faisal', 'Huda', 'Yousef', 'Maha', 'Sami', 'Reem', 'Tariq',
  'Amal', 'Hassan', 'Dana', 'Khalid', 'Sara', 'Majed', 'Lina', 'Bader', 'Noor', 'Waleed',
];
const FAMILY_NAMES = [
  'Alharbi', 'Alqahtani', 'Alotaibi', 'Aldosari', 'Alshehri',
  'Alghamdi', 'Almutairi', 'Alzahrani', 'Alshammari', 'Alenezi',
];
const CATALOG = [
  { name: 'Cotton thobe', unitHalalas: 18_900 },
  { name: 'Linen ghutra', unitHalalas: 6_500 },
  { name: 'Leather sandals', unitHalalas: 14_000 },
  { name: 'Wool bisht', unitHalalas: 42_000 },
  { name: 'Ceramic dallah', unitHalalas: 22_500 },
  { name: 'Cardamom tin', unitHalalas: 2_800 },
  { name: 'Dates gift box', unitHalalas: 7_600 },
  { name: 'Brass incense burner', unitHalalas: 11_400 },
];
const STATUSES = ['new', 'confirmed', 'fulfilled', 'cancelled'] as const;
const ANCHOR_MS = Date.parse('2026-10-22T09:00:00.000Z');
const SPAN_MS = 120 * 24 * 60 * 60 * 1000;

function statusFor(index: number): (typeof STATUSES)[number] {
  const bucket = index % 20;
  if (bucket === 0) return 'cancelled';
  if (bucket < 5) return 'new';
  if (bucket < 12) return 'confirmed';
  return 'fulfilled';
}

function removeDatabase() {
  for (const suffix of ['', '-wal', '-shm']) {
    fs.rmSync(`${databasePath}${suffix}`, { force: true });
  }
}

removeDatabase();
const db = openDatabase();

const insertUser = db.prepare(
  `INSERT INTO users (id, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?)`,
);
const insertOrder = db.prepare(
  `INSERT INTO orders (
     id, idempotency_key, customer_name, customer_email, status, total_halalas, created_at, created_by
   ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
);
const insertItem = db.prepare(
  `INSERT INTO order_items (id, order_id, name, quantity, unit_halalas) VALUES (?, ?, ?, ?, ?)`,
);

db.exec('BEGIN');
insertUser.run(
  'user_admin',
  'admin@sarh.test',
  'Noura Alqahtani',
  hashPassword('SarhAdmin-2026'),
  'admin',
);
insertUser.run(
  'user_agent',
  'agent@sarh.test',
  'Faisal Alotaibi',
  hashPassword('SarhAgent-2026'),
  'agent',
);

const started = Date.now();
for (let i = 0; i < ORDER_COUNT; i += 1) {
  const first = FIRST_NAMES[i % FIRST_NAMES.length]!;
  const family = FAMILY_NAMES[(i * 3) % FAMILY_NAMES.length]!;
  const orderId = `ord_${String(i + 1).padStart(6, '0')}`;
  const itemCount = (i % 5) + 1;
  let total = 0;
  const items: Array<{ name: string; quantity: number; unitHalalas: number }> = [];
  for (let n = 0; n < itemCount; n += 1) {
    const product = CATALOG[(i + n * 2) % CATALOG.length]!;
    const quantity = (i + n) % 3 + 1;
    total += quantity * product.unitHalalas;
    items.push({ name: product.name, quantity, unitHalalas: product.unitHalalas });
  }
  const createdAt = new Date(ANCHOR_MS - ((i * 97_291) % SPAN_MS)).toISOString();
  insertOrder.run(
    orderId,
    `seed:${orderId}`,
    `${first} ${family}`,
    `${first}.${family}.${i + 1}@example.com`.toLowerCase(),
    statusFor(i),
    total,
    createdAt,
  );
  items.forEach((item, n) => {
    insertItem.run(`${orderId}_${n + 1}`, orderId, item.name, item.quantity, item.unitHalalas);
  });
}
db.exec('COMMIT');

const orders = db.prepare('SELECT COUNT(*) AS n FROM orders').get() as { n: number };
const items = db.prepare('SELECT COUNT(*) AS n FROM order_items').get() as { n: number };
const fts = db.prepare('SELECT COUNT(*) AS n FROM orders_fts').get() as { n: number };
const seconds = ((Date.now() - started) / 1000).toFixed(1);

console.log(
  `Seeded ${orders.n} orders, ${items.n} line items, ${fts.n} search rows in ${seconds}s`,
);
db.close();

import { createApp } from './app.js';
import { assertSecret } from './auth.js';
import { openDatabase } from './db.js';
import { apiPort } from './env.js';

assertSecret();
const db = openDatabase();
const app = createApp(db);
const port = apiPort();

app.listen(port, '127.0.0.1', () => {
  console.log(`API listening on http://127.0.0.1:${port}`);
});

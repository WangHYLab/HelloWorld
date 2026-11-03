const express = require('express');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'hello.db');

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS greetings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    kind TEXT NOT NULL DEFAULT 'click'
  );
`);

const insertGreeting = db.prepare('INSERT INTO greetings (kind) VALUES (?)');
const countGreetings = db.prepare('SELECT COUNT(*) AS total FROM greetings');
const recentGreetings = db.prepare(
  'SELECT id, created_at FROM greetings ORDER BY id DESC LIMIT 7'
);

const app = express();
const streamClients = new Set();

app.disable('x-powered-by');
app.use(express.json({ limit: '8kb' }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

function getStats() {
  return {
    total: countGreetings.get().total,
    recent: recentGreetings.all(),
    online: streamClients.size,
  };
}

function sendEvent(res, event, payload) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

function broadcast(event, payload) {
  for (const client of streamClients) {
    try {
      sendEvent(client, event, payload);
    } catch {
      streamClients.delete(client);
    }
  }
}

function broadcastPresence() {
  broadcast('presence', { online: streamClients.size });
}

app.get('/api/stats', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(getStats());
});

app.post('/api/hello', (req, res) => {
  const kind = req.body?.kind === 'key' ? 'key' : 'click';
  const visitorId =
    typeof req.body?.visitorId === 'string'
      ? req.body.visitorId.slice(0, 64)
      : null;

  const result = insertGreeting.run(kind);
  const payload = {
    ...getStats(),
    lastId: Number(result.lastInsertRowid),
    kind,
    visitorId,
  };

  broadcast('greeting', payload);
  res.status(201).json(payload);
});

app.get('/api/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(': hello world\n\n');

  streamClients.add(res);
  sendEvent(res, 'stats', getStats());
  broadcastPresence();

  const heartbeat = setInterval(() => {
    try {
      res.write(': pulse\n\n');
    } catch {
      clearInterval(heartbeat);
      streamClients.delete(res);
      broadcastPresence();
    }
  }, 20_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    streamClients.delete(res);
    broadcastPresence();
  });
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, ...getStats() });
});

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

const server = app.listen(PORT, () => {
  console.log(`\n  HELLO/WORLD terminal running at http://localhost:${PORT}\n`);
});

function shutdown() {
  for (const client of streamClients) client.end();
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

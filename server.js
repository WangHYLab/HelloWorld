require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const PORT = Number(process.env.PORT) || 3000;

// ─── PostgreSQL connection ────────────────────────────────────────────────────
// Connection order of precedence:
//   1. DATABASE_URL (e.g. for local .env use)
//   2. DB_<ENV_LABEL>_* vars — env_label derived from "Env variable label" in platform
//      Your label: db_nkw7i_269_47 → DB_DB_NKW7I_269_47_HOST, etc.
//   3. DB_<SERVICE_LABEL>_* vars — service label uppercased (fallback)
//      Your service label: Helloworld → DB_HELLOWORLD_HOST, etc.
//   4. Legacy DB_* vars
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || buildConnectionString(),
});

function buildConnectionString() {
  // Try env-label first (most precise), then service label, then legacy
  const envLabel = process.env.DB_ENV_LABEL;
  const labelCandidates = envLabel
    ? [envLabel.toUpperCase(), 'HELLOWORLD']
    : ['HELLOWORLD'];

  for (const label of labelCandidates) {
    const host = getEnv(label, 'HOST');
    const password = getEnv(label, 'PASSWORD');
    if (host && password) {
      const port = getEnv(label, 'PORT') || '5432';
      const dbname = getEnv(label, 'NAME') || 'customer_db';
      const user = getEnv(label, 'USERNAME') || 'customer_db_owner_user';
      return `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/${dbname}`;
    }
  }
  throw new Error('No valid database connection env vars found. Set DATABASE_URL or DB_*_HOST + DB_*_PASSWORD.');
}

function getEnv(label, key) {
  return process.env[`DB_${label}_${key}`] || process.env[`DB_${key}`];
}

// ─── Schema (auto-created on first startup) ───────────────────────────────────
const initSchema = `
  CREATE TABLE IF NOT EXISTS greetings (
    id         SERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    kind       TEXT NOT NULL DEFAULT 'click'
  );
`;

(async () => {
  try {
    await pool.query(initSchema);
    console.log('  PostgreSQL schema ready');
  } catch (err) {
    console.error('Failed to connect to PostgreSQL:', err.message);
    process.exit(1);
  }
})();

// ─── Prepared SQL ─────────────────────────────────────────────────────────────
const countQuery = 'SELECT COUNT(*) AS total FROM greetings';
const recentQuery = 'SELECT id, created_at FROM greetings ORDER BY id DESC LIMIT 7';

// ─── Express app ──────────────────────────────────────────────────────────────
const app = express();
const streamClients = new Set();

app.disable('x-powered-by');
app.use(express.json({ limit: '8kb' }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

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

async function fetchStats() {
  const [totalRow, recentRows] = await Promise.all([
    pool.query(countQuery),
    pool.query(recentQuery),
  ]);
  return {
    total: parseInt(totalRow.rows[0].total, 10),
    recent: recentRows.rows,
    online: streamClients.size,
  };
}

app.get('/api/stats', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const stats = await fetchStats();
    res.json(stats);
  } catch (err) {
    console.error('[api/stats] error:', err.message);
    res.status(500).json({ error: 'Database unavailable' });
  }
});

app.post('/api/hello', async (req, res) => {
  const kind = req.body?.kind === 'key' ? 'key' : 'click';
  const visitorId =
    typeof req.body?.visitorId === 'string'
      ? req.body.visitorId.slice(0, 64)
      : null;

  try {
    const result = await pool.query(
      'INSERT INTO greetings (kind) VALUES ($1) RETURNING id, created_at',
      [kind]
    );
    const newRow = result.rows[0];
    const payload = await fetchStats();
    payload.lastId = newRow.id;
    payload.kind = kind;
    payload.visitorId = visitorId;

    broadcast('greeting', payload);
    res.status(201).json(payload);
  } catch (err) {
    console.error('[api/hello] error:', err.message);
    res.status(500).json({ error: 'Database unavailable' });
  }
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

  fetchStats()
    .then((stats) => {
      sendEvent(res, 'stats', stats);
      broadcastPresence();
    })
    .catch((err) => {
      console.error('[stream] initial stats error:', err.message);
      sendEvent(res, 'stats', { total: 0, recent: [], online: streamClients.size });
      broadcastPresence();
    });

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

app.get('/health', async (req, res) => {
  try {
    res.json(await fetchStats());
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
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
    pool.end();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

import { mkdirSync } from 'node:fs';
import { createClient } from '@libsql/client';

// SQLite everywhere:
// - Local dev: a real SQLite file in ./data.
// - Production: Turso (hosted SQLite / libSQL) via TURSO_DATABASE_URL + TURSO_AUTH_TOKEN.
// - Vercel without Turso configured: a temporary SQLite file in /tmp, so the
//   site still works, but data is lost when the function instance is recycled.
function resolveUrl() {
  if (process.env.TURSO_DATABASE_URL) return process.env.TURSO_DATABASE_URL;
  if (process.env.VERCEL) {
    console.warn('[db] TURSO_DATABASE_URL is not set. Using an ephemeral SQLite file in /tmp.');
    return 'file:/tmp/web-games.db';
  }
  mkdirSync('data', { recursive: true });
  return 'file:data/web-games.db';
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS progress (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game TEXT NOT NULL,
    best_score INTEGER NOT NULL DEFAULT 0,
    highest_level INTEGER NOT NULL DEFAULT 1,
    games_played INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    total_snacks INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, game)
  )`,
  `CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game TEXT NOT NULL,
    score INTEGER NOT NULL,
    level INTEGER NOT NULL,
    snacks INTEGER NOT NULL,
    time_sec REAL NOT NULL,
    outcome TEXT NOT NULL CHECK (outcome IN ('victory', 'gameover')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  'CREATE INDEX IF NOT EXISTS idx_progress_game_best ON progress (game, best_score DESC)',
  'CREATE INDEX IF NOT EXISTS idx_scores_user ON scores (user_id, game)',
  // One row per signed-in device. users.token_hash is the pre-password session
  // token, kept only because the column is NOT NULL UNIQUE.
  `CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_used_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  'CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id)',
  `CREATE TABLE IF NOT EXISTS migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
];

const USER_COLUMNS = {
  password_hash: 'TEXT',
  failed_logins: 'INTEGER NOT NULL DEFAULT 0',
  locked_until: 'TEXT',
};

// Additive, idempotent migrations: safe to run on every cold start against the
// live database, and safe if two instances race each other.
async function migrate(c) {
  await c.batch(SCHEMA, 'write');
  const { rows } = await c.execute('PRAGMA table_info(users)');
  const have = new Set(rows.map((r) => r.name));
  for (const [name, type] of Object.entries(USER_COLUMNS)) {
    if (have.has(name)) continue;
    try {
      await c.execute(`ALTER TABLE users ADD COLUMN ${name} ${type}`);
    } catch (err) {
      if (!/duplicate column/i.test(err.message)) throw err;
    }
  }
  // Pre-password players keep their existing token as their first session.
  await c.batch(
    [
      `INSERT OR IGNORE INTO sessions (user_id, token_hash, created_at, last_used_at)
       SELECT id, token_hash, created_at, created_at FROM users
       WHERE NOT EXISTS (SELECT 1 FROM migrations WHERE name = 'legacy-sessions')`,
      "INSERT OR IGNORE INTO migrations (name) VALUES ('legacy-sessions')",
    ],
    'write',
  );
}

let client;
let ready;

// One client per (warm) function instance; schema and migrations run once.
export function db() {
  if (!client) {
    client = createClient({ url: resolveUrl(), authToken: process.env.TURSO_AUTH_TOKEN });
    ready = migrate(client).catch((err) => {
      client = undefined; // retry on the next request instead of failing forever
      throw err;
    });
  }
  return ready.then(() => client);
}

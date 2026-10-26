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
];

let client;
let ready;

// One client per (warm) function instance; schema is applied once.
export function db() {
  if (!client) {
    client = createClient({ url: resolveUrl(), authToken: process.env.TURSO_AUTH_TOKEN });
    ready = client.batch(SCHEMA, 'write');
  }
  return ready.then(() => client);
}

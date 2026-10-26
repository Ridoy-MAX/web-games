import { createHash, randomBytes } from 'node:crypto';
import { db } from './db.js';

export const GAMES = new Set(['cow-vs-ufo']);
export const USERNAME_RE = /^[A-Za-z][A-Za-z0-9_]{2,15}$/;
const RESERVED = new Set(['admin', 'administrator', 'root', 'system', 'moderator', 'support', 'null', 'undefined', 'anonymous', 'guest']);

export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

// Vercel pre-parses JSON bodies; the local Vite dev server doesn't.
export async function readJson(req) {
  if (req.body !== undefined) {
    if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
    return req.body ?? {};
  }
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 10_000) throw new HttpError(413, 'Request body too large.');
  }
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw new HttpError(400, 'Invalid JSON body.');
  }
}

export function query(req) {
  return new URL(req.url, 'http://localhost').searchParams;
}

export const hashToken = (token) => createHash('sha256').update(token).digest('hex');
export const newToken = () => randomBytes(24).toString('hex');

export function validateUsername(name) {
  if (typeof name !== 'string') return 'Pick a username.';
  const n = name.trim();
  if (!USERNAME_RE.test(n)) return 'Use 3–16 letters, numbers or _, starting with a letter.';
  if (RESERVED.has(n.toLowerCase())) return 'That name is reserved. Try something sillier.';
  return null;
}

export async function requireUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) throw new HttpError(401, 'Sign in with a username first.', 'NO_SESSION');
  const client = await db();
  const { rows } = await client.execute({ sql: 'SELECT id, username, created_at FROM users WHERE token_hash = ?', args: [hashToken(token)] });
  if (!rows.length) throw new HttpError(401, 'Your session expired. Create a username again.', 'BAD_SESSION');
  return rows[0];
}

// Wraps a handler with method checks and consistent JSON errors.
export function handler(methods) {
  return async (req, res) => {
    const fn = methods[req.method];
    if (!fn) {
      res.setHeader('Allow', Object.keys(methods).join(', '));
      return send(res, 405, { error: 'Method not allowed.' });
    }
    try {
      const out = await fn(req, res);
      if (!res.writableEnded) send(res, 200, out ?? {});
    } catch (err) {
      if (err instanceof HttpError) return send(res, err.status, { error: err.message, code: err.code });
      console.error(err);
      send(res, 500, { error: 'Something went wrong on our side. The cows are looking into it.' });
    }
  };
}

export async function progressFor(userId) {
  const client = await db();
  const { rows } = await client.execute({
    sql: `SELECT game, best_score, highest_level, games_played, wins, total_snacks, updated_at,
            (SELECT COUNT(*) + 1 FROM progress p2 WHERE p2.game = p.game AND p2.best_score > p.best_score) AS rank
          FROM progress p WHERE user_id = ?`,
    args: [userId],
  });
  return Object.fromEntries(
    rows.map((r) => [
      r.game,
      {
        bestScore: Number(r.best_score),
        highestLevel: Number(r.highest_level),
        gamesPlayed: Number(r.games_played),
        wins: Number(r.wins),
        totalSnacks: Number(r.total_snacks),
        rank: Number(r.rank),
        updatedAt: r.updated_at,
      },
    ]),
  );
}

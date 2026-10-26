import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { db } from './db.js';

export const GAMES = new Set(['cow-vs-ufo', 'office-brawl']);
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
  // Vercel's req.body getter throws on malformed JSON.
  let body;
  try {
    body = req.body;
    if (typeof body === 'string') body = JSON.parse(body || '{}');
  } catch {
    throw new HttpError(400, 'Invalid JSON body.');
  }
  if (body !== undefined) return body ?? {};
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

// ---------- passwords ----------
// Stored as scrypt$N$r$p$salt$hash (base64). Never log or return these.
const scryptAsync = promisify(scrypt);
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 };
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

export function validatePassword(password, username = '') {
  if (typeof password !== 'string' || !password) return 'Pick a password.';
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters. Cows can count that high.`;
  if (password.length > PASSWORD_MAX) return `Keep it under ${PASSWORD_MAX + 1} characters. This isn't a novel.`;
  if (username && password.toLowerCase() === String(username).trim().toLowerCase()) return "Your password can't be your player name. Nice try.";
  return null;
}

export async function hashPassword(password) {
  const { N, r, p, keylen } = SCRYPT;
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, keylen, { N, r, p });
  return ['scrypt', N, r, p, salt.toString('base64'), hash.toString('base64')].join('$');
}

export async function verifyPassword(password, stored) {
  const [algo, N, r, p, salt, hash] = String(stored || '').split('$');
  if (algo !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = await scryptAsync(password, Buffer.from(salt, 'base64'), expected.length, { N: Number(N), r: Number(r), p: Number(p) });
  return timingSafeEqual(actual, expected);
}

// Burns the same CPU as a real check, so "no such user" isn't faster than "wrong password".
const DUMMY_HASH = hashPassword(randomBytes(12).toString('hex'));
export const fakeVerify = async (password) => verifyPassword(String(password), await DUMMY_HASH).then(() => false);

// ---------- sessions ----------
export async function createSession(client, userId) {
  const token = newToken();
  await client.execute({ sql: 'INSERT INTO sessions (user_id, token_hash) VALUES (?, ?)', args: [userId, hashToken(token)] });
  return token;
}

export async function requireUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) throw new HttpError(401, 'Sign in first.', 'NO_SESSION');
  const client = await db();
  const { rows } = await client.execute({
    sql: `SELECT u.id, u.username, u.created_at, u.password_hash IS NOT NULL AS has_password, s.id AS session_id
          FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`,
    args: [hashToken(token)],
  });
  if (!rows.length) throw new HttpError(401, 'Your session expired. Log in again.', 'BAD_SESSION');
  // At most one write a minute per device; a hot game loop shouldn't hammer the DB.
  await client.execute({
    sql: "UPDATE sessions SET last_used_at = datetime('now') WHERE id = ? AND last_used_at < datetime('now', '-1 minute')",
    args: [rows[0].session_id],
  });
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
      // Handlers may set res.statusCode (e.g. 201) before returning their body.
      if (!res.writableEnded) send(res, res.statusCode || 200, out ?? {});
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

import { db } from '../server/db.js';
import { GAMES, HttpError, handler, progressFor, readJson, requireUser } from '../server/http.js';

const int = (v, max) => {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n < 0 || n > max) throw new HttpError(400, 'Invalid score data.');
  return n;
};

// POST /api/scores { game, score, level, snacks, timeSec, outcome }
// Records a finished run and updates the player's saved progress.
export default handler({
  async POST(req) {
    const user = await requireUser(req);
    const body = await readJson(req);
    if (!GAMES.has(body.game)) throw new HttpError(400, 'Unknown game.');
    if (!['victory', 'gameover'].includes(body.outcome)) throw new HttpError(400, 'Invalid outcome.');
    const score = int(body.score, 10_000_000);
    const level = Math.max(1, int(body.level, 1000));
    const snacks = int(body.snacks, 10_000);
    const timeSec = Math.min(86_400, Math.max(0, Number(body.timeSec) || 0));
    const win = body.outcome === 'victory' ? 1 : 0;
    const unlocked = win ? level + 1 : level;

    const client = await db();
    const before = await progressFor(user.id);
    await client.batch(
      [
        {
          sql: 'INSERT INTO scores (user_id, game, score, level, snacks, time_sec, outcome) VALUES (?, ?, ?, ?, ?, ?, ?)',
          args: [user.id, body.game, score, level, snacks, timeSec, body.outcome],
        },
        {
          sql: `INSERT INTO progress (user_id, game, best_score, highest_level, games_played, wins, total_snacks)
                VALUES (?, ?, ?, ?, 1, ?, ?)
                ON CONFLICT (user_id, game) DO UPDATE SET
                  best_score = MAX(best_score, excluded.best_score),
                  highest_level = MAX(highest_level, excluded.highest_level),
                  games_played = games_played + 1,
                  wins = wins + excluded.wins,
                  total_snacks = total_snacks + excluded.total_snacks,
                  updated_at = datetime('now')`,
          args: [user.id, body.game, score, unlocked, win, snacks],
        },
      ],
      'write',
    );
    const progress = await progressFor(user.id);
    const prevBest = before[body.game]?.bestScore ?? 0;
    return { progress: progress[body.game], newBest: score > prevBest };
  },
});

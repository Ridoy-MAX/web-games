import { db } from '../server/db.js';
import { GAMES, HttpError, handler, query } from '../server/http.js';

// GET /api/leaderboard?game=cow-vs-ufo&limit=10
export default handler({
  async GET(req) {
    const q = query(req);
    const game = q.get('game') ?? 'cow-vs-ufo';
    if (!GAMES.has(game)) throw new HttpError(400, 'Unknown game.');
    const limit = Math.min(50, Math.max(1, Number(q.get('limit')) || 10));
    const client = await db();
    const { rows } = await client.execute({
      sql: `SELECT u.username, p.best_score, p.highest_level, p.games_played
            FROM progress p JOIN users u ON u.id = p.user_id
            WHERE p.game = ? AND p.best_score > 0
            ORDER BY p.best_score DESC, p.updated_at ASC
            LIMIT ?`,
      args: [game, limit],
    });
    const totals = await client.execute('SELECT COUNT(*) AS players FROM users');
    return {
      game,
      players: Number(totals.rows[0].players),
      entries: rows.map((r, i) => ({
        rank: i + 1,
        username: r.username,
        bestScore: Number(r.best_score),
        highestLevel: Number(r.highest_level),
        gamesPlayed: Number(r.games_played),
      })),
    };
  },
});

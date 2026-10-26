import { handler, progressFor, requireUser } from '../server/http.js';

// GET /api/me -> the signed-in player and their saved progress per game.
export default handler({
  async GET(req) {
    const user = await requireUser(req);
    return {
      user: { id: Number(user.id), username: user.username, createdAt: user.created_at, hasPassword: Boolean(Number(user.has_password)) },
      progress: await progressFor(user.id),
    };
  },
});

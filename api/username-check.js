import { db } from '../server/db.js';
import { handler, query, validateUsername } from '../server/http.js';

// GET /api/username-check?username=x -> { available, reason? }
export default handler({
  async GET(req) {
    const username = query(req).get('username') ?? '';
    const problem = validateUsername(username);
    if (problem) return { available: false, reason: problem };
    const client = await db();
    const { rows } = await client.execute({ sql: 'SELECT 1 FROM users WHERE username = ? COLLATE NOCASE', args: [username.trim()] });
    return rows.length ? { available: false, reason: 'Already taken. Someone beat you to the moo.' } : { available: true };
  },
});

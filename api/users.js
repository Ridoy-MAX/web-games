import { db } from '../server/db.js';
import { HttpError, handler, hashToken, newToken, readJson, validateUsername } from '../server/http.js';

// POST /api/users { username } -> creates a player profile and returns its session token.
export default handler({
  async POST(req, res) {
    const { username } = await readJson(req);
    const problem = validateUsername(username);
    if (problem) throw new HttpError(400, problem, 'INVALID_USERNAME');
    const name = username.trim();
    const token = newToken();
    const client = await db();
    try {
      const result = await client.execute({ sql: 'INSERT INTO users (username, token_hash) VALUES (?, ?)', args: [name, hashToken(token)] });
      res.statusCode = 201;
      return { user: { id: Number(result.lastInsertRowid), username: name }, token };
    } catch (err) {
      // UNIQUE COLLATE NOCASE: "MooMaster" and "moomaster" are the same name.
      if (String(err.code || err.message).includes('CONSTRAINT') || /UNIQUE/i.test(err.message)) {
        throw new HttpError(409, `"${name}" is already taken. Be more original, cow.`, 'USERNAME_TAKEN');
      }
      throw err;
    }
  },
});

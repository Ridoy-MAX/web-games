import { db } from '../server/db.js';
import { HttpError, handler, hashPassword, hashToken, newToken, readJson, validatePassword, validateUsername } from '../server/http.js';

// POST /api/users { username, password } -> creates a player and signs this device in.
export default handler({
  async POST(req, res) {
    const { username, password } = await readJson(req);
    const problem = validateUsername(username);
    if (problem) throw new HttpError(400, problem, 'INVALID_USERNAME');
    const weak = validatePassword(password, username);
    if (weak) throw new HttpError(400, weak, 'INVALID_PASSWORD');
    const name = username.trim();
    const token = newToken();
    const client = await db();
    try {
      // users.token_hash is NOT NULL UNIQUE from the pre-password days; fill it
      // with a random value that no token will ever hash to.
      const [created] = await client.batch(
        [
          { sql: 'INSERT INTO users (username, token_hash, password_hash) VALUES (?, ?, ?)', args: [name, `unused:${newToken()}`, await hashPassword(password)] },
          { sql: 'INSERT INTO sessions (user_id, token_hash) VALUES (last_insert_rowid(), ?)', args: [hashToken(token)] },
        ],
        'write',
      );
      res.statusCode = 201;
      return { user: { id: Number(created.lastInsertRowid), username: name }, token };
    } catch (err) {
      // UNIQUE COLLATE NOCASE: "MooMaster" and "moomaster" are the same name.
      if (String(err.code || err.message).includes('CONSTRAINT') || /UNIQUE/i.test(err.message)) {
        throw new HttpError(409, `"${name}" is already taken. Be more original, cow.`, 'USERNAME_TAKEN');
      }
      throw err;
    }
  },
});

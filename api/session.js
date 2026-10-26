import { db } from '../server/db.js';
import { HttpError, createSession, fakeVerify, handler, readJson, requireUser, verifyPassword } from '../server/http.js';

const MAX_FAILURES = 5;
const WRONG = () => new HttpError(401, 'Wrong username or password.', 'BAD_LOGIN');
const LOCKED = () => new HttpError(429, 'Too many wrong guesses. This player is locked for 5 minutes. Go get a coffee.', 'LOCKED');

// POST /api/session { username, password } -> logs this device in with a new token.
// DELETE /api/session -> logs out this device only; other devices stay signed in.
export default handler({
  async POST(req) {
    const { username, password } = await readJson(req);
    if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) throw WRONG();
    const client = await db();
    const { rows } = await client.execute({
      sql: `SELECT id, username, password_hash, locked_until > datetime('now') AS locked
            FROM users WHERE username = ? COLLATE NOCASE`,
      args: [username.trim()],
    });
    const user = rows[0];
    if (!user || !user.password_hash) {
      await fakeVerify(password);
      throw WRONG();
    }
    if (Number(user.locked)) throw LOCKED();
    if (!(await verifyPassword(password, user.password_hash))) {
      // SET expressions read the old row, so the counter resets as the lock starts.
      const { rows: after } = await client.execute({
        sql: `UPDATE users SET
                failed_logins = CASE WHEN failed_logins + 1 >= ? THEN 0 ELSE failed_logins + 1 END,
                locked_until = CASE WHEN failed_logins + 1 >= ? THEN datetime('now', '+5 minutes') ELSE locked_until END
              WHERE id = ? RETURNING locked_until > datetime('now') AS locked`,
        args: [MAX_FAILURES, MAX_FAILURES, user.id],
      });
      throw Number(after[0]?.locked) ? LOCKED() : WRONG();
    }
    await client.execute({ sql: 'UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?', args: [user.id] });
    const token = await createSession(client, user.id);
    return { user: { id: Number(user.id), username: user.username }, token };
  },

  async DELETE(req) {
    const user = await requireUser(req);
    const client = await db();
    await client.execute({ sql: 'DELETE FROM sessions WHERE id = ?', args: [user.session_id] });
    return { ok: true };
  },
});

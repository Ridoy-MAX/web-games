import { db } from '../server/db.js';
import { HttpError, handler, hashPassword, readJson, requireUser, validatePassword, verifyPassword } from '../server/http.js';

// POST /api/password { currentPassword?, newPassword }
// Players from the pre-password days set their first one; everyone else proves
// they know the current one. Changing it signs out every other device.
export default handler({
  async POST(req) {
    const user = await requireUser(req);
    const { currentPassword, newPassword } = await readJson(req);
    const weak = validatePassword(newPassword, user.username);
    if (weak) throw new HttpError(400, weak, 'INVALID_PASSWORD');
    const client = await db();
    const hadPassword = Boolean(Number(user.has_password));
    if (hadPassword) {
      const { rows } = await client.execute({ sql: 'SELECT password_hash FROM users WHERE id = ?', args: [user.id] });
      if (typeof currentPassword !== 'string' || !(await verifyPassword(currentPassword, rows[0].password_hash))) {
        throw new HttpError(403, "That's not your current password.", 'BAD_PASSWORD');
      }
    }
    const statements = [{ sql: 'UPDATE users SET password_hash = ?, failed_logins = 0, locked_until = NULL WHERE id = ?', args: [await hashPassword(newPassword), user.id] }];
    if (hadPassword) statements.push({ sql: 'DELETE FROM sessions WHERE user_id = ? AND id != ?', args: [user.id, user.session_id] });
    const results = await client.batch(statements, 'write');
    return { hasPassword: true, signedOutDevices: hadPassword ? results[1].rowsAffected : 0 };
  },
});

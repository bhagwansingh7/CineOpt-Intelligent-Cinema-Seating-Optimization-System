const pool = require('../config/db');
const ApiError = require('../utils/ApiError');

async function listUsers() {
  const [rows] = await pool.query(
    `SELECT u.id, u.name, u.email, u.role, u.created_at, COUNT(b.id) AS booking_count
     FROM users u LEFT JOIN bookings b ON b.user_id = u.id GROUP BY u.id ORDER BY u.id`,
  );
  return rows.map((r) => ({ ...r, booking_count: Number(r.booking_count) }));
}

async function changeRole(actingAdmin, userId, role) {
  if (actingAdmin.id === userId) throw new ApiError(400, 'You cannot change your own role');
  const [result] = await pool.query('UPDATE users SET role = ? WHERE id = ?', [role, userId]);
  if (!result.affectedRows) throw new ApiError(404, 'User not found');
  const [rows] = await pool.query('SELECT id, name, email, role, created_at FROM users WHERE id = ?', [userId]);
  return rows[0];
}

module.exports = { listUsers, changeRole };

const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const config = require('../config/env');
const ApiError = require('../utils/ApiError');

function extractToken(req) {
  if (req.cookies && req.cookies.token) return req.cookies.token;
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

async function authenticate(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) throw new ApiError(401, 'Authentication required');
    let payload;
    try {
      payload = jwt.verify(token, config.jwt.secret);
    } catch (err) {
      throw new ApiError(401, 'Your session is invalid or has expired. Please log in again.');
    }
    // Always re-read the user so role changes and deleted accounts take effect immediately.
    const [rows] = await pool.query('SELECT id, name, email, role, created_at FROM users WHERE id = ?', [payload.sub]);
    if (!rows.length) throw new ApiError(401, 'This account no longer exists');
    req.user = rows[0];
    next();
  } catch (err) {
    next(err);
  }
}

function requireAdmin(req, res, next) {
  if (!req.user) return next(new ApiError(401, 'Authentication required'));
  if (req.user.role !== 'admin') return next(new ApiError(403, 'Administrator access required'));
  return next();
}

module.exports = { authenticate, requireAdmin };

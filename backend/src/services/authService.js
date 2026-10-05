const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const config = require('../config/env');
const ApiError = require('../utils/ApiError');

const SALT_ROUNDS = 10;
// Compared against when the e-mail is unknown, so response time does not reveal which e-mails exist.
const DUMMY_HASH = bcrypt.hashSync('cineopt-dummy-password', SALT_ROUNDS);

const publicUser = (row) => ({
  id: row.id, name: row.name, email: row.email, role: row.role, created_at: row.created_at,
});

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
}

async function register({ name, email, password }) {
  const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.length) throw new ApiError(409, 'An account with this email already exists');
  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  let result;
  try {
    [result] = await pool.query('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)', [name, email, hash, 'user']);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw new ApiError(409, 'An account with this email already exists');
    throw err;
  }
  const [rows] = await pool.query('SELECT id, name, email, role, created_at FROM users WHERE id = ?', [result.insertId]);
  const user = publicUser(rows[0]);
  return { user, token: signToken(user) };
}

async function login({ email, password }) {
  const [rows] = await pool.query('SELECT id, name, email, role, password, created_at FROM users WHERE email = ?', [email]);
  const row = rows[0];
  const valid = await bcrypt.compare(password, row ? row.password : DUMMY_HASH);
  if (!row || !valid) throw new ApiError(401, 'Invalid email or password');
  const user = publicUser(row);
  return { user, token: signToken(user) };
}

module.exports = { register, login, publicUser, signToken };

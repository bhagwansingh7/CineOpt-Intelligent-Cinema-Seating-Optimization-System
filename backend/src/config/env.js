const crypto = require('crypto');
require('dotenv').config();

const env = process.env.NODE_ENV || 'development';
let jwtSecret = (process.env.JWT_SECRET || '').trim();

if (!jwtSecret) {
  if (env === 'production') {
    throw new Error('JWT_SECRET must be set when NODE_ENV=production');
  }
  // Development/test: ephemeral secret, so no secret ever lives in the source code.
  jwtSecret = crypto.randomBytes(48).toString('hex');
  if (env !== 'test') {
    console.warn('[config] JWT_SECRET is not set - using a random one; logins reset on every restart.');
  }
} else if (env === 'production' && jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters in production');
}

const config = {
  env,
  port: Number(process.env.PORT) || 5000,
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'cineopt',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'cineopt',
  },
  jwt: { secret: jwtSecret, expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
  algorithmEngineUrl: (process.env.ALGORITHM_ENGINE_URL || 'http://localhost:8000').replace(/\/+$/, ''),
  algorithmTimeoutMs: Number(process.env.ALGORITHM_TIMEOUT_MS) || 15000,
  frontendUrls: (process.env.FRONTEND_URL || 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean),
  cookieSecure: process.env.COOKIE_SECURE === 'true',
};

module.exports = config;

jest.mock('../src/config/db', () => ({ query: jest.fn(), getConnection: jest.fn() }));

const request = require('supertest');
const bcrypt = require('bcrypt');
const app = require('../src/app');
const pool = require('../src/config/db');
const { users, mockDb, cookieFor } = require('./helpers');

beforeEach(() => pool.query.mockReset());

describe('POST /api/auth/register', () => {
  test('creates a user, hashes the password, sets an HttpOnly cookie and never returns the password', async () => {
    let storedHash;
    mockDb([
      ['SELECT id FROM users WHERE email = ?', (sql, p) => { expect(p[0]).toBe('new@example.com'); return [[]]; }],
      ['INSERT INTO users', (sql, p) => { storedHash = p[2]; return [{ insertId: 9 }]; }],
      ['SELECT id, name, email, role, created_at FROM users WHERE id = ?',
        () => [[{ id: 9, name: 'New User', email: 'new@example.com', role: 'user', created_at: new Date() }]]],
    ]);
    const res = await request(app).post('/api/auth/register').send({ name: 'New User', email: 'New@Example.com', password: 'Secret123' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toMatchObject({ id: 9, email: 'new@example.com', role: 'user' });
    expect(res.body.data.user.password).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain(storedHash);
    expect(storedHash).toMatch(/^\$2[aby]\$/);
    expect(await bcrypt.compare('Secret123', storedHash)).toBe(true);
    const cookie = res.headers['set-cookie'][0];
    expect(cookie).toMatch(/^token=/);
    expect(cookie).toMatch(/HttpOnly/i);
  });

  test('rejects weak passwords, bad emails and attempts to self-assign a role', async () => {
    const weak = await request(app).post('/api/auth/register').send({ name: 'Al', email: 'a@b.co', password: 'short' });
    expect(weak.status).toBe(400);
    expect(weak.body).toMatchObject({ success: false });
    const noDigits = await request(app).post('/api/auth/register').send({ name: 'Alice', email: 'a@b.co', password: 'onlyletters' });
    expect(noDigits.status).toBe(400);
    const badEmail = await request(app).post('/api/auth/register').send({ name: 'Alice', email: 'nope', password: 'Secret123' });
    expect(badEmail.status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('role in the body is ignored - new accounts are always plain users', async () => {
    let insertedRole;
    mockDb([
      ['SELECT id FROM users WHERE email = ?', () => [[]]],
      ['INSERT INTO users', (sql, p) => { insertedRole = p[3]; return [{ insertId: 10 }]; }],
      ['SELECT id, name, email, role, created_at FROM users WHERE id = ?',
        () => [[{ id: 10, name: 'Mallory', email: 'm@example.com', role: 'user', created_at: new Date() }]]],
    ]);
    await request(app).post('/api/auth/register').send({ name: 'Mallory', email: 'm@example.com', password: 'Secret123', role: 'admin' });
    expect(insertedRole).toBe('user');
  });

  test('duplicate email returns 409', async () => {
    mockDb([['SELECT id FROM users WHERE email = ?', () => [[{ id: 2 }]]]]);
    const res = await request(app).post('/api/auth/register').send({ name: 'Alice', email: 'alice@example.com', password: 'Secret123' });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already exists/);
  });
});

describe('POST /api/auth/login', () => {
  const hash = bcrypt.hashSync('Secret123', 4);
  const row = { ...users.alice, password: hash };

  test('logs in with correct credentials', async () => {
    mockDb([['FROM users WHERE email = ?', () => [[row]]]]);
    const res = await request(app).post('/api/auth/login').send({ email: 'alice@example.com', password: 'Secret123' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('alice@example.com');
    expect(res.body.data.user.password).toBeUndefined();
    expect(res.headers['set-cookie'][0]).toMatch(/HttpOnly/i);
  });

  test('wrong password and unknown email give the same generic 401', async () => {
    mockDb([['FROM users WHERE email = ?', (sql, p) => [p[0] === 'alice@example.com' ? [row] : []]]]);
    const wrong = await request(app).post('/api/auth/login').send({ email: 'alice@example.com', password: 'WrongPass1' });
    const unknown = await request(app).post('/api/auth/login').send({ email: 'ghost@example.com', password: 'Secret123' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.message).toBe(unknown.body.message);
  });

  test('requires email and password', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.co' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/auth/me and logout', () => {
  test('401 without a session cookie', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: 'Authentication required' });
  });

  test('401 with a tampered token', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', 'token=not.a.jwt');
    expect(res.status).toBe(401);
  });

  test('returns the current user without password', async () => {
    mockDb([]);
    const res = await request(app).get('/api/auth/me').set('Cookie', cookieFor(users.alice));
    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ id: 2, role: 'user' });
    expect(res.body.data.user.password).toBeUndefined();
  });

  test('401 when the account was deleted after the token was issued', async () => {
    mockDb([]);
    const res = await request(app).get('/api/auth/me').set('Cookie', cookieFor({ id: 999, role: 'user' }));
    expect(res.status).toBe(401);
  });

  test('logout clears the cookie', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie'][0]).toMatch(/^token=;/);
  });
});

describe('API basics', () => {
  test('unknown routes and invalid JSON use the common error shape', async () => {
    const missing = await request(app).get('/api/nope');
    expect(missing.status).toBe(404);
    expect(missing.body.success).toBe(false);
    const invalid = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{bad json');
    expect(invalid.status).toBe(400);
    expect(invalid.body).toMatchObject({ success: false, message: expect.stringMatching(/invalid JSON/) });
  });
});

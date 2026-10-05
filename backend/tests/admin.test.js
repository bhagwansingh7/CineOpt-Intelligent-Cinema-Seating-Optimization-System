jest.mock('../src/config/db', () => ({ query: jest.fn(), getConnection: jest.fn() }));

const request = require('supertest');
const app = require('../src/app');
const pool = require('../src/config/db');
const { users, mockDb, cookieFor } = require('./helpers');

const adminCookie = cookieFor(users.admin);
const userCookie = cookieFor(users.alice);

beforeEach(() => pool.query.mockReset());

describe('admin authorisation is enforced by the backend', () => {
  test('anonymous -> 401, normal user -> 403 on every admin route', async () => {
    mockDb([]);
    const routes = [['get', '/api/admin/users'], ['get', '/api/admin/bookings'], ['get', '/api/admin/theatres'],
      ['get', '/api/admin/theatres/1/seats'], ['patch', '/api/admin/users/3/role']];
    for (const [method, url] of routes) {
      expect((await request(app)[method](url)).status).toBe(401);
      const forbidden = await request(app)[method](url).set('Cookie', userCookie).send({ role: 'admin' });
      expect(forbidden.status).toBe(403);
      expect(forbidden.body.success).toBe(false);
    }
  });

  test('a user cannot promote themselves', async () => {
    mockDb([]);
    const res = await request(app).patch('/api/admin/users/2/role').set('Cookie', userCookie).send({ role: 'admin' });
    expect(res.status).toBe(403);
    expect(pool.query.mock.calls.some(([sql]) => sql.includes('UPDATE users'))).toBe(false);
  });
});

describe('admin features', () => {
  test('lists users without passwords', async () => {
    mockDb([['FROM users u LEFT JOIN bookings', () => [[{ ...users.alice, booking_count: '2' }]]]]);
    const res = await request(app).get('/api/admin/users').set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.data.users[0]).toMatchObject({ id: 2, booking_count: 2 });
    expect(res.body.data.users[0].password).toBeUndefined();
  });

  test('changes a user role', async () => {
    mockDb([
      ['UPDATE users SET role', (sql, p) => { expect(p).toEqual(['admin', 3]); return [{ affectedRows: 1 }]; }],
      ['SELECT id, name, email, role, created_at FROM users WHERE id = ?', (sql, p) => [[{ ...users.bob, role: 'admin' }]]],
    ]);
    const res = await request(app).patch('/api/admin/users/3/role').set('Cookie', adminCookie).send({ role: 'admin' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('admin');
  });

  test('rejects invalid roles, own-role changes and unknown users', async () => {
    mockDb([['UPDATE users SET role', () => [{ affectedRows: 0 }]]]);
    expect((await request(app).patch('/api/admin/users/3/role').set('Cookie', adminCookie).send({ role: 'root' })).status).toBe(400);
    expect((await request(app).patch('/api/admin/users/1/role').set('Cookie', adminCookie).send({ role: 'user' })).status).toBe(400);
    expect((await request(app).patch('/api/admin/users/99/role').set('Cookie', adminCookie).send({ role: 'admin' })).status).toBe(404);
  });
});

jest.mock('../src/config/db', () => ({ query: jest.fn(), getConnection: jest.fn() }));
jest.mock('axios');

const request = require('supertest');
const axios = require('axios');
const app = require('../src/app');
const pool = require('../src/config/db');
const { users, mockDb, makeConn, cookieFor, theatreRow, seatRows, engineResult } = require('./helpers');

const alice = cookieFor(users.alice);
const validOptimize = {
  theatre_id: 1, people_count: 2, max_budget: 500, preferred_region: 'center', togetherness_weight: 0.9, preference_weight: 0.8,
};

function optimizeDb(seats = seatRows()) {
  mockDb([
    ['FROM theatres t', () => [[theatreRow]]],
    ['FROM seats WHERE theatre_id = ?', () => [seats]],
    ['INSERT INTO booking_requests', () => [{ insertId: 1 }]],
  ]);
}

beforeEach(() => {
  pool.query.mockReset();
  pool.getConnection.mockReset();
  axios.post.mockReset();
});

describe('authentication on booking routes', () => {
  test('every booking route requires login', async () => {
    expect((await request(app).post('/api/bookings/optimize').send(validOptimize)).status).toBe(401);
    expect((await request(app).post('/api/bookings').send({})).status).toBe(401);
    expect((await request(app).get('/api/bookings')).status).toBe(401);
    expect((await request(app).get('/api/bookings/1')).status).toBe(401);
  });
});

describe('POST /api/bookings/optimize', () => {
  test('rejects invalid requests before touching the engine (budget, people, region, weights)', async () => {
    mockDb([]);
    const cases = [
      { max_budget: -5 }, { max_budget: 0 }, { max_budget: 'lots' }, { people_count: 0 }, { people_count: 21 },
      { people_count: 2.5 }, { preferred_region: 'balcony' }, { togetherness_weight: 1.5 }, { preference_weight: -1 },
      { theatre_id: 'x' },
    ];
    for (const override of cases) {
      const res = await request(app).post('/api/bookings/optimize').set('Cookie', alice).send({ ...validOptimize, ...override });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    }
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('sends only available seats to the engine and returns a server-priced recommendation', async () => {
    optimizeDb(seatRows({ 3: { status: 'booked' } }).filter((s) => s.status === 'available'));
    axios.post.mockResolvedValue({ status: 200, data: engineResult([1, 2], { total_cost: 99999 }) });
    const res = await request(app).post('/api/bookings/optimize').set('Cookie', alice).send(validOptimize);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const sent = axios.post.mock.calls[0][1];
    expect(sent).toMatchObject({ theatre_rows: 2, theatre_columns: 3, people_count: 2, max_budget: 500, preferred_region: 'center' });
    expect(sent.seats.map((s) => s.id)).toEqual([1, 2, 4, 5, 6]);
    expect(sent.seats.every((s) => s.status === 'available')).toBe(true);
    const { result } = res.body.data;
    expect(result.total_cost).toBe(200);                 // 100 + 100 from the database, not the engine's 99999
    expect(result.budget_remaining).toBe(300);
    expect(result.recommended_seats.map((s) => s.label)).toEqual(['A1', 'A2']);
    expect(result.alternatives.genetic.fitness).toBe(90.5);
  });

  test('409 when fewer seats are available than requested', async () => {
    optimizeDb(seatRows().slice(0, 1));
    const res = await request(app).post('/api/bookings/optimize').set('Cookie', alice).send(validOptimize);
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/Only 1 seat/);
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('409 when the theatre is sold out', async () => {
    optimizeDb([]);
    const res = await request(app).post('/api/bookings/optimize').set('Cookie', alice).send(validOptimize);
    expect(res.status).toBe(409);
  });

  test('budget too low is reported with the engine message', async () => {
    optimizeDb();
    axios.post.mockResolvedValue({ status: 422, data: { detail: 'Budget too low: the cheapest 2 available seat(s) cost 200, but the budget is 50' } });
    const res = await request(app).post('/api/bookings/optimize').set('Cookie', alice).send({ ...validOptimize, max_budget: 50 });
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/Budget too low/);
  });

  test('engine answers that break the rules are rejected (over budget / wrong count / unknown seat)', async () => {
    optimizeDb();
    axios.post.mockResolvedValue({ status: 200, data: engineResult([4, 5]) });          // costs 400
    const over = await request(app).post('/api/bookings/optimize').set('Cookie', alice).send({ ...validOptimize, max_budget: 300 });
    expect(over.status).toBe(502);
    expect(over.body.message).toMatch(/exceeds the budget/);
    axios.post.mockResolvedValue({ status: 200, data: engineResult([1]) });
    expect((await request(app).post('/api/bookings/optimize').set('Cookie', alice).send(validOptimize)).status).toBe(502);
    axios.post.mockResolvedValue({ status: 200, data: engineResult([1, 999]) });
    expect((await request(app).post('/api/bookings/optimize').set('Cookie', alice).send(validOptimize)).status).toBe(502);
  });

  test('503 when the algorithm engine is down', async () => {
    optimizeDb();
    axios.post.mockRejectedValue({ code: 'ECONNREFUSED' });
    const res = await request(app).post('/api/bookings/optimize').set('Cookie', alice).send(validOptimize);
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ success: false, message: expect.stringMatching(/unavailable/) });
  });
});

describe('POST /api/bookings', () => {
  const body = { theatre_id: 1, seat_ids: [2, 1], algorithm_used: 'genetic', fitness_score: 91.2 };
  const bookingRow = { id: 77, user_id: 2, theatre_id: 1, total_price: '250.50', algorithm_used: 'genetic', fitness_score: '91.20', created_at: new Date(), theatre_name: 'Hall' };

  function bookingDb() {
    mockDb([
      ['FROM bookings b JOIN theatres t', () => [[bookingRow]]],
      ['FROM booking_seats bs', () => [[
        { booking_id: 77, id: 1, seat_label: 'A1', row_number: 1, seat_number: 1, price: '100.00', seat_type: 'standard' },
        { booking_id: 77, id: 2, seat_label: 'A2', row_number: 1, seat_number: 2, price: '150.50', seat_type: 'standard' },
      ]]],
    ]);
  }

  function lockedSeats(overrides = {}) {
    return [
      { id: 1, theatre_id: 1, seat_label: 'A1', price: '100.00', status: 'available', ...(overrides[1] || {}) },
      { id: 2, theatre_id: 1, seat_label: 'A2', price: '150.50', status: 'available', ...(overrides[2] || {}) },
    ];
  }

  function connFor(seats, extra = []) {
    return makeConn([
      ['SELECT id FROM theatres WHERE id = ?', () => [[{ id: 1 }]]],
      ['FOR UPDATE', () => [seats]],
      ['INSERT INTO bookings', () => [{ insertId: 77 }]],
      ['INSERT INTO booking_seats', () => [{ affectedRows: 2 }]],
      ['UPDATE seats SET status', () => [{ affectedRows: 2 }]],
      ...extra,
    ]);
  }

  test('creates the booking in a transaction and prices it on the server', async () => {
    bookingDb();
    const conn = connFor(lockedSeats());
    const res = await request(app).post('/api/bookings').set('Cookie', alice).send({ ...body, total_price: 1 });
    expect(res.status).toBe(201);
    expect(res.body.data.booking).toMatchObject({ id: 77, total_price: 250.5, algorithm_used: 'genetic' });
    expect(res.body.data.booking.seats.map((s) => s.seat_label)).toEqual(['A1', 'A2']);
    const insert = conn.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO bookings'));
    expect(insert[1]).toEqual([2, 1, 250.5, 'genetic', 91.2]);        // total from DB prices, the client's 1 is ignored
    const lock = conn.query.mock.calls.find(([sql]) => sql.includes('FOR UPDATE'));
    expect(lock[1]).toEqual([[1, 2]]);
    expect(conn.beginTransaction).toHaveBeenCalledTimes(1);
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(conn.rollback).not.toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalledTimes(1);
  });

  test('refuses seats that were booked in the meantime (409) and rolls back', async () => {
    const conn = connFor(lockedSeats({ 2: { status: 'booked' } }));
    const res = await request(app).post('/api/bookings').set('Cookie', alice).send(body);
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/no longer available/);
    expect(conn.rollback).toHaveBeenCalled();
    expect(conn.commit).not.toHaveBeenCalled();
    expect(conn.query.mock.calls.some(([sql]) => sql.includes('INSERT INTO bookings'))).toBe(false);
    expect(conn.release).toHaveBeenCalled();
  });

  test('the database unique key is the last line of defence against double booking', async () => {
    const conn = connFor(lockedSeats(), [['INSERT INTO booking_seats', () => { const e = new Error('dup'); e.code = 'ER_DUP_ENTRY'; throw e; }]]);
    const res = await request(app).post('/api/bookings').set('Cookie', alice).send(body);
    expect(res.status).toBe(409);
    expect(conn.rollback).toHaveBeenCalled();
  });

  test('404 when a seat does not exist, 400 when it belongs to another theatre', async () => {
    connFor(lockedSeats().slice(0, 1));
    expect((await request(app).post('/api/bookings').set('Cookie', alice).send(body)).status).toBe(404);
    connFor(lockedSeats({ 1: { theatre_id: 2 } }));
    expect((await request(app).post('/api/bookings').set('Cookie', alice).send(body)).status).toBe(400);
  });

  test('enforces the budget on the server-calculated total', async () => {
    const conn = connFor(lockedSeats());
    const res = await request(app).post('/api/bookings').set('Cookie', alice).send({ ...body, max_budget: 200 });
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/exceeds the maximum budget/);
    expect(conn.rollback).toHaveBeenCalled();
  });

  test('validates the payload', async () => {
    mockDb([]);
    const bad = [
      { seat_ids: [] }, { seat_ids: [1, 1] }, { seat_ids: ['a'] }, { seat_ids: 'nope' },
      { algorithm_used: 'magic' }, { fitness_score: 500 }, { theatre_id: 0 },
    ];
    for (const override of bad) {
      const res = await request(app).post('/api/bookings').set('Cookie', alice).send({ ...body, ...override });
      expect(res.status).toBe(400);
    }
    expect(pool.getConnection).not.toHaveBeenCalled();
  });
});

describe('GET /api/bookings', () => {
  const row = (id, userId) => ({ id, user_id: userId, theatre_id: 1, total_price: '300.00', algorithm_used: 'manual', fitness_score: null, created_at: new Date(), theatre_name: 'Hall' });

  test('lists only the caller\'s bookings with their seats', async () => {
    mockDb([
      ['WHERE b.user_id = ?', (sql, p) => { expect(p).toEqual([2]); return [[row(5, 2)]]; }],
      ['FROM booking_seats bs', () => [[{ booking_id: 5, id: 1, seat_label: 'A1', row_number: 1, seat_number: 1, price: '100.00', seat_type: 'standard' }]]],
    ]);
    const res = await request(app).get('/api/bookings').set('Cookie', alice);
    expect(res.status).toBe(200);
    expect(res.body.data.bookings).toHaveLength(1);
    expect(res.body.data.bookings[0].seats[0].seat_label).toBe('A1');
  });

  test('another user\'s booking looks like it does not exist', async () => {
    mockDb([['WHERE b.id = ?', () => [[row(8, 3)]]], ['FROM booking_seats bs', () => [[]]]]);
    expect((await request(app).get('/api/bookings/8').set('Cookie', alice)).status).toBe(404);
    expect((await request(app).get('/api/bookings/8').set('Cookie', cookieFor(users.bob))).status).toBe(200);
  });
});

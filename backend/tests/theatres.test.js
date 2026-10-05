jest.mock('../src/config/db', () => ({ query: jest.fn(), getConnection: jest.fn() }));

const request = require('supertest');
const app = require('../src/app');
const pool = require('../src/config/db');
const { mockDb, theatreRow, seatRows } = require('./helpers');

beforeEach(() => pool.query.mockReset());

describe('theatre APIs', () => {
  test('GET /api/theatres lists theatres with numeric stats', async () => {
    mockDb([['FROM theatres t', () => [[theatreRow]]]]);
    const res = await request(app).get('/api/theatres');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.theatres[0]).toMatchObject({ id: 1, rows: 2, columns: 3, total_seats: 6, available_seats: 6, min_price: 100, max_price: 200 });
  });

  test('GET /api/theatres/:id returns one theatre, 404 when missing, 400 for a bad id', async () => {
    mockDb([['FROM theatres t', (sql, p) => [p[0] === 1 ? [theatreRow] : []]]]);
    expect((await request(app).get('/api/theatres/1')).body.data.theatre.name).toBe('CineOpt Grand Hall');
    expect((await request(app).get('/api/theatres/42')).status).toBe(404);
    expect((await request(app).get('/api/theatres/abc')).status).toBe(400);
  });

  test('GET /api/theatres/:id/seats returns coordinates, prices and a summary', async () => {
    mockDb([
      ['FROM theatres t', () => [[theatreRow]]],
      ['FROM seats WHERE theatre_id = ?', () => [seatRows({ 2: { status: 'booked' } })]],
    ]);
    const res = await request(app).get('/api/theatres/1/seats');
    expect(res.status).toBe(200);
    const { seats, summary } = res.body.data;
    expect(seats).toHaveLength(6);
    expect(seats[0]).toEqual({
      id: 1, theatre_id: 1, row_number: 1, seat_number: 1, seat_label: 'A1', x_coordinate: 1, y_coordinate: 1,
      price: 100, seat_type: 'standard', status: 'available',
    });
    expect(summary).toEqual({ total: 6, available: 5, booked: 1 });
  });

  test('seat queries are parameterised', async () => {
    mockDb([
      ['FROM theatres t', () => [[theatreRow]]],
      ['FROM seats WHERE theatre_id = ?', () => [[]]],
    ]);
    await request(app).get('/api/theatres/1/seats');
    const seatCall = pool.query.mock.calls.find(([sql]) => sql.includes('FROM seats'));
    expect(seatCall[1]).toEqual([1]);
    expect(seatCall[0]).not.toMatch(/\b1\b\s*ORDER/);
  });
});

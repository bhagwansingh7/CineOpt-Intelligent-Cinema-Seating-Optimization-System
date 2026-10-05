const jwt = require('jsonwebtoken');
const pool = require('../src/config/db');

const users = {
  admin: { id: 1, name: 'Admin User', email: 'admin@cineopt.com', role: 'admin', created_at: new Date('2026-01-01') },
  alice: { id: 2, name: 'Alice Rao', email: 'alice@example.com', role: 'user', created_at: new Date('2026-01-02') },
  bob: { id: 3, name: 'Bob Sen', email: 'bob@example.com', role: 'user', created_at: new Date('2026-01-03') },
};

/** handlers: [[sqlFragment, (sql, params) => result]] - first fragment contained in the SQL wins. */
function matcher(handlers) {
  return async (sql, params) => {
    for (const [needle, fn] of handlers) {
      if (sql.includes(needle)) return fn(sql, params);
    }
    throw new Error(`Unmocked SQL: ${sql.replace(/\s+/g, ' ').slice(0, 140)}`);
  };
}

const authHandler = ['FROM users WHERE id = ?', (sql, params) => [Object.values(users).filter((u) => u.id === params[0])]];

function mockDb(handlers) {
  pool.query.mockImplementation(matcher([authHandler, ...handlers]));
}

function makeConn(handlers) {
  const conn = {
    beginTransaction: jest.fn().mockResolvedValue(undefined),
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined),
    release: jest.fn(),
    query: jest.fn(matcher(handlers)),
  };
  pool.getConnection.mockResolvedValue(conn);
  return conn;
}

const cookieFor = (user) =>
  `token=${jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' })}`;

const theatreRow = {
  id: 1, name: 'CineOpt Grand Hall', rows: 2, columns: 3, created_at: new Date('2026-01-01'),
  total_seats: 6, available_seats: 6, min_price: '100.00', max_price: '200.00',
};

const seatRows = (overrides = {}) => [1, 2, 3, 4, 5, 6].map((n) => ({
  id: n, theatre_id: 1, row_number: n <= 3 ? 1 : 2, seat_number: ((n - 1) % 3) + 1,
  seat_label: `${n <= 3 ? 'A' : 'B'}${((n - 1) % 3) + 1}`, x_coordinate: ((n - 1) % 3) + 1, y_coordinate: n <= 3 ? 1 : 2,
  price: n <= 3 ? '100.00' : '200.00', seat_type: 'standard', status: 'available', ...(overrides[n] || {}),
}));

const engineResult = (ids, extra = {}) => ({
  recommended_seats: ids.map((id) => ({ id, label: `X${id}`, row: 1, column: id, price: 1 })),
  total_cost: 1,
  fitness_score: 90.5,
  preference_score: 88,
  group_togetherness: 100,
  distance_penalty: 0,
  algorithm: 'genetic',
  execution_time_ms: 12.5,
  alternatives: { greedy: { fitness: 80 }, knapsack: { fitness: 70 }, genetic: { fitness: 90.5 } },
  explanation: ['ok'],
  ...extra,
});

module.exports = { users, mockDb, makeConn, cookieFor, theatreRow, seatRows, engineResult };

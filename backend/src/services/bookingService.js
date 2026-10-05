const pool = require('../config/db');
const ApiError = require('../utils/ApiError');
const theatreService = require('./theatreService');
const algorithmService = require('./algorithmService');

const toCents = (v) => Math.round(Number(v) * 100);
const fromCents = (c) => c / 100;

function formatBooking(row, seats) {
  return {
    id: row.id,
    user_id: row.user_id,
    theatre_id: row.theatre_id,
    theatre_name: row.theatre_name,
    total_price: Number(row.total_price),
    algorithm_used: row.algorithm_used,
    fitness_score: row.fitness_score === null ? null : Number(row.fitness_score),
    created_at: row.created_at,
    ...(row.user_name !== undefined ? { user_name: row.user_name, user_email: row.user_email } : {}),
    seats: seats.map((s) => ({
      id: s.id, seat_label: s.seat_label, row_number: s.row_number, seat_number: s.seat_number,
      price: Number(s.price), seat_type: s.seat_type,
    })),
  };
}

async function attachSeats(bookingRows) {
  if (!bookingRows.length) return [];
  const ids = bookingRows.map((b) => b.id);
  const [seatRows] = await pool.query(
    `SELECT bs.booking_id, s.id, s.seat_label, s.\`row_number\`, s.seat_number, s.price, s.seat_type
     FROM booking_seats bs JOIN seats s ON s.id = bs.seat_id
     WHERE bs.booking_id IN (?) ORDER BY s.\`row_number\`, s.seat_number`,
    [ids],
  );
  return bookingRows.map((b) => formatBooking(b, seatRows.filter((s) => s.booking_id === b.id)));
}

const BOOKING_SELECT = `SELECT b.id, b.user_id, b.theatre_id, b.total_price, b.algorithm_used, b.fitness_score,
        b.created_at, t.name AS theatre_name
  FROM bookings b JOIN theatres t ON t.id = b.theatre_id`;

async function listBookings(user) {
  const [rows] = await pool.query(`${BOOKING_SELECT} WHERE b.user_id = ? ORDER BY b.created_at DESC, b.id DESC`, [user.id]);
  return attachSeats(rows);
}

async function listAllBookings() {
  const [rows] = await pool.query(
    `SELECT b.id, b.user_id, b.theatre_id, b.total_price, b.algorithm_used, b.fitness_score, b.created_at,
            t.name AS theatre_name, u.name AS user_name, u.email AS user_email
     FROM bookings b JOIN theatres t ON t.id = b.theatre_id JOIN users u ON u.id = b.user_id
     ORDER BY b.created_at DESC, b.id DESC LIMIT 500`,
  );
  return attachSeats(rows);
}

async function getBooking(user, id) {
  const [rows] = await pool.query(`${BOOKING_SELECT} WHERE b.id = ?`, [id]);
  // 404 (not 403) for other people's bookings so ids cannot be probed.
  if (!rows.length || (rows[0].user_id !== user.id && user.role !== 'admin')) throw new ApiError(404, 'Booking not found');
  return (await attachSeats(rows))[0];
}

/** Defence in depth: never forward an engine answer that breaks the booking rules. */
function verifyEngineResult(result, availableSeats, input) {
  const byId = new Map(availableSeats.map((s) => [s.id, s]));
  const ids = result.recommended_seats.map((s) => s.id);
  const unique = new Set(ids);
  if (ids.length !== input.people_count || unique.size !== ids.length || !ids.every((id) => byId.has(id))) {
    throw new ApiError(502, 'The algorithm engine returned an invalid seating arrangement');
  }
  const cents = ids.reduce((sum, id) => sum + toCents(byId.get(id).price), 0);
  if (cents > toCents(input.max_budget)) {
    throw new ApiError(502, 'The algorithm engine returned a seating arrangement that exceeds the budget');
  }
  return { seats: ids.map((id) => byId.get(id)), totalCost: fromCents(cents) };
}

async function optimize(user, input) {
  const theatre = await theatreService.getTheatre(input.theatre_id);
  const seats = await theatreService.getSeats(input.theatre_id, { onlyAvailable: true });
  if (seats.length === 0) throw new ApiError(409, 'This theatre has no available seats');
  if (seats.length < input.people_count) {
    throw new ApiError(409, `Only ${seats.length} seat(s) are available but ${input.people_count} were requested`);
  }

  await pool.query(
    `INSERT INTO booking_requests (user_id, theatre_id, people_count, max_budget, preferred_region,
                                   togetherness_weight, preference_weight) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [user.id, input.theatre_id, input.people_count, input.max_budget, input.preferred_region,
      input.togetherness_weight, input.preference_weight],
  );

  const engineResult = await algorithmService.optimize({
    theatre_id: theatre.id,
    theatre_rows: theatre.rows,
    theatre_columns: theatre.columns,
    people_count: input.people_count,
    max_budget: input.max_budget,
    preferred_region: input.preferred_region,
    togetherness_weight: input.togetherness_weight,
    preference_weight: input.preference_weight,
    seats: seats.map((s) => ({
      id: s.id, label: s.seat_label, row: s.row_number, column: s.seat_number,
      x: s.x_coordinate, y: s.y_coordinate, price: s.price, seat_type: s.seat_type, status: s.status,
    })),
  });

  const { seats: verified, totalCost } = verifyEngineResult(engineResult, seats, input);
  return {
    request: input,
    result: {
      ...engineResult,
      // seat details and price come from our database, never from the engine
      recommended_seats: verified.map((s) => ({
        id: s.id, label: s.seat_label, row: s.row_number, column: s.seat_number, price: s.price, seat_type: s.seat_type,
      })),
      total_cost: totalCost,
      budget_remaining: fromCents(toCents(input.max_budget) - toCents(totalCost)),
    },
  };
}

async function createBooking(user, input) {
  const conn = await pool.getConnection();
  let bookingId;
  try {
    await conn.beginTransaction();
    const [theatres] = await conn.query('SELECT id FROM theatres WHERE id = ?', [input.theatre_id]);
    if (!theatres.length) throw new ApiError(404, 'Theatre not found');

    // Row locks (ordered by id to avoid deadlocks) make concurrent bookings of the same seat wait.
    const [seats] = await conn.query(
      'SELECT id, theatre_id, seat_label, price, status FROM seats WHERE id IN (?) ORDER BY id FOR UPDATE',
      [input.seat_ids],
    );
    if (seats.length !== input.seat_ids.length) throw new ApiError(404, 'One or more seats do not exist');
    if (seats.some((s) => s.theatre_id !== input.theatre_id)) {
      throw new ApiError(400, 'All seats must belong to the requested theatre');
    }
    const taken = seats.filter((s) => s.status !== 'available');
    if (taken.length) {
      throw new ApiError(409, `Seats are no longer available: ${taken.map((s) => s.seat_label).join(', ')}`);
    }

    const totalCents = seats.reduce((sum, s) => sum + toCents(s.price), 0);
    if (input.max_budget !== null && totalCents > toCents(input.max_budget)) {
      throw new ApiError(422, `The total price ${fromCents(totalCents)} exceeds the maximum budget of ${input.max_budget}`);
    }

    const [inserted] = await conn.query(
      'INSERT INTO bookings (user_id, theatre_id, total_price, algorithm_used, fitness_score) VALUES (?, ?, ?, ?, ?)',
      [user.id, input.theatre_id, fromCents(totalCents), input.algorithm_used, input.fitness_score],
    );
    bookingId = inserted.insertId;
    await conn.query('INSERT INTO booking_seats (booking_id, seat_id) VALUES ?', [input.seat_ids.map((id) => [bookingId, id])]);
    const [updated] = await conn.query(
      "UPDATE seats SET status = 'booked' WHERE id IN (?) AND status = 'available'",
      [input.seat_ids],
    );
    if (updated.affectedRows !== input.seat_ids.length) throw new ApiError(409, 'Seats are no longer available');
    await conn.commit();
  } catch (err) {
    try { await conn.rollback(); } catch (rollbackError) { /* connection already gone */ }
    if (err.code === 'ER_DUP_ENTRY') throw new ApiError(409, 'Seats are no longer available');
    throw err;
  } finally {
    conn.release();
  }
  return getBooking(user, bookingId);
}

module.exports = { optimize, createBooking, listBookings, listAllBookings, getBooking, verifyEngineResult };

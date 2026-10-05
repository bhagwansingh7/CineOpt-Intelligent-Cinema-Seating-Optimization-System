const pool = require('../config/db');
const ApiError = require('../utils/ApiError');

const mapSeat = (r) => ({
  id: r.id,
  theatre_id: r.theatre_id,
  row_number: r.row_number,
  seat_number: r.seat_number,
  seat_label: r.seat_label,
  x_coordinate: Number(r.x_coordinate),
  y_coordinate: Number(r.y_coordinate),
  price: Number(r.price),
  seat_type: r.seat_type,
  status: r.status,
});

const mapTheatre = (r) => ({
  id: r.id,
  name: r.name,
  rows: r.rows,
  columns: r.columns,
  created_at: r.created_at,
  total_seats: Number(r.total_seats || 0),
  available_seats: Number(r.available_seats || 0),
  booked_seats: Number(r.total_seats || 0) - Number(r.available_seats || 0),
  min_price: r.min_price === null || r.min_price === undefined ? null : Number(r.min_price),
  max_price: r.max_price === null || r.max_price === undefined ? null : Number(r.max_price),
});

const THEATRE_SELECT = `
  SELECT t.id, t.name, t.\`rows\`, t.\`columns\`, t.created_at,
         COUNT(s.id) AS total_seats,
         COALESCE(SUM(s.status = 'available'), 0) AS available_seats,
         MIN(s.price) AS min_price, MAX(s.price) AS max_price
  FROM theatres t
  LEFT JOIN seats s ON s.theatre_id = t.id`;

async function listTheatres() {
  const [rows] = await pool.query(`${THEATRE_SELECT} GROUP BY t.id ORDER BY t.id`);
  return rows.map(mapTheatre);
}

async function getTheatre(id) {
  const [rows] = await pool.query(`${THEATRE_SELECT} WHERE t.id = ? GROUP BY t.id`, [id]);
  if (!rows.length) throw new ApiError(404, 'Theatre not found');
  return mapTheatre(rows[0]);
}

async function getSeats(theatreId, { onlyAvailable = false } = {}) {
  const sql = `SELECT id, theatre_id, \`row_number\`, seat_number, seat_label, x_coordinate, y_coordinate,
                      price, seat_type, status
               FROM seats WHERE theatre_id = ? ${onlyAvailable ? "AND status = 'available'" : ''}
               ORDER BY \`row_number\`, seat_number`;
  const [rows] = await pool.query(sql, [theatreId]);
  return rows.map(mapSeat);
}

async function getTheatreWithSeats(id) {
  const theatre = await getTheatre(id);
  const seats = await getSeats(id);
  return {
    theatre,
    seats,
    summary: {
      total: seats.length,
      available: seats.filter((s) => s.status === 'available').length,
      booked: seats.filter((s) => s.status === 'booked').length,
    },
  };
}

module.exports = { listTheatres, getTheatre, getSeats, getTheatreWithSeats, mapSeat };

const ApiError = require('./ApiError');

const REGIONS = ['front', 'center', 'back', 'left', 'right', 'anywhere'];
const ALGORITHMS = ['greedy', 'knapsack', 'genetic', 'manual'];
const MAX_PEOPLE = 20;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const bad = (message) => new ApiError(400, message);

function parseId(value, name = 'id') {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw bad(`${name} must be a positive integer`);
  return n;
}

function requireObject(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw bad('Request body must be a JSON object');
  return body;
}

function validateRegister(body) {
  requireObject(body);
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (name.length < 2 || name.length > 100) throw bad('Name must be between 2 and 100 characters');
  if (!EMAIL_RE.test(email) || email.length > 255) throw bad('A valid email address is required');
  if (password.length < 8 || Buffer.byteLength(password) > 72) throw bad('Password must be 8-72 characters long');
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) throw bad('Password must contain at least one letter and one number');
  return { name, email, password };
}

function validateLogin(body) {
  requireObject(body);
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!email || !password) throw bad('Email and password are required');
  return { email, password };
}

function validateOptimize(body) {
  requireObject(body);
  const theatre_id = parseId(body.theatre_id, 'theatre_id');
  const people_count = Number(body.people_count);
  if (!Number.isInteger(people_count) || people_count < 1 || people_count > MAX_PEOPLE) {
    throw bad(`people_count must be a whole number between 1 and ${MAX_PEOPLE}`);
  }
  const max_budget = Number(body.max_budget);
  if (!Number.isFinite(max_budget) || max_budget <= 0 || max_budget > 1000000) {
    throw bad('max_budget must be a number greater than 0');
  }
  const preferred_region = body.preferred_region === undefined ? 'anywhere' : body.preferred_region;
  if (!REGIONS.includes(preferred_region)) throw bad(`preferred_region must be one of: ${REGIONS.join(', ')}`);
  const weight = (value, name, fallback) => {
    if (value === undefined || value === null || value === '') return fallback;
    const w = Number(value);
    if (!Number.isFinite(w) || w < 0 || w > 1) throw bad(`${name} must be a number between 0 and 1`);
    return w;
  };
  return {
    theatre_id,
    people_count,
    max_budget,
    preferred_region,
    togetherness_weight: weight(body.togetherness_weight, 'togetherness_weight', 0.5),
    preference_weight: weight(body.preference_weight, 'preference_weight', 0.5),
  };
}

function validateBookingCreate(body) {
  requireObject(body);
  const theatre_id = parseId(body.theatre_id, 'theatre_id');
  if (!Array.isArray(body.seat_ids) || body.seat_ids.length === 0) throw bad('seat_ids must be a non-empty array');
  if (body.seat_ids.length > MAX_PEOPLE) throw bad(`At most ${MAX_PEOPLE} seats can be booked at once`);
  const seat_ids = body.seat_ids.map((id) => parseId(id, 'seat id'));
  if (new Set(seat_ids).size !== seat_ids.length) throw bad('seat_ids contains duplicates');
  const algorithm_used = body.algorithm_used === undefined ? 'manual' : body.algorithm_used;
  if (!ALGORITHMS.includes(algorithm_used)) throw bad(`algorithm_used must be one of: ${ALGORITHMS.join(', ')}`);
  let fitness_score = null;
  if (body.fitness_score !== undefined && body.fitness_score !== null) {
    fitness_score = Number(body.fitness_score);
    if (!Number.isFinite(fitness_score) || fitness_score < 0 || fitness_score > 100) throw bad('fitness_score must be between 0 and 100');
  }
  let max_budget = null;
  if (body.max_budget !== undefined && body.max_budget !== null) {
    max_budget = Number(body.max_budget);
    if (!Number.isFinite(max_budget) || max_budget <= 0) throw bad('max_budget must be a number greater than 0');
  }
  // NOTE: any total_price sent by the client is deliberately ignored - the server prices the booking.
  return { theatre_id, seat_ids: seat_ids.sort((a, b) => a - b), algorithm_used, fitness_score, max_budget };
}

function validateRole(body) {
  requireObject(body);
  if (!['user', 'admin'].includes(body.role)) throw bad("role must be 'user' or 'admin'");
  return body.role;
}

module.exports = {
  REGIONS, ALGORITHMS, MAX_PEOPLE, parseId,
  validateRegister, validateLogin, validateOptimize, validateBookingCreate, validateRole,
};

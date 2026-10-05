const adminService = require('../services/adminService');
const bookingService = require('../services/bookingService');
const theatreService = require('../services/theatreService');
const { success, asyncHandler } = require('../utils/response');
const { parseId, validateRole } = require('../utils/validators');

const users = asyncHandler(async (req, res) => success(res, { users: await adminService.listUsers() }));

const changeRole = asyncHandler(async (req, res) =>
  success(res, { user: await adminService.changeRole(req.user, parseId(req.params.id, 'user id'), validateRole(req.body)) }));

const bookings = asyncHandler(async (req, res) => success(res, { bookings: await bookingService.listAllBookings() }));

const theatres = asyncHandler(async (req, res) => success(res, { theatres: await theatreService.listTheatres() }));

const theatreSeats = asyncHandler(async (req, res) =>
  success(res, await theatreService.getTheatreWithSeats(parseId(req.params.id, 'theatre id'))));

module.exports = { users, changeRole, bookings, theatres, theatreSeats };

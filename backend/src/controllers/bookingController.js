const bookingService = require('../services/bookingService');
const { success, asyncHandler } = require('../utils/response');
const { parseId, validateOptimize, validateBookingCreate } = require('../utils/validators');

const optimize = asyncHandler(async (req, res) =>
  success(res, await bookingService.optimize(req.user, validateOptimize(req.body))));

const create = asyncHandler(async (req, res) =>
  success(res, { booking: await bookingService.createBooking(req.user, validateBookingCreate(req.body)) }, 201));

const list = asyncHandler(async (req, res) => success(res, { bookings: await bookingService.listBookings(req.user) }));

const get = asyncHandler(async (req, res) =>
  success(res, { booking: await bookingService.getBooking(req.user, parseId(req.params.id, 'booking id')) }));

module.exports = { optimize, create, list, get };

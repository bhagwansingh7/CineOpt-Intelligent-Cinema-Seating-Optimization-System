const theatreService = require('../services/theatreService');
const { success, asyncHandler } = require('../utils/response');
const { parseId } = require('../utils/validators');

const list = asyncHandler(async (req, res) => success(res, { theatres: await theatreService.listTheatres() }));

const get = asyncHandler(async (req, res) =>
  success(res, { theatre: await theatreService.getTheatre(parseId(req.params.id, 'theatre id')) }));

const seats = asyncHandler(async (req, res) =>
  success(res, await theatreService.getTheatreWithSeats(parseId(req.params.id, 'theatre id'))));

module.exports = { list, get, seats };

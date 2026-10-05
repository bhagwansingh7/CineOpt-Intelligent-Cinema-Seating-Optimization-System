const config = require('../config/env');
const ApiError = require('../utils/ApiError');

function notFound(req, res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Request body contains invalid JSON' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ success: false, message: 'Request body is too large' });
  }
  if (err instanceof ApiError) {
    const body = { success: false, message: err.message };
    if (err.details) body.details = err.details;
    return res.status(err.status).json(body);
  }
  if (config.env !== 'test') console.error('[error]', err);
  return res.status(500).json({ success: false, message: 'Something went wrong on the server' });
}

module.exports = { notFound, errorHandler };

const axios = require('axios');
const config = require('../config/env');
const ApiError = require('../utils/ApiError');

const NETWORK_CODES = ['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH'];
const TIMEOUT_CODES = ['ECONNABORTED', 'ETIMEDOUT', 'ERR_CANCELED'];

function extractDetail(data) {
  if (!data) return 'The optimisation request was rejected';
  const detail = data.detail !== undefined ? data.detail : data.message;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => `${(d.loc || []).slice(1).join('.') || 'request'}: ${d.msg}`).join('; ');
  }
  return 'The optimisation request was rejected';
}

function isValidEngineResponse(data) {
  return Boolean(
    data && typeof data === 'object'
    && Array.isArray(data.recommended_seats) && data.recommended_seats.length > 0
    && data.recommended_seats.every((s) => s && Number.isInteger(s.id))
    && typeof data.total_cost === 'number'
    && typeof data.fitness_score === 'number'
    && data.alternatives && typeof data.alternatives === 'object'
    && Array.isArray(data.explanation),
  );
}

/** Calls the FastAPI engine. Never leaks stack traces; maps every failure to a useful ApiError. */
async function optimize(payload) {
  let response;
  try {
    response = await axios.post(`${config.algorithmEngineUrl}/optimize`, payload, {
      timeout: config.algorithmTimeoutMs,
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true,
    });
  } catch (err) {
    if (TIMEOUT_CODES.includes(err.code)) {
      throw new ApiError(504, 'The algorithm engine took too long to respond. Please try again.');
    }
    if (NETWORK_CODES.includes(err.code) || !err.response) {
      throw new ApiError(503, 'The algorithm engine is unavailable. Please try again in a moment.');
    }
    throw new ApiError(502, 'Could not reach the algorithm engine');
  }

  const { status, data } = response;
  if (status >= 500) throw new ApiError(502, 'The algorithm engine failed to process the request');
  if (status >= 400) throw new ApiError(422, extractDetail(data));
  if (!isValidEngineResponse(data)) throw new ApiError(502, 'The algorithm engine returned an invalid response');
  return data;
}

module.exports = { optimize, isValidEngineResponse };

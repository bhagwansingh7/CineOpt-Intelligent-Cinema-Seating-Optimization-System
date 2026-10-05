jest.mock('axios');
const axios = require('axios');
const { optimize, isValidEngineResponse } = require('../src/services/algorithmService');
const { engineResult } = require('./helpers');

const payload = { theatre_id: 1, people_count: 1 };

describe('algorithmService.optimize', () => {
  beforeEach(() => axios.post.mockReset());

  test('calls the engine over HTTP with a timeout and returns the result', async () => {
    axios.post.mockResolvedValue({ status: 200, data: engineResult([1]) });
    const result = await optimize(payload);
    expect(result.algorithm).toBe('genetic');
    const [url, body, options] = axios.post.mock.calls[0];
    expect(url).toBe('http://algorithm-engine:8000/optimize');
    expect(body).toBe(payload);
    expect(options.timeout).toBeGreaterThan(0);
  });

  test('engine unavailable -> 503 with a useful message', async () => {
    axios.post.mockRejectedValue({ code: 'ECONNREFUSED' });
    await expect(optimize(payload)).rejects.toMatchObject({ status: 503, message: expect.stringMatching(/unavailable/) });
  });

  test('timeout -> 504', async () => {
    axios.post.mockRejectedValue({ code: 'ECONNABORTED' });
    await expect(optimize(payload)).rejects.toMatchObject({ status: 504 });
  });

  test('engine 5xx -> 502', async () => {
    axios.post.mockResolvedValue({ status: 500, data: 'boom' });
    await expect(optimize(payload)).rejects.toMatchObject({ status: 502 });
  });

  test('engine 422 passes the reason through (e.g. budget too low)', async () => {
    axios.post.mockResolvedValue({ status: 422, data: { detail: 'Budget too low: the cheapest 4 seat(s) cost 800' } });
    await expect(optimize(payload)).rejects.toMatchObject({ status: 422, message: 'Budget too low: the cheapest 4 seat(s) cost 800' });
  });

  test('validation-style 422 arrays are flattened into one message', async () => {
    axios.post.mockResolvedValue({ status: 422, data: { detail: [{ loc: ['body', 'people_count'], msg: 'too small' }] } });
    await expect(optimize(payload)).rejects.toMatchObject({ message: 'people_count: too small' });
  });

  test('malformed engine response -> 502', async () => {
    axios.post.mockResolvedValue({ status: 200, data: { hello: 'world' } });
    await expect(optimize(payload)).rejects.toMatchObject({ status: 502, message: expect.stringMatching(/invalid response/) });
    expect(isValidEngineResponse(engineResult([1]))).toBe(true);
    expect(isValidEngineResponse(engineResult([]))).toBe(false);
  });
});

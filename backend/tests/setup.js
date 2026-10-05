process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256-1234567890';
process.env.JWT_EXPIRES_IN = '1h';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.ALGORITHM_ENGINE_URL = 'http://algorithm-engine:8000';

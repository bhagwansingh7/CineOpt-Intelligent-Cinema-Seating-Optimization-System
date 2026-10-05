const authService = require('../services/authService');
const config = require('../config/env');
const { parseDurationMs } = require('../utils/duration');
const { success, asyncHandler } = require('../utils/response');
const { validateRegister, validateLogin } = require('../utils/validators');

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: config.cookieSecure,
  path: '/',
});

const setSession = (res, token) =>
  res.cookie('token', token, { ...cookieOptions(), maxAge: parseDurationMs(config.jwt.expiresIn) });

const register = asyncHandler(async (req, res) => {
  const { user, token } = await authService.register(validateRegister(req.body));
  setSession(res, token);
  success(res, { user }, 201);
});

const login = asyncHandler(async (req, res) => {
  const { user, token } = await authService.login(validateLogin(req.body));
  setSession(res, token);
  success(res, { user });
});

const logout = (req, res) => {
  res.clearCookie('token', cookieOptions());
  success(res, { message: 'Logged out' });
};

const me = (req, res) => success(res, { user: authService.publicUser(req.user) });

module.exports = { register, login, logout, me };

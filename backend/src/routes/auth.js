const router = require('express').Router();
const controller = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { rateLimit } = require('../middleware/security');

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 40 });

router.post('/register', limiter, controller.register);
router.post('/login', limiter, controller.login);
router.post('/logout', controller.logout);
router.get('/me', authenticate, controller.me);

module.exports = router;

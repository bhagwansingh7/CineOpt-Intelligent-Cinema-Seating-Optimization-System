const router = require('express').Router();
const pool = require('../config/db');

router.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ success: true, data: { status: 'ok', database: 'up' } });
  } catch (err) {
    res.status(503).json({ success: false, message: 'Database is not reachable' });
  }
});

router.use('/auth', require('./auth'));
router.use('/theatres', require('./theatres'));
router.use('/bookings', require('./bookings'));
router.use('/admin', require('./admin'));

module.exports = router;

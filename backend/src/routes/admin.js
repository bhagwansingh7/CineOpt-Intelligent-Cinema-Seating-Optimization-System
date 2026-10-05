const router = require('express').Router();
const controller = require('../controllers/adminController');
const { authenticate, requireAdmin } = require('../middleware/auth');

// Authorisation is enforced here on the server; hiding buttons in the UI is not relied upon.
router.use(authenticate, requireAdmin);
router.get('/users', controller.users);
router.patch('/users/:id/role', controller.changeRole);
router.get('/bookings', controller.bookings);
router.get('/theatres', controller.theatres);
router.get('/theatres/:id/seats', controller.theatreSeats);

module.exports = router;

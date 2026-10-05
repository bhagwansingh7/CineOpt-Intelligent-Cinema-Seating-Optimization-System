const router = require('express').Router();
const controller = require('../controllers/bookingController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);
router.post('/optimize', controller.optimize);
router.post('/', controller.create);
router.get('/', controller.list);
router.get('/:id', controller.get);

module.exports = router;

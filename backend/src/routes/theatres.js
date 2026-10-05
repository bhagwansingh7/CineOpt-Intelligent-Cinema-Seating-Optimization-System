const router = require('express').Router();
const controller = require('../controllers/theatreController');

router.get('/', controller.list);
router.get('/:id', controller.get);
router.get('/:id/seats', controller.seats);

module.exports = router;

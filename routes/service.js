const express = require('express');
const router = express.Router();
const {
  getTickets,
  getTicket,
  createTicket,
  updateTicket,
  deleteTicket,
  assignTicket,
  resolveTicket,
  rateTicket,
  getServiceStats,
  updateStatus
} = require('../controllers/serviceController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/stats', getServiceStats);
router.get('/', getTickets);
router.get('/:id', getTicket);
router.post('/', createTicket);
router.put('/:id', updateTicket);
router.delete('/:id', deleteTicket);
router.post('/:id/assign', assignTicket);
router.post('/:id/resolve', resolveTicket);
router.post('/:id/rate', rateTicket);
router.post('/:id/status', updateStatus);

module.exports = router;


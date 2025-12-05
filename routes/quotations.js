const express = require('express');
const router = express.Router();
const {
  getQuotations,
  getQuotation,
  createQuotation,
  updateQuotation,
  deleteQuotation,
  sendQuotation,
  updateStatus
} = require('../controllers/quotationController');
const { authenticate, checkDataAccess } = require('../middleware/auth');
const Quotation = require('../models/Quotation');

router.use(authenticate);

router.get('/', getQuotations);
router.get('/:id', checkDataAccess(Quotation), getQuotation);
router.post('/', createQuotation);
router.put('/:id', checkDataAccess(Quotation), updateQuotation);
router.delete('/:id', checkDataAccess(Quotation), deleteQuotation);
router.post('/:id/send', checkDataAccess(Quotation), sendQuotation);
router.post('/:id/status', checkDataAccess(Quotation), updateStatus);

module.exports = router;


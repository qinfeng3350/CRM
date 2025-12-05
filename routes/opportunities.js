const express = require('express');
const router = express.Router();
const {
  getOpportunities,
  getOpportunity,
  createOpportunity,
  updateOpportunity,
  deleteOpportunity,
  transferOpportunity,
  updateStatus,
  getFunnel,
  checkAutoTransfer
} = require('../controllers/opportunityController');
const { authenticate, checkDataAccess } = require('../middleware/auth');
const Opportunity = require('../models/Opportunity');

router.use(authenticate);

router.get('/funnel', getFunnel);
router.get('/', getOpportunities);
router.get('/:id', checkDataAccess(Opportunity), getOpportunity);
router.post('/', createOpportunity);
router.put('/:id', checkDataAccess(Opportunity), updateOpportunity);
router.delete('/:id', checkDataAccess(Opportunity), deleteOpportunity);
router.post('/:id/transfer', transferOpportunity);
router.post('/:id/status', updateStatus);
router.post('/check-auto-transfer', checkAutoTransfer);

module.exports = router;


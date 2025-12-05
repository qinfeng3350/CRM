const express = require('express');
const router = express.Router();
const {
  getSalesAnalytics,
  getCustomerAnalytics,
  getOpportunityAnalytics,
  getContractAnalytics,
  getCustomReport,
  exportReport
} = require('../controllers/analyticsController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/sales', getSalesAnalytics);
router.get('/customers', getCustomerAnalytics);
router.get('/opportunities', getOpportunityAnalytics);
router.get('/contracts', getContractAnalytics);
router.post('/custom', getCustomReport);
router.post('/export', exportReport);

module.exports = router;


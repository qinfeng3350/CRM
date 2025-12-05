const express = require('express');
const router = express.Router();
const {
  syncData,
  webhook,
  getIntegrationStatus
} = require('../controllers/integrationController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/status', getIntegrationStatus);
router.post('/sync', authorize('admin'), syncData);
router.post('/webhook', webhook);

module.exports = router;


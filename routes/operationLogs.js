const express = require('express');
const router = express.Router();
const { getLogs } = require('../controllers/operationLogController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', authorize('admin', 'sales_manager'), getLogs);

module.exports = router;


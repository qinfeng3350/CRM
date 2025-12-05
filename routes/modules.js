const express = require('express');
const router = express.Router();
const { getModules, getModuleFields } = require('../controllers/moduleController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', getModules);
router.get('/:moduleCode/fields', getModuleFields);

module.exports = router;


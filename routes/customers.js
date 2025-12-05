const express = require('express');
const router = express.Router();
const { searchCompanies } = require('../controllers/companySearchController');
const {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  claimCustomer,
  returnToPublic,
  getPublicCustomers,
  getPrivateCustomers,
  updateStatus
} = require('../controllers/customerController');
const { authenticate, checkDataAccess } = require('../middleware/auth');
const Customer = require('../models/Customer');

// 所有路由都需要认证
router.use(authenticate);

router.get('/public', getPublicCustomers);
router.get('/private', getPrivateCustomers);
router.get('/search/companies', searchCompanies); // 企业名称搜索接口
router.get('/', getCustomers);
router.get('/:id', checkDataAccess(Customer), getCustomer);
router.post('/', createCustomer);
router.put('/:id', checkDataAccess(Customer), updateCustomer);
router.delete('/:id', checkDataAccess(Customer), deleteCustomer);
router.post('/:id/claim', claimCustomer);
router.post('/:id/return', returnToPublic);
router.post('/:id/status', checkDataAccess(Customer), updateStatus);

module.exports = router;


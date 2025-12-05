const express = require('express');
const router = express.Router();
const {
  getContracts,
  getContract,
  createContract,
  updateContract,
  deleteContract,
  approveContract,
  signContract,
  getContractStats,
  updateStatus
} = require('../controllers/contractController');
const { authenticate, checkDataAccess, authorize } = require('../middleware/auth');
const Contract = require('../models/Contract');

router.use(authenticate);

router.get('/stats', getContractStats);
router.get('/', getContracts);
// 合同详情：允许通过待办关联查看，所以使用更宽松的权限检查
router.get('/:id', checkDataAccess(Contract, 'ownerId'), getContract);
router.post('/', createContract);
router.put('/:id', checkDataAccess(Contract), updateContract);
router.delete('/:id', checkDataAccess(Contract), deleteContract);
router.post('/:id/approve', authorize('admin', 'sales_manager'), approveContract);
router.post('/:id/sign', checkDataAccess(Contract), signContract);
router.post('/:id/status', checkDataAccess(Contract), updateStatus);

module.exports = router;


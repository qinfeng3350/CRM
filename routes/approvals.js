const express = require('express');
const router = express.Router();
const {
  getWorkflows,
  getWorkflow,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  startApproval,
  approve,
  withdrawApproval,
  getApprovalRecords
} = require('../controllers/approvalController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// 审批操作（具体路由，放在参数路由之前）
router.post('/start', startApproval);

// 审批流程配置（需要管理员权限）
router.get('/workflows', authorize('admin', 'sales_manager'), getWorkflows);
router.get('/workflows/:id', authorize('admin', 'sales_manager'), getWorkflow);
router.post('/workflows', authorize('admin', 'sales_manager'), createWorkflow);
router.put('/workflows/:id', authorize('admin', 'sales_manager'), updateWorkflow);
router.delete('/workflows/:id', authorize('admin', 'sales_manager'), deleteWorkflow);

// 审批操作（参数路由，放在最后）
router.post('/:moduleType/:moduleId/approve', approve);
router.post('/:moduleType/:moduleId/withdraw', withdrawApproval);
router.get('/:moduleType/:moduleId/records', getApprovalRecords);

module.exports = router;


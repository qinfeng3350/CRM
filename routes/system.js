const express = require('express');
const router = express.Router();
const {
  getRoles,
  createRole,
  updateRole,
  deleteRole,
  getUsers,
  updateUserRole,
  updateUser,
  getSystemConfig,
  updateSystemConfig,
  getTransferRules,
  createTransferRule,
  updateTransferRule,
  deleteTransferRule
} = require('../controllers/systemController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// 角色管理
router.get('/roles', authorize('admin'), getRoles);
router.post('/roles', authorize('admin'), createRole);
router.put('/roles/:id', authorize('admin'), updateRole);
router.delete('/roles/:id', authorize('admin'), deleteRole);

// 用户管理
router.get('/users', authorize('admin', 'sales_manager'), getUsers);
router.put('/users/:id/role', authorize('admin'), updateUserRole);
router.put('/users/:id', authorize('admin'), updateUser);

// 系统配置
router.get('/config', authorize('admin'), getSystemConfig);
router.put('/config', authorize('admin'), updateSystemConfig);

// 流转规则管理
router.get('/transfer-rules', authorize('admin', 'sales_manager'), getTransferRules);
router.post('/transfer-rules', authorize('admin', 'sales_manager'), createTransferRule);
router.put('/transfer-rules/:id', authorize('admin', 'sales_manager'), updateTransferRule);
router.delete('/transfer-rules/:id', authorize('admin'), deleteTransferRule);

module.exports = router;


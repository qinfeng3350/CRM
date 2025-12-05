const express = require('express');
const router = express.Router();
const {
  getConfig,
  updateConfig,
  getLoginUrl,
  getQRCodeUrl,
  getQRLoginConfig,
  loginWithCode,
  handleCallback,
  syncDepartments,
  syncContacts,
  syncOrganization,
  clearSyncData,
  syncTodoToDingTalk,
  syncTodosToDingTalk,
  getDingTalkUsers,
  cleanDuplicateUsers,
  testConfig,
  getStreamStatus,
  restartStream,
  redirectTodoDetail,
  logFromFrontend,
} = require('../controllers/dingTalkController');
const { authenticate, authorize } = require('../middleware/auth');

// 公开路由 - 钉钉登录和回调不需要认证
router.post('/log', logFromFrontend);

// 生成钉钉模板配置（读取系统流程定义）
router.get('/template-config', require('../controllers/dingTalkController').generateTemplateConfig); // 前端日志接口（用于调试，公开接口）
router.post('/login', loginWithCode); // 企业内部应用免登
router.get('/callback', handleCallback); // OAuth回调（备用）
router.get('/login-url', getLoginUrl); // 网页OAuth登录（不需要认证，已废弃，使用扫码登录）
router.get('/qrcode-url', getQRCodeUrl); // 扫码登录二维码URL（不需要认证）
router.get('/qrlogin-config', getQRLoginConfig); // 获取扫码登录配置（公开接口，不需要认证）
router.get('/todo/redirect/:todoId', redirectTodoDetail); // 待办详情页跳转代理（公开接口，用于钉钉跳转）
router.post('/todo/:todoId/approve', require('../controllers/dingTalkController').approveTodoByDingTalk); // 通过待办ID审批（公开接口，用于钉钉）
router.post('/todo/:todoId/complete', require('../controllers/dingTalkController').completeTodoByDingTalk); // 通过待办ID完成（公开接口，用于钉钉）
router.post('/approval/callback', require('../controllers/dingTalkController').handleApprovalCallback); // 钉钉审批回调（公开接口）
router.post('/approval/test-callback', require('../controllers/dingTalkController').testApprovalCallback); // 测试审批回调（仅开发环境，用于本地测试）

// 需要认证的路由
router.use(authenticate);

// 配置管理（仅管理员）
router.get('/config', authorize('admin'), getConfig);
router.put('/config', authorize('admin'), updateConfig);
router.post('/config/test', authorize('admin'), testConfig);
router.get('/template-config', authorize('admin'), require('../controllers/dingTalkController').generateTemplateConfig);
router.get('/stream/status', authorize('admin'), getStreamStatus);
router.post('/stream/restart', authorize('admin'), restartStream);

// 组织架构同步（仅管理员）
router.post('/sync/departments', authorize('admin'), syncDepartments);

// 通讯录同步（仅管理员）
router.post('/sync/contacts', authorize('admin'), syncContacts);

// 统一同步组织架构（部门和用户，仅管理员）
router.post('/sync/organization', authorize('admin'), syncOrganization);

// 清除钉钉同步数据（仅管理员）
router.post('/sync/clear', authorize('admin'), clearSyncData);

// 待办同步
router.post('/todos/:todoId/sync', syncTodoToDingTalk);
router.post('/todos/sync', syncTodosToDingTalk);

// 用户关联管理（仅管理员）
router.get('/users', authorize('admin'), getDingTalkUsers);
router.post('/users/clean-duplicates', authorize('admin'), cleanDuplicateUsers);

module.exports = router;


const express = require('express');
const router = express.Router();
const {
  getWorkflowDefinitions,
  getWorkflowDefinition,
  createWorkflowDefinition,
  updateWorkflowDefinition,
  deleteWorkflowDefinition,
  startWorkflow,
  handleTask,
  getWorkflowInstances,
  getWorkflowInstance,
  getMyTasks,
  getTaskDetail
} = require('../controllers/workflowController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// 流程定义管理（需要管理员权限）
router.get('/definitions', authorize('admin'), getWorkflowDefinitions);
router.get('/definitions/:id', authorize('admin'), getWorkflowDefinition);
router.post('/definitions', authorize('admin'), createWorkflowDefinition);
router.put('/definitions/:id', authorize('admin'), updateWorkflowDefinition);
router.delete('/definitions/:id', authorize('admin'), deleteWorkflowDefinition);

// 流程实例
router.get('/instances', getWorkflowInstances);
router.get('/instances/:id', getWorkflowInstance);

// 流程操作
router.post('/start', startWorkflow);
router.post('/tasks/:taskId/handle', handleTask);

// 我的待办
router.get('/tasks/my', getMyTasks);
router.get('/tasks/:taskId/detail', getTaskDetail);

module.exports = router;


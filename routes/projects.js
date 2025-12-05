const express = require('express');
const router = express.Router();
const {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  updateProgress,
  addLog,
  getLogs,
  getPhases,
  createPhase,
  updatePhase,
  deletePhase,
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  getProjectStats,
  getAllProjectsDashboard,
  getProjectGantt
} = require('../controllers/projectController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/', getProjects);
router.get('/dashboard/stats', getAllProjectsDashboard);
router.get('/:id', getProject);
router.post('/', createProject);
router.put('/:id', updateProject);
router.delete('/:id', deleteProject);
router.post('/:id/progress', updateProgress);
router.post('/:id/logs', addLog);
router.get('/:id/logs', getLogs);

// 项目阶段（板块）管理
router.get('/:id/phases', getPhases);
router.post('/:id/phases', createPhase);
router.put('/:id/phases/:phaseId', updatePhase);
router.delete('/:id/phases/:phaseId', deletePhase);

// 项目任务管理
router.get('/:id/tasks', getTasks);
router.post('/:id/tasks', createTask);
router.put('/:id/tasks/:taskId', updateTask);
router.delete('/:id/tasks/:taskId', deleteTask);

// 项目统计数据（数据大屏）
router.get('/:id/stats', getProjectStats);
router.get('/:id/gantt', getProjectGantt);

module.exports = router;


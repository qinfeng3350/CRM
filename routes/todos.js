const express = require('express');
const router = express.Router();
const {
  getMyTodos,
  getTodo,
  getTodoStats,
  completeTodo,
  updateTodoStatus
} = require('../controllers/todoController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/stats', getTodoStats);
router.get('/', getMyTodos);
router.get('/:id', getTodo);
router.post('/:id/complete', completeTodo);
router.put('/:id/status', updateTodoStatus);

module.exports = router;


const { pool } = require('../config/database');

async function checkTodo46() {
  const connection = await pool.getConnection();
  try {
    const [todos] = await connection.execute(
      'SELECT * FROM todos WHERE id = 46'
    );
    
    if (todos.length > 0) {
      const todo = todos[0];
      console.log('待办ID 46 的信息:');
      console.log('  状态:', todo.status);
      console.log('  审批人ID:', todo.assigneeId);
      console.log('  metadata:', todo.metadata);
      
      if (todo.metadata) {
        try {
          const metadata = typeof todo.metadata === 'string' 
            ? JSON.parse(todo.metadata) 
            : todo.metadata;
          console.log('\n解析后的metadata:');
          console.log('  workflowInstanceId:', metadata.workflowInstanceId);
          console.log('  nodeInstanceId:', metadata.nodeInstanceId);
          console.log('  taskId:', metadata.taskId);
        } catch (e) {
          console.log('解析metadata失败:', e.message);
        }
      }
    }
  } finally {
    connection.release();
    process.exit(0);
  }
}

checkTodo46();


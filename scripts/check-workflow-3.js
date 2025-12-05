const { pool } = require('../config/database');

async function checkWorkflow3() {
  const connection = await pool.getConnection();
  try {
    console.log('=== 检查流程实例3的状态 ===\n');

    const workflowInstanceId = 3;

    // 1. 检查流程实例
    const [instances] = await connection.execute(
      'SELECT * FROM workflow_instances WHERE id = ?',
      [workflowInstanceId]
    );

    if (instances.length === 0) {
      console.log('❌ 未找到流程实例3');
      return;
    }

    const instance = instances[0];
    console.log(`✅ 流程实例 ID: ${instance.id}`);
    console.log(`   状态: ${instance.status}`);
    console.log(`   模块类型: ${instance.moduleType}`);
    console.log(`   模块ID: ${instance.moduleId}\n`);

    // 2. 检查节点实例
    const [nodeInstances] = await connection.execute(
      'SELECT * FROM workflow_node_instances WHERE instanceId = ? ORDER BY createdAt',
      [workflowInstanceId]
    );

    console.log(`✅ 找到 ${nodeInstances.length} 个节点实例:`);
    nodeInstances.forEach((ni, index) => {
      console.log(`   ${index + 1}. 节点ID: ${ni.id}, 节点Key: ${ni.nodeKey}, 类型: ${ni.nodeType}, 状态: ${ni.status}`);
    });
    console.log('');

    // 3. 检查任务
    const [tasks] = await connection.execute(
      'SELECT * FROM workflow_tasks WHERE instanceId = ? ORDER BY createdAt',
      [workflowInstanceId]
    );

    console.log(`✅ 找到 ${tasks.length} 个任务:`);
    tasks.forEach((task, index) => {
      console.log(`   ${index + 1}. 任务ID: ${task.id}, 类型: ${task.taskType}, 状态: ${task.status}, 审批人ID: ${task.assigneeId}`);
    });
    console.log('');

    // 4. 检查待办
    const Todo = require('../models/Todo');
    const todos = await Todo.find({
      type: 'approval',
      'metadata.workflowInstanceId': workflowInstanceId,
    });

    console.log(`✅ 找到 ${todos.length} 个待办:`);
    todos.forEach((todo, index) => {
      console.log(`   ${index + 1}. 待办ID: ${todo.id}, 标题: ${todo.title}, 状态: ${todo.status}`);
    });

    console.log('\n📝 现在可以使用以下命令测试审批回调：');
    console.log(`   node scripts/test-approval-callback.js`);
    console.log(`   或者手动指定 businessId 为 ${workflowInstanceId}`);

  } catch (error) {
    console.error('❌ 检查失败:', error.message);
  } finally {
    connection.release();
    process.exit(0);
  }
}

checkWorkflow3();


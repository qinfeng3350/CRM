const { pool } = require('../config/database');

async function checkWorkflowStatus() {
  const connection = await pool.getConnection();
  try {
    console.log('=== 检查流程状态 ===\n');

    const workflowInstanceId = 1;

    // 1. 检查流程实例
    console.log('1. 检查流程实例...');
    const [instances] = await connection.execute(
      'SELECT * FROM workflow_instances WHERE id = ?',
      [workflowInstanceId]
    );

    if (instances.length === 0) {
      console.log('❌ 未找到流程实例');
      return;
    }

    const instance = instances[0];
    console.log(`✅ 流程实例 ID: ${instance.id}`);
    console.log(`   状态: ${instance.status}`);
    console.log(`   模块类型: ${instance.moduleType}`);
    console.log(`   模块ID: ${instance.moduleId}`);
    
    // 解析metadata
    if (instance.metadata) {
      try {
        const metadata = typeof instance.metadata === 'string' 
          ? JSON.parse(instance.metadata) 
          : instance.metadata;
        if (metadata.dingTalkApproval) {
          console.log(`   钉钉审批回调: ${JSON.stringify(metadata.dingTalkApproval, null, 2)}`);
        }
      } catch (e) {
        console.log(`   metadata: ${instance.metadata}`);
      }
    }
    console.log('');

    // 2. 检查节点实例
    console.log('2. 检查节点实例...');
    const [nodeInstances] = await connection.execute(
      'SELECT * FROM workflow_node_instances WHERE instanceId = ? ORDER BY createdAt',
      [workflowInstanceId]
    );

    if (nodeInstances.length === 0) {
      console.log('⚠️  未找到节点实例');
    } else {
      console.log(`✅ 找到 ${nodeInstances.length} 个节点实例:`);
      nodeInstances.forEach((ni, index) => {
        console.log(`   ${index + 1}. 节点ID: ${ni.id}, 节点Key: ${ni.nodeKey}, 状态: ${ni.status}`);
        if (ni.completedAt) {
          console.log(`      完成时间: ${ni.completedAt}`);
        }
      });
    }
    console.log('');

    // 3. 检查任务
    console.log('3. 检查审批任务...');
    const [tasks] = await connection.execute(
      'SELECT * FROM workflow_tasks WHERE instanceId = ? ORDER BY createdAt',
      [workflowInstanceId]
    );

    if (tasks.length === 0) {
      console.log('⚠️  未找到审批任务');
    } else {
      console.log(`✅ 找到 ${tasks.length} 个任务:`);
      tasks.forEach((task, index) => {
        console.log(`   ${index + 1}. 任务ID: ${task.id}, 类型: ${task.taskType}, 状态: ${task.status}`);
        console.log(`      审批人ID: ${task.assigneeId}`);
        if (task.completedAt) {
          console.log(`      完成时间: ${task.completedAt}`);
        }
      });
    }
    console.log('');

    // 4. 检查待办
    console.log('4. 检查待办事项...');
    const Todo = require('../models/Todo');
    const todos = await Todo.find({
      type: 'approval',
      'metadata.workflowInstanceId': workflowInstanceId,
    });

    if (todos.length === 0) {
      console.log('⚠️  未找到待办事项');
    } else {
      console.log(`✅ 找到 ${todos.length} 个待办:`);
      todos.forEach((todo, index) => {
        console.log(`   ${index + 1}. 待办ID: ${todo.id}, 标题: ${todo.title}`);
        console.log(`      状态: ${todo.status}, 审批人ID: ${todo.assigneeId}`);
      });
    }

    console.log('\n=== 检查完成 ===');

  } catch (error) {
    console.error('❌ 检查失败:', error.message);
    console.error(error.stack);
  } finally {
    connection.release();
    process.exit(0);
  }
}

checkWorkflowStatus();


const { pool } = require('../config/database');

async function checkTodos() {
  const connection = await pool.getConnection();
  try {
    console.log('==========================================');
    console.log('🔍 检查待办记录...');
    console.log('==========================================\n');

    // 查询所有待办
    const [allTodos] = await connection.execute(
      `SELECT id, type, moduleType, moduleId, title, assigneeId, status, priority, createdAt, metadata 
       FROM todos 
       ORDER BY createdAt DESC 
       LIMIT 20`
    );

    console.log(`📋 最近20条待办记录：`);
    console.log(`   总数: ${allTodos.length}\n`);

    if (allTodos.length === 0) {
      console.log('⚠️  数据库中没有待办记录');
    } else {
      allTodos.forEach((todo, index) => {
        console.log(`${index + 1}. ID: ${todo.id}`);
        console.log(`   类型: ${todo.type}`);
        console.log(`   模块: ${todo.moduleType} (ID: ${todo.moduleId})`);
        console.log(`   标题: ${todo.title}`);
        console.log(`   分配人ID: ${todo.assigneeId}`);
        console.log(`   状态: ${todo.status}`);
        console.log(`   优先级: ${todo.priority}`);
        console.log(`   创建时间: ${todo.createdAt}`);
        
        if (todo.metadata) {
          try {
            const metadata = typeof todo.metadata === 'string' 
              ? JSON.parse(todo.metadata) 
              : todo.metadata;
            if (metadata.dingTalkApproval) {
              console.log(`   🔵 钉钉审批: ${metadata.dingTalkApproval ? '是' : '否'}`);
            }
            if (metadata.workflowInstanceId) {
              console.log(`   🔗 流程实例ID: ${metadata.workflowInstanceId}`);
            }
          } catch (e) {
            console.log(`   ⚠️  metadata解析失败: ${e.message}`);
          }
        }
        console.log('');
      });
    }

    // 查询待审批的待办
    const [pendingTodos] = await connection.execute(
      `SELECT id, type, moduleType, moduleId, title, assigneeId, status 
       FROM todos 
       WHERE status = 'pending' 
       ORDER BY createdAt DESC`
    );

    console.log(`\n📋 待处理（pending）的待办：`);
    console.log(`   总数: ${pendingTodos.length}\n`);

    if (pendingTodos.length > 0) {
      pendingTodos.forEach((todo, index) => {
        console.log(`${index + 1}. ID: ${todo.id}, 标题: ${todo.title}, 分配人ID: ${todo.assigneeId}`);
      });
    }

    // 查询工作流任务
    const [workflowTasks] = await connection.execute(
      `SELECT id, instanceId, nodeInstanceId, assigneeId, status, taskType, createdAt 
       FROM workflow_tasks 
       WHERE status = 'pending' 
       ORDER BY createdAt DESC 
       LIMIT 10`
    );

    console.log(`\n📋 待处理的工作流任务：`);
    console.log(`   总数: ${workflowTasks.length}\n`);

    if (workflowTasks.length > 0) {
      workflowTasks.forEach((task, index) => {
        console.log(`${index + 1}. 任务ID: ${task.id}`);
        console.log(`   流程实例ID: ${task.instanceId}`);
        console.log(`   节点实例ID: ${task.nodeInstanceId}`);
        console.log(`   分配人ID: ${task.assigneeId}`);
        console.log(`   状态: ${task.status}`);
        console.log(`   类型: ${task.taskType}`);
        console.log(`   创建时间: ${task.createdAt}`);
        console.log('');
      });
    }

    // 查询流程实例
    const [workflowInstances] = await connection.execute(
      `SELECT id, moduleType, moduleId, status, initiatorId, createdAt 
       FROM workflow_instances 
       WHERE status = 'running' 
       ORDER BY createdAt DESC 
       LIMIT 10`
    );

    console.log(`\n📋 运行中的流程实例：`);
    console.log(`   总数: ${workflowInstances.length}\n`);

    if (workflowInstances.length > 0) {
      workflowInstances.forEach((instance, index) => {
        console.log(`${index + 1}. 实例ID: ${instance.id}`);
        console.log(`   模块: ${instance.moduleType} (ID: ${instance.moduleId})`);
        console.log(`   状态: ${instance.status}`);
        console.log(`   发起人ID: ${instance.initiatorId}`);
        console.log(`   创建时间: ${instance.createdAt}`);
        console.log('');
      });
    }

    console.log('==========================================');
    console.log('✅ 检查完成');
    console.log('==========================================');

  } catch (error) {
    console.error('❌ 检查失败:', error);
    throw error;
  } finally {
    connection.release();
    pool.end();
  }
}

checkTodos()
  .then(() => {
    console.log('\n✅ 脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 脚本执行失败:', error);
    process.exit(1);
  });


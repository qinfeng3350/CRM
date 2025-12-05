const { pool } = require('../config/database');
const Todo = require('../models/Todo');

async function createMissingTodos() {
  const connection = await pool.getConnection();
  try {
    console.log('==========================================');
    console.log('🔧 为现有流程实例创建缺失的待办记录...');
    console.log('==========================================\n');

    // 查询所有运行中的流程实例和对应的待处理任务
    const [workflowTasks] = await connection.execute(
      `SELECT wt.id as taskId, wt.instanceId, wt.nodeInstanceId, wt.assigneeId, wt.status, wt.taskType,
              wi.moduleType, wi.moduleId, wi.initiatorId, wi.status as instanceStatus,
              wn.nodeType, wn.name as nodeName
       FROM workflow_tasks wt
       INNER JOIN workflow_instances wi ON wt.instanceId = wi.id
       LEFT JOIN workflow_nodes wn ON wt.nodeId = wn.id
       WHERE wt.status = 'pending' 
       AND wi.status = 'running'
       ORDER BY wt.createdAt DESC`
    );

    console.log(`📋 找到 ${workflowTasks.length} 个待处理的工作流任务\n`);

    if (workflowTasks.length === 0) {
      console.log('✅ 没有需要创建待办的流程实例');
      return;
    }

    let createdCount = 0;
    let skippedCount = 0;

    for (const task of workflowTasks) {
      console.log(`\n处理任务 ID: ${task.taskId}`);
      console.log(`  流程实例ID: ${task.instanceId}`);
      console.log(`  模块: ${task.moduleType} (ID: ${task.moduleId})`);
      console.log(`  分配人ID: ${task.assigneeId}`);

      // 检查是否已有待办
      const existingTodos = await Todo.find({
        type: 'approval',
        moduleType: task.moduleType,
        moduleId: task.moduleId,
        assigneeId: task.assigneeId,
        status: 'pending'
      });

      if (existingTodos.length > 0) {
        console.log(`  ⚠️  待办已存在，跳过: todoId=${existingTodos[0].id}`);
        skippedCount++;
        continue;
      }

      // 获取模块数据以生成标题
      let moduleData = null;
      let title = '审批待办';
      
      try {
        if (task.moduleType === 'contract' || task.moduleType === 'contracts') {
          const Contract = require('../models/Contract');
          moduleData = await Contract.findById(task.moduleId);
          if (moduleData) {
            title = `审批合同: ${moduleData.contractNumber || ''} - ${moduleData.title || ''}`.trim();
          }
        } else if (task.moduleType === 'opportunity' || task.moduleType === 'opportunities') {
          const Opportunity = require('../models/Opportunity');
          moduleData = await Opportunity.findById(task.moduleId);
          if (moduleData) {
            title = `审批商机: ${moduleData.name || ''}`.trim();
          }
        }
      } catch (e) {
        console.log(`  ⚠️  获取模块数据失败: ${e.message}`);
      }

      // 构建待办metadata
      let todoMetadata = {
        workflowInstanceId: task.instanceId,
        workflowTaskId: task.taskId,
        nodeInstanceId: task.nodeInstanceId,
      };

      // 检查流程实例的metadata中是否有钉钉审批信息
      const [instances] = await connection.execute(
        'SELECT metadata FROM workflow_instances WHERE id = ?',
        [task.instanceId]
      );

      if (instances.length > 0 && instances[0].metadata) {
        try {
          const instanceMetadata = typeof instances[0].metadata === 'string' 
            ? JSON.parse(instances[0].metadata) 
            : instances[0].metadata;
          
          if (instanceMetadata.dingTalkApproval && instanceMetadata.dingTalkApproval.processInstanceId) {
            todoMetadata.dingTalkProcessInstanceId = instanceMetadata.dingTalkApproval.processInstanceId;
            todoMetadata.dingTalkApproval = true;
            console.log(`  🔵 检测到钉钉审批: ${instanceMetadata.dingTalkApproval.processInstanceId}`);
          }
        } catch (e) {
          console.log(`  ⚠️  解析流程实例metadata失败: ${e.message}`);
        }
      }

      // 创建待办
      try {
        const createdTodo = await Todo.create({
          type: 'approval',
          moduleType: task.moduleType,
          moduleId: task.moduleId,
          title,
          description: task.nodeName || '审批待办',
          assigneeId: task.assigneeId,
          status: 'pending',
          priority: 'medium',
          metadata: todoMetadata,
          createdBy: task.initiatorId,
        });

        console.log(`  ✅ 已创建待办: todoId=${createdTodo.id}`);
        createdCount++;
      } catch (error) {
        console.error(`  ❌ 创建待办失败: ${error.message}`);
      }
    }

    console.log('\n==========================================');
    console.log('✅ 处理完成');
    console.log(`   创建: ${createdCount} 个待办`);
    console.log(`   跳过: ${skippedCount} 个（已存在）`);
    console.log('==========================================');

  } catch (error) {
    console.error('❌ 处理失败:', error);
    throw error;
  } finally {
    connection.release();
    pool.end();
  }
}

createMissingTodos()
  .then(() => {
    console.log('\n✅ 脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 脚本执行失败:', error);
    process.exit(1);
  });


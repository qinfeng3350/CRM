const { pool } = require('../config/database');
const WorkflowDefinition = require('../models/WorkflowDefinition');
const workflowEngine = require('../services/workflowEngine');

async function createTestWorkflowInstance() {
  const connection = await pool.getConnection();
  try {
    console.log('=== 创建完整的测试流程实例 ===\n');

    // 1. 查找用户"马志涛"
    const [users] = await connection.execute(
      'SELECT * FROM users WHERE name LIKE ? OR name = ?',
      ['%马志涛%', '马志涛']
    );
    
    if (users.length === 0) {
      console.error('❌ 未找到用户"马志涛"');
      return;
    }
    
    const user = users[0];
    console.log(`✅ 找到用户: ${user.name} (ID: ${user.id})\n`);

    // 2. 查找流程定义
    const [workflows] = await connection.execute(
      'SELECT * FROM workflow_definitions WHERE isActive = 1 LIMIT 1'
    );
    
    if (workflows.length === 0) {
      console.error('❌ 未找到启用的流程定义');
      return;
    }

    const workflow = workflows[0];
    console.log(`✅ 找到流程定义: ${workflow.name} (ID: ${workflow.id})\n`);

    // 3. 查找一个有效的模块ID
    const [contracts] = await connection.execute(
      'SELECT id FROM contracts ORDER BY id DESC LIMIT 1'
    );
    
    let moduleId = 1;
    if (contracts.length > 0) {
      moduleId = contracts[0].id;
    }

    // 4. 获取模块数据
    const [moduleData] = await connection.execute(
      'SELECT * FROM contracts WHERE id = ?',
      [moduleId]
    );

    const moduleDataObj = moduleData.length > 0 ? moduleData[0] : { id: moduleId };

    // 5. 使用流程引擎创建完整的流程实例
    console.log('5. 使用流程引擎创建流程实例...');
    console.log(`   流程定义ID: ${workflow.id}`);
    console.log(`   模块类型: contract`);
    console.log(`   模块ID: ${moduleId}`);
    console.log(`   发起人ID: ${user.id}\n`);

    const result = await workflowEngine.startWorkflow(
      workflow.id,
      'contract',
      moduleId,
      user.id,
      moduleDataObj
    );

    console.log('✅ 流程实例创建成功！');
    console.log(`   流程实例ID: ${result.instanceId}`);
    console.log('\n📝 现在可以使用以下命令测试审批回调：');
    console.log(`   node scripts/test-approval-callback.js`);
    console.log(`   或者修改 test-approval-callback.js 中的 businessId 为 ${result.instanceId}`);

  } catch (error) {
    console.error('❌ 创建失败:', error.message);
    console.error(error.stack);
  } finally {
    connection.release();
    process.exit(0);
  }
}

createTestWorkflowInstance();


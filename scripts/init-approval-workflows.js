const { pool } = require('../config/database');

const initApprovalWorkflows = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    console.log('开始初始化审批流程...');

    // 检查是否已有审批流程
    const [existing] = await connection.execute(
      'SELECT COUNT(*) as count FROM approval_workflows WHERE isActive = TRUE'
    );
    
    if (existing[0].count > 0) {
      console.log('审批流程已存在，跳过初始化');
      return;
    }

    // 创建合同审批流程（默认）
    const contractWorkflow = {
      name: '合同审批流程（默认）',
      moduleType: 'contract',
      conditions: JSON.stringify({
        minAmount: 0,
        maxAmount: null
      }),
      steps: JSON.stringify([
        {
          type: 'role',
          value: 'sales_manager',
          priority: 'high',
          required: true
        },
        {
          type: 'role',
          value: 'admin',
          priority: 'urgent',
          required: false
        }
      ]),
      isActive: true,
      priority: 1,
      createdBy: 1
    };

    await connection.execute(
      `INSERT INTO approval_workflows (name, moduleType, conditions, steps, isActive, priority, createdBy, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        contractWorkflow.name,
        contractWorkflow.moduleType,
        contractWorkflow.conditions,
        contractWorkflow.steps,
        contractWorkflow.isActive,
        contractWorkflow.priority,
        contractWorkflow.createdBy
      ]
    );
    console.log('✓ 创建合同审批流程');

    // 创建商机审批流程（默认）
    const opportunityWorkflow = {
      name: '商机审批流程（默认）',
      moduleType: 'opportunity',
      conditions: JSON.stringify({
        minAmount: 100000, // 10万以上需要审批
        maxAmount: null
      }),
      steps: JSON.stringify([
        {
          type: 'role',
          value: 'sales_manager',
          priority: 'high',
          required: true
        }
      ]),
      isActive: true,
      priority: 1,
      createdBy: 1
    };

    await connection.execute(
      `INSERT INTO approval_workflows (name, moduleType, conditions, steps, isActive, priority, createdBy, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        opportunityWorkflow.name,
        opportunityWorkflow.moduleType,
        opportunityWorkflow.conditions,
        opportunityWorkflow.steps,
        opportunityWorkflow.isActive,
        opportunityWorkflow.priority,
        opportunityWorkflow.createdBy
      ]
    );
    console.log('✓ 创建商机审批流程');

    console.log('✅ 审批流程初始化完成！');
  } catch (error) {
    console.error('❌ 初始化审批流程失败!', error);
    process.exit(1);
  } finally {
    if (connection) connection.release();
    pool.end();
  }
};

initApprovalWorkflows();


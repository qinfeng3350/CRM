const { pool } = require('../config/database');

const updateApprovalWorkflow = async () => {
  let connection;
  try {
    connection = await pool.getConnection();
    console.log('开始更新审批流程条件...');

    // 更新审批流程，使其匹配所有金额
    await connection.execute(
      'UPDATE approval_workflows SET conditions = ? WHERE id = 1',
      [JSON.stringify({ minAmount: 0, maxAmount: null })]
    );
    console.log('✓ 已更新审批流程条件');

    // 查看更新后的审批流程
    const [wf] = await connection.execute('SELECT * FROM approval_workflows WHERE id = 1');
    if (wf[0]) {
      const row = wf[0];
      console.log('更新后的审批流程:', {
        id: row.id,
        name: row.name,
        conditions: row.conditions ? (typeof row.conditions === 'string' ? JSON.parse(row.conditions) : row.conditions) : null
      });
    }

    console.log('✅ 审批流程更新完成！');
  } catch (error) {
    console.error('❌ 更新审批流程失败!', error);
    process.exit(1);
  } finally {
    if (connection) connection.release();
    pool.end();
  }
};

updateApprovalWorkflow();


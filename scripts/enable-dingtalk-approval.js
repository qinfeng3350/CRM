const { pool } = require('../config/database');

async function enableDingTalkApproval() {
  const connection = await pool.getConnection();
  try {
    console.log('开始启用钉钉审批功能...');

    // 检查字段是否存在
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'dingtalk_config' 
      AND COLUMN_NAME = 'dingtalkApprovalEnabled'
    `);
    
    if (columns.length === 0) {
      console.log('❌ dingtalkApprovalEnabled 字段不存在，请先运行 add-dingtalk-approval-enabled-field.js');
      return;
    }

    // 启用钉钉审批
    await connection.execute(`
      UPDATE dingtalk_config 
      SET dingtalkApprovalEnabled = 1 
      WHERE id = 1
    `);

    console.log('✅ 已启用钉钉审批功能');
    console.log('\n📝 说明：');
    console.log('   - 钉钉审批功能已启用');
    console.log('   - 审批流程将使用钉钉OA审批系统');
    console.log('   - 建议关闭"待办同步"功能，避免重复');
  } catch (error) {
    console.error('❌ 启用失败:', error.message);
    throw error;
  } finally {
    connection.release();
  }
}

enableDingTalkApproval()
  .then(() => {
    console.log('\n✅ 脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 脚本执行失败:', error);
    process.exit(1);
  });


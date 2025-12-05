const { pool } = require('../config/database');

async function updateProcessCode() {
  const connection = await pool.getConnection();
  try {
    // 这里填写你在钉钉开放平台创建的审批模板的 processCode
    // 如果还没有创建，请先在钉钉开放平台创建审批模板
    const processCode = 'YOUR_PROCESS_CODE'; // 替换为你的审批模板编码
    
    if (processCode === 'YOUR_PROCESS_CODE') {
      console.log('❌ 请先修改脚本中的 processCode 值');
      console.log('\n📝 如何获取 processCode：');
      console.log('   1. 登录钉钉开放平台：https://open.dingtalk.com/');
      console.log('   2. 进入你的应用 -> 工作流 -> 审批模板');
      console.log('   3. 创建或选择一个审批模板');
      console.log('   4. 在模板详情中获取 processCode');
      console.log('   5. 修改此脚本中的 processCode 值，然后重新运行');
      return;
    }

    // 检查字段是否存在
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'dingtalk_config' 
      AND COLUMN_NAME = 'approvalProcessCode'
    `);

    if (columns.length === 0) {
      console.log('❌ approvalProcessCode 字段不存在，请先运行 add-process-code-field.js');
      return;
    }

    // 更新 processCode
    await connection.execute(`
      UPDATE dingtalk_config 
      SET approvalProcessCode = ? 
      WHERE id = 1
    `, [processCode]);

    console.log('✅ 已更新 approvalProcessCode 为:', processCode);
  } catch (error) {
    console.error('❌ 更新失败:', error.message);
    throw error;
  } finally {
    connection.release();
  }
}

updateProcessCode()
  .then(() => {
    console.log('\n✅ 脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 脚本执行失败:', error);
    process.exit(1);
  });


const mysql = require('mysql2/promise');

async function addDingTalkApprovalEnabledField() {
  const connection = await mysql.createConnection({
    host: '39.106.142.253',
    port: 3306,
    database: 'crm',
    user: 'crm',
    password: 'crm123',
  });

  try {
    console.log('开始添加钉钉审批开关字段...');

    // 检查字段是否存在
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'crm' 
      AND TABLE_NAME = 'dingtalk_config' 
      AND COLUMN_NAME = 'dingtalkApprovalEnabled'
    `);
    
    if (columns.length === 0) {
      await connection.execute(`
        ALTER TABLE dingtalk_config 
        ADD COLUMN dingtalkApprovalEnabled TINYINT(1) DEFAULT 0 COMMENT '是否启用钉钉审批（三方流程对接钉钉OA，1-启用，0-停用）'
      `);
      console.log('✅ 已添加 dingtalkApprovalEnabled 字段');
    } else {
      console.log('⏭️  dingtalkApprovalEnabled 字段已存在，跳过...');
    }

    console.log('✅ 钉钉审批开关字段添加完成！');
  } catch (error) {
    console.error('❌ 添加字段失败:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

addDingTalkApprovalEnabledField()
  .then(() => {
    console.log('完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('执行失败:', error);
    process.exit(1);
  });


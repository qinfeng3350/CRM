const mysql = require('mysql2/promise');

async function addProcessCodeField() {
  const connection = await mysql.createConnection({
    host: '39.106.142.253',
    port: 3306,
    database: 'crm',
    user: 'crm',
    password: 'crm123',
  });

  try {
    console.log('开始添加审批模板编码字段...');

    // 检查字段是否存在
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'crm' 
      AND TABLE_NAME = 'dingtalk_config' 
      AND COLUMN_NAME = 'approvalProcessCode'
    `);
    
    if (columns.length === 0) {
      await connection.execute(`
        ALTER TABLE dingtalk_config 
        ADD COLUMN approvalProcessCode VARCHAR(255) DEFAULT NULL COMMENT '钉钉审批模板编码（processCode），需要在钉钉开放平台创建审批模板后获取'
      `);
      console.log('✅ 已添加 approvalProcessCode 字段');
    } else {
      console.log('⏭️  approvalProcessCode 字段已存在，跳过...');
    }

    console.log('✅ 审批模板编码字段添加完成！');
    console.log('\n📝 说明：');
    console.log('   1. 登录钉钉开放平台：https://open.dingtalk.com/');
    console.log('   2. 进入你的应用 -> 工作流 -> 创建审批模板');
    console.log('   3. 创建模板后，获取模板的 processCode');
    console.log('   4. 使用脚本更新 processCode：node scripts/update-process-code.js');
  } catch (error) {
    console.error('❌ 添加字段失败:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

addProcessCodeField()
  .then(() => {
    console.log('完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('执行失败:', error);
    process.exit(1);
  });


const mysql = require('mysql2/promise');

async function addTodoSyncEnabledField() {
  const connection = await mysql.createConnection({
    host: '39.106.142.253',
    port: 3306,
    database: 'crm',
    user: 'crm',
    password: 'crm123',
  });

  try {
    console.log('开始添加待办同步开关字段...');

    // 检查字段是否存在
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'crm' 
      AND TABLE_NAME = 'dingtalk_config' 
      AND COLUMN_NAME = 'todoSyncEnabled'
    `);
    
    if (columns.length === 0) {
      await connection.execute(`
        ALTER TABLE dingtalk_config 
        ADD COLUMN todoSyncEnabled TINYINT(1) DEFAULT 1 COMMENT '是否启用待办同步到钉钉（1-启用，0-停用）'
      `);
      console.log('✅ 已添加 todoSyncEnabled 字段');
    } else {
      console.log('⏭️  todoSyncEnabled 字段已存在，跳过...');
    }

    console.log('✅ 待办同步开关字段添加完成！');
  } catch (error) {
    console.error('❌ 添加字段失败:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

addTodoSyncEnabledField()
  .then(() => {
    console.log('完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('执行失败:', error);
    process.exit(1);
  });


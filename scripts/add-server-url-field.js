const { pool } = require('../config/database');

async function addServerUrlField() {
  const connection = await pool.getConnection();
  try {
    // 检查字段是否已存在
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'dingtalk_config' 
      AND COLUMN_NAME = 'serverUrl'
    `);

    if (columns.length === 0) {
      // 添加 serverUrl 字段
      await connection.execute(`
        ALTER TABLE dingtalk_config 
        ADD COLUMN serverUrl VARCHAR(500) DEFAULT NULL COMMENT '后端服务器地址（用于钉钉待办详情链接）' 
        AFTER frontendUrl
      `);
      console.log('✅ 已添加 serverUrl 字段到 dingtalk_config 表');
    } else {
      console.log('ℹ️  serverUrl 字段已存在，跳过添加');
    }

    // 提示用户配置
    console.log('\n📝 请配置后端服务器地址：');
    console.log('   如果后端在服务器上运行，设置为：http://39.106.142.253:3000');
    console.log('   如果后端在本地运行，需要：');
    console.log('     1. 将后端部署到服务器，或');
    console.log('     2. 使用内网穿透工具（如 ngrok、frp 等）');
    console.log('\n   配置方法：');
    console.log('   UPDATE dingtalk_config SET serverUrl = \'http://你的后端地址:端口\' WHERE id = 1;');
  } catch (error) {
    console.error('❌ 添加 serverUrl 字段失败:', error.message);
    throw error;
  } finally {
    connection.release();
  }
}

// 执行
addServerUrlField()
  .then(() => {
    console.log('\n✅ 脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 脚本执行失败:', error);
    process.exit(1);
  });


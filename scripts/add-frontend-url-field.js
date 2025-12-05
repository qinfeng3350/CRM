const { pool } = require('../config/database');

async function addFrontendUrlField() {
  const connection = await pool.getConnection();
  try {
    // 检查字段是否已存在
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'dingtalk_config' 
      AND COLUMN_NAME = 'frontendUrl'
    `);

    if (columns.length === 0) {
      // 添加 frontendUrl 字段
      await connection.execute(`
        ALTER TABLE dingtalk_config 
        ADD COLUMN frontendUrl VARCHAR(500) DEFAULT NULL COMMENT '前端地址（用于钉钉待办详情链接）' 
        AFTER callbackUrl
      `);
      console.log('✅ 已添加 frontendUrl 字段到 dingtalk_config 表');
    } else {
      console.log('ℹ️  frontendUrl 字段已存在，跳过添加');
    }

    // 如果 callbackUrl 存在且 frontendUrl 为空，尝试从 callbackUrl 推断 frontendUrl
    const [configs] = await connection.execute(`
      SELECT id, callbackUrl, frontendUrl 
      FROM dingtalk_config 
      WHERE frontendUrl IS NULL AND callbackUrl IS NOT NULL
      LIMIT 1
    `);

    if (configs.length > 0) {
      const config = configs[0];
      // 从 callbackUrl 提取基础URL（去掉 /auth/dingtalk/callback 部分）
      let frontendUrl = config.callbackUrl;
      if (frontendUrl.includes('/auth/dingtalk/callback')) {
        frontendUrl = frontendUrl.replace('/auth/dingtalk/callback', '');
      }
      
      // 如果还是 localhost，提示用户需要配置服务器地址
      if (frontendUrl.includes('localhost') || frontendUrl.includes('127.0.0.1')) {
        console.log('⚠️  检测到 callbackUrl 使用 localhost，请手动配置 frontendUrl 为服务器公网地址');
        console.log('   例如：http://39.106.142.253:5173 或 https://your-domain.com');
      } else {
        await connection.execute(`
          UPDATE dingtalk_config 
          SET frontendUrl = ? 
          WHERE id = ?
        `, [frontendUrl, config.id]);
        console.log(`✅ 已自动设置 frontendUrl: ${frontendUrl}`);
      }
    }
  } catch (error) {
    console.error('❌ 添加 frontendUrl 字段失败:', error.message);
    throw error;
  } finally {
    connection.release();
  }
}

// 执行
addFrontendUrlField()
  .then(() => {
    console.log('\n✅ 脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 脚本执行失败:', error);
    process.exit(1);
  });


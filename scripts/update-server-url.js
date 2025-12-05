const { pool } = require('../config/database');

async function updateServerUrl() {
  const connection = await pool.getConnection();
  try {
    // 使用HTTPS地址（更安全）
    // 注意：如果cpolar地址变化，需要重新更新此配置
    const serverUrl = 'https://3830bb74.r16.cpolar.top'; // 你的cpolar后端隧道地址
    
    // 检查 serverUrl 字段是否存在
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'dingtalk_config' 
      AND COLUMN_NAME = 'serverUrl'
    `);

    if (columns.length === 0) {
      console.log('❌ serverUrl 字段不存在，请先运行 add-server-url-field.js');
      return;
    }

    // 更新 serverUrl
    await connection.execute(`
      UPDATE dingtalk_config 
      SET serverUrl = ? 
      WHERE id = 1
    `, [serverUrl]);

    console.log('✅ 已更新 serverUrl 为:', serverUrl);
    console.log('\n📝 配置说明：');
    console.log('   - 后端服务地址（内网穿透）:', serverUrl);
    console.log('   - 本地地址: http://localhost:3000');
    console.log('   - 钉钉待办详情链接将使用:', serverUrl + '/api/dingtalk/todo/redirect/:todoId');
    console.log('\n⚠️  注意：');
    console.log('   - 确保内网穿透服务正在运行');
    console.log('   - 确保本地后端服务在 localhost:3000 运行');
    console.log('   - 如果内网穿透地址变化，需要重新更新此配置');
  } catch (error) {
    console.error('❌ 更新 serverUrl 失败:', error.message);
    throw error;
  } finally {
    connection.release();
  }
}

// 执行
updateServerUrl()
  .then(() => {
    console.log('\n✅ 脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 脚本执行失败:', error);
    process.exit(1);
  });


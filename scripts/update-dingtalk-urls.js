const { pool } = require('../config/database');

async function updateDingTalkUrls() {
  const connection = await pool.getConnection();
  try {
    // 新的前后端地址
    const serverUrl = 'https://38a3b1b5.r16.cpolar.top'; // 后端地址（使用HTTPS）
    const frontendUrl = 'https://3efb6dbe.r16.cpolar.top'; // 前端地址（使用HTTPS）
    
    console.log('🔄 开始更新钉钉配置中的前后端地址...');
    console.log(`   后端地址: ${serverUrl}`);
    console.log(`   前端地址: ${frontendUrl}`);
    
    // 检查字段是否存在
    const [serverUrlCols] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'dingtalk_config' 
      AND COLUMN_NAME = 'serverUrl'
    `);
    
    const [frontendUrlCols] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'dingtalk_config' 
      AND COLUMN_NAME = 'frontendUrl'
    `);
    
    if (serverUrlCols.length === 0) {
      console.log('❌ serverUrl 字段不存在，请先运行 add-server-url-field.js');
      return;
    }
    
    if (frontendUrlCols.length === 0) {
      console.log('❌ frontendUrl 字段不存在，请先运行 add-frontend-url-field.js');
      return;
    }
    
    // 更新配置
    await connection.execute(`
      UPDATE dingtalk_config 
      SET serverUrl = ?, 
          frontendUrl = ?,
          updatedAt = NOW()
      WHERE id = (SELECT id FROM (SELECT id FROM dingtalk_config LIMIT 1) AS tmp)
    `, [serverUrl, frontendUrl]);
    
    console.log('✅ 已更新钉钉配置中的前后端地址');
    console.log('   - 后端服务地址（内网穿透）:', serverUrl);
    console.log('   - 前端服务地址（内网穿透）:', frontendUrl);
    console.log('   - 钉钉待办详情链接将使用:', serverUrl + '/api/dingtalk/todo/redirect/:todoId');
    console.log('   - 钉钉审批回调地址将使用:', serverUrl + '/api/dingtalk/approval/callback');
    console.log('\n📝 重要提示：');
    console.log('   1. 请在钉钉开放平台更新以下配置：');
    console.log('      - 应用首页地址（移动端和PC端）:', frontendUrl);
    console.log('      - 端内免登地址:', frontendUrl);
    console.log('      - 重定向URL（回调域名）:', serverUrl + '/api/dingtalk/approval/callback');
    console.log('   2. 配置更新后，需要点击"应用发布"才能生效');
    console.log('   3. 配置发布后，需要等待10-30分钟才能生效');
    
  } catch (error) {
    console.error('❌ 更新配置失败:', error.message);
    console.error('   错误详情:', error);
  } finally {
    connection.release();
    process.exit(0);
  }
}

updateDingTalkUrls();


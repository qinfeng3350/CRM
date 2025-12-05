const mysql = require('mysql2/promise');
const { pool } = require('../config/database');

async function updateConfig() {
  const connection = await pool.getConnection();
  try {
    console.log('==========================================');
    console.log('🔄 更新钉钉完整配置...');
    console.log('==========================================\n');
    
    // 新的配置信息
    const newConfig = {
      appKey: 'ding124swyq8wwkmsyhl',
      appSecret: 'SNYj8EYTm913JPdtbsdeln_dmlzeBqLkGXVITByn6DQIeNubAFScH_KIXRXe0Yf5',
      qrLoginAppKey: 'ding124swyq8wwkmsyhl', // 统一使用同一个 AppKey
      qrLoginAppSecret: 'SNYj8EYTm913JPdtbsdeln_dmlzeBqLkGXVITByn6DQIeNubAFScH_KIXRXe0Yf5',
      agentId: '4111486068',
      corpId: 'ding26674f53165bacbb4ac5d6980864d335', // 新的 CorpId
      enabled: 1
    };
    
    console.log('📋 新配置信息：');
    console.log('   AppKey (Client ID):', newConfig.appKey);
    console.log('   AppSecret:', newConfig.appSecret.substring(0, 20) + '...');
    console.log('   AgentId:', newConfig.agentId);
    console.log('   CorpId:', newConfig.corpId);
    console.log('');
    
    // 检查配置是否存在
    const [existing] = await connection.execute('SELECT * FROM dingtalk_config LIMIT 1');
    
    if (existing.length === 0) {
      console.log('❌ 未找到钉钉配置，将创建新配置...\n');
      // 创建新配置
      await connection.execute(
        `INSERT INTO dingtalk_config 
         (appKey, appSecret, qrLoginAppKey, qrLoginAppSecret, agentId, corpId, enabled, createdAt, updatedAt) 
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          newConfig.appKey,
          newConfig.appSecret,
          newConfig.qrLoginAppKey,
          newConfig.qrLoginAppSecret,
          newConfig.agentId,
          newConfig.corpId,
          newConfig.enabled
        ]
      );
      console.log('✅ 已创建新配置');
    } else {
      console.log('📋 当前配置：');
      console.log('   AppKey:', existing[0].appKey || '(未配置)');
      console.log('   AgentId:', existing[0].agentId || '(未配置)');
      console.log('   CorpId:', existing[0].corpId || '(未配置)');
      console.log('');
      
      // 更新配置
      await connection.execute(
        `UPDATE dingtalk_config 
         SET appKey = ?,
             appSecret = ?,
             qrLoginAppKey = ?,
             qrLoginAppSecret = ?,
             agentId = ?,
             corpId = ?,
             enabled = ?,
             updatedAt = NOW() 
         WHERE id = ?`,
        [
          newConfig.appKey,
          newConfig.appSecret,
          newConfig.qrLoginAppKey,
          newConfig.qrLoginAppSecret,
          newConfig.agentId,
          newConfig.corpId,
          newConfig.enabled,
          existing[0].id
        ]
      );
      console.log('✅ 已更新配置');
    }
    
    // 验证更新
    console.log('\n==========================================');
    console.log('✅ 验证更新结果...');
    console.log('==========================================\n');
    
    const [updated] = await connection.execute('SELECT appKey, agentId, corpId FROM dingtalk_config LIMIT 1');
    if (updated.length > 0) {
      const config = updated[0];
      console.log('📋 更新后的配置：');
      console.log('   AppKey:', config.appKey);
      console.log('   AgentId:', config.agentId);
      console.log('   CorpId:', config.corpId);
      console.log('');
      
      if (config.appKey === newConfig.appKey && 
          config.agentId === newConfig.agentId && 
          config.corpId === newConfig.corpId) {
        console.log('✅ 验证成功：配置已正确更新');
      } else {
        console.error('❌ 验证失败：配置更新可能未成功');
      }
    }
    
    console.log('\n==========================================');
    console.log('📝 重要提示：');
    console.log('==========================================\n');
    console.log('1. 确保在钉钉开放平台的"网页应用"配置中：');
    console.log('   - 移动端首页地址：https://38a3b1b5.r16.cpolar.top');
    console.log('   - PC端首页地址：https://38a3b1b5.r16.cpolar.top');
    console.log('');
    console.log('2. 确保在"安全设置"中配置了：');
    console.log('   - 端内免登地址：https://38a3b1b5.r16.cpolar.top/login');
    console.log('   - 重定向URL：https://38a3b1b5.r16.cpolar.top/auth/dingtalk/callback');
    console.log('');
    console.log('3. 配置后必须点击"保存"和"应用发布"');
    console.log('');
    console.log('4. 发布后需要等待 10-30 分钟才能生效');
    console.log('');
    
  } catch (error) {
    console.error('❌ 操作失败:', error);
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

updateConfig()
  .then(() => {
    console.log('\n✅ 操作完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 操作失败:', error);
    process.exit(1);
  });


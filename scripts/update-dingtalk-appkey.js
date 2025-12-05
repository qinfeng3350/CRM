const mysql = require('mysql2/promise');
const { pool } = require('../config/database');

async function updateAppKey() {
  const connection = await pool.getConnection();
  try {
    // 更新 AppKey 和 AppSecret
    const appKey = 'ding124swyq8wwkmsyhl';
    const appSecret = 'SNYj8EYTm913JPdtbsdeln_dmlzeBqLkGXVITByn6DQIeNubAFScH_KIXRXe0Yf5';
    
    console.log('开始更新钉钉 AppKey...');
    console.log('AppKey:', appKey);
    console.log('AppSecret:', appSecret.substring(0, 20) + '...');
    
    // 检查配置是否存在
    const [existing] = await connection.execute('SELECT * FROM dingtalk_config LIMIT 1');
    
    if (existing.length === 0) {
      // 如果不存在，创建新配置
      await connection.execute(
        `INSERT INTO dingtalk_config 
         (appKey, appSecret, enabled, createdAt, updatedAt) 
         VALUES (?, ?, 1, NOW(), NOW())`,
        [appKey, appSecret]
      );
      console.log('✅ 已创建新配置');
    } else {
      // 如果存在，更新配置
      await connection.execute(
        `UPDATE dingtalk_config 
         SET appKey = ?, appSecret = ?, updatedAt = NOW() 
         WHERE id = ?`,
        [appKey, appSecret, existing[0].id]
      );
      console.log('✅ 已更新配置');
    }
    
    // 验证更新
    const [updated] = await connection.execute('SELECT appKey FROM dingtalk_config LIMIT 1');
    if (updated.length > 0 && updated[0].appKey === appKey) {
      console.log('✅ 验证成功：AppKey 已更新为:', appKey);
    } else {
      console.error('❌ 验证失败：AppKey 更新可能未成功');
    }
    
    console.log('\n📝 重要提示：');
    console.log('1. 确保在钉钉开放平台的"墨枫CRM"企业内部应用的"登录与分享"页面配置了回调域名：');
    console.log('   https://38a3b1b5.r16.cpolar.top/auth/dingtalk/callback');
    console.log('2. 配置后必须点击"应用发布"');
    console.log('3. 发布后可能需要等待几分钟才能生效');
    
  } catch (error) {
    console.error('❌ 更新失败:', error);
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

updateAppKey()
  .then(() => {
    console.log('\n✅ 更新完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 更新失败:', error);
    process.exit(1);
  });


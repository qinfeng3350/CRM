const mysql = require('mysql2/promise');
const { pool } = require('../config/database');

async function checkAndUpdateConfig() {
  const connection = await pool.getConnection();
  try {
    console.log('==========================================');
    console.log('🔍 检查钉钉配置...');
    console.log('==========================================\n');
    
    // 查询当前配置
    const [rows] = await connection.execute('SELECT * FROM dingtalk_config LIMIT 1');
    
    if (rows.length === 0) {
      console.log('❌ 未找到钉钉配置，将创建新配置...\n');
    } else {
      const config = rows[0];
      console.log('📋 当前配置：');
      console.log('   ID:', config.id);
      console.log('   enabled:', config.enabled);
      console.log('   appKey:', config.appKey || '(未配置)');
      console.log('   qrLoginAppKey:', config.qrLoginAppKey || '(未配置)');
      console.log('   corpId:', config.corpId || '(未配置)');
      console.log('   frontendUrl:', config.frontendUrl || '(未配置)');
      console.log('   serverUrl:', config.serverUrl || '(未配置)');
      console.log('');
    }
    
    // 更新配置
    const newAppKey = 'ding124swyq8wwkmsyhl';
    const newAppSecret = 'SNYj8EYTm913JPdtbsdeln_dmlzeBqLkGXVITByn6DQIeNubAFScH_KIXRXe0Yf5';
    
    console.log('==========================================');
    console.log('🔄 更新钉钉配置...');
    console.log('==========================================\n');
    console.log('新 AppKey:', newAppKey);
    console.log('新 AppSecret:', newAppSecret.substring(0, 20) + '...');
    console.log('');
    
    if (rows.length === 0) {
      // 创建新配置
      await connection.execute(
        `INSERT INTO dingtalk_config 
         (appKey, appSecret, qrLoginAppKey, qrLoginAppSecret, enabled, createdAt, updatedAt) 
         VALUES (?, ?, ?, ?, 1, NOW(), NOW())`,
        [newAppKey, newAppSecret, newAppKey, newAppSecret]
      );
      console.log('✅ 已创建新配置');
    } else {
      // 更新配置
      await connection.execute(
        `UPDATE dingtalk_config 
         SET appKey = ?, 
             appSecret = ?,
             qrLoginAppKey = ?,
             qrLoginAppSecret = ?,
             updatedAt = NOW() 
         WHERE id = ?`,
        [newAppKey, newAppSecret, newAppKey, newAppSecret, rows[0].id]
      );
      console.log('✅ 已更新配置');
    }
    
    // 验证更新
    console.log('\n==========================================');
    console.log('✅ 验证更新结果...');
    console.log('==========================================\n');
    
    const [updated] = await connection.execute('SELECT appKey, qrLoginAppKey FROM dingtalk_config LIMIT 1');
    if (updated.length > 0) {
      const config = updated[0];
      console.log('📋 更新后的配置：');
      console.log('   appKey:', config.appKey);
      console.log('   qrLoginAppKey:', config.qrLoginAppKey);
      console.log('');
      
      if (config.appKey === newAppKey && config.qrLoginAppKey === newAppKey) {
        console.log('✅ 验证成功：配置已正确更新');
      } else {
        console.error('❌ 验证失败：配置更新可能未成功');
      }
    }
    
    console.log('\n==========================================');
    console.log('📝 重要提示：');
    console.log('==========================================\n');
    console.log('1. 确保在钉钉开放平台的"墨枫CRM"应用中配置了：');
    console.log('   - 端内免登地址：https://38a3b1b5.r16.cpolar.top/login');
    console.log('   - 应用首页地址：https://38a3b1b5.r16.cpolar.top');
    console.log('   - 重定向URL：https://38a3b1b5.r16.cpolar.top/auth/dingtalk/callback');
    console.log('');
    console.log('2. 配置后必须点击"保存"和"应用发布"');
    console.log('');
    console.log('3. 发布后需要等待 10-30 分钟才能生效');
    console.log('');
    console.log('4. 如果使用的是扫码登录应用（AppKey: ding124swyq8wwkmsyhl），');
    console.log('   需要在扫码登录应用的配置页面配置回调域名');
    console.log('');
    
  } catch (error) {
    console.error('❌ 操作失败:', error);
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

checkAndUpdateConfig()
  .then(() => {
    console.log('\n✅ 操作完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 操作失败:', error);
    process.exit(1);
  });


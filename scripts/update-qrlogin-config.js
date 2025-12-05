const mysql = require('mysql2/promise');

async function updateQRLoginConfig() {
  const pool = mysql.createPool({
    host: 'localhost',
    port: 3306,
    database: 'crm',
    user: 'crm',
    password: 'crm123'
  });

  const conn = await pool.getConnection();
  try {
    // 检查配置是否存在
    const [rows] = await conn.execute('SELECT * FROM dingtalk_config LIMIT 1');
    
    if (rows.length === 0) {
      console.log('❌ 钉钉配置不存在，请先运行: npm run init-dingtalk');
      process.exit(1);
    }

    const config = rows[0];
    console.log('当前配置:');
    console.log(`  企业内部应用AppKey: ${config.appKey ? config.appKey.substring(0, 10) + '...' : '未设置'}`);
    console.log(`  扫码登录应用AppKey: ${config.qrLoginAppKey ? config.qrLoginAppKey.substring(0, 10) + '...' : '未设置'}`);

    // 更新扫码登录应用配置
    const qrLoginAppKey = 'dingqqsqf8zlp67zccaw';
    const qrLoginAppSecret = 'pK-DqWC1mPHtL9yr9aCY08lCUCBAfZNWM91jYgogNkEKBlQxahBPos0qnbyUEXe9';
    const corpId = 'ding989414ba5e7be680ffe93478753d9884';
    const agentId = '4109639870';

    await conn.execute(
      'UPDATE dingtalk_config SET qrLoginAppKey = ?, qrLoginAppSecret = ?, corpId = ?, agentId = ?, updatedAt = NOW() WHERE id = ?',
      [qrLoginAppKey, qrLoginAppSecret, corpId, agentId, config.id]
    );

    console.log('\n✅ 扫码登录应用配置已更新！');
    console.log(`  扫码登录应用AppKey: ${qrLoginAppKey.substring(0, 10)}...`);
    console.log(`  扫码登录应用AppSecret: ${qrLoginAppSecret.substring(0, 10)}...`);
    console.log('\n提示：');
    console.log('  1. 请确保在钉钉开放平台已配置回调域名');
    console.log('  2. 回调地址应该是: http://localhost:5173/auth/dingtalk/callback (开发环境)');
    console.log('  3. 在系统管理 -> 钉钉集成中启用配置后即可使用扫码登录');

  } catch (error) {
    console.error('❌ 更新配置失败:', error.message);
    process.exit(1);
  } finally {
    conn.release();
    await pool.end();
  }
}

updateQRLoginConfig();


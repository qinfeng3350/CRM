const mysql = require('mysql2/promise');

async function addQRLoginFields() {
  const pool = mysql.createPool({
    host: 'localhost',
    port: 3306,
    database: 'crm',
    user: 'crm',
    password: 'crm123'
  });

  const conn = await pool.getConnection();
  try {
    // 添加 qrLoginAppKey 字段
    try {
      await conn.execute(`
        ALTER TABLE \`dingtalk_config\` 
        ADD COLUMN \`qrLoginAppKey\` VARCHAR(255) COMMENT '扫码登录应用AppKey' AFTER \`appSecret\`
      `);
      console.log('✅ 已添加 qrLoginAppKey 字段');
    } catch (e) {
      if (e.message.includes('Duplicate column')) {
        console.log('✅ qrLoginAppKey 字段已存在');
      } else {
        throw e;
      }
    }

    // 添加 qrLoginAppSecret 字段
    try {
      await conn.execute(`
        ALTER TABLE \`dingtalk_config\` 
        ADD COLUMN \`qrLoginAppSecret\` VARCHAR(255) COMMENT '扫码登录应用AppSecret' AFTER \`qrLoginAppKey\`
      `);
      console.log('✅ 已添加 qrLoginAppSecret 字段');
    } catch (e) {
      if (e.message.includes('Duplicate column')) {
        console.log('✅ qrLoginAppSecret 字段已存在');
      } else {
        throw e;
      }
    }

    console.log('\n✅ 数据库表更新完成！');
  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  } finally {
    conn.release();
    await pool.end();
  }
}

addQRLoginFields();


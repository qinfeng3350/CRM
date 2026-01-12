const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME || 'crm',
  user: process.env.DB_USER || 'crm',
  password: process.env.DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  connectTimeout: 60000,
  idleTimeout: 300000,
  maxIdle: 10
});

const connectDB = async () => {
  try {
    const connection = await pool.getConnection();
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 3306;
    const database = process.env.DB_NAME || 'crm';
    const user = process.env.DB_USER || 'crm';
    console.log('\n==========================================');
    console.log('✅ MySQL数据库连接成功');
    console.log(`   主机: ${host}:${port}`);
    console.log(`   数据库: ${database}`);
    console.log(`   用户: ${user}`);
    console.log('==========================================');
    connection.release();
  } catch (error) {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 3306;
    const database = process.env.DB_NAME || 'crm';
    const user = process.env.DB_USER || 'crm';
    const hasPassword = process.env.DB_PASSWORD ? '已设置' : '未设置';
    
    console.error('\n❌ 数据库连接错误:', error.message);
    console.error('\n📋 当前配置信息:');
    console.error(`   主机: ${host}`);
    console.error(`   端口: ${port}`);
    console.error(`   数据库: ${database}`);
    console.error(`   用户: ${user}`);
    console.error(`   密码: ${hasPassword}`);
    console.error('\n🔍 请检查：');
    console.error('   1. .env 文件是否存在且配置正确');
    console.error('   2. 数据库密码是否正确');
    console.error('   3. 数据库用户是否有权限（如果是远程连接，需要允许从服务器IP访问）');
    console.error('   4. MySQL服务是否运行');
    console.error('\n💡 解决方案：');
    console.error('   如果使用宝塔本地数据库，确保：');
    console.error('   - DB_HOST=localhost');
    console.error('   - DB_PASSWORD=宝塔数据库密码');
    console.error('   如果使用远程数据库，需要：');
    console.error('   - 在MySQL中授权用户：GRANT ALL ON crm.* TO \'crm\'@\'服务器IP\' IDENTIFIED BY \'密码\';');
    // 在 Vercel 环境下不退出进程，让 serverless function 可以重试
    if (!process.env.VERCEL) {
      process.exit(1);
    }
    throw error; // 在 Vercel 环境下抛出错误，让调用者处理
  }
};

module.exports = { connectDB, pool };


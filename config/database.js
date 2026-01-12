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
    console.error('\n❌ 数据库连接错误:', error.message);
    console.error('   请检查：');
    console.error('   1. MySQL服务是否运行');
    console.error('   2. 数据库、用户名、密码是否正确');
    console.error('   3. 数据库用户是否有权限');
    // 在 Vercel 环境下不退出进程，让 serverless function 可以重试
    if (!process.env.VERCEL) {
      process.exit(1);
    }
    throw error; // 在 Vercel 环境下抛出错误，让调用者处理
  }
};

module.exports = { connectDB, pool };


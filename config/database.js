const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: '47.108.201.129', // 服务器地址（更新）
  port: 3306,
  database: 'mofengcrm',
  user: 'mofengcrm',
  password: 'mofengcrm',
  waitForConnections: true,
  connectionLimit: 20, // 增加连接池大小
  queueLimit: 0,
  enableKeepAlive: true, // 启用keep-alive
  keepAliveInitialDelay: 0, // 立即开始keep-alive
  connectTimeout: 60000, // 连接超时时间（60秒）
  idleTimeout: 300000, // 空闲连接超时（5分钟）
  maxIdle: 10 // 最大空闲连接数
});

const connectDB = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('\n==========================================');
    console.log('✅ MySQL数据库连接成功');
    console.log('   主机: 47.108.201.129:3306');
    console.log('   数据库: mofengcrm');
    console.log('   用户: mofengcrm');
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


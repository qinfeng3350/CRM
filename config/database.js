const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: '39.106.142.253', // 服务器地址
  port: 3306,
  database: 'crm',
  user: 'crm',
  password: 'crm123',
  waitForConnections: true,
  connectionLimit: 20, // 增加连接池大小
  queueLimit: 0,
  enableKeepAlive: true, // 启用keep-alive
  keepAliveInitialDelay: 0, // 立即开始keep-alive
  acquireTimeout: 60000, // 获取连接超时时间（60秒）
  timeout: 60000, // 查询超时时间（60秒）
  reconnect: true, // 自动重连
  idleTimeout: 300000, // 空闲连接超时（5分钟）
  maxIdle: 10 // 最大空闲连接数
});

const connectDB = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('\n==========================================');
    console.log('✅ MySQL数据库连接成功');
    console.log('   主机: 39.106.142.253:3306');
    console.log('   数据库: crm');
    console.log('   用户: crm');
    console.log('==========================================');
    connection.release();
  } catch (error) {
    console.error('\n❌ 数据库连接错误:', error.message);
    console.error('   请检查：');
    console.error('   1. MySQL服务是否运行');
    console.error('   2. 数据库、用户名、密码是否正确');
    console.error('   3. 数据库用户是否有权限');
    process.exit(1);
  }
};

module.exports = { connectDB, pool };


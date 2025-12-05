/**
 * 数据库初始化脚本
 * 创建数据库用户和初始数据
 * 运行: node scripts/setup-database.js
 */

const mongoose = require('mongoose');

const setupDatabase = async () => {
  // 先尝试无认证连接（用于创建用户）
  const adminURI = 'mongodb://localhost:27017/admin';
  
  console.log('正在连接MongoDB...');
  
  try {
    // 尝试连接（可能不需要认证）
    await mongoose.connect(adminURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
    });
    
    console.log('✅ 已连接到MongoDB\n');
    
    // 切换到admin数据库
    const adminDb = mongoose.connection.db.admin();
    
    // 检查用户是否已存在
    const users = await mongoose.connection.db.db('admin').collection('system.users').find({ user: 'crm' }).toArray();
    
    if (users.length > 0) {
      console.log('⚠️  用户 "crm" 已存在');
      console.log('   如果连接失败，请检查密码是否正确\n');
    } else {
      console.log('📝 用户 "crm" 不存在，需要创建');
      console.log('   请在MongoDB shell中执行以下命令创建用户:\n');
      console.log('   use admin');
      console.log('   db.createUser({');
      console.log('     user: "crm",');
      console.log('     pwd: "crm123",');
      console.log('     roles: [');
      console.log('       { role: "readWrite", db: "crm" },');
      console.log('       { role: "dbAdmin", db: "crm" }');
      console.log('     ]');
      console.log('   })\n');
    }
    
    // 切换到crm数据库
    const crmDb = mongoose.connection.useDb('crm');
    console.log('✅ 数据库 "crm" 已准备就绪\n');
    
    // 测试使用新用户连接
    await mongoose.disconnect();
    
    console.log('正在测试使用新用户连接...');
    const testURI = 'mongodb://crm:crm123@localhost:27017/crm';
    
    await mongoose.connect(testURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
    });
    
    console.log('✅ 使用用户 "crm" 连接成功！');
    console.log(`   数据库: ${mongoose.connection.name}`);
    console.log(`   主机: ${mongoose.connection.host}:${mongoose.connection.port}\n`);
    
    await mongoose.disconnect();
    console.log('✅ 数据库设置完成！\n');
    console.log('现在可以启动服务器: npm run dev');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ 连接失败:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.error('\nMongoDB服务未启动！');
      console.error('请先启动MongoDB服务:');
      console.error('  Windows: net start MongoDB');
      console.error('  Linux: sudo systemctl start mongod');
      console.error('  Mac: brew services start mongodb-community\n');
    } else if (error.message.includes('authentication failed')) {
      console.error('\n认证失败！');
      console.error('请按照上面的说明创建用户，或检查密码是否正确\n');
    }
    
    process.exit(1);
  }
};

setupDatabase();


const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');

async function initAdmin() {
  const connection = await pool.getConnection();
  try {
    // 检查是否已存在管理员
    const [existing] = await connection.execute(
      'SELECT * FROM users WHERE role = ? OR email = ?',
      ['admin', 'admin@crm.com']
    );

    if (existing.length > 0) {
      console.log('管理员账号已存在');
      if (existing[0].email === 'admin@crm.com') {
        console.log('管理员信息:');
        console.log('  邮箱: admin@crm.com');
        console.log('  密码: admin123');
        console.log('  角色: admin');
      }
      return;
    }

    // 创建管理员账号
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    const [result] = await connection.execute(
      `INSERT INTO users (username, email, password, name, role, department, level, phone, status, permissions, createdAt, updatedAt) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        'admin',
        'admin@crm.com',
        hashedPassword,
        '系统管理员',
        'admin',
        '管理部',
        10,
        '',
        'active',
        JSON.stringify(['all'])
      ]
    );

    console.log('✅ 管理员账号创建成功！');
    console.log('');
    console.log('登录信息:');
    console.log('  邮箱: admin@crm.com');
    console.log('  密码: admin123');
    console.log('  角色: admin');
    console.log('');
    console.log('⚠️  请登录后立即修改密码！');
  } catch (error) {
    console.error('❌ 创建管理员账号失败:', error.message);
  } finally {
    connection.release();
    process.exit(0);
  }
}

initAdmin();


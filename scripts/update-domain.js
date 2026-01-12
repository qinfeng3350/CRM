/**
 * 更新域名配置脚本
 * 用于更新数据库中的钉钉配置和系统配置中的域名
 * 运行: node scripts/update-domain.js
 */

const { pool } = require('../config/database');

// 新域名配置
const NEW_DOMAIN = 'https://crm.yunshangdingchuang.cn';
const FRONTEND_URL = NEW_DOMAIN;
const API_BASE_URL = `${NEW_DOMAIN}/api`;
const SERVER_URL = NEW_DOMAIN; // 后端和前端使用同一个域名

async function updateDomain() {
  const connection = await pool.getConnection();
  try {
    console.log('🔄 开始更新域名配置...');
    console.log(`   新域名: ${NEW_DOMAIN}`);
    console.log(`   前端地址: ${FRONTEND_URL}`);
    console.log(`   API地址: ${API_BASE_URL}`);
    console.log(`   后端地址: ${SERVER_URL}\n`);

    // 1. 检查并更新钉钉配置表
    console.log('1. 检查钉钉配置表...');
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'dingtalk_config'
    `);

    if (tables.length > 0) {
      console.log('   ✓ 钉钉配置表存在');

      // 检查字段是否存在
      const [columns] = await connection.execute(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'dingtalk_config'
      `);

      const columnNames = columns.map(col => col.COLUMN_NAME);
      const updates = [];
      const values = [];

      // 更新 callbackUrl
      if (columnNames.includes('callbackUrl')) {
        updates.push('callbackUrl = ?');
        values.push(`${FRONTEND_URL}/auth/dingtalk/callback`);
      }

      // 更新 frontendUrl
      if (columnNames.includes('frontendUrl')) {
        updates.push('frontendUrl = ?');
        values.push(FRONTEND_URL);
      }

      // 更新 serverUrl
      if (columnNames.includes('serverUrl')) {
        updates.push('serverUrl = ?');
        values.push(SERVER_URL);
      }

      if (updates.length > 0) {
        values.push(new Date());
        updates.push('updatedAt = ?');

        await connection.execute(`
          UPDATE dingtalk_config 
          SET ${updates.join(', ')}
          WHERE id = (SELECT id FROM (SELECT id FROM dingtalk_config LIMIT 1) AS tmp)
        `, values);

        console.log('   ✓ 钉钉配置已更新');
        console.log(`     - callbackUrl: ${FRONTEND_URL}/auth/dingtalk/callback`);
        if (columnNames.includes('frontendUrl')) {
          console.log(`     - frontendUrl: ${FRONTEND_URL}`);
        }
        if (columnNames.includes('serverUrl')) {
          console.log(`     - serverUrl: ${SERVER_URL}`);
        }
      } else {
        console.log('   ⚠️  钉钉配置表字段不完整，跳过更新');
      }
    } else {
      console.log('   ⚠️  钉钉配置表不存在，跳过更新');
    }

    console.log('\n✅ 域名配置更新完成！\n');

    console.log('📝 下一步操作：');
    console.log('1. 确保 .env 文件中的域名配置正确：');
    console.log(`   FRONTEND_URL=${FRONTEND_URL}`);
    console.log(`   API_BASE_URL=${API_BASE_URL}`);
    console.log(`   SERVER_URL=${SERVER_URL}`);
    console.log('\n2. 如果使用钉钉集成，请在钉钉开放平台更新回调地址：');
    console.log(`   ${FRONTEND_URL}/auth/dingtalk/callback`);
    console.log('\n3. 重启 PM2 服务使配置生效：');
    console.log('   pm2 restart crm-backend');

  } catch (error) {
    console.error('❌ 更新域名配置失败:', error.message);
    console.error(error.stack);
    throw error;
  } finally {
    connection.release();
  }
}

// 执行
updateDomain()
  .then(() => {
    console.log('\n✅ 脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 脚本执行失败:', error);
    process.exit(1);
  });

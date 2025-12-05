const mysql = require('mysql2/promise');

// 使用与项目相同的数据库配置
const dbConfig = {
  host: 'localhost',
  port: 3306,
  user: 'crm',
  password: 'crm123',
  database: 'crm',
  multipleStatements: true,
};

// 要添加的字段列表
const fieldsToAdd = [
  { name: 'unionid', type: 'VARCHAR(255)', comment: '用户的unionId' },
  { name: 'position', type: 'VARCHAR(255)', comment: '职位' },
  { name: 'jobnumber', type: 'VARCHAR(100)', comment: '工号' },
  { name: 'hired_date', type: 'BIGINT', comment: '入职时间（时间戳）' },
  { name: 'work_place', type: 'VARCHAR(255)', comment: '工作地点' },
  { name: 'remark', type: 'VARCHAR(500)', comment: '备注' },
  { name: 'manager_userid', type: 'VARCHAR(255)', comment: '主管用户ID' },
  { name: 'is_admin', type: 'TINYINT(1) DEFAULT 0', comment: '是否管理员' },
  { name: 'is_boss', type: 'TINYINT(1) DEFAULT 0', comment: '是否老板' },
  { name: 'is_leader_in_depts', type: 'JSON', comment: '是否部门主管（JSON格式：{部门ID: true/false}）' },
  { name: 'order_in_depts', type: 'JSON', comment: '部门排序（JSON格式：{部门ID: 排序值}）' },
  { name: 'active', type: 'TINYINT(1) DEFAULT 1', comment: '是否激活' },
  { name: 'real_authed', type: 'TINYINT(1) DEFAULT 0', comment: '是否实名认证' },
  { name: 'org_email', type: 'VARCHAR(255)', comment: '企业邮箱' },
  { name: 'org_email_type', type: 'VARCHAR(50)', comment: '企业邮箱类型' },
  { name: 'state_code', type: 'VARCHAR(10)', comment: '国家代码' },
  { name: 'telephone', type: 'VARCHAR(50)', comment: '座机' },
  { name: 'extattr', type: 'JSON', comment: '扩展属性（JSON格式）' },
  { name: 'senior', type: 'TINYINT(1) DEFAULT 0', comment: '是否高管' },
  { name: 'hide_mobile', type: 'TINYINT(1) DEFAULT 0', comment: '是否隐藏手机号' },
  { name: 'exclusive_account', type: 'TINYINT(1) DEFAULT 0', comment: '是否专属账号' },
  { name: 'login_id', type: 'VARCHAR(255)', comment: '登录ID' },
  { name: 'exclusive_account_type', type: 'VARCHAR(50)', comment: '专属账号类型' },
  { name: 'title', type: 'VARCHAR(255)', comment: '职位头衔' },
  { name: 'dept_order_list', type: 'JSON', comment: '部门排序列表（JSON格式）' },
  { name: 'userid', type: 'VARCHAR(255)', comment: '用户ID（与dingTalkUserId相同，用于兼容）' },
];

// 要添加的索引列表
const indexesToAdd = [
  { name: 'idx_unionid', column: 'unionid' },
  { name: 'idx_manager_userid', column: 'manager_userid' },
  { name: 'idx_jobnumber', column: 'jobnumber' },
];

async function checkColumnExists(connection, tableName, columnName) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) as count 
     FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [dbConfig.database, tableName, columnName]
  );
  return rows[0].count > 0;
}

async function checkIndexExists(connection, tableName, indexName) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) as count 
     FROM INFORMATION_SCHEMA.STATISTICS 
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [dbConfig.database, tableName, indexName]
  );
  return rows[0].count > 0;
}

async function addFields() {
  let connection;
  try {
    console.log('========== 开始添加钉钉用户字段 ==========');
    connection = await mysql.createConnection(dbConfig);
    
    const tableName = 'dingtalk_users';
    
    // 添加字段
    console.log('\n步骤1: 检查并添加字段...');
    for (const field of fieldsToAdd) {
      const exists = await checkColumnExists(connection, tableName, field.name);
      if (exists) {
        console.log(`  ⚠️  字段 ${field.name} 已存在，跳过`);
      } else {
        try {
          const sql = `ALTER TABLE ${tableName} 
                       ADD COLUMN \`${field.name}\` ${field.type} 
                       COMMENT '${field.comment}'`;
          await connection.execute(sql);
          console.log(`  ✅ 已添加字段: ${field.name}`);
        } catch (error) {
          console.error(`  ❌ 添加字段 ${field.name} 失败:`, error.message);
        }
      }
    }
    
    // 添加索引
    console.log('\n步骤2: 检查并添加索引...');
    for (const index of indexesToAdd) {
      const exists = await checkIndexExists(connection, tableName, index.name);
      if (exists) {
        console.log(`  ⚠️  索引 ${index.name} 已存在，跳过`);
      } else {
        try {
          const sql = `CREATE INDEX ${index.name} ON ${tableName} (\`${index.column}\`)`;
          await connection.execute(sql);
          console.log(`  ✅ 已添加索引: ${index.name} (${index.column})`);
        } catch (error) {
          console.error(`  ❌ 添加索引 ${index.name} 失败:`, error.message);
        }
      }
    }
    
    console.log('\n========== 完成 ==========');
    console.log('✅ 所有字段和索引已添加完成');
    
  } catch (error) {
    console.error('❌ 执行失败:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

addFields();


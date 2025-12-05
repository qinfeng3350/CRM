const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// 服务器数据库配置
const serverConfig = {
  host: '39.106.142.253',
  port: 3306,
  database: 'crm',
  user: 'crm',
  password: 'crm123',
  multipleStatements: true,
  connectTimeout: 60000,
};

// SQL文件路径（优先使用修复后的服务器版本）
const sqlFile = path.join(__dirname, '..', 'MySQL', 'crm_export_server.sql');

console.log('==========================================');
console.log('清空并重新导入数据库到服务器...');
console.log('==========================================\n');

async function clearAndImport() {
  let connection;
  try {
    // 连接数据库
    console.log('正在连接服务器数据库...');
    connection = await mysql.createConnection(serverConfig);
    console.log('✅ 数据库连接成功\n');

    // 选择数据库
    await connection.query(`USE \`${serverConfig.database}\``);
    console.log('✅ 已选择数据库\n');

    // 获取所有表
    console.log('正在获取所有表...');
    const [tables] = await connection.query('SHOW TABLES');
    const tableNames = tables.map(row => Object.values(row)[0]);
    console.log(`找到 ${tableNames.length} 个表\n`);

    if (tableNames.length > 0) {
      console.log('正在清空数据库（删除所有表）...');
      // 禁用外键检查
      await connection.query('SET FOREIGN_KEY_CHECKS = 0');
      
      // 删除所有表
      for (const tableName of tableNames) {
        try {
          await connection.query(`DROP TABLE IF EXISTS \`${tableName}\``);
          console.log(`  ✅ 删除表: ${tableName}`);
        } catch (error) {
          console.log(`  ⚠️  删除表 ${tableName} 失败:`, error.message);
        }
      }
      
      // 重新启用外键检查
      await connection.query('SET FOREIGN_KEY_CHECKS = 1');
      console.log('✅ 数据库已清空\n');
    } else {
      console.log('数据库为空，无需清空\n');
    }

    // 读取SQL文件
    console.log('正在读取SQL文件...');
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');
    console.log(`✅ SQL文件读取成功，大小: ${(sqlContent.length / 1024).toFixed(2)} KB\n`);

    // 执行SQL文件
    console.log('开始导入SQL文件...');
    console.log('（这可能需要几分钟，请耐心等待...）\n');
    
    // 智能分割SQL语句
    const statements = [];
    let currentStatement = '';
    let inString = false;
    let stringChar = '';
    let inComment = false;
    
    for (let i = 0; i < sqlContent.length; i++) {
      const char = sqlContent[i];
      const nextChar = sqlContent[i + 1];
      
      // 处理注释
      if (!inString && char === '-' && nextChar === '-') {
        // 单行注释，跳过到行尾
        while (i < sqlContent.length && sqlContent[i] !== '\n') {
          i++;
        }
        continue;
      }
      
      if (!inString && char === '/' && nextChar === '*') {
        inComment = true;
        i++;
        continue;
      }
      
      if (inComment && char === '*' && nextChar === '/') {
        inComment = false;
        i++;
        continue;
      }
      
      if (inComment) continue;
      
      // 处理字符串
      if (!inString && (char === '"' || char === "'" || char === '`')) {
        inString = true;
        stringChar = char;
        currentStatement += char;
      } else if (inString && char === stringChar) {
        // 检查是否是转义的引号
        if (sqlContent[i - 1] !== '\\' || (i > 1 && sqlContent[i - 2] === '\\')) {
          inString = false;
          stringChar = '';
        }
        currentStatement += char;
      } else if (!inString && char === ';') {
        const trimmed = currentStatement.trim();
        if (trimmed && trimmed.length > 0) {
          statements.push(trimmed);
        }
        currentStatement = '';
      } else {
        currentStatement += char;
      }
    }
    
    // 添加最后一条语句
    if (currentStatement.trim()) {
      statements.push(currentStatement.trim());
    }
    
    console.log(`解析完成，共 ${statements.length} 条SQL语句\n`);
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      if (!statement || statement.trim().length === 0) {
        continue;
      }

      try {
        await connection.query(statement);
        successCount++;
        
        if ((i + 1) % 20 === 0) {
          process.stdout.write(`\r进度: ${i + 1}/${statements.length} (成功: ${successCount}, 失败: ${errorCount})`);
        }
      } catch (error) {
        errorCount++;
        errors.push({
          index: i + 1,
          error: error.message,
          statement: statement.substring(0, 100)
        });
        
        // 只显示前5个错误
        if (errors.length <= 5) {
          console.error(`\n⚠️  第 ${i + 1} 条语句执行失败:`, error.message.substring(0, 100));
        }
      }
    }
    
    console.log('\n\n==========================================');
    console.log('导入完成！');
    console.log('==========================================');
    console.log(`总语句数: ${statements.length}`);
    console.log(`成功: ${successCount}`);
    console.log(`失败: ${errorCount}`);
    console.log('==========================================\n');

    // 验证导入结果
    console.log('正在验证导入结果...');
    const [tablesAfter] = await connection.query('SHOW TABLES');
    const tableCount = tablesAfter.length;
    console.log(`✅ 数据库中共有 ${tableCount} 个表\n`);

    // 检查一些关键表的数据
    const keyTables = ['users', 'customers', 'departments', 'dingtalk_config'];
    console.log('关键表数据统计:');
    for (const table of keyTables) {
      try {
        const [rows] = await connection.query(`SELECT COUNT(*) as count FROM \`${table}\``);
        console.log(`  ${table}: ${rows[0].count} 条记录`);
      } catch (error) {
        console.log(`  ${table}: 表不存在或查询失败`);
      }
    }

    console.log('\n==========================================');
    console.log('✅ 数据库导入完成！');
    console.log('==========================================\n');

  } catch (error) {
    console.error('\n❌ 操作失败:', error.message);
    console.error('错误详情:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('✅ 数据库连接已关闭');
    }
  }
}

// 执行
clearAndImport();


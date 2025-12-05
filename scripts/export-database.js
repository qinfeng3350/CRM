const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// 数据库配置
const dbConfig = {
  host: 'localhost',
  port: 3306,
  database: 'crm',
  user: 'crm',
  password: 'crm123'
};

// 导出目录
const exportDir = path.join(__dirname, '..', 'MySQL');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const sqlFile = path.join(exportDir, `crm_export_${timestamp}.sql`);

async function exportDatabase() {
  let connection;
  try {
    console.log('==========================================');
    console.log('开始导出数据库...');
    console.log('数据库:', dbConfig.database);
    console.log('==========================================\n');

    // 创建导出目录
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
      console.log('✅ 创建导出目录:', exportDir);
    }

    // 连接数据库
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功\n');

    // 获取所有表
    const [tables] = await connection.execute('SHOW TABLES');
    const tableNames = tables.map(row => Object.values(row)[0]);
    console.log(`找到 ${tableNames.length} 个表:`, tableNames.join(', '));
    console.log('');

    // 开始写入SQL文件
    const writeStream = fs.createWriteStream(sqlFile, { encoding: 'utf8' });
    
    // 写入文件头
    writeStream.write(`-- MySQL数据库导出\n`);
    writeStream.write(`-- 数据库: ${dbConfig.database}\n`);
    writeStream.write(`-- 导出时间: ${new Date().toLocaleString('zh-CN')}\n`);
    writeStream.write(`-- 导出工具: Node.js脚本\n\n`);
    writeStream.write(`SET NAMES utf8mb4;\n`);
    writeStream.write(`SET FOREIGN_KEY_CHECKS = 0;\n\n`);
    writeStream.write(`-- ----------------------------\n`);
    writeStream.write(`-- 数据库: ${dbConfig.database}\n`);
    writeStream.write(`-- ----------------------------\n\n`);
    writeStream.write(`USE \`${dbConfig.database}\`;\n\n`);

    // 导出每个表
    for (const tableName of tableNames) {
      console.log(`正在导出表: ${tableName}...`);
      
      // 获取表结构
      const [createTable] = await connection.execute(`SHOW CREATE TABLE \`${tableName}\``);
      const createTableSQL = createTable[0]['Create Table'];
      
      writeStream.write(`-- ----------------------------\n`);
      writeStream.write(`-- 表结构: ${tableName}\n`);
      writeStream.write(`-- ----------------------------\n`);
      writeStream.write(`DROP TABLE IF EXISTS \`${tableName}\`;\n`);
      writeStream.write(`${createTableSQL};\n\n`);
      
      // 获取表数据
      const [rows] = await connection.execute(`SELECT * FROM \`${tableName}\``);
      
      if (rows.length > 0) {
        writeStream.write(`-- ----------------------------\n`);
        writeStream.write(`-- 表数据: ${tableName} (${rows.length} 条记录)\n`);
        writeStream.write(`-- ----------------------------\n`);
        
        // 获取列名
        const [columns] = await connection.execute(`SHOW COLUMNS FROM \`${tableName}\``);
        const columnNames = columns.map(col => `\`${col.Field}\``).join(', ');
        
        // 写入INSERT语句
        for (const row of rows) {
          const values = columns.map(col => {
            const value = row[col.Field];
            if (value === null || value === undefined) {
              return 'NULL';
            } else if (typeof value === 'string') {
              // 转义单引号和反斜杠
              const escaped = value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r');
              return `'${escaped}'`;
            } else if (typeof value === 'number') {
              return value;
            } else if (typeof value === 'boolean') {
              return value ? 1 : 0;
            } else if (value instanceof Date) {
              return `'${value.toISOString().slice(0, 19).replace('T', ' ')}'`;
            } else if (Buffer.isBuffer(value)) {
              return `0x${value.toString('hex')}`;
            } else if (typeof value === 'object') {
              // 处理JSON对象和数组，序列化为JSON字符串
              try {
                const jsonStr = JSON.stringify(value);
                // 转义JSON字符串中的特殊字符
                const escaped = jsonStr.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
                return `'${escaped}'`;
              } catch (e) {
                // 如果序列化失败，返回NULL
                console.warn(`  ⚠️  警告: 表 ${tableName} 的字段 ${col.Field} 的值无法序列化为JSON，使用NULL`);
                return 'NULL';
              }
            } else {
              // 其他类型转换为字符串
              const str = String(value);
              const escaped = str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
              return `'${escaped}'`;
            }
          }).join(', ');
          
          writeStream.write(`INSERT INTO \`${tableName}\` (${columnNames}) VALUES (${values});\n`);
        }
        writeStream.write(`\n`);
        console.log(`  ✅ 导出 ${rows.length} 条记录`);
      } else {
        console.log(`  ⚠️  表为空，跳过数据导出`);
      }
    }

    // 写入文件尾
    writeStream.write(`SET FOREIGN_KEY_CHECKS = 1;\n`);
    writeStream.end();

    // 等待写入完成
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    const fileSize = (fs.statSync(sqlFile).size / 1024).toFixed(2);
    console.log('\n==========================================');
    console.log('✅ 数据库导出完成！');
    console.log('==========================================');
    console.log(`文件路径: ${sqlFile}`);
    console.log(`文件大小: ${fileSize} KB`);
    console.log(`表数量: ${tableNames.length}`);
    console.log('==========================================\n');
    console.log('💡 提示：');
    console.log('   1. 可以在宝塔面板的"数据库" -> "导入"中上传此SQL文件');
    console.log('   2. 或者使用命令行: mysql -u用户名 -p数据库名 < 文件名.sql');
    console.log('   3. 导入前请确保目标数据库已创建');
    console.log('');

  } catch (error) {
    console.error('\n❌ 导出失败:', error.message);
    console.error('错误详情:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// 执行导出
exportDatabase();


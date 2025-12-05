/**
 * 导入流程引擎数据库表结构
 * 运行: node scripts/import-workflow-engine.js
 */

const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

const importWorkflowEngine = async () => {
  let connection;
  try {
    console.log('\n==========================================');
    console.log('开始导入流程引擎数据库表结构...');
    console.log('==========================================\n');

    // 获取数据库连接
    connection = await pool.getConnection();
    console.log('✅ 数据库连接成功\n');

    // 读取SQL文件
    const sqlFilePath = path.join(__dirname, '..', 'database_workflow_engine.sql');
    
    if (!fs.existsSync(sqlFilePath)) {
      throw new Error(`SQL文件不存在: ${sqlFilePath}`);
    }

    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    console.log('✅ SQL文件读取成功\n');

    // 分割SQL语句
    // 先移除单行注释
    let cleanSql = sqlContent.replace(/--.*$/gm, '');
    
    // 移除多行注释
    cleanSql = cleanSql.replace(/\/\*[\s\S]*?\*\//g, '');
    
    // 按分号分割，但要注意字符串中的分号
    const statements = [];
    let currentStatement = '';
    let inString = false;
    let stringChar = '';
    
    for (let i = 0; i < cleanSql.length; i++) {
      const char = cleanSql[i];
      const nextChar = cleanSql[i + 1];
      
      if (!inString && (char === '"' || char === "'" || char === '`')) {
        inString = true;
        stringChar = char;
        currentStatement += char;
      } else if (inString && char === stringChar && cleanSql[i - 1] !== '\\') {
        inString = false;
        stringChar = '';
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
    
    // 添加最后一条语句（如果没有分号结尾）
    const lastTrimmed = currentStatement.trim();
    if (lastTrimmed && lastTrimmed.length > 0) {
      statements.push(lastTrimmed);
    }
    
    // 过滤空语句
    const filteredStatements = statements.filter(stmt => {
      const trimmed = stmt.trim();
      return trimmed && trimmed.length > 10; // 至少10个字符才认为是有效语句
    });

    console.log(`找到 ${filteredStatements.length} 条SQL语句\n`);

    // 逐条执行SQL语句
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (let i = 0; i < filteredStatements.length; i++) {
      const statement = filteredStatements[i];
      
      // 跳过只包含注释或空白的语句
      if (!statement || statement.match(/^[\s-]*$/)) {
        continue;
      }

      try {
        // 处理MySQL的特殊语法（如IF NOT EXISTS等）
        // 对于ALTER TABLE ADD COLUMN IF NOT EXISTS，需要特殊处理
        let finalStatement = statement;

        // 处理 ALTER TABLE ... ADD COLUMN（检查列是否存在）
        if (statement.toUpperCase().includes('ADD COLUMN')) {
          // 提取表名和所有要添加的列
          const tableMatch = statement.match(/ALTER TABLE\s+`?(\w+)`?/i);
          if (tableMatch) {
            const tableName = tableMatch[1];
            
            // 提取所有ADD COLUMN语句
            const columnMatches = statement.matchAll(/ADD\s+COLUMN\s+`?(\w+)`?\s+([^,]+?)(?=,\s*ADD|$)/gi);
            const columnsToAdd = [];
            
            for (const match of columnMatches) {
              const columnName = match[1];
              const columnDef = match[2].trim();
              
              // 检查列是否存在
              const [columns] = await connection.execute(
                `SELECT COUNT(*) as count 
                 FROM INFORMATION_SCHEMA.COLUMNS 
                 WHERE TABLE_SCHEMA = DATABASE() 
                 AND TABLE_NAME = ? 
                 AND COLUMN_NAME = ?`,
                [tableName, columnName]
              );

              if (columns[0].count === 0) {
                columnsToAdd.push({ name: columnName, def: columnDef });
              } else {
                console.log(`  ⊙ 表 ${tableName} 的列 ${columnName} 已存在，跳过`);
              }
            }
            
            // 如果有需要添加的列，执行ALTER TABLE
            if (columnsToAdd.length > 0) {
              const alterStatements = columnsToAdd.map(col => 
                `ADD COLUMN \`${col.name}\` ${col.def}`
              );
              const alterSql = `ALTER TABLE \`${tableName}\` ${alterStatements.join(', ')}`;
              await connection.execute(alterSql);
              console.log(`  ✓ 表 ${tableName} 添加了 ${columnsToAdd.length} 个列`);
            }
            
            successCount++;
            continue;
          }
        }

        // 处理 ADD INDEX（检查索引是否存在）
        if (statement.toUpperCase().includes('ADD INDEX')) {
          const tableMatch = statement.match(/ALTER TABLE\s+`?(\w+)`?/i);
          if (tableMatch) {
            const tableName = tableMatch[1];
            
            // 提取所有ADD INDEX语句
            const indexMatches = statement.matchAll(/ADD\s+INDEX\s+`?(\w+)`?\s*\([^)]+\)/gi);
            const indexesToAdd = [];
            
            for (const match of indexMatches) {
              const indexName = match[1];
              const fullMatch = match[0];
              
              // 检查索引是否存在
              const [indexes] = await connection.execute(
                `SELECT COUNT(*) as count 
                 FROM INFORMATION_SCHEMA.STATISTICS 
                 WHERE TABLE_SCHEMA = DATABASE() 
                 AND TABLE_NAME = ? 
                 AND INDEX_NAME = ?`,
                [tableName, indexName]
              );

              if (indexes[0].count === 0) {
                indexesToAdd.push(fullMatch);
              } else {
                console.log(`  ⊙ 表 ${tableName} 的索引 ${indexName} 已存在，跳过`);
              }
            }
            
            // 如果有需要添加的索引，执行ALTER TABLE
            if (indexesToAdd.length > 0) {
              const alterSql = `ALTER TABLE \`${tableName}\` ${indexesToAdd.join(', ')}`;
              await connection.execute(alterSql);
              console.log(`  ✓ 表 ${tableName} 添加了 ${indexesToAdd.length} 个索引`);
            }
            
            successCount++;
            continue;
          }
        }

        // 执行普通SQL语句
        await connection.execute(finalStatement);
        
        // 显示执行的语句类型
        if (finalStatement.toUpperCase().startsWith('CREATE TABLE')) {
          const match = finalStatement.match(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?`?(\w+)`?/i);
          if (match) {
            console.log(`  ✓ 创建表: ${match[1]}`);
          }
        } else if (finalStatement.toUpperCase().startsWith('ALTER TABLE')) {
          const match = finalStatement.match(/ALTER TABLE\s+`?(\w+)`?/i);
          if (match) {
            console.log(`  ✓ 修改表: ${match[1]}`);
          }
        } else {
          console.log(`  ✓ 执行SQL语句 ${i + 1}`);
        }
        
        successCount++;
      } catch (error) {
        errorCount++;
        const errorMsg = `执行SQL语句 ${i + 1} 失败: ${error.message}`;
        errors.push({ statement: i + 1, error: errorMsg });
        console.error(`  ✗ ${errorMsg}`);
        
        // 如果是表已存在的错误，可以忽略
        if (error.message.includes('already exists') || 
            error.message.includes('Duplicate table')) {
          console.log(`    (表已存在，可忽略)`);
          successCount++;
          errorCount--;
        } else if (error.message.includes('Duplicate column') ||
                   error.message.includes('Duplicate key')) {
          console.log(`    (列/索引已存在，可忽略)`);
          successCount++;
          errorCount--;
        }
      }
    }

    console.log('\n==========================================');
    console.log('导入完成！');
    console.log('==========================================');
    console.log(`成功: ${successCount} 条`);
    console.log(`失败: ${errorCount} 条`);

    if (errors.length > 0 && errorCount > 0) {
      console.log('\n错误详情:');
      errors.forEach(err => {
        console.log(`  语句 ${err.statement}: ${err.error}`);
      });
    }

    console.log('\n✅ 流程引擎数据库表结构导入完成！\n');
    console.log('现在可以使用流程引擎功能了：');
    console.log('  - 创建流程定义: POST /api/workflows/definitions');
    console.log('  - 启动流程: POST /api/workflows/start');
    console.log('  - 处理审批: POST /api/workflows/tasks/{taskId}/handle\n');

  } catch (error) {
    console.error('\n❌ 导入失败:', error.message);
    console.error('错误堆栈:', error.stack);
    process.exit(1);
  } finally {
    if (connection) {
      connection.release();
    }
    await pool.end();
    process.exit(0);
  }
};

// 运行导入
importWorkflowEngine();


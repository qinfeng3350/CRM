const { pool } = require('../config/database');
const fs = require('fs');
const path = require('path');

async function addRejectedStatus() {
  const connection = await pool.getConnection();
  try {
    console.log('开始添加 rejected 状态...');
    
    // 读取 SQL 文件
    const sqlFile = path.join(__dirname, 'add-rejected-status.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    // 分割 SQL 语句（按分号分割，但要注意字符串中的分号和注释）
    // 先移除单行注释
    let cleanedSql = sql.replace(/--.*$/gm, '');
    // 移除多行注释
    cleanedSql = cleanedSql.replace(/\/\*[\s\S]*?\*\//g, '');
    // 按分号分割
    const statements = cleanedSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    console.log(`找到 ${statements.length} 条 SQL 语句`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          console.log(`执行第 ${i + 1} 条语句...`);
          await connection.execute(statement);
          console.log(`✅ 第 ${i + 1} 条语句执行成功`);
        } catch (error) {
          // 如果错误是"列不存在"或"表不存在"，跳过
          if (error.code === 'ER_BAD_FIELD_ERROR' || error.code === 'ER_NO_SUCH_TABLE') {
            console.log(`⚠️  第 ${i + 1} 条语句跳过: ${error.message}`);
          } else {
            console.error(`❌ 第 ${i + 1} 条语句执行失败:`, error.message);
            throw error;
          }
        }
      }
    }
    
    console.log('\n✅ 所有 SQL 语句执行完成');
  } catch (error) {
    console.error('执行失败:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// 执行
addRejectedStatus()
  .then(() => {
    console.log('完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('错误:', error);
    process.exit(1);
  });


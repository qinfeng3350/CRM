const fs = require('fs');
const path = require('path');

// SQL文件路径
const sqlFile = path.join(__dirname, '..', 'MySQL', 'crm_export_final.sql');
const fixedSqlFile = path.join(__dirname, '..', 'MySQL', 'crm_export_server.sql');

console.log('==========================================');
console.log('修复索引前缀问题...');
console.log('==========================================\n');

try {
  // 读取SQL文件
  console.log('正在读取SQL文件...');
  let sqlContent = fs.readFileSync(sqlFile, 'utf8');
  console.log(`✅ 文件读取成功，大小: ${(sqlContent.length / 1024).toFixed(2)} KB\n`);

  // 解析所有表定义，找出每个字段的类型
  const tableDefinitions = {};
  const tablePattern = /CREATE TABLE `(\w+)`\s*\(([^;]+)\)/gis;
  let match;
  
  while ((match = tablePattern.exec(sqlContent)) !== null) {
    const tableName = match[1];
    const tableDef = match[2];
    const fields = {};
    
    // 解析字段定义
    const fieldPattern = /`(\w+)`\s+(\w+(?:\([^)]+\))?)/g;
    let fieldMatch;
    while ((fieldMatch = fieldPattern.exec(tableDef)) !== null) {
      const fieldName = fieldMatch[1];
      const fieldType = fieldMatch[2];
      fields[fieldName] = fieldType;
    }
    
    tableDefinitions[tableName] = fields;
  }
  
  console.log(`✅ 解析了 ${Object.keys(tableDefinitions).length} 个表的定义\n`);

  // 修复索引：只对varchar长度>191的字段使用前缀索引
  console.log('修复索引前缀...');
  let fixCount = 0;
  
  // 匹配所有索引定义
  const indexPattern = /(UNIQUE\s+)?KEY\s+`([^`]+)`\s+\(`(\w+)`\((\d+)\)\)/gi;
  sqlContent = sqlContent.replace(indexPattern, (match, unique, keyName, fieldName, prefixLength) => {
    // 查找字段所属的表
    let fieldTable = null;
    let fieldType = null;
    
    // 在CREATE TABLE语句中查找这个字段
    const beforeMatch = sqlContent.substring(0, sqlContent.indexOf(match));
    const tableMatch = beforeMatch.match(new RegExp('CREATE TABLE `(\\w+)`[^;]*`' + fieldName + '`\\s+(\\S+)', 'i'));
    if (tableMatch) {
      fieldTable = tableMatch[1];
      fieldType = tableMatch[2];
      
      // 检查是否是varchar类型
      const varcharMatch = fieldType.match(/varchar\((\d+)\)/i);
      if (varcharMatch) {
        const varcharLength = parseInt(varcharMatch[1]);
        // 如果varchar长度<=191，不需要前缀索引
        if (varcharLength <= 191) {
          fixCount++;
          return `${unique ? 'UNIQUE ' : ''}KEY \`${keyName}\` (\`${fieldName}\`)`;
        }
      } else {
        // 如果不是varchar类型，不应该使用前缀索引
        fixCount++;
        return `${unique ? 'UNIQUE ' : ''}KEY \`${keyName}\` (\`${fieldName}\`)`;
      }
    }
    
    return match;
  });
  
  console.log(`  ✅ 修复了 ${fixCount} 处索引前缀问题\n`);

  // 写入修复后的文件
  console.log('正在写入修复后的SQL文件...');
  fs.writeFileSync(fixedSqlFile, sqlContent, 'utf8');
  const fileSize = (fs.statSync(fixedSqlFile).size / 1024).toFixed(2);
  console.log(`✅ 修复完成！\n`);

  console.log('==========================================');
  console.log('修复结果');
  console.log('==========================================');
  console.log(`原文件: ${sqlFile}`);
  console.log(`修复后: ${fixedSqlFile}`);
  console.log(`文件大小: ${fileSize} KB`);
  console.log(`修复项: ${fixCount} 处索引`);
  console.log('==========================================\n');

} catch (error) {
  console.error('\n❌ 修复失败:', error.message);
  console.error('错误详情:', error);
  process.exit(1);
}


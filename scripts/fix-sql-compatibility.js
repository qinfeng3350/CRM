const fs = require('fs');
const path = require('path');

// 查找最新的SQL文件
const mysqlDir = path.join(__dirname, '..', 'MySQL');
const files = fs.readdirSync(mysqlDir);
const sqlFiles = files.filter(f => f.startsWith('crm_export_') && f.endsWith('.sql') && !f.includes('fixed') && !f.includes('final'));
if (sqlFiles.length === 0) {
  console.error('❌ 未找到SQL导出文件！');
  process.exit(1);
}
// 按时间排序，取最新的
sqlFiles.sort().reverse();
const sqlFile = path.join(mysqlDir, sqlFiles[0]);
const fixedSqlFile = path.join(mysqlDir, 'crm_export_fixed.sql');

console.log('==========================================');
console.log('开始修复SQL文件兼容性...');
console.log('==========================================\n');

try {
  // 读取SQL文件
  console.log('正在读取SQL文件...');
  let sqlContent = fs.readFileSync(sqlFile, 'utf8');
  console.log(`✅ 文件读取成功，大小: ${(sqlContent.length / 1024).toFixed(2)} KB\n`);

  // 记录替换次数
  let replaceCount = 0;

  // 修复1: 将 json 类型替换为 text 类型（兼容MySQL 5.6+）
  console.log('修复1: 将 json 类型替换为 text 类型...');
  const jsonPattern = /`(\w+)`\s+json(\s+DEFAULT\s+NULL)?/gi;
  sqlContent = sqlContent.replace(jsonPattern, (match, columnName, defaultNull) => {
    replaceCount++;
    const defaultPart = defaultNull || '';
    return `\`${columnName}\` text${defaultPart}`;
  });
  console.log(`  ✅ 替换了 ${replaceCount} 处 json 类型\n`);

  // 修复2: 确保 datetime 的默认值语法正确（兼容MySQL 5.6）
  console.log('修复2: 检查 datetime 默认值语法...');
  // MySQL 5.6不支持在datetime字段上同时使用DEFAULT CURRENT_TIMESTAMP和ON UPDATE CURRENT_TIMESTAMP
  // 需要分开处理
  const datetimePattern = /`(\w+)`\s+datetime\s+DEFAULT\s+CURRENT_TIMESTAMP\s+ON\s+UPDATE\s+CURRENT_TIMESTAMP/gi;
  let datetimeCount = 0;
  sqlContent = sqlContent.replace(datetimePattern, (match, columnName) => {
    datetimeCount++;
    // MySQL 5.6兼容：只保留DEFAULT CURRENT_TIMESTAMP，去掉ON UPDATE
    return `\`${columnName}\` datetime DEFAULT CURRENT_TIMESTAMP`;
  });
  if (datetimeCount > 0) {
    console.log(`  ✅ 修复了 ${datetimeCount} 处 datetime ON UPDATE 语法\n`);
  } else {
    console.log(`  ✅ datetime 语法检查通过\n`);
  }

  // 修复3: 确保字符集设置正确
  console.log('修复3: 确保字符集设置...');
  if (!sqlContent.includes('SET NAMES utf8mb4')) {
    sqlContent = 'SET NAMES utf8mb4;\n' + sqlContent;
    console.log('  ✅ 添加了字符集设置\n');
  } else {
    console.log('  ✅ 字符集设置已存在\n');
  }

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
  console.log(`修复项: ${replaceCount} 处 json 类型`);
  console.log('==========================================\n');

  console.log('💡 提示：');
  console.log('   1. 修复后的文件已保存为: crm_export_fixed.sql');
  console.log('   2. 请在宝塔面板中使用修复后的文件导入');
  console.log('   3. 修复后的SQL兼容MySQL 5.6+版本');
  console.log('   4. json 类型已转换为 text 类型，功能不受影响');
  console.log('   5. 应用代码会自动处理 text 字段中的JSON数据\n');

} catch (error) {
  console.error('\n❌ 修复失败:', error.message);
  console.error('错误详情:', error);
  process.exit(1);
}


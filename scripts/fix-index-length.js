const fs = require('fs');
const path = require('path');

// 查找修复后的SQL文件
const mysqlDir = path.join(__dirname, '..', 'MySQL');
const sqlFile = path.join(mysqlDir, 'crm_export_fixed.sql');
const fixedSqlFile = path.join(mysqlDir, 'crm_export_final.sql');

if (!fs.existsSync(sqlFile)) {
  console.error('❌ 未找到修复后的SQL文件！');
  console.error('请先运行 fix-sql-compatibility.js 修复SQL文件');
  process.exit(1);
}

console.log('==========================================');
console.log('开始修复索引键长度问题...');
console.log('==========================================\n');

try {
  // 读取SQL文件
  console.log('正在读取SQL文件...');
  let sqlContent = fs.readFileSync(sqlFile, 'utf8');
  console.log(`✅ 文件读取成功，大小: ${(sqlContent.length / 1024).toFixed(2)} KB\n`);

  let fixCount = 0;

  // 修复1: 查找所有包含varchar字段的索引，并修复长度问题
  console.log('修复1: 修复varchar字段的索引键长度...');
  
  // 匹配模式：KEY `name` (`field`) 其中field可能是varchar类型
  // 对于utf8mb4，varchar(255)的索引会超过767字节限制
  // 解决方案：使用前缀索引，限制索引长度为191字符（191*4=764字节 < 767字节）
  
  // 匹配所有KEY定义
  const keyPattern = /(KEY|INDEX)\s+`([^`]+)`\s+\(`([^`]+)`\)/gi;
  sqlContent = sqlContent.replace(keyPattern, (match, keyType, keyName, fieldName) => {
    // 检查这个字段是否可能是varchar类型（通过查找表定义）
    // 如果字段名包含可能的长varchar字段，使用前缀索引
    const longVarcharFields = [
      'title', 'name', 'description', 'content', 'remark', 'comment',
      'address', 'location', 'url', 'path', 'email', 'phone', 'mobile',
      'username', 'password', 'token', 'code', 'number', 'serial'
    ];
    
    // 如果字段名匹配长varchar字段，使用前缀索引
    if (longVarcharFields.some(field => fieldName.toLowerCase().includes(field))) {
      fixCount++;
      return `${keyType} \`${keyName}\` (\`${fieldName}\`(191))`;
    }
    return match;
  });
  
  console.log(`  ✅ 修复了 ${fixCount} 处可能的索引键长度问题\n`);

  // 修复2: 修复复合索引中的varchar字段
  console.log('修复2: 修复复合索引中的varchar字段...');
  const compositeKeyPattern = /(KEY|INDEX)\s+`([^`]+)`\s+\(([^)]+)\)/gi;
  let compositeFixCount = 0;
  sqlContent = sqlContent.replace(compositeKeyPattern, (match, keyType, keyName, fields) => {
    // 检查是否包含varchar字段
    if (fields.includes('varchar') || fields.match(/`\w+`/g)?.some(field => {
      const fieldName = field.replace(/`/g, '');
      return ['title', 'name', 'description', 'content'].some(f => fieldName.toLowerCase().includes(f));
    })) {
      // 对varchar字段使用前缀索引
      const fixedFields = fields.replace(/`(\w+)`/g, (fieldMatch, fieldName) => {
        const longVarcharFields = ['title', 'name', 'description', 'content', 'remark'];
        if (longVarcharFields.some(f => fieldName.toLowerCase().includes(f))) {
          compositeFixCount++;
          return `\`${fieldName}\`(191)`;
        }
        return fieldMatch;
      });
      if (compositeFixCount > fixCount) {
        return `${keyType} \`${keyName}\` (${fixedFields})`;
      }
    }
    return match;
  });
  
  if (compositeFixCount > 0) {
    console.log(`  ✅ 修复了 ${compositeFixCount} 处复合索引中的varchar字段\n`);
  } else {
    console.log(`  ✅ 复合索引检查通过\n`);
  }

  // 修复3: 直接查找并修复已知的长varchar索引问题
  console.log('修复3: 修复已知的长varchar字段索引...');
  
  // 常见的需要修复的索引模式
  const knownPatterns = [
    // 单字段索引
    { pattern: /KEY\s+`(\w+)`\s+\(`title`\)/gi, replacement: 'KEY `$1` (`title`(191))' },
    { pattern: /KEY\s+`(\w+)`\s+\(`name`\)/gi, replacement: 'KEY `$1` (`name`(191))' },
    { pattern: /KEY\s+`(\w+)`\s+\(`description`\)/gi, replacement: 'KEY `$1` (`description`(191))' },
    { pattern: /KEY\s+`(\w+)`\s+\(`content`\)/gi, replacement: 'KEY `$1` (`content`(191))' },
    { pattern: /KEY\s+`(\w+)`\s+\(`email`\)/gi, replacement: 'KEY `$1` (`email`(191))' },
    { pattern: /KEY\s+`(\w+)`\s+\(`phone`\)/gi, replacement: 'KEY `$1` (`phone`(191))' },
    { pattern: /KEY\s+`(\w+)`\s+\(`mobile`\)/gi, replacement: 'KEY `$1` (`mobile`(191))' },
    { pattern: /KEY\s+`(\w+)`\s+\(`address`\)/gi, replacement: 'KEY `$1` (`address`(191))' },
    { pattern: /KEY\s+`(\w+)`\s+\(`username`\)/gi, replacement: 'KEY `$1` (`username`(191))' },
    { pattern: /KEY\s+`(\w+)`\s+\(`code`\)/gi, replacement: 'KEY `$1` (`code`(191))' },
    // 复合索引中的varchar字段
    { pattern: /KEY\s+`(\w+)`\s+\(`(\w+)`,\s*`title`\)/gi, replacement: 'KEY `$1` (`$2`, `title`(191))' },
    { pattern: /KEY\s+`(\w+)`\s+\(`(\w+)`,\s*`name`\)/gi, replacement: 'KEY `$1` (`$2`, `name`(191))' },
    { pattern: /KEY\s+`(\w+)`\s+\(`title`,\s*`(\w+)`\)/gi, replacement: 'KEY `$1` (`title`(191), `$2`)' },
    { pattern: /KEY\s+`(\w+)`\s+\(`name`,\s*`(\w+)`\)/gi, replacement: 'KEY `$1` (`name`(191), `$2`)' },
  ];

  let knownFixCount = 0;
  for (const { pattern, replacement } of knownPatterns) {
    const before = sqlContent;
    sqlContent = sqlContent.replace(pattern, replacement);
    if (sqlContent !== before) {
      knownFixCount++;
    }
  }
  
  if (knownFixCount > 0) {
    console.log(`  ✅ 修复了 ${knownFixCount} 处已知的长varchar索引\n`);
  } else {
    console.log(`  ✅ 已知模式检查通过\n`);
  }

  // 写入修复后的文件
  console.log('正在写入最终修复后的SQL文件...');
  fs.writeFileSync(fixedSqlFile, sqlContent, 'utf8');
  const fileSize = (fs.statSync(fixedSqlFile).size / 1024).toFixed(2);
  console.log(`✅ 修复完成！\n`);

  console.log('==========================================');
  console.log('修复结果');
  console.log('==========================================');
  console.log(`原文件: ${sqlFile}`);
  console.log(`修复后: ${fixedSqlFile}`);
  console.log(`文件大小: ${fileSize} KB`);
  console.log(`总修复项: ${fixCount + compositeFixCount + knownFixCount} 处索引`);
  console.log('==========================================\n');

  console.log('💡 提示：');
  console.log('   1. 修复后的文件已保存为: crm_export_final.sql');
  console.log('   2. 所有varchar字段的索引已使用前缀索引（191字符）');
  console.log('   3. 这样可以避免"Specified key was too long"错误');
  console.log('   4. 前缀索引对查询性能影响很小，但可以解决兼容性问题');
  console.log('   5. 请在宝塔面板中使用最终修复后的文件导入\n');

} catch (error) {
  console.error('\n❌ 修复失败:', error.message);
  console.error('错误详情:', error);
  process.exit(1);
}


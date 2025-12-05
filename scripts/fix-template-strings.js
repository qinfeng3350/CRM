const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../controllers/dingTalkController.js');
let content = fs.readFileSync(filePath, 'utf8');

// 匹配所有包含中文的模板字符串：console.log(`中文${var}`)
const regex = /console\.(log|error|warn)\(`([^`]*[\u4e00-\u9fa5][^`]*)\$\{([^}]+)\}([^`]*)`\)/g;

content = content.replace(regex, (match, method, before, varName, after) => {
  // 处理多个变量插值的情况
  const parts = match.match(/\$\{([^}]+)\}/g);
  if (!parts) return match;
  
  let result = "console." + method + "('" + before.replace(/\$\{[^}]+\}/g, "' + ").replace(/'/g, "\\'");
  // 简化：直接替换整个模板字符串
  return match.replace(/`([^`]*)`/, (tmpl) => {
    let str = tmpl.slice(1, -1); // 去掉反引号
    // 替换 ${var} 为 ' + var + '
    str = str.replace(/\$\{([^}]+)\}/g, "' + $1 + '");
    return "'" + str + "'";
  });
});

// 更简单的方法：直接查找并替换所有包含中文的模板字符串
const chineseTemplateRegex = /console\.(log|error|warn)\(`([^`]*[\u4e00-\u9fa5][^`]*)`\)/g;
content = content.replace(chineseTemplateRegex, (match) => {
  // 提取方法名和内容
  const methodMatch = match.match(/console\.(log|error|warn)\(`([^`]+)`\)/);
  if (!methodMatch) return match;
  const method = methodMatch[1];
  let templateContent = methodMatch[2];
  
  // 替换 ${var} 为 ' + var + '
  templateContent = templateContent.replace(/\$\{([^}]+)\}/g, "' + $1 + '");
  
  return "console." + method + "('" + templateContent + "')";
});

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ 已修复所有包含中文的模板字符串');


const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../controllers/dingTalkController.js');
let content = fs.readFileSync(filePath, 'utf8');

// 修复在字符串拼接上下文中使用模板字符串语法的问题
// 匹配模式：' + ${...} ? ' 或 ' : ''} 或 ${...} ? '
const patterns = [
  // ${var ? '...' : ''}
  {
    regex: /\$\{([^}]+)\s*\?\s*'([^']*)'\s*:\s*''\}/g,
    replace: (match, condition, html) => {
      return `(${condition} ? '${html.replace(/'/g, "\\'")}' : '')`;
    }
  },
  // ${var && var.field ? '...' : ''}
  {
    regex: /\$\{([^}]+)\s*&&\s*([^}]+)\s*\?\s*'([^']*)'\s*:\s*''\}/g,
    replace: (match, var1, var2, html) => {
      return `(${var1} && ${var2} ? '${html.replace(/'/g, "\\'")}' : '')`;
    }
  }
];

let changed = true;
let iterations = 0;
const maxIterations = 5;

while (changed && iterations < maxIterations) {
  changed = false;
  iterations++;
  
  patterns.forEach(({ regex, replace }) => {
    const newContent = content.replace(regex, (match, ...args) => {
      const result = replace(match, ...args);
      if (result !== match) {
        changed = true;
        return result;
      }
      return match;
    });
    if (newContent !== content) {
      content = newContent;
    }
  });
}

// 手动修复一些特殊情况
// ${moduleDetails && moduleDetails.contractNumber ? '...' : ''}
content = content.replace(/\$\{moduleDetails\s*&&\s*moduleDetails\.(\w+)\s*\?\s*'([^']*)'\s*:\s*''\}/g, 
  (match, field, html) => {
    return `(moduleDetails && moduleDetails.${field} ? '${html.replace(/'/g, "\\'")}' : '')`;
  }
);

fs.writeFileSync(filePath, content, 'utf8');
console.log(`✅ 已修复模板字符串语法问题（${iterations}次迭代）`);


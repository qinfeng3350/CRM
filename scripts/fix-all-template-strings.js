const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../controllers/dingTalkController.js');
let content = fs.readFileSync(filePath, 'utf8');

// 修复所有包含中文的模板字符串
// 匹配模式：`中文${var}中文` 或 `中文${var}中文${var2}中文`
const patterns = [
  // console.log(`中文${var}`)
  {
    regex: /console\.(log|error|warn)\(`([^`]*[\u4e00-\u9fa5][^`]*)`\)/g,
    replace: (match, method, template) => {
      let result = template.replace(/\$\{([^}]+)\}/g, "' + $1 + '");
      return `console.${method}('${result}')`;
    }
  },
  // `中文${var}中文` 在对象字面量中
  {
    regex: /([a-zA-Z_][a-zA-Z0-9_]*):\s*`([^`]*[\u4e00-\u9fa5][^`]*)`/g,
    replace: (match, key, template) => {
      let result = template.replace(/\$\{([^}]+)\}/g, "' + $1 + '");
      return `${key}: '${result}'`;
    }
  },
  // message: `中文${var}`
  {
    regex: /message:\s*`([^`]*[\u4e00-\u9fa5][^`]*)`/g,
    replace: (match, template) => {
      let result = template.replace(/\$\{([^}]+)\}/g, "' + $1 + '");
      return `message: '${result}'`;
    }
  },
  // name: `部门_${var}`
  {
    regex: /name:\s*[^|]*\|\|\s*`([^`]*_\$\{[^}]+\})`/g,
    replace: (match, template) => {
      let result = template.replace(/\$\{([^}]+)\}/g, "' + $1 + '");
      return match.replace(/`[^`]+`/, `'${result}'`);
    }
  }
];

let changed = false;
patterns.forEach(({ regex, replace }) => {
  const newContent = content.replace(regex, replace);
  if (newContent !== content) {
    content = newContent;
    changed = true;
  }
});

if (changed) {
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ 已修复模板字符串');
} else {
  console.log('ℹ️  没有需要修复的模板字符串');
}


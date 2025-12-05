const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../controllers/dingTalkController.js');
let content = fs.readFileSync(filePath, 'utf8');

// 修复所有包含中文的模板字符串
// 匹配所有包含中文的模板字符串模式
const patterns = [
  // console.log(`中文${var}`)
  {
    regex: /console\.(log|error|warn)\(`([^`]*[\u4e00-\u9fa5][^`]*)`\)/g,
    replace: (match, method, template) => {
      let result = template.replace(/\$\{([^}]+)\}/g, "' + $1 + '");
      return `console.${method}('${result}')`;
    }
  },
  // message = `中文${var}`
  {
    regex: /message\s*=\s*`([^`]*[\u4e00-\u9fa5][^`]*)`/g,
    replace: (match, template) => {
      let result = template.replace(/\$\{([^}]+)\}/g, "' + $1 + '");
      return `message = '${result}'`;
    }
  },
  // message += `中文${var}`
  {
    regex: /message\s*\+=\s*`([^`]*[\u4e00-\u9fa5][^`]*)`/g,
    replace: (match, template) => {
      let result = template.replace(/\$\{([^}]+)\}/g, "' + $1 + '");
      return `message += '${result}'`;
    }
  },
  // const/let var = `中文${var}`
  {
    regex: /(const|let)\s+(\w+)\s*=\s*`([^`]*[\u4e00-\u9fa5][^`]*)`/g,
    replace: (match, decl, varName, template) => {
      let result = template.replace(/\$\{([^}]+)\}/g, "' + $1 + '");
      return `${decl} ${varName} = '${result}'`;
    }
  },
  // key: `中文${var}`
  {
    regex: /(\w+):\s*`([^`]*[\u4e00-\u9fa5][^`]*)`/g,
    replace: (match, key, template) => {
      let result = template.replace(/\$\{([^}]+)\}/g, "' + $1 + '");
      return `${key}: '${result}'`;
    }
  },
  // `中文${var}` 在 || 之后
  {
    regex: /\|\|\s*`([^`]*[\u4e00-\u9fa5][^`]*)`/g,
    replace: (match, template) => {
      let result = template.replace(/\$\{([^}]+)\}/g, "' + $1 + '");
      return `|| '${result}'`;
    }
  },
  // `中文_${var}`
  {
    regex: /`([^`]*[\u4e00-\u9fa5][^`]*_\$\{[^}]+\})`/g,
    replace: (match, template) => {
      let result = template.replace(/\$\{([^}]+)\}/g, "' + $1 + '");
      return `'${result}'`;
    }
  },
  // `中文${var}中文`
  {
    regex: /`([^`]*[\u4e00-\u9fa5][^`]*)`/g,
    replace: (match, template) => {
      // 跳过已经在字符串中的模板字符串
      if (match.includes("'") && !match.includes('${')) return match;
      let result = template.replace(/\$\{([^}]+)\}/g, "' + $1 + '");
      return `'${result}'`;
    }
  }
];

let changed = true;
let iterations = 0;
const maxIterations = 10;

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

fs.writeFileSync(filePath, content, 'utf8');
console.log(`✅ 已修复模板字符串（${iterations}次迭代）`);


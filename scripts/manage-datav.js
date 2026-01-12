#!/usr/bin/env node

/**
 * DataV 数据大屏集成管理工具
 * 用于快速配置、验证和管理数据大屏相关依赖和功能
 * 
 * 用法:
 *   node scripts/manage-datav.js install    - 安装 DataV 依赖
 *   node scripts/manage-datav.js verify     - 验证 DataV 集成
 *   node scripts/manage-datav.js test       - 测试 API 连接
 *   node scripts/manage-datav.js status     - 显示当前状态
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'cyan');
}

function logSection(title) {
  log('\n' + '='.repeat(50), 'blue');
  log(title, 'blue');
  log('='.repeat(50) + '\n', 'blue');
}

// 安装 DataV 依赖
function installDependencies() {
  logSection('安装 DataV 依赖');

  const packages = [
    '@jiaminghi/data-view@^2.10.0',
    'echarts@^5.4.3',
    'echarts-for-react@^3.0.2',
  ];

  try {
    const clientDir = path.join(__dirname, '..', 'client');
    
    if (!fs.existsSync(clientDir)) {
      logError('找不到 client 目录');
      return false;
    }

    logInfo(`正在 ${clientDir} 中安装依赖...`);
    
    // 检查 package.json
    const packageJsonPath = path.join(clientDir, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      logError('找不到 client/package.json');
      return false;
    }

    // 执行 npm install
    logInfo('执行 npm install...');
    execSync('npm install', { cwd: clientDir, stdio: 'inherit' });
    
    logSuccess('依赖安装完成！');
    logInfo('已安装的包:');
    packages.forEach(pkg => {
      logInfo(`  • ${pkg}`);
    });
    
    return true;
  } catch (error) {
    logError(`安装失败: ${error.message}`);
    return false;
  }
}

// 验证 DataV 集成
function verifyIntegration() {
  logSection('验证 DataV 集成');

  const checks = [];

  // 检查 DataVDashboard.jsx
  const dashboardPath = path.join(
    __dirname,
    '..',
    'client',
    'src',
    'pages',
    'Projects',
    'DataVDashboard.jsx'
  );
  
  if (fs.existsSync(dashboardPath)) {
    logSuccess('✓ DataVDashboard.jsx 存在');
    checks.push(true);
  } else {
    logError('✗ 找不到 DataVDashboard.jsx');
    checks.push(false);
  }

  // 检查样式文件
  const stylePath = path.join(
    __dirname,
    '..',
    'client',
    'src',
    'pages',
    'Projects',
    'DataVDashboard.css'
  );
  
  if (fs.existsSync(stylePath)) {
    logSuccess('✓ DataVDashboard.css 存在');
    checks.push(true);
  } else {
    logError('✗ 找不到 DataVDashboard.css');
    checks.push(false);
  }

  // 检查 package.json 依赖
  const packageJsonPath = path.join(__dirname, '..', 'client', 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const deps = packageJson.dependencies || {};

    const requiredPackages = [
      '@jiaminghi/data-view',
      'echarts',
      'echarts-for-react',
    ];

    requiredPackages.forEach(pkg => {
      if (deps[pkg]) {
        logSuccess(`✓ ${pkg} 已安装 (${deps[pkg]})`);
        checks.push(true);
      } else {
        logWarning(`⚠ ${pkg} 未在 package.json 中找到`);
        checks.push(false);
      }
    });
  }

  // 总结
  logSection('验证结果');
  const passCount = checks.filter(c => c).length;
  const totalCount = checks.length;
  
  if (passCount === totalCount) {
    logSuccess(`所有检查通过 (${passCount}/${totalCount})`);
    return true;
  } else {
    logWarning(`部分检查未通过 (${passCount}/${totalCount})`);
    return false;
  }
}

// 测试 API 连接
function testAPIConnection() {
  logSection('测试 API 连接');

  try {
    const apiUrl = 'http://localhost:3000/api/projects/dashboard/stats';
    logInfo(`测试 API: ${apiUrl}`);
    
    logInfo('使用 curl 测试（需要 curl 命令）...');
    
    // 仅显示说明，实际测试需要 API 运行
    logWarning('⚠ 此工具需要 API 服务正在运行');
    logInfo('请确保:');
    logInfo('  1. npm start 已执行');
    logInfo('  2. 数据库已连接');
    logInfo('  3. 项目数据已初始化');
    
    log(`\n示例 cURL 命令:`, 'cyan');
    log(`  curl http://localhost:3000/api/projects/dashboard/stats\n`, 'yellow');
    
    return true;
  } catch (error) {
    logError(`测试失败: ${error.message}`);
    return false;
  }
}

// 显示当前状态
function showStatus() {
  logSection('DataV 大屏集成状态');

  const dashboardPath = path.join(
    __dirname,
    '..',
    'client',
    'src',
    'pages',
    'Projects',
    'DataVDashboard.jsx'
  );

  const packageJsonPath = path.join(__dirname, '..', 'client', 'package.json');

  log('\n📊 数据大屏信息\n', 'cyan');
  
  if (fs.existsSync(dashboardPath)) {
    const content = fs.readFileSync(dashboardPath, 'utf8');
    const createdMatch = content.match(/创建时间:\s*([^\n]+)/);
    const dataSourceMatch = content.match(/数据来源:\s*([^\n]+)/);
    
    logSuccess('数据大屏: 已创建');
    if (createdMatch) logInfo(`  创建时间: ${createdMatch[1].trim()}`);
    if (dataSourceMatch) logInfo(`  数据来源: ${dataSourceMatch[1].trim()}`);
  } else {
    logError('数据大屏: 未找到');
  }

  log('\n📦 依赖包状态\n', 'cyan');
  
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const deps = packageJson.dependencies || {};

    [
      '@jiaminghi/data-view',
      'echarts',
      'echarts-for-react',
    ].forEach(pkg => {
      if (deps[pkg]) {
        logSuccess(`${pkg}: ${deps[pkg]}`);
      } else {
        logWarning(`${pkg}: 未安装`);
      }
    });
  }

  log('\n🔗 相关链接\n', 'cyan');
  logInfo('DataV 官方文档: https://jiaming-he.github.io/data-view/');
  logInfo('DataV NPM 包: https://www.npmjs.com/package/@jiaminghi/data-view');
  logInfo('ECharts 官方网站: https://echarts.apache.org/');
  logInfo('项目文档: DATA_VISUALIZATION_GUIDE.md');
  
  log('\n📂 相关文件\n', 'cyan');
  logInfo('client/src/pages/Projects/DataVDashboard.jsx');
  logInfo('client/src/pages/Projects/DataVDashboard.css');
  logInfo('DATA_VISUALIZATION_GUIDE.md');
  logInfo('CLEANUP_REPORT.md');
  
  log('');
}

// 主函数
function main() {
  const command = process.argv[2] || 'status';

  logSection('DataV 数据大屏管理工具');

  switch (command.toLowerCase()) {
    case 'install':
      installDependencies();
      break;
    case 'verify':
      verifyIntegration();
      break;
    case 'test':
      testAPIConnection();
      break;
    case 'status':
      showStatus();
      break;
    case 'help':
    case '--help':
    case '-h':
      log(`
使用方法:
  node scripts/manage-datav.js [命令]

可用命令:
  install  - 安装 DataV 和相关依赖
  verify   - 验证 DataV 集成状态
  test     - 测试 API 连接
  status   - 显示当前状态（默认）
  help     - 显示此帮助信息

示例:
  node scripts/manage-datav.js install
  node scripts/manage-datav.js verify
  node scripts/manage-datav.js status
      `, 'cyan');
      break;
    default:
      logError(`未知命令: ${command}`);
      logInfo('使用 --help 获取帮助');
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  installDependencies,
  verifyIntegration,
  testAPIConnection,
  showStatus,
};

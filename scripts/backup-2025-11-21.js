const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const backupName = '2025-11-21版本墨枫CRM';
const backupDir = path.join(__dirname, '..', 'backups', backupName);

console.log('开始备份项目...');
console.log('备份名称:', backupName);
console.log('备份目录:', backupDir);

// 创建备份目录
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

// 需要备份的目录和文件
const itemsToBackup = [
  'client',
  'controllers',
  'models',
  'routes',
  'services',
  'middleware',
  'config',
  'utils',
  'scripts',
  'MySQL',
  'package.json',
  'package-lock.json',
  'server.js',
  '.env.example',
  'README.md',
];

// 需要排除的目录
const excludeDirs = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'backups',
  '.vscode',
  '.idea',
  '*.log',
];

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  
  if (stat.isDirectory()) {
    // 检查是否在排除列表中
    const dirName = path.basename(src);
    if (excludeDirs.includes(dirName)) {
      console.log(`跳过目录: ${src}`);
      return;
    }
    
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    
    const files = fs.readdirSync(src);
    files.forEach(file => {
      const srcPath = path.join(src, file);
      const destPath = path.join(dest, file);
      copyRecursive(srcPath, destPath);
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

// 执行备份
console.log('\n开始复制文件...');
itemsToBackup.forEach(item => {
  const srcPath = path.join(__dirname, '..', item);
  const destPath = path.join(backupDir, item);
  
  if (fs.existsSync(srcPath)) {
    console.log(`备份: ${item}`);
    copyRecursive(srcPath, destPath);
  } else {
    console.log(`跳过（不存在）: ${item}`);
  }
});

// 备份数据库结构
async function backupDatabase() {
  try {
    const dbConfig = require('../config/database');
    const mysql = require('mysql2/promise');
    
    const connection = await mysql.createConnection({
      host: dbConfig.host || '39.106.142.253',
      port: dbConfig.port || 3306,
      database: dbConfig.database || 'crm',
      user: dbConfig.user || 'crm',
      password: dbConfig.password || 'crm123',
    });
    
    // 导出数据库结构
    const backupSqlPath = path.join(backupDir, 'database_backup.sql');
    const command = `mysqldump -h ${dbConfig.host || '39.106.142.253'} -P ${dbConfig.port || 3306} -u ${dbConfig.user || 'crm'} -p${dbConfig.password || 'crm123'} ${dbConfig.database || 'crm'} --no-data --routines --triggers > "${backupSqlPath}"`;
    
    try {
      execSync(command, { stdio: 'inherit' });
      console.log('✅ 数据库结构备份完成');
    } catch (error) {
      console.warn('⚠️  数据库结构备份失败（可能需要手动导出）:', error.message);
    }
    
    await connection.end();
  } catch (error) {
    console.warn('⚠️  数据库备份跳过:', error.message);
  }
}

// 执行备份
(async () => {
  console.log('\n备份数据库结构...');
  await backupDatabase();
  
  // 创建备份信息文件
  const backupInfo = {
    backupName: backupName,
    backupDate: new Date().toISOString(),
    backupType: '完整备份',
    description: '方案三（三方流程对接钉钉OA）实施前的备份',
    items: itemsToBackup,
    note: '此备份包含代码和数据库结构，用于方案三实施前的回滚点',
  };
  
  fs.writeFileSync(
    path.join(backupDir, 'backup-info.json'),
    JSON.stringify(backupInfo, null, 2),
    'utf8'
  );
  
  console.log('\n✅ 备份完成！');
  console.log('备份位置:', backupDir);
  console.log('备份信息:', JSON.stringify(backupInfo, null, 2));
})();



/**
 * 钉钉集成初始化脚本
 * 创建数据库表并初始化配置
 * 运行: node scripts/init-dingtalk.js
 */

const { pool } = require('../config/database');
const fs = require('fs');
const path = require('path');

const DINGTALK_CONFIG = {
  appKey: 'dings4qylrxgdgsanqdg',
  appSecret: 'T03d8zfKy2LggHuzmd91fnm-A9QBB1IQseTtGoB6sLVYUlDBZH6dppRMGnmIOI4p',
  agentId: null,
  corpId: null,
  enabled: true,
  callbackUrl: process.env.FRONTEND_URL 
    ? `${process.env.FRONTEND_URL}/auth/dingtalk/callback`
    : 'http://localhost:5173/auth/dingtalk/callback',
};

const initDingTalk = async () => {
  const connection = await pool.getConnection();
  
  try {
    console.log('开始初始化钉钉集成...\n');

    // 1. 创建钉钉配置表
    console.log('1. 创建钉钉配置表...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS \`dingtalk_config\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`appKey\` VARCHAR(255) COMMENT '钉钉应用Key',
        \`appSecret\` VARCHAR(255) COMMENT '钉钉应用Secret',
        \`agentId\` VARCHAR(255) COMMENT '应用AgentId',
        \`corpId\` VARCHAR(255) COMMENT '企业CorpId',
        \`enabled\` TINYINT(1) DEFAULT 0 COMMENT '是否启用',
        \`callbackUrl\` VARCHAR(500) COMMENT '回调地址',
        \`createdAt\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY \`unique_config\` (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='钉钉配置表'
    `);
    console.log('   ✓ 钉钉配置表创建成功\n');

    // 2. 创建钉钉用户关联表
    console.log('2. 创建钉钉用户关联表...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS \`dingtalk_users\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`dingTalkUserId\` VARCHAR(255) NOT NULL COMMENT '钉钉用户ID',
        \`userId\` INT COMMENT '系统用户ID',
        \`name\` VARCHAR(255) COMMENT '姓名',
        \`mobile\` VARCHAR(50) COMMENT '手机号',
        \`email\` VARCHAR(255) COMMENT '邮箱',
        \`avatar\` VARCHAR(500) COMMENT '头像URL',
        \`departmentIds\` JSON COMMENT '部门ID列表',
        \`createdAt\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY \`unique_dingtalk_user\` (\`dingTalkUserId\`),
        KEY \`idx_user_id\` (\`userId\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='钉钉用户关联表'
    `);
    console.log('   ✓ 钉钉用户关联表创建成功\n');

    // 3. 检查是否已有配置
    console.log('3. 检查现有配置...');
    const [existingConfigs] = await connection.execute(
      'SELECT * FROM dingtalk_config LIMIT 1'
    );

    if (existingConfigs.length > 0) {
      // 更新现有配置
      console.log('   发现已有配置，更新配置信息...');
      await connection.execute(
        `UPDATE dingtalk_config SET 
          appKey = ?, 
          appSecret = ?, 
          agentId = ?, 
          corpId = ?, 
          enabled = ?, 
          callbackUrl = ?,
          updatedAt = NOW()
        WHERE id = ?`,
        [
          DINGTALK_CONFIG.appKey,
          DINGTALK_CONFIG.appSecret,
          DINGTALK_CONFIG.agentId,
          DINGTALK_CONFIG.corpId,
          DINGTALK_CONFIG.enabled ? 1 : 0,
          DINGTALK_CONFIG.callbackUrl,
          existingConfigs[0].id,
        ]
      );
      console.log('   ✓ 配置已更新\n');
    } else {
      // 创建新配置
      console.log('   创建新配置...');
      await connection.execute(
        `INSERT INTO dingtalk_config 
          (appKey, appSecret, agentId, corpId, enabled, callbackUrl, createdAt, updatedAt) 
          VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          DINGTALK_CONFIG.appKey,
          DINGTALK_CONFIG.appSecret,
          DINGTALK_CONFIG.agentId,
          DINGTALK_CONFIG.corpId,
          DINGTALK_CONFIG.enabled ? 1 : 0,
          DINGTALK_CONFIG.callbackUrl,
        ]
      );
      console.log('   ✓ 配置已创建\n');
    }

    // 4. 验证配置
    console.log('4. 验证配置...');
    const [configs] = await connection.execute(
      'SELECT * FROM dingtalk_config LIMIT 1'
    );
    
    if (configs.length > 0) {
      const config = configs[0];
      console.log('   配置信息:');
      console.log(`   - AppKey: ${config.appKey}`);
      console.log(`   - AppSecret: ${config.appSecret ? '***' + config.appSecret.slice(-4) : '未设置'}`);
      console.log(`   - AgentId: ${config.agentId || '未设置'}`);
      console.log(`   - CorpId: ${config.corpId || '未设置'}`);
      console.log(`   - 启用状态: ${config.enabled ? '已启用' : '未启用'}`);
      console.log(`   - 回调地址: ${config.callbackUrl}`);
      console.log('   ✓ 配置验证成功\n');
    }

    console.log('✅ 钉钉集成初始化完成！\n');
    console.log('下一步操作:');
    console.log('1. 在钉钉开放平台配置回调地址:', DINGTALK_CONFIG.callbackUrl);
    console.log('2. 启动服务器: npm run dev');
    console.log('3. 测试钉钉登录功能\n');

  } catch (error) {
    console.error('❌ 初始化失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    connection.release();
    process.exit(0);
  }
};

// 执行初始化
initDingTalk();


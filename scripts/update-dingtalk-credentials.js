const { pool } = require('../config/database');

async function updateDingTalkCredentials() {
  const connection = await pool.getConnection();
  try {
    console.log('==========================================');
    console.log('🔧 更新钉钉AppKey和AppSecret...');
    console.log('==========================================\n');

    const appKey = 'ding124swyq8wwkmsyhl';
    const appSecret = 'SNYj8EYTm913JPdtbsdeln_dmlzeBqLkGXVITByn6DQIeNubAFScH_KIXRXe0Yf5';
    // 注意：AgentId需要从钉钉开放平台获取，在应用详情页面可以看到
    // 如果不知道AgentId，可以暂时不设置，但工作通知卡片功能将无法使用
    const agentId = null; // 需要用户手动配置

    // 检查配置是否存在
    const [existing] = await connection.execute(
      'SELECT * FROM dingtalk_config LIMIT 1'
    );

    if (existing.length === 0) {
      // 如果不存在，创建新配置
      await connection.execute(
        `INSERT INTO dingtalk_config (appKey, appSecret, agentId, enabled, todoSyncEnabled, dingtalkApprovalEnabled, createdAt, updatedAt) 
         VALUES (?, ?, ?, 1, 1, 0, NOW(), NOW())`,
        [appKey, appSecret, agentId]
      );
      console.log('✅ 已创建钉钉配置');
    } else {
      // 更新现有配置（保留原有的agentId，如果新值不为null则更新）
      const updateFields = ['appKey = ?', 'appSecret = ?', 'todoSyncEnabled = 1', 'dingtalkApprovalEnabled = 0', 'updatedAt = NOW()'];
      const updateValues = [appKey, appSecret];
      
      if (agentId !== null) {
        updateFields.splice(2, 0, 'agentId = ?');
        updateValues.splice(2, 0, agentId);
      }
      
      updateValues.push(existing[0].id);
      
      await connection.execute(
        `UPDATE dingtalk_config 
         SET ${updateFields.join(', ')} 
         WHERE id = ?`,
        updateValues
      );
      console.log('✅ 已更新钉钉配置');
    }

    // 查询更新后的配置
    const [updated] = await connection.execute(
      'SELECT * FROM dingtalk_config LIMIT 1'
    );

    console.log(`\n📋 配置信息:`);
    console.log(`   AppKey: ${appKey}`);
    console.log(`   AppSecret: ${appSecret.substring(0, 10)}...`);
    console.log(`   AgentId: ${updated[0]?.agentId || '未配置（需要在钉钉开放平台获取）'}`);
    console.log(`   待办同步: 已启用`);
    console.log(`   OA审批: 已禁用`);
    
    if (!updated[0]?.agentId) {
      console.log(`\n⚠️  重要提示:`);
      console.log(`   AgentId未配置，工作通知卡片功能将无法使用。`);
      console.log(`   请按以下步骤获取AgentId：`);
      console.log(`   1. 登录钉钉开放平台：https://open.dingtalk.com/`);
      console.log(`   2. 进入应用管理 -> 选择您的应用（墨枫CRM）`);
      console.log(`   3. 在应用详情页面，找到"AgentId"字段`);
      console.log(`   4. 复制AgentId，然后在系统管理 -> 钉钉集成中配置`);
    }

    console.log('\n==========================================');
    console.log('✅ 更新完成');
    console.log('==========================================\n');

  } catch (error) {
    console.error('❌ 更新失败:', error);
    throw error;
  } finally {
    connection.release();
    pool.end();
  }
}

updateDingTalkCredentials()
  .then(() => {
    console.log('✅ 脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 脚本执行失败:', error);
    process.exit(1);
  });


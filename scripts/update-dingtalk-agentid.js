const { pool } = require('../config/database');

async function updateAgentId(agentId) {
  const connection = await pool.getConnection();
  try {
    if (!agentId) {
      console.error('❌ 未提供 AgentId。用法: node scripts/update-dingtalk-agentid.js <AgentId>');
      process.exit(1);
    }

    console.log('🔧 更新钉钉 AgentId:', agentId);
    const [rows] = await connection.execute('SELECT id FROM dingtalk_config LIMIT 1');
    if (rows.length === 0) {
      console.error('❌ 未找到 dingtalk_config，请先运行: npm run init-dingtalk');
      process.exit(1);
    }

    await connection.execute(
      'UPDATE dingtalk_config SET agentId = ?, updatedAt = NOW() WHERE id = ?',
      [String(agentId), rows[0].id]
    );

    const [updated] = await connection.execute('SELECT appKey, agentId, corpId, enabled FROM dingtalk_config LIMIT 1');
    console.log('✅ 已更新 AgentId');
    console.log('   AppKey:', updated[0].appKey);
    console.log('   AgentId:', updated[0].agentId);
    console.log('   CorpId:', updated[0].corpId || '未设置');
    console.log('   启用状态:', updated[0].enabled ? '已启用' : '未启用');
  } catch (err) {
    console.error('❌ 更新失败:', err.message);
    process.exit(1);
  } finally {
    connection.release();
    pool.end();
  }
}

const agentIdArg = process.argv[2];
updateAgentId(agentIdArg);

const { pool } = require('../config/database');

async function checkConfig() {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute(
      'SELECT * FROM dingtalk_config LIMIT 1'
    );
    
    if (rows.length === 0) {
      console.log('❌ 未找到钉钉配置');
      return;
    }
    
    const config = rows[0];
    console.log('=== 钉钉配置信息 ===\n');
    console.log('✅ 配置已存在');
    console.log(`   启用状态: ${config.enabled ? '已启用' : '未启用'}`);
    console.log(`   钉钉审批启用: ${config.dingtalkApprovalEnabled ? '✅ 已启用' : '❌ 未启用'}`);
    console.log(`   审批模板编码: ${config.approvalProcessCode || '❌ 未配置'}`);
    console.log(`   服务器地址: ${config.serverUrl || '未配置'}`);
    console.log(`   前端地址: ${config.frontendUrl || '未配置'}`);
    
    if (!config.dingtalkApprovalEnabled) {
      console.log('\n⚠️  问题：钉钉审批功能未启用');
      console.log('   解决方案：在系统管理 -> 钉钉集成中启用"钉钉审批"开关');
    }
    
    if (!config.approvalProcessCode) {
      console.log('\n⚠️  问题：未配置审批模板编码（approvalProcessCode）');
      console.log('   解决方案：');
      console.log('   1. 在钉钉开放平台创建审批模板');
      console.log('   2. 获取模板的 processCode');
      console.log('   3. 在系统管理 -> 钉钉集成中配置"审批模板编码"');
      console.log('   或者运行: node scripts/update-process-code.js');
    }
    
    if (config.dingtalkApprovalEnabled && !config.approvalProcessCode) {
      console.log('\n❌ 关键问题：已启用钉钉审批，但未配置审批模板编码');
      console.log('   这会导致创建审批流程失败，系统会回退到普通待办模式');
      console.log('   普通待办在钉钉中只有"去查看"按钮，没有"同意"、"拒绝"等审批操作按钮');
    }
    
  } finally {
    connection.release();
    process.exit(0);
  }
}

checkConfig();


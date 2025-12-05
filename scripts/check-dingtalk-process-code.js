const { pool } = require('../config/database');
const DingTalkConfig = require('../models/DingTalkConfig');
const dingTalkService = require('../services/dingTalkService');

async function checkDingTalkProcessCode() {
  const connection = await pool.getConnection();
  try {
    console.log('==========================================');
    console.log('🔍 检查钉钉审批模板配置...');
    console.log('==========================================\n');

    // 1. 检查数据库配置
    const config = await DingTalkConfig.findWithSecrets();
    if (!config) {
      console.error('❌ 钉钉配置不存在');
      return;
    }

    console.log('📋 数据库配置：');
    console.log('   AppKey:', config.appKey || '未配置');
    console.log('   启用状态:', config.enabled ? '已启用' : '未启用');
    console.log('   钉钉审批启用:', config.dingtalkApprovalEnabled ? '已启用' : '未启用');
    console.log('   审批模板编码:', config.approvalProcessCode || '未配置');
    console.log('   ServerUrl:', config.serverUrl || '未配置');
    console.log('');

    if (!config.approvalProcessCode) {
      console.error('❌ 审批模板编码未配置');
      console.log('   请在系统管理 -> 钉钉集成中配置审批模板编码');
      return;
    }

    if (!config.dingtalkApprovalEnabled) {
      console.warn('⚠️  钉钉审批功能未启用');
      console.log('   请在系统管理 -> 钉钉集成中启用"钉钉审批"功能');
    }

    // 2. 尝试查询模板（如果钉钉API支持）
    console.log('==========================================');
    console.log('🔍 验证ProcessCode...');
    console.log('==========================================\n');

    try {
      // 注意：钉钉可能没有直接查询模板的API，这里只是尝试
      console.log('   使用的ProcessCode:', config.approvalProcessCode);
      console.log('   提示：如果模板不存在，创建审批时会返回错误');
      console.log('');
    } catch (error) {
      console.warn('   无法验证模板（钉钉可能不支持查询模板API）');
    }

    // 3. 检查字段配置
    console.log('==========================================');
    console.log('📋 系统使用的字段名称：');
    console.log('==========================================\n');
    console.log('必填字段：');
    console.log('   - 审批内容（多行文本）');
    console.log('');
    console.log('通用字段：');
    console.log('   - 模块类型（单行文本）');
    console.log('   - 编号（单行文本）');
    console.log('   - 名称（单行文本）');
    console.log('   - 客户名称（单行文本）');
    console.log('   - 金额（数字）');
    console.log('   - 备注说明（多行文本）');
    console.log('');
    console.log('合同特定字段：');
    console.log('   - 合同类型（单选）');
    console.log('   - 签署日期（日期）');
    console.log('   - 开始日期（日期）');
    console.log('   - 结束日期（日期）');
    console.log('');

    // 4. 提供检查建议
    console.log('==========================================');
    console.log('📝 检查建议：');
    console.log('==========================================\n');
    console.log('1. 确认ProcessCode是否正确：');
    console.log(`   ${config.approvalProcessCode}`);
    console.log('   在钉钉开放平台 -> OA审批 -> 审批模板管理中查看模板ID');
    console.log('');
    console.log('2. 确认模板已发布：');
    console.log('   模板创建后必须点击"发布"才能使用');
    console.log('');
    console.log('3. 确认字段名称完全一致：');
    console.log('   字段名称必须与系统代码中的字段名完全一致（区分大小写）');
    console.log('   系统使用的字段名：审批内容、编号、名称、客户名称、金额等');
    console.log('');
    console.log('4. 确认模板所属应用：');
    console.log('   模板必须属于"墨枫CRM"应用（AppKey: ' + (config.appKey || '未配置') + '）');
    console.log('');

  } catch (error) {
    console.error('❌ 检查失败:', error);
    throw error;
  } finally {
    connection.release();
    pool.end();
  }
}

checkDingTalkProcessCode()
  .then(() => {
    console.log('\n✅ 检查完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 检查失败:', error);
    process.exit(1);
  });


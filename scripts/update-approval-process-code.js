const { pool } = require('../config/database');

async function updateApprovalProcessCode() {
  const connection = await pool.getConnection();
  try {
    console.log('==========================================');
    console.log('🔄 更新审批模板编码（ProcessCode）...');
    console.log('==========================================\n');

    const processCode = 'PROC-80ADFE6C-0329-4E7E-B11E-0BE8024D1ADF';

    // 检查配置是否存在
    const [existing] = await connection.execute('SELECT id, approvalProcessCode FROM dingtalk_config LIMIT 1');
    
    if (existing.length === 0) {
      console.error('❌ 钉钉配置不存在，请先创建配置');
      return;
    }

    console.log('📋 当前配置：');
    console.log('   审批模板编码:', existing[0].approvalProcessCode || '未配置');

    // 更新审批模板编码
    await connection.execute(
      `UPDATE dingtalk_config 
       SET approvalProcessCode = ?, updatedAt = NOW() 
       WHERE id = ?`,
      [processCode, existing[0].id]
    );

    console.log('\n✅ 已更新审批模板编码');
    console.log('   新编码:', processCode);

    // 验证更新结果
    const [updated] = await connection.execute('SELECT approvalProcessCode FROM dingtalk_config LIMIT 1');
    if (updated[0].approvalProcessCode === processCode) {
      console.log('\n✅ 验证成功：审批模板编码已正确更新');
    } else {
      console.error('❌ 验证失败：审批模板编码更新可能未成功');
    }

    console.log('\n==========================================');
    console.log('📝 重要提示：');
    console.log('==========================================\n');
    console.log('1. 确保在钉钉开放平台中已创建审批模板');
    console.log('2. 确保模板中包含以下字段：');
    console.log('   - 审批内容（必填）');
    console.log('   - 模块类型（可选）');
    console.log('   - 编号（可选）');
    console.log('   - 名称（可选）');
    console.log('   - 客户名称（可选）');
    console.log('   - 金额（可选）');
    console.log('   - 备注说明（可选）');
    console.log('\n3. 在系统中启用"钉钉审批"功能');
    console.log('4. 测试审批流程是否正常工作');

  } catch (error) {
    console.error('❌ 更新失败:', error);
    throw error;
  } finally {
    connection.release();
    pool.end();
  }
}

updateApprovalProcessCode()
  .then(() => {
    console.log('\n✅ 更新完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 更新失败:', error);
    process.exit(1);
  });


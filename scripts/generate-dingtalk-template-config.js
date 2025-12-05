const { pool } = require('../config/database');
const WorkflowDefinition = require('../models/WorkflowDefinition');
const WorkflowNode = require('../models/WorkflowNode');
const WorkflowRoute = require('../models/WorkflowRoute');

/**
 * 生成钉钉审批模板配置
 * 读取系统中的流程定义和字段，生成钉钉模板的配置说明
 */
async function generateDingTalkTemplateConfig() {
  const connection = await pool.getConnection();
  try {
    console.log('==========================================');
    console.log('📋 生成钉钉审批模板配置...');
    console.log('==========================================\n');

    // 获取所有启用的流程定义
    const workflows = await WorkflowDefinition.find({ isActive: 1 });
    
    if (workflows.length === 0) {
      console.log('⚠️  系统中没有启用的流程定义');
      console.log('   提示：请在"系统管理 -> 流程设计器"中创建流程定义');
      return;
    }

    console.log(`✅ 找到 ${workflows.length} 个启用的流程定义\n`);

    // 为每个流程生成配置
    for (const workflow of workflows) {
      console.log('==========================================');
      console.log(`📝 流程：${workflow.name} (${workflow.moduleType})`);
      console.log('==========================================\n');

      // 获取流程节点
      const nodes = await WorkflowNode.findByWorkflowId(workflow.id);
      const routes = await WorkflowRoute.findByWorkflowId(workflow.id);

      // 生成字段列表
      const fields = generateFields(workflow.moduleType);
      
      // 生成流程设计
      const processDesign = generateProcessDesign(nodes, routes);

      // 输出配置
      console.log('【基础设置】');
      console.log(`  表单名称：${workflow.name}审批模板`);
      console.log(`  所在分组：其他`);
      console.log(`  表单说明：${workflow.description || '系统自动生成的审批模板'}`);
      console.log(`  谁可以发起：全部`);
      console.log(`  表单管理员：全部「OA审批」管理员`);
      console.log('');

      console.log('【表单设计】');
      console.log('  必填字段：');
      fields.required.forEach(field => {
        console.log(`    - ${field.name} (${field.type})`);
      });
      console.log('  可选字段：');
      fields.optional.forEach(field => {
        console.log(`    - ${field.name} (${field.type})`);
      });
      console.log('');

      console.log('【流程设计】');
      console.log(processDesign);
      console.log('');

      console.log('【字段映射说明】');
      console.log('  系统会自动将以下字段填充到钉钉模板：');
      fields.all.forEach(field => {
        console.log(`    - ${field.name}: ${field.description}`);
      });
      console.log('');
    }

    console.log('==========================================');
    console.log('📝 配置步骤：');
    console.log('==========================================\n');
    console.log('1. 登录钉钉开放平台');
    console.log('2. 进入"应用开发 -> 企业内部应用 -> 墨枫CRM"');
    console.log('3. 在"OA审批 -> 审批模板管理"中创建模板');
    console.log('4. 按照上面的配置填写表单字段和流程设计');
    console.log('5. 获取ProcessCode并配置到系统中');
    console.log('\n提示：系统已优化为使用通用模板，只需创建一个包含所有字段的模板即可');

  } catch (error) {
    console.error('❌ 生成配置失败:', error);
    throw error;
  } finally {
    connection.release();
    pool.end();
  }
}

/**
 * 根据模块类型生成字段列表
 */
function generateFields(moduleType) {
  const commonFields = {
    required: [
      { name: '审批内容', type: '多行文本', description: '系统自动填充模块标题和描述' }
    ],
    optional: [
      { name: '模块类型', type: '单行文本', description: '显示审批类型（合同、商机等）' },
      { name: '编号', type: '单行文本', description: '显示合同编号、商机编号等' },
      { name: '名称', type: '单行文本', description: '显示合同名称、商机名称等' },
      { name: '客户名称', type: '单行文本', description: '显示关联的客户名称' },
      { name: '金额', type: '数字', description: '显示合同金额、预计金额等' },
      { name: '备注说明', type: '多行文本', description: '显示模块的备注信息' }
    ]
  };

  // 根据模块类型添加特定字段
  if (moduleType === 'contracts' || moduleType === 'contract') {
    commonFields.optional.push(
      { name: '合同类型', type: '单选', description: '显示合同类型' },
      { name: '签署日期', type: '日期', description: '显示签署日期' },
      { name: '开始日期', type: '日期', description: '显示合同开始日期' },
      { name: '结束日期', type: '日期', description: '显示合同结束日期' }
    );
  } else if (moduleType === 'opportunities' || moduleType === 'opportunity') {
    commonFields.optional.push(
      { name: '商机阶段', type: '单行文本', description: '显示商机阶段' },
      { name: '成交概率', type: '单行文本', description: '显示成交概率' }
    );
  } else if (moduleType === 'quotations' || moduleType === 'quotation') {
    commonFields.optional.push(
      { name: '报价单号', type: '单行文本', description: '显示报价单号' },
      { name: '有效期至', type: '日期', description: '显示报价有效期' }
    );
  } else if (moduleType === 'projects' || moduleType === 'project') {
    commonFields.optional.push(
      { name: '项目编号', type: '单行文本', description: '显示项目编号' },
      { name: '项目状态', type: '单行文本', description: '显示项目状态' }
    );
  }

  return {
    ...commonFields,
    all: [...commonFields.required, ...commonFields.optional]
  };
}

/**
 * 根据节点和路由生成流程设计说明
 */
function generateProcessDesign(nodes, routes) {
  if (nodes.length === 0) {
    return '  暂无流程节点，请在流程设计器中设计流程';
  }

  let design = '';
  const startNode = nodes.find(n => n.nodeType === 'start');
  const approvalNodes = nodes.filter(n => n.nodeType === 'approval');
  const endNode = nodes.find(n => n.nodeType === 'end');

  if (startNode) {
    design += `  开始节点：${startNode.name || startNode.nodeKey}\n`;
  }

  approvalNodes.forEach((node, index) => {
    const config = node.config || {};
    const approverType = config.approverType || 'user';
    const approvers = config.approvers || [];
    const approvalMode = config.approvalMode || 'AND'; // AND=会签, OR=或签
    
    design += `  审批节点${index + 1}：${node.name || node.nodeKey}\n`;
    design += `    审批方式：${approvalMode === 'AND' ? '会签（所有人都同意）' : '或签（任意一人同意）'}\n`;
    
    if (approverType === 'user' && approvers.length > 0) {
      design += `    审批人：指定成员（${approvers.length}人）\n`;
    } else if (approverType === 'role') {
      design += `    审批人：指定角色\n`;
    } else {
      design += `    审批人：发起人自选（推荐）\n`;
    }
    design += '\n';
  });

  if (endNode) {
    design += `  结束节点：${endNode.name || endNode.nodeKey}\n`;
  }

  return design || '  请在流程设计器中设计流程';
}

generateDingTalkTemplateConfig()
  .then(() => {
    console.log('\n✅ 配置生成完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 配置生成失败:', error);
    process.exit(1);
  });


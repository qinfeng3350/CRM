const { pool } = require('../config/database');

// 获取所有可用的模块列表
exports.getModules = async (req, res) => {
  try {
    const connection = await pool.getConnection();
    try {
      // 查询所有表名
      const [tables] = await connection.execute(
        `SELECT TABLE_NAME, TABLE_COMMENT 
         FROM INFORMATION_SCHEMA.TABLES 
         WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_TYPE = 'BASE TABLE'
         ORDER BY TABLE_NAME`
      );

      // 定义可配置流程的模块（排除系统表）
      const systemTables = ['users', 'departments', 'workflow_definitions', 'workflow_nodes', 
                           'workflow_routes', 'workflow_instances', 'workflow_node_instances',
                           'workflow_tasks', 'workflow_history', 'workflow_condition_rules',
                           'approval_workflows', 'approval_records', 'todos', 'follow_ups',
                           'roles', 'permissions', 'system_settings'];
      
      // 表名到中文名称的映射（如果TABLE_COMMENT为空，使用这个映射）
      const tableNameMap = {
        'contracts': '合同',
        'opportunities': '商机',
        'customers': '客户',
        'products': '产品',
        'quotations': '报价单',
        'quotation_items': '报价单明细',
        'payments': '付款',
        'invoices': '发票',
        'expenses': '费用',
        'projects': '项目',
        'project_phases': '项目阶段',
        'project_tasks': '项目任务',
        'project_risks': '项目风险',
        'leads': '线索',
        'campaigns': '市场活动',
        'tickets': '服务工单',
        'signatures': '电子签名',
        'contract_products': '合同产品',
        'opportunity_products': '商机产品',
      };
      
      const modules = tables
        .filter(table => !systemTables.includes(table.TABLE_NAME))
        .map(table => {
          // 优先使用TABLE_COMMENT，如果没有则使用映射表，最后使用表名
          let name = table.TABLE_COMMENT;
          if (!name || name.trim() === '') {
            name = tableNameMap[table.TABLE_NAME] || table.TABLE_NAME;
          }
          
          return {
            code: table.TABLE_NAME,
            name: name,
            tableName: table.TABLE_NAME
          };
        });

      res.json({
        success: true,
        data: modules
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取指定模块的字段列表
exports.getModuleFields = async (req, res) => {
  try {
    const { moduleCode } = req.params;
    const connection = await pool.getConnection();
    try {
      const [columns] = await connection.execute(
        `SELECT COLUMN_NAME, COLUMN_COMMENT, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
         FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = ?
         ORDER BY ORDINAL_POSITION`,
        [moduleCode]
      );

      // 过滤掉系统字段
      const systemFields = ['id', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'];
      
      // 字段名到中文名称的映射（如果COLUMN_COMMENT为空，使用这个映射）
      const fieldNameMap = {
        // 通用字段
        'customerId': '客户',
        'ownerId': '负责人',
        'amount': '金额',
        'status': '状态',
        'title': '标题',
        'name': '名称',
        'description': '描述',
        'content': '内容',
        'phone': '电话',
        'email': '邮箱',
        'address': '地址',
        'company': '公司',
        'source': '来源',
        'category': '类别',
        'priority': '优先级',
        'probability': '成交概率',
        'quantity': '数量',
        'unitPrice': '单价',
        'discount': '折扣',
        'totalAmount': '总金额',
        'taxRate': '税率',
        'paymentMethod': '付款方式',
        'paymentPlan': '付款计划',
        'attachments': '附件',
        'tags': '标签',
        'industry': '行业',
        'scale': '规模',
        'level': '级别',
        'department': '部门',
        'role': '角色',
        'permissions': '权限',
        // 合同相关
        'contractNumber': '合同编号',
        'opportunityId': '关联商机',
        'signDate': '签署日期',
        'startDate': '开始日期',
        'endDate': '结束日期',
        'expectedCloseDate': '预计成交日期',
        'actualCloseDate': '实际成交日期',
        'dueDate': '到期日期',
        'paidDate': '付款日期',
        'expenseDate': '费用日期',
        'invoiceDate': '开票日期',
        'validUntil': '有效期至',
        'lastContactAt': '最后联系时间',
        'lastFollowUpAt': '最后跟进时间',
        'nextFollowUpAt': '下次跟进时间',
        'lastTransferAt': '最后转交时间',
        'convertedAt': '转化时间',
        'createdAt': '创建时间',
        'updatedAt': '更新时间',
        // 其他
        'quotationNumber': '报价单号',
        'invoiceNumber': '发票号码',
        'planNumber': '计划编号',
        'ticketNumber': '工单号',
        'campaignName': '活动名称',
        'campaignType': '活动类型',
        'budget': '预算',
        'actualCost': '实际成本',
        'targetAudience': '目标受众',
        'participants': '参与者',
        'leadsGenerated': '生成线索数',
        'conversionRate': '转化率',
        'roi': '投资回报率',
        'productName': '产品名称',
        'productId': '产品',
        'relatedId': '关联ID',
        'type': '类型',
        'quality': '质量',
        'convertedToCustomer': '已转化为客户',
        'convertedToOpportunity': '已转化为商机',
      };
      
      const fields = columns
        .filter(col => !systemFields.includes(col.COLUMN_NAME))
        .map(col => {
          // 映射数据类型
          let fieldType = 'string';
          if (['int', 'bigint', 'decimal', 'float', 'double'].includes(col.DATA_TYPE)) {
            fieldType = 'number';
          } else if (['date', 'datetime', 'timestamp'].includes(col.DATA_TYPE)) {
            fieldType = 'date';
          } else if (['text', 'longtext'].includes(col.DATA_TYPE)) {
            fieldType = 'text';
          } else if (col.DATA_TYPE === 'json') {
            fieldType = 'json';
          }

          // 优先使用COLUMN_COMMENT，如果没有则使用映射表，最后使用字段名
          let label = col.COLUMN_COMMENT;
          if (!label || label.trim() === '') {
            label = fieldNameMap[col.COLUMN_NAME] || col.COLUMN_NAME;
          }

          return {
            name: col.COLUMN_NAME,
            label: label,
            type: fieldType,
            nullable: col.IS_NULLABLE === 'YES',
            defaultValue: col.COLUMN_DEFAULT
          };
        });

      res.json({
        success: true,
        data: fields
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


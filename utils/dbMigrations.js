const { pool } = require('../config/database');

async function ensureTableExists(connection, tableName, createSQL) {
  const [tables] = await connection.execute(
    `SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?`,
    [tableName]
  );
  if (tables[0].cnt === 0) {
    await connection.execute(createSQL);
  }
}

async function getExistingColumns(connection, tableName) {
  const [cols] = await connection.execute(
    `SELECT COLUMN_NAME FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ?`,
    [tableName]
  );
  return new Set(cols.map((c) => c.COLUMN_NAME));
}

async function ensureUsersColumns(connection) {
  const existing = await getExistingColumns(connection, 'users');
  const statements = [];
  if (!existing.has('managerId')) {
    statements.push('ALTER TABLE users ADD COLUMN managerId INT(11) DEFAULT NULL COMMENT "直属上级用户ID"');
  }
  if (!existing.has('departmentId')) {
    statements.push('ALTER TABLE users ADD COLUMN departmentId INT(11) DEFAULT NULL COMMENT "所属部门ID"');
  }
  for (const sql of statements) {
    await connection.execute(sql);
  }
}

async function ensureDepartmentsTableAndColumns(connection) {
  await ensureTableExists(
    connection,
    'departments',
    `CREATE TABLE IF NOT EXISTS departments (
      id INT(11) NOT NULL AUTO_INCREMENT,
      name VARCHAR(200) NOT NULL,
      parentId INT(11) DEFAULT NULL,
      description VARCHAR(500) DEFAULT '',
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT NULL,
      PRIMARY KEY (id),
      KEY idx_parentId (parentId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='部门表'`
  );

  const existing = await getExistingColumns(connection, 'departments');
  const statements = [];
  if (!existing.has('code')) {
    statements.push('ALTER TABLE departments ADD COLUMN code VARCHAR(100) DEFAULT NULL COMMENT "部门编码/外部ID"');
  }
  if (!existing.has('managerId')) {
    statements.push('ALTER TABLE departments ADD COLUMN managerId INT(11) DEFAULT NULL COMMENT "部门负责人用户ID"');
  }
  if (!existing.has('sortOrder')) {
    statements.push('ALTER TABLE departments ADD COLUMN sortOrder INT(11) DEFAULT 0 COMMENT "排序"');
  }
  if (!existing.has('isActive')) {
    statements.push('ALTER TABLE departments ADD COLUMN isActive TINYINT(1) DEFAULT 1 COMMENT "是否启用"');
  }
  for (const sql of statements) {
    await connection.execute(sql);
  }
  // 为常用字段加索引（若存在则忽略错误）
  try { await connection.execute('ALTER TABLE departments ADD INDEX idx_code (code)'); } catch (e) {}
  try { await connection.execute('ALTER TABLE departments ADD INDEX idx_managerId (managerId)'); } catch (e) {}
}

async function ensureDingTalkConfig(connection) {
  await ensureTableExists(
    connection,
    'dingtalk_config',
    `CREATE TABLE IF NOT EXISTS dingtalk_config (
      id INT AUTO_INCREMENT PRIMARY KEY,
      appKey VARCHAR(255),
      appSecret VARCHAR(255),
      qrLoginAppKey VARCHAR(255) DEFAULT NULL,
      qrLoginAppSecret VARCHAR(255) DEFAULT NULL,
      agentId VARCHAR(255),
      corpId VARCHAR(255),
      enabled TINYINT(1) DEFAULT 0,
      callbackUrl VARCHAR(500),
      frontendUrl VARCHAR(500) DEFAULT NULL,
      serverUrl VARCHAR(500) DEFAULT NULL,
      todoSyncEnabled TINYINT(1) DEFAULT 1,
      dingtalkApprovalEnabled TINYINT(1) DEFAULT 0,
      approvalProcessCode VARCHAR(255) DEFAULT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='钉钉配置表'`
  );

  const existing = await getExistingColumns(connection, 'dingtalk_config');
  const statements = [];
  if (!existing.has('cardTemplateId')) {
    statements.push("ALTER TABLE dingtalk_config ADD COLUMN cardTemplateId VARCHAR(255) DEFAULT NULL COMMENT '钉钉互动卡片模板ID'");
  }
  if (!existing.has('cardRouteKey')) {
    statements.push("ALTER TABLE dingtalk_config ADD COLUMN cardRouteKey VARCHAR(255) DEFAULT NULL COMMENT '钉钉互动卡片回调RouteKey'");
  }
  if (!existing.has('cardInstanceEnabled')) {
    statements.push("ALTER TABLE dingtalk_config ADD COLUMN cardInstanceEnabled TINYINT(1) DEFAULT 0 COMMENT '是否启用钉钉互动卡片推送'");
  }
  for (const sql of statements) {
    await connection.execute(sql);
  }
}

async function ensureApprovalWorkflows(connection) {
  await ensureTableExists(
    connection,
    'approval_workflows',
    `CREATE TABLE IF NOT EXISTS approval_workflows (
      id INT(11) NOT NULL AUTO_INCREMENT,
      name VARCHAR(200) NOT NULL,
      moduleType VARCHAR(50) NOT NULL,
      conditions TEXT,
      steps TEXT,
      isActive TINYINT(1) DEFAULT 1,
      priority INT(11) DEFAULT 0,
      createdBy INT(11) DEFAULT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT NULL,
      PRIMARY KEY (id),
      KEY idx_moduleType (moduleType),
      KEY idx_isActive (isActive)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审批流程表'`
  );

  // 若为空则初始化两个默认流程
  const [countRows] = await connection.execute('SELECT COUNT(*) AS total FROM approval_workflows');
  if ((countRows[0]?.total || 0) === 0) {
    await connection.execute(
      `INSERT INTO approval_workflows (name, moduleType, conditions, steps, isActive, priority, createdBy, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        '合同审批流程（默认）',
        'contract',
        JSON.stringify({ minAmount: 0, maxAmount: null }),
        JSON.stringify([
          { type: 'role', value: 'sales_manager', priority: 'high', required: true },
          { type: 'role', value: 'admin', priority: 'urgent', required: false }
        ]),
        1,
        1,
        1
      ]
    );
    await connection.execute(
      `INSERT INTO approval_workflows (name, moduleType, conditions, steps, isActive, priority, createdBy, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        '商机审批流程（默认）',
        'opportunity',
        JSON.stringify({ minAmount: 100000, maxAmount: null }),
        JSON.stringify([
          { type: 'role', value: 'sales_manager', priority: 'high', required: true }
        ]),
        1,
        1,
        1
      ]
    );
  }
}

async function ensureDashboardsTable(connection) {
  await ensureTableExists(
    connection,
    'dashboards',
    `CREATE TABLE IF NOT EXISTS dashboards (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL COMMENT '大屏名称',
      description TEXT COMMENT '大屏描述',
      icon VARCHAR(100) COMMENT '大屏图标',
      config LONGTEXT COMMENT '大屏配置 (JSON格式)',
      dataSource VARCHAR(100) NOT NULL COMMENT '数据源',
      chartType VARCHAR(255) COMMENT '图表类型 (逗号分隔)',
      refreshInterval INT DEFAULT 10000 COMMENT '刷新间隔',
      isActive TINYINT DEFAULT 1 COMMENT '是否启用',
      createdBy INT COMMENT '创建人ID',
      createdAt DATETIME NULL DEFAULT NULL COMMENT '创建时间',
      updatedAt DATETIME DEFAULT NULL COMMENT '更新时间',
      KEY idx_dataSource (dataSource),
      KEY idx_isActive (isActive),
      KEY idx_createdAt (createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='数据大屏表'`
  );
  // 初始化一个默认数据大屏（如无数据）
  try {
    const [rows] = await connection.execute('SELECT COUNT(*) AS total FROM dashboards');
    if ((rows[0]?.total || 0) === 0) {
      const defaultConfig = {
        title: '项目总览大屏',
        charts: [
          { type: 'bar', title: '项目状态统计', dataKey: 'statusCounts' },
          { type: 'line', title: '项目进度趋势', dataKey: 'progressTrend' }
        ],
        theme: 'light'
      };
      await connection.execute(
        `INSERT INTO dashboards (name, description, icon, config, dataSource, chartType, refreshInterval, isActive, createdBy, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          '项目数据大屏',
          '默认示例，用于展示项目总体情况',
          'FundProjectionScreenOutlined',
          JSON.stringify(defaultConfig),
          'projects',
          'bar,line',
          10000,
          1,
          1
        ]
      );
    }
  } catch (e) {
    // 忽略初始化错误，不影响启动
  }
}

async function ensureProjectsTable(connection) {
  // 直接执行建表（IF NOT EXISTS 保证幂等），避免个别环境 information_schema 读取异常
  await connection.execute(`CREATE TABLE IF NOT EXISTS projects (
      id INT(11) NOT NULL AUTO_INCREMENT,
      projectNumber VARCHAR(100) NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT DEFAULT NULL,
      customerId INT(11) DEFAULT NULL,
      opportunityId INT(11) DEFAULT NULL,
      contractId INT(11) DEFAULT NULL,
      status VARCHAR(50) DEFAULT 'planning',
      priority VARCHAR(20) DEFAULT 'medium',
      progress INT(11) DEFAULT 0,
      startDate DATETIME DEFAULT NULL,
      expectedEndDate DATETIME DEFAULT NULL,
      actualEndDate DATETIME DEFAULT NULL,
      budget DECIMAL(18,2) DEFAULT 0,
      ownerId INT(11) DEFAULT NULL,
      teamMembers LONGTEXT DEFAULT NULL,
      tags LONGTEXT DEFAULT NULL,
      attachments LONGTEXT DEFAULT NULL,
      createdBy INT(11) DEFAULT NULL,
      createdAt DATETIME NULL DEFAULT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_projectNumber (projectNumber),
      KEY idx_ownerId (ownerId),
      KEY idx_status (status),
      KEY idx_customerId (customerId),
      KEY idx_createdAt (createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='项目表'`);
}

async function ensureProjectPhasesTable(connection) {
  await connection.execute(`CREATE TABLE IF NOT EXISTS project_phases (
      id INT(11) NOT NULL AUTO_INCREMENT,
      projectId INT(11) NOT NULL,
      phaseNumber INT(11) NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT DEFAULT NULL,
      status VARCHAR(20) DEFAULT 'not_started',
      progress INT(11) DEFAULT 0,
      startDate DATETIME DEFAULT NULL,
      expectedEndDate DATETIME DEFAULT NULL,
      actualEndDate DATETIME DEFAULT NULL,
      budget DECIMAL(18,2) DEFAULT 0,
      actualCost DECIMAL(18,2) DEFAULT 0,
      ownerId INT(11) DEFAULT NULL,
      dependencies LONGTEXT DEFAULT NULL,
      createdAt DATETIME NULL DEFAULT NULL,
      updatedAt DATETIME DEFAULT NULL,
      PRIMARY KEY (id),
      KEY idx_projectId (projectId),
      KEY idx_phaseNumber (phaseNumber),
      KEY idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='项目阶段表'`);
}

async function ensureProjectTasksTable(connection) {
  await connection.execute(`CREATE TABLE IF NOT EXISTS project_tasks (
      id INT(11) NOT NULL AUTO_INCREMENT,
      projectId INT(11) NOT NULL,
      phaseId INT(11) DEFAULT NULL,
      taskNumber VARCHAR(100) NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT DEFAULT NULL,
      status VARCHAR(20) DEFAULT 'todo',
      priority VARCHAR(20) DEFAULT 'medium',
      progress INT(11) DEFAULT 0,
      startDate DATETIME DEFAULT NULL,
      expectedEndDate DATETIME DEFAULT NULL,
      actualEndDate DATETIME DEFAULT NULL,
      estimatedHours DECIMAL(10,2) DEFAULT 0,
      actualHours DECIMAL(10,2) DEFAULT 0,
      assigneeId INT(11) DEFAULT NULL,
      dependencies LONGTEXT DEFAULT NULL,
      tags LONGTEXT DEFAULT NULL,
      createdBy INT(11) DEFAULT NULL,
      createdAt DATETIME NULL DEFAULT NULL,
      updatedAt DATETIME DEFAULT NULL,
      PRIMARY KEY (id),
      KEY idx_projectId (projectId),
      KEY idx_phaseId (phaseId),
      KEY idx_status (status),
      KEY idx_priority (priority)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='项目任务表'`);
}

async function ensureProjectLogsTable(connection) {
  await connection.execute(`CREATE TABLE IF NOT EXISTS project_logs (
      id INT(11) NOT NULL AUTO_INCREMENT,
      projectId INT(11) NOT NULL,
      phaseId INT(11) DEFAULT NULL,
      taskId INT(11) DEFAULT NULL,
      logType VARCHAR(20) DEFAULT 'info',
      title VARCHAR(255) NOT NULL,
      content TEXT DEFAULT NULL,
      attachments LONGTEXT DEFAULT NULL,
      createdBy INT(11) NOT NULL,
      createdAt DATETIME NULL DEFAULT NULL,
      PRIMARY KEY (id),
      KEY idx_projectId (projectId),
      KEY idx_logType (logType)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='项目日志表'`);
}

async function ensureApprovalRecordsTable(connection) {
  await connection.execute(`CREATE TABLE IF NOT EXISTS approval_records (
      id INT(11) NOT NULL AUTO_INCREMENT,
      workflowId INT(11) DEFAULT NULL,
      moduleType VARCHAR(50) NOT NULL,
      moduleId INT(11) NOT NULL,
      stepIndex INT(11) DEFAULT 0,
      approverId INT(11) DEFAULT NULL,
      action VARCHAR(20) DEFAULT 'pending',
      comment TEXT DEFAULT NULL,
      createdAt DATETIME NULL DEFAULT NULL,
      updatedAt DATETIME DEFAULT NULL,
      PRIMARY KEY (id),
      KEY idx_module (moduleType, moduleId),
      KEY idx_approver (approverId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='审批记录表'`);
}

async function ensureActivitiesTable(connection) {
  await connection.execute(`CREATE TABLE IF NOT EXISTS activities (
      id INT(11) NOT NULL AUTO_INCREMENT,
      type VARCHAR(50) NOT NULL,
      customerId INT(11) DEFAULT NULL,
      opportunityId INT(11) DEFAULT NULL,
      contractId INT(11) DEFAULT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT DEFAULT NULL,
      userId INT(11) DEFAULT NULL,
      startTime DATETIME DEFAULT NULL,
      endTime DATETIME DEFAULT NULL,
      location VARCHAR(255) DEFAULT '',
      status VARCHAR(50) DEFAULT 'planned',
      reminder LONGTEXT DEFAULT NULL,
      createdAt DATETIME NULL DEFAULT NULL,
      updatedAt DATETIME DEFAULT NULL,
      PRIMARY KEY (id),
      KEY idx_user (userId),
      KEY idx_customer (customerId),
      KEY idx_opportunity (opportunityId),
      KEY idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='活动表'`);
}

async function ensureCampaignsTable(connection) {
  await connection.execute(`CREATE TABLE IF NOT EXISTS campaigns (
      id INT(11) NOT NULL AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(100) DEFAULT 'other',
      status VARCHAR(50) DEFAULT 'planned',
      startDate DATETIME DEFAULT NULL,
      endDate DATETIME DEFAULT NULL,
      budget DECIMAL(18,2) DEFAULT 0,
      actualCost DECIMAL(18,2) DEFAULT 0,
      targetAudience VARCHAR(500) DEFAULT '',
      description TEXT DEFAULT NULL,
      participants LONGTEXT DEFAULT NULL,
      leadsGenerated INT(11) DEFAULT 0,
      conversionRate DECIMAL(10,2) DEFAULT 0,
      roi DECIMAL(10,2) DEFAULT 0,
      createdBy INT(11) DEFAULT NULL,
      createdAt DATETIME NULL DEFAULT NULL,
      updatedAt DATETIME DEFAULT NULL,
      PRIMARY KEY (id),
      KEY idx_type (type),
      KEY idx_status (status),
      KEY idx_createdBy (createdBy)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='市场活动表'`);
}

async function ensureInvoicesTable(connection) {
  await connection.execute(`CREATE TABLE IF NOT EXISTS invoices (
      id INT(11) NOT NULL AUTO_INCREMENT,
      contractId INT(11) DEFAULT NULL,
      paymentId INT(11) DEFAULT NULL,
      invoiceNumber VARCHAR(100) NOT NULL,
      invoiceType VARCHAR(50) DEFAULT 'normal',
      invoiceDate DATETIME DEFAULT NULL,
      amount DECIMAL(18,2) DEFAULT 0,
      taxAmount DECIMAL(18,2) DEFAULT 0,
      totalAmount DECIMAL(18,2) DEFAULT 0,
      taxRate DECIMAL(10,2) DEFAULT 0,
      status VARCHAR(50) DEFAULT 'draft',
      buyerName VARCHAR(255) DEFAULT '',
      buyerTaxNumber VARCHAR(100) DEFAULT '',
      buyerAddress VARCHAR(255) DEFAULT '',
      buyerPhone VARCHAR(100) DEFAULT '',
      buyerBank VARCHAR(255) DEFAULT '',
      buyerAccount VARCHAR(255) DEFAULT '',
      description TEXT DEFAULT NULL,
      attachments LONGTEXT DEFAULT NULL,
      createdBy INT(11) DEFAULT NULL,
      createdAt DATETIME NULL DEFAULT NULL,
      updatedAt DATETIME DEFAULT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uk_invoiceNumber (invoiceNumber),
      KEY idx_contractId (contractId),
      KEY idx_paymentId (paymentId),
      KEY idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='发票表'`);
}

async function ensureLeadsTable(connection) {
  await connection.execute(`CREATE TABLE IF NOT EXISTS leads (
      id INT(11) NOT NULL AUTO_INCREMENT,
      name VARCHAR(200) NOT NULL,
      company VARCHAR(200) DEFAULT '',
      phone VARCHAR(50) DEFAULT '',
      email VARCHAR(200) DEFAULT '',
      source VARCHAR(100) DEFAULT '',
      status VARCHAR(50) DEFAULT 'new',
      quality INT(11) DEFAULT 50,
      ownerId INT(11) DEFAULT NULL,
      description TEXT DEFAULT NULL,
      createdAt DATETIME NULL DEFAULT NULL,
      updatedAt DATETIME DEFAULT NULL,
      PRIMARY KEY (id),
      KEY idx_owner (ownerId),
      KEY idx_status (status),
      KEY idx_source (source)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='线索表'`);
}

async function ensurePaymentsTable(connection) {
  await connection.execute(`CREATE TABLE IF NOT EXISTS payments (
      id INT(11) NOT NULL AUTO_INCREMENT,
      contractId INT(11) DEFAULT NULL,
      planId INT(11) DEFAULT NULL,
      paymentNumber VARCHAR(100) NOT NULL,
      paymentDate DATETIME DEFAULT NULL,
      amount DECIMAL(18,2) DEFAULT 0,
      currency VARCHAR(10) DEFAULT 'CNY',
      paymentMethod VARCHAR(50) DEFAULT 'bank_transfer',
      bankAccount VARCHAR(100) DEFAULT '',
      receiptNumber VARCHAR(100) DEFAULT '',
      description TEXT DEFAULT NULL,
      attachments LONGTEXT DEFAULT NULL,
      createdBy INT(11) DEFAULT NULL,
      createdAt DATETIME NULL DEFAULT NULL,
      updatedAt DATETIME DEFAULT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uk_paymentNumber (paymentNumber),
      KEY idx_contractId (contractId),
      KEY idx_planId (planId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='回款记录表'`);
}

async function ensurePaymentPlansTable(connection) {
  await connection.execute(`CREATE TABLE IF NOT EXISTS payment_plans (
      id INT(11) NOT NULL AUTO_INCREMENT,
      contractId INT(11) NOT NULL,
      planNumber VARCHAR(100) NOT NULL,
      planDate DATETIME DEFAULT NULL,
      amount DECIMAL(18,2) DEFAULT 0,
      currency VARCHAR(10) DEFAULT 'CNY',
      status VARCHAR(50) DEFAULT 'pending',
      receivedAmount DECIMAL(18,2) DEFAULT 0,
      description TEXT DEFAULT NULL,
      createdBy INT(11) DEFAULT NULL,
      createdAt DATETIME NULL DEFAULT NULL,
      updatedAt DATETIME DEFAULT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uk_planNumber (planNumber),
      KEY idx_contractId (contractId),
      KEY idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='回款计划表'`);
}

async function ensurePrintTemplatesTable(connection) {
  await connection.execute(`CREATE TABLE IF NOT EXISTS print_templates (
      id INT(11) NOT NULL AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(100) NOT NULL,
      content LONGTEXT NOT NULL,
      isDefault TINYINT(1) DEFAULT 0,
      isActive TINYINT(1) DEFAULT 1,
      createdBy INT(11) DEFAULT NULL,
      createdAt DATETIME NULL DEFAULT NULL,
      updatedAt DATETIME DEFAULT NULL,
      PRIMARY KEY (id),
      KEY idx_type (type),
      KEY idx_isActive (isActive)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='打印模板表'`);
}

async function ensureRolesTable(connection) {
  await connection.execute(`CREATE TABLE IF NOT EXISTS roles (
      id INT(11) NOT NULL AUTO_INCREMENT,
      name VARCHAR(100) NOT NULL,
      description VARCHAR(500) DEFAULT '',
      permissions LONGTEXT DEFAULT NULL,
      dataScope VARCHAR(50) DEFAULT 'self',
      createdAt DATETIME NULL DEFAULT NULL,
      updatedAt DATETIME DEFAULT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uk_role_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色表'`);
}

async function ensureSignaturesTable(connection) {
  await connection.execute(`CREATE TABLE IF NOT EXISTS signatures (
      id INT(11) NOT NULL AUTO_INCREMENT,
      type VARCHAR(50) NOT NULL,
      relatedId INT(11) NOT NULL,
      signerId INT(11) DEFAULT NULL,
      signerName VARCHAR(200) DEFAULT '',
      signatureData LONGTEXT NOT NULL,
      signTime DATETIME DEFAULT NULL,
      ipAddress VARCHAR(100) DEFAULT '',
      PRIMARY KEY (id),
      KEY idx_related (type, relatedId),
      KEY idx_signer (signerId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='签名记录表'`);
}

async function ensureTicketsTable(connection) {
  await connection.execute(`CREATE TABLE IF NOT EXISTS tickets (
      id INT(11) NOT NULL AUTO_INCREMENT,
      ticketNumber VARCHAR(100) NOT NULL,
      customerId INT(11) DEFAULT NULL,
      title VARCHAR(255) NOT NULL,
      category VARCHAR(50) DEFAULT 'other',
      priority VARCHAR(20) DEFAULT 'medium',
      status VARCHAR(50) DEFAULT 'new',
      ownerId INT(11) DEFAULT NULL,
      description TEXT DEFAULT NULL,
      solution TEXT DEFAULT NULL,
      attachments LONGTEXT DEFAULT NULL,
      history LONGTEXT DEFAULT NULL,
      satisfaction LONGTEXT DEFAULT NULL,
      createdBy INT(11) DEFAULT NULL,
      createdAt DATETIME NULL DEFAULT NULL,
      updatedAt DATETIME DEFAULT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uk_ticketNumber (ticketNumber),
      KEY idx_customerId (customerId),
      KEY idx_ownerId (ownerId),
      KEY idx_status (status),
      KEY idx_category (category)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='服务工单表'`);
}

async function ensureTodosTable(connection) {
  await connection.execute(`CREATE TABLE IF NOT EXISTS todos (
      id INT(11) NOT NULL AUTO_INCREMENT,
      type VARCHAR(50) NOT NULL,
      moduleType VARCHAR(50) DEFAULT NULL,
      moduleId INT(11) DEFAULT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT DEFAULT NULL,
      assigneeId INT(11) DEFAULT NULL,
      status VARCHAR(50) DEFAULT 'pending',
      priority VARCHAR(20) DEFAULT 'medium',
      dueDate DATETIME DEFAULT NULL,
      metadata LONGTEXT DEFAULT NULL,
      createdBy INT(11) DEFAULT NULL,
      createdAt DATETIME NULL DEFAULT NULL,
      updatedAt DATETIME DEFAULT NULL,
      PRIMARY KEY (id),
      KEY idx_assignee (assigneeId),
      KEY idx_status (status),
      KEY idx_priority (priority)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='待办事项表'`);
}

async function ensureTransferRulesTable(connection) {
  await connection.execute(`CREATE TABLE IF NOT EXISTS transfer_rules (
      id INT(11) NOT NULL AUTO_INCREMENT,
      name VARCHAR(200) NOT NULL,
      fromStatus VARCHAR(50) DEFAULT NULL,
      toStatus VARCHAR(50) DEFAULT NULL,
      conditions LONGTEXT DEFAULT NULL,
      autoTransfer TINYINT(1) DEFAULT 0,
      returnToPublic TINYINT(1) DEFAULT 0,
      daysThreshold INT(11) DEFAULT NULL,
      enabled TINYINT(1) DEFAULT 1,
      createdAt DATETIME NULL DEFAULT NULL,
      updatedAt DATETIME DEFAULT NULL,
      PRIMARY KEY (id),
      KEY idx_enabled (enabled)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='客户/商机流转规则表'`);
}

async function ensureWorkflowDefinitionsTable(connection) {
  await connection.execute(`CREATE TABLE IF NOT EXISTS workflow_definitions (
      id INT(11) NOT NULL AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL,
      code VARCHAR(100) NOT NULL,
      moduleType VARCHAR(100) NOT NULL,
      description TEXT DEFAULT NULL,
      version INT(11) DEFAULT 1,
      isActive TINYINT(1) DEFAULT 1,
      priority INT(11) DEFAULT 0,
      startNodeId INT(11) DEFAULT NULL,
      createdBy INT(11) DEFAULT NULL,
      createdAt DATETIME NULL DEFAULT NULL,
      updatedAt DATETIME DEFAULT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uk_workflow_code (code),
      KEY idx_moduleType (moduleType),
      KEY idx_isActive (isActive)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='工作流定义表'`);
}

async function ensureWorkflowInstancesTable(connection) {
  await connection.execute(`CREATE TABLE IF NOT EXISTS workflow_instances (
      id INT(11) NOT NULL AUTO_INCREMENT,
      workflowId INT(11) DEFAULT NULL,
      workflowCode VARCHAR(100) DEFAULT NULL,
      moduleType VARCHAR(100) NOT NULL,
      moduleId INT(11) NOT NULL,
      status VARCHAR(50) DEFAULT 'running',
      currentNodeId INT(11) DEFAULT NULL,
      currentNodeKey VARCHAR(100) DEFAULT NULL,
      initiatorId INT(11) DEFAULT NULL,
      metadata LONGTEXT DEFAULT NULL,
      startTime DATETIME NULL DEFAULT NULL,
      endTime DATETIME DEFAULT NULL,
      duration INT(11) DEFAULT NULL,
      createdAt DATETIME NULL DEFAULT NULL,
      updatedAt DATETIME DEFAULT NULL,
      PRIMARY KEY (id),
      KEY idx_workflow (workflowId),
      KEY idx_module (moduleType, moduleId),
      KEY idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='工作流实例表'`);
}

async function ensureWorkflowNodesTable(connection) {
  await connection.execute(`CREATE TABLE IF NOT EXISTS workflow_nodes (
      id INT(11) NOT NULL AUTO_INCREMENT,
      workflowId INT(11) NOT NULL,
      nodeKey VARCHAR(100) NOT NULL,
      nodeType VARCHAR(50) NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT DEFAULT NULL,
      position LONGTEXT DEFAULT NULL,
      config LONGTEXT DEFAULT NULL,
      sortOrder INT(11) DEFAULT 0,
      createdAt DATETIME NULL DEFAULT NULL,
      updatedAt DATETIME DEFAULT NULL,
      PRIMARY KEY (id),
      KEY idx_workflowId (workflowId),
      KEY idx_nodeKey (nodeKey)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='工作流节点表'`);
}

async function ensureWorkflowRoutesTable(connection) {
  await connection.execute(`CREATE TABLE IF NOT EXISTS workflow_routes (
      id INT(11) NOT NULL AUTO_INCREMENT,
      workflowId INT(11) NOT NULL,
      fromNodeId INT(11) DEFAULT NULL,
      toNodeId INT(11) DEFAULT NULL,
      conditionType VARCHAR(50) DEFAULT 'always',
      conditionConfig LONGTEXT DEFAULT NULL,
      sortOrder INT(11) DEFAULT 0,
      createdAt DATETIME NULL DEFAULT NULL,
      updatedAt DATETIME DEFAULT NULL,
      PRIMARY KEY (id),
      KEY idx_workflowId (workflowId),
      KEY idx_fromNode (fromNodeId),
      KEY idx_toNode (toNodeId)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='工作流路由表'`);
}
async function ensureDatabaseSchema() {
  const connection = await pool.getConnection();
  try {
    await ensureUsersColumns(connection);
    await ensureDepartmentsTableAndColumns(connection);
    await ensureDingTalkConfig(connection);
    await ensureApprovalWorkflows(connection);
    await ensureDashboardsTable(connection);
    await ensureProjectsTable(connection);
    await ensureProjectPhasesTable(connection);
    await ensureProjectTasksTable(connection);
    await ensureProjectLogsTable(connection);
    await ensureApprovalRecordsTable(connection);
    await ensureActivitiesTable(connection);
    await ensureCampaignsTable(connection);
    await ensureInvoicesTable(connection);
    await ensureLeadsTable(connection);
    await ensurePaymentsTable(connection);
    await ensurePaymentPlansTable(connection);
    await ensurePrintTemplatesTable(connection);
    await ensureRolesTable(connection);
    await ensureSignaturesTable(connection);
    await ensureTicketsTable(connection);
    await ensureTodosTable(connection);
    await ensureTransferRulesTable(connection);
    await ensureWorkflowDefinitionsTable(connection);
    await ensureWorkflowInstancesTable(connection);
    await ensureWorkflowNodesTable(connection);
    await ensureWorkflowRoutesTable(connection);
  } finally {
    connection.release();
  }
}

module.exports = { ensureDatabaseSchema };

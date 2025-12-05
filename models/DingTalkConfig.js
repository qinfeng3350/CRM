const { pool } = require('../config/database');

const DingTalkConfig = {
  // 获取钉钉配置
  async find() {
    const connection = await pool.getConnection();
    try {
      await ensureCardColumns(connection);
      const [rows] = await connection.execute('SELECT * FROM dingtalk_config LIMIT 1');
      if (rows.length === 0) return null;
      const config = rows[0];
        return {
          ...config,
          // 敏感信息不返回，只返回配置状态
          appKey: config.appKey ? '***' : null,
          appSecret: config.appSecret ? '***' : null,
          qrLoginAppKey: config.qrLoginAppKey ? '***' : null,
          qrLoginAppSecret: config.qrLoginAppSecret ? '***' : null,
          cardInstanceEnabled: !!config.cardInstanceEnabled,
          cardTemplateId: config.cardTemplateId || '',
          cardRouteKey: config.cardRouteKey || '',
        };
    } finally {
      connection.release();
    }
  },

  // 获取完整配置（包括密钥，仅用于内部调用）
  async findWithSecrets() {
    const connection = await pool.getConnection();
    try {
      await ensureCardColumns(connection);
      const [rows] = await connection.execute('SELECT * FROM dingtalk_config LIMIT 1');
      return rows.length > 0 ? rows[0] : null;
    } finally {
      connection.release();
    }
  },

  // 创建或更新配置
  async upsert(data) {
    const connection = await pool.getConnection();
    try {
      await ensureCardColumns(connection);

      const [rows] = await connection.execute('SELECT * FROM dingtalk_config LIMIT 1');
      let existing = rows.length > 0 ? rows[0] : null;

      if (!existing) {
        await connection.execute(
          `INSERT INTO dingtalk_config 
          (appKey, appSecret, qrLoginAppKey, qrLoginAppSecret, agentId, corpId, enabled, callbackUrl, frontendUrl, serverUrl, todoSyncEnabled, dingtalkApprovalEnabled, approvalProcessCode, cardTemplateId, cardRouteKey, cardInstanceEnabled, createdAt, updatedAt) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            data.appKey || null,
            data.appSecret || null,
            data.qrLoginAppKey || null,
            data.qrLoginAppSecret || null,
            data.agentId || null,
            data.corpId || null,
            data.enabled !== undefined ? data.enabled : 0,
            data.callbackUrl || null,
            data.frontendUrl || null,
            data.serverUrl || null,
            data.todoSyncEnabled !== undefined ? (data.todoSyncEnabled ? 1 : 0) : 1,
            data.dingtalkApprovalEnabled !== undefined ? (data.dingtalkApprovalEnabled ? 1 : 0) : 0,
            data.approvalProcessCode || null,
            data.cardTemplateId || null,
            data.cardRouteKey || null,
            data.cardInstanceEnabled ? 1 : 0,
          ]
        );
        const [inserted] = await connection.execute('SELECT * FROM dingtalk_config LIMIT 1');
        existing = inserted.length > 0 ? inserted[0] : null;
        if (!existing) {
          throw new Error('创建钉钉配置失败');
        }
      }

      const fields = [];
      const params = [];
      Object.keys(data).forEach((key) => {
        if (key !== 'id' && data[key] !== undefined) {
          const columnKey = key;
          let value = data[key];
          if (typeof value === 'boolean') {
            value = value ? 1 : 0;
          }
          fields.push(`${columnKey} = ?`);
          params.push(value);
        }
      });

      if (fields.length === 0) {
        return existing;
      }

      fields.push('updatedAt = NOW()');
      params.push(existing.id);

      await connection.execute(
        `UPDATE dingtalk_config SET ${fields.join(', ')} WHERE id = ?`,
        params
      );

      const [updated] = await connection.execute('SELECT * FROM dingtalk_config LIMIT 1');
      return updated.length > 0 ? updated[0] : null;
    } finally {
      connection.release();
    }
  },
};

module.exports = DingTalkConfig;

async function ensureCardColumns(connection) {
  const statements = [
    "ALTER TABLE dingtalk_config ADD COLUMN cardTemplateId VARCHAR(255) DEFAULT NULL COMMENT '钉钉互动卡片模板ID'",
    "ALTER TABLE dingtalk_config ADD COLUMN cardRouteKey VARCHAR(255) DEFAULT NULL COMMENT '钉钉互动卡片回调RouteKey'",
    "ALTER TABLE dingtalk_config ADD COLUMN cardInstanceEnabled TINYINT(1) DEFAULT 0 COMMENT '是否启用钉钉互动卡片推送'",
  ];

  for (const sql of statements) {
    await addColumnIfNotExists(connection, sql);
  }
}

async function addColumnIfNotExists(connection, statement) {
  try {
    await connection.execute(statement);
  } catch (error) {
    if (error.code !== 'ER_DUP_FIELDNAME' && error.errno !== 1060) {
      throw error;
    }
  }
}


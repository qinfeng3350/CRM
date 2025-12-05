const { pool } = require('../config/database');

const WorkflowRoute = {
  async findByWorkflowId(workflowId) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM workflow_routes WHERE workflowId = ? ORDER BY sortOrder',
        [workflowId]
      );
      return rows.map(row => ({
        ...row,
        conditionConfig: row.conditionConfig ? (typeof row.conditionConfig === 'string' ? JSON.parse(row.conditionConfig) : row.conditionConfig) : {}
      }));
    } finally {
      connection.release();
    }
  },

  async findById(id) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute('SELECT * FROM workflow_routes WHERE id = ?', [id]);
      if (rows[0]) {
        const row = rows[0];
        return {
          ...row,
          conditionConfig: row.conditionConfig ? (typeof row.conditionConfig === 'string' ? JSON.parse(row.conditionConfig) : row.conditionConfig) : {}
        };
      }
      return null;
    } finally {
      connection.release();
    }
  },

  async create(data) {
    const connection = await pool.getConnection();
    try {
      const sql = `INSERT INTO workflow_routes 
        (workflowId, fromNodeId, toNodeId, conditionType, conditionConfig, sortOrder) 
        VALUES (?, ?, ?, ?, ?, ?)`;
      const params = [
        data.workflowId,
        data.fromNodeId,
        data.toNodeId,
        data.conditionType || 'always',
        JSON.stringify(data.conditionConfig || {}),
        data.sortOrder || 0
      ];
      const [result] = await connection.execute(sql, params);
      return await this.findById(result.insertId);
    } finally {
      connection.release();
    }
  },

  async deleteByWorkflowId(workflowId, connection = null) {
    // 如果传入了连接，使用传入的连接（在事务中）
    // 否则创建新连接
    const shouldRelease = !connection;
    if (!connection) {
      connection = await pool.getConnection();
    }
    
    try {
      await connection.execute('DELETE FROM workflow_routes WHERE workflowId = ?', [workflowId]);
      return { workflowId };
    } catch (error) {
      console.error('删除工作流路由失败:', error);
      throw error;
    } finally {
      if (shouldRelease) {
        connection.release();
      }
    }
  }
};

module.exports = WorkflowRoute;


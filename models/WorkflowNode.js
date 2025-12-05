const { pool } = require('../config/database');

const WorkflowNode = {
  async findByWorkflowId(workflowId) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM workflow_nodes WHERE workflowId = ? ORDER BY sortOrder',
        [workflowId]
      );
      return rows.map(row => ({
        ...row,
        position: row.position ? (typeof row.position === 'string' ? JSON.parse(row.position) : row.position) : null,
        config: row.config ? (typeof row.config === 'string' ? JSON.parse(row.config) : row.config) : {}
      }));
    } finally {
      connection.release();
    }
  },

  async findById(id) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute('SELECT * FROM workflow_nodes WHERE id = ?', [id]);
      if (rows[0]) {
        const row = rows[0];
        return {
          ...row,
          position: row.position ? (typeof row.position === 'string' ? JSON.parse(row.position) : row.position) : null,
          config: row.config ? (typeof row.config === 'string' ? JSON.parse(row.config) : row.config) : {}
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
      const sql = `INSERT INTO workflow_nodes 
        (workflowId, nodeKey, nodeType, name, description, position, config, sortOrder) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
      const params = [
        data.workflowId,
        data.nodeKey,
        data.nodeType,
        data.name,
        data.description || '',
        JSON.stringify(data.position || {}),
        JSON.stringify(data.config || {}),
        data.sortOrder || 0
      ];
      const [result] = await connection.execute(sql, params);
      return await this.findById(result.insertId);
    } finally {
      connection.release();
    }
  },

  async findByIdAndUpdate(id, data) {
    const connection = await pool.getConnection();
    try {
      const fields = [];
      const params = [];
      
      Object.keys(data).forEach(key => {
        if (key === 'position' || key === 'config') {
          fields.push(`${key} = ?`);
          params.push(JSON.stringify(data[key]));
        } else if (key !== 'id' && data[key] !== undefined) {
          fields.push(`${key} = ?`);
          params.push(data[key]);
        }
      });
      
      if (fields.length === 0) return await this.findById(id);
      fields.push('updatedAt = NOW()');
      params.push(id);
      
      await connection.execute(`UPDATE workflow_nodes SET ${fields.join(', ')} WHERE id = ?`, params);
      return await this.findById(id);
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
      // 先删除引用该节点的路由（避免外键约束错误）
      // workflow_routes 表有外键引用 workflow_nodes
      await connection.execute(
        'DELETE FROM workflow_routes WHERE workflowId = ? AND (fromNodeId IN (SELECT id FROM workflow_nodes WHERE workflowId = ?) OR toNodeId IN (SELECT id FROM workflow_nodes WHERE workflowId = ?))',
        [workflowId, workflowId, workflowId]
      );
      
      // 或者更简单的方式：先查询节点ID，再删除路由
      const [nodes] = await connection.execute(
        'SELECT id FROM workflow_nodes WHERE workflowId = ?',
        [workflowId]
      );
      
      if (nodes.length > 0) {
        const nodeIds = nodes.map(n => n.id);
        // 删除引用这些节点的路由
        if (nodeIds.length > 0) {
          const placeholders = nodeIds.map(() => '?').join(',');
          await connection.execute(
            `DELETE FROM workflow_routes WHERE fromNodeId IN (${placeholders}) OR toNodeId IN (${placeholders})`,
            [...nodeIds, ...nodeIds]
          );
        }
      }
      
      // 然后删除节点
      await connection.execute('DELETE FROM workflow_nodes WHERE workflowId = ?', [workflowId]);
      return { workflowId };
    } catch (error) {
      console.error('删除工作流节点失败:', error);
      throw error;
    } finally {
      if (shouldRelease) {
        connection.release();
      }
    }
  }
};

module.exports = WorkflowNode;


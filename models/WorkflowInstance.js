const { pool } = require('../config/database');

const WorkflowInstance = {
  async find(query = {}) {
    const connection = await pool.getConnection();
    try {
      let sql = 'SELECT * FROM workflow_instances WHERE 1=1';
      const params = [];
      
      if (query.moduleType) {
        sql += ' AND moduleType = ?';
        params.push(query.moduleType);
      }
      if (query.moduleId) {
        sql += ' AND moduleId = ?';
        params.push(query.moduleId);
      }
      if (query.status) {
        sql += ' AND status = ?';
        params.push(query.status);
      }
      if (query.initiatorId) {
        sql += ' AND initiatorId = ?';
        params.push(query.initiatorId);
      }
      if (query.workflowId) {
        sql += ' AND workflowId = ?';
        params.push(query.workflowId);
      }
      
      sql += ' ORDER BY createdAt DESC';
      if (query.limit) {
        sql += ' LIMIT ?';
        params.push(parseInt(query.limit));
      }
      if (query.skip) {
        sql += ' OFFSET ?';
        params.push(parseInt(query.skip));
      }
      
      const [rows] = await connection.execute(sql, params);
      return rows.map(row => ({
        ...row,
        metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : {}
      }));
    } finally {
      connection.release();
    }
  },

  async findById(id) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute('SELECT * FROM workflow_instances WHERE id = ?', [id]);
      if (rows[0]) {
        const row = rows[0];
        return {
          ...row,
          metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : {}
        };
      }
      return null;
    } finally {
      connection.release();
    }
  },

  async findByModule(moduleType, moduleId) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM workflow_instances WHERE moduleType = ? AND moduleId = ? ORDER BY createdAt DESC LIMIT 1',
        [moduleType, moduleId]
      );
      if (rows[0]) {
        const row = rows[0];
        return {
          ...row,
          metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : {}
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
      const sql = `INSERT INTO workflow_instances 
        (workflowId, workflowCode, moduleType, moduleId, status, currentNodeId, currentNodeKey, initiatorId, metadata) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      const params = [
        data.workflowId,
        data.workflowCode,
        data.moduleType,
        data.moduleId,
        data.status || 'running',
        data.currentNodeId || null,
        data.currentNodeKey || null,
        data.initiatorId,
        JSON.stringify(data.metadata || {})
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
        if (key === 'metadata') {
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
      
      await connection.execute(`UPDATE workflow_instances SET ${fields.join(', ')} WHERE id = ?`, params);
      return await this.findById(id);
    } finally {
      connection.release();
    }
  },

  // 完成流程
  async complete(id, status = 'completed') {
    const connection = await pool.getConnection();
    try {
      const instance = await this.findById(id);
      if (!instance) return null;

      const startTime = new Date(instance.startTime);
      const endTime = new Date();
      const duration = Math.floor((endTime - startTime) / 1000);

      await connection.execute(
        'UPDATE workflow_instances SET status = ?, endTime = ?, duration = ?, updatedAt = NOW() WHERE id = ?',
        [status, endTime, duration, id]
      );

      return await this.findById(id);
    } finally {
      connection.release();
    }
  }
};

module.exports = WorkflowInstance;


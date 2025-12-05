const { pool } = require('../config/database');

const ApprovalWorkflow = {
  async find(query = {}) {
    const connection = await pool.getConnection();
    try {
      let sql = 'SELECT * FROM approval_workflows WHERE 1=1';
      const params = [];
      
      if (query.moduleType) {
        sql += ' AND moduleType = ?';
        params.push(query.moduleType);
      }
      if (query.isActive !== undefined) {
        sql += ' AND isActive = ?';
        params.push(query.isActive);
      }
      
      sql += ' ORDER BY priority DESC, createdAt DESC';
      if (query.limit) {
        sql += ' LIMIT ?';
        params.push(parseInt(query.limit));
      }
      if (query.skip) {
        sql += ' OFFSET ?';
        params.push(parseInt(query.skip));
      }
      
      const [rows] = await connection.execute(sql, params);
      // 解析JSON字段
      return rows.map(row => ({
        ...row,
        conditions: row.conditions ? (typeof row.conditions === 'string' ? JSON.parse(row.conditions) : row.conditions) : null,
        steps: row.steps ? (typeof row.steps === 'string' ? JSON.parse(row.steps) : row.steps) : []
      }));
    } finally {
      connection.release();
    }
  },

  async findById(id) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute('SELECT * FROM approval_workflows WHERE id = ?', [id]);
      if (rows[0]) {
        const row = rows[0];
        return {
          ...row,
          conditions: row.conditions ? (typeof row.conditions === 'string' ? JSON.parse(row.conditions) : row.conditions) : null,
          steps: row.steps ? (typeof row.steps === 'string' ? JSON.parse(row.steps) : row.steps) : []
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
      const sql = `INSERT INTO approval_workflows (name, moduleType, conditions, steps, isActive, priority, createdBy) 
                   VALUES (?, ?, ?, ?, ?, ?, ?)`;
      const params = [
        data.name,
        data.moduleType,
        JSON.stringify(data.conditions || {}),
        JSON.stringify(data.steps || []),
        data.isActive !== undefined ? data.isActive : true,
        data.priority || 0,
        data.createdBy || null
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
        if (key === 'conditions' || key === 'steps') {
          fields.push(`${key} = ?`);
          params.push(JSON.stringify(data[key]));
        } else if (key !== '_id' && key !== 'id') {
          fields.push(`${key} = ?`);
          params.push(data[key]);
        }
      });
      
      if (fields.length === 0) return await this.findById(id);
      fields.push('updatedAt = NOW()');
      params.push(id);
      
      await connection.execute(`UPDATE approval_workflows SET ${fields.join(', ')} WHERE id = ?`, params);
      return await this.findById(id);
    } finally {
      connection.release();
    }
  },

  async findByIdAndDelete(id) {
    const connection = await pool.getConnection();
    try {
      await connection.execute('DELETE FROM approval_workflows WHERE id = ?', [id]);
      return { id };
    } finally {
      connection.release();
    }
  },

  async findActiveWorkflow(moduleType, conditions = {}) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM approval_workflows WHERE moduleType = ? AND isActive = TRUE ORDER BY priority DESC LIMIT 1',
        [moduleType]
      );
      if (rows[0]) {
        const row = rows[0];
        // 检查条件是否匹配
        const workflowConditions = row.conditions ? (typeof row.conditions === 'string' ? JSON.parse(row.conditions) : row.conditions) : {};
        let matches = true;
        
        // 检查金额条件
        const hasMinAmount = workflowConditions.minAmount !== undefined && workflowConditions.minAmount !== null;
        const hasMaxAmount = workflowConditions.maxAmount !== undefined && workflowConditions.maxAmount !== null;
        const contractAmount = parseFloat(conditions.amount || 0);
        
        // 如果设置了最小金额，检查是否满足
        if (hasMinAmount && contractAmount < parseFloat(workflowConditions.minAmount)) {
          matches = false;
        }
        
        // 如果设置了最大金额，检查是否满足
        if (hasMaxAmount && contractAmount > parseFloat(workflowConditions.maxAmount)) {
          matches = false;
        }
        
        // 如果都没有设置金额条件，默认匹配
        if (!hasMinAmount && !hasMaxAmount) {
          matches = true;
        }
        
        if (matches) {
          return {
            ...row,
            conditions: workflowConditions,
            steps: row.steps ? (typeof row.steps === 'string' ? JSON.parse(row.steps) : row.steps) : []
          };
        }
      }
      return null;
    } finally {
      connection.release();
    }
  }
};

module.exports = ApprovalWorkflow;


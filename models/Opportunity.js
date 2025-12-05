const { pool } = require('../config/database');

const Opportunity = {
  // 查找商机
  async find(query = {}) {
    const connection = await pool.getConnection();
    try {
      let sql = 'SELECT * FROM opportunities WHERE 1=1';
      const params = [];
      
      if (query.customerId) {
        sql += ' AND customerId = ?';
        params.push(query.customerId);
      }
      if (query.ownerId) {
        sql += ' AND ownerId = ?';
        params.push(query.ownerId);
      }
      if (query.status) {
        sql += ' AND status = ?';
        params.push(query.status);
      }
      if (query.$or) {
        const orConditions = [];
        query.$or.forEach(condition => {
          if (condition.ownerId !== undefined) {
            if (condition.ownerId === null) {
              orConditions.push('ownerId IS NULL');
            } else {
              orConditions.push('ownerId = ?');
              params.push(condition.ownerId);
            }
          }
        });
        if (orConditions.length > 0) {
          sql += ' AND (' + orConditions.join(' OR ') + ')';
        }
      }
      // 处理日期查询（用于自动流转）
      if (query.lastFollowUpAt && query.lastFollowUpAt.$lt) {
        sql += ' AND (lastFollowUpAt IS NULL OR lastFollowUpAt < ?)';
        params.push(query.lastFollowUpAt.$lt);
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
      return rows;
    } finally {
      connection.release();
    }
  },

  // 根据ID查找商机
  async findById(id) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute('SELECT * FROM opportunities WHERE id = ?', [id]);
      return rows[0] || null;
    } finally {
      connection.release();
    }
  },

  // 创建商机
  async create(opportunityData) {
    const connection = await pool.getConnection();
    try {
      const sql = `INSERT INTO opportunities (customerId, name, amount, status, ownerId, probability, expectedCloseDate, actualCloseDate, description, source, products, transferHistory, lastTransferAt, lastFollowUpAt, nextFollowUpAt, createdBy, createdAt, updatedAt) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`;
      
      const params = [
        opportunityData.customerId,
        opportunityData.name,
        opportunityData.amount || 0,
        opportunityData.status || 'new',
        opportunityData.ownerId,
        opportunityData.probability || 0,
        opportunityData.expectedCloseDate || null,
        opportunityData.actualCloseDate || null,
        opportunityData.description || '',
        opportunityData.source || '',
        JSON.stringify(opportunityData.products || []),
        JSON.stringify(opportunityData.transferHistory || []),
        opportunityData.lastTransferAt || null,
        opportunityData.lastFollowUpAt || null,
        opportunityData.nextFollowUpAt || null,
        opportunityData.createdBy || null
      ];
      
      const [result] = await connection.execute(sql, params);
      return await this.findById(result.insertId);
    } finally {
      connection.release();
    }
  },

  // 更新商机
  async findByIdAndUpdate(id, updateData) {
    const connection = await pool.getConnection();
    try {
      const fields = [];
      const params = [];
      
      Object.keys(updateData).forEach(key => {
        if (key === 'products' && Array.isArray(updateData[key])) {
          fields.push('products = ?');
          params.push(JSON.stringify(updateData[key]));
        } else if (key === 'transferHistory' && Array.isArray(updateData[key])) {
          fields.push('transferHistory = ?');
          params.push(JSON.stringify(updateData[key]));
        } else if (key !== '_id' && key !== 'id') {
          fields.push(`${key} = ?`);
          params.push(updateData[key]);
        }
      });
      
      if (fields.length === 0) return await this.findById(id);
      
      fields.push('updatedAt = NOW()');
      params.push(id);
      
      const sql = `UPDATE opportunities SET ${fields.join(', ')} WHERE id = ?`;
      await connection.execute(sql, params);
      
      return await this.findById(id);
    } finally {
      connection.release();
    }
  },

  // 删除商机
  async findByIdAndDelete(id) {
    const connection = await pool.getConnection();
    try {
      await connection.execute('DELETE FROM opportunities WHERE id = ?', [id]);
      return { id };
    } finally {
      connection.release();
    }
  },

  // 统计数量
  async countDocuments(query = {}) {
    const connection = await pool.getConnection();
    try {
      let sql = 'SELECT COUNT(*) as count FROM opportunities WHERE 1=1';
      const params = [];
      
      if (query.customerId) {
        sql += ' AND customerId = ?';
        params.push(query.customerId);
      }
      if (query.ownerId) {
        sql += ' AND ownerId = ?';
        params.push(query.ownerId);
      }
      if (query.status) {
        sql += ' AND status = ?';
        params.push(query.status);
      }
      
      const [rows] = await connection.execute(sql, params);
      return rows[0].count;
    } finally {
      connection.release();
    }
  }
};

module.exports = Opportunity;

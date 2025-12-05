const { pool } = require('../config/database');

const Customer = {
  // 查找客户
  async find(query = {}) {
    const connection = await pool.getConnection();
    try {
      let sql = 'SELECT * FROM customers WHERE 1=1';
      const params = [];
      
      if (query.poolType) {
        sql += ' AND poolType = ?';
        params.push(query.poolType);
      }
      if (query.category) {
        sql += ' AND category = ?';
        params.push(query.category);
      }
      if (query.ownerId) {
        sql += ' AND ownerId = ?';
        params.push(query.ownerId);
      }
      if (query.$or) {
        // 处理 $or 查询（用于权限控制）
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
          if (condition.poolType) {
            orConditions.push('poolType = ?');
            params.push(condition.poolType);
          }
        });
        if (orConditions.length > 0) {
          sql += ' AND (' + orConditions.join(' OR ') + ')';
        }
      }
      if (query.search) {
        sql += ' AND (name LIKE ? OR company LIKE ? OR phone LIKE ?)';
        const searchTerm = `%${query.search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
      }
      if (query.$or && Array.isArray(query.$or)) {
        // 处理 MongoDB 风格的 $or 查询（用于搜索）
        const orConditions = [];
        query.$or.forEach(condition => {
          if (condition.name && condition.name.$regex) {
            orConditions.push('name LIKE ?');
            params.push(`%${condition.name.$regex}%`);
          }
          if (condition.company && condition.company.$regex) {
            orConditions.push('company LIKE ?');
            params.push(`%${condition.company.$regex}%`);
          }
          if (condition.phone && condition.phone.$regex) {
            orConditions.push('phone LIKE ?');
            params.push(`%${condition.phone.$regex}%`);
          }
        });
        if (orConditions.length > 0) {
          sql += ' AND (' + orConditions.join(' OR ') + ')';
        }
      }
      
      sql += ' ORDER BY updatedAt DESC';
      
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

  // 根据ID查找客户
  async findById(id) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute('SELECT * FROM customers WHERE id = ?', [id]);
      return rows[0] || null;
    } finally {
      connection.release();
    }
  },

  // 查找单个客户（支持多种条件）
  async findOne(query) {
    const connection = await pool.getConnection();
    try {
      let sql = 'SELECT * FROM customers WHERE 1=1';
      const params = [];
      
      if (query.email) {
        sql += ' AND email = ?';
        params.push(query.email);
      }
      if (query.id) {
        sql += ' AND id = ?';
        params.push(query.id);
      }
      if (query.name) {
        sql += ' AND name = ?';
        params.push(query.name);
      }
      
      sql += ' LIMIT 1';
      const [rows] = await connection.execute(sql, params);
      return rows[0] || null;
    } finally {
      connection.release();
    }
  },

  // 创建客户
  async create(customerData) {
    const connection = await pool.getConnection();
    try {
      const sql = `INSERT INTO customers (name, company, phone, email, address, poolType, ownerId, source, category, tags, industry, scale, description, lastContactAt, createdBy, createdAt, updatedAt) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`;
      
      const params = [
        customerData.name,
        customerData.company || '',
        customerData.phone || '',
        customerData.email || '',
        customerData.address || '',
        customerData.poolType || 'public',
        customerData.ownerId || null,
        customerData.source || '',
        customerData.category || 'potential',
        JSON.stringify(customerData.tags || []),
        customerData.industry || '',
        customerData.scale || 'small',
        customerData.description || '',
        customerData.lastContactAt || null,
        customerData.createdBy || null
      ];
      
      const [result] = await connection.execute(sql, params);
      return await this.findById(result.insertId);
    } finally {
      connection.release();
    }
  },

  // 更新客户
  async findByIdAndUpdate(id, updateData) {
    const connection = await pool.getConnection();
    try {
      const fields = [];
      const params = [];
      
      Object.keys(updateData).forEach(key => {
        if (key === 'tags' && Array.isArray(updateData[key])) {
          fields.push('tags = ?');
          params.push(JSON.stringify(updateData[key]));
        } else if (key !== '_id' && key !== 'id') {
          fields.push(`${key} = ?`);
          params.push(updateData[key]);
        }
      });
      
      if (fields.length === 0) return await this.findById(id);
      
      fields.push('updatedAt = NOW()');
      params.push(id);
      
      const sql = `UPDATE customers SET ${fields.join(', ')} WHERE id = ?`;
      await connection.execute(sql, params);
      
      return await this.findById(id);
    } finally {
      connection.release();
    }
  },

  // 删除客户
  async findByIdAndDelete(id) {
    const connection = await pool.getConnection();
    try {
      await connection.execute('DELETE FROM customers WHERE id = ?', [id]);
      return { id };
    } finally {
      connection.release();
    }
  },

  // 统计数量（使用与find相同的查询逻辑）
  async countDocuments(query = {}) {
    const connection = await pool.getConnection();
    try {
      let sql = 'SELECT COUNT(*) as count FROM customers WHERE 1=1';
      const params = [];
      
      if (query.poolType) {
        sql += ' AND poolType = ?';
        params.push(query.poolType);
      }
      if (query.category) {
        sql += ' AND category = ?';
        params.push(query.category);
      }
      if (query.ownerId) {
        sql += ' AND ownerId = ?';
        params.push(query.ownerId);
      }
      if (query.$or) {
        // 处理 $or 查询（用于权限控制）
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
          if (condition.poolType) {
            orConditions.push('poolType = ?');
            params.push(condition.poolType);
          }
        });
        if (orConditions.length > 0) {
          sql += ' AND (' + orConditions.join(' OR ') + ')';
        }
      }
      if (query.search) {
        sql += ' AND (name LIKE ? OR company LIKE ? OR phone LIKE ?)';
        const searchTerm = `%${query.search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
      }
      
      const [rows] = await connection.execute(sql, params);
      return rows[0].count;
    } finally {
      connection.release();
    }
  }
};

module.exports = Customer;

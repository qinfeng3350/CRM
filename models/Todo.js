const { pool } = require('../config/database');

const Todo = {
  async find(query = {}) {
    const connection = await pool.getConnection();
    try {
      let sql = 'SELECT * FROM todos WHERE 1=1';
      const params = [];
      
      if (query.assigneeId) {
        sql += ' AND assigneeId = ?';
        params.push(query.assigneeId);
      }
      if (query.status) {
        if (Array.isArray(query.status)) {
          // 支持多个状态值查询
          const placeholders = query.status.map(() => '?').join(',');
          sql += ` AND status IN (${placeholders})`;
          params.push(...query.status);
        } else {
          sql += ' AND status = ?';
          params.push(query.status);
        }
      } else {
        // 如果没有指定status，默认排除已取消和已完成的
        sql += ' AND status NOT IN ("cancelled", "completed")';
      }
      if (query.type) {
        sql += ' AND type = ?';
        params.push(query.type);
      }
      if (query.moduleType) {
        sql += ' AND moduleType = ?';
        params.push(query.moduleType);
      }
      if (query.moduleId) {
        sql += ' AND moduleId = ?';
        params.push(query.moduleId);
      }
      
      sql += ' ORDER BY FIELD(priority, "urgent", "high", "medium", "low"), createdAt DESC';
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
        metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : null
      }));
    } finally {
      connection.release();
    }
  },

  async findById(id) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute('SELECT * FROM todos WHERE id = ?', [id]);
      if (rows[0]) {
        const row = rows[0];
        return {
          ...row,
          metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : null
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
      const sql = `INSERT INTO todos (type, moduleType, moduleId, title, description, assigneeId, status, priority, dueDate, metadata, createdBy) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      const params = [
        data.type,
        data.moduleType,
        data.moduleId,
        data.title,
        data.description || '',
        data.assigneeId,
        data.status || 'pending',
        data.priority || 'medium',
        data.dueDate || null,
        JSON.stringify(data.metadata || {}),
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
        if (key === 'metadata') {
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
      
      await connection.execute(`UPDATE todos SET ${fields.join(', ')} WHERE id = ?`, params);
      return await this.findById(id);
    } finally {
      connection.release();
    }
  },

  async findByIdAndDelete(id) {
    const connection = await pool.getConnection();
    try {
      await connection.execute('DELETE FROM todos WHERE id = ?', [id]);
      return { id };
    } finally {
      connection.release();
    }
  },

  async countDocuments(query = {}) {
    const connection = await pool.getConnection();
    try {
      let sql = 'SELECT COUNT(*) as count FROM todos WHERE 1=1';
      const params = [];
      
      if (query.assigneeId) {
        sql += ' AND assigneeId = ?';
        params.push(query.assigneeId);
      }
      if (query.status) {
        if (Array.isArray(query.status)) {
          // 支持多个状态值查询
          const placeholders = query.status.map(() => '?').join(',');
          sql += ` AND status IN (${placeholders})`;
          params.push(...query.status);
        } else {
          sql += ' AND status = ?';
          params.push(query.status);
        }
      } else {
        // 如果没有指定status，默认排除已取消和已完成的
        sql += ' AND status NOT IN ("cancelled", "completed")';
      }
      if (query.type) {
        sql += ' AND type = ?';
        params.push(query.type);
      }
      
      const [rows] = await connection.execute(sql, params);
      return rows[0].count;
    } finally {
      connection.release();
    }
  }
};

module.exports = Todo;


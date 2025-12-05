const { pool } = require('../config/database');

const Ticket = {
  async find(query = {}) {
    const connection = await pool.getConnection();
    try {
      let sql = 'SELECT * FROM tickets WHERE 1=1';
      const params = [];
      if (query.ownerId) {
        sql += ' AND ownerId = ?';
        params.push(query.ownerId);
      }
      if (query.status) {
        sql += ' AND status = ?';
        params.push(query.status);
      }
      if (query.category) {
        sql += ' AND category = ?';
        params.push(query.category);
      }
      if (query.priority) {
        sql += ' AND priority = ?';
        params.push(query.priority);
      }
      if (query.customerId) {
        sql += ' AND customerId = ?';
        params.push(query.customerId);
      }
      if (query.$or) {
        const orConditions = [];
        query.$or.forEach(condition => {
          if (condition.ownerId !== undefined) {
            orConditions.push(condition.ownerId === null ? 'ownerId IS NULL' : 'ownerId = ?');
            if (condition.ownerId !== null) params.push(condition.ownerId);
          }
          if (condition.createdBy) {
            orConditions.push('createdBy = ?');
            params.push(condition.createdBy);
          }
        });
        if (orConditions.length > 0) sql += ' AND (' + orConditions.join(' OR ') + ')';
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

  async findById(id) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute('SELECT * FROM tickets WHERE id = ?', [id]);
      return rows[0] || null;
    } finally {
      connection.release();
    }
  },

  async create(data) {
    const connection = await pool.getConnection();
    try {
      const sql = `INSERT INTO tickets (ticketNumber, customerId, title, category, priority, status, ownerId, description, solution, attachments, history, satisfaction, createdBy, createdAt, updatedAt) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`;
      const params = [
        data.ticketNumber, data.customerId, data.title, data.category || 'other', data.priority || 'medium',
        data.status || 'new', data.ownerId || null, data.description, data.solution || '',
        JSON.stringify(data.attachments || []), JSON.stringify(data.history || []),
        JSON.stringify(data.satisfaction || null), data.createdBy || null
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
        if (['attachments', 'history', 'satisfaction'].includes(key) && (Array.isArray(data[key]) || typeof data[key] === 'object')) {
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
      await connection.execute(`UPDATE tickets SET ${fields.join(', ')} WHERE id = ?`, params);
      return await this.findById(id);
    } finally {
      connection.release();
    }
  },

  async findByIdAndDelete(id) {
    const connection = await pool.getConnection();
    try {
      await connection.execute('DELETE FROM tickets WHERE id = ?', [id]);
      return { id };
    } finally {
      connection.release();
    }
  },

  async countDocuments(query = {}) {
    const connection = await pool.getConnection();
    try {
      let sql = 'SELECT COUNT(*) as count FROM tickets WHERE 1=1';
      const params = [];
      if (query.ownerId) {
        sql += ' AND ownerId = ?';
        params.push(query.ownerId);
      }
      if (query.status) {
        sql += ' AND status = ?';
        params.push(query.status);
      }
      if (query.category) {
        sql += ' AND category = ?';
        params.push(query.category);
      }
      if (query.priority) {
        sql += ' AND priority = ?';
        params.push(query.priority);
      }
      if (query.$or) {
        const orConditions = [];
        query.$or.forEach(condition => {
          if (condition.ownerId !== undefined) {
            orConditions.push(condition.ownerId === null ? 'ownerId IS NULL' : 'ownerId = ?');
            if (condition.ownerId !== null) params.push(condition.ownerId);
          }
          if (condition.createdBy) {
            orConditions.push('createdBy = ?');
            params.push(condition.createdBy);
          }
        });
        if (orConditions.length > 0) {
          sql += ' AND (' + orConditions.join(' OR ') + ')';
        }
      }
      const [rows] = await connection.execute(sql, params);
      return rows[0].count;
    } finally {
      connection.release();
    }
  }
};

module.exports = Ticket;

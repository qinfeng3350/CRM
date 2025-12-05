const { pool } = require('../config/database');

const Activity = {
  async find(query = {}) {
    const connection = await pool.getConnection();
    try {
      let sql = 'SELECT * FROM activities WHERE 1=1';
      const params = [];
      if (query.userId) sql += ' AND userId = ?', params.push(query.userId);
      if (query.customerId) sql += ' AND customerId = ?', params.push(query.customerId);
      if (query.opportunityId) sql += ' AND opportunityId = ?', params.push(query.opportunityId);
      if (query.status) sql += ' AND status = ?', params.push(query.status);
      sql += ' ORDER BY startTime DESC';
      const [rows] = await connection.execute(sql, params);
      return rows;
    } finally {
      connection.release();
    }
  },

  async findById(id) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute('SELECT * FROM activities WHERE id = ?', [id]);
      return rows[0] || null;
    } finally {
      connection.release();
    }
  },

  async create(data) {
    const connection = await pool.getConnection();
    try {
      const sql = `INSERT INTO activities (type, customerId, opportunityId, contractId, title, description, userId, startTime, endTime, location, status, reminder, createdAt, updatedAt) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`;
      const params = [
        data.type, data.customerId || null, data.opportunityId || null, data.contractId || null,
        data.title, data.description || '', data.userId, data.startTime || null, data.endTime || null,
        data.location || '', data.status || 'planned', JSON.stringify(data.reminder || null)
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
        if (key === 'reminder' && typeof data[key] === 'object') {
          fields.push('reminder = ?');
          params.push(JSON.stringify(data[key]));
        } else if (key !== '_id' && key !== 'id') {
          fields.push(`${key} = ?`);
          params.push(data[key]);
        }
      });
      if (fields.length === 0) return await this.findById(id);
      fields.push('updatedAt = NOW()');
      params.push(id);
      await connection.execute(`UPDATE activities SET ${fields.join(', ')} WHERE id = ?`, params);
      return await this.findById(id);
    } finally {
      connection.release();
    }
  }
};

module.exports = Activity;

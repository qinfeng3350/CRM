const { pool } = require('../config/database');

const Campaign = {
  async find(query = {}) {
    const connection = await pool.getConnection();
    try {
      let sql = 'SELECT * FROM campaigns WHERE 1=1';
      const params = [];
      if (query.status) {
        sql += ' AND status = ?';
        params.push(query.status);
      }
      if (query.type) {
        sql += ' AND type = ?';
        params.push(query.type);
      }
      if (query.createdBy) {
        sql += ' AND createdBy = ?';
        params.push(query.createdBy);
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
      const [rows] = await connection.execute('SELECT * FROM campaigns WHERE id = ?', [id]);
      return rows[0] || null;
    } finally {
      connection.release();
    }
  },

  async create(data) {
    const connection = await pool.getConnection();
    try {
      const sql = `INSERT INTO campaigns (name, type, status, startDate, endDate, budget, actualCost, targetAudience, description, participants, leadsGenerated, conversionRate, roi, createdBy, createdAt, updatedAt) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`;
      const params = [
        data.name, 
        data.type || 'other', 
        data.status || 'planned', 
        data.startDate ? `${data.startDate} 00:00:00` : null, 
        data.endDate ? `${data.endDate} 00:00:00` : null,
        data.budget || 0, 
        data.actualCost || 0, 
        data.targetAudience || '', 
        data.description || '',
        JSON.stringify(data.participants || []), 
        data.leadsGenerated || 0, 
        data.conversionRate || 0,
        data.roi || 0, 
        data.createdBy
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
        if (key === 'participants' && Array.isArray(data[key])) {
          fields.push('participants = ?');
          params.push(JSON.stringify(data[key]));
        } else if (key === 'startDate' || key === 'endDate') {
          fields.push(`${key} = ?`);
          params.push(data[key] ? `${data[key]} 00:00:00` : null);
        } else if (key !== '_id' && key !== 'id') {
          fields.push(`${key} = ?`);
          params.push(data[key]);
        }
      });
      if (fields.length === 0) return await this.findById(id);
      fields.push('updatedAt = NOW()');
      params.push(id);
      await connection.execute(`UPDATE campaigns SET ${fields.join(', ')} WHERE id = ?`, params);
      return await this.findById(id);
    } finally {
      connection.release();
    }
  },

  async findByIdAndDelete(id) {
    const connection = await pool.getConnection();
    try {
      await connection.execute('DELETE FROM campaigns WHERE id = ?', [id]);
      return { id };
    } finally {
      connection.release();
    }
  },

  async countDocuments(query = {}) {
    const connection = await pool.getConnection();
    try {
      let sql = 'SELECT COUNT(*) as count FROM campaigns WHERE 1=1';
      const params = [];
      if (query.status) {
        sql += ' AND status = ?';
        params.push(query.status);
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

module.exports = Campaign;

const { pool } = require('../config/database');

const TransferRule = {
  async find(query = {}) {
    const connection = await pool.getConnection();
    try {
      let sql = 'SELECT * FROM transfer_rules WHERE 1=1';
      const params = [];
      if (query.enabled !== undefined) {
        sql += ' AND enabled = ?';
        params.push(query.enabled);
      }
      if (query.autoTransfer !== undefined) {
        sql += ' AND autoTransfer = ?';
        params.push(query.autoTransfer);
      }
      sql += ' ORDER BY createdAt DESC';
      const [rows] = await connection.execute(sql, params);
      return rows;
    } finally {
      connection.release();
    }
  },

  async findById(id) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute('SELECT * FROM transfer_rules WHERE id = ?', [id]);
      return rows[0] || null;
    } finally {
      connection.release();
    }
  },

  async create(data) {
    const connection = await pool.getConnection();
    try {
      const sql = `INSERT INTO transfer_rules (name, fromStatus, toStatus, conditions, autoTransfer, returnToPublic, daysThreshold, enabled, createdAt, updatedAt) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`;
      const params = [
        data.name, data.fromStatus, data.toStatus, JSON.stringify(data.conditions || {}),
        data.autoTransfer || false, data.returnToPublic || false, data.daysThreshold || null, data.enabled !== false
      ];
      const [result] = await connection.execute(sql, params);
      const created = await this.findById(result.insertId);
      return {
        ...created,
        conditions: created.conditions ? (typeof created.conditions === 'string' ? JSON.parse(created.conditions) : created.conditions) : {},
      };
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
        if (key === 'conditions' && typeof data[key] === 'object') {
          fields.push('conditions = ?');
          params.push(JSON.stringify(data[key]));
        } else if (key !== 'id' && key !== '_id') {
          fields.push(`${key} = ?`);
          params.push(data[key]);
        }
      });
      
      if (fields.length === 0) return await this.findById(id);
      
      fields.push('updatedAt = NOW()');
      params.push(id);
      
      await connection.execute(`UPDATE transfer_rules SET ${fields.join(', ')} WHERE id = ?`, params);
      return await this.findById(id);
    } finally {
      connection.release();
    }
  },

  async findByIdAndDelete(id) {
    const connection = await pool.getConnection();
    try {
      await connection.execute('DELETE FROM transfer_rules WHERE id = ?', [id]);
      return { id };
    } finally {
      connection.release();
    }
  }
};

module.exports = TransferRule;

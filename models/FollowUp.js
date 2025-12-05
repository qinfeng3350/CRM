const { pool } = require('../config/database');

const FollowUp = {
  async find(query = {}) {
    const connection = await pool.getConnection();
    try {
      let sql = 'SELECT f.*, u.name as userName FROM follow_ups f LEFT JOIN users u ON f.userId = u.id WHERE 1=1';
      const params = [];
      
      if (query.type) {
        sql += ' AND f.type = ?';
        params.push(query.type);
      }
      if (query.relatedId) {
        sql += ' AND f.relatedId = ?';
        params.push(query.relatedId);
      }
      if (query.userId) {
        sql += ' AND f.userId = ?';
        params.push(query.userId);
      }
      if (query.followUpType) {
        sql += ' AND f.followUpType = ?';
        params.push(query.followUpType);
      }
      
      sql += ' ORDER BY f.createdAt DESC';
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
        attachments: row.attachments ? (typeof row.attachments === 'string' ? JSON.parse(row.attachments) : row.attachments) : []
      }));
    } finally {
      connection.release();
    }
  },

  async findById(id) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT f.*, u.name as userName FROM follow_ups f LEFT JOIN users u ON f.userId = u.id WHERE f.id = ?',
        [id]
      );
      if (rows[0]) {
        const row = rows[0];
        return {
          ...row,
          attachments: row.attachments ? (typeof row.attachments === 'string' ? JSON.parse(row.attachments) : row.attachments) : []
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
      const sql = `INSERT INTO follow_ups (type, relatedId, title, content, followUpType, nextFollowUpAt, userId, attachments, isImportant) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      const params = [
        data.type,
        data.relatedId,
        data.title,
        data.content,
        data.followUpType || 'note',
        data.nextFollowUpAt || null,
        data.userId,
        JSON.stringify(data.attachments || []),
        data.isImportant || false
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
        if (key === 'attachments') {
          fields.push(`${key} = ?`);
          params.push(JSON.stringify(data[key]));
        } else if (key !== '_id' && key !== 'id' && key !== 'userName') {
          fields.push(`${key} = ?`);
          params.push(data[key]);
        }
      });
      
      if (fields.length === 0) return await this.findById(id);
      fields.push('updatedAt = NOW()');
      params.push(id);
      
      await connection.execute(`UPDATE follow_ups SET ${fields.join(', ')} WHERE id = ?`, params);
      return await this.findById(id);
    } finally {
      connection.release();
    }
  },

  async findByIdAndDelete(id) {
    const connection = await pool.getConnection();
    try {
      await connection.execute('DELETE FROM follow_ups WHERE id = ?', [id]);
      return { id };
    } finally {
      connection.release();
    }
  }
};

module.exports = FollowUp;


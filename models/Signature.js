const { pool } = require('../config/database');

const Signature = {
  async find(query = {}) {
    const connection = await pool.getConnection();
    try {
      let sql = `SELECT s.*, u.name as signerName 
                 FROM signatures s
                 LEFT JOIN users u ON s.signerId = u.id
                 WHERE 1=1`;
      const params = [];
      
      if (query.type) {
        sql += ' AND s.type = ?';
        params.push(query.type);
      }
      if (query.relatedId) {
        sql += ' AND s.relatedId = ?';
        params.push(query.relatedId);
      }
      if (query.signerId) {
        sql += ' AND s.signerId = ?';
        params.push(query.signerId);
      }
      
      sql += ' ORDER BY s.signTime DESC';
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
      const [rows] = await connection.execute(
        `SELECT s.*, u.name as signerName 
         FROM signatures s
         LEFT JOIN users u ON s.signerId = u.id
         WHERE s.id = ?`,
        [id]
      );
      return rows[0] || null;
    } finally {
      connection.release();
    }
  },

  async create(data) {
    const connection = await pool.getConnection();
    try {
      const sql = `INSERT INTO signatures (type, relatedId, signerId, signerName, signatureData, signTime, ipAddress) 
                   VALUES (?, ?, ?, ?, ?, ?, ?)`;
      const params = [
        data.type,
        data.relatedId,
        data.signerId,
        data.signerName,
        data.signatureData,
        data.signTime || new Date(),
        data.ipAddress || ''
      ];
      const [result] = await connection.execute(sql, params);
      return await this.findById(result.insertId);
    } finally {
      connection.release();
    }
  },

  async findByRelated(type, relatedId) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT s.*, u.name as signerName 
         FROM signatures s
         LEFT JOIN users u ON s.signerId = u.id
         WHERE s.type = ? AND s.relatedId = ?
         ORDER BY s.signTime ASC`,
        [type, relatedId]
      );
      return rows;
    } finally {
      connection.release();
    }
  }
};

module.exports = Signature;


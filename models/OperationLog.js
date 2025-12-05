const { pool } = require('../config/database');

const OperationLog = {
  async create(data) {
    const connection = await pool.getConnection();
    try {
      const sql = `INSERT INTO operation_logs (moduleType, moduleId, action, userId, userName, description, oldData, newData, ipAddress, userAgent) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      const params = [
        data.moduleType,
        data.moduleId || null,
        data.action,
        data.userId,
        data.userName || '',
        data.description || '',
        JSON.stringify(data.oldData || {}),
        JSON.stringify(data.newData || {}),
        data.ipAddress || '',
        data.userAgent || ''
      ];
      const [result] = await connection.execute(sql, params);
      return { id: result.insertId };
    } finally {
      connection.release();
    }
  },

  async find(query = {}) {
    const connection = await pool.getConnection();
    try {
      let sql = 'SELECT * FROM operation_logs WHERE 1=1';
      const params = [];
      
      if (query.moduleType) {
        sql += ' AND moduleType = ?';
        params.push(query.moduleType);
      }
      if (query.moduleId) {
        sql += ' AND moduleId = ?';
        params.push(query.moduleId);
      }
      if (query.userId) {
        sql += ' AND userId = ?';
        params.push(query.userId);
      }
      if (query.action) {
        sql += ' AND action = ?';
        params.push(query.action);
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
      return rows.map(row => ({
        ...row,
        oldData: row.oldData ? (typeof row.oldData === 'string' ? JSON.parse(row.oldData) : row.oldData) : {},
        newData: row.newData ? (typeof row.newData === 'string' ? JSON.parse(row.newData) : row.newData) : {}
      }));
    } finally {
      connection.release();
    }
  }
};

module.exports = OperationLog;


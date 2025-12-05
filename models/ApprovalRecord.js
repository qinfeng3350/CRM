const { pool } = require('../config/database');

const ApprovalRecord = {
  async find(query = {}) {
    const connection = await pool.getConnection();
    try {
      let sql = 'SELECT * FROM approval_records WHERE 1=1';
      const params = [];
      
      if (query.moduleType) {
        sql += ' AND moduleType = ?';
        params.push(query.moduleType);
      }
      if (query.moduleId) {
        sql += ' AND moduleId = ?';
        params.push(query.moduleId);
      }
      if (query.approverId) {
        sql += ' AND approverId = ?';
        params.push(query.approverId);
      }
      if (query.action) {
        sql += ' AND action = ?';
        params.push(query.action);
      }
      
      sql += ' ORDER BY stepIndex ASC, createdAt ASC';
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
      const [rows] = await connection.execute('SELECT * FROM approval_records WHERE id = ?', [id]);
      return rows[0] || null;
    } finally {
      connection.release();
    }
  },

  async create(data) {
    const connection = await pool.getConnection();
    try {
      const sql = `INSERT INTO approval_records (workflowId, moduleType, moduleId, stepIndex, approverId, action, comment) 
                   VALUES (?, ?, ?, ?, ?, ?, ?)`;
      const params = [
        data.workflowId || null,
        data.moduleType,
        data.moduleId,
        data.stepIndex,
        data.approverId,
        data.action || 'pending',
        data.comment || ''
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
        if (key !== '_id' && key !== 'id') {
          fields.push(`${key} = ?`);
          params.push(data[key]);
        }
      });
      
      if (fields.length === 0) return await this.findById(id);
      fields.push('updatedAt = NOW()');
      params.push(id);
      
      await connection.execute(`UPDATE approval_records SET ${fields.join(', ')} WHERE id = ?`, params);
      return await this.findById(id);
    } finally {
      connection.release();
    }
  },

  async findByModule(moduleType, moduleId) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM approval_records WHERE moduleType = ? AND moduleId = ? ORDER BY stepIndex ASC, createdAt ASC',
        [moduleType, moduleId]
      );
      return rows;
    } finally {
      connection.release();
    }
  }
};

module.exports = ApprovalRecord;


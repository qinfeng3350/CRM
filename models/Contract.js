const { pool } = require('../config/database');

const Contract = {
  async find(query = {}) {
    const connection = await pool.getConnection();
    try {
      let sql = `
        SELECT c.*, cust.name AS customerName
        FROM contracts c
        LEFT JOIN customers cust ON c.customerId = cust.id
        WHERE 1=1`;
      const params = [];
      
      if (query.ownerId) { sql += ' AND c.ownerId = ?'; params.push(query.ownerId); }
      if (query.status) { sql += ' AND c.status = ?'; params.push(query.status); }
      if (query.customerId) { sql += ' AND c.customerId = ?'; params.push(query.customerId); }
      
      sql += ' ORDER BY c.createdAt DESC';
      if (query.limit) { sql += ' LIMIT ?'; params.push(parseInt(query.limit)); }
      if (query.skip) { sql += ' OFFSET ?'; params.push(parseInt(query.skip)); }
      
      const [rows] = await connection.execute(sql, params);
      return rows;
    } finally {
      connection.release();
    }
  },

  async findById(id) {
    const connection = await pool.getConnection();
    try {
      const sql = `
        SELECT c.*, cust.name AS customerName
        FROM contracts c
        LEFT JOIN customers cust ON c.customerId = cust.id
        WHERE c.id = ?`;
      const [rows] = await connection.execute(sql, [id]);
      return rows[0] || null;
    } finally {
      connection.release();
    }
  },

  async create(data) {
    const connection = await pool.getConnection();
    try {
      const sql = `INSERT INTO contracts (opportunityId, customerId, contractNumber, title, amount, status, ownerId, signDate, startDate, endDate, content, paymentPlan, attachments, approvalHistory, contractType, signers, signatures, createdBy, createdAt, updatedAt) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`;
      const params = [
        data.opportunityId || null, data.customerId, data.contractNumber, data.title, data.amount || 0,
        data.status || 'draft', data.ownerId, data.signDate || null, data.startDate || null, data.endDate || null,
        data.content || '', JSON.stringify(data.paymentPlan || []), JSON.stringify(data.attachments || []),
        JSON.stringify(data.approvalHistory || []), data.contractType || null,
        JSON.stringify(data.signers || []), JSON.stringify(data.signatures || []), data.createdBy || null
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
        if (['paymentPlan', 'attachments', 'approvalHistory', 'signers', 'signatures'].includes(key) && (Array.isArray(data[key]) || typeof data[key] === 'object')) {
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
      await connection.execute(`UPDATE contracts SET ${fields.join(', ')} WHERE id = ?`, params);
      return await this.findById(id);
    } finally {
      connection.release();
    }
  },

  async findByIdAndDelete(id) {
    const connection = await pool.getConnection();
    try {
      await connection.execute('DELETE FROM contracts WHERE id = ?', [id]);
      return { id };
    } finally {
      connection.release();
    }
  },

  async countDocuments(query = {}) {
    const connection = await pool.getConnection();
    try {
      let sql = 'SELECT COUNT(*) as count FROM contracts WHERE 1=1';
      const params = [];
      if (query.ownerId) sql += ' AND ownerId = ?', params.push(query.ownerId);
      if (query.status) sql += ' AND status = ?', params.push(query.status);
      const [rows] = await connection.execute(sql, params);
      return rows[0].count;
    } finally {
      connection.release();
    }
  }
};

module.exports = Contract;

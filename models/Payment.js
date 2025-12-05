const { pool } = require('../config/database');

const Payment = {
  async find(query = {}) {
    const connection = await pool.getConnection();
    try {
      let sql = `SELECT p.*, c.contractNumber, c.title as contractTitle 
                 FROM payments p
                 LEFT JOIN contracts c ON p.contractId = c.id
                 WHERE 1=1`;
      const params = [];
      
      if (query.contractId) {
        sql += ' AND p.contractId = ?';
        params.push(query.contractId);
      }
      if (query.planId) {
        sql += ' AND p.planId = ?';
        params.push(query.planId);
      }
      
      sql += ' ORDER BY p.paymentDate DESC';
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
        `SELECT p.*, c.contractNumber, c.title as contractTitle 
         FROM payments p
         LEFT JOIN contracts c ON p.contractId = c.id
         WHERE p.id = ?`,
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
      if (!data.paymentNumber) {
        const count = await this.countDocuments({});
        data.paymentNumber = `PAY-${Date.now()}-${count + 1}`;
      }
      
      const sql = `INSERT INTO payments (contractId, planId, paymentNumber, paymentDate, amount, currency, paymentMethod, bankAccount, receiptNumber, description, attachments, createdBy, createdAt, updatedAt) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`;
      const params = [
        data.contractId,
        data.planId || null,
        data.paymentNumber,
        data.paymentDate ? `${data.paymentDate} 00:00:00` : null,
        data.amount,
        data.currency || 'CNY',
        data.paymentMethod || 'bank_transfer',
        data.bankAccount || '',
        data.receiptNumber || '',
        data.description || '',
        JSON.stringify(data.attachments || []),
        data.createdBy || null
      ];
      const [result] = await connection.execute(sql, params);
      
      // 更新回款计划
      if (data.planId) {
        await connection.execute(
          'UPDATE payment_plans SET receivedAmount = receivedAmount + ? WHERE id = ?',
          [data.amount, data.planId]
        );
      }
      
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
        } else if (key !== '_id' && key !== 'id' && !key.endsWith('Title') && !key.endsWith('Number')) {
          fields.push(`${key} = ?`);
          params.push(data[key]);
        }
      });
      
      if (fields.length === 0) return await this.findById(id);
      fields.push('updatedAt = NOW()');
      params.push(id);
      
      await connection.execute(`UPDATE payments SET ${fields.join(', ')} WHERE id = ?`, params);
      return await this.findById(id);
    } finally {
      connection.release();
    }
  },

  async findByIdAndDelete(id) {
    const connection = await pool.getConnection();
    try {
      const payment = await this.findById(id);
      await connection.execute('DELETE FROM payments WHERE id = ?', [id]);
      
      // 更新回款计划
      if (payment && payment.planId) {
        await connection.execute(
          'UPDATE payment_plans SET receivedAmount = GREATEST(0, receivedAmount - ?) WHERE id = ?',
          [payment.amount, payment.planId]
        );
      }
      
      return { id };
    } finally {
      connection.release();
    }
  },

  async countDocuments(query = {}) {
    const connection = await pool.getConnection();
    try {
      let sql = 'SELECT COUNT(*) as count FROM payments WHERE 1=1';
      const params = [];
      
      if (query.contractId) {
        sql += ' AND contractId = ?';
        params.push(query.contractId);
      }
      
      const [rows] = await connection.execute(sql, params);
      return rows[0].count;
    } finally {
      connection.release();
    }
  }
};

module.exports = Payment;


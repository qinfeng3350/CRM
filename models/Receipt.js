const { pool } = require('../config/database');

const Receipt = {
  // 查找收款单
  async find(query = {}) {
    const connection = await pool.getConnection();
    try {
      let sql = `SELECT r.*, c.name as customerName, oo.orderNumber as outboundOrderNumber, u.name as createdByName 
                 FROM receipts r 
                 LEFT JOIN customers c ON r.customerId = c.id 
                 LEFT JOIN outbound_orders oo ON r.outboundOrderId = oo.id 
                 LEFT JOIN users u ON r.createdBy = u.id 
                 WHERE 1=1`;
      const params = [];
      
      if (query.receiptNumber) {
        sql += ' AND r.receiptNumber LIKE ?';
        params.push(`%${query.receiptNumber}%`);
      }
      if (query.customerId) {
        sql += ' AND r.customerId = ?';
        params.push(query.customerId);
      }
      if (query.startDate) {
        sql += ' AND r.receiptDate >= ?';
        params.push(query.startDate);
      }
      if (query.endDate) {
        sql += ' AND r.receiptDate <= ?';
        params.push(query.endDate);
      }
      
      sql += ' ORDER BY r.createdAt DESC';
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
        `SELECT r.*, c.name as customerName, oo.orderNumber as outboundOrderNumber, u.name as createdByName 
         FROM receipts r 
         LEFT JOIN customers c ON r.customerId = c.id 
         LEFT JOIN outbound_orders oo ON r.outboundOrderId = oo.id 
         LEFT JOIN users u ON r.createdBy = u.id 
         WHERE r.id = ?`,
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
      const sql = `INSERT INTO receipts (receiptNumber, customerId, outboundOrderId, receiptDate, amount, 
                   paymentMethod, bankAccount, receiptNote, notes, createdBy, createdAt, updatedAt) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`;
      const params = [
        data.receiptNumber,
        data.customerId || null,
        data.outboundOrderId || null,
        data.receiptDate || new Date(),
        data.amount || 0,
        data.paymentMethod || 'bank_transfer',
        data.bankAccount || '',
        data.receiptNote || '',
        data.notes || '',
        data.createdBy || null
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
        if (key !== '_id' && key !== 'id' && key !== 'customerName' && key !== 'outboundOrderNumber' && key !== 'createdByName') {
          fields.push(`${key} = ?`);
          params.push(data[key]);
        }
      });
      
      if (fields.length === 0) return await this.findById(id);
      fields.push('updatedAt = NOW()');
      params.push(id);
      
      await connection.execute(`UPDATE receipts SET ${fields.join(', ')} WHERE id = ?`, params);
      return await this.findById(id);
    } finally {
      connection.release();
    }
  },

  async findByIdAndDelete(id) {
    const connection = await pool.getConnection();
    try {
      await connection.execute('DELETE FROM receipts WHERE id = ?', [id]);
      return { id };
    } finally {
      connection.release();
    }
  },

  async countDocuments(query = {}) {
    const connection = await pool.getConnection();
    try {
      let sql = 'SELECT COUNT(*) as count FROM receipts WHERE 1=1';
      const params = [];
      
      if (query.customerId) {
        sql += ' AND customerId = ?';
        params.push(query.customerId);
      }
      
      const [rows] = await connection.execute(sql, params);
      return rows[0].count;
    } finally {
      connection.release();
    }
  }
};

module.exports = Receipt;


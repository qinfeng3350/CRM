const { pool } = require('../config/database');

const Invoice = {
  async find(query = {}) {
    const connection = await pool.getConnection();
    try {
      let sql = `SELECT i.*, c.contractNumber, c.title as contractTitle 
                 FROM invoices i
                 LEFT JOIN contracts c ON i.contractId = c.id
                 WHERE 1=1`;
      const params = [];
      
      if (query.contractId) {
        sql += ' AND i.contractId = ?';
        params.push(query.contractId);
      }
      if (query.paymentId) {
        sql += ' AND i.paymentId = ?';
        params.push(query.paymentId);
      }
      if (query.status) {
        sql += ' AND i.status = ?';
        params.push(query.status);
      }
      
      sql += ' ORDER BY i.invoiceDate DESC';
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
        `SELECT i.*, c.contractNumber, c.title as contractTitle 
         FROM invoices i
         LEFT JOIN contracts c ON i.contractId = c.id
         WHERE i.id = ?`,
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
      if (!data.invoiceNumber) {
        const count = await this.countDocuments({});
        data.invoiceNumber = `INV-${Date.now()}-${count + 1}`;
      }
      
      const sql = `INSERT INTO invoices (contractId, paymentId, invoiceNumber, invoiceType, invoiceDate, amount, taxAmount, totalAmount, taxRate, status, buyerName, buyerTaxNumber, buyerAddress, buyerPhone, buyerBank, buyerAccount, description, attachments, createdBy, createdAt, updatedAt) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`;
      const params = [
        data.contractId,
        data.paymentId || null,
        data.invoiceNumber,
        data.invoiceType || 'normal',
        data.invoiceDate ? `${data.invoiceDate} 00:00:00` : null,
        data.amount,
        data.taxAmount || 0,
        data.totalAmount || data.amount,
        data.taxRate || 0,
        data.status || 'draft',
        data.buyerName,
        data.buyerTaxNumber || '',
        data.buyerAddress || '',
        data.buyerPhone || '',
        data.buyerBank || '',
        data.buyerAccount || '',
        data.description || '',
        JSON.stringify(data.attachments || []),
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
      
      await connection.execute(`UPDATE invoices SET ${fields.join(', ')} WHERE id = ?`, params);
      return await this.findById(id);
    } finally {
      connection.release();
    }
  },

  async findByIdAndDelete(id) {
    const connection = await pool.getConnection();
    try {
      await connection.execute('DELETE FROM invoices WHERE id = ?', [id]);
      return { id };
    } finally {
      connection.release();
    }
  },

  async countDocuments(query = {}) {
    const connection = await pool.getConnection();
    try {
      let sql = 'SELECT COUNT(*) as count FROM invoices WHERE 1=1';
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

module.exports = Invoice;


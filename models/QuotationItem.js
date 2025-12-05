const { pool } = require('../config/database');

const QuotationItem = {
  async findByQuotationId(quotationId) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM quotation_items WHERE quotationId = ? ORDER BY sortOrder ASC, id ASC',
        [quotationId]
      );
      return rows;
    } finally {
      connection.release();
    }
  },

  async create(data) {
    const connection = await pool.getConnection();
    try {
      const sql = `INSERT INTO quotation_items (quotationId, productId, productName, productCode, quantity, unitPrice, discount, amount, description, sortOrder) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      const params = [
        data.quotationId,
        data.productId,
        data.productName,
        data.productCode || '',
        data.quantity,
        data.unitPrice,
        data.discount || 0,
        data.amount,
        data.description || '',
        data.sortOrder || 0
      ];
      const [result] = await connection.execute(sql, params);
      return { id: result.insertId, ...data };
    } finally {
      connection.release();
    }
  },

  async createBatch(items) {
    const connection = await pool.getConnection();
    try {
      if (items.length === 0) return [];
      
      // 先删除旧的
      await connection.execute('DELETE FROM quotation_items WHERE quotationId = ?', [items[0].quotationId]);
      
      // 批量插入
      const sql = `INSERT INTO quotation_items (quotationId, productId, productName, productCode, quantity, unitPrice, discount, amount, description, sortOrder) 
                   VALUES ?`;
      const values = items.map(item => [
        item.quotationId,
        item.productId,
        item.productName,
        item.productCode || '',
        item.quantity,
        item.unitPrice,
        item.discount || 0,
        item.amount,
        item.description || '',
        item.sortOrder || 0
      ]);
      
      await connection.query(sql, [values]);
      return await this.findByQuotationId(items[0].quotationId);
    } finally {
      connection.release();
    }
  },

  async deleteByQuotationId(quotationId) {
    const connection = await pool.getConnection();
    try {
      await connection.execute('DELETE FROM quotation_items WHERE quotationId = ?', [quotationId]);
      return { quotationId };
    } finally {
      connection.release();
    }
  }
};

module.exports = QuotationItem;


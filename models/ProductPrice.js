const { pool } = require('../config/database');

const ProductPrice = {
  async find(query = {}) {
    const connection = await pool.getConnection();
    try {
      let sql = `SELECT pp.*, p.name as productName, c.name as customerName 
                 FROM product_prices pp
                 LEFT JOIN products p ON pp.productId = p.id
                 LEFT JOIN customers c ON pp.customerId = c.id
                 WHERE 1=1`;
      const params = [];
      
      if (query.productId) {
        sql += ' AND pp.productId = ?';
        params.push(query.productId);
      }
      if (query.customerId !== undefined) {
        if (query.customerId === null) {
          sql += ' AND pp.customerId IS NULL';
        } else {
          sql += ' AND pp.customerId = ?';
          params.push(query.customerId);
        }
      }
      if (query.isActive !== undefined) {
        sql += ' AND pp.isActive = ?';
        params.push(query.isActive);
      }
      
      sql += ' ORDER BY pp.createdAt DESC';
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
        `SELECT pp.*, p.name as productName, c.name as customerName 
         FROM product_prices pp
         LEFT JOIN products p ON pp.productId = p.id
         LEFT JOIN customers c ON pp.customerId = c.id
         WHERE pp.id = ?`,
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
      const sql = `INSERT INTO product_prices (productId, customerId, price, currency, effectiveDate, expiryDate, minQuantity, isActive, createdBy) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      const params = [
        data.productId,
        data.customerId || null,
        data.price,
        data.currency || 'CNY',
        data.effectiveDate || null,
        data.expiryDate || null,
        data.minQuantity || 1,
        data.isActive !== undefined ? data.isActive : true,
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
        if (key !== '_id' && key !== 'id' && !key.endsWith('Name')) {
          fields.push(`${key} = ?`);
          params.push(data[key]);
        }
      });
      
      if (fields.length === 0) return await this.findById(id);
      fields.push('updatedAt = NOW()');
      params.push(id);
      
      await connection.execute(`UPDATE product_prices SET ${fields.join(', ')} WHERE id = ?`, params);
      return await this.findById(id);
    } finally {
      connection.release();
    }
  },

  async findByIdAndDelete(id) {
    const connection = await pool.getConnection();
    try {
      await connection.execute('DELETE FROM product_prices WHERE id = ?', [id]);
      return { id };
    } finally {
      connection.release();
    }
  },

  async getPriceForCustomer(productId, customerId = null) {
    const connection = await pool.getConnection();
    try {
      let sql = 'SELECT * FROM product_prices WHERE productId = ? AND isActive = TRUE';
      const params = [productId];
      
      if (customerId) {
        sql += ' AND (customerId = ? OR customerId IS NULL)';
        params.push(customerId);
        sql += ' ORDER BY customerId DESC'; // 优先客户价格
      } else {
        sql += ' AND customerId IS NULL'; // 只查标准价格
      }
      
      sql += ' AND (effectiveDate IS NULL OR effectiveDate <= NOW())';
      sql += ' AND (expiryDate IS NULL OR expiryDate >= NOW())';
      sql += ' ORDER BY effectiveDate DESC LIMIT 1';
      
      const [rows] = await connection.execute(sql, params);
      return rows[0] || null;
    } finally {
      connection.release();
    }
  }
};

module.exports = ProductPrice;


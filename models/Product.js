const { pool } = require('../config/database');

const Product = {
  async find(query = {}) {
    const connection = await pool.getConnection();
    try {
      let sql = 'SELECT p.*, pc.name as categoryName FROM products p LEFT JOIN product_categories pc ON p.categoryId = pc.id WHERE 1=1';
      const params = [];
      
      if (query.categoryId) {
        sql += ' AND p.categoryId = ?';
        params.push(query.categoryId);
      }
      if (query.code) {
        sql += ' AND p.code LIKE ?';
        params.push(`%${query.code}%`);
      }
      if (query.name) {
        sql += ' AND p.name LIKE ?';
        params.push(`%${query.name}%`);
      }
      if (query.isActive !== undefined) {
        sql += ' AND p.isActive = ?';
        params.push(query.isActive);
      }
      
      sql += ' ORDER BY p.createdAt DESC';
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
        specifications: row.specifications ? (typeof row.specifications === 'string' ? JSON.parse(row.specifications) : row.specifications) : {},
        images: row.images ? (typeof row.images === 'string' ? JSON.parse(row.images) : row.images) : []
      }));
    } finally {
      connection.release();
    }
  },

  async findById(id) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT p.*, pc.name as categoryName FROM products p LEFT JOIN product_categories pc ON p.categoryId = pc.id WHERE p.id = ?',
        [id]
      );
      if (rows[0]) {
        const row = rows[0];
        return {
          ...row,
          specifications: row.specifications ? (typeof row.specifications === 'string' ? JSON.parse(row.specifications) : row.specifications) : {},
          images: row.images ? (typeof row.images === 'string' ? JSON.parse(row.images) : row.images) : []
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
      const sql = `INSERT INTO products (code, name, categoryId, brand, model, unit, description, specifications, images, isActive, createdBy) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      const params = [
        data.code,
        data.name,
        data.categoryId || null,
        data.brand || '',
        data.model || '',
        data.unit || '件',
        data.description || '',
        JSON.stringify(data.specifications || {}),
        JSON.stringify(data.images || []),
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
        if (key === 'specifications' || key === 'images') {
          fields.push(`${key} = ?`);
          params.push(JSON.stringify(data[key]));
        } else if (key !== '_id' && key !== 'id' && key !== 'categoryName') {
          fields.push(`${key} = ?`);
          params.push(data[key]);
        }
      });
      
      if (fields.length === 0) return await this.findById(id);
      fields.push('updatedAt = NOW()');
      params.push(id);
      
      await connection.execute(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, params);
      return await this.findById(id);
    } finally {
      connection.release();
    }
  },

  async findByIdAndDelete(id) {
    const connection = await pool.getConnection();
    try {
      await connection.execute('DELETE FROM products WHERE id = ?', [id]);
      return { id };
    } finally {
      connection.release();
    }
  },

  async getPrice(productId, customerId = null) {
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
  },

  async countDocuments(query = {}) {
    const connection = await pool.getConnection();
    try {
      let sql = 'SELECT COUNT(*) as count FROM products p WHERE 1=1';
      const params = [];
      
      if (query.categoryId) {
        sql += ' AND p.categoryId = ?';
        params.push(query.categoryId);
      }
      if (query.code) {
        sql += ' AND p.code LIKE ?';
        params.push(`%${query.code}%`);
      }
      if (query.name) {
        sql += ' AND p.name LIKE ?';
        params.push(`%${query.name}%`);
      }
      if (query.isActive !== undefined) {
        sql += ' AND p.isActive = ?';
        params.push(query.isActive);
      }
      
      const [rows] = await connection.execute(sql, params);
      return rows[0].count;
    } finally {
      connection.release();
    }
  }
};

module.exports = Product;


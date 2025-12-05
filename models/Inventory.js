const { pool } = require('../config/database');

const Inventory = {
  // 查找库存
  async find(query = {}) {
    const connection = await pool.getConnection();
    try {
      let sql = `SELECT i.*, p.name as productName, p.code as productCode, p.unit as productUnit, 
                        pc.name as categoryName 
                 FROM inventory i 
                 LEFT JOIN products p ON i.productId = p.id 
                 LEFT JOIN product_categories pc ON p.categoryId = pc.id 
                 WHERE 1=1`;
      const params = [];
      
      if (query.productId) {
        sql += ' AND i.productId = ?';
        params.push(query.productId);
      }
      if (query.productCode) {
        sql += ' AND p.code LIKE ?';
        params.push(`%${query.productCode}%`);
      }
      if (query.productName) {
        sql += ' AND p.name LIKE ?';
        params.push(`%${query.productName}%`);
      }
      if (query.lowStock !== undefined && query.lowStock) {
        sql += ' AND i.quantity <= i.minStock';
      }
      
      sql += ' ORDER BY i.updatedAt DESC';
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

  // 根据产品ID查找库存
  async findByProductId(productId) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT i.*, p.name as productName, p.code as productCode, p.unit as productUnit 
         FROM inventory i 
         LEFT JOIN products p ON i.productId = p.id 
         WHERE i.productId = ?`,
        [productId]
      );
      return rows[0] || null;
    } finally {
      connection.release();
    }
  },

  // 根据ID查找库存
  async findById(id) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT i.*, p.name as productName, p.code as productCode, p.unit as productUnit 
         FROM inventory i 
         LEFT JOIN products p ON i.productId = p.id 
         WHERE i.id = ?`,
        [id]
      );
      return rows[0] || null;
    } finally {
      connection.release();
    }
  },

  // 创建或更新库存
  async upsert(data) {
    const connection = await pool.getConnection();
    try {
      // 先查找是否存在
      const existing = await this.findByProductId(data.productId);
      
      if (existing) {
        // 更新库存
        const fields = [];
        const params = [];
        
        if (data.quantity !== undefined) {
          fields.push('quantity = ?');
          params.push(data.quantity);
        }
        if (data.minStock !== undefined) {
          fields.push('minStock = ?');
          params.push(data.minStock);
        }
        if (data.maxStock !== undefined) {
          fields.push('maxStock = ?');
          params.push(data.maxStock);
        }
        if (data.warehouse !== undefined) {
          fields.push('warehouse = ?');
          params.push(data.warehouse);
        }
        if (data.location !== undefined) {
          fields.push('location = ?');
          params.push(data.location);
        }
        
        if (fields.length > 0) {
          fields.push('updatedAt = NOW()');
          params.push(existing.id);
          await connection.execute(`UPDATE inventory SET ${fields.join(', ')} WHERE id = ?`, params);
          return await this.findById(existing.id);
        }
        return existing;
      } else {
        // 创建新库存记录
        const sql = `INSERT INTO inventory (productId, quantity, minStock, maxStock, warehouse, location, createdAt, updatedAt) 
                     VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`;
        const params = [
          data.productId,
          data.quantity || 0,
          data.minStock || 0,
          data.maxStock || null,
          data.warehouse || '',
          data.location || ''
        ];
        
        const [result] = await connection.execute(sql, params);
        return await this.findById(result.insertId);
      }
    } finally {
      connection.release();
    }
  },

  // 增加库存
  async increase(productId, quantity) {
    const connection = await pool.getConnection();
    try {
      const existing = await this.findByProductId(productId);
      
      if (existing) {
        const newQuantity = (existing.quantity || 0) + quantity;
        await connection.execute(
          'UPDATE inventory SET quantity = ?, updatedAt = NOW() WHERE id = ?',
          [newQuantity, existing.id]
        );
        return await this.findById(existing.id);
      } else {
        return await this.upsert({ productId, quantity });
      }
    } finally {
      connection.release();
    }
  },

  // 减少库存
  async decrease(productId, quantity) {
    const connection = await pool.getConnection();
    try {
      const existing = await this.findByProductId(productId);
      
      if (existing) {
        const newQuantity = Math.max(0, (existing.quantity || 0) - quantity);
        await connection.execute(
          'UPDATE inventory SET quantity = ?, updatedAt = NOW() WHERE id = ?',
          [newQuantity, existing.id]
        );
        return await this.findById(existing.id);
      } else {
        throw new Error('库存记录不存在');
      }
    } finally {
      connection.release();
    }
  },

  // 统计库存数量
  async countDocuments(query = {}) {
    const connection = await pool.getConnection();
    try {
      let sql = 'SELECT COUNT(*) as count FROM inventory WHERE 1=1';
      const params = [];
      
      if (query.productId) {
        sql += ' AND productId = ?';
        params.push(query.productId);
      }
      if (query.lowStock !== undefined && query.lowStock) {
        sql += ' AND quantity <= minStock';
      }
      
      const [rows] = await connection.execute(sql, params);
      return rows[0].count;
    } finally {
      connection.release();
    }
  }
};

module.exports = Inventory;


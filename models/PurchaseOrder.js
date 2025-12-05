const { pool } = require('../config/database');

const PurchaseOrder = {
  // 查找采购单
  async find(query = {}) {
    const connection = await pool.getConnection();
    try {
      let sql = `SELECT po.*, s.name as supplierName, u.name as createdByName 
                 FROM purchase_orders po 
                 LEFT JOIN suppliers s ON po.supplierId = s.id 
                 LEFT JOIN users u ON po.createdBy = u.id 
                 WHERE 1=1`;
      const params = [];
      
      if (query.orderNumber) {
        sql += ' AND po.orderNumber LIKE ?';
        params.push(`%${query.orderNumber}%`);
      }
      if (query.supplierId) {
        sql += ' AND po.supplierId = ?';
        params.push(query.supplierId);
      }
      if (query.status) {
        sql += ' AND po.status = ?';
        params.push(query.status);
      }
      if (query.startDate) {
        sql += ' AND po.orderDate >= ?';
        params.push(query.startDate);
      }
      if (query.endDate) {
        sql += ' AND po.orderDate <= ?';
        params.push(query.endDate);
      }
      
      sql += ' ORDER BY po.createdAt DESC';
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

  // 根据ID查找采购单
  async findById(id) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT po.*, s.name as supplierName, u.name as createdByName 
         FROM purchase_orders po 
         LEFT JOIN suppliers s ON po.supplierId = s.id 
         LEFT JOIN users u ON po.createdBy = u.id 
         WHERE po.id = ?`,
        [id]
      );
      return rows[0] || null;
    } finally {
      connection.release();
    }
  },

  // 创建采购单
  async create(data) {
    const connection = await pool.getConnection();
    try {
      const sql = `INSERT INTO purchase_orders (orderNumber, supplierId, orderDate, expectedDate, 
                   totalAmount, status, paymentStatus, notes, createdBy, createdAt, updatedAt) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`;
      const params = [
        data.orderNumber,
        data.supplierId || null,
        data.orderDate || new Date(),
        data.expectedDate || null,
        data.totalAmount || 0,
        data.status || 'pending',
        data.paymentStatus || 'unpaid',
        data.notes || '',
        data.createdBy || null
      ];
      
      const [result] = await connection.execute(sql, params);
      return await this.findById(result.insertId);
    } finally {
      connection.release();
    }
  },

  // 更新采购单
  async findByIdAndUpdate(id, data) {
    const connection = await pool.getConnection();
    try {
      const fields = [];
      const params = [];
      
      Object.keys(data).forEach(key => {
        if (key !== '_id' && key !== 'id' && key !== 'supplierName' && key !== 'createdByName') {
          fields.push(`${key} = ?`);
          params.push(data[key]);
        }
      });
      
      if (fields.length === 0) return await this.findById(id);
      fields.push('updatedAt = NOW()');
      params.push(id);
      
      await connection.execute(`UPDATE purchase_orders SET ${fields.join(', ')} WHERE id = ?`, params);
      return await this.findById(id);
    } finally {
      connection.release();
    }
  },

  // 删除采购单
  async findByIdAndDelete(id) {
    const connection = await pool.getConnection();
    try {
      await connection.execute('DELETE FROM purchase_orders WHERE id = ?', [id]);
      return { id };
    } finally {
      connection.release();
    }
  },

  // 统计采购单数量
  async countDocuments(query = {}) {
    const connection = await pool.getConnection();
    try {
      let sql = 'SELECT COUNT(*) as count FROM purchase_orders WHERE 1=1';
      const params = [];
      
      if (query.supplierId) {
        sql += ' AND supplierId = ?';
        params.push(query.supplierId);
      }
      if (query.status) {
        sql += ' AND status = ?';
        params.push(query.status);
      }
      
      const [rows] = await connection.execute(sql, params);
      return rows[0].count;
    } finally {
      connection.release();
    }
  }
};

module.exports = PurchaseOrder;


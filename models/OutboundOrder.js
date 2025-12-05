const { pool } = require('../config/database');

const OutboundOrder = {
  // 查找出库单
  async find(query = {}) {
    const connection = await pool.getConnection();
    try {
      let sql = `SELECT oo.*, c.name as customerName, u.name as createdByName 
                 FROM outbound_orders oo 
                 LEFT JOIN customers c ON oo.customerId = c.id 
                 LEFT JOIN users u ON oo.createdBy = u.id 
                 WHERE 1=1`;
      const params = [];
      
      if (query.orderNumber) {
        sql += ' AND oo.orderNumber LIKE ?';
        params.push(`%${query.orderNumber}%`);
      }
      if (query.customerId) {
        sql += ' AND oo.customerId = ?';
        params.push(query.customerId);
      }
      if (query.status) {
        sql += ' AND oo.status = ?';
        params.push(query.status);
      }
      if (query.startDate) {
        sql += ' AND oo.orderDate >= ?';
        params.push(query.startDate);
      }
      if (query.endDate) {
        sql += ' AND oo.orderDate <= ?';
        params.push(query.endDate);
      }
      
      sql += ' ORDER BY oo.createdAt DESC';
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

  // 根据ID查找出库单
  async findById(id) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT oo.*, c.name as customerName, u.name as createdByName 
         FROM outbound_orders oo 
         LEFT JOIN customers c ON oo.customerId = c.id 
         LEFT JOIN users u ON oo.createdBy = u.id 
         WHERE oo.id = ?`,
        [id]
      );
      return rows[0] || null;
    } finally {
      connection.release();
    }
  },

  // 创建出库单
  async create(data) {
    const connection = await pool.getConnection();
    try {
      const sql = `INSERT INTO outbound_orders (orderNumber, customerId, orderDate, expectedDate, 
                   totalAmount, status, notes, createdBy, createdAt, updatedAt) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`;
      const params = [
        data.orderNumber,
        data.customerId || null,
        data.orderDate || new Date(),
        data.expectedDate || null,
        data.totalAmount || 0,
        data.status || 'pending',
        data.notes || '',
        data.createdBy || null
      ];
      
      const [result] = await connection.execute(sql, params);
      return await this.findById(result.insertId);
    } finally {
      connection.release();
    }
  },

  // 更新出库单
  async findByIdAndUpdate(id, data) {
    const connection = await pool.getConnection();
    try {
      const fields = [];
      const params = [];
      
      Object.keys(data).forEach(key => {
        if (key !== '_id' && key !== 'id' && key !== 'customerName' && key !== 'createdByName') {
          fields.push(`${key} = ?`);
          params.push(data[key]);
        }
      });
      
      if (fields.length === 0) return await this.findById(id);
      fields.push('updatedAt = NOW()');
      params.push(id);
      
      await connection.execute(`UPDATE outbound_orders SET ${fields.join(', ')} WHERE id = ?`, params);
      return await this.findById(id);
    } finally {
      connection.release();
    }
  },

  // 删除出库单
  async findByIdAndDelete(id) {
    const connection = await pool.getConnection();
    try {
      await connection.execute('DELETE FROM outbound_orders WHERE id = ?', [id]);
      return { id };
    } finally {
      connection.release();
    }
  },

  // 统计出库单数量
  async countDocuments(query = {}) {
    const connection = await pool.getConnection();
    try {
      let sql = 'SELECT COUNT(*) as count FROM outbound_orders WHERE 1=1';
      const params = [];
      
      if (query.customerId) {
        sql += ' AND customerId = ?';
        params.push(query.customerId);
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

module.exports = OutboundOrder;


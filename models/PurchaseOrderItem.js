const { pool } = require('../config/database');

const PurchaseOrderItem = {
  // 根据采购单ID查找明细
  async findByOrderId(orderId) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT poi.*, p.name as productName, p.code as productCode, p.unit as productUnit 
         FROM purchase_order_items poi 
         LEFT JOIN products p ON poi.productId = p.id 
         WHERE poi.orderId = ? 
         ORDER BY poi.id ASC`,
        [orderId]
      );
      return rows;
    } finally {
      connection.release();
    }
  },

  // 根据ID查找明细
  async findById(id) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT poi.*, p.name as productName, p.code as productCode, p.unit as productUnit 
         FROM purchase_order_items poi 
         LEFT JOIN products p ON poi.productId = p.id 
         WHERE poi.id = ?`,
        [id]
      );
      return rows[0] || null;
    } finally {
      connection.release();
    }
  },

  // 创建采购明细
  async create(data) {
    const connection = await pool.getConnection();
    try {
      const sql = `INSERT INTO purchase_order_items (orderId, productId, quantity, unitPrice, amount, notes) 
                   VALUES (?, ?, ?, ?, ?, ?)`;
      const params = [
        data.orderId,
        data.productId,
        data.quantity || 0,
        data.unitPrice || 0,
        data.amount || 0,
        data.notes || ''
      ];
      
      const [result] = await connection.execute(sql, params);
      return await this.findById(result.insertId);
    } finally {
      connection.release();
    }
  },

  // 批量创建采购明细
  async createBatch(items) {
    const connection = await pool.getConnection();
    try {
      if (!items || items.length === 0) return [];
      
      const placeholders = items.map(() => '(?, ?, ?, ?, ?, ?)').join(',');
      const values = items.map(item => [
        item.orderId,
        item.productId,
        item.quantity || 0,
        item.unitPrice || 0,
        item.amount || 0,
        item.notes || ''
      ]);
      const flatValues = values.flat();
      
      await connection.execute(
        `INSERT INTO purchase_order_items (orderId, productId, quantity, unitPrice, amount, notes) VALUES ${placeholders}`,
        flatValues
      );
      
      return await this.findByOrderId(items[0].orderId);
    } finally {
      connection.release();
    }
  },

  // 更新采购明细
  async findByIdAndUpdate(id, data) {
    const connection = await pool.getConnection();
    try {
      const fields = [];
      const params = [];
      
      Object.keys(data).forEach(key => {
        if (key !== '_id' && key !== 'id' && key !== 'productName' && key !== 'productCode' && key !== 'productUnit') {
          fields.push(`${key} = ?`);
          params.push(data[key]);
        }
      });
      
      if (fields.length === 0) return await this.findById(id);
      params.push(id);
      
      await connection.execute(`UPDATE purchase_order_items SET ${fields.join(', ')} WHERE id = ?`, params);
      return await this.findById(id);
    } finally {
      connection.release();
    }
  },

  // 删除采购明细
  async findByIdAndDelete(id) {
    const connection = await pool.getConnection();
    try {
      await connection.execute('DELETE FROM purchase_order_items WHERE id = ?', [id]);
      return { id };
    } finally {
      connection.release();
    }
  },

  // 根据订单ID删除所有明细
  async deleteByOrderId(orderId) {
    const connection = await pool.getConnection();
    try {
      await connection.execute('DELETE FROM purchase_order_items WHERE orderId = ?', [orderId]);
      return { orderId };
    } finally {
      connection.release();
    }
  }
};

module.exports = PurchaseOrderItem;


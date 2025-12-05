const { pool } = require('../config/database');

const InboundOrderItem = {
  // 根据入库单ID查找明细
  async findByOrderId(orderId) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT ioi.*, p.name as productName, p.code as productCode, p.unit as productUnit 
         FROM inbound_order_items ioi 
         LEFT JOIN products p ON ioi.productId = p.id 
         WHERE ioi.orderId = ? 
         ORDER BY ioi.id ASC`,
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
        `SELECT ioi.*, p.name as productName, p.code as productCode, p.unit as productUnit 
         FROM inbound_order_items ioi 
         LEFT JOIN products p ON ioi.productId = p.id 
         WHERE ioi.id = ?`,
        [id]
      );
      return rows[0] || null;
    } finally {
      connection.release();
    }
  },

  // 创建入库明细
  async create(data) {
    const connection = await pool.getConnection();
    try {
      const sql = `INSERT INTO inbound_order_items (orderId, productId, quantity, unitPrice, amount, notes) 
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

  // 批量创建入库明细
  async createBatch(items) {
    const connection = await pool.getConnection();
    try {
      if (!items || items.length === 0) return [];
      
      const sql = `INSERT INTO inbound_order_items (orderId, productId, quantity, unitPrice, amount, notes) 
                   VALUES ?`;
      const values = items.map(item => [
        item.orderId,
        item.productId,
        item.quantity || 0,
        item.unitPrice || 0,
        item.amount || 0,
        item.notes || ''
      ]);
      
      // MySQL批量插入需要使用不同的语法
      const placeholders = items.map(() => '(?, ?, ?, ?, ?, ?)').join(',');
      const flatValues = values.flat();
      await connection.execute(
        `INSERT INTO inbound_order_items (orderId, productId, quantity, unitPrice, amount, notes) VALUES ${placeholders}`,
        flatValues
      );
      
      // 返回创建的明细
      return await this.findByOrderId(items[0].orderId);
    } finally {
      connection.release();
    }
  },

  // 更新入库明细
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
      
      await connection.execute(`UPDATE inbound_order_items SET ${fields.join(', ')} WHERE id = ?`, params);
      return await this.findById(id);
    } finally {
      connection.release();
    }
  },

  // 删除入库明细
  async findByIdAndDelete(id) {
    const connection = await pool.getConnection();
    try {
      await connection.execute('DELETE FROM inbound_order_items WHERE id = ?', [id]);
      return { id };
    } finally {
      connection.release();
    }
  },

  // 根据订单ID删除所有明细
  async deleteByOrderId(orderId) {
    const connection = await pool.getConnection();
    try {
      await connection.execute('DELETE FROM inbound_order_items WHERE orderId = ?', [orderId]);
      return { orderId };
    } finally {
      connection.release();
    }
  }
};

module.exports = InboundOrderItem;


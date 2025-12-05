const { pool } = require('../config/database');

const PaymentRecord = {
  // 查找付款单
  async find(query = {}) {
    const connection = await pool.getConnection();
    try {
      let sql = `SELECT pr.*, s.name as supplierName, po.orderNumber as purchaseOrderNumber, io.orderNumber as inboundOrderNumber, u.name as createdByName 
                 FROM payment_records pr 
                 LEFT JOIN suppliers s ON pr.supplierId = s.id 
                 LEFT JOIN purchase_orders po ON pr.purchaseOrderId = po.id 
                 LEFT JOIN inbound_orders io ON pr.inboundOrderId = io.id 
                 LEFT JOIN users u ON pr.createdBy = u.id 
                 WHERE 1=1`;
      const params = [];
      
      if (query.paymentNumber) {
        sql += ' AND pr.paymentNumber LIKE ?';
        params.push(`%${query.paymentNumber}%`);
      }
      if (query.supplierId) {
        sql += ' AND pr.supplierId = ?';
        params.push(query.supplierId);
      }
      if (query.startDate) {
        sql += ' AND pr.paymentDate >= ?';
        params.push(query.startDate);
      }
      if (query.endDate) {
        sql += ' AND pr.paymentDate <= ?';
        params.push(query.endDate);
      }
      
      sql += ' ORDER BY pr.createdAt DESC';
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
        `SELECT pr.*, s.name as supplierName, po.orderNumber as purchaseOrderNumber, io.orderNumber as inboundOrderNumber, u.name as createdByName 
         FROM payment_records pr 
         LEFT JOIN suppliers s ON pr.supplierId = s.id 
         LEFT JOIN purchase_orders po ON pr.purchaseOrderId = po.id 
         LEFT JOIN inbound_orders io ON pr.inboundOrderId = io.id 
         LEFT JOIN users u ON pr.createdBy = u.id 
         WHERE pr.id = ?`,
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
      const sql = `INSERT INTO payment_records (paymentNumber, supplierId, purchaseOrderId, inboundOrderId, paymentDate, amount, 
                   paymentMethod, bankAccount, notes, createdBy, createdAt, updatedAt) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`;
      const params = [
        data.paymentNumber,
        data.supplierId || null,
        data.purchaseOrderId || null,
        data.inboundOrderId || null,
        data.paymentDate || new Date(),
        data.amount || 0,
        data.paymentMethod || 'bank_transfer',
        data.bankAccount || '',
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
        if (key !== '_id' && key !== 'id' && key !== 'supplierName' && key !== 'purchaseOrderNumber' && key !== 'inboundOrderNumber' && key !== 'createdByName') {
          fields.push(`${key} = ?`);
          params.push(data[key]);
        }
      });
      
      if (fields.length === 0) return await this.findById(id);
      fields.push('updatedAt = NOW()');
      params.push(id);
      
      await connection.execute(`UPDATE payment_records SET ${fields.join(', ')} WHERE id = ?`, params);
      return await this.findById(id);
    } finally {
      connection.release();
    }
  },

  async findByIdAndDelete(id) {
    const connection = await pool.getConnection();
    try {
      await connection.execute('DELETE FROM payment_records WHERE id = ?', [id]);
      return { id };
    } finally {
      connection.release();
    }
  },

  async countDocuments(query = {}) {
    const connection = await pool.getConnection();
    try {
      let sql = 'SELECT COUNT(*) as count FROM payment_records WHERE 1=1';
      const params = [];
      
      if (query.supplierId) {
        sql += ' AND supplierId = ?';
        params.push(query.supplierId);
      }
      
      const [rows] = await connection.execute(sql, params);
      return rows[0].count;
    } finally {
      connection.release();
    }
  }
};

module.exports = PaymentRecord;


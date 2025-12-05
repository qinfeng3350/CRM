const { pool } = require('../config/database');

const OpportunityProduct = {
  async findByOpportunityId(opportunityId) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM opportunity_products WHERE opportunityId = ? ORDER BY id ASC',
        [opportunityId]
      );
      return rows;
    } finally {
      connection.release();
    }
  },

  async create(data) {
    const connection = await pool.getConnection();
    try {
      const sql = `INSERT INTO opportunity_products (opportunityId, productId, productName, quantity, unitPrice, discount, amount, description) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
      const params = [
        data.opportunityId,
        data.productId,
        data.productName,
        data.quantity,
        data.unitPrice,
        data.discount || 0,
        data.amount,
        data.description || ''
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
      await connection.execute('DELETE FROM opportunity_products WHERE opportunityId = ?', [items[0].opportunityId]);
      
      // 批量插入
      const sql = `INSERT INTO opportunity_products (opportunityId, productId, productName, quantity, unitPrice, discount, amount, description) 
                   VALUES ?`;
      const values = items.map(item => [
        item.opportunityId,
        item.productId,
        item.productName,
        item.quantity,
        item.unitPrice,
        item.discount || 0,
        item.amount,
        item.description || ''
      ]);
      
      await connection.query(sql, [values]);
      return await this.findByOpportunityId(items[0].opportunityId);
    } finally {
      connection.release();
    }
  },

  async deleteByOpportunityId(opportunityId) {
    const connection = await pool.getConnection();
    try {
      await connection.execute('DELETE FROM opportunity_products WHERE opportunityId = ?', [opportunityId]);
      return { opportunityId };
    } finally {
      connection.release();
    }
  }
};

module.exports = OpportunityProduct;


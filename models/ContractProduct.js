const { pool } = require('../config/database');

const ContractProduct = {
  async findByContractId(contractId) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM contract_products WHERE contractId = ? ORDER BY id ASC',
        [contractId]
      );
      return rows;
    } finally {
      connection.release();
    }
  },

  async create(data) {
    const connection = await pool.getConnection();
    try {
      const sql = `INSERT INTO contract_products (contractId, productId, productName, quantity, unitPrice, discount, amount, description) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
      const params = [
        data.contractId,
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
      await connection.execute('DELETE FROM contract_products WHERE contractId = ?', [items[0].contractId]);
      
      // 批量插入
      const sql = `INSERT INTO contract_products (contractId, productId, productName, quantity, unitPrice, discount, amount, description) 
                   VALUES ?`;
      const values = items.map(item => [
        item.contractId,
        item.productId,
        item.productName,
        item.quantity,
        item.unitPrice,
        item.discount || 0,
        item.amount,
        item.description || ''
      ]);
      
      await connection.query(sql, [values]);
      return await this.findByContractId(items[0].contractId);
    } finally {
      connection.release();
    }
  },

  async deleteByContractId(contractId) {
    const connection = await pool.getConnection();
    try {
      await connection.execute('DELETE FROM contract_products WHERE contractId = ?', [contractId]);
      return { contractId };
    } finally {
      connection.release();
    }
  }
};

module.exports = ContractProduct;


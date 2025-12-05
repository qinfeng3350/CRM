const { pool } = require('../config/database');

const PaymentPlan = {
  async find(query = {}) {
    const connection = await pool.getConnection();
    try {
      let sql = `SELECT pp.*, c.contractNumber, c.title as contractTitle 
                 FROM payment_plans pp
                 LEFT JOIN contracts c ON pp.contractId = c.id
                 WHERE 1=1`;
      const params = [];
      
      if (query.contractId) {
        sql += ' AND pp.contractId = ?';
        params.push(query.contractId);
      }
      if (query.status) {
        sql += ' AND pp.status = ?';
        params.push(query.status);
      }
      
      sql += ' ORDER BY pp.planDate ASC';
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
        `SELECT pp.*, c.contractNumber, c.title as contractTitle 
         FROM payment_plans pp
         LEFT JOIN contracts c ON pp.contractId = c.id
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
      if (!data.planNumber) {
        const count = await this.countDocuments({});
        data.planNumber = `PLAN-${Date.now()}-${count + 1}`;
      }
      
      const sql = `INSERT INTO payment_plans (contractId, planNumber, planDate, amount, currency, status, receivedAmount, description, createdBy, createdAt, updatedAt) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`;
      const params = [
        data.contractId,
        data.planNumber,
        data.planDate ? `${data.planDate} 00:00:00` : null,
        data.amount,
        data.currency || 'CNY',
        data.status || 'pending',
        data.receivedAmount || 0,
        data.description || '',
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
        if (key !== '_id' && key !== 'id' && !key.endsWith('Title') && !key.endsWith('Number')) {
          fields.push(`${key} = ?`);
          params.push(data[key]);
        }
      });
      
      if (fields.length === 0) return await this.findById(id);
      fields.push('updatedAt = NOW()');
      params.push(id);
      
      await connection.execute(`UPDATE payment_plans SET ${fields.join(', ')} WHERE id = ?`, params);
      return await this.findById(id);
    } finally {
      connection.release();
    }
  },

  async findByIdAndDelete(id) {
    const connection = await pool.getConnection();
    try {
      await connection.execute('DELETE FROM payment_plans WHERE id = ?', [id]);
      return { id };
    } finally {
      connection.release();
    }
  },

  async countDocuments(query = {}) {
    const connection = await pool.getConnection();
    try {
      let sql = 'SELECT COUNT(*) as count FROM payment_plans WHERE 1=1';
      const params = [];
      
      if (query.contractId) {
        sql += ' AND contractId = ?';
        params.push(query.contractId);
      }
      
      const [rows] = await connection.execute(sql, params);
      return rows[0].count;
    } finally {
      connection.release();
    }
  }
};

module.exports = PaymentPlan;


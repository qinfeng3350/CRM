const { pool } = require('../config/database');

const Supplier = {
  // 查找供应商
  async find(query = {}) {
    const connection = await pool.getConnection();
    try {
      let sql = 'SELECT * FROM suppliers WHERE 1=1';
      const params = [];
      
      if (query.name) {
        sql += ' AND name LIKE ?';
        params.push(`%${query.name}%`);
      }
      if (query.code) {
        sql += ' AND code LIKE ?';
        params.push(`%${query.code}%`);
      }
      if (query.contact) {
        sql += ' AND (contactName LIKE ? OR contactPhone LIKE ?)';
        params.push(`%${query.contact}%`, `%${query.contact}%`);
      }
      if (query.status !== undefined) {
        sql += ' AND status = ?';
        params.push(query.status);
      }
      
      sql += ' ORDER BY createdAt DESC';
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

  // 根据ID查找供应商
  async findById(id) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM suppliers WHERE id = ?',
        [id]
      );
      return rows[0] || null;
    } finally {
      connection.release();
    }
  },

  // 创建供应商
  async create(data) {
    const connection = await pool.getConnection();
    try {
      const sql = `INSERT INTO suppliers (code, name, contactName, contactPhone, contactEmail, address, 
                   taxNumber, bankName, bankAccount, paymentTerms, creditLimit, status, notes, createdBy, createdAt, updatedAt) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`;
      const params = [
        data.code || null,
        data.name,
        data.contactName || '',
        data.contactPhone || '',
        data.contactEmail || '',
        data.address || '',
        data.taxNumber || '',
        data.bankName || '',
        data.bankAccount || '',
        data.paymentTerms || '',
        data.creditLimit || 0,
        data.status || 'active',
        data.notes || '',
        data.createdBy || null
      ];
      
      const [result] = await connection.execute(sql, params);
      return await this.findById(result.insertId);
    } finally {
      connection.release();
    }
  },

  // 更新供应商
  async findByIdAndUpdate(id, data) {
    const connection = await pool.getConnection();
    try {
      const fields = [];
      const params = [];
      
      Object.keys(data).forEach(key => {
        if (key !== '_id' && key !== 'id') {
          fields.push(`${key} = ?`);
          params.push(data[key]);
        }
      });
      
      if (fields.length === 0) return await this.findById(id);
      fields.push('updatedAt = NOW()');
      params.push(id);
      
      await connection.execute(`UPDATE suppliers SET ${fields.join(', ')} WHERE id = ?`, params);
      return await this.findById(id);
    } finally {
      connection.release();
    }
  },

  // 删除供应商
  async findByIdAndDelete(id) {
    const connection = await pool.getConnection();
    try {
      await connection.execute('DELETE FROM suppliers WHERE id = ?', [id]);
      return { id };
    } finally {
      connection.release();
    }
  },

  // 统计供应商数量
  async countDocuments(query = {}) {
    const connection = await pool.getConnection();
    try {
      let sql = 'SELECT COUNT(*) as count FROM suppliers WHERE 1=1';
      const params = [];
      
      if (query.name) {
        sql += ' AND name LIKE ?';
        params.push(`%${query.name}%`);
      }
      if (query.code) {
        sql += ' AND code LIKE ?';
        params.push(`%${query.code}%`);
      }
      if (query.status !== undefined) {
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

module.exports = Supplier;


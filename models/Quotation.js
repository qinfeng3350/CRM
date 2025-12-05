const { pool } = require('../config/database');

const Quotation = {
  async find(query = {}) {
    const connection = await pool.getConnection();
    try {
      let sql = `SELECT q.*, 
                 c.name as customerName,
                 u.name as ownerName,
                 ct.name as contactName
                 FROM quotations q
                 LEFT JOIN customers c ON q.customerId = c.id
                 LEFT JOIN users u ON q.ownerId = u.id
                 LEFT JOIN contacts ct ON q.contactId = ct.id
                 WHERE 1=1`;
      const params = [];
      
      if (query.opportunityId) {
        sql += ' AND q.opportunityId = ?';
        params.push(query.opportunityId);
      }
      if (query.customerId) {
        sql += ' AND q.customerId = ?';
        params.push(query.customerId);
      }
      if (query.ownerId) {
        sql += ' AND q.ownerId = ?';
        params.push(query.ownerId);
      }
      if (query.status) {
        sql += ' AND q.status = ?';
        params.push(query.status);
      }
      if (query.quotationNumber) {
        sql += ' AND q.quotationNumber LIKE ?';
        params.push(`%${query.quotationNumber}%`);
      }
      
      sql += ' ORDER BY q.createdAt DESC';
      if (query.limit) {
        sql += ' LIMIT ?';
        params.push(parseInt(query.limit));
      }
      if (query.skip) {
        sql += ' OFFSET ?';
        params.push(parseInt(query.skip));
      }
      
      const [rows] = await connection.execute(sql, params);
      return rows.map(row => ({
        ...row,
        attachments: row.attachments ? (typeof row.attachments === 'string' ? JSON.parse(row.attachments) : row.attachments) : []
      }));
    } finally {
      connection.release();
    }
  },

  async findById(id) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT q.*, 
         c.name as customerName,
         u.name as ownerName,
         ct.name as contactName
         FROM quotations q
         LEFT JOIN customers c ON q.customerId = c.id
         LEFT JOIN users u ON q.ownerId = u.id
         LEFT JOIN contacts ct ON q.contactId = ct.id
         WHERE q.id = ?`,
        [id]
      );
      if (rows[0]) {
        const row = rows[0];
        return {
          ...row,
          attachments: row.attachments ? (typeof row.attachments === 'string' ? JSON.parse(row.attachments) : row.attachments) : []
        };
      }
      return null;
    } finally {
      connection.release();
    }
  },

  async create(data) {
    const connection = await pool.getConnection();
    try {
      // 生成报价单号
      if (!data.quotationNumber) {
        const count = await this.countDocuments({});
        data.quotationNumber = `QT-${Date.now()}-${count + 1}`;
      }
      
      const sql = `INSERT INTO quotations (quotationNumber, opportunityId, customerId, contactId, title, totalAmount, currency, discount, taxRate, validUntil, status, terms, notes, ownerId, attachments, createdBy) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      const params = [
        data.quotationNumber,
        data.opportunityId || null,
        data.customerId,
        data.contactId || null,
        data.title,
        data.totalAmount || 0,
        data.currency || 'CNY',
        data.discount || 0,
        data.taxRate || 0,
        data.validUntil || null,
        data.status || 'draft',
        data.terms || '',
        data.notes || '',
        data.ownerId,
        JSON.stringify(data.attachments || []),
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
        if (key === 'attachments') {
          fields.push(`${key} = ?`);
          params.push(JSON.stringify(data[key]));
        } else if (key !== '_id' && key !== 'id' && !key.endsWith('Name')) {
          fields.push(`${key} = ?`);
          params.push(data[key]);
        }
      });
      
      if (fields.length === 0) return await this.findById(id);
      fields.push('updatedAt = NOW()');
      params.push(id);
      
      await connection.execute(`UPDATE quotations SET ${fields.join(', ')} WHERE id = ?`, params);
      return await this.findById(id);
    } finally {
      connection.release();
    }
  },

  async findByIdAndDelete(id) {
    const connection = await pool.getConnection();
    try {
      await connection.execute('DELETE FROM quotations WHERE id = ?', [id]);
      return { id };
    } finally {
      connection.release();
    }
  },

  async countDocuments(query = {}) {
    const connection = await pool.getConnection();
    try {
      let sql = 'SELECT COUNT(*) as count FROM quotations WHERE 1=1';
      const params = [];
      
      if (query.opportunityId) {
        sql += ' AND opportunityId = ?';
        params.push(query.opportunityId);
      }
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

module.exports = Quotation;


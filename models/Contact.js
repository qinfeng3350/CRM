const { pool } = require('../config/database');

const Contact = {
  async find(query = {}) {
    const connection = await pool.getConnection();
    try {
      let sql = 'SELECT * FROM contacts WHERE 1=1';
      const params = [];
      
      if (query.customerId) {
        sql += ' AND customerId = ?';
        params.push(query.customerId);
      }
      if (query.isPrimary !== undefined) {
        sql += ' AND isPrimary = ?';
        params.push(query.isPrimary);
      }
      
      sql += ' ORDER BY isPrimary DESC, createdAt ASC';
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
      const [rows] = await connection.execute('SELECT * FROM contacts WHERE id = ?', [id]);
      return rows[0] || null;
    } finally {
      connection.release();
    }
  },

  async create(data) {
    const connection = await pool.getConnection();
    try {
      // 如果设置为主要联系人，先取消其他主要联系人
      if (data.isPrimary) {
        await connection.execute(
          'UPDATE contacts SET isPrimary = FALSE WHERE customerId = ?',
          [data.customerId]
        );
      }
      
      const sql = `INSERT INTO contacts (customerId, name, position, department, phone, mobile, email, wechat, qq, address, isPrimary, birthday, gender, notes, createdBy) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      const params = [
        data.customerId,
        data.name,
        data.position || '',
        data.department || '',
        data.phone || '',
        data.mobile || '',
        data.email || '',
        data.wechat || '',
        data.qq || '',
        data.address || '',
        data.isPrimary || false,
        data.birthday || null,
        data.gender || 'unknown',
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
      const contact = await this.findById(id);
      if (!contact) return null;
      
      // 如果设置为主要联系人，先取消其他主要联系人
      if (data.isPrimary && !contact.isPrimary) {
        const connection = await pool.getConnection();
        try {
          await connection.execute(
            'UPDATE contacts SET isPrimary = FALSE WHERE customerId = ? AND id != ?',
            [contact.customerId, id]
          );
        } finally {
          connection.release();
        }
      }
      
      const fields = [];
      const params = [];
      
      Object.keys(data).forEach(key => {
        if (key !== '_id' && key !== 'id' && key !== 'customerId') {
          fields.push(`${key} = ?`);
          params.push(data[key]);
        }
      });
      
      if (fields.length === 0) return await this.findById(id);
      fields.push('updatedAt = NOW()');
      params.push(id);
      
      const connection = await pool.getConnection();
      try {
        await connection.execute(`UPDATE contacts SET ${fields.join(', ')} WHERE id = ?`, params);
        return await this.findById(id);
      } finally {
        connection.release();
      }
    } catch (error) {
      throw error;
    }
  },

  async findByIdAndDelete(id) {
    const connection = await pool.getConnection();
    try {
      await connection.execute('DELETE FROM contacts WHERE id = ?', [id]);
      return { id };
    } finally {
      connection.release();
    }
  }
};

module.exports = Contact;


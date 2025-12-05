const { pool } = require('../config/database');

const PrintTemplate = {
  async find(query = {}) {
    const connection = await pool.getConnection();
    try {
      let sql = 'SELECT * FROM print_templates WHERE 1=1';
      const params = [];
      
      if (query.type) {
        sql += ' AND type = ?';
        params.push(query.type);
      }
      if (query.isActive !== undefined) {
        sql += ' AND isActive = ?';
        params.push(query.isActive);
      }
      
      sql += ' ORDER BY isDefault DESC, createdAt DESC';
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
      const [rows] = await connection.execute('SELECT * FROM print_templates WHERE id = ?', [id]);
      return rows[0] || null;
    } finally {
      connection.release();
    }
  },

  async getDefault(type) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM print_templates WHERE type = ? AND isDefault = TRUE AND isActive = TRUE LIMIT 1',
        [type]
      );
      return rows[0] || null;
    } finally {
      connection.release();
    }
  },

  async create(data) {
    const connection = await pool.getConnection();
    try {
      // 如果设置为默认，取消其他默认模板
      if (data.isDefault) {
        await connection.execute(
          'UPDATE print_templates SET isDefault = FALSE WHERE type = ?',
          [data.type]
        );
      }
      
      const sql = `INSERT INTO print_templates (name, type, content, isDefault, isActive, createdBy) 
                   VALUES (?, ?, ?, ?, ?, ?)`;
      const params = [
        data.name,
        data.type,
        data.content,
        data.isDefault || false,
        data.isActive !== undefined ? data.isActive : true,
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
      const template = await this.findById(id);
      if (!template) return null;
      
      // 如果设置为默认，取消其他默认模板
      if (data.isDefault && !template.isDefault) {
        await connection.execute(
          'UPDATE print_templates SET isDefault = FALSE WHERE type = ? AND id != ?',
          [template.type, id]
        );
      }
      
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
      
      await connection.execute(`UPDATE print_templates SET ${fields.join(', ')} WHERE id = ?`, params);
      return await this.findById(id);
    } finally {
      connection.release();
    }
  },

  async findByIdAndDelete(id) {
    const connection = await pool.getConnection();
    try {
      await connection.execute('DELETE FROM print_templates WHERE id = ?', [id]);
      return { id };
    } finally {
      connection.release();
    }
  }
};

module.exports = PrintTemplate;


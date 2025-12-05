const { pool } = require('../config/database');

const Role = {
  async find(query = {}) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute('SELECT * FROM roles ORDER BY createdAt DESC');
      return rows;
    } finally {
      connection.release();
    }
  },

  async findById(id) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute('SELECT * FROM roles WHERE id = ?', [id]);
      return rows[0] || null;
    } finally {
      connection.release();
    }
  },

  async create(data) {
    const connection = await pool.getConnection();
    try {
      const sql = `INSERT INTO roles (name, description, permissions, dataScope, createdAt, updatedAt) 
                   VALUES (?, ?, ?, ?, NOW(), NOW())`;
      const params = [
        data.name, data.description || '', JSON.stringify(data.permissions || []), data.dataScope || 'self'
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
        if (key === 'permissions' && Array.isArray(data[key])) {
          fields.push(`${key} = ?`);
          params.push(JSON.stringify(data[key]));
        } else if (key !== '_id' && key !== 'id') {
          fields.push(`${key} = ?`);
          params.push(data[key]);
        }
      });
      
      if (fields.length === 0) return await this.findById(id);
      fields.push('updatedAt = NOW()');
      params.push(id);
      
      await connection.execute(`UPDATE roles SET ${fields.join(', ')} WHERE id = ?`, params);
      return await this.findById(id);
    } finally {
      connection.release();
    }
  },

  async findByIdAndDelete(id) {
    const connection = await pool.getConnection();
    try {
      await connection.execute('DELETE FROM roles WHERE id = ?', [id]);
      return { id };
    } finally {
      connection.release();
    }
  }
};

module.exports = Role;

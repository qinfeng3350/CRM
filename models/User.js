const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');

const User = {
  // 根据邮箱或用户名查找用户
  async findOne(query) {
    const connection = await pool.getConnection();
    try {
      let sql = 'SELECT * FROM users WHERE ';
      const conditions = [];
      const params = [];
      
      if (query.$or) {
        const orConditions = query.$or.map(condition => {
          if (condition.email) {
            params.push(condition.email.toLowerCase());
            return 'email = ?';
          }
          if (condition.username) {
            params.push(condition.username);
            return 'username = ?';
          }
          return null;
        }).filter(Boolean);
        
        if (orConditions.length > 0) {
          conditions.push('(' + orConditions.join(' OR ') + ')');
        }
      } else {
        if (query.email) {
          conditions.push('email = ?');
          params.push(query.email.toLowerCase());
        }
        if (query.username) {
          conditions.push('username = ?');
          params.push(query.username);
        }
        if (query._id || query.id) {
          conditions.push('id = ?');
          params.push(query._id || query.id);
        }
        if (query.name) {
          conditions.push('name = ?');
          params.push(query.name);
        }
      }
      
      if (conditions.length === 0) return null;
      
      sql += conditions.join(' AND ') + ' LIMIT 1';
      const [rows] = await connection.execute(sql, params);
      return rows[0] || null;
    } finally {
      connection.release();
    }
  },

  // 根据ID查找用户
  async findById(id) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute('SELECT * FROM users WHERE id = ?', [id]);
      return rows[0] || null;
    } finally {
      connection.release();
    }
  },

  // 创建用户
  async create(userData) {
    const connection = await pool.getConnection();
    try {
      // 密码加密
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      
      const sql = `INSERT INTO users (username, email, password, name, role, department, level, phone, status, permissions, createdAt, updatedAt) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`;
      
      const params = [
        userData.username,
        userData.email.toLowerCase(),
        hashedPassword,
        userData.name,
        userData.role || 'sales',
        userData.department || '',
        userData.level || 1,
        userData.phone || '',
        userData.status || 'active',
        JSON.stringify(userData.permissions || [])
      ];
      
      const [result] = await connection.execute(sql, params);
      return await this.findById(result.insertId);
    } finally {
      connection.release();
    }
  },

  // 更新用户
  async findByIdAndUpdate(id, updateData) {
    const connection = await pool.getConnection();
    try {
      const fields = [];
      const params = [];
      
      Object.keys(updateData).forEach(key => {
        if (key === 'password') {
          // 如果更新密码，需要加密
          fields.push('password = ?');
          params.push(updateData[key]);
        } else if (key === 'permissions' && Array.isArray(updateData[key])) {
          fields.push('permissions = ?');
          params.push(JSON.stringify(updateData[key]));
        } else if (key !== '_id' && key !== 'id') {
          fields.push(`${key} = ?`);
          params.push(updateData[key]);
        }
      });
      
      if (fields.length === 0) return await this.findById(id);
      
      fields.push('updatedAt = NOW()');
      params.push(id);
      
      const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
      await connection.execute(sql, params);
      
      return await this.findById(id);
    } finally {
      connection.release();
    }
  },

  // 密码验证方法
  async comparePassword(user, candidatePassword) {
    return await bcrypt.compare(candidatePassword, user.password);
  },

  // 查找所有用户
  async find(query = {}) {
    const connection = await pool.getConnection();
    try {
      let sql = 'SELECT * FROM users WHERE 1=1';
      const params = [];
      
      if (query.role) {
        if (query.role.$in && Array.isArray(query.role.$in)) {
          // 处理 $in 查询
          const placeholders = query.role.$in.map(() => '?').join(',');
          sql += ` AND role IN (${placeholders})`;
          params.push(...query.role.$in);
        } else {
          sql += ' AND role = ?';
          params.push(query.role);
        }
      }
      if (query.status) {
        sql += ' AND status = ?';
        params.push(query.status);
      }
      if (query._id || query.id) {
        sql += ' AND id = ?';
        params.push(query._id || query.id);
      }
      
      sql += ' ORDER BY createdAt DESC';
      
      const [rows] = await connection.execute(sql, params);
      return rows;
    } finally {
      connection.release();
    }
  }
};

module.exports = User;


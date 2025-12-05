const { pool } = require('../config/database');

const Department = {
  async find(query = {}) {
    const connection = await pool.getConnection();
    try {
      // 优化查询：简化JOIN，只在需要时才计算memberCount
      const needMemberCount = query.includeMemberCount !== false; // 默认包含
      const needManagerName = query.includeManagerName !== false; // 默认包含
      const needParentName = query.includeParentName !== false; // 默认包含
      
      let sql = `SELECT d.*`;
      
      if (needManagerName) {
        sql += `, m.name as managerName`;
      }
      if (needParentName) {
        sql += `, p.name as parentName`;
      }
      if (needMemberCount) {
        // 使用department字段（字符串）匹配部门名称
        sql += `, (SELECT COUNT(*) FROM users WHERE department = d.name) as memberCount`;
      }
      
      sql += ` FROM departments d`;
      
      if (needManagerName) {
        sql += ` LEFT JOIN users m ON d.managerId = m.id`;
      }
      if (needParentName) {
        sql += ` LEFT JOIN departments p ON d.parentId = p.id`;
      }
      
      sql += ` WHERE 1=1`;
      const params = [];
      
      if (query.parentId !== undefined) {
        if (query.parentId === null) {
          sql += ' AND d.parentId IS NULL';
        } else {
          sql += ' AND d.parentId = ?';
          params.push(query.parentId);
        }
      }
      if (query.isActive !== undefined) {
        sql += ' AND d.isActive = ?';
        params.push(query.isActive);
      }
      
      sql += ' ORDER BY d.sortOrder ASC, d.createdAt ASC';
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
    } catch (error) {
      console.error('Department.find 错误:', error);
      throw error;
    } finally {
      connection.release();
    }
  },

  async findById(id) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT d.*, 
         m.name as managerName,
         p.name as parentName
         FROM departments d 
         LEFT JOIN users m ON d.managerId = m.id
         LEFT JOIN departments p ON d.parentId = p.id
         WHERE d.id = ?`,
        [id]
      );
      return rows[0] || null;
    } finally {
      connection.release();
    }
  },

  // 根据code查找部门（用于钉钉部门ID映射）
  async findByCode(code) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM departments WHERE code = ?',
        [code]
      );
      return rows[0] || null;
    } finally {
      connection.release();
    }
  },

  async create(data) {
    const connection = await pool.getConnection();
    try {
      const sql = `INSERT INTO departments (name, code, parentId, managerId, description, sortOrder, isActive) 
                   VALUES (?, ?, ?, ?, ?, ?, ?)`;
      const params = [
        data.name,
        data.code || '',
        data.parentId || null,
        data.managerId || null,
        data.description || '',
        data.sortOrder || 0,
        data.isActive !== undefined ? data.isActive : true
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
        if (key !== '_id' && key !== 'id' && !key.startsWith('manager') && !key.startsWith('parent')) {
          fields.push(`${key} = ?`);
          params.push(data[key]);
        }
      });
      
      if (fields.length === 0) return await this.findById(id);
      fields.push('updatedAt = NOW()');
      params.push(id);
      
      await connection.execute(`UPDATE departments SET ${fields.join(', ')} WHERE id = ?`, params);
      return await this.findById(id);
    } finally {
      connection.release();
    }
  },

  async findByIdAndDelete(id) {
    const connection = await pool.getConnection();
    try {
      // 检查是否有子部门
      const [children] = await connection.execute('SELECT COUNT(*) as count FROM departments WHERE parentId = ?', [id]);
      if (children[0].count > 0) {
        throw new Error('该部门下存在子部门，无法删除');
      }
      
      // 检查是否有员工
      const [users] = await connection.execute('SELECT COUNT(*) as count FROM users WHERE departmentId = ?', [id]);
      if (users[0].count > 0) {
        throw new Error('该部门下存在员工，无法删除');
      }
      
      await connection.execute('DELETE FROM departments WHERE id = ?', [id]);
      return { id };
    } finally {
      connection.release();
    }
  },

  async getTree(parentId = null) {
    const connection = await pool.getConnection();
    try {
      const departments = await this.find({ parentId, isActive: true });
      const tree = await Promise.all(departments.map(async (dept) => {
        const children = await this.getTree(dept.id);
        return {
          ...dept,
          children: children.length > 0 ? children : undefined
        };
      }));
      return tree;
    } finally {
      connection.release();
    }
  }
};

module.exports = Department;


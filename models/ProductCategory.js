const { pool } = require('../config/database');

const ProductCategory = {
  async find(query = {}) {
    const connection = await pool.getConnection();
    try {
      let sql = 'SELECT * FROM product_categories WHERE 1=1';
      const params = [];
      
      if (query.parentId !== undefined) {
        if (query.parentId === null) {
          sql += ' AND parentId IS NULL';
        } else {
          sql += ' AND parentId = ?';
          params.push(query.parentId);
        }
      }
      if (query.isActive !== undefined) {
        sql += ' AND isActive = ?';
        params.push(query.isActive);
      }
      
      sql += ' ORDER BY sortOrder ASC, createdAt ASC';
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
      const [rows] = await connection.execute('SELECT * FROM product_categories WHERE id = ?', [id]);
      return rows[0] || null;
    } finally {
      connection.release();
    }
  },

  async create(data) {
    const connection = await pool.getConnection();
    try {
      const sql = `INSERT INTO product_categories (name, parentId, description, sortOrder, isActive) 
                   VALUES (?, ?, ?, ?, ?)`;
      const params = [
        data.name,
        data.parentId || null,
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
        if (key !== '_id' && key !== 'id') {
          fields.push(`${key} = ?`);
          params.push(data[key]);
        }
      });
      
      if (fields.length === 0) return await this.findById(id);
      fields.push('updatedAt = NOW()');
      params.push(id);
      
      await connection.execute(`UPDATE product_categories SET ${fields.join(', ')} WHERE id = ?`, params);
      return await this.findById(id);
    } finally {
      connection.release();
    }
  },

  async findByIdAndDelete(id) {
    const connection = await pool.getConnection();
    try {
      // 检查是否有子分类
      const [children] = await connection.execute('SELECT COUNT(*) as count FROM product_categories WHERE parentId = ?', [id]);
      if (children[0].count > 0) {
        throw new Error('该分类下存在子分类，无法删除');
      }
      
      // 检查是否有产品
      const [products] = await connection.execute('SELECT COUNT(*) as count FROM products WHERE categoryId = ?', [id]);
      if (products[0].count > 0) {
        throw new Error('该分类下存在产品，无法删除');
      }
      
      await connection.execute('DELETE FROM product_categories WHERE id = ?', [id]);
      return { id };
    } finally {
      connection.release();
    }
  },

  async getTree(parentId = null) {
    const connection = await pool.getConnection();
    try {
      const categories = await this.find({ parentId, isActive: true });
      const tree = await Promise.all(categories.map(async (cat) => {
        const children = await this.getTree(cat.id);
        return {
          ...cat,
          children: children.length > 0 ? children : undefined
        };
      }));
      return tree;
    } finally {
      connection.release();
    }
  }
};

module.exports = ProductCategory;

